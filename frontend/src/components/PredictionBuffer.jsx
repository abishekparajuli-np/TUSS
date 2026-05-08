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
      <div className="text-xs font-mono text-[#546e7a] mb-2">PREDICTION BUFFER</div>
      <div className="flex gap-1 items-center justify-start overflow-x-auto pb-2">
        {empty.map((_, i) => (
          <div
            key={`empty-${i}`}
            className="w-2 h-2 rounded-full bg-[#0a1628] border border-[rgba(0,255,200,0.1)]"
          />
        ))}
        {displayHistory.map((pred, i) => (
          <div
            key={`pred-${i}`}
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: pred === 0 ? '#00e676' : '#ff4b6e',
              boxShadow: `0 0 4px ${pred === 0 ? '#00e676' : '#ff4b6e'}`,
            }}
          />
        ))}
      </div>
      <div className="text-xs font-mono text-[#546e7a]">
        {displayHistory.length} / {maxLength} frames
      </div>
    </div>
  );
}
