'use client';

import { ImageUp, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUploadAdminImageMutation } from '@/features/admin/adminApi';
import { showErrorAlert, showSuccessAlert } from '@/lib/alerts';

const getUploadErrorMessage = (error) =>
  error?.data?.message || error?.error || error?.message || 'Failed to upload image.';

export function AdminImageUploadField({
  folder = 'cpccu/admin',
  id,
  label = 'Image',
  onChange,
  value,
}) {
  const [uploadImage, { isLoading }] = useUploadAdminImageMutation();

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const body = new FormData();
    body.append('image', file);
    body.append('folder', folder);

    try {
      const response = await uploadImage(body).unwrap();
      const url = response?.data?.url;

      if (url) {
        onChange(url);
        showSuccessAlert('Image Uploaded', 'The image has been uploaded to Cloudinary.');
      } else {
        showErrorAlert('Upload Failed', 'The upload completed without returning an image URL.');
      }
    } catch (error) {
      showErrorAlert('Upload Failed', getUploadErrorMessage(error));
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {value ? (
        <div className="overflow-hidden rounded-md border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-36 w-full object-cover" />
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Cloudinary URL or existing image URL" />
        <label
          htmlFor={isLoading ? undefined : id}
          className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors ${
            isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-accent hover:text-accent-foreground'
          }`}
          aria-disabled={isLoading}
        >
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
          Upload
        </label>
        <input id={id} type="file" accept="image/*" className="sr-only" disabled={isLoading} onChange={handleUpload} />
      </div>
    </div>
  );
}
