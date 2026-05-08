import React from 'react';

const statusConfig = {
  HEALTHY: { bg: '#00e676', text: '#050d1a', pulse: false },
  'ULCER RISK': { bg: '#ff4b6e', text: '#fff', pulse: true },
  ANALYZING: { bg: '#ffa500', text: '#050d1a', pulse: true },
  UNCERTAIN: { bg: '#0080ff', text: '#fff', pulse: false },
  'NO FOOT': { bg: '#546e7a', text: '#fff', pulse: false },
  IDLE: { bg: '#546e7a', text: '#fff', pulse: false },
  UNKNOWN: { bg: '#546e7a', text: '#fff', pulse: false },
};

const defaultConfig = { bg: '#546e7a', text: '#fff', pulse: false };

/**
 * Status badge component
 * @param {Object} props
 * @param {string} props.status - Status to display
 * @param {string} [props.size='md'] - Size variant (sm, md, lg)
 */
export default function StatusBadge({ status, size = 'md' }) {
  const config = statusConfig[status] || defaultConfig;
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full font-mono font-bold ${
        config.pulse ? 'animate-pulse' : ''
      }`}
      style={{
        backgroundColor: config.bg,
        color: config.text,
      }}
    >
      ● {status}
    </div>
  );
}
