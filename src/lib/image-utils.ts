export const MAX_AVATAR_SIZE = 0.05; // 50KB
export const MAX_PHOTO_SIZE = 0.1; // 100KB
export const AVATAR_MAX_DIM = 200;
export const PHOTO_MAX_DIM = 800;

export async function compressImage(
  file: File,
  maxSizeMB = MAX_PHOTO_SIZE,
  maxWidth = PHOTO_MAX_DIM
): Promise<string> {
  const { default: imageCompression } = await import('browser-image-compression');
  const compressed = await imageCompression(file, {
    maxSizeMB,
    maxWidthOrHeight: maxWidth,
    useWebWorker: true,
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(compressed);
  });
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
