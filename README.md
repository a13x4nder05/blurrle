# Blurrle

A daily game of recognition: five famous faces, ten seconds each. Pick Actors, World leaders, CEOs & Founders, Musicians, Athletes, TV & Reality, or Other. The sooner you recognize a face, the more you score.

## Run locally

Use Node **24 LTS** and npm. The project also runs on newer supported Node versions. Supabase is required for catalog, daily selections, and portrait storage.

```sh
nvm use
npm install
cp .env.example .env
npm run dev
```

Set the Supabase URL and server secret in `.env` and apply the Supabase migrations below before starting. Existing configured projects need no migration for the local database removal. Missing credentials stop startup with a clear configuration error.

Open **http://127.0.0.1:5173**. Vite proxies the API and portraits to the Express server on port 3001. The game requires the server; opening `index.html` directly will not work.

Some npm versions require explicit permission for native dependency install scripts. If installation reports blocked scripts, approve the specific required packages and rebuild them:

```sh
npm install-scripts approve esbuild --no-allow-scripts-pin
npm rebuild esbuild
```

The approval command is only needed on npm versions that support it and report blocked scripts. Normal npm installations run the required scripts automatically.

## Production build

```sh
npm run build
npm start
```

Open **http://127.0.0.1:3001**. Express serves the compiled app, API, and portraits. Run commands from the repository root; only `dist/`, production npm dependencies, and server-side Supabase configuration are needed. Local portrait files, manifests, import caches, and migration files are not runtime dependencies. `npm start` does not depend on TypeScript development runners.

## Configuration

The scripts load `.env` when present. Supabase credentials must be supplied through that file or the runtime environment.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | API/production bind address |
| `PORT` | `3001` | API/production port |
| `SUPABASE_URL` | unset | HTTPS cloud Project URL |
| `SUPABASE_SECRET_KEY` | unset | Server-only key for catalog/game access |

The development proxy expects API port 3001. If you change the API port during development, update `vite.config.ts` to match. Do not put secrets into client environment variables or commit `.env` or credentials.

## How to play

- Select a category and choose **Play today** or press **Enter**. The **?** button opens a looping animated how-to guide with step selection; reduced-motion mode uses manual steps. Its leaderboard scene previews a future feature.
- Type a name and press **Enter**, or use the submit button. Correct answers fully reveal the image and freeze the score.
- Each wrong guess costs 100 points. Empty submissions are ignored. When penalties and time decay leave zero points, the round ends immediately and reveals the answer.
- **Shift+Enter** or Hint opens the game’s single free hint card. The timer, score decay, and image reveal pause while you read. Continue guessing, Enter, or Escape resumes from the same elapsed time. Refresh restores the paused card. Hint is then disabled for the rest of the five-round game, including after refresh. Replays receive a new hint.
- **Esc** or Skip reveals the person for zero points, then waits for Next.
- After 10 seconds, the image is fully clear, the round ends, and it earns zero points.
- Press Enter again or choose **Next face**. After five faces, view the per-face results and total.
- The first completed score per category and UTC day is recorded. Replays show their own results without replacing it.

Scoring is `max(0, floor(1000 × (1 − (exp(6 × elapsedSeconds / 10) − 1) / (exp(6) − 1))) − 100 × wrongGuesses)`, with elapsed time clamped to 0–10 seconds. A submission at or after the deadline is a timeout. Maximum total: 5,000. Time loss starts slowly and accelerates: before penalties, 991 points remain at 2.5 seconds, 952 at halfway, and 778 at 7.5 seconds. Existing recorded scores retain their original values.

Answers ignore capitalization, accents, punctuation, and extra whitespace. Full names and explicit aliases count, as do first names and surnames of at least three characters. Names of four to eight letters allow one spelling edit; longer names allow two, including adjacent letter swaps. Typo matching requires the same number of words. A guess is rejected if it matches another face in the pinned daily set equally well or better. Arbitrary substrings and tiny fragments do not count; catalog-wide ambiguity checking is not implemented.

## Daily games and progress

The server uses **UTC midnight** for its daily boundary. Supabase Cron runs `generate_blurrle_daily` daily at 00:00 UTC. It chooses five distinct reviewed people at random for each ready category and saves their order in `daily_images`. Every player receives those same rows. An advisory transaction lock prevents competing requests from creating different sets; reruns preserve a complete day. The API invokes the same function if a set is missing after a missed Cron run or project pause. Insufficient categories remain unavailable, and partial existing sets fail clearly.


An attempt pins its day, category, questions, results, timer, penalties, and hint state. Refreshing automatically restores the open attempt, including round-result and final-results screens. Leaving for the landing page saves progress and offers Resume for an unfinished category. A started round keeps counting while away or in the background, except while its hint card is open. Hint pauses persist across refresh; closing the card restores the remaining play time without counting reading time. Newly loaded portraits start their timer only after decoding; reloading an active round does not extend its original deadline. An older attempt can finish after UTC midnight and keeps its original date.

Active rounds saved before the 10-second update retain their original start time and penalties but adopt the shorter deadline. Completed results and recorded scores keep their original values.

Scores and attempts are stored in this browser's local storage, and the open view is tracked in session storage. They are not synchronized between devices. Clearing browser data removes them. If storage is blocked or full, the current session can continue in memory but cannot promise persistence; the interface shows a notice. Tabs recheck existing scores before writing, but simultaneous completion in multiple tabs does not have an atomic cross-tab guarantee.

This prototype has no accounts, leaderboard, or server-validated scores. Answers and hints are inspectable in API responses/storage. A monotonic clock protects live rounds against timer drift; reload recovery also uses wall time, so deliberate device-clock/storage manipulation is not prevented.

## Content and image credits

`data/people.json` contains the original 15 people and image source URLs, photographers, credits, and license links, retrieved from Wikimedia Commons. The cloud-reviewed collection adds Aaron Paul via `data/extra-people.json`: Actors has six eligible people, World leaders five, and CEOs & Founders five. New categories appear disabled as Coming soon until populated with reviewed portraits; Writers is included under Other. Politicians is no longer offered, while historical data remains intact. Consequently people repeat on future days; the order can change, but the seed does not promise novel faces each day.

The landing page's **Photo credits** view links each source and license and identifies the image transformations. Downloads resize and convert files to WebP; gameplay crops them for display and applies temporary blur. Adapted images retain their listed source licenses, including share-alike requirements where applicable. See source pages for complete original context and attribution. Fonts are bundled locally through Fontsource; DM Sans and Manrope are supplied under their included SIL Open Font License files.

To add content, use the Supabase import/review commands below. Keep the source manifests for reproducibility and credits; they are import inputs, not runtime dependencies. New portraits remain pending until reviewed. Existing daily selections are preserved.

## Minimal verification

The owner's playtesting is the primary assessment. Routine verification is limited to type checking, lint, a build, and a brief visual check when available. Existing rule/API tests and the single browser smoke flow remain available for requested follow-up checks; no additional suite has been added for this redesign.

Routine checks:

```sh
npm run typecheck
npm run lint
npm run build
```

For optional follow-up checks, run `npm test` or `npm run test:e2e` (install Chromium first with `npx playwright install chromium --only-shell`). The eight existing focused tests cover scoring, matching, key round transitions and deadline handling, clocks, saved cloud selections, unavailable content, and API errors. One browser smoke flow covers all five rounds, hint/wrong-guess penalties, timeout reveal, refresh recovery, fresh-Enter advancement, replay preservation, and desktop/mobile layouts. The browser test starts its own production server on port 4173 and requires the configured Supabase project and approved portraits to be ready. Browser screenshots and failure traces are ignored under `test-results/`. If using an existing compatible Chromium installation, set `CHROMIUM_EXECUTABLE_PATH` to its executable.

Chromium also requires OS shared libraries. On supported Linux distributions Playwright documents `npx playwright install-deps chromium`; install system packages only with the machine owner's approval. If the browser cannot start, type checks, focused tests, and builds still run independently. `npm run format` formats source files.

## Project documents

- `SPEC.md`: agreed product behavior.
- `AGENTS.md`: implementation and verification instructions.
- `PERMISSIONS.md`: authorized local development scope.
- `IMPLEMENTATION.md`: implementation recipe, with the owner's minimal-testing preference recorded.

## Verification status

The initial implementation passed type checking, lint, eight focused rule/API tests, and the production build. The portrait downloader, repeated migrations, and seeding were exercised during that implementation.

The redesign changes rounds to 10 seconds, adds Skip, automatic zero-point endings, a persistent paused hint card, animated answer feedback, and a shared film-column mosaic with a charcoal/coral theme. Type checking, lint, and the production build passed for the redesign. Existing test expectations were adjusted without expanding or running the test suite. The current browser preview cannot launch because Chromium's `libatk-1.0.so.0` dependency is unavailable; visual layout, software-keyboard behavior, and animation feel need owner playtesting. No system packages were installed for this redesign.

## Supabase catalog imports

With credentials configured, the main game now reads approved content and daily selections from Supabase. Dataset imports still remain pending; importing alone does not make a portrait playable. Supabase is the only runtime content source.

1. In Supabase, copy your HTTPS Project URL from Connect. Under Settings → API Keys, create a server secret key. Set these in the existing ignored `.env` file:

   ```dotenv
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_your_server_key
   SUPABASE_PORTRAIT_BUCKET=portrait-imports
   ```

   Keep the secret out of chat, Git, logs, and browser configuration. Do not prefix it with `VITE_`. The importer also accepts a legacy `SUPABASE_SERVICE_ROLE_KEY` when `SUPABASE_SECRET_KEY` is absent.

2. Run the contents of `supabase/migrations/202610270001_portrait_catalog.sql` in Supabase's SQL Editor. It creates catalog tables, restricted grants/RLS, the transactional import function, and a private Storage bucket. This is a one-time schema step; the API key alone cannot execute SQL DDL. The migration can be rerun without deleting existing catalog data.

3. Prepare and import:

   ```sh
   npm run catalog:import -- --dry-run --all
   npm run catalog:import
   npm run catalog:import -- --all
   npm run catalog:categories
   ```

The default import limit is 20. `--all` processes the whole dataset; `--limit 50` selects the first 50 rows. Use `--archive /path/to/archive.zip` to avoid downloading again. The default archive cache is `var/imports/celebrity-faces-v1.zip`. Prepared WebP assets and JSON reports also live under ignored `var/imports/`.

The supported source is [souvenger's Celebrity faces Dataset](https://www.kaggle.com/datasets/souvenger/celebrity-faces-dataset), version 1, pinned to SHA-256 `63d1da6a330ec9f69f8a4e24715fb9af5fdcd7e494efb4ccae2437d1c0667f32`. It contains 157 images and 156 matching label rows; the unlabeled Gordon Ramsay file is skipped. This is a small celebrity collection, not the 600,000-person Wikifaces dataset. Its uploader lists CDLA-Permissive 1.0 for the dataset and describes public-domain/social-media image sources. That claim is stored separately from individual image licensing, which remains unverified. Some labels are misspelled and need correction.

Imports create `people` and `portraits` rows, with files in the **private** `portrait-imports` bucket. New imported entries start pending until explicitly reviewed. Existing curated names reuse seed IDs, aliases, hints, and category memberships; other people retain source labels and require identity/hint curation. `catalog:categories` adds pending, overlapping category suggestions using `data/import-categories.json`; authors and otherwise unclassified people fall under Other. Re-importing skips existing matching rows without overwriting review decisions or manual corrections. Failed database writes may leave an uploaded object; rerunning reuses its content-addressed path and finishes the row insertion.

The Supabase `portraits` table shows labels, Storage paths, dimensions, source metadata, and review state. Actual image bytes are in Storage, not table cells. To make content playable later, review identity, quality, category, hint, and source rights, then connect the game's API to approved catalog rows. The game serves approved cloud rows; older person-based portrait URLs resolve through Supabase as well.

### Actual import status

The Supabase connection and schema were verified. The first batch imported 20 portraits, the next imported the remaining 136, and a resume run skipped all 156 with zero failures. Remote verification found **156 people, 156 portrait rows, and 156 matching WebP Storage objects**, all pending, with no missing files. One stored object was downloaded and decoded successfully. The source's one unlabeled image was excluded. A local dry run decoded/converted all 156 labeled images before upload.

The active category catalog is Actors, World leaders, CEOs & Founders, Musicians, Athletes, TV & Reality, and Other. Writers is folded into Other. Pending category suggestions currently cover 55 actors, 7 world leaders, 7 CEOs/founders, 47 musicians, 15 athletes, 24 TV/reality people, and 15 others; memberships can overlap. Legacy Politicians rows are kept for historical references and hidden from the picker. The three curated categories are playable from Supabase; the additional categories remain Coming soon until enough content is reviewed.

Type checking, lint, and the production build passed after the importer/category changes. No automated test suite was run or expanded. Credentials, source archives, generated images, and local reports remain ignored by Git. The import itself left all Kaggle files pending; the later cloud-game setup separately enables the reviewed Commons portraits.

## Cloud gameplay and daily Cron

After configuring `.env`, apply both SQL files under `supabase/migrations/` in order. The second migration creates the approved-content view and daily generator, and enables **blurrle-daily-selection** at **00:00 UTC** in Supabase Cron. The owner has applied these migrations to the current project.

```sh
npm run catalog:curate
npm run catalog:daily
npm run dev
```

`catalog:curate` uploads the 15 curated Commons portraits plus Aaron Paul with credits and licenses, and populates the initial Actors game with **Leonardo DiCaprio, Keanu Reeves, Aaron Paul, Emma Watson, and Bryan Cranston**, shuffled once. It preserves existing complete daily sets. Aaron Paul's portrait has its identifying placard cropped out. The owner subsequently approved the full current catalog using the review workflow below; future dataset imports still start pending.

`catalog:daily` is an optional manual trigger; the scheduled job works inside Supabase without the development machine running. Use `npm run catalog:daily -- --day YYYY-MM-DD` for another UTC date. In Supabase, **Integrations → Cron** shows the job and its run history. The SQL function `blurrle_daily_job_status()` also exposes a restricted status check. The generator fills all categories that have five reviewed people and skips those that do not. Repeats remain possible with this small pool.

The Express API reads `daily_images`, then resolves the selected profiles and portraits. Stable opaque `/portraits/<24-hex-id>.webp` URLs proxy approved image bytes from private Storage using the backend key. The browser receives neither credentials nor expiring Storage links. The film-strip background samples randomly from the full cloud image catalog, including pending Kaggle imports. `/api/backgrounds` paginates all eligible metadata, shuffles it, and returns up to 64 opaque background URLs on each landing/results mount. Backgrounds have a separate proxy route; the guessing game still uses only reviewed daily portraits. Photo credits cover both sources and distinguish unverified dataset-level license claims from individual image licenses. Local 12-hex image URLs remain available for old pinned attempts. Existing scores are preserved; complete an old open attempt before starting/replaying the new cloud set.

### Cloud gameplay verification

The second migration was applied successfully and the `blurrle-daily-selection` Cron job is active with schedule `0 0 * * *` (midnight UTC). Its first scheduled run has not occurred yet; manual generation calls succeeded and preserved existing sets. The 2026-10-27 Actors rows were saved in this order: Emma Watson, Bryan Cranston, Leonardo DiCaprio, Aaron Paul, Keanu Reeves. World leaders and CEOs & Founders also have five saved rows; the remaining categories have insufficient reviewed content and stay disabled.

The production API was checked against the real Supabase project: all five game images loaded through the private Storage proxy, repeat generation preserved the exact response/order, and a 64-image background sample included 59 pending dataset imports and reshuffled on the next request. Credits covered all 172 image records. An imported background image loaded through its dedicated route and was correctly unavailable as an unreviewed game portrait. Type checking, lint, and the production build passed. No automated regression suite or browser UI flow was run for this change; visual feel remains for owner playtesting.

## Full-catalog review

The owner reviewed all 166 current people and authorized their 172 portraits for gameplay. The exact IDs are pinned in `data/catalog-review.json`, so future imports stay pending. `data/catalog-hints.json` supplies 150 short missing clues, and `data/catalog-name-corrections.json` fixes clear label typos while retaining the original spellings as accepted aliases and original portrait metadata.

Apply the third SQL migration, then use:

```sh
npm run catalog:review
npm run catalog:review -- --apply
```

The first command validates without changing Supabase. `--apply` backs up affected rows in ignored `var/catalog-review/`, preserves existing hints and provenance, records the owner's review, and fills newly ready daily categories. Existing complete daily sets and recorded scores are preserved. Individual photo-license fields are not invented: explicitly owner-reviewed images can participate using the recorded dataset provenance, while credits clearly distinguish dataset-level license claims from verified individual image licenses.

The film background now has 26 angled front strips plus 12 scrolling back strips on desktop, or 16 front plus 8 back strips on mobile. The back layer fills holes between angled strips. Scoring now holds about 991 points at 2.5 seconds and 952 at halfway, before accelerating to zero at 10 seconds; wrong guesses still cost 100 points each.

### Full-catalog activation results

Owner approval was applied successfully: **166 approved people, 172 approved portraits, zero missing hints, and 166 eligible people**. All seven categories now have five saved images for the current UTC day. Eligible pools are Actors 59, World leaders 10, CEOs & Founders 10, Musicians 47, Athletes 15, TV & Reality 24, and Other 15; memberships overlap. The original three daily sets were preserved and the four previously unavailable categories were filled. Cron remains active for midnight UTC. New imports outside the pinned review IDs still start pending.

Type checking, lint, and the production build passed after the activation, film-strip, and scoring changes. No automated regression suite or browser UI flow was run. Layout/animation feel is left to owner playtesting.

## Supabase-only runtime

SQLite, its native npm dependency, local migrations, seeding commands, and local static portrait serving have been removed. The backend requires Supabase credentials at startup. Browser scores and attempts are preserved; legacy person-based portrait URLs resolve to approved cloud portraits. The importer retains its ignored local caches, but production does not need them.

## Deploy on Vercel

`vercel.json` builds the Vite frontend into `dist/client`. `api/index.ts` exports the Express API as a Vercel Function. Rewrites send API requests and private portrait/background proxies to that function; Vercel serves frontend assets directly. There is no persistent local server or local database to configure.

1. Push the current code to the GitHub repository before importing it; Vercel deploys the selected Git commit, not local edits.
2. In Vercel choose **Add New → Project**, import `a13x4nder05/blurrle`, and keep the repository root as Root Directory. Use **Vite**, **Node.js 24.x**, build command `npm run build`, and output directory `dist/client` (the checked-in configuration provides these build settings).
3. Add environment variables in the import screen or **Settings → Environment Variables**, selecting Production and Preview:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | Your existing HTTPS Supabase project URL |
   | `SUPABASE_SECRET_KEY` | The server secret from your local `.env` |
   | `SUPABASE_PORTRAIT_BUCKET` | `portrait-imports` (optional; this is the import default) |

   Copy each value without surrounding quotes. Do not upload `.env`, use `VITE_` prefixes, or configure `HOST`, `PORT`, `DATABASE_PATH`, or `CONTENT_BACKEND`.
4. Click **Deploy**. If adding variables after a deployment, redeploy from the Deployments tab; environment changes apply only to new deployments.
5. Open `/api/categories` on the deployed domain, then play a category. Supabase tables, private images, and the midnight UTC job are already provisioned; importing the repo does not require re-importing portraits.

Future pushes to the connected production branch (`main`) deploy automatically. Browser-local progress on localhost does not transfer to the Vercel domain. Preparing this configuration does not deploy the site; deployment is started in Vercel.

References: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js), [rewrites](https://vercel.com/docs/routing/rewrites), [environment variables](https://vercel.com/docs/environment-variables).

Supabase-only verification: type checking, lint, and the production build passed. Both existing API checks passed after adapting them to mocked Supabase responses. A local invocation of the Vercel entry point against real Supabase returned seven ready categories, five Actors rounds, and WebP responses for game, background, and legacy portrait URLs, with no local database present. No hosted Vercel build/deployment or browser UI flow was run.
