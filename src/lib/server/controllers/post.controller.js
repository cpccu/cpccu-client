import 'server-only';

import { Post } from '@/lib/server/models/post.model';
import { ApiError } from '@/lib/server/errors';
import { ApiResponse } from '@/lib/server/response';
import { uploadOnCloudinary } from '@/lib/server/cloudinary';
import { isValidIdentity } from '@/lib/server/isValidIdentity';

/**
 * Port of `cpccu-server/src/controllers/post.controller.js`.
 *
 * The single real divergence is `file.path` -> `file.buffer`, which appears
 * twice and is documented at both call sites: `cloudinary.js` consumes bytes
 * (Phase 1.5) rather than a filesystem path, because `multer.diskStorage`'s
 * `./public/temp` is not addressable on a read-only serverless bundle.
 */

const createPostHandler = async (req, res) => {
  const { caption } = req.body;
  const mediaFiles = req.files;
  let media;

  // Uploads run CONCURRENTLY (`Promise.all`) rather than sequentially. That is a
  // deliberate choice with two consequences worth knowing: the wall-clock cost
  // of a twenty-file post is one round trip rather than twenty, and a partial
  // failure leaves the Cloudinary assets that DID succeed orphaned in the
  // account, because the rejection is only observed after every promise settles.
  // There is no compensating cleanup, and there was none in the original either.
  if (mediaFiles && mediaFiles.length > 0) {
    media = await Promise.all(
      mediaFiles.map(async (file) => {
        // -------------------------------------------------------------------
        // DIVERGENCE (Vercel filesystem change, Phase 1.5): `file.path` ->
        // `file.buffer`. See the long explanation at the same call site in
        // `user.controller.js`; the shape of the change is identical.
        //
        // `resource_type: 'auto'` inside `uploadOnCloudinary` is what makes the
        // `resource_type === 'video'` test below possible — Cloudinary sniffs the
        // bytes and reports what it stored, and forcing `image` would make every
        // video post either fail or be stored as a still.
        // -------------------------------------------------------------------
        const uploadedMedia = await uploadOnCloudinary(file.buffer);

        if (!uploadedMedia) {
          throw new ApiError(500, 'error while uploading media');
        }

        return {
          url: uploadedMedia.secure_url,
          type: uploadedMedia.resource_type === 'video' ? 'video' : 'image',
        };
      }),
    );
  }

  // `owner` comes from the verified token, never from the body: this endpoint
  // creates posts AS the caller, and there is no impersonation path.
  const post = await Post.create({
    owner: req.user._id,
    caption,
    media,
  });

  if (!post) {
    throw new ApiError(500, 'server site error while creating the post');
  }

  return res
    .status(201)
    .json(new ApiResponse(201, post, 'Post created successfully'));
};

const updatePostHandler = async (req, res) => {
  const { id } = req.params;
  const { caption, existingMedia } = req.body;
  const mediaFiles = req.files;

  if (!id) {
    throw new ApiError(400, 'Post ID is required');
  }

  if (!isValidIdentity(id)) {
    throw new ApiError(400, 'Invalid post ID');
  }

  const post = await Post.findById(id);

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  // OWNERSHIP CHECK, and it is the only authorisation on this endpoint. It runs
  // BEFORE any upload, which is what stops an attacker from using this route as
  // a free Cloudinary upload service: without the id/ownership test passing
  // first, the multipart body is never even looked at.
  //
  // The three validations above it (id present, id well-formed, post exists)
  // mean a request carrying twenty 4 MiB files that will be rejected for a bad
  // id has ALREADY had its body buffered by `readMultipart` before any of them
  // run. The rejection therefore orphans nothing in Cloudinary — no upload has
  // started — but it does mean the size and memory cost of the upload was paid
  // for a request that never used it. Preserved, because the alternative is
  // reordering validation ahead of the framework's own body read, which is not
  // something the shim can arrange.
  if (post.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You don't have permission to access this post");
  }

  // `caption || undefined` is the CLEAR-vs-OMIT convention: an empty string
  // becomes `undefined`, and assigning `undefined` to a Mongoose path is ignored
  // by `save()`, so sending `caption: ''` leaves the existing caption intact
  // rather than deleting it. Preserved; changing it would let a client erase a
  // caption it did not intend to.
  post.caption = caption || undefined;

  // `existingMedia` is the CLIENT'S copy of the media it wants to KEEP. It is
  // rebuilt from scratch every time (`let media = []`) rather than merged into
  // `post.media`, so a client that omits `existingMedia` DROPS every previously
  // uploaded item. The frontend is expected to always send the full list back.
  // The `.filter((item) => item.url && item.type)` is a shape check only — it
  // validates that an entry LOOKS like media, not that the caller may keep it.
  let media = [];
  if (existingMedia && Array.isArray(existingMedia)) {
    media = existingMedia.filter((item) => item.url && item.type);
  }

  if (mediaFiles && mediaFiles.length > 0) {
    const newMedia = await Promise.all(
      mediaFiles.map(async (file) => {
        try {
          // DIVERGENCE (Vercel filesystem change, Phase 1.5): `file.path` ->
          // `file.buffer`. See `user.controller.js` for the full rationale.
          const uploadedMedia = await uploadOnCloudinary(file.buffer);

          if (!uploadedMedia) {
            throw new Error('Failed to upload media');
          }

          return {
            url: uploadedMedia.secure_url,
            type: uploadedMedia.resource_type === 'video' ? 'video' : 'image',
          };
        } catch (error) {
          // The `try` exists ONLY to normalise the outcome. Everything that can
          // go wrong here — Cloudinary refused the format, the credentials are
          // wrong, the SDK threw, the upload returned `null` — becomes the same
          // 500. The original error is deliberately NOT surfaced: a Cloudinary
          // error object can echo the payload back, and its message frequently
          // names the internal upload configuration.
          throw new ApiError(500, 'Error while uploading media');
        }
      }),
    );

    media.push(...newMedia);
  }

  // REPLACED MEDIA IS NEVER DESTROYED. `post.media` is overwritten wholesale at
  // the next line, so any asset that was dropped from `media` is still live in
  // Cloudinary and this application has no record that it exists — not the
  // public id, not the URL. Nothing here calls `destroyCloudinaryImage`, and
  // nothing in the schema stores the ids, so the leak is not recoverable after
  // the fact. This is a real, permanent storage cost that grows with every edit
  // to a post, and it is PRESERVED rather than fixed: the fix requires adding a
  // public id to the `media` sub-schema and a diff-then-destroy pass, which is
  // a schema migration with a backfill, not something to smuggle into a port.
  post.media = media;

  const updatedPost = await post.save();

  if (!updatedPost) {
    throw new ApiError(500, 'Error while updating the post');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedPost, 'Post updated successfully'));
};

const deletePostHandler = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, 'Post ID is required');
  }

  if (!isValidIdentity(id)) {
    throw new ApiError(400, 'Invalid Post ID');
  }

  const post = await Post.findById(id);

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  // Same ownership gate as the update path, with its own message ("delete"
  // rather than "access"). Note the consequence: deleting a post does NOT
  // destroy its Cloudinary media, for the same reason the update path does not
  // — see the "REPLACED MEDIA IS NEVER DESTROYED" note above.
  if (post.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You don't have permission to delete this post");
  }

  // `deleteOne()` on a DOCUMENT rather than `Post.deleteOne({ _id: id })`. The
  // document form adds the model's own middleware (a `pre('deleteOne')` hook
  // would run; there is none today) and is scoped to this one document by
  // identity, so it cannot delete a sibling.
  await post.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, null, 'Post deleted successfully'));
};

export { createPostHandler, deletePostHandler, updatePostHandler };
