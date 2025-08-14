import React, { useEffect, useMemo, useState } from "react";

// React App — Russian↔English Trainer (single-file)
// -------------------------------------------------
// ✓ Добавление слов одним нажатием: RU→EN и EN→RU
// ✓ Тренировка карточками с картинкой (Wikimedia), TTS, прогресс
// ✓ Мобильная адаптация, localStorage
// ✓ Если ответ верный — автоматический переход к следующей карточке
// ✓ Защита от падений: валидируем URL изображений, проверяем индексы/очередь
// ✓ Мини «тесты» через console.assert
// ✓ Редактирование слов — ТОЛЬКО в разделе «Список». В «Словарь» кнопки редактирования нет.

// -------------------- Utils & Storage --------------------
const LS_KEYS = {
  words: "ruen_words_v1",
  progress: "ruen_progress_v1",
  settings: "ruen_settings_v1",
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
  return xs.filter(Boolean).join(" ");
}

function prettyDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString();
}

function isValidHttpUrl(u) {
  if (typeof u !== "string") return false;
  const s = u.trim();
  if (!s) return false;
  try {
    const url = new URL(s);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalize(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .trim()
    .split("ё").join("е");
}

// -------------------- APIs --------------------
async function fetchTranslations(query, from = "ru", to = "en") {
  if (!query || !query.trim()) return [];
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
    query
  )}&langpair=${from}|${to}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const suggestions = new Set();
    if (data?.responseData?.translatedText) suggestions.add(data.responseData.translatedText);
    if (Array.isArray(data?.matches)) {
      data.matches.forEach((m) => m?.translation && suggestions.add(m.translation));
    }
    return Array.from(suggestions)
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean)
      .slice(0, 10);
  } catch (e) {
    console.warn("Translation fetch failed", e);
    return [];
  }
}

async function fetchImageForWord(enWord) {
  const term = (enWord || "").toString().trim();
  if (!term) return null;
  const q = encodeURIComponent(term);
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=600&format=json&origin=*&generator=search&gsrsearch=${q}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
    const withThumb = pages.filter((p) => p?.thumbnail?.source);
    if (withThumb.length > 0) {
      const src = withThumb[0].thumbnail.source;
      return isValidHttpUrl(src) ? src : null;
    }
  } catch (e) {
    console.warn("Image fetch failed", e);
  }
  return null;
}

function ttsSpeak(word, rate = 0.95) {
  try {
    if (!("speechSynthesis" in window)) return;
    const utt = new SpeechSynthesisUtterance(word || "");
    utt.lang = "en-US";
    utt.rate = rate;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const voice = voices.find((v) => /en-/i.test(v?.lang || ""));
    if (voice) utt.voice = voice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  } catch {}
}

function safeUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).substr(2, 9);
}


// -------------------- App --------------------
export default function App() {
  const [tab, setTab] = useState("add");
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();   // Сообщаем Telegram, что страница загрузилась
      tg.expand();  // Разворачиваем на весь экран
    }
  }, []);

  // Data
  const [words, setWords] = useLocalStorage(LS_KEYS.words, []);
  const [progress, setProgress] = useLocalStorage(LS_KEYS.progress, {
    totalAnswered: 0,
    totalCorrect: 0,
    streak: 0,
    history: [],
  });
  const [settings, setSettings] = useLocalStorage(LS_KEYS.settings, {
    ttsOnReveal: true,
  });

  // Add/Lookup state
  const [direction, setDirection] = useState("ru2en"); // 'ru2en' | 'en2ru'
  const [sourceInput, setSourceInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  // Train state
  const [queue, setQueue] = useState([]); // indices of words
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [cardImg, setCardImg] = useState(""); // always string
  const [isFetchingImg, setIsFetchingImg] = useState(false);

  // List editing state (только для раздела «Список»)
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({ ru: "", en: "" });

  // -------------------- Dev Mini-Tests --------------------
  useEffect(() => {
    console.group("Mini tests");
    console.assert(normalize(" Кот ") === "кот", "normalize trims+lowercases");
    console.assert(isValidHttpUrl("https://example.com/a.jpg") === true, "valid URL ok");
    console.assert(isValidHttpUrl("") === false, "empty URL invalid");
    console.assert(Array.isArray([]) && Array.isArray(words) !== undefined, "arrays ok");
    // edit tests
    const tmp = [{ id: "1", ru: "кот", en: "cat", addedAt: 1, stats: { seen: 0, correct: 0, wrong: 0 } }];
    const updated = tmp.map((w) => (w.id === "1" ? { ...w, ru: "кошка", en: "cat" } : w));
    console.assert(updated[0].ru === "кошка" && updated.length === 1, "edit mapping ok");
    console.groupEnd();
  }, []);

  // -------------------- Effects --------------------
  // Prepare queue when switching to train (or words changed while on train)
  useEffect(() => {
    if (tab !== "train") return;
    if (!Array.isArray(words) || words.length === 0) return;
    const idxs = words.map((_, i) => i).sort(() => Math.random() - 0.5);
    setQueue(idxs);
    setCurrentIdx(0);
    setUserAnswer("");
    setRevealed(false);
  }, [tab, words.length]);

  // Fetch image for current English word
  useEffect(() => {
    if (tab !== "train") return;
    if (!Array.isArray(queue) || queue.length === 0) return;
    const idx = queue[currentIdx];
    if (typeof idx !== "number") return;
    const w = words[idx];
    if (!w || !w.en) return;
    let aborted = false;
    (async () => {
      setIsFetchingImg(true);
      try {
        const img = await fetchImageForWord(w.en);
        if (!aborted) setCardImg(isValidHttpUrl(img) ? img : "");
      } finally {
        if (!aborted) setIsFetchingImg(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [tab, currentIdx, queue, words]);

  // -------------------- Actions --------------------
  async function handleSearch() {
    const q = sourceInput.trim();
    if (!q) return;
    setLoading(true);
    const from = direction === "ru2en" ? "ru" : "en";
    const to = direction === "ru2en" ? "en" : "ru";
    const s = await fetchTranslations(q, from, to);
    setSuggestions(s);
    setLoading(false);
  }

  function handleSelectSuggestion(s) {
    const q = sourceInput.trim();
    if (!q || !s) return;
    const ru = direction === "ru2en" ? q : s;
    const en = direction === "ru2en" ? s : q;
    const newItem = {
      id: safeUUID(),
      ru,
      en,
      addedAt: Date.now(),
      stats: { seen: 0, correct: 0, wrong: 0 },
    };
    setWords([newItem, ...words]);
  }

  function removeWord(id) {
    // If deleting currently edited item, cancel edit
    if (editingId === id) {
      setEditingId(null);
      setEditFields({ ru: "", en: "" });
    }
    setWords(words.filter((w) => w.id !== id));
  }

  function beginEdit(w) {
    setEditingId(w.id);
    setEditFields({ ru: w.ru, en: w.en });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditFields({ ru: "", en: "" });
  }

  function saveEdit() {
    if (!editingId) return;
    const ru = (editFields.ru || "").trim();
    const en = (editFields.en || "").trim();
    if (!ru || !en) {
      alert("Оба поля должны быть заполнены");
      return;
    }
    const updated = words.map((w) => (w.id === editingId ? { ...w, ru, en } : w));
    setWords(updated);
    setEditingId(null);
    setEditFields({ ru: "", en: "" });
  }

  function checkAnswer() {
    if (!Array.isArray(queue) || queue.length === 0) return;
    if (!Array.isArray(words) || words.length === 0) return;
    const idx = queue[currentIdx];
    if (typeof idx !== "number" || idx < 0 || idx >= words.length) return;
    const w = words[idx];
    if (!w) return;

    const correct = normalize(userAnswer) === normalize(w.en);

    const updated = words.map((item, i) =>
      i === idx
        ? {
          ...item,
          stats: {
            seen: (item.stats?.seen || 0) + 1,
            correct: (item.stats?.correct || 0) + (correct ? 1 : 0),
            wrong: (item.stats?.wrong || 0) + (correct ? 0 : 1),
          },
        }
        : item
    );
    setWords(updated);

    const newHist = [...(progress.history || []).slice(-199), { ts: Date.now(), correct }];
    setProgress({
      totalAnswered: (progress.totalAnswered || 0) + 1,
      totalCorrect: (progress.totalCorrect || 0) + (correct ? 1 : 0),
      streak: correct ? (progress.streak || 0) + 1 : 0,
      history: newHist,
    });

    if (settings.ttsOnReveal) ttsSpeak(w.en);

    if (correct) {
      setUserAnswer("");
      setRevealed(false);
      if (currentIdx + 1 < queue.length) setCurrentIdx(currentIdx + 1);
      else {
        const idxs = words.map((_, i) => i).sort(() => Math.random() - 0.5);
        setQueue(idxs);
        setCurrentIdx(0);
      }
    } else {
      setRevealed(true);
    }
  }

  const accuracy = useMemo(() => {
    return progress.totalAnswered
      ? Math.round((100 * (progress.totalCorrect || 0)) / progress.totalAnswered)
      : 0;
  }, [progress]);

  const hasValidImg = isValidHttpUrl(cardImg);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <header className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur mb-4 pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="text-2xl sm:text-3xl font-bold">Vocaboo</h1>
            <div className="flex gap-2 items-center flex-wrap">
              <StatsBadge label="Ответов" value={progress.totalAnswered} />
              <StatsBadge label="Точность" value={`${accuracy}%`} />
              <StatsBadge label="Серия" value={progress.streak} />
            </div>
          </div>

          <nav className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
            <TabButton active={tab === "add"} onClick={() => setTab("add")}>Словарь</TabButton>
            <TabButton active={tab === "train"} onClick={() => setTab("train")}>Тренировка</TabButton>
            <TabButton active={tab === "list"} onClick={() => setTab("list")}>Список</TabButton>
            <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>Настройки</TabButton>
          </nav>
        </header>

        {tab === "add" && (
          <section className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow p-4 sm:p-5">
              <h2 className="font-semibold mb-3">Добавить слово одним нажатием</h2>

              <div className="flex flex-wrap gap-2 mb-3">
                <DirectionButton label="RU→EN" active={direction === "ru2en"} onClick={() => { setDirection("ru2en"); setSuggestions([]); }} />
                <DirectionButton label="EN→RU" active={direction === "en2ru"} onClick={() => { setDirection("en2ru"); setSuggestions([]); }} />
              </div>

              <label className="block text-sm mb-1">
                {direction === "ru2en" ? "Исходное слово по‑русски" : "Source word in English"}
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  className="flex-1 border rounded-xl px-3 py-3 text-base"
                  value={sourceInput}
                  onChange={(e) => setSourceInput(e.target.value)}
                  placeholder={direction === "ru2en" ? "например: кошка" : "e.g., cat"}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  className={classNames(
                    "px-4 py-3 rounded-xl bg-blue-600 text-white text-base",
                    loading && "opacity-60"
                  )}
                  disabled={loading}
                >
                  {loading ? "Ищу…" : "Подобрать"}
                </button>
              </div>

              {suggestions.length > 0 && (
                <div className="mb-1 text-sm text-gray-500">
                  Нажмите на перевод, чтобы сразу сохранить его в словарь:
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSelectSuggestion(s)}
                    className="px-3 py-2 rounded-full border hover:bg-gray-50 active:scale-[.98]"
                  >
                    {s}
                  </button>
                ))}
              </div>

              <p className="text-xs text-gray-500 mt-4">
                Подсказка: можно несколько раз нажимать «Подобрать», меняя исходное слово, и кликать на подходящие варианты — они сразу добавятся.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow p-4 sm:p-5">
              <h2 className="font-semibold mb-3">Недавно добавленные</h2>
              {words.length === 0 ? (
                <p className="text-gray-500">Пока пусто. Добавьте первое слово.</p>
              ) : (
                <ul className="space-y-2 max-h-80 overflow-auto pr-2 -mr-2">
                  {words.slice(0, 12).map((w) => (
                    <li key={w.id} className="flex items-center justify-between gap-2 border rounded-xl px-3 py-2">
                      <div>
                        <div className="font-medium text-base">{w.ru}</div>
                        <div className="text-sm text-gray-600">{w.en}</div>
                        <div className="text-xs text-gray-400">{prettyDate(w.addedAt)}</div>
                      </div>
                      {/* В разделе «Словарь» — только удаление, без редактирования */}
                      <div className="flex gap-3">
                        <button className="text-red-600 text-sm hover:underline" onClick={() => removeWord(w.id)}>Удалить</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {tab === "train" && (
          <section className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4 sm:p-5 flex flex-col items-center">
              {!words.length ? (
                <div className="text-gray-500">Нет слов для тренировки. Добавьте слова в разделе «Словарь».</div>
              ) : (
                <>
                  <div className="w-full flex items-center justify-between mb-3">
                    <div className="text-sm text-gray-500">Карточка {Array.isArray(queue) && queue.length ? currentIdx + 1 : 0} / {Array.isArray(queue) ? queue.length : 0}</div>
                    <button
                      className="text-sm text-blue-700 hover:underline"
                      onClick={() => {
                        if (!Array.isArray(queue) || queue.length === 0) return;
                        const idx = queue[currentIdx];
                        const w = words[idx];
                        if (w?.en) ttsSpeak(w.en);
                      }}
                    >🔊 Озвучить</button>
                  </div>

                  <div className="w-full max-w-xl aspect-[4/3] bg-gray-100 rounded-2xl overflow-hidden flex items-center justify-center mb-4">
                    {isFetchingImg ? (
                      <div className="text-gray-400">Ищу картинку…</div>
                    ) : hasValidImg ? (

                      <img
                        src={cardImg}
                        alt="Illustration"
                        className="max-w-full max-h-full object-contain"
                        onError={() => setCardImg("")}
                      />
                    ) : (
                      <div className="text-7xl">🧠</div>
                    )}
                  </div>

                  {Array.isArray(queue) && queue.length > 0 && typeof queue[currentIdx] === "number" && words[queue[currentIdx]] && (
                    <>
                      <div className="text-center mb-2">
                        <div className="text-sm text-gray-500 mb-1">Переведите на английский:</div>
                        <div className="text-2xl font-semibold">{words[queue[currentIdx]].ru}</div>
                      </div>

                      <div className="flex gap-2 w-full max-w-xl">
                        <input
                          className="flex-1 border rounded-xl px-3 py-3 text-base"
                          placeholder="Ваш ответ на английском"
                          value={userAnswer}
                          onChange={(e) => setUserAnswer(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && checkAnswer()}
                        />
                        <button className="px-4 py-3 rounded-xl bg-blue-600 text-white text-base" onClick={checkAnswer}>
                          Проверить
                        </button>
                      </div>

                      {revealed && (
                        <RevealPanel correctAnswer={words[queue[currentIdx]].en} userAnswer={userAnswer} />
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow p-4 sm:p-5">
              <h3 className="font-semibold mb-2">Прогресс</h3>
              <ProgressBar label="Точность" pct={accuracy} />
              <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                <MiniStat label="Всего слов" value={words.length} />
                <MiniStat label="Ответов" value={progress.totalAnswered} />
                <MiniStat label="Верных" value={progress.totalCorrect} />
              </div>

              <h4 className="font-semibold mt-6 mb-2">Советы</h4>
              <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                <li>Жмите 🔊, чтобы услышать правильное произношение.</li>
                <li>Отвечайте вслух — лучше закрепляется.</li>
                <li>Добавляйте собственные ассоциации к словам.</li>
              </ul>
            </div>
          </section>
        )}

        {tab === "list" && (
          <section className="bg-white rounded-2xl shadow p-4 sm:p-5">
            <h2 className="font-semibold mb-3">Ваши слова ({words.length})</h2>
            {words.length === 0 ? (
              <p className="text-gray-500">Пока пусто.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2">RU</th>
                  <th className="py-2">EN</th>
                  <th className="py-2">Статистика</th>
                  <th className="py-2">Добавлено</th>
                  <th className="py-2 text-right">Действия</th>
                </tr>
                </thead>
                <tbody>
                {words.map((w) => {
                  const isEditing = editingId === w.id;
                  return (
                    <tr key={w.id} className="border-t align-top">
                      <td className="py-2">
                        {isEditing ? (
                          <input
                            className="w-full border rounded-lg px-2 py-1"
                            value={editFields.ru}
                            onChange={(e) => setEditFields({ ...editFields, ru: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                          />
                        ) : (
                          w.ru
                        )}
                      </td>
                      <td className="py-2">
                        {isEditing ? (
                          <input
                            className="w-full border rounded-lg px-2 py-1"
                            value={editFields.en}
                            onChange={(e) => setEditFields({ ...editFields, en: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                          />
                        ) : (
                          w.en
                        )}
                      </td>
                      <td className="py-2 text-gray-600">{(w.stats?.correct || 0)}/{(w.stats?.seen || 0)} верных</td>
                      <td className="py-2 text-gray-600">{prettyDate(w.addedAt)}</td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {!isEditing ? (
                          <>
                            <button className="text-blue-600 hover:underline mr-3" onClick={() => beginEdit(w)}>Редактировать</button>
                            <button className="text-red-600 hover:underline" onClick={() => removeWord(w.id)}>Удалить</button>
                          </>
                        ) : (
                          <>
                            <button className="text-green-700 hover:underline mr-3" onClick={saveEdit}>Сохранить</button>
                            <button className="text-gray-600 hover:underline" onClick={cancelEdit}>Отмена</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            )}
          </section>
        )}

        {tab === "settings" && (
          <section className="bg-white rounded-2xl shadow p-4 sm:p-5 max-w-xl">
            <h2 className="font-semibold mb-3">Настройки</h2>
            <Toggle label="Озвучивать слово после проверки" checked={!!settings.ttsOnReveal} onChange={(v) => setSettings({ ...settings, ttsOnReveal: v })} />
            <button
              className="mt-6 px-4 py-3 rounded-xl bg-red-600 text-white"
              onClick={() => {
                // eslint-disable-next-line no-restricted-globals
                if (confirm("Удалить все слова и прогресс?")) {
                  localStorage.removeItem(LS_KEYS.words);
                  localStorage.removeItem(LS_KEYS.progress);
                  window.location.reload();
                }
              }}
            >Сбросить всё</button>
          </section>
        )}

        <footer className="mt-10 text-center text-xs text-gray-400 pb-6">
          © {new Date().getFullYear()} MiniTrainer — локальное хранилище, без серверной части.
        </footer>
      </div>
    </div>
  );
}

// -------------------- Small UI Components --------------------
function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        "px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl border whitespace-nowrap",
        active ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-50"
      )}
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
        "px-3 py-2 rounded-xl border",
        active ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-50"
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function StatsBadge({ label, value }) {
  return (
    <div className="px-3 py-1.5 rounded-full bg-white shadow border text-sm">
      <span className="text-gray-500 mr-1">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function ProgressBar({ label, pct }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-green-500" style={{ width: `${pct}%`, transition: "width .4s" }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="p-3 rounded-xl bg-gray-50 border text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none py-2">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer hidden"
      />
      <span className="w-10 h-6 flex items-center bg-gray-300 rounded-full relative after:content-[''] after:absolute after:w-5 after:h-5 after:bg-white after:rounded-full after:left-0.5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-4" />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function RevealPanel({ correctAnswer, userAnswer }) {
  const isCorrect = useMemo(() => {
    const n = (s) => (s || "").toString().toLowerCase().trim();
    return n(correctAnswer) === n(userAnswer);
  }, [correctAnswer, userAnswer]);
  return (
    <div className={classNames(
      "mt-3 w-full max-w-xl rounded-xl border p-3",
      isCorrect ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
    )}
    >
      <div className="text-sm text-gray-600 mb-1">Правильный ответ:</div>
      <div className="text-xl font-semibold">{correctAnswer}</div>
      {!isCorrect && (
        <div className="mt-1 text-sm text-gray-700">Ваш ответ: <span className="font-medium">{userAnswer || "—"}</span></div>
      )}
      <div className="mt-2 text-xs text-gray-500">Нажмите «Далее →» для следующей карточки.</div>
    </div>
  );
}
