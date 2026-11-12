import { useEffect } from 'react';

interface Props {
  score: number;
  onRetry: () => void;
  onSettings: () => void;
}

export function Results({ score, onRetry, onSettings }: Props) {
  // Enter or Esc: play again with the same mode and settings. Shift+Esc: settings.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && e.shiftKey) {
        e.preventDefault();
        onSettings();
      } else if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        onRetry();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRetry, onSettings]);

  return (
    <div className="page end">
      <p className="final-score">Score: {score}</p>
      <p>
        <button type="button" onClick={onRetry}>
          Try again
        </button>{' '}
        <button type="button" onClick={onSettings}>
          Change settings
        </button>
      </p>
    </div>
  );
}
