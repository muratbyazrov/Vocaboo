import React from 'react';
import classNames from '../utils/classNames.js';

export default function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        'px-3 py-2 rounded-xl border whitespace-nowrap',
        active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
