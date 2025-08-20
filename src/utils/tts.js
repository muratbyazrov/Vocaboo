export function ttsSpeak(word, rate = 0.95) {
  try {
    if (!('speechSynthesis' in window)) return;
    const utt = new SpeechSynthesisUtterance(word || '');
    utt.lang = 'en-US';
    utt.rate = rate;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const voice = voices.find((v) => /en-/i.test(v?.lang || ''));
    if (voice) utt.voice = voice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  } catch {}
}

export function speakOnReveal(en) {
  if (typeof en === 'string' && en.trim()) {
    ttsSpeak(en);
  }
}
