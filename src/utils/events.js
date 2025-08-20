export const EVT_EDITING_ON = 'vocaboo:editingOn';
export const EVT_EDITING_OFF = 'vocaboo:editingOff';
export const EVT_UPDATE_WORD_STATS = 'vocaboo:updateWordStats';

export function dispatchWordStatsUpdate(detail) {
  const ev = new CustomEvent(EVT_UPDATE_WORD_STATS, { detail });
  window.dispatchEvent(ev);
}
