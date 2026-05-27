import { supabase } from '@/lib/supabase/client';

export const MAX_AVATAR_SIZE = 0.05; // 50KB
export const MAX_PHOTO_SIZE = 0.1; // 100KB
export const AVATAR_MAX_DIM = 200;
export const PHOTO_MAX_DIM = 800;

const BUCKET = 'images';

/**
 * Compress `file` and upload it to the public `images` Storage bucket, returning
 * the public CDN URL to persist in the DB. Replaces the old base64 data-URL
 * approach, which shipped the full image bytes in every query response (huge
 * egress). Throws on failure so callers can show a toast and leave existing
 * state unchanged.
 */
export async function uploadImage(
  file: File,
  folder: 'avatars' | 'photos' | 'groups',
  maxSizeMB = MAX_PHOTO_SIZE,
  maxWidth = PHOTO_MAX_DIM
): Promise<string> {
  const { default: imageCompression } = await import('browser-image-compression');
  const compressed = await imageCompression(file, {
    maxSizeMB,
    maxWidthOrHeight: maxWidth,
    useWebWorker: true,
  });

  const ext = (compressed.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
    contentType: compressed.type || 'image/jpeg',
    cacheControl: '31536000', // 1 year — paths are unique per upload, so content is immutable
    upsert: false,
  });
  if (error) throw error;

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export function pickImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      resolve(input.files?.[0] ?? null);
    };
    // Handle cancel — resolve null after a delay if no change event fired
    const handleFocus = () => {
      setTimeout(() => {
        if (!input.files?.length) resolve(null);
        window.removeEventListener('focus', handleFocus);
      }, 500);
    };
    window.addEventListener('focus', handleFocus);
    input.click();
  });
}
