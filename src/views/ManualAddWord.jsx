import React, { useCallback, useState } from 'react';

export default function ManualAddWord({ direction, sourceInput, onAdd }) {
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
        <button
          className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm disabled:opacity-50"
          onClick={handleManualAdd}
          disabled={!canAdd}
        >
          Добавить
        </button>
      </div>
      <div className="text-xs text-gray-400">
        Введите свой вариант, если ни один из предложенных не подходит.
      </div>
    </div>
  );
}
