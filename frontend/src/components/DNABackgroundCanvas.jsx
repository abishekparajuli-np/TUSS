import React, { useEffect, useRef } from 'react';

export default function DNABackgroundCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let time = 0;
    let mouseX = 0;
    let mouseY = 0;

    // --- Resize ---
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // --- Mouse parallax ---
    const handleMouse = (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', handleMouse);

    // --- Floating particles ---
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: Math.random() * 2 - 1,
      speed: 0.0003 + Math.random() * 0.0008,
      size: 0.5 + Math.random() * 1.5,
    }));

    // --- 3D → 2D projection ---
    const project = (x3, y3, z3, cx, cy) => {
      const fov = 600;
      const viewDist = 3;
      const scale = fov / (viewDist + z3);
      return {
        x: cx + x3 * scale,
        y: cy + y3 * scale,
        scale,
        depth: z3,
      };
    };

    // --- Draw a glowing sphere ---
    const drawSphere = (ctx, px, py, radius, color, alpha) => {
      const gradient = ctx.createRadialGradient(
        px - radius * 0.3,
        py - radius * 0.3,
        radius * 0.1,
        px,
        py,
        radius
      );
      gradient.addColorStop(0, `rgba(${color}, ${Math.min(1, alpha * 1.8)})`);
      gradient.addColorStop(0.4, `rgba(${color}, ${alpha * 0.8})`);
      gradient.addColorStop(1, `rgba(${color}, 0)`);

      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    };

    // --- Main render loop ---
    const render = () => {
      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;

      // Clear with dark background
      ctx.fillStyle = '#050d1a';
      ctx.fillRect(0, 0, W, H);

      // Subtle radial vignette
      const vignette = ctx.createRadialGradient(cx, cy, H * 0.2, cx, cy, H * 0.9);
      vignette.addColorStop(0, 'rgba(5, 13, 26, 0)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);

      time += 0.008;

      // Parallax offset
      const px = mouseX * 15;
      const py = mouseY * 10;

      // --- Collect all drawable items for depth sorting ---
      const items = [];

      // DNA parameters
      const helixCount = 3; // Multiple helices
      const nodesPerHelix = 50;
      const helixRadius = 0.6;
      const helixHeight = 4.5;
      const rungEvery = 2; // Connect every N nodes

      for (let h = 0; h < helixCount; h++) {
        const helixOffsetX = (h - 1) * 1.8; // Spread helices horizontally
        const helixPhase = (h * Math.PI * 2) / helixCount;
        const rotSpeed = 0.6 + h * 0.05;

        for (let i = 0; i < nodesPerHelix; i++) {
          const t = i / nodesPerHelix;
          const angle1 = t * Math.PI * 6 + time * rotSpeed + helixPhase;
          const angle2 = angle1 + Math.PI;
          const yPos = (t - 0.5) * helixHeight;

          // Strand 1
          const x1 = helixOffsetX + Math.cos(angle1) * helixRadius;
          const z1 = Math.sin(angle1) * helixRadius;
          const p1 = project(x1 + px * 0.01, yPos + py * 0.01, z1, cx, cy);

          // Strand 2
          const x2 = helixOffsetX + Math.cos(angle2) * helixRadius;
          const z2 = Math.sin(angle2) * helixRadius;
          const p2 = project(x2 + px * 0.01, yPos + py * 0.01, z2, cx, cy);

          // Depth-based alpha (front = bright, back = dim)
          const alpha1 = Math.max(0.1, Math.min(0.9, 0.5 + z1 * 0.5));
          const alpha2 = Math.max(0.1, Math.min(0.9, 0.5 + z2 * 0.5));

          // Node sizes with depth
          const nodeSize1 = Math.max(2, 4 * p1.scale / 200);
          const nodeSize2 = Math.max(2, 4 * p2.scale / 200);

          // Strand 1 nodes (teal)
          items.push({
            type: 'sphere',
            x: p1.x,
            y: p1.y,
            z: z1,
            radius: nodeSize1,
            color: '0, 255, 200',
            alpha: alpha1 * 0.7,
          });

          // Strand 2 nodes (blue)
          items.push({
            type: 'sphere',
            x: p2.x,
            y: p2.y,
            z: z2,
            radius: nodeSize2,
            color: '0, 128, 255',
            alpha: alpha2 * 0.7,
          });

          // Rungs (base pairs) — connecting lines
          if (i % rungEvery === 0) {
            const rungAlpha = Math.max(0.05, (alpha1 + alpha2) / 2 * 0.35);
            // Base pair colors (A-T: warm, G-C: cool)
            const pairType = i % 4;
            let rungColor;
            if (pairType < 2) {
              rungColor = `rgba(0, 255, 200, ${rungAlpha})`;
            } else {
              rungColor = `rgba(0, 180, 255, ${rungAlpha})`;
            }

            items.push({
              type: 'rung',
              x1: p1.x,
              y1: p1.y,
              x2: p2.x,
              y2: p2.y,
              z: (z1 + z2) / 2,
              color: rungColor,
              width: Math.max(0.5, 1.5 * ((p1.scale + p2.scale) / 2) / 200),
            });
          }

          // Backbone connections (strand lines)
          if (i > 0) {
            const prevT = (i - 1) / nodesPerHelix;
            const prevAngle1 = prevT * Math.PI * 6 + time * rotSpeed + helixPhase;
            const prevAngle2 = prevAngle1 + Math.PI;
            const prevY = (prevT - 0.5) * helixHeight;

            const prevX1 = helixOffsetX + Math.cos(prevAngle1) * helixRadius;
            const prevZ1 = Math.sin(prevAngle1) * helixRadius;
            const prevP1 = project(prevX1 + px * 0.01, prevY + py * 0.01, prevZ1, cx, cy);

            const prevX2 = helixOffsetX + Math.cos(prevAngle2) * helixRadius;
            const prevZ2 = Math.sin(prevAngle2) * helixRadius;
            const prevP2 = project(prevX2 + px * 0.01, prevY + py * 0.01, prevZ2, cx, cy);

            // Backbone strand 1
            items.push({
              type: 'line',
              x1: prevP1.x,
              y1: prevP1.y,
              x2: p1.x,
              y2: p1.y,
              z: (prevZ1 + z1) / 2,
              color: `rgba(0, 255, 200, ${Math.max(0.05, (alpha1 * 0.3))})`,
              width: Math.max(0.5, 1.5 * p1.scale / 200),
            });

            // Backbone strand 2
            items.push({
              type: 'line',
              x1: prevP2.x,
              y1: prevP2.y,
              x2: p2.x,
              y2: p2.y,
              z: (prevZ2 + z2) / 2,
              color: `rgba(0, 128, 255, ${Math.max(0.05, (alpha2 * 0.25))})`,
              width: Math.max(0.5, 1.5 * p2.scale / 200),
            });
          }
        }
      }

      // Floating particles
      particles.forEach((p) => {
        p.y -= p.speed;
        if (p.y < -1) p.y = 1;

        const pProj = project(
          p.x * 2 + px * 0.005,
          p.y * 2 + py * 0.005,
          p.z,
          cx,
          cy
        );
        const pAlpha = Math.max(0.05, 0.3 + p.z * 0.2);

        items.push({
          type: 'sphere',
          x: pProj.x,
          y: pProj.y,
          z: p.z - 2, // Push behind DNA
          radius: p.size * pProj.scale / 300,
          color: '0, 255, 200',
          alpha: pAlpha * 0.3,
        });
      });

      // --- Depth sort: back to front ---
      items.sort((a, b) => a.z - b.z);

      // --- Draw all items ---
      items.forEach((item) => {
        if (item.type === 'sphere') {
          drawSphere(ctx, item.x, item.y, item.radius, item.color, item.alpha);
        } else if (item.type === 'line' || item.type === 'rung') {
          ctx.beginPath();
          ctx.moveTo(item.x1, item.y1);
          ctx.lineTo(item.x2, item.y2);
          ctx.strokeStyle = item.color;
          ctx.lineWidth = item.width;
          ctx.stroke();
        }
      });

      // --- Overlay: subtle scan lines ---
      ctx.fillStyle = 'rgba(0, 255, 200, 0.008)';
      for (let y = 0; y < H; y += 4) {
        ctx.fillRect(0, y, W, 1);
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouse);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
