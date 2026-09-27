import 'server-only';

import mongoose from 'mongoose';
import { DB_NAME } from '@/lib/server/constants';
import { validateEnv } from '@/lib/server/env';

/**
 * Mongoose connection memo, stashed on `globalThis`.
 *
 * On Vercel a warm lambda reuses the same Node process across many requests, but
 * every invocation that re-evaluates this module would otherwise open a brand
 * new connection pool. Mongo then hits its connection limit, `mongoose.connect()`
 * fails, and — critically — Mongoose *buffers* commands when it has no connection
 * instead of failing fast, so the request hangs for the default 10 s
 * `bufferCommands` window and then 500s. Hoisting onto `globalThis` means the
 * first request pays the connect cost and every subsequent request reuses it.
 */
globalThis.__mongoose ??= { conn: null, promise: null, watchRegistered: false };

/**
 * `maxPoolSize: 1` is deliberate, not a performance regression.
 *
 * Vercel shares a 1,024 file-descriptor budget across ALL concurrent function
 * executions on a given instance. Mongoose's default `maxPoolSize` is 100; a
 * handful of concurrent lambdas each opening a 100-connection pool exhausts the
 * descriptor budget for every other function on the box, which manifests as
 * unrelated `EMFILE` / socket errors in code that never touches the database.
 *
 * THE ASSUMPTION THIS IS BUILT ON, STATED AS AN ASSUMPTION: a single serverless
 * INVOCATION executes one request at a time. That is true of the JS execution
 * itself — an invocation runs one request handler to completion — but it is NOT
 * true of a warm INSTANCE, which multiplexes I/O across many invocations
 * concurrently. Under a burst those invocations serialise on the one pooled
 * connection, so this configuration trades request latency under burst for not
 * exhausting a shared descriptor budget. That is the right side of the trade for
 * this deployment (the site is a small university club, and a 30-second slowdown
 * on a burst beats `EMFILE` in unrelated routes), but it is a real cost and not
 * a free win. If traffic ever grows enough that the queue is visible as latency,
 * the fix is a SHARED external pool (Atlas Data API, a connection proxy, or a
 * platform with a larger per-instance descriptor budget) — not a larger
 * `maxPoolSize` on a function that shares its budget with its neighbours.
 *
 * `serverSelectionTimeoutMS: 8000` keeps a replica-set hiccup from parking a
 * request for Mongo's 30 s default — the platform kills far sooner than that,
 * so a long wait just burns the invocation.
 */
const CONNECT_OPTIONS = {
  maxPoolSize: 1,
  serverSelectionTimeoutMS: 8000,
};

async function connectDB() {
  // Validated on FIRST USE, not at module import: a top-level throw in this
  // module fails `next build` for every route, including those that never touch
  // Mongo. Without this check, an unset `MONGODB_URI` string-concatenates into
  // the nonsense host `"undefined/CPCCU"` and surfaces as a DNS/ENOTFOUND
  // failure that says nothing about the real cause.
  validateEnv();

  const cached = globalThis.__mongoose;

  // Another concurrent call in this same process already won the race and is
  // holding the in-flight promise. Await theirs rather than opening a second pool.
  //
  // THE SHORT-CIRCUIT ALSO LOGS, AND IT LOGS IDENTICALLY TO A FRESH CONNECT.
  // That is not cosmetic. The line used to live only on the fresh-connect path
  // below, so the early return bypassed it: "MONGODB is connected!" was emitted
  // at most ONCE per live connection and could not distinguish "we are
  // connected" from "we are replaying a memo that was never cleared" — which is
  // precisely the question an operator asks when a warm instance misbehaves, and
  // which the old shape answered wrongly by silence. Duplicating ONE log line on
  // both branches is cheap; the alternative is a log that lies about its own
  // frequency. A REJECTED memoised promise is a separate case and is left alone:
  // the `.catch` below nulls the memo on failure, so a rejection here can only be
  // the concurrent caller's in-flight connect, and the fresh-connect caller's own
  // `catch` is the one that reports it — exactly as before this change.
  //
  // WHAT IS SAFE TO PRINT HERE, AND WHY: `connectionInstance.connection.host` is
  // the RESOLVED HOSTNAME ONLY — a bare `db0.production.mongodb.net` — with no
  // username, no password, no database name and no port. The raw driver ERROR is
  // the dangerous one (it embeds the whole connection string); see the catch
  // below for the rule that governs it.
  if (cached.promise) {
    const connectionInstance = await cached.promise;

    console.log(
      `MONGODB is connected! DB host: ${connectionInstance.connection.host}`,
    );
    return connectionInstance;
  }

  cached.promise = mongoose
    .connect(`${process.env.MONGODB_URI}/${DB_NAME}`, CONNECT_OPTIONS)
    .catch((error) => {
      // Clear the memo so the NEXT invocation retries from a clean slate
      // instead of replaying this rejected promise forever. A warm lambda will
      // be reused for many requests and must not be poisoned by one bad boot.
      globalThis.__mongoose.promise = null;
      throw error;
    });

  try {
    const connectionInstance = await cached.promise;

    // A SUCCESSFUL connect is not the end of the story on a warm lambda. The
    // memo is cleared ONLY on rejection, so a connection that drops AFTER a
    // successful connect would otherwise leave `cached.promise` fulfilled
    // forever: every subsequent request awaits a promise that resolves instantly,
    // believes it has a connection, issues a command, and watches Mongoose buffer
    // it for the full 10 s `bufferCommands` window before erroring — precisely the
    // hang this module's docblock exists to prevent, and completely invisible
    // because nothing is ever rejected. Nulling the memo on `disconnected` makes
    // the next call observe `promise === null` and reconnect.
    //
    // Registered exactly ONCE, guarded on a flag rather than on `promise` (which
    // is nulled by the very handler being installed), so a reconnect after a drop
    // cannot stack a second listener and eventually trip Node's
    // MaxListenersExceededWarning. `disconnected` fires on a transient network
    // blip as well as on a real shutdown; reconnecting is correct for both.
    if (!cached.watchRegistered) {
      cached.watchRegistered = true;
      mongoose.connection.on('disconnected', () => {
        globalThis.__mongoose.promise = null;
      });
    }

    console.log(
      `MONGODB is connected! DB host: ${connectionInstance.connection.host}`,
    );
    return connectionInstance;
  } catch (error) {
    // The Express original called `process.exit(1)` here. That is fatal in a
    // serverless function: it tears down the whole warm worker mid-flight and
    // every other in-progress request on that instance dies with it. Log and
    // rethrow so `toErrorResponse` can shape a 500 for THIS request only.
    //
    // The raw driver error is NOT logged. It embeds the full connection string,
    // which carries the database username and password, and the credentials would
    // then sit in the function logs for the lifetime of the log retention. Only
    // the message and the driver error name are emitted.
    console.error('MONGODB connection error:', {
      message: error?.message,
      name: error?.name,
    });
    throw error;
  }
}

/**
 * Returns the live Mongoose connection, connecting on first use.
 * This is the shape route handlers should call — `connectDB()` is kept as an
 * alias because the Express codebase (and any ported controller still referring
 * to it by that name) calls it directly at boot.
 */
async function getDb() {
  await connectDB();
  return mongoose.connection;
}

export { connectDB, getDb, mongoose };
