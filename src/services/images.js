import {isValidHttpUrl} from '../utils/url.js';

// --- Pexels ---
async function fetchImageFromPexels(enWord, apiKey, signal) {
  const term = (enWord || '').toString().trim();
  if (!term || !apiKey) return null;

  const base = 'https://api.pexels.com/v1/search';
  const headers = { Authorization: apiKey };

  // сначала самое строгое условие, потом слабее и слабее
  const attempts = [
    `${base}?query=${encodeURIComponent(term)}&per_page=12&orientation=square`,     // 1. нужно квадратное
    `${base}?query=${encodeURIComponent(term)}&per_page=12&orientation=landscape`, // 2. ок, возьмем landscape
    `${base}?query=${encodeURIComponent(term)}&per_page=12&orientation=portrait`,  // 3. портретка
    `${base}?query=${encodeURIComponent(term)}&per_page=12`,                       // 4. вообще без ограничений
  ];

  const pickSrc = (src) =>
    src?.large ||
    src?.medium ||
    src?.landscape ||
    src?.portrait ||
    src?.original ||
    src?.tiny ||
    null;

  for (const url of attempts) {
    try {
      const res = await fetch(url, { signal, headers });
      if (!res.ok) {
        console.warn(`Pexels error ${res.status}`);
        continue;
      }
      const data = await res.json();
      const photos = Array.isArray(data?.photos) ? data.photos : [];
      for (const p of photos) {
        const src = pickSrc(p?.src);
        if (isValidHttpUrl(src)) return src;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return null;
      console.warn('Pexels fetch failed', e);
    }
  }

  return null;
}


/**
 * Универсальный резолвер картинки для слова
 * settingsOrKey: можно передать строку API-ключа или объект настроек,
 * а по-хорошему взять из ENV: import.meta.env.VITE_PEXELS_API_KEY
 */
export async function fetchImageForWord(enWord, settingsOrKey, signal) {
  const apiKey = 'zLDphsYbo4jH1CPnYrCmS5rP7XegY2OSItFmZJEcavjbfnPHAYCsaMHN'; // твой текущий ключ из кода

  return fetchImageFromPexels(enWord, apiKey, signal);
}
