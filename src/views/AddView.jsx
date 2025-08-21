import React, { useCallback, useEffect, useRef, useState } from 'react';
import DirectionButton from '../components/DirectionButton.jsx';
import ManualAddWord from './ManualAddWord.jsx';
import { fetchTranslationsOnce } from '../services/translate.js';

export default function AddView({ words, setWords }) {
  const [direction, setDirection] = useState('ru2en');
  const [sourceInput, setSourceInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [addSuccess, setAddSuccess] = useState(false);

  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  const doLookup = useCallback(
    (q) => {
      if (!q?.trim()) return;
      setLoading(true);
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const from = direction === 'ru2en' ? 'ru' : 'en';
      const to = direction === 'ru2en' ? 'en' : 'ru';
      fetchTranslationsOnce(q, from, to, ctrl.signal)
        .then((s) => setSuggestions(s))
        .finally(() => setLoading(false));
    },
    [direction]
  );

  const handleSearch = useCallback(() => doLookup(sourceInput), [doLookup, sourceInput]);

  useEffect(() => {
    if (!sourceInput.trim()) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doLookup(sourceInput), 400);
    return () => clearTimeout(debounceRef.current);
  }, [sourceInput, doLookup]);

  const handleSelectSuggestion = useCallback(
    (s) => {
      const q = sourceInput.trim();
      if (!q || !s) return;
      const ru = direction === 'ru2en' ? q : s;
      const en = direction === 'ru2en' ? s : q;
      const newItem = {
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        ru,
        en,
        stats: { seen: 0, correct: 0, wrong: 0 },
      };
      setWords((prev) => [newItem, ...prev]);
      setSourceInput('');
      setSuggestions([]);
      setAddSuccess(true);
      setTimeout(() => setAddSuccess(false), 1200);
    },
    [direction, sourceInput, setWords]
  );

  const onManualAdd = useCallback(
    (ru, en) => {
      const newItem = {
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        ru,
        en,
        stats: { seen: 0, correct: 0, wrong: 0 },
      };
      setWords((prev) => [newItem, ...prev]);
      setAddSuccess(true);
      setSourceInput('');
      setSuggestions([]);
      setTimeout(() => setAddSuccess(false), 1200);
    },
    [setWords]
  );

  return (
    // УБРАЛ flex-1 и min-h-0, чтобы секция не была зажата по высоте
    <section className="grid md:grid-cols-2 gap-4 w-full">
      {/* Карточка растягивается по контенту, overflow видимый */}
      <div className="bg-white rounded-2xl shadow p-3 flex flex-col h-auto overflow-visible">
        <h2 className="font-semibold mb-2 text-base">Добавить слово одним нажатием</h2>

        <div className="flex flex-wrap gap-2 mb-2">
          <DirectionButton
            label="RU→EN"
            active={direction === 'ru2en'}
            onClick={() => {
              setDirection('ru2en');
              setSuggestions([]);
            }}
          />
          <DirectionButton
            label="EN→RU"
            active={direction === 'en2ru'}
            onClick={() => {
              setDirection('en2ru');
              setSuggestions([]);
            }}
          />
        </div>

        <label className="block text-xs mb-1">
          {direction === 'ru2en' ? 'Исходное слово по-русски' : 'Source word in English'}
        </label>

        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 border rounded-xl px-3 py-2 text-base"
            value={sourceInput}
            onChange={(e) => setSourceInput(e.target.value)}
            placeholder={direction === 'ru2en' ? 'например: кошка' : 'e.g., cat'}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            className={`px-3 py-2 rounded-xl bg-blue-600 text-white text-sm ${loading ? 'opacity-60' : ''}`}
            disabled={loading}
          >
            {loading ? 'Ищу…' : 'Подобрать'}
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="mb-1 text-xs text-gray-500">
            Нажмите на перевод, чтобы сразу сохранить его в словарь:
          </div>
        )}

        {/* Контейнер с подсказками занимает всю ширину и переносит элементы */}
        <div className="flex flex-wrap gap-2 w-full">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleSelectSuggestion(s)}
              className="px-3 py-2 rounded-full border hover:bg-gray-50 active:scale-[.98] text-sm max-w-full break-words"
            >
              {s}
            </button>
          ))}
        </div>

        <ManualAddWord direction={direction} sourceInput={sourceInput} onAdd={onManualAdd} />

        {/* Тост успеха поверх, но карточка может расти, чтобы не вываливаться */}
        <div className="relative">
          {addSuccess && (
            <div className="absolute left-0 right-0 top-[50px] mx-auto flex justify-center z-10 pointer-events-none">
              <div className="bg-green-500 text-white rounded-xl px-4 py-2 text-sm shadow transition-all animate-fade-in-out">
                Слово добавлено!
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
