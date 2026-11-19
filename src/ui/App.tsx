import { useCallback, useEffect, useRef, useState } from 'react';
import type { Mode, Settings as SettingsType } from '../core/config';
import { DEFAULT_SETTINGS, RANKED_DURATION } from '../core/config';
import type { AnswerRecord } from '../core/model';
import { applyRankedRound, recordAnswer } from '../core/model';
import type { SaveData, StorageLike } from '../core/storage';
import { flushRankedBuffer, load, save } from '../core/storage';
import { Game } from './Game';
import { Results } from './Results';
import { Settings } from './Settings';
import { Stats } from './Stats';

// localStorage can throw (private browsing, storage full); never let that break the game.
const browserStorage: StorageLike = {
  getItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
};

type Screen = 'settings' | 'game' | 'results' | 'stats';

interface Round {
  id: number; // changes every round so the Game component starts fresh
  mode: Mode;
  settings: SettingsType;
}

// The round in progress is kept in sessionStorage so a browser refresh restarts it
// with the same mode and settings. It's removed whenever the player leaves the round.
const ROUND_KEY = 'detamac:round';

function readSavedRound(): Omit<Round, 'id'> | null {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(ROUND_KEY) ?? 'null');
    if ((saved?.mode === 'practice' || saved?.mode === 'ranked') && saved.settings) return saved;
  } catch {
    // ignore
  }
  return null;
}

function writeSavedRound(round: Omit<Round, 'id'> | null) {
  try {
    if (round) window.sessionStorage.setItem(ROUND_KEY, JSON.stringify(round));
    else window.sessionStorage.removeItem(ROUND_KEY);
  } catch {
    // ignore
  }
}

export function App() {
  // Save data is mutated in place (the sampler reads the live model), so it lives in a ref.
  const data = useRef<SaveData>(load(browserStorage));
  const [, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  const [round, setRound] = useState<Round | null>(() => {
    const saved = readSavedRound();
    return saved && { id: 0, ...saved };
  });
  const [screen, setScreen] = useState<Screen>(round ? 'game' : 'settings');
  const [lastScore, setLastScore] = useState(0);
  // Ranked answers wait here until the round ends.
  const rankedBuffer = useRef<AnswerRecord[]>([]);
  const roundCounter = useRef(0);

  const start = useCallback((mode: Mode, settings: SettingsType) => {
    rankedBuffer.current = [];
    roundCounter.current += 1;
    setRound({ id: roundCounter.current, mode, settings });
    writeSavedRound({ mode, settings });
    setScreen('game');
  }, []);

  const startRanked = () => start('ranked', { ...DEFAULT_SETTINGS, durationSeconds: RANKED_DURATION });

  // Closing or hiding the page mid-round abandons a ranked round: its answers are
  // saved as practice right away and no score is recorded. The saved round is only
  // forgotten once the page is visible again, so a refresh (which also hides the page)
  // still restarts it.
  useEffect(() => {
    if (screen !== 'game' || round?.mode !== 'ranked') return;
    const abandon = () => {
      flushRankedBuffer(browserStorage, data.current, rankedBuffer.current);
      setScreen('settings');
      const forget = () => {
        if (document.visibilityState !== 'visible') return;
        writeSavedRound(null);
        document.removeEventListener('visibilitychange', forget);
      };
      document.addEventListener('visibilitychange', forget);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') abandon();
    };
    window.addEventListener('pagehide', abandon);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', abandon);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [screen, round]);

  function handleAnswer(record: AnswerRecord, isFirstInRound: boolean) {
    if (round?.mode === 'ranked') {
      rankedBuffer.current.push(record);
    } else {
      recordAnswer(data.current.model, record, isFirstInRound);
      save(browserStorage, data.current);
    }
  }

  // The timer ran out: a finished ranked round is saved with its score.
  function handleEnd(score: number) {
    writeSavedRound(null);
    if (round?.mode === 'ranked') {
      applyRankedRound(data.current.model, rankedBuffer.current, true);
      rankedBuffer.current = [];
      data.current.rankedHistory.push({ date: new Date().toISOString(), score });
      save(browserStorage, data.current);
    }
    setLastScore(score);
    setScreen('results');
  }

  // The player pressed Esc mid-round. No score is recorded; ranked answers are kept
  // as practice. Practice answers were already saved as they came.
  function handleInterrupt() {
    if (round?.mode === 'ranked') flushRankedBuffer(browserStorage, data.current, rankedBuffer.current);
    writeSavedRound(null);
    setScreen('settings');
  }

  const retry = useCallback(() => {
    if (round) start(round.mode, round.settings);
  }, [round, start]);

  if (screen === 'game' && round) {
    return (
      <Game
        key={round.id}
        mode={round.mode}
        settings={round.settings}
        model={data.current.model}
        onAnswer={handleAnswer}
        onEnd={handleEnd}
        onInterrupt={handleInterrupt}
      />
    );
  }

  if (screen === 'results') {
    return <Results score={lastScore} onRetry={retry} onSettings={() => setScreen('settings')} />;
  }

  if (screen === 'stats') {
    return (
      <Stats
        data={data.current}
        onBack={() => setScreen('settings')}
        onImport={(imported) => {
          data.current = imported;
          save(browserStorage, imported);
          refresh();
        }}
      />
    );
  }

  return (
    <Settings
      initial={data.current.settings}
      onChange={(settings) => {
        data.current.settings = settings;
        save(browserStorage, data.current);
      }}
      onStartPractice={(settings) => start('practice', settings)}
      onStartRanked={startRanked}
      onStats={() => setScreen('stats')}
    />
  );
}
