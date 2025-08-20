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
