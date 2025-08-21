import React, { useCallback, useEffect, useRef, useState } from 'react';

import { isValidHttpUrl } from '../utils/url.js';
import { titleCase, normalize } from '../utils/strings.js';
import classNames from '../utils/classNames.js';
import RevealPanel from '../components/RevealPanel.jsx';
import { ttsSpeak } from '../utils/tts.js';
import { dispatchWordStatsUpdate } from '../utils/events.js';
import { fetchImageForWord } from '../services/images.js';

export default function TrainView({ words, progress, setProgress, settingsKey }) {
  const [queue, setQueue] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  const [choices, setChoices] = useState([]);
  const [choiceImages, setChoiceImages] = useState({});

  // feedback UI
  const [revealed, setRevealed] = useState(false);       // включает окраску карточек
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [locked, setLocked] = useState(false);           // временная блокировка кликов для анимации
  const [warn, setWarn] = useState('');
  const [awaitingCorrect, setAwaitingCorrect] = useState(false); // ждём правильный клик после ошибки

  const hasWords = Array.isArray(words) && words.length > 0;

  // таймеры
  const timersRef = useRef([]);
  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };
  useEffect(() => clearTimers, []);

  // Init queue
  useEffect(() => {
    if (!hasWords) return;
    const idxs = words.map((_, i) => i).sort(() => Math.random() - 0.5);
    setQueue(idxs);
    setCurrentIdx(0);
    setRevealed(false);
    setSelectedChoice(null);
    setLocked(false);
    setWarn('');
    setAwaitingCorrect(false);
    clearTimers();
  }, [hasWords, words.length]);

  // Build 4 choices — только при смене карточки/очереди/количества слов
  useEffect(() => {
    if (!hasWords || !queue.length) return;
    const idx = queue[currentIdx];
    if (typeof idx !== 'number') return;
    const correct = (words[idx]?.en || '').trim();
    if (!correct) return;

    const pool = words.map((w, i) => (i === idx ? null : (w?.en || '').trim())).filter(Boolean);
    const decoys = [...new Set(pool)].sort(() => Math.random() - 0.5).slice(0, 3);
    const all = [correct, ...decoys].sort(() => Math.random() - 0.5);
    setChoices(all);

    // сброс local state для новой карточки
    setRevealed(false);
    setSelectedChoice(null);
    setLocked(false);
    setWarn('');
    setAwaitingCorrect(false);
    clearTimers();

    // сброс изображений
    setChoiceImages({});
    // важно: НЕ зависим от всего объекта words (чтобы не перетасовывать лишний раз)
  }, [hasWords, queue, currentIdx, words.length]);

  // Fetch images for choices
  useEffect(() => {
    if (!choices.length) return;
    const ctrls = choices.map(() => new AbortController());

    choices.forEach((c, i) => {
      setChoiceImages((prev) => ({ ...prev, [c]: { url: '', loading: true } }));
      fetchImageForWord(c, ctrls[i].signal)
        .then((img) =>
          setChoiceImages((prev) => ({
            ...prev,
            [c]: { url: isValidHttpUrl(img) ? img : '', loading: false },
          }))
        )
        .catch(() =>
          setChoiceImages((prev) => ({ ...prev, [c]: { url: '', loading: false } }))
        );
    });

    return () => ctrls.forEach((c) => c.abort());
  }, [choices, settingsKey]);

  const gotoNextCard = useCallback(() => {
    setRevealed(false);
    setSelectedChoice(null);
    setWarn('');
    setAwaitingCorrect(false);
    if (currentIdx + 1 < queue.length) {
      setCurrentIdx((i) => i + 1);
    } else {
      const idxs = words.map((_, i) => i).sort(() => Math.random() - 0.5);
      setQueue(idxs);
      setCurrentIdx(0);
    }
    setLocked(false);
  }, [currentIdx, queue.length, words]);

  const onPick = useCallback(
    (selected) => {
      if (locked || !queue.length) return;

      const idx = queue[currentIdx];
      const w = words[idx];
      if (!w) return;

      const isCorrect = normalize(selected) === normalize(w.en);

      // если ждём правильный ответ — игнорим любые НЕправильные клики
      if (awaitingCorrect && !isCorrect) {
        return;
      }

      // локальная реакция
      setSelectedChoice(selected);

      // статистика (фиксируем каждую попытку)
      dispatchWordStatsUpdate({ index: idx, correct: isCorrect });
      setProgress((p) => {
        const newHist = [...(p.history || []).slice(-199), { ts: Date.now(), correct: isCorrect }];
        return {
          totalAnswered: (p.totalAnswered || 0) + 1,
          totalCorrect: (p.totalCorrect || 0) + (isCorrect ? 1 : 0),
          streak: isCorrect ? (p.streak || 0) + 1 : 0,
          history: newHist,
        };
      });

      clearTimers();

      if (isCorrect) {
        // показываем зелёную подсветку и переходим к следующей
        setRevealed(true);
        setLocked(true);
        setWarn('');
        setAwaitingCorrect(false);

        timersRef.current.push(
          setTimeout(() => {
            gotoNextCard();
          }, 800) // короткая «зелёная вспышка»
        );
      } else {
        // неправильный: оставляем зелёным правильный вариант и красным выбранный,
        // остаёмся на этой карточке, пока не нажмут правильный
        setRevealed(true);
        setWarn('Неверно. Выбери правильный вариант.');
        setAwaitingCorrect(true);

        // короткая блокировка от двойного клика
        setLocked(true);
        timersRef.current.push(setTimeout(() => setLocked(false), 300));
      }
    },
    [locked, queue, currentIdx, words, setProgress, gotoNextCard, awaitingCorrect]
  );

  const hasValidIdx = queue.length > 0 && typeof queue[currentIdx] === 'number';
  const current = hasValidIdx ? words[queue[currentIdx]] : null;

  return (
    <section className="grid gap-4 flex-1 min-h-0">
      <div className="bg-white rounded-2xl shadow p-3 flex flex-col items-stretch flex-1 min-h-0">
        {!hasWords ? (
          <div className="text-gray-500 text-sm text-center">
            Нет слов для тренировки. Добавьте слова в разделе «Словарь».
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="w-full flex items-center justify-between mb-2">
              <div className="text-xs text-gray-500">
                {queue.length ? `Карточка ${currentIdx + 1} / ${queue.length}` : '—'}
              </div>
            </div>

            {/* Предупреждение при ошибке */}
            {warn && (
              <div
                role="alert"
                aria-live="polite"
                className="mb-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {warn}
              </div>
            )}

            {current && (
              <>
                <div className="text-center mb-2">
                  <div className="text-xl font-semibold">{titleCase(current.ru)}</div>
                </div>

                {/* Контейнер сетки — на всю оставшуюся высоту */}
                <div className={classNames('w-full max-w-[980px] flex-1 min-h-0', locked && 'pointer-events-none')}>
                  {/* Сетка 2×2 на всю высоту */}
                  <div className="grid grid-cols-2 grid-rows-2 gap-3 h-full">
                    {choices.map((c) => {
                      const isCorrectChoice = current && normalize(c) === normalize(current.en);
                      const isSelected = selectedChoice === c;
                      const img = choiceImages[c]?.url;
                      const loading = choiceImages[c]?.loading;

                      // Раскраска карточек:
                      let cardStateClass = 'bg-white hover:shadow';
                      if (revealed) {
                        if (isCorrectChoice) {
                          cardStateClass = 'bg-green-50 border-green-400 ring-2 ring-green-300';
                        } else if (isSelected) {
                          cardStateClass = 'bg-red-50 border-red-400 ring-2 ring-red-300';
                        } else {
                          cardStateClass = 'bg-white border-gray-200';
                        }
                      }

                      const labelStateClass = revealed
                        ? isCorrectChoice
                          ? 'text-green-700'
                          : isSelected
                            ? 'text-red-700'
                            : 'text-gray-900'
                        : 'text-gray-900';

                      // кликаем либо когда не ждём правильный, либо когда клик именно на правильный
                      const canClick = !locked && (!awaitingCorrect || (awaitingCorrect && isCorrectChoice));

                      return (
                        <button
                          key={c}
                          onPointerDown={() => c && ttsSpeak(c)}
                          onClick={() => canClick && onPick(c)}
                          className={classNames(
                            'h-full flex flex-col rounded-2xl overflow-hidden border text-left transition-transform duration-100 active:scale-[.99]',
                            cardStateClass
                          )}
                          aria-label={`Choice: ${c}`}
                          aria-pressed={isSelected || undefined}
                        >
                          {/* Изображение */}
                          <div
                            className="w-full max-w-[320px] aspect-[3/9] bg-gray-100 rounded-2xl overflow-hidden flex items-center justify-center mb-3 relative">
                            {loading ? (
                              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                                Ищу картинку…
                              </div>
                            ) : isValidHttpUrl(img) ? (
                              <img
                                src={img}
                                alt={c}
                                className={classNames(
                                  'absolute inset-0 w-full h-full object-cover transition-opacity duration-200',
                                  revealed && !isCorrectChoice ? 'opacity-90' : 'opacity-100'
                                )}
                                onError={(e) => (e.currentTarget.src = '')}
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-6xl">🧠</div>
                            )}
                          </div>

                          {/* Подпись */}
                          <div className="px-4 py-3">
                            <div className={classNames('text-lg font-medium truncate', labelStateClass)} title={c}>
                              {titleCase(c)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {revealed && (
                  <RevealPanel
                    correctAnswer={current.en}
                    isCorrect={!awaitingCorrect} // если не ждём повторного ответа — ответ был правильным
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
