export async function fetchTranslationsOnce(query, from = 'ru', to = 'en', signal) {
  if (!query || !query.trim()) return [];
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
    query
  )}&langpair=${from}|${to}`;
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
