import { useEffect, useRef, useState } from 'react';
import type { Mode, Settings } from '../core/config';
import type { Question } from '../core/generator';
import { questionText } from '../core/generator';
import type { AnswerRecord, ModelState } from '../core/model';
import { makeRecord } from '../core/model';
import { createRng } from '../core/rng';
import { nextQuestion } from '../core/sampler';

interface Props {
  mode: Mode;
  settings: Settings;
  model: ModelState;
  onAnswer: (record: AnswerRecord, isFirstInRound: boolean) => void;
  onEnd: (score: number) => void; // the timer ran out
  onInterrupt: (next: 'restart' | 'settings') => void; // the player left mid-round
}

export function Game({ mode, settings, model, onAnswer, onEnd, onInterrupt }: Props) {
  const rng = useRef(createRng(Math.floor(Math.random() * 2 ** 32))).current;
  const endAt = useRef(Date.now() + settings.durationSeconds * 1000);
  const [question, setQuestion] = useState<Question>(() =>
    nextQuestion({ mode, settings, model, rng, previous: null }),
  );
  const [value, setValue] = useState('');
  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(settings.durationSeconds);
  const shownAt = useRef(performance.now());
  const ended = useRef(false);
  // Refs so the timer and key handler always see the latest values.
  const scoreRef = useRef(0);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const onInterruptRef = useRef(onInterrupt);
  onInterruptRef.current = onInterrupt;

  function finish() {
    if (ended.current) return;
    ended.current = true;
    onEndRef.current(scoreRef.current);
  }

  function interrupt(next: 'restart' | 'settings') {
    if (ended.current) return;
    ended.current = true;
    onInterruptRef.current(next);
  }

  useEffect(() => {
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) finish();
    }, 100);
    // Esc: restart right away. Shift+Esc: back to settings.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      interrupt(e.shiftKey ? 'settings' : 'restart');
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  function handleChange(text: string) {
    if (ended.current) return;
    // Correct answers are accepted the moment they're typed; there's no submit.
    if (text.trim() === String(question.answer)) {
      const ms = performance.now() - shownAt.current;
      onAnswer(makeRecord(question, ms, mode, Date.now()), scoreRef.current === 0);
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setQuestion(nextQuestion({ mode, settings, model, rng, previous: question }));
      setValue('');
      shownAt.current = performance.now();
    } else {
      setValue(text);
    }
  }

  return (
    <div className="game">
      <div className="banner">
        <span>Seconds left: {secondsLeft}</span>
        <span>Score: {score}</span>
      </div>
      <div className="problem">
        <span>{questionText(question)} = </span>
        <input
          className="answer"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          aria-label="Answer"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
        />
      </div>
      <div className="game-links">
        <button type="button" className="link" onClick={() => interrupt('settings')}>
          Settings
        </button>
        <p className="hint">Esc: restart · Shift+Esc: settings</p>
      </div>
    </div>
  );
}
