import React from 'react';

/**
 * Prediction history buffer visualization
 * @param {Object} props
 * @param {number[]} props.history - Array of predictions (0 or 1)
 * @param {number} [props.maxLength=60] - Maximum buffer length
 */
export default function PredictionBuffer({ history, maxLength = 60 }) {
  const displayHistory = history.slice(-maxLength);
  const empty = Array(maxLength - displayHistory.length).fill(null);

  return (
    <div className="w-full">
      <div className="text-xs font-mono text-[#6B7280] mb-2">PREDICTION BUFFER</div>
      <div className="flex gap-1 items-center justify-start overflow-x-auto pb-2">
        {empty.map((_, i) => (
          <div
            key={`empty-${i}`}
            className="w-2 h-2 rounded-full bg-[#FAF8FF] border border-[rgba(16,185,129,0.15)]"
          />
        ))}
        {displayHistory.map((pred, i) => (
          <div
            key={`pred-${i}`}
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: pred === 0 ? '#10B981' : '#F87171',
              boxShadow: `0 0 4px ${pred === 0 ? '#10B981' : '#F87171'}`,
            }}
          />
        ))}
      </div>
      <div className="text-xs font-mono text-[#6B7280]">
        {displayHistory.length} / {maxLength} frames
      </div>
    </div>
  );
}
