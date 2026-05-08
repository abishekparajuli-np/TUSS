import React from 'react';

/**
 * Monospace metric display component
 * @param {Object} props
 * @param {string} props.label - Metric label
 * @param {string|number} props.value - Metric value
 * @param {string} [props.unit=''] - Unit of measurement
 */
export default function MetricDisplay({ label, value, unit = '' }) {
  return (
    <div className="font-mono text-sm text-[#1E1B4B] py-1">
      <span className="text-[#10B981]">▶</span> {label.padEnd(20)}: <span className="text-[#10B981]">{value}</span> {unit}
    </div>
  );
}
