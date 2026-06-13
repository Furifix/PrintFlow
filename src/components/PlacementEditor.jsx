// src/components/PlacementEditor.jsx — Canvas drag-to-draw placement rectangle
import { useRef, useState, useEffect, useCallback } from 'react';

export default function PlacementEditor({ imageUrl, initialZone, onConfirm, onClose }) {
  const canvasRef   = useRef(null);
  const imgRef      = useRef(null);
  const [drawing, setDrawing]     = useState(false);
  const [rect, setRect]           = useState(null);   // {x, y, w, h} in canvas coords
  const [startPt, setStartPt]     = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  // Draw on canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (rect && rect.w !== 0 && rect.h !== 0) {
      const x = rect.w >= 0 ? rect.x : rect.x + rect.w;
      const y = rect.h >= 0 ? rect.y : rect.y + rect.h;
      const w = Math.abs(rect.w);
      const h = Math.abs(rect.h);

      if (drawing) {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
      } else {
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.10)';
        ctx.fillRect(x, y, w, h);
      }
    }
  }, [rect, drawing]);

  useEffect(() => { render(); }, [render]);

  // Load image and set canvas size
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Scale to fit container (max 700px wide)
      const maxW = Math.min(700, window.innerWidth - 48);
      const scale = Math.min(1, maxW / img.naturalWidth);
      canvas.width  = img.naturalWidth  * scale;
      canvas.height = img.naturalHeight * scale;
      canvas._scale = scale;
      // Restore initial zone if present
      if (initialZone) {
        const z = initialZone;
        setRect({
          x: z.xPct * canvas.width,
          y: z.yPct * canvas.height,
          w: z.wPct * canvas.width,
          h: z.hPct * canvas.height,
        });
      }
      render();
    };
    img.src = imageUrl;
  }, [imageUrl]); // eslint-disable-line

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const bounds = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - bounds.left) * (canvas.width  / bounds.width),
      y: (clientY - bounds.top)  * (canvas.height / bounds.height),
    };
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    const pt = getPos(e);
    setStartPt(pt);
    setRect({ x: pt.x, y: pt.y, w: 0, h: 0 });
    setDrawing(true);
  };

  const onMouseMove = (e) => {
    if (!drawing || !startPt) return;
    e.preventDefault();
    const pt = getPos(e);
    setRect({ x: startPt.x, y: startPt.y, w: pt.x - startPt.x, h: pt.y - startPt.y });
  };

  const onMouseUp = (e) => {
    if (!drawing) return;
    e.preventDefault();
    setDrawing(false);
  };

  const handleConfirm = () => {
    if (!rect || Math.abs(rect.w) < 5 || Math.abs(rect.h) < 5) return;
    const canvas = canvasRef.current;
    const x = rect.w >= 0 ? rect.x : rect.x + rect.w;
    const y = rect.h >= 0 ? rect.y : rect.y + rect.h;
    const w = Math.abs(rect.w);
    const h = Math.abs(rect.h);
    onConfirm({
      xPct: x / canvas.width,
      yPct: y / canvas.height,
      wPct: w / canvas.width,
      hPct: h / canvas.height,
    });
    setConfirmed(true);
  };

  const handleRedraw = () => {
    setRect(null);
    setDrawing(false);
    setConfirmed(false);
  };

  return (
    <div className="fullscreen-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-slate-800 p-6 max-w-3xl w-full mx-4 flex flex-col gap-4 max-h-screen overflow-y-auto hdk-border rounded-none shadow-none">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-black dark:text-white uppercase tracking-wider">Set Placement Zone</h2>
          <button onClick={onClose} className="text-slate-450 hover:text-slate-600 dark:text-slate-350 text-2xl leading-none font-bold">×</button>
        </div>
        <p className="text-sm text-slate-500 uppercase tracking-wider">Click and drag on the image to draw the print area rectangle.</p>
        <div className="overflow-auto rounded-none border border-black dark:border-white bg-slate-50 dark:bg-slate-900 flex justify-center">
          <canvas
            ref={canvasRef}
            className="cursor-crosshair max-w-full"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onTouchStart={onMouseDown}
            onTouchMove={onMouseMove}
            onTouchEnd={onMouseUp}
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRedraw}
            className="flex-1 px-4 py-2.5 border border-black dark:border-white rounded-none text-sm font-bold uppercase tracking-wider text-black dark:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Redraw
          </button>
          <button
            onClick={handleConfirm}
            disabled={!rect || Math.abs(rect?.w || 0) < 5}
            className="flex-1 hdk-skew-btn-yellow text-black font-bold py-2.5 text-sm flex items-center justify-center gap-2 rounded-none disabled:opacity-40"
          >
            <span className="hdk-unskew">{confirmed ? '✓ Confirmed' : 'Confirm Placement'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
