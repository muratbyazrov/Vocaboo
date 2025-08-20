import { isValidHttpUrl } from '../utils/url.js';

// --- Pexels ---
async function fetchImageFromPexels(enWord, apiKey, signal) {
  const term = (enWord || '').toString().trim();
  if (!term || !apiKey) return null;
  const q = encodeURIComponent(term);
  // orientation=square как в твоём коде, можно заменить на landscape под 3:2
  const url = `https://api.pexels.com/v1/search?query=${q}&per_page=1&orientation=square`;
  try {
    const res = await fetch(url, { signal, headers: { Authorization: apiKey } });
    if (!res.ok) throw new Error(`Pexels ${res.status}`);
    const data = await res.json();
    const photo = Array.isArray(data?.photos) ? data.photos[0] : null;
    const src = photo?.src?.large || photo?.src?.medium || photo?.src?.original;
    return isValidHttpUrl(src) ? src : null;
  } catch (e) {
    if (e?.name !== 'AbortError') console.warn('Pexels fetch failed', e);
    return null;
  }
}

/**
 * Универсальный резолвер картинки для слова
 * settingsOrKey: можно передать строку API-ключа или объект настроек,
 * а по-хорошему взять из ENV: import.meta.env.VITE_PEXELS_API_KEY
 */
export async function fetchImageForWord(enWord, settingsOrKey, signal) {
  // 1) ENV ключ (Vite), иначе 2) прямой ключ строкой, иначе 3) settings.apiKey
  const envKey = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_PEXELS_API_KEY : undefined;
  const apiKey =
    envKey ||
    (typeof settingsOrKey === 'string' ? settingsOrKey : settingsOrKey?.pexelsApiKey) ||
    'zLDphsYbo4jH1CPnYrCmS5rP7XegY2OSItFmZJEcavjbfnPHAYCsaMHN'; // твой текущий ключ из кода

  return fetchImageFromPexels(enWord, apiKey, signal);
}

// --- простые хелперы экспорта/импорта чтобы не плодить файл ---
export function exportWords(words) {
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
    alert('Ошибка экспорта');
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
