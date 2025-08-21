import React from 'react';
import TabButton from './TabButton.jsx';
import StatsBadge from './StatsBadge.jsx';

export default function Header({ progress, accuracy, tab, setTab }) {
  return (
    <header
      className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b"
      style={{ marginTop: 5, marginBottom: 8 }}
    >
      <div className="px-3 pt-[calc(env(safe-area-inset-top))] pb-2 max-w-full mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold leading-tight">Vocaboo</h1>
          <div className="flex gap-2 items-center">
            <StatsBadge label="Ans" value={progress.totalAnswered} />
            <StatsBadge label="Acc" value={`${accuracy}%`} />
            <StatsBadge label="Streak" value={progress.streak} />
          </div>
        </div>
        <nav className="mt-2 flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          <TabButton active={tab === 'train'} onClick={() => setTab('train')}>
            Тренировка
          </TabButton>
          <TabButton active={tab === 'add'} onClick={() => setTab('add')}>
            Словарь
          </TabButton>
          <TabButton active={tab === 'list'} onClick={() => setTab('list')}>
            Список
          </TabButton>
        </nav>
      </div>
    </header>
  );
}
