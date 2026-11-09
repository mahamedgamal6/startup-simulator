import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import type { ImageOwnerTable } from '../types';
import { useData } from '../lib/db';
import { cn, useToast } from './ui';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('اختر ملف صورة بصيغة PNG أو JPG أو WebP.'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('حجم الصورة أكبر من 8 ميجابايت. اختر صورة أصغر.'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const render = (maxSide: number, quality: number) => {
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height, 1));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('تعذر تجهيز الصورة.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        return canvas.toDataURL('image/jpeg', quality);
      };

      try {
        let dataUrl = render(640, 0.72);
        if (dataUrl.length > 420000) dataUrl = render(480, 0.62);
        if (dataUrl.length > 420000) dataUrl = render(360, 0.55);
        if (dataUrl.length > 450000) {
          reject(new Error('الصورة كبيرة جدًا بعد الضغط. اختر صورة أبسط.'));
          return;
        }
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('تعذر قراءة ملف الصورة.'));
    };
    image.src = objectUrl;
  });
}

export function EntityImage({
  ownerTable,
  ownerId,
  canEdit,
  showControls = true,
  preview = false,
  alt,
  fallback,
  className,
}: {
  ownerTable: ImageOwnerTable;
  ownerId: string;
  canEdit: boolean;
  showControls?: boolean;
  preview?: boolean;
  alt: string;
  fallback: ReactNode;
  className?: string;
}) {
  const { db, setImage, removeImage } = useData();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const image = db.images.find(
    (item) => item.ownerTable === ownerTable && item.ownerId === ownerId,
  );

  useEffect(() => {
    if (!previewOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [previewOpen]);

  const pickFile = () => {
    if (busy) return;
    inputRef.current?.click();
  };

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const saved = await setImage(ownerTable, ownerId, dataUrl);
      if (saved) toast('تم حفظ الصورة');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر رفع الصورة.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      const removed = await removeImage(ownerTable, ownerId);
      if (removed) toast('تم حذف الصورة');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('group relative overflow-hidden bg-slate-100', className)}>
      {image ? (
        preview ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setPreviewOpen(true);
            }}
            title="تكبير الصورة"
            aria-label={`تكبير صورة ${alt}`}
            className="block h-full w-full cursor-zoom-in"
          >
            <img src={image.dataUrl} alt={alt} className="h-full w-full object-cover" />
          </button>
        ) : (
          <img src={image.dataUrl} alt={alt} className="h-full w-full object-cover" />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center">{fallback}</div>
      )}

      {busy ? (
        <span className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/45 text-white">
          <Loader2 size={18} className="animate-spin" />
        </span>
      ) : null}

      {canEdit && showControls ? (
        <div className="pointer-events-none absolute left-1.5 top-1.5 z-20 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              pickFile();
            }}
            title={image ? 'استبدال الصورة' : 'رفع صورة'}
            aria-label={image ? 'استبدال الصورة' : 'رفع صورة'}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-950/65 text-white shadow-sm backdrop-blur-sm transition hover:bg-slate-950/85"
          >
            <ImagePlus size={14} />
          </button>
          {image ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void clear();
              }}
              title="حذف الصورة"
              aria-label="حذف الصورة"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600/80 text-white shadow-sm backdrop-blur-sm transition hover:bg-rose-600"
            >
              <Trash2 size={13} />
            </button>
          ) : null}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void upload(file);
        }}
      />

      {preview && previewOpen && image
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-label={`معاينة ${alt}`}
              onClick={() => setPreviewOpen(false)}
            >
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                aria-label="إغلاق المعاينة"
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <X size={20} />
              </button>
              <figure
                className="flex max-h-full max-w-5xl flex-col items-center"
                onClick={(event) => event.stopPropagation()}
              >
                <img
                  src={image.dataUrl}
                  alt={alt}
                  className="max-h-[82vh] w-auto max-w-full rounded-2xl bg-white object-contain shadow-2xl"
                />
                <figcaption className="mt-3 text-center text-[12px] font-semibold text-white/70">
                  {alt}
                </figcaption>
              </figure>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
