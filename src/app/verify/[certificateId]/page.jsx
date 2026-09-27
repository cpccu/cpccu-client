import { notFound, redirect } from 'next/navigation';

/**
 * `/verify/[certificateId]` — the emailed certificate link, and nothing else.
 *
 * WHY THIS PAGE LOOKS LIKE A NO-OP BUT IS NOT: the certificate email every
 * recipient receives points at `/verify/<certificateId>`, not at
 * `/certificate/<certificateId>`. This route is the single hop that turns that
 * email link into the real certificate page. If it fails, EVERY emailed
 * certificate link in the world is broken — silently, because a redirect that
 * "works" produces no error and logs nothing anywhere.
 *
 * `params` IS A PROMISE, NOT AN OBJECT. This is not a style preference: the
 * installed Next's own file-convention reference declares the prop as
 * `params: Promise<{ slug: string }>`
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md:13`)
 * and shows `const { slug } = await params` (same file, `:46-48`). Destructuring
 * the Promise directly yields `certificateId === undefined` on EVERY request,
 * which is the exact failure this function previously had: it took the guard
 * branch every time and every emailed link became a dead bounce.
 *
 * The sibling page `src/app/(main)/certificate/[certificateId]/page.jsx:6,11`
 * does it correctly (`await params` in both `generateMetadata` and the default
 * export), which is why this one was never noticed — the two routes look
 * identical at a glance and only one of them is correct.
 */
export default async function VerifyCertificatePage({ params }) {
  const { certificateId } = await params;

  // A MISSING SEGMENT IS A 404, NOT A REDIRECT. The previous code sent an
  // unresolvable segment back to `/certificate`, which is (a) uninformative for
  // whoever followed a stale or mistyped link, and (b) a redirect that lands in
  // the same route tree the reader was already trying to escape. `notFound()`
  // renders the real `src/app/not-found.jsx` and reports the bad link honestly.
  //
  // NOTE THIS GUARD IS DEFENSIVE IN PRACTICE: the `[certificateId]` segment is
  // part of the route, so a bare `/verify` never matches this file at all
  // (there is no `page.jsx` at `/verify`). The original intent behind that
  // branch — "a `/verify` link with no usable certificate should still land the
  // reader on the certificate page" — is preserved by the redirect below, which
  // sends every resolvable `/verify/<id>` link straight there.
  if (!certificateId || typeof certificateId !== 'string') {
    notFound();
  }

  // `encodeURIComponent` is load-bearing and is preserved from the original:
  // a certificate id is attacker-influenceable only in the sense that a link
  // can be edited before it is followed, so the segment is escaped before being
  // interpolated into a path. Without it, a crafted id could inject extra path
  // segments and land the reader on a different route than the certificate.
  redirect(`/certificate/${encodeURIComponent(certificateId)}`);
}
