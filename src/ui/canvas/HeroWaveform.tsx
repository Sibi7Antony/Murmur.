/* ===================================================================
 * Hero Oscilloscope Waveform (Canvas 2D, DPR-aware, 60fps)
 * 6-10 overlapping thin sine lines with phase offsets,
 * lavender-to-pink-to-white gradient stroke with soft glow.
 * Gaussian amplitude envelopes peaking left (x ~31%) and right (x ~71%),
 * flat behind the central buttons. Driven by real audio levels.
 * =================================================================== */

import { useEffect, useRef } from 'react';
import { useAudioLevel } from '../EngineContext';
import './HeroWaveform.css';

export function HeroWaveform() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioLevel = useAudioLevel();
  const levelRef = useRef(audioLevel);

  useEffect(() => {
    levelRef.current = audioLevel;
  }, [audioLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const midY = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Smooth real audio level with base ambient movement
      const targetAmp = Math.max(0.15, levelRef.current * 1.8);
      time += 0.035;

      const lineCount = 7;
      const step = 3; // Horizontal sampling step in px

      for (let l = 0; l < lineCount; l++) {
        ctx.beginPath();
        const phaseOffset = (l * Math.PI) / lineCount + time;
        const freq = 0.015 + l * 0.003;
        const alpha = 0.35 + (l / lineCount) * 0.55;

        // Gradient stroke: lavender -> pink -> white -> peach
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0.1, `rgba(184, 166, 240, ${alpha * 0.4})`);
        grad.addColorStop(0.32, `rgba(220, 190, 255, ${alpha})`);
        grad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.2})`); // Dip in center
        grad.addColorStop(0.72, `rgba(244, 201, 192, ${alpha})`);
        grad.addColorStop(0.9, `rgba(240, 127, 69, ${alpha * 0.5})`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.25;

        for (let x = 0; x <= w; x += step) {
          const normX = x / w;

          // Gaussian envelopes: left peak ~0.31, right peak ~0.71, flat around 0.50
          const leftEnv = Math.exp(-Math.pow((normX - 0.31) / 0.12, 2));
          const rightEnv = Math.exp(-Math.pow((normX - 0.71) / 0.12, 2));
          const centerSuppression = Math.pow(Math.abs(normX - 0.5) / 0.18, 2);
          const env = (leftEnv + rightEnv) * Math.min(1.0, centerSuppression);

          const maxAmp = (h * 0.42) * targetAmp;
          const y = midY + Math.sin(x * freq + phaseOffset) * env * maxAmp;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="hero-waveform-container" aria-hidden="true">
      <canvas ref={canvasRef} className="hero-waveform-canvas" />
    </div>
  );
}
