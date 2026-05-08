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
    <div className="font-mono text-sm text-[#e0f7fa] py-1">
      <span className="text-[#00ffc8]">▶</span> {label.padEnd(20)}: <span className="text-[#0080ff]">{value}</span> {unit}
    </div>
  );
}
