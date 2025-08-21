import React, { useMemo } from 'react';
import classNames from '../utils/classNames.js';
import { titleCase } from '../utils/strings.js';

export default function RevealPanel({ correctAnswer, isCorrect = false }) {
  const boxClasses = classNames(
    'fixed top-6 left-1/2 -translate-x-1/2 z-50', // выше отступ и центрирование
    'w-[80%] max-w-2xl', // адаптивная ширина
    'rounded-xl px-6 py-4 text-base font-medium shadow-lg backdrop-blur-sm',
    'bg-opacity-90',
    isCorrect
      ? 'border border-green-300 bg-green-50/90 text-green-700'
      : 'border border-red-300 bg-red-50/90 text-red-700'
  );

  const successPhrases = [
    'Молодец!',
    'Отлично!',
    'Так держать!',
    'Красавчик!',
    'Супер!',
    'Браво!',
    'Точно в цель!',
    'Ты гений!',
    'Аж искры из глаз!',
    'Это было эпично!',
    'Вот это скилл!',
    'Фантастика!',
    'Уровень бог!',
    'Нейросети завидуют!',
  ];

  const randomPhrase = useMemo(() => {
    if (!isCorrect) return null;
    const idx = Math.floor(Math.random() * successPhrases.length);
    return successPhrases[idx];
  }, [isCorrect]);

  return (
    <div role="status" aria-live="polite" className={boxClasses}>
      {isCorrect ? (
        <span>{randomPhrase}</span>
      ) : (
        <span>
          Неверно. Правильный ответ:&nbsp;
          <strong className="font-semibold">{titleCase(correctAnswer)}</strong>
        </span>
      )}
    </div>
  );
}
