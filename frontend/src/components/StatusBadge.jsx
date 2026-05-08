import React from 'react';

const STATUS_MAP = {
  'HEALTHY':    { bg: '#D1FAE5', color: '#065F46', dot: '#10B981', pulse: false },
  'ULCER RISK': { bg: '#FEE2E2', color: '#991B1B', dot: '#EF4444', pulse: true  },
  'ANALYZING':  { bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B', pulse: true  },
  'UNCERTAIN':  { bg: '#EDE9FE', color: '#5B21B6', dot: '#A78BFA', pulse: false },
  'NO FOOT':    { bg: '#F3F4F6', color: '#4B5563', dot: '#9CA3AF', pulse: false },
  'IDLE':       { bg: '#F3F4F6', color: '#4B5563', dot: '#9CA3AF', pulse: false },
  'UNKNOWN':    { bg: '#F3F4F6', color: '#4B5563', dot: '#9CA3AF', pulse: false },
};
const FB = { bg: '#F3F4F6', color: '#4B5563', dot: '#9CA3AF', pulse: false };

const SZ = {
  sm: { p: '0.18rem 0.55rem', fs: '0.7rem',    dot: '6px'  },
  md: { p: '0.28rem 0.7rem',  fs: '0.8rem',    dot: '7px'  },
  lg: { p: '0.4rem 0.9rem',   fs: '0.875rem',  dot: '8px'  },
};

export default function StatusBadge({ status = 'UNKNOWN', size = 'md' }) {
  const c = STATUS_MAP[status] ?? FB;
  const s = SZ[size] ?? SZ.md;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.32rem',
      padding: s.p, borderRadius: '9999px',
      background: c.bg, color: c.color,
      fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
      fontWeight: 600, fontSize: s.fs, letterSpacing: '0.03em',
      whiteSpace: 'nowrap', userSelect: 'none',
    }}>
      <span style={{
        width: s.dot, height: s.dot, borderRadius: '50%',
        background: c.dot, flexShrink: 0,
        animation: c.pulse ? 'sbPulse 1.6s ease-in-out infinite' : 'none',
      }} />
      {status}
      <style>{`@keyframes sbPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }`}</style>
    </span>
  );
}
