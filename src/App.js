import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// -------------------- Utils & Storage --------------------
const LS_KEYS = {
  words: 'ruen_words_v1',
  progress: 'ruen_progress_v1',
  settings: 'ruen_settings_v1',
};

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}

function classNames(...xs) {
  return xs.filter(Boolean).join(' ');
}

function isValidHttpUrl(u) {
  if (typeof u !== 'string') return false;
  const s = u.trim();
  if (!s) return false;
  try {
    const url = new URL(s);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalize(str) {
  return (str || '').toString().toLowerCase().trim().split('ё').join('е');
}

// TitleCase for display (do not mutate original data)
function titleCase(s) {
  return (s || '')
    .split(/(\s|-)/)
    .map((part) => {
      if (part === ' ' || part === '-') return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

function safeUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2, 11);
}

function ttsSpeak(word, rate = 0.95) {
  try {
    if (!('speechSynthesis' in window)) return;
    const utt = new SpeechSynthesisUtterance(word || '');
    utt.lang = 'en-US';
    utt.rate = rate;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const voice = voices.find((v) => /en-/i.test(v?.lang || ''));
    if (voice) utt.voice = voice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  } catch {}
}

// -------------------- APIs --------------------
async function fetchTranslationsOnce(query, from = 'ru', to = 'en', signal) {
  if (!query || !query.trim()) return [];
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(query)}&langpair=${from}|${to}`;
  try {
    const res = await fetch(url, { signal });
    const data = await res.json();
    const suggestions = new Set();
    if (data?.responseData?.translatedText) suggestions.add(data.responseData.translatedText);
    if (Array.isArray(data?.matches)) {
      data.matches.forEach((m) => m?.translation && suggestions.add(m.translation));
    }
    return Array.from(suggestions)
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean)
      .slice(0, 10);
  } catch (e) {
    if (e?.name !== 'AbortError') console.warn('Translation fetch failed', e);
    return [];
  }
}

async function fetchImageForWord(enWord, signal) {
  const term = (enWord || '').toString().trim();
  if (!term) return null;
  const q = encodeURIComponent(term);
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=600&format=json&origin=*&generator=search&gsrsearch=${q}`;
  try {
    const res = await fetch(url, { signal });
    const data = await res.json();
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
    const withThumb = pages.filter((p) => p?.thumbnail?.source);
    if (withThumb.length > 0) {
      const src = withThumb[0].thumbnail.source;
      return isValidHttpUrl(src) ? src : null;
    }
  } catch (e) {
    if (e?.name !== 'AbortError') console.warn('Image fetch failed', e);
  }
  return null;
}

// -------------------- Small UI --------------------
function TabButton({ active, children, onClick }) {
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

function DirectionButton({ label, active, onClick }) {
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

function StatsBadge({ label, value }) {
  return (
    <div className="px-2.5 py-1 rounded-full bg-white shadow border text-xs">
      <span className="text-gray-500 mr-1">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none py-2">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="peer hidden"/>
      <span className="w-10 h-6 flex items-center bg-gray-300 rounded-full relative after:content-[''] after:absolute after:w-5 after:h-5 after:bg-white after:rounded-full after:left-0.5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-4"/>
      <span className="text-sm">{label}</span>
    </label>
  );
}

function RevealPanel({ correctAnswer }) {
  return (
    <div className="mt-3 w-full max-w-[520px] rounded-xl border p-3 border-red-300 bg-red-50">
      <div className="text-xs text-gray-600 mb-1">Правильный ответ:</div>
      <div className="text-lg font-semibold">{titleCase(correctAnswer)}</div>
    </div>
  );
}

// -------------------- Export/Import helpers --------------------
function exportWords(words) {
  try {
    const data = JSON.stringify(words, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vocaboo_words.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  } catch (e) {
    // eslint-disable-next-line no-alert
    alert('Ошибка экспорта');
  }
}

function handleImportWordsFactory(words, setWords) {
  return function handleImportWords(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!Array.isArray(imported)) throw new Error('Некорректный формат файла');
        // Dedup by id and by (ru,en) pair
        const existById = new Set(words.map((w) => w.id));
        const existByPair = new Set(words.map((w) => `${normalize(w.ru)}|${normalize(w.en)}`));
        const fresh = imported.filter((w) => {
          if (!w || !w.id || !w.ru || !w.en) return false;
          const pair = `${normalize(w.ru)}|${normalize(w.en)}`;
          return !existById.has(w.id) && !existByPair.has(pair);
        });
        setWords((prev) => [...fresh, ...prev]);
        // eslint-disable-next-line no-alert
        alert(`Импортировано слов: ${fresh.length}`);
      } catch (err) {
        // eslint-disable-next-line no-alert
        alert('Ошибка импорта: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
}

// -------------------- Views --------------------
function Header({ progress, accuracy, tab, setTab }) {
  return (
    <header className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b" style={{ marginTop: 20, marginBottom: 10 }}>
      <div className="px-3 pt-[calc(env(safe-area-inset-top))] pb-2 max-w-full mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold leading-tight">Vocaboo</h1>
          <div className="flex gap-2 items-center">
            <StatsBadge label="Ans" value={progress.totalAnswered} />
            <StatsBadge label="Acc" value={`${accuracy}%`} />
            <StatsBadge label="Streak" value={progress.streak} />
          </div>
        </div>
        <nav className="mt-2 flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          <TabButton active={tab === 'train'} onClick={() => setTab('train')}>Тренировка</TabButton>
          <TabButton active={tab === 'add'} onClick={() => setTab('add')}>Словарь</TabButton>
          <TabButton active={tab === 'list'} onClick={() => setTab('list')}>Список</TabButton>
        </nav>
      </div>
    </header>
  );
}

function TrainView({ words, progress, setProgress }) {
  const [queue, setQueue] = useState([]); // indices
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

    fetchImageForWord(w.en, ctrl.signal)
      .then((img) => setCardImg(isValidHttpUrl(img) ? img : ''))
      .finally(() => setIsFetchingImg(false));

    return () => ctrl.abort();
  }, [hasWords, queue, currentIdx, words]);

  // Build 4 choices
  useEffect(() => {
    if (!hasWords || !queue.length) return;
    const idx = queue[currentIdx];
    if (typeof idx !== 'number') return;
    const correct = words[idx]?.en?.trim();
    if (!correct) return;
    const pool = words
      .map((w, i) => (i === idx ? null : (w?.en || '').trim()))
      .filter(Boolean);
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

      // update per-word stats (in localStorage via setWords in parent – we don't have it here),
      // so in this refactor we emit a custom event to bubble the update.
      const event = new CustomEvent('vocaboo:updateWordStats', {
        detail: { index: idx, correct },
      });
      window.dispatchEvent(event);

      // progress
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

  if (!hasWords) {
    return (
      <section className="grid gap-4 flex-1 min-h-0">
        <div className="bg-white rounded-2xl shadow p-3 flex flex-col items-center flex-1 min-h-0">
          <div className="text-gray-500 text-sm text-center">
            Нет слов для тренировки. Добавьте слова в разделе «Словарь».
          </div>
        </div>
      </section>
    );
  }

  const idx = queue[currentIdx];
  const current = typeof idx === 'number' ? words[idx] : null;

  return (
    <section className="grid gap-4 flex-1 min-h-0">
      <div className="bg-white rounded-2xl shadow p-3 flex flex-col items-center flex-1 min-h-0">
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
              className="w-full h-full object-cover" // cover to fill square neatly
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
      </div>
    </section>
  );
}

function AddView({ words, setWords }) {
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

      // cancel prev
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

  // Debounce on typing (optional nicety)
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
      const newItem = { id: safeUUID(), ru, en, stats: { seen: 0, correct: 0, wrong: 0 } };
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
      const newItem = { id: safeUUID(), ru, en, stats: { seen: 0, correct: 0, wrong: 0 } };
      setWords((prev) => [newItem, ...prev]);
      setAddSuccess(true);
      setSourceInput('');
      setSuggestions([]);
      setTimeout(() => setAddSuccess(false), 1200);
    },
    [setWords]
  );

  return (
    <section className="grid md:grid-cols-2 gap-4 flex-1 min-h-0">
      <div className="bg-white rounded-2xl shadow p-3 flex flex-col min-h-0">
        <h2 className="font-semibold mb-2 text-base">Добавить слово одним нажатием</h2>
        <div className="flex flex-wrap gap-2 mb-2">
          <DirectionButton label="RU→EN" active={direction === 'ru2en'} onClick={() => { setDirection('ru2en'); setSuggestions([]); }} />
          <DirectionButton label="EN→RU" active={direction === 'en2ru'} onClick={() => { setDirection('en2ru'); setSuggestions([]); }} />
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
            className={classNames('px-3 py-2 rounded-xl bg-blue-600 text-white text-sm', loading && 'opacity-60')}
            disabled={loading}
          >
            {loading ? 'Ищу…' : 'Подобрать'}
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="mb-1 text-xs text-gray-500">Нажмите на перевод, чтобы сразу сохранить его в словарь:</div>
        )}
        <div className="flex flex-wrap gap-2 no-scrollbar">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleSelectSuggestion(s)}
              className="px-3 py-2 rounded-full border hover:bg-gray-50 active:scale-[.98] text-sm"
            >
              {s}
            </button>
          ))}
        </div>
        {/* Manual add */}
        <ManualAddWord direction={direction} sourceInput={sourceInput} onAdd={onManualAdd} />
        <div className="relative">
          {addSuccess && (
            <div className="absolute left-0 right-0 top-[50px] mx-auto flex justify-center z-10 pointer-events-none">
              <div className="bg-green-500 text-white rounded-xl px-4 py-2 text-sm shadow transition-all animate-fade-in-out">Слово добавлено!</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ListView({ words, setWords }) {
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({ ru: '', en: '' });

  const beginEdit = (w) => {
    setEditingId(w.id);
    setEditFields({ ru: w.ru, en: w.en });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFields({ ru: '', en: '' });
  };

  const saveEdit = () => {
    if (!editingId) return;
    const ru = (editFields.ru || '').trim();
    const en = (editFields.en || '').trim();
    if (!ru || !en) {
      // eslint-disable-next-line no-alert
      alert('Оба поля должны быть заполнены');
      return;
    }
    setWords((prev) => prev.map((w) => (w.id === editingId ? { ...w, ru, en } : w)));
    setEditingId(null);
    setEditFields({ ru: '', en: '' });
  };

  const removeWord = (id) => {
    if (editingId === id) cancelEdit();
    setWords((prev) => prev.filter((w) => w.id !== id));
  };

  return (
    <section className="bg-white rounded-2xl shadow p-3 flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-base">{editingId ? 'Редактирование слова' : `Ваши слова (${words.length})`}</h2>
        {editingId && <span className="text-[11px] text-gray-500">Другие записи скрыты на время редактирования</span>}
      </div>

      {!editingId && (
        <div className="mb-3 flex gap-3">
          <button className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm" onClick={() => exportWords(words)}>
            Экспорт слов
          </button>
          <label className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm cursor-pointer">
            Импорт слов
            <input type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImportWordsFactory(words, setWords)} />
          </label>
        </div>
      )}

      {words.length === 0 ? (
        <p className="text-gray-500 text-sm">Пока пусто.</p>
      ) : (
        <div className="overflow-auto no-scrollbar -mx-1 px-1 flex-1 min-h-0">
          <table className="w-full text-xs">
            {!editingId && (
              <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2">RU</th>
                <th className="py-2">EN</th>
                <th className="py-2">Статистика</th>
                <th className="py-2 text-right">Действия</th>
              </tr>
              </thead>
            )}
            <tbody>
            {(editingId ? words.filter((w) => w.id === editingId) : words).map((w) => {
              const isEditing = editingId === w.id;
              if (isEditing) {
                return (
                  <tr key={w.id} className="border-t align-top">
                    <td colSpan={4} className="py-3">
                      <div className="rounded-2xl border p-3 bg-gray-50">
                        <div className="text-xs text-gray-500 mb-2">Редактирование записи</div>
                        <div className="flex flex-col gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Русское слово</label>
                            <input
                              className="w-full border rounded-xl px-3 py-3 text-base md:text-lg"
                              value={editFields.ru}
                              onChange={(e) => setEditFields((f) => ({ ...f, ru: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (editFields.ru || '').trim() && (editFields.en || '').trim()) saveEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              placeholder="Например: кошка"
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Перевод на английский</label>
                            <input
                              className="w-full border rounded-xl px-3 py-3 text-base md:text-lg"
                              value={editFields.en}
                              onChange={(e) => setEditFields((f) => ({ ...f, en: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (editFields.ru || '').trim() && (editFields.en || '').trim()) saveEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              placeholder="Например: cat"
                            />
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <div className="text-[11px] text-gray-500">Подтвердите изменения или отмените редактирование</div>
                            <div className="flex items-center gap-3">
                              <button
                                className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm disabled:opacity-60"
                                onClick={saveEdit}
                                disabled={!((editFields.ru || '').trim() && (editFields.en || '').trim())}
                              >
                                Сохранить
                              </button>
                              <button className="px-4 py-2 rounded-xl bg-gray-200 text-gray-800 text-sm" onClick={cancelEdit}>
                                Отмена
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={w.id} className="border-t align-top">
                  <td className="py-2">{titleCase(w.ru)}</td>
                  <td className="py-2">{titleCase(w.en)}</td>
                  <td className="py-2 text-gray-600">{(w.stats?.correct || 0)}/{(w.stats?.seen || 0)} верных</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-5">
                      <button className="text-blue-600 hover:text-blue-800" title="Редактировать" onClick={() => beginEdit(w)}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="inline w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.828l-4.243 1.414 1.414-4.243a4 4 0 01.828-1.414z" />
                        </svg>
                      </button>
                      <button className="text-red-600 hover:text-red-800" title="Удалить" onClick={() => removeWord(w.id)}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="inline w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M10 3h4a1 1 0 011 1v2H9V4a1 1 0 011-1z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ManualAddWord({ direction, sourceInput, onAdd }) {
  const [val, setVal] = useState('');
  const canAdd = val.trim();

  const handleManualAdd = useCallback(() => {
    if (!canAdd) return;
    if (direction === 'ru2en') onAdd(sourceInput.trim(), val.trim());
    else onAdd(val.trim(), sourceInput.trim());
    setVal('');
  }, [canAdd, direction, onAdd, sourceInput, val]);

  return (
    <div className="mt-2 mb-2">
      <div className="flex gap-2 mb-1">
        <input
          className="flex-1 border rounded-xl px-3 py-2 text-base"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={direction === 'ru2en' ? 'Перевод (EN)' : 'Перевод (RU)'}
          onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
        />
        <button className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm disabled:opacity-50" onClick={handleManualAdd} disabled={!canAdd}>
          Добавить
        </button>
      </div>
      <div className="text-xs text-gray-400">Введите свой вариант, если ни один из предложенных не подходит.</div>
    </div>
  );
}

// -------------------- App --------------------
export default function App() {
  const [tab, setTab] = useState('train');

  // Telegram fullscreen & safe-area
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  // Set --app-vh CSS var for mobile viewport units
  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty('--app-vh', `${window.innerHeight}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    return () => window.removeEventListener('resize', setVh);
  }, []);

  // Persistent data
  const [words, setWords] = useLocalStorage(LS_KEYS.words, []);
  const [progress, setProgress] = useLocalStorage(LS_KEYS.progress, {
    totalAnswered: 0,
    totalCorrect: 0,
    streak: 0,
    history: [],
  });
  const [settings, setSettings] = useLocalStorage(LS_KEYS.settings, { ttsOnReveal: true });

  // Update word stats from TrainView via custom event
  useEffect(() => {
    const handler = (e) => {
      const { index, correct } = e.detail || {};
      setWords((prev) =>
        prev.map((item, i) =>
          i === index
            ? {
              ...item,
              stats: {
                seen: (item.stats?.seen || 0) + 1,
                correct: (item.stats?.correct || 0) + (correct ? 1 : 0),
                wrong: (item.stats?.wrong || 0) + (correct ? 0 : 1),
              },
            }
            : item
        )
      );
      if (settings.ttsOnReveal && prevSafe(words[index]?.en)) {
        ttsSpeak(words[index].en);
      }
    };

    const prevSafe = (v) => typeof v === 'string' && v.trim();

    window.addEventListener('vocaboo:updateWordStats', handler);
    return () => window.removeEventListener('vocaboo:updateWordStats', handler);
  }, [setWords, settings.ttsOnReveal, words]);

  const accuracy = useMemo(() => {
    return progress.totalAnswered ? Math.round((100 * (progress.totalCorrect || 0)) / progress.totalAnswered) : 0;
  }, [progress]);

  return (
    <div
      className="fixed inset-0 bg-gray-50 text-gray-900 select-none flex flex-col"
      style={{
        height: 'var(--app-vh)',
        maxHeight: 'var(--app-vh)',
        overflow: 'hidden',
        paddingTop: 'env(safe-area-inset-top, 20px)',
        paddingBottom: 'env(safe-area-inset-bottom, 20px)',
      }}
    >
      <Header progress={progress} accuracy={accuracy} tab={tab} setTab={setTab} />

      <main
        className="flex-1 min-h-0 pb-[calc(32px+env(safe-area-inset-bottom))] px-3 flex flex-col max-h-[calc(var(--app-vh)-theme(spacing.16))] overflow-hidden"
      >
        <div className="mx-auto flex-1 min-h-0 flex flex-col" style={{ width: '100%', maxWidth: '480px', minHeight: 0 }}>
          {tab === 'train' && <TrainView words={words} progress={progress} setProgress={setProgress} />}
          {tab === 'add' && <AddView words={words} setWords={setWords} />}
          {tab === 'list' && <ListView words={words} setWords={setWords} />}
        </div>
      </main>

      {/* Settings footer (optional toggle) */}
      <div className="fixed right-3 bottom-3 bg-white/90 backdrop-blur rounded-2xl shadow border p-3">
        <Toggle label="Озвучивать правильный ответ" checked={settings.ttsOnReveal} onChange={(v) => setSettings((s) => ({ ...s, ttsOnReveal: v }))} />
      </div>
    </div>
  );
}
