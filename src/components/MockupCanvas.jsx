// src/components/MockupCanvas.jsx — Composites design onto background (used during generation)
import { useEffect, useRef } from 'react';

export default function MockupCanvas({ backgroundUrl, designUrl, zone }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!backgroundUrl || !designUrl || !zone) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const bg  = new Image();
    const des = new Image();
    bg.crossOrigin  = 'anonymous';
    des.crossOrigin = 'anonymous';

    let loaded = 0;
    const tryDraw = () => {
      loaded++;
      if (loaded < 2) return;
      canvas.width  = bg.naturalWidth;
      canvas.height = bg.naturalHeight;
      ctx.drawImage(bg, 0, 0);

      const zx = zone.xPct * bg.naturalWidth;
      const zy = zone.yPct * bg.naturalHeight;
      const zw = zone.wPct * bg.naturalWidth;
      const zh = zone.hPct * bg.naturalHeight;
      const scale = Math.min(zw / des.naturalWidth, zh / des.naturalHeight);
      const dw = des.naturalWidth  * scale;
      const dh = des.naturalHeight * scale;
      const dx = zx + (zw - dw) / 2;
      const dy = zy + (zh - dh) / 2;
      ctx.drawImage(des, dx, dy, dw, dh);
    };

    bg.onload  = tryDraw;
    des.onload = tryDraw;
    bg.src  = backgroundUrl;
    des.src = designUrl;
  }, [backgroundUrl, designUrl, zone]);

  return <canvas ref={canvasRef} className="w-full h-full object-contain" />;
}
