// /Users/bernie/silent-disco-platform/apps/web/components/AudioVisualizer.tsx
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '../store/playerStore';

interface Props {
  color?: string;
  barCount?: number;
  height?: number;
}

export function AudioVisualizer({ color = '#6366f1', barCount = 20, height = 40 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(barCount) as Uint8Array<ArrayBuffer>);
  const playerState = usePlayerStore((s) => s.playerState);

  const drawBars = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    let data: Uint8Array;

    if (analyserRef.current && playerState === 'playing') {
      analyserRef.current.getByteFrequencyData(dataRef.current);
      data = dataRef.current;
    } else {
      // Idle animation — gentle sine wave
      const t = Date.now() / 1000;
      data = new Uint8Array(barCount);
      for (let i = 0; i < barCount; i++) {
        const wave = Math.sin(t * 1.5 + i * 0.4) * 0.3 + 0.1;
        data[i] = Math.round(wave * 80);
      }
    }

    const barW = (w - barCount + 1) / barCount;
    const isPlaying = playerState === 'playing';

    for (let i = 0; i < barCount; i++) {
      const value = data[i] / 255;
      const barH = Math.max(2, value * h);
      const x = i * (barW + 1);
      const y = h - barH;

      // Parse hex color
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      const alpha = isPlaying ? 0.4 + value * 0.6 : 0.2 + value * 0.3;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;

      const radius = Math.min(2, barW / 2);
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, radius);
      ctx.fill();
    }

    animRef.current = requestAnimationFrame(drawBars);
  }, [barCount, color, playerState]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(drawBars);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [drawBars]);

  // Resize canvas to match display size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
      canvas.height = height * (window.devicePixelRatio || 1);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [height]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: `${height}px` }}
      aria-hidden="true"
    />
  );
}
