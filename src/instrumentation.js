/**
 * ============================================================================
 * Next.js instrumentation hook — the FRAMEWORK-IDIOM half of the Mongo
 * connection bootstrap.
 * ============================================================================
 * Lives in `src/` because this project uses a `src` directory (`src/app`,
 * `src/lib`); Next resolves `instrumentation` from the same root as the app
 * directory. It is `.js`, not `.tsx`/`.ts`: the project has `jsconfig.json` and
 * no `tsconfig.json`, and introducing TypeScript here would mean introducing it
 * for the project.
 *
 * ---------------------------------------------------------------------------
 * THE BUG THIS EXISTS TO FIX
 * ---------------------------------------------------------------------------
 * Nothing in this application opened a MongoDB connection. `db.js` exported
 * `connectDB()` and `getDb()`, and the only caller in the whole tree was
 * `src/lib/certificate-metadata.js` — a `generateMetadata` helper, not a route.
 * The model files in `src/lib/server/models/` (8 files, 28 `mongoose.model(...)`
 * registrations) only REGISTER schemas; that never opens a socket, and Mongoose
 * has no auto-connect. The Express original called `connectDB()` from
 * `cpccu-server/src/index.js:7` at process start, and that file has no
 * counterpart here.
 *
 * The consequence was that every database-touching endpoint let Mongoose BUFFER
 * the command (Mongoose buffers when it has no connection rather than failing
 * fast), waited out the default 10 s `bufferTimeoutMS`, and then rejected with
 * `MongooseError: Operation ... buffering timed out after 10000ms`. That is all
 * 65 endpoint methods across 53 route files. The API was non-functional.
 *
 * NOTE ON A PRIOR MISDIAGNOSIS, RECORDED SO IT IS NOT REPEATED: the buffering
 * error was previously classified as an ENVIRONMENT failure ("no MongoDB
 * available in the test environment"). That classification was wrong. The
 * identical error occurs against a perfectly reachable Mongo with a valid
 * `MONGODB_URI`, because nothing initiates the connection. It is a code defect.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE IS *NOT* SUFFICIENT — IT IS THE BEST-EFFORT LAYER
 * ---------------------------------------------------------------------------
 * The real guarantee lives in the route layer: `runController` in
 * `src/lib/server/handler.js` awaits `getDb()` before every controller runs.
 * That is the layer that cannot be skipped. `register()` here exists because it
 * is the framework's designated once-per-instance bootstrap point, it moves the
 * connect cost OFF the first request's critical path, and it restores parity
 * with the Express original. It is deliberately treated as advisory, for two
 * reasons that are properties of the framework rather than of this codebase:
 *
 *   - IT RUNS ONCE PER SERVER INSTANCE, on whichever process boots the server —
 *     `next dev`, `next start`, or a Vercel function's first cold invocation. A
 *     route handler can be invoked later on a DIFFERENT instance of that pool,
 *     and a warm worker can be handed an invocation whose process was booted
 *     under conditions where instrumentation did not run. The route layer
 *     therefore cannot assume `register()` already happened, which is exactly
 *     why it awaits `getDb()` itself. (Verified in Next 16.3.6: `register()` is
 *     invoked from `NextServer.prepareImpl` ->
 *     `runInstrumentationHookIfAvailable`
 *     (`node_modules/next/dist/server/next-server.js:571-580`), i.e. from server
 *     start — NOT from the build. A temporary probe log added to `register()`
 *     and a full `npm run build` confirmed it is not entered during a build.)
 *   - NEXT PUTS THIS FILE IN THE MODULE GRAPH OF *EVERY* RUNTIME COMPILATION,
 *     including the edge one, whether or not any edge route exists. That is why
 *     nothing here may touch the database at MODULE SCOPE: a top-level
 *     `import ... from '@/lib/server/db'` would drag `mongoose` (native
 *     optional drivers, `node:async_hooks`, `node:dns`) and the
 *     `import 'server-only'` assertion into that graph. The lazy import inside
 *     `register()` keeps the edge compilation free of both.
 *
 * Therefore the whole body is best-effort: it never throws and never blocks the
 * boot. What the Express original did on a connect failure is the behaviour to
 * reason from, and note what it actually was. TWO FILES MATTER, and conflating
 * them understates the problem:
 *
 *   - `cpccu-server/src/DB/index.js:13-16` — the `catch` INSIDE `connectDB()`
 *     does `console.error('MONMODB connection error:', error)` and then
 *     `process.exit(1)`. `process.exit` tears the process down immediately, so
 *     this is the original's REAL failure mode: a failed database connection
 *     killed the process. (It also logged the RAW driver error, which embeds the
 *     full connection string and therefore the database password — the second
 *     original defect, and the reason the `catch` below logs `message`/`name`
 *     only.)
 *   - `cpccu-server/src/index.js:30-32` — a bare
 *     `.catch((error) => console.log('MONGODB connection is failed', error))`
 *     on the `connectDB()` promise. THIS IS UNREACHABLE, and reading it as the
 *     original's policy is the mistake this paragraph exists to prevent:
 *     `process.exit(1)` in `DB/index.js` kills the process before that promise
 *     can reject, and `app.listen` is inside the `.then` (`:26-28`), which
 *     therefore never runs either. So the original's observable outcome on a
 *     failed connect was SILENT PROCESS DEATH WITH NO LISTENER — a started
 *     process serving nothing — not a logged, handled failure.
 *
 * That is a stronger argument for the policy below than "the original only
 * logged" would have been. The serverless equivalent of "do not start serving" is
 * "do not fail this invocation": there is one request to fail, not a process to
 * take down, so a cold start with an unreachable database must still be able to
 * answer the requests that do not need the database. Hence the `catch` below
 * logs and returns.
 */

/**
 * Called once per server instance at bootstrap, before any request is served.
 *
 * NO-OP UNLESS `process.env.NEXT_RUNTIME === 'nodejs'`. Next evaluates this
 * module for BOTH runtimes, and `mongoose` cannot run on the edge runtime
 * (it needs `node:async_hooks`, `node:dns` and native optional drivers).
 *
 * THE GUARD COSTS NOTHING AT RUNTIME, AND THAT IS NOT AN ACCIDENT. `NEXT_RUNTIME`
 * is not a runtime lookup at all: Next substitutes a LITERAL at build time via
 * `getDefineEnv` — `'process.env.NEXT_RUNTIME': isEdgeServer ? 'edge' :
 * isNodeServer ? 'nodejs' : ''`
 * (`node_modules/next/dist/build/define-env.js:80`). So the comparison below is
 * constant-folded per compilation and the whole branch disappears from the
 * emitted chunk:
 *
 *   - node compilation  -> `'nodejs'`, guard folds to false, connect proceeds;
 *   - edge compilation  -> `'edge'`,  guard folds to a bare early return, and
 *                          `mongoose` is never even resolved;
 *   - a shared/neither compilation -> `''`, also a bare early return.
 *
 * Verified on this build: the emitted `server/instrumentation.js` chunk contains
 * the `try`/`catch` and the lazy import with NO trace of the guard, i.e. Next
 * compiled this file for `nodejs` and folded the branch away. (This app has no
 * edge route — all 53 `route.js` files declare `runtime = 'nodejs'` — so no edge
 * compilation of this file is emitted at all, and `.next/server/` contains no
 * `edge-instrumentation.js`.) The point of citing the mechanism rather than just
 * the guard is that a branch on a value Next does NOT inline would keep costing a
 * `process.env` read and a string compare on every boot; `NEXT_RUNTIME` is the
 * one variable Next guarantees to substitute, which is why it is the right thing
 * to branch on.
 *
 * @returns {Promise<void>} never rejects.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    // Nothing else to do: there is no edge-compatible database, and the routes
    // that need one all declare `runtime = 'nodejs'` explicitly. Returning
    // here — rather than wrapping the import in a conditional dynamic import —
    // is what keeps `mongoose` out of the edge bundle entirely.
    return;
  }

  try {
    // LAZY IMPORT, AND THE REASON IS THE EDGE COMPILATION, NOT STYLE. A
    // module-scope `import { getDb } from '@/lib/server/db'` would make this
    // module — and therefore the edge compilation of it — resolve `db.js`,
    // which imports `mongoose` AND asserts `import 'server-only'`. Either one
    // breaks the edge build. Importing inside the function body defers
    // resolution until the nodejs evaluation actually runs.
    const { getDb } = await import('@/lib/server/db');

    // The SAME call the route layer makes, deliberately. `getDb()` is idempotent
    // and memoised on `globalThis.__mongoose` (`db.js:18,60-90`), so this opens
    // the pool at most once per instance and the route layer's later `await` is
    // a resolved-promise microtask against the same connection. If both layers
    // called `connectDB()` with different code paths the memo could be
    // bypassed; calling the documented entry point means they cannot diverge.
    await getDb();
  } catch (error) {
    // BEST-EFFORT BY CONTRACT: LOG, DO NOT THROW, DO NOT BLOCK THE BOOT.
    //
    // A database that is unreachable on a cold start must not fail the deploy or
    // the boot. The failure surfaces later, on the request that actually needs
    // the database, where `handler.js` awaits `getDb()` itself and `apiRoute`'s
    // catch shapes the same 500 envelope it always has.
    //
    // MESSAGE AND NAME ONLY. `db.js:137-144` documents why the raw driver error
    // is never logged: it embeds the full connection string, which carries the
    // database username and password, and those would then sit in the function
    // logs for the whole log-retention window. This call site obeys the same
    // rule rather than widening the leak by one.
    console.error(
      '[instrumentation] MongoDB warm-up connection failed; the API will ' +
        'connect lazily on the first database-backed request instead:',
      { message: error?.message, name: error?.name },
    );
  }
}
