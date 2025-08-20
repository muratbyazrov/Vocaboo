import React from 'react';
import { titleCase } from '../utils/strings.js';

export default function RevealPanel({ correctAnswer }) {
  return (
    <div className="mt-3 w-full max-w-[520px] rounded-xl border p-3 border-red-300 bg-red-50">
      <div className="text-xs text-gray-600 mb-1">Правильный ответ:</div>
      <div className="text-lg font-semibold">{titleCase(correctAnswer)}</div>
    </div>
  );
}
