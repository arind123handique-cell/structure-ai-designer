import React, { useEffect, useRef } from 'react';

interface FuturisticBackdropProps {
  /** Higher density of floating particles crosshairs */
  dense?: boolean;
  /** Match parent's rounded corners and avoid pointer events */
  className?: string;
}

/**
 * FuturisticBackdrop
 *
 * A lightweight canvas that renders an animated "video-like" ambience used
 * behind the brand panel / full-screen login and the dashboard:
 *  - drifting blueprint crosshairs (+)
 *  - subtle connecting "data link" lines
 *  - faint blueprint grid floor
 *
 * Everything is code-generated, so there are no external video assets.
 */
export const FuturisticBackdrop: React.FC<FuturisticBackdropProps> = React.memo(
  ({ dense = false, className = '' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let raf = 0;
      let width = 0;
      let height = 0;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      type Particle = {
        x: number;
        y: number;
        vx: number;
        vy: number;
        r: number;
        phase: number;
      };
      let particles: Particle[] = [];

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        if (Math.abs(width - rect.width) < 2 && Math.abs(height - rect.height) < 2) return;
        width = rect.width;
        height = rect.height;
        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const count = dense
          ? Math.min(60, Math.floor((width * height) / 20000))
          : Math.min(40, Math.floor((width * height) / 28000));
        particles = Array.from({ length: count }, () => ({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          r: Math.max(1.2, Math.random() * 2.4),
          phase: Math.random() * Math.PI * 2,
        }));
      };

      const draw = (t: number) => {
        ctx.clearRect(0, 0, width, height);

        // drifting crosshair particles
        particles.forEach((p, i) => {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;
          if (p.y < -10) p.y = height + 10;
          if (p.y > height + 10) p.y = -10;

          const alpha = 0.28 + 0.3 * Math.abs(Math.sin(t / 900 + p.phase));
          ctx.strokeStyle = `rgba(49, 107, 243, ${alpha})`;
          ctx.lineWidth = 1;
          const size = p.r * 4;
          ctx.beginPath();
          ctx.moveTo(p.x - size, p.y);
          ctx.lineTo(p.x - p.r, p.y);
          ctx.moveTo(p.x + p.r, p.y);
          ctx.lineTo(p.x + size, p.y);
          ctx.moveTo(p.x, p.y - size);
          ctx.lineTo(p.x, p.y - p.r);
          ctx.moveTo(p.x, p.y + p.r);
          ctx.lineTo(p.x, p.y + size);
          ctx.stroke();

          // faint dot at center
          ctx.fillStyle = `rgba(6, 182, 212, ${alpha * 0.7})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 0.45, 0, Math.PI * 2);
          ctx.fill();

          // data link lines to nearby particles (distSq check avoids Math.hypot)
          for (let j = i + 1; j < particles.length; j++) {
            const q = particles[j];
            const dx = p.x - q.x;
            const dy = p.y - q.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < 14400) {
              const dist = Math.sqrt(distSq);
              const linkAlpha = (1 - dist / 120) * 0.12;
              ctx.strokeStyle = `rgba(6, 182, 212, ${linkAlpha})`;
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.stroke();
            }
          }
        });

        raf = requestAnimationFrame(draw);
      };

      resize();
      raf = requestAnimationFrame(draw);

      const ro = new ResizeObserver(resize);
      ro.observe(canvas);

      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
      };
    }, [dense]);

    return (
      <canvas
        ref={canvasRef}
        className={`pointer-events-none select-none ${className}`}
        aria-hidden="true"
      />
    );
  }
);
FuturisticBackdrop.displayName = 'FuturisticBackdrop';
