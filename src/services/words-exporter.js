export async function exportWords(words) {
  const filename = 'vocaboo_words.json';
  const json = JSON.stringify(words ?? [], null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  // 1) Современный способ: системный диалог "Сохранить как..."
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return; // пользователь отменил
      // падём в фолбэк
    }
  }

  // 2) Мобильный способ: системное "Поделиться" файлом (если поддерживается)
  try {
    const file = new File([blob], filename, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Vocaboo export' });
      return;
    }
  } catch { /* игнор, пойдём дальше */ }

  // 3) Классика: <a download> + ObjectURL
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { document.body.removeChild(a); } catch {}
      URL.revokeObjectURL(url);
    }, 1000);
    return;
  } catch { /* игнор, пойдём дальше */ }

  // 4) Жёсткий фолбэк для строгих WebView (например, внутри Telegram)
  try {
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    const w = window.open(dataUrl, '_blank');
    if (!w) alert('Сохранение заблокировано браузером. Разрешите всплывающие окна и попробуйте снова.');
  } catch {
    alert('Не удалось сохранить файл. Скопируйте содержимое вручную:\n' + json);
  }
}

export function handleImportWordsFactory(words, setWords) {
  return function handleImportWords(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!Array.isArray(imported)) throw new Error('Некорректный формат файла');
        const existById = new Set(words.map((w) => w.id));
        const existByPair = new Set(
          words.map((w) => `${(w.ru || '').toLowerCase()}|${(w.en || '').toLowerCase()}`)
        );
        const fresh = imported.filter((w) => {
          if (!w || !w.id || !w.ru || !w.en) return false;
          const pair = `${(w.ru || '').toLowerCase()}|${(w.en || '').toLowerCase()}`;
          return !existById.has(w.id) && !existByPair.has(pair);
        });
        setWords((prev) => [...fresh, ...prev]);
        alert(`Импортировано слов: ${fresh.length}`);
      } catch (err) {
        alert('Ошибка импорта: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
}
