import 'server-only';

import { Readable } from 'node:stream';

import { v2 as cloudinarySdk } from 'cloudinary';

import { MAX_UPLOAD_BYTES, uploadSizeMessage } from '@/lib/server/constants';
import { ApiError } from '@/lib/server/errors';

/**
 * `MAX_UPLOAD_BYTES` and `uploadSizeMessage` are imported from `constants.js`
 * (a leaf module) and are NOT re-exported: the cap's rationale (Vercel's 4.5 MB
 * platform ceiling) is documented in `constants.js`, and every consumer — the
 * error shaper in `errors.js` and the `Content-Length` gate in `request.js` —
 * cites that one number by importing it there directly. A re-export here would
 * give the cap a second, silently-drifting home. See the memory analysis in
 * `readMultipart` for why the gate must come first.
 */

/**
 * The only Cloudinary folder this app writes to. `parsePublicIdFromCloudinaryUrl`
 * requires a derived public ID to start with this, which is what guarantees a
 * destroy can only ever target an asset this app created.
 */
const DEFAULT_UPLOAD_FOLDER = 'cpccu/profiles';

/**
 * Formats a caught SDK error for logging WITHOUT dumping the payload.
 *
 * The Cloudinary SDK's error objects can carry the entire upload payload — the
 * base64 data URI, and before this change the `Buffer` — along with credential
 * material in the request config. `console.error(err)` or
 * `JSON.stringify(err)` therefore risks writing megabytes of base64 and a live
 * secret into the function logs, where they are retained, billed, and readable
 * by anyone with log access. The message plus this small explicit allow-list of
 * diagnostic fields carries everything actually needed to triage a failure
 * (Cloudinary's own error text, its HTTP status, and the response body it
 * returns) and nothing else.
 *
 * The allow-list is explicit and minimal on purpose: a new SDK field is not
 * logged until someone decides it is safe.
 */
function describeSdkError(error) {
  return {
    message: error?.message,
    http_code: error?.http_code,
    error: error?.error?.message,
  };
}

/**
 * The original `cpccu-server/src/config/cloudinaryConfig.js:8-13` threw at MODULE
 * TOP LEVEL when the Cloudinary env vars were absent. That is a `next build`
 * blocker here: the module is transitively imported by nearly every controller
 * (the barrel `utils/utility.js:6` re-exports `uploadOnCloudinary`, so
 * importing anything from the barrel dragged the throw into the entire API), and
 * a top-level throw fails the build even for routes that never touch an image.
 * Same root cause as the old `cpccu-server/src/utils/firebaseAuth.js`, which had
 * the identical top-level-throw shape.
 *
 * Configuration is therefore validated and applied on FIRST CALL, and memoised
 * per warm instance.
 */
let configured = null;

function getCloudinary() {
  if (configured) return configured;

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error(
      'Missing Cloudinary configuration. Please set CLOUDINARY_CLOUD_NAME, ' +
        'CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment.',
    );
  }

  cloudinarySdk.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

  configured = cloudinarySdk;
  return configured;
}

/**
 * Extracts the upload public ID from a Cloudinary DELIVERY url so it can be
 * destroyed later. Returns `null` on anything unrecognised rather than throwing,
 * because the input is a stored database value that may predate Cloudinary — and,
 * far more importantly, because of the free-text Cloudinary URL input in
 * `src/components/admin-image-upload-field.jsx:56`.
 *
 * WHY THIS IS A HARDENED PARSER AND NOT STRING SPLITTING. `destroyCloudinaryImage`
 * runs against the SHARED Cloudinary account with the account-wide API secret.
 * Any URL a moderator can store becomes a deletion primitive for whatever public
 * ID can be derived from it: a plain `split('/')` accepted any host and any
 * path, so a moderator could store another member's asset URL — or any string at
 * all — and the next profile update would call `destroy()` on the derived ID and
 * delete a victim's asset. The original Express code had exactly this shape.
 *
 * The chain, all of which must hold or the result is `null`:
 *  1. The value parses as an absolute URL (`new URL`), which rejects relative
 *     paths, `javascript:` URLs and bare garbage outright.
 *  2. `protocol === 'https:'` — a `http:` delivery URL is not how this app ever
 *     stores an asset and would indicate a downgrade attempt.
 *  3. `hostname === 'res.cloudinary.com'` — Cloudinary's only delivery host for
 *     these assets. Without this, a URL on any other host is accepted and a
 *     plausible-looking ID is destroyed in the shared account.
 *  4. The delivery path starts with `/<CLOUDINARY_CLOUD_NAME>/`, so a URL
 *     pointing at a DIFFERENT Cloudinary account (or an unrelated path) cannot
 *     produce a public ID that happens to collide with a real one here.
 *  5. The path contains the `upload` version segment and a public ID after it.
 *  6. The derived public ID starts with `cpccu/`, the only folder this app ever
 *     writes to (`DEFAULT_UPLOAD_FOLDER` below). This is the decisive
 *     constraint: it means even a leaked or guessed URL can only ever destroy an
 *     asset this app created, never another tenant's or a manually-uploaded
 *     asset living in the same Cloudinary account.
 */
function parsePublicIdFromCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  if (parsed.hostname !== 'res.cloudinary.com') return null;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return null;

  // ===================================================================
  // NEVER ADD `decodeURIComponent` (OR ANY DECODING) TO THIS FUNCTION.
  // ===================================================================
  //
  // The parser is fail-closed for encoded separators NOT because `pathname` is
  // decoded — IT IS NOT. The WHATWG URL parser leaves `pathname` exactly as
  // written, so `%2F` stays the three literal characters `%`, `2`, `F` and can
  // never become a path separator here. (An earlier comment in this file claimed
  // the opposite; that claim was simply false, and it was dangerous precisely
  // because it read like a reason NOT to add decoding.)
  //
  // Keeping the percent-escapes intact is what makes the `cpccu/` prefix test
  // below hold. `.../upload/cpccu%2Fprofiles%2Fx/...` yields the publicId
  // `cpccu%2Fprofiles%2Fx`, which does NOT start with `cpccu/` and is rejected.
  // Add `decodeURIComponent` and that same URL becomes `cpccu/profiles/x` —
  // accepted — and, worse, `%2e%2e` decodes to a literal `..` that survives the
  // URL parser's own path normalisation (it normalises the ENCODED form, in
  // which `..` is ordinary text). The result is a publicId of
  // `cpccu/../../<anything>`, the prefix test PASSES, and `destroyCloudinaryImage`
  // calls `uploader.destroy('cpccu/../../<other-tenant-asset>')` against the
  // SHARED Cloudinary account using the account-wide API secret. That is a
  // cross-tenant deletion primitive, and it is the exact class of bug this whole
  // parser exists to prevent.
  //
  // If a public ID ever genuinely needs decoding, the fix is a validation step
  // that REJECTS encoded `%` and `.` sequences after decoding — not decoding here.
  //
  // Verified rejections (each returns `null`):
  //   lookalike host    https://res.cloudinary.com.evil.test/... → null
  //   `..` traversal    .../upload/cpccu/../<other>/x           → null
  //   `cpccu/../`       .../upload/cpccu/../x                  → null
  //   other cloud name  .../<other-cloud>/upload/cpccu/...    → null
  // ===================================================================
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments[0] !== cloudName) return null;

  const uploadIndex = segments.indexOf('upload');
  if (uploadIndex === -1 || uploadIndex + 1 >= segments.length) return null;

  // Everything between the `upload` marker and the version component is the
  // public ID, folder segments included — Cloudinary stores the ID WITH its
  // folders. The trailing extension is stripped because Cloudinary keeps the
  // public ID WITHOUT it.
  const afterUpload = segments.slice(uploadIndex + 1).join('/');
  const versionIndex = afterUpload.indexOf('/');
  if (versionIndex === -1) return null;

  const publicId = afterUpload.slice(versionIndex + 1).replace(/\.[^/.]+$/, '');
  if (!publicId.startsWith(`${DEFAULT_UPLOAD_FOLDER}/`)) return null;

  return publicId;
}

/**
 * Port of `cpccu-server/src/utils/cloudinary.js:17-26`.
 * Swallows failures and returns `false` — the original did the same, and callers
 * treat a failed delete as non-fatal (an orphaned asset is preferable to a
 * failed profile update).
 */
async function destroyCloudinaryImage(publicId) {
  if (!publicId || typeof publicId !== 'string') return false;
  try {
    await getCloudinary().uploader.destroy(publicId);
    return true;
  } catch (error) {
    // `describeSdkError`, never the raw object — a destroy failure can echo back
    // the resource metadata, and the raw SDK error may carry the request config
    // including the account's API secret.
    console.error('Error deleting Cloudinary image:', describeSdkError(error));
    return false;
  }
}

/**
 * Media types this app will accept. Cloudinary REJECTS a mismatch server-side
 * using the file's actual content, which is a stronger control than any
 * client-side check: the multipart `Content-Type` on an upload part is supplied
 * by the client and means nothing. Cloudinary sniffs the bytes.
 *
 * Added deliberately — the Express original's multer config had NO `fileFilter`,
 * so any file type was accepted as long as Cloudinary could store it. `mp4` and
 * `webm` are here because `post.controller.js:27,90` uploads videos and
 * `resource_type: 'auto'` stores them as such.
 */
const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm'];

/**
 * Normalises whatever the caller has into a Node `Readable`, without ever
 * producing a base64 copy of the payload.
 *
 * A multipart `File` (undici / `node:buffer`) exposes `.stream()` as a WEB
 * `ReadableStream`; `Readable.fromWeb` bridges it to the Node stream the
 * Cloudinary SDK consumes. A `Buffer` becomes a single-chunk readable. Anything
 * that is already a Node `Readable` is passed straight through.
 */
function toNodeReadable(file) {
  if (typeof file?.stream === 'function') {
    const web = file.stream();
    // A `Blob`-like whose `stream()` already returns a Node Readable is left
    // alone; a web ReadableStream needs the bridge.
    return typeof web?.getReader === 'function' ? Readable.fromWeb(web) : web;
  }

  if (Buffer.isBuffer(file) || file instanceof Uint8Array) {
    return Readable.from([file]);
  }

  return file;
}

/**
 * Port of `uploadOnCloudinary`, changed to accept bytes instead of a filesystem
 * path.
 *
 * The original took a path because `multer.diskStorage` wrote to `./public/temp`
 * and the function called `fs.unlinkSync(localFilePath)` afterwards. Both halves
 * are fatal on Vercel: the bundle is read-only, `/tmp` is the only writable path,
 * and an execution only lives for the duration of the request.
 *
 * WHY A STREAM AND NOT A BASE64 DATA URI. A data URI inflates the payload by
 * exactly 4/3 (a 4 MiB file becomes a 5.59 MB string, which V8 holds as ~11 MB
 * because base64 is ASCII stored in UTF-16) and the receiving side decodes it
 * again. On top of the `formData()` buffer and the `File.arrayBuffer()` /
 * `Buffer.from` copies already resident, peak memory for one 4 MiB upload was
 * measured at ~35–40 MB — and Vercel's 4.5 MB cap limits per-REQUEST size, not
 * CONCURRENCY, so roughly 50 concurrent uploads exhaust a 2 GB instance and the
 * OOM kill takes out every co-resident function. Streaming removes the 4/3
 * inflation and the decode round-trip entirely: the SDK's upload stream consumes
 * the bytes incrementally and never holds a second full copy.
 *
 * WHY `upload_stream` AND NOT `upload(source)`. Verified against the installed
 * SDK (`cloudinary@2.11.0`, `lib/uploader.js`): `uploader.upload(file, cb, opts)`
 * accepts ONLY a remote/data URI string — which it forwards as the `file` form
 * FIELD (`isRemoteUrl` matches `data:…;base64,`) — or a local filesystem path,
 * which it feeds to `fs.createReadStream`. A `Buffer`, a `Blob` or a stream is
 * silently treated as a PATH and fails with `ENOENT`. `upload_stream` is the
 * supported streaming entry point: it returns a writable that the caller pipes
 * into, and reports the result through its callback. So the previous
 * data-URI construction was the ONLY thing that worked with this SDK version, and
 * it is exactly the thing being removed.
 *
 * The byte-size cap is still enforced HERE as well as at the `Content-Length`
 * gate in `request.js`, because that gate can be bypassed by a client that omits
 * or lies about the header. The check is deliberately OUTSIDE the swallow so an
 * oversized file produces the documented 400 rather than a `null` — see the
 * comment at the catch below.
 *
 * @param file     the bytes: a `File`/`Blob` (consumed via `.stream()`), a Node
 *                 `Readable`, or a `Buffer`/`Uint8Array`
 * @param folder   destination folder; defaults to `cpccu/profiles`
 * @param options  extra upload options, merged AFTER the defaults
 * @returns the Cloudinary response, or `null` on any non-`ApiError` failure
 */
async function uploadOnCloudinary(
  file,
  folder = DEFAULT_UPLOAD_FOLDER,
  options = {},
) {
  if (!file) return null;

  // Throw OUTSIDE the try/catch below. Inside it, this error would be caught,
  // logged and converted to a `null` return — which silently turns the
  // documented `LIMIT_FILE_SIZE` -> 400 branch in `toErrorResponse` into dead
  // code on this path and tells the user only that "the upload did not work".
  const size = typeof file.size === 'number' ? file.size : file.length;
  if (typeof size === 'number' && size > MAX_UPLOAD_BYTES) {
    throw new ApiError(400, uploadSizeMessage());
  }

  try {
    const uploadPreset = [
      options.uploadPreset,
      options.upload_preset,
      process.env.CLOUDINARY_UPLOAD_PRESET,
    ].find((preset) => typeof preset === 'string' && preset.trim());

    const uploadOptions = {
      // `resource_type: 'auto'` is REQUIRED, not a default: `post.controller.js:27,90`
      // relies on Cloudinary detecting the resource type so that a video post is
      // stored as a video. Forcing `image` here would break video posts.
      resource_type: 'auto',
      folder,
      transformation: [
        { width: 500, height: 500, crop: 'limit' },
        { quality: 'auto' },
        { fetch_format: 'auto' },
      ],
      // Server-side format allow-list. Cloudinary validates against the sniffed
      // content, so the client-declared multipart `Content-Type` is irrelevant.
      allowed_formats: ALLOWED_FORMATS,
      // Spread AFTER the defaults so a caller can override any of them.
      ...options,
    };

    // The preset is passed positionally to `unsigned_upload_stream`, not in the
    // options object; leaving it in would send it as an unknown upload parameter.
    delete uploadOptions.uploadPreset;
    delete uploadOptions.upload_preset;

    return await pipeUpload(
      getCloudinary(),
      toNodeReadable(file),
      uploadOptions,
      uploadPreset,
    );
  } catch (error) {
    // Swallow-and-return-null is the original behaviour and callers branch on
    // it, but note WHAT THIS HIDES: a Cloudinary outage, a bad credential, a
    // rejected format and a genuine bug are indistinguishable to the caller.
    // Every failure is logged here, so a silent null in production always has a
    // matching server-side log line — check the logs before concluding an upload
    // "just did not work".
    //
    // `ApiError` is deliberately NOT swallowed: an oversized file is a CLIENT
    // error with a documented response, not an upload failure, and rethrowing it
    // is what keeps `toErrorResponse`'s 400 branch reachable.
    if (error instanceof ApiError) throw error;

    console.error('Error uploading to Cloudinary:', describeSdkError(error));
    return null;
  }
}

/**
 * Bridges the caller's `Readable` into the SDK's upload stream and turns the
 * callback API into a promise.
 *
 * `upload_stream(cb, opts)` / `unsigned_upload_stream(preset, cb, opts)` return a
 * writable SYNCHRONOUSLY (the internal `call_api` sees an object back from
 * `post()` and returns it instead of the deferred promise), so the result can
 * only be observed through the callback. Both error paths are wired: a source
 * error (a truncated multipart body) destroys the writable and aborts the HTTPS
 * request rather than leaving the promise pending until the platform kills the
 * invocation.
 *
 * @returns the Cloudinary response object
 */
function pipeUpload(cloudinary, source, uploadOptions, uploadPreset) {
  return new Promise((resolve, reject) => {
    const writable = uploadPreset
      ? cloudinary.uploader.unsigned_upload_stream(
          uploadPreset,
          (error, result) => (error ? reject(error) : resolve(result)),
          uploadOptions,
        )
      : cloudinary.uploader.upload_stream(
          (error, result) => (error ? reject(error) : resolve(result)),
          uploadOptions,
        );

    source.on('error', (error) => {
      // The SDK's callback only fires on an HTTP response; without this the
      // promise would never settle and the request would hang until the platform
      // killed the whole invocation.
      writable.destroy?.(error);
      reject(error);
    });

    // The writable's own errors (an aborted HTTPS request surfaces here) need a
    // listener, or Node treats the event as unhandled and tears down the whole
    // invocation. Rejecting turns it into an ordinary upload failure.
    writable.on('error', reject);

    source.pipe(writable);
  });
}

export {
  ALLOWED_FORMATS,
  DEFAULT_UPLOAD_FOLDER,
  destroyCloudinaryImage,
  getCloudinary,
  parsePublicIdFromCloudinaryUrl,
  uploadOnCloudinary,
};
