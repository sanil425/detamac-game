import { useEffect } from 'react';

interface Props {
  score: number;
  onRetry: () => void;
  onSettings: () => void;
}

export function Results({ score, onRetry, onSettings }: Props) {
  // Enter: play again with the same mode and settings. Esc: menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSettings();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onRetry();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRetry, onSettings]);

  return (
    <div className="panel end">
      <p className="final-score">Score: {score}</p>
      <div className="buttons">
        <button type="button" onClick={onRetry}>
          Try again
        </button>{' '}
        <button type="button" onClick={onSettings}>
          Change settings
        </button>
      </div>
    </div>
  );
}
