import React from 'react';
import classNames from '../utils/classNames.js';
import { titleCase } from '../utils/strings.js';

export default function RevealPanel({ correctAnswer, isCorrect = false }) {
  const boxClasses = classNames(
    'mt-3 rounded-xl px-4 py-3 text-sm border',
    isCorrect
      ? 'border-green-300 bg-green-50 text-green-700'
      : 'border-red-300 bg-red-50 text-red-700'
  );

  return (
    <div role="status" aria-live="polite" className={boxClasses}>
      {isCorrect ? (
        <span>
          Молодец, верно:&nbsp;
          <strong className="font-semibold">{titleCase(correctAnswer)}</strong>
        </span>
      ) : (
        <span>
          Правильный ответ:&nbsp;
          <strong className="font-semibold">{titleCase(correctAnswer)}</strong>
        </span>
      )}
    </div>
  );
}
