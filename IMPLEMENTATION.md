# Blurrle implementation recipe

Implement this recipe in order and continue through verification and handoff. This document specifies the prototype's technical plan; `SPEC.md` defines the product, `AGENTS.md` defines working practices, and `PERMISSIONS.md` defines authorization. The owner's latest instructions take precedence. Do not begin deployment or add features outside that scope.

## 1. Inspect and establish the stack

1. Read the three documents above and inspect repository files and Git status. Preserve existing work.
2. If application code already exists, follow its conventions and adapt this recipe without replacing a working stack. Otherwise use TypeScript throughout, React with Vite for the client, Express for the API, and SQLite through `better-sqlite3` for storage. Use plain CSS rather than a component framework.
3. Use npm and commit one lockfile. Choose mutually compatible stable package versions and a supported Node LTS runtime; check official documentation during implementation rather than relying on remembered version requirements. Record the runtime in `.nvmrc` and `package.json` engines.
4. Add Vitest for focused logic/API tests and Playwright for browser verification. Use `tsx` to run TypeScript server and database scripts, and a small process runner for the combined development command.
5. Configure the Vite development server to proxy `/api` to Express. In production, Express serves the built client and local portrait assets. Keep the API bound to localhost by default.

Use this layout, adapting names only to fit existing conventions:

```text
src/
  App.tsx
  components/{Landing,Game,Results}.tsx
  game/{types,scoring,answers,clock,reducer,storage}.ts
  styles.css
server/
  index.ts
  app.ts
  db.ts
  daily.ts
  migrations/001_initial.sql
scripts/
  migrate.ts
  seed.ts
  download-images.ts
data/
  people.json
  images/                 # downloaded portraits with opaque filenames
tests/
  unit/
  integration/
  e2e/
README.md
.env.example
```

Expose these commands: `npm run dev`, `db:migrate`, `db:seed`, `assets:fetch`, `typecheck`, `lint`, `test`, `test:e2e`, `build`, and `start`. `build` must compile both server and client; `start` must run compiled output without development tooling. Document the initial installation and command order.

## 2. Create the content and database

1. Create these category slugs and labels: `actors` / Actors, `world-leaders` / World leaders, `politicians` / Politicians, and `ceos-founders` / CEOs / founders.
2. Curate at least five distinct people per category. People may belong to multiple categories. Each person needs a stable opaque ID, canonical name, explicit aliases, one useful hint, category memberships, and a real portrait.
3. Obtain portraits from a public source with usable licensing information. Store source page URL, original asset URL, creator, license name/URL, and required attribution in the checked-in manifest. Do not fabricate names, image provenance, or licensing metadata.
4. Make `assets:fetch` download the manifest's selected images to opaque filenames under `data/images/`. Validate successful responses and usable image files. Serve these files at `/portraits/:opaqueFilename`; never derive filenames from names. Gameplay must use downloaded assets rather than live image-search requests.
5. Keep downloaded assets out of Git by default and make setup reproducible through the manifest and download script. Supply an accessible credits view linked from the landing page, outside the timed game, satisfying each asset's attribution requirements.
6. Add versioned migrations with these tables and constraints:
   - `schema_migrations(version PRIMARY KEY)`.
   - `categories(slug PRIMARY KEY, label)`.
   - `people(id PRIMARY KEY, name, hint, image_path, source_page_url, source_asset_url, creator, license_name, license_url, attribution)`.
   - `person_aliases(person_id REFERENCES people, alias, PRIMARY KEY(person_id, alias))`.
   - `person_categories(person_id REFERENCES people, category_slug REFERENCES categories, PRIMARY KEY(person_id, category_slug))`.
   - `daily_images(day, category_slug REFERENCES categories, position, person_id REFERENCES people, PRIMARY KEY(day, category_slug, position), UNIQUE(day, category_slug, person_id))`, with positions restricted to 0–4.
7. Enable SQLite foreign keys, use parameterized statements, and apply migrations transactionally. Read the database path from `DATABASE_PATH`, defaulting to a local ignored file such as `var/blurrle.sqlite`.
8. Make seeding idempotent and transactional. Validate aliases, memberships, portrait availability, and at least five eligible people per category. Do not delete existing daily selections or user data on seed.

Completion check: a fresh checkout can download images, migrate, and seed using the documented commands. Repeating migration and seed succeeds without changing already published daily selections.

## 3. Implement daily selection and the API

1. Use UTC calendar dates (`YYYY-MM-DD`) for daily games, calculated by the server.
2. To create a category's daily selection, rank eligible people by the hexadecimal SHA-256 digest of `blurrle-v1:<day>:<category>:<personId>`, breaking ties by ID. Choose the first five distinct people and persist positions 0–4.
3. Read existing rows first. Create a missing set inside a transaction with appropriate SQLite locking and recheck inside that transaction. Concurrent requests must return the same complete set, never a partial set.
4. Once persisted, a day's selection must not be recomputed when the content catalog changes. If fewer than five valid portraits are available, return a clear unavailable response rather than returning an incomplete game.
5. Add `GET /api/categories`, returning category slugs and labels.
6. Add `GET /api/daily/:category`, validating the category against the database. Return `{ day, category, rounds }`; each ordered round contains `personId`, `imageUrl`, `name`, `acceptedAnswers`, and `hint`. Include the canonical name in accepted answers.
7. Use appropriate error statuses and concise error messages. Disable caching of daily API responses so a cached response does not become tomorrow's game. Versioned portrait files may be cached.
8. Include no score-submission endpoint: scores and attempts are stored in the browser for this prototype. Answers being inspectable in network responses and browser storage is an accepted prototype limitation; document it. Do not imply tamper resistance.

Completion check: repeated requests for a date/category produce identical ordered IDs, different clients share that set, and unsupported categories and insufficient content fail clearly.

## 4. Implement pure game rules

1. Define typed objects for the daily payload, active attempt, active round, completed round, and recorded daily score.
2. Implement `score(elapsedMs, wrongGuesses)` as:

   ```text
   elapsedSeconds = clamp(elapsedMs, 0, 10000) / 1000
   max(0, floor(1000 * (1 - expm1(3.6 * elapsedSeconds / 10) / expm1(3.6)))
          - 100 * wrongGuesses)
   ```

   Use an exponential steepness of 3.6, normalized to 1,000 points at zero elapsed time and zero at 10 seconds. The loss starts slowly and accelerates noticeably by halfway; wrong guesses still subtract 100 points each. Keep image unblurring and the timer bar linear. Preserve previously completed results and recorded scores.

   A timeout always earns zero. A correct guess received at or after 10,000 ms is a timeout.
3. Normalize with Unicode NFKD, remove combining marks, lowercase, remove apostrophes, and collapse punctuation/whitespace into word boundaries. Match canonical names, aliases, and first/last name parts of at least three characters. Permit one edit for four-to-eight-letter names and two for longer names, counting adjacent transpositions as one. Require the same word count for fuzzy comparisons and reject ambiguous guesses with equal or closer matches among other daily faces. Keep matching shared between the reducer and visual feedback. Do not use arbitrary substring matching.
4. Ignore empty guesses without a penalty. Each nonempty incorrect submission during an active round adds one wrong guess. Prevent duplicate processing of one submission event; a deliberate later resubmission remains a new guess.
5. Model transitions explicitly: `landing -> loading -> playing -> round-result -> loading ... -> results -> landing`, with a `playing -> hint -> playing` pause, with a recoverable loading-error state. After the fifth `round-result`, advance directly to `results`.
6. Only active rounds accept guesses, hints, and skips. A skip records a distinct skipped result for zero points. End immediately with an exhausted result when penalties and time decay leave zero points, including on the wrong guess that reaches zero. The single free hint action stores exact elapsed time, sets `hintUsed = true`, and enters the persisted `hint` phase. Determine game-wide use from the current round and completed result metadata; do not grant another hint on the next face or on refresh. The timer, score decay, and blur freeze until the card is dismissed. Resume by rebasing the start time and deadline from that elapsed time; do not count reading time. Later hint requests cannot pause again. Hints have no score penalty. Completed results are immutable.

Completion check: verify scoring at 0, 5,000, and 10,000 ms; combined penalties; zero clamping; exact deadline behavior; answer normalization; and rejection of actions after a round ends.

## 5. Add clocks, refresh recovery, and score persistence

1. Store versioned browser data under separate keys for active attempts and recorded scores. Key each attempt/record by UTC day and category. Validate parsed data and recover from invalid JSON or storage failures without crashing.
2. Save the full daily payload with the attempt. Pin it for all five rounds, even across midnight or a refresh. New attempts use the server's current date; a pending older attempt can still be resumed from its snapshot.
3. Persist round start time, deadline, highest observed elapsed time, wrong-guess count, hint state, round index, completed results, and current phase. Persist immediately after meaningful actions, not on every animation frame.
4. Use a monotonic clock for elapsed time during a mounted round and an absolute wall-clock deadline for reload recovery. At startup or resume, reconcile persisted elapsed time and the deadline, clamp to 10 seconds, and never move a round's elapsed time backward. Document that device-clock manipulation cannot be fully prevented by this local prototype.
5. Use animation frames only to render progress. On guess, hint, visibility changes, and resume, calculate elapsed time afresh and enforce timeout before accepting actions. Backgrounding and refreshing do not pause or restart a running round. The explicit hint phase is paused, remains paused across refresh, and does not accumulate wall time.
6. On refresh, expired active rounds recover as fully revealed timeout results. For unexpired rounds, restore the original deadline; image loading during recovery does not grant extra time.
7. For a new round, preload and decode its portrait before setting the start time. Preload the next portrait during the current round. On Enter, start immediately if it is ready; otherwise show loading without starting that new round's clock. Failed loads offer retry or return to landing without charging round time.
8. Save the final results and create a recorded score only when no record exists for that category/day. Returning to landing or replaying must preserve it. Recheck storage at completion to avoid overwriting a record written by another tab; document that cross-tab atomic guarantees are outside this prototype.
9. Resume an unfinished attempt when its category is chosen. Allow completed games to be replayed with a new attempt, preserving the official record. Keep replay results separate from the recorded result.

Completion check: reload during playing, after a hint, after a wrong guess, on a round result, and on final results. Verify penalties, deadlines, results, and first completed scores survive. Also test a round crossing UTC midnight.

## 6. Build the three views

1. Landing: centered text logo, labeled category dropdown, Play/Resume/Replay button as appropriate, selected category's recorded score labeled “Your score for today”, and a dimmed credits link at bottom left. No leaderboard.
2. Game: large consistently framed portrait, transparent bottom controls without a surrounding card, labeled input, submit control, hint button with a Shift+Enter badge and a used state for the rest of the game, timer bar, and current available points. Show round progress as `1 / 5`. Place clearly styled Skip and Hint buttons together on the right below the input. Remove the numeric seconds counter. Skip reveals the answer for zero points and waits for intentional advancement.
3. Render blur using CSS, initially 32 px, decreasing linearly to zero over 10 seconds using the clock's progress. Clip the image container to hide blurred edges. On a correct guess, freeze scoring immediately and animate the remaining blur to zero over about 850 ms. A timeout is already fully clear; a skip reveals the image for zero points. Tune the initial blur after checking actual portraits without changing the round duration or scoring formula.
4. Round result: reveal the canonical name, awarded points, outcome, and a visible Next button (See results after round five). Retain the image and wait for intentional advancement.
5. Results: show five image/result items in one row on larger screens, adapting to a compact grid on small screens; show the total and a return button. Identify replay results in the score heading when a previous recorded score exists. Omit image number badges and explanatory text below the total.
6. Show hints in an animated, accessible modal card matching the theme. Use native dialog focus containment, focus Continue guessing on open, and restore input focus on resume. Use the title “Here’s your clue.”, larger hint copy, and a highlighted Continue guessing button with an Enter badge; omit the icon, pause label, and footer copy. Support Continue, a fresh Enter press, and Escape. Escape skips during active play but only dismisses an open hint card. Keep Enter handling scoped to the current phase. Ignore held-key repeat and composition events. Consume Shift+Enter for hints before form submission. A keydown that submits an answer cannot advance the new result state; require key release and a fresh press. Do not let global shortcuts override focused buttons or the category dropdown.
7. Focus the input when a round starts and focus the next action after completion. Use neutral image alternative text during play and the canonical name after reveal. Announce result changes, not each timer frame.
8. Use `100dvh`, responsive sizing, safe-area padding, visible focus, and readable contrast. Keep touch controls comfortably sized. Check the on-screen keyboard and allow scrolling for zoom or short viewports rather than clipping controls. Reduced-motion preferences should suppress decorative animation without changing reveal timing.
9. Use the charcoal, coral, and cream theme throughout. Landing and results share a scrolling film-column portrait mosaic with varied rotations, alternating directions, and a readability overlay. Keep the wordmark (blurred “blurr”, clear “le”), use the same styling for the small game wordmark, and retain the single-line tagline, and essential controls; omit header badges and footer bars. Add a smooth correct-answer reveal, brief celebratory particles and score pop, and a red input/text shake plus a fast “−100” popup above the centered points counter on wrong guesses. Respect reduced motion.
10. Add a bottom-right help button to landing and results that opens a native dialog matching the hint card. Loop four wireframe scenes every 5.2 seconds: recognition and unblurring, a textbox zoom with obscured typing, using the one free hint, and a friends/leaderboard preview labeled coming soon. Show only one description beneath each animation, without a secondary line; keep the coming-soon status in the leaderboard description. Add manual step selection and Enter-labeled close, without a play/pause control. Disable automatic cycling and decorative motion under reduced-motion preferences. Keep results keyboard shortcuts from overriding modal and button interaction. Use fourteen desktop/eight mobile film columns with distinct angles from −21° to +19°, individual vertical offsets, transform origins, and overlap order, tall portrait sequences, and overscan to maintain edge-to-edge coverage throughout the loop.
11. Handle initial API errors, asset failures, and unavailable browser storage with concise recovery messages. Avoid exposing stack traces or infrastructure details in the interface.

Completion check: play all five rounds with both keyboard and touch controls, then replay and switch categories. Inspect desktop and narrow mobile layouts, including the software keyboard where tools permit.

## 7. Verify the integrated prototype

1. Per the owner’s latest instruction, focus on the product and keep verification to the absolute minimum: type checking, lint, a production build, and a brief visual check when a browser is available. The owner will request additional testing if playtesting reveals failures. Maintain existing tests when behavior changes, but do not expand the suite or run a broader regression pass without a concrete need.
2. Existing focused integration tests cover complete deterministic daily selection, preserved selections after reseeding, insufficient content, and API validation. Use a disposable temporary SQLite database.
3. Keep the existing single browser smoke flow available for requested follow-up verification: five rounds, with a hint, a wrong guess, a timeout, refresh recovery, fresh-Enter advancement, and a replay score check. Verify independent category data in the API check. Use controlled time rather than long real-time sleeps. Leave difficulty, visual tuning, and broader exploratory testing to the owner’s playtesting.
4. Keep production and development setup documented; check startup or routing when changes affect them.
5. Briefly inspect the real curated images and rendered UI with available browser tools when possible; leave difficulty and feel to the owner’s playtesting. Test-only fixtures are not a substitute for the playable seed dataset.
6. Check that no real secrets, local databases, downloaded build artifacts, or unrelated changes are included in the proposed change. Record actual verification results and any environmental limitations.

## 8. Document and hand off

1. Write the README with exact fresh-install commands, runtime requirements, environment options, database/image setup, development and production commands, checks, UTC policy, accepted-answer policy, credits, and content-update instructions.
2. Explain that the minimum five-person pool per category repeats people on subsequent days, even though ordering may change. Document the actual pool sizes and expand the manifest when more variety is needed; do not promise daily novelty the dataset cannot provide.
3. Explain browser-local scores, refresh behavior, inspectable answers, device-clock limitations, and the absence of accounts and leaderboards.
4. Update documentation if implementation required a material deviation. Finish with what is implemented, how to run it, which checks passed, and any concrete remaining blocker. Do not deploy or push without separate authorization.

The task is complete when a fresh local setup can play every category through five rounds with real portraits, correct timing and scoring, recoverable progress, preserved recorded scores, working replay, and passing relevant checks.

## 9. Long-term roadmap

The completion criteria above apply to the initial prototype. Continue future development toward these goals as their implementation is scheduled:

1. **Build a huge portrait catalog.** Expand all offered categories through a reproducible import and review process. Preserve stable person IDs and existing daily selections. Verify identities, category memberships, canonical names, explicit aliases, hints, image provenance, licensing, and attribution. Validate downloaded files, detect duplicate people and images, and review framing and recognizability before making portraits eligible for play. Track usable people per category and daily variety; prioritize accuracy and usability over raw volume.
2. **Prepare public deployment.** Choose hosting and asset delivery suitable for the growing catalog, persist the database, provide backups and recovery, and verify the production game before launch. Public deployment, spending, and external service account creation still require the separate authorization described in `PERMISSIONS.md`.
3. **Add player accounts.** Implement account creation and authentication with server-side progress and score storage so players can resume across browsers and devices. Define how existing browser-local progress migrates and how account data can be deleted before implementation.
4. **Add leaderboards.** Define rankings by category and UTC day, using only the first completed score for each player. Preserve replay protection. Move authoritative attempt timing, answer evaluation, penalties, and score recording to the server before publishing competitive rankings; add appropriate abuse prevention rather than trusting browser-submitted totals.

Keep the initial prototype's minimal interface and daily game rules as the foundation. Accounts, leaderboards, and public hosting are future milestones, not requirements for completing the local prototype.
