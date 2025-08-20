import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [revealed, setRevealed] = useState(false);
  const [cardImg, setCardImg] = useState('');
  const [isFetchingImg, setIsFetchingImg] = useState(false);
  const [choices, setChoices] = useState([]);

  const hasWords = Array.isArray(words) && words.length > 0;
  const hasValidImg = isValidHttpUrl(cardImg);

  // Init queue on mount & when words length changes
  useEffect(() => {
    if (!hasWords) return;
    const idxs = words.map((_, i) => i).sort(() => Math.random() - 0.5);
    setQueue(idxs);
    setCurrentIdx(0);
    setRevealed(false);
  }, [hasWords, words.length]);

  // Fetch image for current word (cancelable)
  useEffect(() => {
    if (!hasWords || !queue.length) return;
    const idx = queue[currentIdx];
    if (typeof idx !== 'number') return;
    const w = words[idx];
    if (!w?.en) return;

    const ctrl = new AbortController();
    setIsFetchingImg(true);
    setCardImg('');

    fetchImageForWord(w.en, settingsKey, ctrl.signal)
      .then((img) => setCardImg(isValidHttpUrl(img) ? img : ''))
      .finally(() => setIsFetchingImg(false));

    return () => ctrl.abort();
  }, [hasWords, queue, currentIdx, words, settingsKey]);

  // Build 4 choices
  useEffect(() => {
    if (!hasWords || !queue.length) return;
    const idx = queue[currentIdx];
    if (typeof idx !== 'number') return;
    const correct = words[idx]?.en?.trim();
    if (!correct) return;
    const pool = words.map((w, i) => (i === idx ? null : (w?.en || '').trim())).filter(Boolean);
    const decoys = [...new Set(pool)].sort(() => Math.random() - 0.5).slice(0, 3);
    const all = [correct, ...decoys].sort(() => Math.random() - 0.5);
    setChoices(all);
  }, [hasWords, queue, currentIdx, words]);

  const onPick = useCallback(
    (selected) => {
      if (!queue.length) return;
      const idx = queue[currentIdx];
      const w = words[idx];
      if (!w) return;

      const correct = normalize(selected) === normalize(w.en);

      dispatchWordStatsUpdate({ index: idx, correct });

      setProgress((p) => {
        const newHist = [...(p.history || []).slice(-199), { ts: Date.now(), correct }];
        return {
          totalAnswered: (p.totalAnswered || 0) + 1,
          totalCorrect: (p.totalCorrect || 0) + (correct ? 1 : 0),
          streak: correct ? (p.streak || 0) + 1 : 0,
          history: newHist,
        };
      });

      if (correct) {
        setRevealed(false);
        if (currentIdx + 1 < queue.length) setCurrentIdx((i) => i + 1);
        else {
          const idxs = words.map((_, i) => i).sort(() => Math.random() - 0.5);
          setQueue(idxs);
          setCurrentIdx(0);
        }
      } else {
        setRevealed(true);
      }
    },
    [queue, currentIdx, words, setProgress]
  );

  const hasValidIdx = queue.length > 0 && typeof queue[currentIdx] === 'number';
  const current = hasValidIdx ? words[queue[currentIdx]] : null;

  return (
    <section className="grid gap-4 flex-1 min-h-0">
      <div className="bg-white rounded-2xl shadow p-3 flex flex-col items-center flex-1 min-h-0">
        {!hasWords ? (
          <div className="text-gray-500 text-sm text-center">
            Нет слов для тренировки. Добавьте слова в разделе «Словарь».
          </div>
        ) : (
          <>
            <div className="w-full flex items-center justify-between mb-2">
              <div className="text-xs text-gray-500">
                {queue.length ? `Карточка ${currentIdx + 1} / ${queue.length}` : '—'}
              </div>
            </div>

            <div className="w-full max-w-[340px] aspect-[1/1] bg-gray-100 rounded-2xl overflow-hidden flex items-center justify-center mb-3 relative">
              {isFetchingImg ? (
                <div className="text-gray-400">Ищу картинку…</div>
              ) : hasValidImg ? (
                <img
                  src={cardImg}
                  alt="Illustration"
                  className="w-full h-full object-cover"
                  onError={() => setCardImg('')}
                />
              ) : (
                <div className="text-6xl">🧠</div>
              )}
            </div>

            {current && (
              <>
                <div className="text-center mb-2">
                  <div className="text-xs text-gray-500 mb-1">Выберите перевод на английском:</div>
                  <div className="text-xl font-semibold">{titleCase(current.ru)}</div>
                </div>

                <div className="grid grid-cols-1 gap-2 w-full max-w-[520px]">
                  {choices.map((c) => {
                    const correctChoice = normalize(c) === normalize(current.en);
                    return (
                      <button
                        key={c}
                        onPointerDown={() => c && ttsSpeak(c)}
                        onClick={() => onPick(c)}
                        className={classNames(
                          'px-4 py-3 rounded-xl border text-base active:scale-[.99] text-left',
                          revealed
                            ? correctChoice
                              ? 'bg-green-50 border-green-300'
                              : 'bg-red-50 border-red-300'
                            : 'bg-white hover:bg-gray-50'
                        )}
                        aria-label={`Choice: ${c}`}
                      >
                        {titleCase(c)}
                      </button>
                    );
                  })}
                </div>

                {revealed && <RevealPanel correctAnswer={current.en} />}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
