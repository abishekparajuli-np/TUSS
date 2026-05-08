import React, { useEffect, useRef } from 'react';

/*
  Thermascan — Biotech DNA Background
  Small helices placed at fixed screen corners/edges in random orientations,
  each drifting in a slow ellipse and self-rotating.
  Tuned for the Soft Violet (#F5F3FF) background.
  Colours: Emerald #10B981 + Lavender #A78BFA
*/

const STRAND_CONFIGS = [
  // Corners & edges — pulled inward so they stay in viewport
  { ax: 0.06, ay: 0.13, rot: Math.PI * 0.30,  speed: 0.42, driftA: 0.7,  size: 1.0  }, // top-left diagonal
  { ax: 0.88, ay: 0.08, rot: -Math.PI * 0.18, speed: 0.38, driftA: 2.1,  size: 0.85 }, // top-right tilted
  { ax: 0.04, ay: 0.50, rot: Math.PI * 0.48,  speed: 0.46, driftA: 4.8,  size: 0.9  }, // left-side
  { ax: 0.93, ay: 0.54, rot: -Math.PI * 0.35, speed: 0.50, driftA: 3.3,  size: 0.85 }, // right-side
  { ax: 0.10, ay: 0.88, rot: Math.PI * 0.22,  speed: 0.40, driftA: 5.6,  size: 1.0  }, // bottom-left
  { ax: 0.86, ay: 0.84, rot: -Math.PI * 0.28, speed: 0.44, driftA: 1.4,  size: 0.9  }, // bottom-right
  { ax: 0.50, ay: 0.05, rot: Math.PI * 0.10,  speed: 0.36, driftA: 6.0,  size: 0.75 }, // top-center
  { ax: 0.48, ay: 0.94, rot: -Math.PI * 0.15, speed: 0.48, driftA: 2.8,  size: 0.80 }, // bottom-center
  // Mid-canvas — randomly scattered in interior
  { ax: 0.25, ay: 0.38, rot: Math.PI * 0.55,  speed: 0.41, driftA: 3.7,  size: 0.80 }, // mid-left area
  { ax: 0.72, ay: 0.28, rot: -Math.PI * 0.42, speed: 0.45, driftA: 5.1,  size: 0.75 }, // mid-upper-right
  { ax: 0.35, ay: 0.68, rot: Math.PI * 0.20,  speed: 0.39, driftA: 1.9,  size: 0.85 }, // mid-lower-left
  { ax: 0.65, ay: 0.72, rot: -Math.PI * 0.60, speed: 0.43, driftA: 4.3,  size: 0.78 }, // mid-lower-right
];

// Emerald + Lavender — semi-transparent on violet bg
const COL_A = '16, 185, 129';    // #10B981 emerald
const COL_B = '167, 139, 250';   // #A78BFA lavender

const BASE_NODES  = 14;
const BASE_RADIUS = 30;   // increased from 22
const BASE_HEIGHT = 165;  // increased from 130
const RUNG_EVERY  = 2;

export default function DNABackgroundCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId, time = 0;
    let mxN = 0, myN = 0, smx = 0, smy = 0;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMouse = e => {
      mxN = (e.clientX / window.innerWidth  - 0.5) * 2;
      myN = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouse);

    // Build live strand state
    const strands = STRAND_CONFIGS.map((s, idx) => ({
      ...s,
      // mid-canvas strands drift in a tighter radius
      driftRadius: idx >= 8 ? 14 + Math.random() * 12 : 24 + Math.random() * 20,
      phase:       Math.random() * Math.PI * 2,
      rotOffset:   0,
      rotSpeed:    (Math.random() - 0.5) * 0.007,
    }));

    const drawNode = (x, y, r, rgb, alpha) => {
      if (alpha < 0.01 || r < 0.5) return;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0,   `rgba(${rgb},${Math.min(1, alpha * 1.6)})`);
      g.addColorStop(0.55,`rgba(${rgb},${alpha * 0.38})`);
      g.addColorStop(1,   `rgba(${rgb},0)`);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    };

    const render = () => {
      const W = canvas.width, H = canvas.height;
      time += 0.007;
      smx += (mxN - smx) * 0.05;
      smy += (myN - smy) * 0.05;

      ctx.clearRect(0, 0, W, H);

      strands.forEach(s => {
        s.rotOffset += s.rotSpeed;
        const totalRot = s.rot + s.rotOffset;
        const R = BASE_RADIUS * s.size;
        const Ht = BASE_HEIGHT * s.size;
        const N = BASE_NODES;

        const driftX = Math.cos(time * 0.17 + s.driftA) * s.driftRadius;
        const driftY = Math.sin(time * 0.12 + s.driftA) * s.driftRadius;
        const cx = s.ax * W + driftX + smx * 7;
        const cy = s.ay * H + driftY + smy * 6;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(totalRot);

        for (let i = 0; i < N; i++) {
          const t      = i / (N - 1);
          const angle1 = t * Math.PI * 4 + time * s.speed;
          const angle2 = angle1 + Math.PI;
          const yOff   = (t - 0.5) * Ht;

          const x1 = Math.cos(angle1) * R;
          const z1 = Math.sin(angle1);
          const x2 = Math.cos(angle2) * R;
          const z2 = Math.sin(angle2);

          // depth alpha — front nodes brighter
          const a1 = Math.max(0.08, (0.28 + z1 * 0.22)) * 0.85;
          const a2 = Math.max(0.08, (0.28 + z2 * 0.22)) * 0.85;
          const r1 = 3.0 + z1 * 0.9;
          const r2 = 3.0 + z2 * 0.9;

          // backbone lines
          if (i > 0) {
            const pT    = (i-1)/(N-1);
            const pa1   = pT * Math.PI * 4 + time * s.speed;
            const pa2   = pa1 + Math.PI;
            const pyOff = (pT - 0.5) * Ht;

            ctx.beginPath();
            ctx.moveTo(Math.cos(pa1)*R, pyOff);
            ctx.lineTo(x1, yOff);
            ctx.strokeStyle = `rgba(${COL_A},${a1 * 0.82})`;
            ctx.lineWidth = 1.3;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(Math.cos(pa2)*R, pyOff);
            ctx.lineTo(x2, yOff);
            ctx.strokeStyle = `rgba(${COL_B},${a2 * 0.78})`;
            ctx.lineWidth = 1.3;
            ctx.stroke();
          }

          // rung — gradient bridge
          if (i % RUNG_EVERY === 0) {
            const ra = ((Math.abs(a1) + Math.abs(a2)) / 2) * 0.52;
            const rg = ctx.createLinearGradient(x1, yOff, x2, yOff);
            rg.addColorStop(0, `rgba(${COL_A},${ra})`);
            rg.addColorStop(1, `rgba(${COL_B},${ra})`);
            ctx.beginPath();
            ctx.moveTo(x1, yOff);
            ctx.lineTo(x2, yOff);
            ctx.strokeStyle = rg;
            ctx.lineWidth = 0.85;
            ctx.stroke();
          }

          drawNode(x1, yOff, r1, COL_A, a1);
          drawNode(x2, yOff, r2, COL_B, a2);
        }

        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
