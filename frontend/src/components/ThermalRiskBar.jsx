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
      {label && <div className="text-xs font-mono text-[#546e7a] mb-2">{label}</div>}
      <div className="w-full h-3 bg-[#0a1628] border border-[rgba(0,255,200,0.15)] rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            backgroundColor: isHigh ? '#ff4b6e' : '#00ffc8',
          }}
        />
      </div>
      <div className="text-right text-xs font-mono text-[#00ffc8] mt-1">
        {riskScore.toFixed(1)} / 100
      </div>
    </div>
  );
}
