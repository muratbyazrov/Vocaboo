export async function fetchTranslationsOnce(query, from = 'ru', to = 'en', signal) {
  const raw = (query || '').trim();
  if (!raw) return [];

  const singleWord = !/\s/.test(raw);
  const url =
    `https://api.mymemory.translated.net/get` +
    `?q=${encodeURIComponent(raw)}` +
    `&langpair=${from}|${to}` +
    `&of=json`; // явный JSON

  try {
    const res = await fetch(url, { signal /*, headers: {'User-Agent': 'Vocaboo/1.0'}*/ });
    if (!res.ok) return [];
    const data = await res.json();

    // Собираем кандидаты
    const candidates = [];

    const pushCandidate = (t, meta = {}) => {
      if (typeof t !== 'string') return;
      let s = t.trim();

      // Базовая нормализация
      s = s.replace(/^["'«»„“”]+|["'«»„“”]+$/g, ''); // обрезать кавычки
      s = s.replace(/\s+/g, ' ').trim();
      if (!s) return;

      // Жёсткие фильтры для одиночных слов
      if (singleWord) {
        if (/\s/.test(s)) return;           // выкинуть фразы
        if (/[.,!?;:/()[\]{}]/.test(s)) return; // убрать пунктуацию
        if (s.length > 24) return;          // защитный лимит
      }

      candidates.push({ text: s, ...meta });
    };

    if (data?.responseData?.translatedText) {
      pushCandidate(data.responseData.translatedText, { source: 'responseData', match: 1, quality: 100 });
    }

    if (Array.isArray(data?.matches)) {
      for (const m of data.matches) {
        pushCandidate(m?.translation, {
          source: 'matches',
          match: typeof m?.match === 'number' ? m.match : 0,
          quality: typeof m?.quality === 'number' ? m.quality : 0,
          createdBy: m?.created_by || m?.createdBy,
        });
      }
    }

    // Скоpинг: комбинируем match + quality + бонусы/штрафы
    const scoreOf = (c) => {
      let score = 0;
      score += (c.match || 0) * 2;           // match весим сильнее
      score += (c.quality || 0) / 100;       // quality 0..1

      // Бонус за «похоже на одно слово латиницей», если перевод на en
      if (to === 'en' && /^[A-Za-z-]+$/.test(c.text)) score += 0.25;

      // Небольшой бонус за разумную длину
      if (c.text.length >= 2 && c.text.length <= 16) score += 0.1;

      // Наказание за слишком длинные варианты
      if (c.text.length > 24) score -= 0.5;

      return score;
    };

    // Дедуп по нормализованной форме (нижний регистр)
    const seen = new Set();
    const unique = [];
    for (const c of candidates) {
      const key = c.text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(c);
    }

    // Отсев по порогу, сортировка
    const MIN_MATCH = 0.3;  // отрежем совсем слабые совпадения
    const MIN_QUALITY = 40; // и плохое качество
    const filtered = unique.filter(c => (c.match ?? 0) >= MIN_MATCH || (c.quality ?? 0) >= MIN_QUALITY);

    filtered.sort((a, b) => scoreOf(b) - scoreOf(a));

    // Возвращаем тексты
    return filtered.map(c => c.text).slice(0, 10);
  } catch (e) {
    if (e?.name !== 'AbortError') console.warn('Translation fetch failed', e);
    return [];
  }
}
