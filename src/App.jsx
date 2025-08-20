import React, { useEffect, useMemo, useState } from 'react';

import Header from './components/Header.jsx';
import TrainView from './views/TrainView.jsx';
import AddView from './views/AddView.jsx';
import ListView from './views/ListView.jsx';

import useLocalStorage from './hooks/useLocalStorage.js';
import { LS_KEYS } from './storage/keys.js';
import { speakOnReveal } from './utils/tts.js';
import { EVT_EDITING_ON, EVT_EDITING_OFF, EVT_UPDATE_WORD_STATS } from './utils/events.js';

export default function App() {
  const [tab, setTab] = useState('train');

  // Telegram fullscreen & safe-area
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  // CSS var for viewport height
  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty('--app-vh', `${window.innerHeight}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    return () => window.removeEventListener('resize', setVh);
  }, []);

  // Persistent data
  const [words, setWords] = useLocalStorage(LS_KEYS.words, []);
  const [progress, setProgress] = useLocalStorage(LS_KEYS.progress, {
    totalAnswered: 0,
    totalCorrect: 0,
    streak: 0,
    history: [],
  });
  const [settings] = useLocalStorage(LS_KEYS.settings, { ttsOnReveal: true });

  // Update word stats from TrainView via custom event
  useEffect(() => {
    const handler = (e) => {
      const { index, correct } = e.detail || {};
      setWords((prev) =>
        prev.map((item, i) =>
          i === index
            ? {
              ...item,
              stats: {
                seen: (item.stats?.seen || 0) + 1,
                correct: (item.stats?.correct || 0) + (correct ? 1 : 0),
                wrong: (item.stats?.wrong || 0) + (correct ? 0 : 1),
              },
            }
            : item
        )
      );
      if (settings.ttsOnReveal) speakOnReveal(words[index]?.en);
    };

    window.addEventListener(EVT_UPDATE_WORD_STATS, handler);
    return () => window.removeEventListener(EVT_UPDATE_WORD_STATS, handler);
  }, [setWords, settings.ttsOnReveal, words]);

  const accuracy = useMemo(() => {
    return progress.totalAnswered
      ? Math.round((100 * (progress.totalCorrect || 0)) / progress.totalAnswered)
      : 0;
  }, [progress]);

  // Detect editing mode to hide Header
  const [isEditing, setIsEditing] = useState(false);
  useEffect(() => {
    const on = () => setIsEditing(true);
    const off = () => setIsEditing(false);
    window.addEventListener(EVT_EDITING_ON, on);
    window.addEventListener(EVT_EDITING_OFF, off);
    return () => {
      window.removeEventListener(EVT_EDITING_ON, on);
      window.removeEventListener(EVT_EDITING_OFF, off);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-gray-50 text-gray-900 select-none flex flex-col"
      style={{
        height: 'var(--app-vh)',
        maxHeight: 'var(--app-vh)',
        overflow: 'hidden',
        paddingTop: 'env(safe-area-inset-top, 20px)',
        paddingBottom: 'env(safe-area-inset-bottom, 20px)',
      }}
    >
      {!isEditing && (
        <Header progress={progress} accuracy={accuracy} tab={tab} setTab={setTab} />
      )}

      <main className="flex-1 min-h-0 pb-[calc(32px+env(safe-area-inset-bottom))] px-3 flex flex-col max-h-[calc(var(--app-vh)-theme(spacing.16))] overflow-hidden">
        <div
          className="mx-auto flex-1 min-h-0 flex flex-col"
          style={{ width: '100%', maxWidth: '480px', minHeight: 0 }}
        >
          {tab === 'train' && (
            <TrainView
              words={words}
              progress={progress}
              setProgress={setProgress}
              settingsKey={LS_KEYS.settings}
            />
          )}
          {tab === 'add' && <AddView words={words} setWords={setWords} />}
          {tab === 'list' && <ListView words={words} setWords={setWords} />}
        </div>
      </main>
    </div>
  );
}
