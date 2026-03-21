'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface PhotoGalleryProps {
  photos: string[];
  onRemove?: (index: number) => void;
  /** "feed" = full-width insta-style carousel, "compact" = small thumbnails */
  variant?: 'feed' | 'compact';
}

export function PhotoGallery({ photos, onRemove, variant = 'compact' }: PhotoGalleryProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (photos.length === 0) return null;

  if (variant === 'feed') {
    return (
      <>
        {/* Instagram-style full-width carousel */}
        <div className="relative">
          <div
            ref={scrollRef}
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
            onScroll={() => {
              if (!scrollRef.current) return;
              const idx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth);
              setActiveSlide(idx);
            }}
          >
            {photos.map((photo, i) => (
              <div
                key={i}
                className="w-full shrink-0 snap-center cursor-pointer px-4"
                onClick={() => setViewerIndex(i)}
              >
                <img
                  src={photo}
                  alt=""
                  loading="lazy"
                  className="w-full aspect-[4/3] object-cover rounded-2xl"
                />
              </div>
            ))}
          </div>
          {/* Dot indicators */}
          {photos.length > 1 && (
            <div className="flex justify-center gap-1.5 py-2.5">
              {photos.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === activeSlide ? 'bg-accent' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <AnimatePresence>
          {viewerIndex !== null && (
            <PhotoViewer
              photos={photos}
              initialIndex={viewerIndex}
              onClose={() => setViewerIndex(null)}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // Compact variant — small thumbnails with optional remove
  return (
    <>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
        {photos.map((photo, i) => (
          <div
            key={i}
            onClick={() => setViewerIndex(i)}
            className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-white/5 cursor-pointer"
          >
            <img src={photo} alt="" loading="lazy" className="w-full h-full object-cover" />
            {onRemove && (
              <div
                role="button"
                onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center cursor-pointer"
              >
                <X className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {viewerIndex !== null && (
          <PhotoViewer
            photos={photos}
            initialIndex={viewerIndex}
            onClose={() => setViewerIndex(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function PhotoViewer({
  photos,
  initialIndex,
  onClose,
}: {
  photos: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const photo = photos[Math.min(index, photos.length - 1)];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 safe-top"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      <img
        src={photo}
        alt=""
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {photos.length > 1 && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-3 safe-bottom">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setIndex(i); }}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === index ? 'bg-white' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
