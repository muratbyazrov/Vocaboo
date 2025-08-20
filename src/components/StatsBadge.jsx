import React from 'react';

export default function StatsBadge({ label, value }) {
  return (
    <div className="px-2.5 py-1 rounded-full bg-white shadow border text-xs">
      <span className="text-gray-500 mr-1">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
