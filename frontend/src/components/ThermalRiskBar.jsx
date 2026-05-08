import React from 'react';

/**
 * Thermal risk gradient bar
 * @param {Object} props
 * @param {number} props.riskScore - Risk score 0-100
 * @param {string} [props.label='THERMAL RISK INDEX'] - Bar label
 */
export default function ThermalRiskBar({ riskScore, label = 'THERMAL RISK INDEX' }) {
  const percentage = Math.min(Math.max(riskScore, 0), 100);
  const isHigh = percentage > 65;

  return (
    <div className="w-full">
      {label && <div className="text-xs font-mono text-[#6B7280] mb-2">{label}</div>}
      <div className="w-full h-3 bg-[#FAF8FF] border border-[rgba(16,185,129,0.15)] rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            backgroundColor: isHigh ? '#F87171' : '#10B981',
          }}
        />
      </div>
      <div className="text-right text-xs font-mono text-[#10B981] mt-1">
        {riskScore.toFixed(1)} / 100
      </div>
    </div>
  );
}
