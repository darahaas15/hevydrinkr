'use client';

import { useState } from 'react';
import { Camera } from 'lucide-react';
import { pickImage, uploadImage, MAX_AVATAR_SIZE, AVATAR_MAX_DIM, MAX_PHOTO_SIZE, PHOTO_MAX_DIM } from '@/lib/image-utils';
import { useUIStore } from '@/stores/use-ui-store';

interface ImagePickerProps {
  currentImage?: string | null;
  onSelect: (url: string) => void;
  shape?: 'circle' | 'square';
  size?: number;
  placeholder?: string;
}

export function ImagePicker({
  currentImage,
  onSelect,
  shape = 'circle',
  size = 80,
  placeholder,
}: ImagePickerProps) {
  const [loading, setLoading] = useState(false);

  const isAvatar = shape === 'circle';
  const maxSize = isAvatar ? MAX_AVATAR_SIZE : MAX_PHOTO_SIZE;
  const maxDim = isAvatar ? AVATAR_MAX_DIM : PHOTO_MAX_DIM;

  const handlePick = async () => {
    const file = await pickImage();
    if (!file) return;
    setLoading(true);
    try {
      const url = await uploadImage(file, isAvatar ? 'avatars' : 'photos', maxSize, maxDim);
      onSelect(url);
    } catch {
      useUIStore.getState().addToast("Couldn't upload image", 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handlePick}
      disabled={loading}
      className="relative group shrink-0"
      style={{ width: size, height: size }}
    >
      {currentImage ? (
        <img
          src={currentImage}
          alt="Selected"
          className={`w-full h-full object-cover ${shape === 'circle' ? 'rounded-full' : 'rounded-2xl'}`}
        />
      ) : (
        <div
          className={`w-full h-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center ${
            shape === 'circle' ? 'rounded-full' : 'rounded-2xl'
          }`}
        >
          {placeholder ? (
            <span className="text-lg font-bold text-accent">{placeholder}</span>
          ) : (
            <Camera className="w-5 h-5 text-zinc-500" />
          )}
        </div>
      )}
      <div
        className={`absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity ${
          shape === 'circle' ? 'rounded-full' : 'rounded-2xl'
        }`}
      >
        <Camera className="w-5 h-5 text-white" />
      </div>
      {loading && (
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/60 ${
            shape === 'circle' ? 'rounded-full' : 'rounded-2xl'
          }`}
        >
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </button>
  );
}
