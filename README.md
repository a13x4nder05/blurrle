# Blurrle

A daily game of recognition: five famous faces, ten seconds each. Pick actors, world leaders, politicians, or CEOs / founders. The sooner you recognize a face, the more you score.

## Run locally

Use Node **24 LTS** and npm. The project also runs on newer supported Node versions. SQLite is provided by `better-sqlite3`; npm may need a C++ toolchain if a prebuilt binary is unavailable for your platform.

```sh
nvm use
npm install
cp .env.example .env
npm run assets:fetch
npm run db:migrate
npm run db:seed
npm run dev
```

Open **http://127.0.0.1:5173**. Vite proxies the API and portraits to the Express server on port 3001. The game requires the server; opening `index.html` directly will not work.

Some npm versions require explicit permission for native dependency install scripts. If installation reports blocked scripts, approve the specific required packages and rebuild them:

```sh
npm install-scripts approve better-sqlite3 esbuild --no-allow-scripts-pin
npm rebuild better-sqlite3 esbuild
```

The approval command is only needed on npm versions that support it and report blocked scripts. Normal npm installations run the required scripts automatically.

Image downloads run four at a time, skip valid cached files, retry temporary errors, respect server retry delays, and report elapsed time. The initial 15-portrait download took 1.3 seconds on the development connection; actual time depends on your connection and Wikimedia availability. Set `IMAGE_DOWNLOAD_CONCURRENCY` from 1 to 6 to change concurrency. The source manifest is checked in; downloaded portraits are ignored by Git.

## Production build

```sh
npm run build
npm start
```

Open **http://127.0.0.1:3001**. Express serves the compiled app, API, and portraits. Run commands from the repository root; keep `data/images/`, `server/migrations/`, and the seeded database alongside the build. `npm start` does not depend on TypeScript development runners.

## Configuration

The scripts load `.env` when present. Defaults work without it.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | API/production bind address |
| `PORT` | `3001` | API/production port |
| `DATABASE_PATH` | `var/blurrle.sqlite` | Local SQLite database |
| `IMAGE_DOWNLOAD_CONCURRENCY` | `4` | Parallel portrait downloads, limited to 1–6 |

The development proxy expects API port 3001. If you change the API port during development, update `vite.config.ts` to match. Do not put secrets into client environment variables or commit `.env` or local database files.

## How to play

- Select a category and choose **Play today** or press **Enter**. The **?** button opens a looping animated how-to guide with step selection; reduced-motion mode uses manual steps. Its leaderboard scene previews a future feature.
- Type a name and press **Enter**, or use the submit button. Correct answers fully reveal the image and freeze the score.
- Each wrong guess costs 100 points. Empty submissions are ignored. When penalties and time decay leave zero points, the round ends immediately and reveals the answer.
- **Shift+Enter** or Hint opens the game’s single free hint card. The timer, score decay, and image reveal pause while you read. Continue guessing, Enter, or Escape resumes from the same elapsed time. Refresh restores the paused card. Hint is then disabled for the rest of the five-round game, including after refresh. Replays receive a new hint.
- **Esc** or Skip reveals the person for zero points, then waits for Next.
- After 10 seconds, the image is fully clear, the round ends, and it earns zero points.
- Press Enter again or choose **Next face**. After five faces, view the per-face results and total.
- The first completed score per category and UTC day is recorded. Replays show their own results without replacing it.

Scoring is `max(0, floor(1000 × (1 − (exp(3.6 × elapsedSeconds / 10) − 1) / (exp(3.6) − 1))) − 100 × wrongGuesses)`, with elapsed time clamped to 0–10 seconds. A submission at or after the deadline is a timeout. Maximum total: 5,000. Time loss starts slowly and accelerates: before penalties, 958 points remain at 2.5 seconds, 858 at halfway, and 610 at 7.5 seconds. Existing recorded scores retain their original values.

Answers ignore capitalization, accents, punctuation, and extra whitespace. Full names and explicit aliases count, as do first names and surnames of at least three characters. Names of four to eight letters allow one spelling edit; longer names allow two, including adjacent letter swaps. Typo matching requires the same number of words. A guess is rejected if it matches another face in the pinned daily set equally well or better. Arbitrary substrings and tiny fragments do not count; catalog-wide ambiguity checking is not implemented.

## Daily games and progress

The server uses **UTC midnight** for its daily boundary. Each category/day receives five distinct people, ranked deterministically by SHA-256 of `blurrle-v1:<day>:<category>:<personId>`. Selections are stored transactionally in SQLite and retained on reseeding. All players accessing that database get the same daily order. Separate installations should use the same manifest before generating a day's game to produce matching sets.

An attempt pins its day, category, questions, results, timer, penalties, and hint state. Refreshing automatically restores the open attempt, including round-result and final-results screens. Leaving for the landing page saves progress and offers Resume for an unfinished category. A started round keeps counting while away or in the background, except while its hint card is open. Hint pauses persist across refresh; closing the card restores the remaining play time without counting reading time. Newly loaded portraits start their timer only after decoding; reloading an active round does not extend its original deadline. An older attempt can finish after UTC midnight and keeps its original date.

Active rounds saved before the 10-second update retain their original start time and penalties but adopt the shorter deadline. Completed results and recorded scores keep their original values.

Scores and attempts are stored in this browser's local storage, and the open view is tracked in session storage. They are not synchronized between devices. Clearing browser data removes them. If storage is blocked or full, the current session can continue in memory but cannot promise persistence; the interface shows a notice. Tabs recheck existing scores before writing, but simultaneous completion in multiple tabs does not have an atomic cross-tab guarantee.

This prototype has no accounts, leaderboard, or server-validated scores. Answers and hints are inspectable in API responses/storage. A monotonic clock protects live rounds against timer drift; reload recovery also uses wall time, so deliberate device-clock/storage manipulation is not prevented.

## Content and image credits

`data/people.json` contains 15 people and image source URLs, photographers, credits, and license links, retrieved from Wikimedia Commons. Each category currently has five people. World leaders and politicians share the initial five people. Consequently people repeat on future days; the order can change, but the seed does not promise novel faces each day.

The landing page's **Photo credits** view links each source and license and identifies the image transformations. Downloads resize and convert files to WebP; gameplay crops them for display and applies temporary blur. Adapted images retain their listed source licenses, including share-alike requirements where applicable. See source pages for complete original context and attribution. Fonts are bundled locally through Fontsource; DM Sans and Manrope are supplied under their included SIL Open Font License files.

To add content:

1. Add a person with a unique opaque 12-character hexadecimal ID and matching `<id>.webp` image filename to the manifest.
2. Supply a canonical name, explicit accepted aliases, hint, valid category memberships, verified source and asset URLs, creator, license name/URL, and attribution.
3. Run `npm run assets:fetch`, then `npm run db:seed`.
4. Check the portrait and hint in play. Avoid removing existing people or images referenced by stored daily games. Manifest updates do not reshuffle already generated days.

Seeding applies migrations, validates the manifest and available image paths, and updates existing content without deleting daily selections. With more than five people in a category, each day chooses five from that larger pool; repeats remain possible.

## Minimal verification

The owner's playtesting is the primary assessment. Routine verification is limited to type checking, lint, a build, and a brief visual check when available. Existing rule/API tests and the single browser smoke flow remain available for requested follow-up checks; no additional suite has been added for this redesign.

Routine checks:

```sh
npm run typecheck
npm run lint
npm run build
```

For optional follow-up checks, run `npm test` or `npm run test:e2e` (install Chromium first with `npx playwright install chromium --only-shell`). The eight existing focused tests cover scoring, matching, key round transitions and deadline handling, clocks, daily selection, reseeding, and API errors. One browser smoke flow covers all five rounds, hint/wrong-guess penalties, timeout reveal, refresh recovery, fresh-Enter advancement, replay preservation, and desktop/mobile layouts. The browser test starts its own production server on port 4173 and expects the database and downloaded portraits to be ready. Browser screenshots and failure traces are ignored under `test-results/`. If using an existing compatible Chromium installation, set `CHROMIUM_EXECUTABLE_PATH` to its executable.

Chromium also requires OS shared libraries. On supported Linux distributions Playwright documents `npx playwright install-deps chromium`; install system packages only with the machine owner's approval. If the browser cannot start, type checks, focused tests, and builds still run independently. `npm run format` formats source files.

## Project documents

- `SPEC.md`: agreed product behavior.
- `AGENTS.md`: implementation and verification instructions.
- `PERMISSIONS.md`: authorized local development scope.
- `IMPLEMENTATION.md`: implementation recipe, with the owner's minimal-testing preference recorded.

## Verification status

The initial implementation passed type checking, lint, eight focused rule/API tests, and the production build. The portrait downloader, repeated migrations, and seeding were exercised during that implementation.

The redesign changes rounds to 10 seconds, adds Skip, automatic zero-point endings, a persistent paused hint card, animated answer feedback, and a shared film-column mosaic with a charcoal/coral theme. Type checking, lint, and the production build passed for the redesign. Existing test expectations were adjusted without expanding or running the test suite. The current browser preview cannot launch because Chromium's `libatk-1.0.so.0` dependency is unavailable; visual layout, software-keyboard behavior, and animation feel need owner playtesting. No system packages were installed for this redesign.
