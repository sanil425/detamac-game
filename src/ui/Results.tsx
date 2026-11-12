import { useEffect } from 'react';

interface Props {
  score: number;
  onRetry: () => void;
  onSettings: () => void;
}

export function Results({ score, onRetry, onSettings }: Props) {
  // Enter or Esc starts another round with the same settings.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        onRetry();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRetry]);

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
