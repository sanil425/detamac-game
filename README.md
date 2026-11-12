# Detamac

An arithmetic speed drill that runs entirely in your browser. You get a stream of addition, subtraction, multiplication and division problems and answer as many as you can before the timer runs out. A correct answer moves you on as soon as you type it. Detamac keeps the plain, fast format of classic arithmetic drills and adds a practice mode that gives you more of the question types you're slow on.

**Play:** https://<username>.github.io/detamac-game/

## Modes

- **Ranked:** fixed default settings (addition 2–100 + 2–100, multiplication 2–12 × 2–100, subtraction and division as their reverses), 120 seconds, and purely random questions. Finished rounds are saved to your score history. If you quit, close or hide the page mid-round, the answers still count toward practice stats but the score isn't recorded.
- **Practice:** choose your operations, ranges and duration (30 s to 10 min). Questions are picked adaptively (see below). The game screen never shows which questions were targeted.

The stats page shows your ranked scores over time (with your personal best), a multiplication heatmap, and your weakest question types. You can export and import your data as JSON. Everything is stored in your browser's localStorage. Nothing is sent anywhere.

## How the adaptive model works

**Groups.** Every question falls into exactly one group that describes what makes it hard:

- Addition: carry or no carry × digit pattern (1+1, 1+2, 2+2, 3+) × sum ≤ 100 or > 100.
- Subtraction: borrow or no borrow × first number ≤ 100 or > 100.
- Multiplication: the smaller factor (×2, ×3, … ×20, then "21+") × the other factor ≤ 12 or > 12.
- Division: the divisor (same buckets) × answer ≤ 12 or > 12.

Multiplications with both factors in 2–12 also update a per-fact stat (7×8 and 8×7 are the same fact), shown in the heatmap.

**Speed averages.** For each group, fact and operation, Detamac keeps an exponentially weighted moving average (EWMA) of your answer time. Each new answer moves it 20% of the way toward the new time, so recent answers count most. A second, slower average (5%) is used to show whether a group is improving.

**Weakness is relative to the operation.** A group's weakness is its average time divided by your average for that operation. Division is usually slower than addition, so comparing raw times would make every division group look weak. "1.8× slower" means 80% slower than your typical answer for the same operation.

**Typing correction.** A 3-digit answer takes longer to type than a 1-digit one, and that isn't an arithmetic weakness. Detamac fits `time ≈ a(operation) + b × digits` by least squares, storing only running sums, and subtracts `b × digits` from each time. Each operation gets its own baseline `a`, because operations differ in both speed and answer length. Division is slow with short answers, for example, and a single shared baseline would wrongly blame that on typing. The correction turns on once there are 30 answers and at least two answer lengths with 5+ answers each.

**Filtering.** The first question of each round (you're still settling in) and answers over 15 seconds (you got distracted) are ignored.

**Practice weighting.** Ranked answers update the averages at full strength. Practice answers count half as much, because a session focused on your weak spots isn't a typical sample.

**Choosing practice questions.** For the first 100 answers, practice is uniform random. After that:

1. Pick an operation. Each operation's share is a 50/50 blend of an equal share and its share of your total answer time, kept between half and double the equal share (12.5%–50% with all four enabled).
2. 65% of the time, pick a group in proportion to its weakness. Groups with fewer than 5 answers get a boost so they get explored. Only groups your current ranges can produce are used. The other 35% of the time, ask a plain random question.
3. Generate a question in that group by drawing random questions in your ranges until one matches. The same question never appears twice in a row.

## Run locally

Requires Node 20.19+ (CI uses Node 24).

```sh
npm install
npm run dev      # start the dev server
npm test         # unit tests (Vitest)
npm run build    # type-check and build to dist/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`. Under the repo's Settings → Pages, set the source to "GitHub Actions" once.

## Layout

- `src/core/`: pure TypeScript game logic and the adaptive model, with unit tests next to each file.
- `src/ui/`: React components on top of the core.

## License

MIT
