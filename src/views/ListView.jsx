import React, { useEffect, useState } from 'react';
import { titleCase } from '../utils/strings.js';
import { EVT_EDITING_ON, EVT_EDITING_OFF } from '../utils/events.js';
import { exportWords, handleImportWordsFactory } from '../services/images.js'; // reusing export/import here

export default function ListView({ words, setWords }) {
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({ ru: '', en: '' });

  useEffect(() => {
    if (editingId) window.dispatchEvent(new Event(EVT_EDITING_ON));
    else window.dispatchEvent(new Event(EVT_EDITING_OFF));
  }, [editingId]);

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

  return (
    <section className="bg-white rounded-2xl shadow p-3 flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-base">
          {editingId ? 'Редактирование слова' : `Ваши слова (${words.length})`}
        </h2>
        {editingId && (
          <span className="text-[11px] text-gray-500">Другие записи скрыты на время редактирования</span>
        )}
      </div>

      {!editingId && (
        <div className="mb-3 flex gap-3">
          <button className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm" onClick={() => exportWords(words)}>
            Экспорт слов
          </button>
          <label className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm cursor-pointer">
            Импорт слов
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={handleImportWordsFactory(words, setWords)}
            />
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
                                if (e.key === 'Enter' && editFields.ru.trim() && editFields.en.trim()) saveEdit();
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
                                if (e.key === 'Enter' && editFields.ru.trim() && editFields.en.trim()) saveEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              placeholder="Например: cat"
                            />
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <div className="text-[11px] text-gray-500">
                              Подтвердите изменения или отмените редактирование
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm disabled:opacity-60"
                                onClick={saveEdit}
                                disabled={!(editFields.ru.trim() && editFields.en.trim())}
                              >
                                Сохранить
                              </button>
                              <button
                                className="px-4 py-2 rounded-xl bg-gray-200 text-gray-800 text-sm"
                                onClick={cancelEdit}
                              >
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
                  <td className="py-2 text-gray-600">
                    {(w.stats?.correct || 0)}/{(w.stats?.seen || 0)} верных
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-5">
                      <button
                        className="text-blue-600 hover:text-blue-800"
                        title="Редактировать"
                        onClick={() => beginEdit(w)}
                      >
                        ✏️
                      </button>
                      <button
                        className="text-red-600 hover:text-red-800"
                        title="Удалить"
                        onClick={() => removeWord(w.id)}
                      >
                        🗑️
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
