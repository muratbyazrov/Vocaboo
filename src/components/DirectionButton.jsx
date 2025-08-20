import React from 'react';
import classNames from '../utils/classNames.js';

export default function DirectionButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        'px-3 py-2 rounded-xl border text-sm',
        active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
