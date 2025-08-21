import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HiDownload, HiUpload } from 'react-icons/hi';
import { titleCase } from '../utils/strings.js';
import { EVT_EDITING_ON, EVT_EDITING_OFF } from '../utils/events.js';
import { exportWords, handleImportWordsFactory } from '../services/words-exporter.js';

export default function ListView({ words, setWords }) {
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({ ru: '', en: '' });

  // Признак открытой клавиатуры и величина перекрытия
  const [isKbOpen, setIsKbOpen] = useState(false);
  const [kbInset, setKbInset] = useState(0);

  // Высота панели действий (нужна для спейсера)
  const barRef = useRef(null);
  const [barHeight, setBarHeight] = useState(64);

  useEffect(() => {
    if (editingId) window.dispatchEvent(new Event(EVT_EDITING_ON));
    else window.dispatchEvent(new Event(EVT_EDITING_OFF));
  }, [editingId]);

  // Отслеживаем клавиатуру через visualViewport
  useEffect(() => {
    if (!editingId) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      // Насколько визуальный вьюпорт “сжат” клавиатурой
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbInset(overlap);
      setIsKbOpen(overlap > 140); // эвристика
    };

    onResize();
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize); // на iOS при зуме/скролле смещается offsetTop
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, [editingId]);

  // Обновляем высоту панели после рендера
  useEffect(() => {
    if (barRef.current) {
      setBarHeight(barRef.current.offsetHeight || 64);
    }
  }, [isKbOpen, editFields]);

  const beginEdit = (w) => {
    setEditingId(w.id);
    setEditFields({ ru: w.ru, en: w.en });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFields({ ru: '', en: '' });
    setIsKbOpen(false);
    setKbInset(0);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const ru = (editFields.ru || '').trim();
    const en = (editFields.en || '').trim();
    if (!ru || !en) {
      alert('Оба поля должны быть заполнены');
      return;
    }
    setWords((prev) => prev.map((w) => (w.id === editingId ? { ...w, ru, en } : w)));
    cancelEdit();
  };

  const removeWord = (id) => {
    if (editingId === id) cancelEdit();
    setWords((prev) => prev.filter((w) => w.id !== id));
  };

  const wordsCount = useMemo(() => words.length, [words]);

  return (
    <section
      className="
        bg-white rounded-2xl shadow
        p-2 sm:p-6
        max-w-xl w-full mx-auto
        mt-3
      "
    >
      {/* Хедер */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-base sm:text-lg">
          {editingId ? 'Редактирование слова' : `Ваши слова (${wordsCount})`}
        </h2>
      </div>

      {/* Импорт / Экспорт */}
      {!editingId && (
        <div className="mb-4 flex flex-row gap-2 items-center">
          <button
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm hover:bg-green-700 active:scale-[0.99] transition"
            onClick={() => exportWords(words)}
          >
            <HiDownload className="w-4 h-4" />
            <span>Экспорт слов</span>
          </button>

          <label className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm cursor-pointer hover:bg-blue-700 active:scale-[0.99] transition">
            <HiUpload className="w-4 h-4" />
            <span>Импорт слов</span>
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportWordsFactory(words, setWords)}
            />
          </label>
        </div>
      )}

      {/* Пустой список */}
      {wordsCount === 0 ? (
        <p className="text-gray-500 text-sm">Пока пусто.</p>
      ) : (
        <>
          {editingId ? (
            /* Режим редактирования */
            <div className="rounded-2xl border border-gray-200 bg-gray-50">
              <div className="px-3 sm:px-4 pt-3 sm:pt-4">
                <div className="text-xs text-gray-500 mb-3">Редактирование записи</div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Русское слово</label>
                    <input
                      className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base md:text-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                      value={editFields.ru}
                      onChange={(e) => setEditFields((f) => ({ ...f, ru: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editFields.ru.trim() && editFields.en.trim()) saveEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      placeholder="Например: кошка"
                      autoFocus
                      onFocus={(e) => {
                        try {
                          e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        } catch {}
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Перевод на английский</label>
                    <input
                      className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base md:text-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                      value={editFields.en}
                      onChange={(e) => setEditFields((f) => ({ ...f, en: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editFields.ru.trim() && editFields.en.trim()) saveEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      placeholder="Например: cat"
                      onFocus={(e) => {
                        try {
                          e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        } catch {}
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Если панель fixed — добавляем спейсер, чтобы её не перекрывал контент */}
              {isKbOpen && <div style={{ height: barHeight + 8 }} />}

              {/* Панель действий: sticky в норме, fixed при открытой клавиатуре */}
              <div
                ref={barRef}
                className={
                  isKbOpen
                    ? // Фиксируем ко дну видимой области
                    'fixed inset-x-0 z-40'
                    : // Обычный режим — прилипает к низу контейнера
                    'sticky bottom-0'
                }
                style={
                  isKbOpen
                    ? {
                      // Ставим ровно поверх клавиатуры
                      bottom: `calc(${kbInset}px)`,
                      // фон и отступы
                    }
                    : undefined
                }
              >
                <div
                  className="
                    mt-4
                    px-3 sm:px-4
                    bg-gray-50/95 backdrop-blur
                    border-t border-gray-200
                    max-w-xl mx-auto rounded-b-2xl
                  "
                  style={{
                    paddingBottom: isKbOpen
                      ? 'max(env(safe-area-inset-bottom), 8px)'
                      : 'max(env(safe-area-inset-bottom), 12px)',
                    paddingTop: 12,
                  }}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <button
                        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-green-600 text-white text-sm disabled:opacity-60 hover:bg-green-700 transition"
                        onClick={saveEdit}
                        disabled={!(editFields.ru.trim() && editFields.en.trim())}
                      >
                        Сохранить
                      </button>
                      <button
                        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gray-200 text-gray-800 text-sm hover:bg-gray-300 transition"
                        onClick={cancelEdit}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Режим списка (как было), без таблицы */
            <div
              className="
                overflow-y-auto overflow-x-hidden no-scrollbar
                rounded-2xl border border-gray-200
                divide-y divide-gray-100
              "
              style={{ maxHeight: '67svh' }}
              role="list"
              aria-label="Список слов"
            >
              {words.map((w) => (
                <div
                  key={w.id}
                  role="listitem"
                  className="flex items-start justify-between gap-3 px-3 sm:px-4 py-2"
                >
                  {/* Текстовая часть */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
                      <span className="font-medium break-words">{titleCase(w.ru)}</span>
                      <span className="text-gray-700 break-words">{titleCase(w.en)}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {(w.stats?.correct || 0)}/{(w.stats?.seen || 0)} верных
                    </div>
                  </div>

                  {/* Действия */}
                  <div className="shrink-0 flex items-center gap-7">
                    <button
                      className="text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded-md px-1"
                      title="Редактировать"
                      aria-label="Редактировать"
                      onClick={() => beginEdit(w)}
                    >
                      ✏️
                    </button>
                    <button
                      className="text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500/30 rounded-md px-1"
                      title="Удалить"
                      aria-label="Удалить"
                      onClick={() => removeWord(w.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
