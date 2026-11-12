import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// A bot that reads each problem from the page, works out the answer and types it.
// Playwright's fake clock replaces real waiting, so a 120 s round takes about a second.

const START = new Date('2026-01-05T09:00:00');
const ROUND_MS = 120_000;

interface Problem {
  text: string;
  left: number;
  op: string;
  right: number;
  answer: number;
}

function solve(left: number, op: string, right: number): number {
  if (op === '+') return left + right;
  if (op === '–') return left - right;
  if (op === '×') return left * right;
  if (op === '÷') return left / right;
  throw new Error(`Unknown operator ${op}`);
}

async function readProblem(page: Page): Promise<Problem> {
  const text = ((await page.locator('.problem span').textContent()) ?? '').trim();
  const m = text.match(/^(\d+) ([+–×÷]) (\d+) =$/);
  if (!m) throw new Error(`Can't read problem "${text}"`);
  const left = Number(m[1]);
  const right = Number(m[3]);
  return { text, left, op: m[2], right, answer: solve(left, m[2], right) };
}

const problemText = (page: Page) => page.locator('.problem span');
const answerBox = (page: Page) => page.getByLabel('Answer');
const banner = (page: Page) => page.locator('.banner span');

// Open the app with a paused fake clock.
async function open(page: Page) {
  await page.clock.install({ time: START });
  await page.goto('./');
  await page.clock.pauseAt(new Date(START.getTime() + 1000));
  await expect(page.getByRole('heading', { name: 'Detamac' })).toBeVisible();
}

async function answerCorrectly(page: Page, scoreBefore: number): Promise<Problem> {
  const p = await readProblem(page);
  await answerBox(page).pressSequentially(String(p.answer));
  await expect(banner(page).nth(1)).toHaveText(`Score: ${scoreBefore + 1}`);
  return p;
}

// Answer questions every `stepMs` of fake time until the round ends. Returns the score.
async function playRound(page: Page, stepMs = 3000): Promise<number> {
  let score = 0;
  let elapsed = 0;
  while (elapsed + stepMs < ROUND_MS) {
    await answerCorrectly(page, score);
    score++;
    await page.clock.runFor(stepMs);
    elapsed += stepMs;
  }
  await page.clock.runFor(ROUND_MS - elapsed + 500);
  await expect(page.locator('.final-score')).toHaveText(`Score: ${score}`);
  return score;
}

async function savedData(page: Page): Promise<{ rankedHistory: unknown[]; model: { totalAnswers: number } }> {
  const raw = await page.evaluate(() => localStorage.getItem('detamac:v1'));
  return raw ? JSON.parse(raw) : { rankedHistory: [], model: { totalAnswers: 0 } };
}

async function rankedGameCount(page: Page): Promise<number> {
  return (await savedData(page)).rankedHistory.length;
}

test('a correct answer advances instantly, a wrong or partial one does not', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(answerBox(page)).toBeFocused();

  for (let i = 0; i < 8; i++) {
    const p = await readProblem(page);

    // Wrong answer: typed in full, nothing happens.
    await answerBox(page).pressSequentially(String(p.answer + 1));
    await expect(problemText(page)).toHaveText(`${p.text} `);
    await expect(banner(page).nth(1)).toHaveText(`Score: ${i}`);
    await answerBox(page).fill('');

    // Partial answer (first digit of a multi-digit answer): nothing happens.
    const digits = String(p.answer);
    if (digits.length > 1) {
      await answerBox(page).pressSequentially(digits[0]);
      await expect(problemText(page)).toHaveText(`${p.text} `);
      await answerBox(page).fill('');
    }

    // Correct answer: the next problem appears with no time passing (the clock is paused).
    await answerBox(page).pressSequentially(digits);
    await expect(banner(page).nth(1)).toHaveText(`Score: ${i + 1}`);
    await expect(problemText(page)).not.toHaveText(`${p.text} `);
    await expect(answerBox(page)).toHaveValue('');
  }
});

test('the timer counts down and the round ends at 0 with the results screen', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(banner(page).nth(0)).toHaveText('Seconds left: 120');

  await page.clock.runFor(10_000);
  await expect(banner(page).nth(0)).toHaveText('Seconds left: 110');
  await page.clock.runFor(100_000);
  await expect(banner(page).nth(0)).toHaveText('Seconds left: 10');

  await page.clock.runFor(10_500);
  await expect(page.locator('.final-score')).toHaveText('Score: 0');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change settings' })).toBeVisible();
});

test('a completed ranked round is saved once; a ranked round quit with Esc is not', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Stats' }).click();
  await expect(page.getByText('No ranked games yet.')).toBeVisible();
  await page.getByRole('button', { name: '← Back' }).click();

  await page.getByRole('button', { name: 'Play ranked' }).click();
  const score = await playRound(page);
  expect(score).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Change settings' }).click();
  await page.getByRole('button', { name: 'Stats' }).click();
  await expect(page.getByText(`Personal best: ${score}`)).toBeVisible();
  await expect(page.getByText('(1 ranked game)')).toBeVisible();
  expect(await rankedGameCount(page)).toBe(1);

  // Quit a ranked round partway with Esc.
  const answersBefore = (await savedData(page)).model.totalAnswers;
  await page.getByRole('button', { name: '← Back' }).click();
  await page.getByRole('button', { name: 'Play ranked' }).click();
  await answerCorrectly(page, 0);
  await page.clock.runFor(3000);
  await answerCorrectly(page, 1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Start practice' })).toBeVisible();

  await page.getByRole('button', { name: 'Stats' }).click();
  await expect(page.getByText('(1 ranked game)')).toBeVisible();
  expect(await rankedGameCount(page)).toBe(1);
  // Its answers were kept as practice (the first answer of a round is always skipped).
  expect((await savedData(page)).model.totalAnswers).toBe(answersBefore + 1);
});

test('practice respects custom settings (multiplication only, 3–5 × 3–5)', async ({ page }) => {
  await open(page);
  await page.getByLabel('Addition', { exact: true }).uncheck();
  await page.getByLabel('Subtraction', { exact: true }).uncheck();
  await page.getByLabel('Division', { exact: true }).uncheck();
  await page.getByLabel('mulLeft min').fill('3');
  await page.getByLabel('mulLeft max').fill('5');
  await page.getByLabel('mulRight min').fill('3');
  await page.getByLabel('mulRight max').fill('5');
  await page.getByRole('button', { name: 'Start practice' }).click();

  for (let i = 0; i < 40; i++) {
    const p = await readProblem(page);
    expect(p.op).toBe('×');
    expect(p.left).toBeGreaterThanOrEqual(3);
    expect(p.left).toBeLessThanOrEqual(5);
    expect(p.right).toBeGreaterThanOrEqual(3);
    expect(p.right).toBeLessThanOrEqual(5);
    await answerCorrectly(page, i);
    await page.clock.runFor(1500);
  }
});

test('stats survive a reload, and export → clear → import restores them', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Play ranked' }).click();
  const score = await playRound(page);
  const saved = await page.evaluate(() => localStorage.getItem('detamac:v1'));
  expect(saved).not.toBeNull();

  // Reload: stats are still there.
  await page.reload();
  await page.getByRole('button', { name: 'Stats' }).click();
  await expect(page.getByText(`Personal best: ${score}`)).toBeVisible();
  await expect(page.getByText('(1 ranked game)')).toBeVisible();

  // Export.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;
  const file = await download.path();

  // Clear everything.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Stats' }).click();
  await expect(page.getByText('No ranked games yet.')).toBeVisible();

  // Import (accepting the "replace your data?" prompt).
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByText('Imported.')).toBeVisible();
  await expect(page.getByText(`Personal best: ${score}`)).toBeVisible();
  const restored = await page.evaluate(() => localStorage.getItem('detamac:v1'));
  expect(JSON.parse(restored!)).toEqual(JSON.parse(saved!));
});
