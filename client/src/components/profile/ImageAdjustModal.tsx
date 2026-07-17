import { useEffect, useRef, useState } from 'react';
import { X, Check, ZoomIn } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  /** Data URL of the freshly picked image (same-origin, so canvas stays clean). */
  src: string;
  /** Frame aspect ratio (width / height): 1 for avatars, 3 for banners. */
  aspect: number;
  /** Export width in px (height follows the aspect). */
  outWidth: number;
  title: string;
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
}

/**
 * Size/position adjuster for uploaded photos: the image sits behind a fixed
 * crop frame — drag to reposition, slide to zoom — and confirming renders the
 * visible region to a canvas at a sane resolution (which also shrinks huge
 * camera photos before they're uploaded).
 */
export default function ImageAdjustModal({ src, aspect, outWidth, title, onCancel, onDone }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [frameW, setFrameW] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);

  // Measure the frame once the modal is on screen.
  useEffect(() => {
    if (frameRef.current) setFrameW(frameRef.current.clientWidth);
  }, [img]);

  const frameH = frameW / aspect;
  // "Cover" scale: the image always fills the frame; zoom multiplies it.
  const base = img && frameW ? Math.max(frameW / img.naturalWidth, frameH / img.naturalHeight) : 1;
  const s = base * zoom;

  const clampOffset = (x: number, y: number, z: number) => {
    if (!img) return { x, y };
    const sz = base * z;
    const maxX = Math.max(0, (img.naturalWidth * sz - frameW) / 2);
    const maxY = Math.max(0, (img.naturalHeight * sz - frameH) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const d = dragRef.current;
    setOffset(clampOffset(d.ox + (e.clientX - d.px), d.oy + (e.clientY - d.py), zoom));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const changeZoom = (z: number) => {
    setZoom(z);
    setOffset((o) => clampOffset(o.x, o.y, z));
  };

  const confirm = () => {
    if (!img || !frameW) return;
    // Map the frame back to source-image coordinates and export that region.
    const sw = frameW / s;
    const sh = frameH / s;
    const sx = img.naturalWidth / 2 - offset.x / s - sw / 2;
    const sy = img.naturalHeight / 2 - offset.y / s - sh / 2;
    const canvas = document.createElement('canvas');
    canvas.width = outWidth;
    canvas.height = Math.round(outWidth / aspect);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    onDone(canvas.toDataURL('image/jpeg', 0.85));
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onCancel} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-sm glass-panel border border-white/10 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <button onClick={onCancel} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        {/* Crop frame — drag the photo to position it */}
        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative w-full overflow-hidden rounded-xl border border-brand/40 bg-black cursor-grab active:cursor-grabbing"
          style={{ height: frameW ? frameH : 120, touchAction: 'none' }}
        >
          {img && frameW > 0 && (
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute select-none pointer-events-none"
              style={{
                width: img.naturalWidth * s,
                height: img.naturalHeight * s,
                maxWidth: 'none',
                left: `calc(50% + ${offset.x}px)`,
                top: `calc(50% + ${offset.y}px)`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}
        </div>
        <p className="text-[11px] text-slate-500 text-center mt-1.5">Drag to position · slide to zoom</p>

        {/* Zoom */}
        <div className="flex items-center gap-2.5 mt-2.5">
          <ZoomIn size={15} className="text-slate-400 shrink-0" />
          <input
            type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={(e) => changeZoom(Number(e.target.value))}
            className="flex-1 accent-[#a855f7]"
          />
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-surface-2 border border-white/10 text-sm font-semibold text-slate-300">
            Cancel
          </button>
          <button onClick={confirm}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-br from-brand to-accent text-sm font-semibold text-white flex items-center justify-center gap-1.5">
            <Check size={15} /> Use photo
          </button>
        </div>
      </motion.div>
    </div>
  );
}
