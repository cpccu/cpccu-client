"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Cropper from "react-easy-crop";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave } from "@fortawesome/free-solid-svg-icons";
import { getCroppedImg } from "@/lib/cropImage";

export default function ProfileImageCropModal({ isOpen, imageSrc, onCropComplete, onCancel, isUploading }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState(null);

  const previewUrlRef = useRef("");
  const rafIdRef = useRef(null);

  // EVERY hook in this component is called unconditionally, on every render, in
  // the same order. The "not open" guard lives INSIDE the effect and callback
  // bodies below, never between two hook calls.
  //
  // It used to sit between the reset effect and `updatePreview`, which meant the
  // component ran 8 hooks when closed and 11 when open. That is a
  // `rules-of-hooks` violation and it happens to be latent rather than live only
  // because the sole call site (`Profile.jsx:1583`) renders this component as
  // `{isCropModalOpen && selectedImageSrc && <ProfileImageCropModal .../>}`, so
  // the component UNMOUNTS when it closes and its hook count never changes
  // within a single mounted lifetime. Remove that guard from the parent, or
  // render this component unconditionally, and React would throw
  // "Rendered more hooks than during the previous render" on the first close.
  // Keeping the hooks unconditional makes the component safe under either usage.
  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setPreviewUrl("");
    setError(null);
  }, [isOpen, imageSrc]);

  // Guarded inside the callback rather than by an early return above: the preview
  // is recomputed from `croppedAreaPixels`/`imageSrc`, and both are reset to
  // `null`/`""` while the modal is closed, so this returns immediately in that
  // state. It is the FIRST of the two guards that make the hoisted hook safe.
  const updatePreview = useCallback(async () => {
    if (!croppedAreaPixels || !imageSrc) return;
    try {
      const image = new window.Image();
      image.src = imageSrc;
      await new Promise((resolve) => { image.onload = resolve; });

      const size = 96;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        size,
        size,
      );

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    } catch (e) {
      // preview update failed silently
    }
  }, [croppedAreaPixels, imageSrc]);

  // SECOND guard: bail before scheduling a frame at all while the modal is
  // closed, so a closed modal does no work. This reproduces the old behaviour
  // exactly — the effect used to not exist at all in that state, because the
  // early return sat above it. `isOpen` and `imageSrc` are in the dependency
  // list so the guard can never read a stale value.
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      updatePreview();
    });
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [updatePreview, isOpen, imageSrc]);

  // Deliberately NOT guarded. This one must run for the whole mounted lifetime,
  // closed or not: it is the unmount cleanup that revokes the last object URL
  // the preview created. Guarding it would leak the blob.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  // Early return is now BELOW every hook, so the render output is still `null`
  // when the modal is closed and the hook count is constant either way.
  if (!isOpen || !imageSrc) return null;

  const onCropCompleteHandler = (_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleSave = async () => {
    try {
      setError(null);
      if (!croppedAreaPixels) {
        setError("Unable to process the selected image. Please choose another image.");
        return;
      }
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], "cropped-avatar.jpg", {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      onCropComplete(croppedFile);
    } catch (err) {
      console.error("Crop failed:", err);
      setError("Unable to process the selected image. Please choose another image.");
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-800">Crop Profile Picture</h3>
          <button
            onClick={onCancel}
            disabled={isUploading}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100 disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="p-6">
          <div className="relative w-full h-56 sm:h-64 md:h-80 bg-gray-100 rounded-2xl overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropComplete={onCropCompleteHandler}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              minZoom={0.5}
              maxZoom={3}
              style={{
                containerStyle: {
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#f3f4f6",
                },
              }}
            />
          </div>

          <div className="mt-6">
            <label className="text-xs font-black uppercase text-gray-400 tracking-widest mb-2 block">
              Zoom
            </label>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div className="mt-6 flex flex-col items-center">
            <p className="text-xs font-black uppercase text-gray-400 tracking-widest mb-3">
              Preview
            </p>
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-blue-50 shadow-lg bg-gray-100">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                  Loading...
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-medium">
              {error}
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isUploading}
            className="flex-1 py-3 bg-white text-gray-700 font-bold rounded-2xl border border-gray-200 hover:bg-gray-100 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isUploading}
            className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 disabled:shadow-none"
          >
            {isUploading ? "Saving..." : "Save Photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
