import React from 'react';

export default function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none py-2">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer hidden"
      />
      <span className="w-10 h-6 flex items-center bg-gray-300 rounded-full relative
          after:content-[''] after:absolute after:w-5 after:h-5 after:bg-white after:rounded-full after:left-0.5 after:transition-all
          peer-checked:bg-blue-600 peer-checked:after:translate-x-4" />
      <span className="text-sm">{label}</span>
    </label>
  );
}
