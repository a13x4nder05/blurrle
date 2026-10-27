## Project overview

Blurrle is a daily game where players guess a famous person from a picture that starts blurred and progressively becomes clearer. Faster correct guesses earn more points. Each daily game contains five images from the player's selected category, followed by a final score.

The first prototype does not include a leaderboard.

## User experience

- The landing page shows a large Blurrle logo, a category dropdown, and a button to play.
- The player chooses a category and starts the daily game with the Play button or Enter. Enter starts/resumes/replays the selected category when the landing page is ready; focused controls and open dialogs retain their own keyboard behavior.
- The first blurred image appears and its 10-second timer starts immediately.
- The player types a name and presses Enter to submit a guess. Wrong guesses reduce the available points.
- A correct guess ends scoring immediately and smoothly reveals the image. If time runs out, the image is already fully revealed and the round ends.
- The completed round shows the person's name and the points earned. The player presses Enter again to begin the next round.
- After five rounds, the player sees their final score and the points earned for each image.
- Pressing Enter or the return button on the final score page returns to the landing page.
- Players can replay a category's daily game, but replays do not replace or improve their first completed score for that category and day.

## Answer matching

Accept normalized full names and explicit aliases, plus first names and surnames of at least three characters derived from those names. Ignore capitalization, accents, punctuation, and extra whitespace. Allow one spelling edit for names of four to eight letters and up to two edits for longer names, including adjacent letter swaps. Require the same number of name words when matching typos so a different full name does not pass merely by sharing a first name. Reject ambiguous guesses when another person in the pinned daily set matches equally well or better. Do not accept arbitrary substrings or tiny fragments.

## Daily games and categories

- The landing page provides a simple category dropdown with these initial options:
  - Actors
  - World leaders
  - CEOs & Founders
  - Musicians
  - Athletes
  - TV & Reality
  - Other
- Each playable category has its own daily set of five images and its own recorded score. New categories without five reviewed, usable portraits are disabled and labeled Coming soon. Writers belong under Other, not a separate category. Politicians is removed from the picker; retain historical attempts, scores, and daily selections.
- All players choosing the same category on the same day receive the same five images in the same order.
- The selected category stays fixed for all five rounds. Players can choose another category on the landing page.

## Structure

### Landing page

- Keep extra text minimal: a large centered Blurrle logo, the category dropdown, and a play button.
- Show the player's recorded score for today in the selected category, if they have completed it, labeled “Your score for today”.
- Do not show daily rankings or a leaderboard in the first prototype.

### Game

- The image fills the screen, with a guess input near the bottom center.
- A timer bar underneath the input shows the time remaining. Show the points available for a correct guess at the current instant as well.
- Each round lasts up to 10 seconds. The image gradually unblurs over that period and is fully revealed when the timer reaches zero. There is no additional guessing time after the reveal.
- A correct guess ends the timer immediately, freezes the earned score, and smoothly animates the image to full clarity. Play a brief celebratory burst and score pop.
- When time runs out, the round ends and earns zero points. If penalties and time decay exhaust the available points earlier, end the round immediately for zero points, reveal the person, and wait for Next or a fresh Enter press.
- A visible Skip button ends the round for zero points and reveals the person. Wait for Next or a fresh Enter press before advancing.
- After a correct guess, timeout, exhausted score, or skip, show the person's name and the points earned, and wait for a new Enter press before advancing.
- The Enter press that submits a correct guess must not also advance to the next round.
- Pressing Enter after a completed round starts the next image and its timer immediately. After the fifth round, it opens the final score page.

### Scoring and hints

- Each round starts with 1,000 available points.
- Available points follow an accelerating exponential loss curve: decrease slowly at first, noticeably faster by halfway, and reach zero after 10 seconds. Before wrong-guess penalties, about 991 points remain at 2.5 seconds, 952 at 5 seconds, and 778 at 7.5 seconds.
- Each wrong guess subtracts another 100 points from the points available for that round.
- Each five-round game offers one free hint, usable on a single face, such as "The actor who played Walter White."
- Request the hint using Shift+Enter or a visible hint button that also works on mobile. Escape skips an active face. When the hint card is open, Escape dismisses the card without skipping.
- Revealing the hint has no point penalty and pauses the timer, score decay, and progressive unblurring. Show a prominent, larger hint in an animated card matching the charcoal/coral theme, titled “Here’s your clue.” Omit the star, pause label, and text below the button. Highlight Continue guessing with a visible Enter key badge matching the Next action. Continue guessing, a fresh Enter press, or Escape closes the card and resumes with the same remaining play time. Refreshing while reading the hint restores the paused card.
- After using the hint, mark it used and disable it for the rest of the five-round game, including after refresh or resume. A replay is a new game with its own hint.
- For a correct guess, calculate the score at submission as `max(0, floor(1000 × (1 - (exp(6 × elapsedSeconds / 10) - 1) / (exp(6) - 1))) - 100 × wrongGuesses)`.
- Scores never go below zero. The final score is the sum of the five round scores, with a maximum of 5,000 points.

### Final score

- Show the five images with the points earned for each, arranged in a row, with the final total underneath. Omit numbered image badges and the explanatory text below the total.
- Include a button underneath the results to return to the landing page. Enter also returns to the landing page.
- The landing page shows the recorded score for the completed category and day. A replay's score is shown on its results page but does not replace the recorded score.

## Style

- Keep all views minimal and focused. Use a dark charcoal background, warm coral accents, and cream text; remove the former lime theme.
- On the landing page, retain the large wordmark with “blurr” blurred and “le” clear. Use the single-line tagline “Famous faces. Beat the blur.” Keep category selection, play/resume/replay, score status, and a dimmed Photo credits control at bottom left. Omit decorative header badges, extra slogans, and footer bars.
- Use a shared animated portrait mosaic behind the landing and results views. Stack curated portraits in film-style columns with distinct varied rotations and overlapping edges. Alternate upward and downward scrolling by column, keeping all pictures in a column moving together in a seamless loop. Use 26 overlapping angled film columns on desktop and 16 on mobile, backed by another 12 scrolling strips on desktop and 8 on mobile. The unrotated back layer fills the spaces between tilted strips, with individual angles from −21° to +19°, staggered heights, and varied overlap order, with tall repeating sequences and overscan to keep portraits covering the screen edge to edge throughout the animation. Overlay the interface with enough shading for readable controls.
- During play, use a small wordmark matching the landing logo at top left (blurred “blurr”, clear “le”, coral period) and a larger category label. Place the points counter centered above the input, with the timer bar attached below the input. Remove the numeric seconds counter; the timer bar shows remaining time. Put clearly styled Skip and Hint buttons together on the right below the input. Do not wrap the controls in a white card or add explanatory text around them.
- Wrong guesses briefly shake and flash the input and its text red, and pop a visible red “−100” above the points counter before quickly fading it away. Preserve the wrong guess selected for easy correction.
- Results show the five portraits, per-face scores, total, replay status, and a return button over the shared mosaic. Omit corner badges, extra slogans, and footer bars.
- Fit primary views within one desktop or mobile viewport without routine scrolling. Allow scrolling for accessibility, on-screen keyboards, and unusually small screens when needed to keep controls usable.
- Put a small question-mark help button at bottom right on landing and results. It opens a minimal modal in the hint-card style with a looping four-step wireframe guide: recognize the person quickly; zoom into the textbox and type obscured text; demonstrate the single free hint; show competing with friends and climbing the daily leaderboard. Show only one description beneath each animation, with no secondary line. Identify leaderboards as coming soon within that description until implemented. Include step navigation and an Enter-labeled close button, without a play/pause control; reduced-motion mode uses manual navigation.
- Respect reduced-motion preferences: keep essential feedback visible while suppressing decorative scrolling, shake, and celebration motion.

## Images

- Use Supabase PostgreSQL for the live catalog and daily selections, and private Supabase Storage for approved portrait files. Supabase is required; there is no local database or offline catalog fallback.
- Images are sourced from an online API or database.
- Store each person's name, accepted answers, category memberships, and hint alongside the image reference.
- Store each category's daily image selection and order so every player receives the same game for that category and day.

## Cloud portrait catalog and import pipeline

The owner has authorized building a Supabase catalog and importing portraits into their project. Store person labels and portrait metadata in Supabase PostgreSQL tables, and actual image files in Supabase Storage. The game now reads its daily selections from Supabase using required server credentials. There is no alternate content backend.

- Use separate `people`, `portraits`, `categories`, `person_categories`, and `daily_images` tables. Keep a stable person ID independent of photo filenames, and allow multiple portraits per person.
- Import known-source datasets with a reproducible, resumable script. Pin the source version and archive checksum; read the actual label format, validate images, convert to WebP, detect duplicate image bytes, and use opaque Storage keys. Re-running must not duplicate records or overwrite corrections, approvals, hints, or daily selections.
- The first supported source is the owner's selected Kaggle dataset, `souvenger/celebrity-faces-dataset`, version 1. Its inspected archive contains 157 photos and 156 labeled rows in `Labels.csv`; the unlabeled photo is skipped. This is a small starting catalog, not the much larger Wikifaces collection.
- Preserve raw source labels and dataset-level licensing separately from verified per-image source, license, and attribution. Import all candidates as pending into a private `portrait-imports` bucket. Missing categories, hints, uncertain identities, misspelled labels, and image rights are review work; successful ingestion is not approval for gameplay.
- Reuse the existing curated seed's person IDs, aliases, hints, and memberships when names match. Do not automatically classify every celebrity as an actor. Unclassified people may be stored pending later curation.
- Keep Supabase keys server-side in ignored local configuration. Catalog tables use row-level security with no anonymous access; only the server import role can call the transactional import function.
- The daily-game API reads Supabase `daily_images` in saved position order. Images use stable opaque `/portraits/<24-hex-id>.webp` URLs: the backend verifies approval, downloads from private Storage using its server key, and serves WebP bytes. Client progress never depends on an expiring signed URL. Gameplay uses only approved cloud portraits. Keep the secret key and upload/admin access off the client.
- The film-roll background samples randomly from the full portrait catalog, including pending dataset imports, rather than only the reviewed gameplay pool. `/api/backgrounds` samples up to 64 images from all paginated portrait rows; a separate opaque `/backgrounds/<id>.webp` route serves them from private Storage. Only explicitly rejected people/photos are excluded. Resample on each landing/results mount; the daily game selection stays unchanged. Credits distinguish verified individual image licenses from dataset-level claims for imported backgrounds.
- Wikifaces remains a possible future source. Its downloadable archive, actual schema, and reuse terms must be verified before claiming that an importer supports it.

## Daily selection and cloud serving

- Supabase Cron runs `generate_blurrle_daily` at **00:00 UTC** using the `blurrle-daily-selection` job. The game API can call the same function on demand if a set is missing after a delayed job or paused project.
- Select five distinct people at random per ready category, using approved profiles with useful hints and approved portraits that exist in Storage. A portrait qualifies through individual source/license metadata or explicit owner approval for gameplay; unknown individual image rights remain marked as unknown, with dataset claims displayed separately. Save the random order once in `daily_images`. A transaction-level advisory lock protects concurrent calls; reruns preserve existing complete sets. Insufficient categories remain unavailable, and partial existing sets require explicit repair rather than silent replacement.
- `npm run catalog:daily` calls the same function manually. `--day YYYY-MM-DD` selects an explicit UTC date. No always-running laptop or GitHub workflow is required for the Supabase Cron job.
- The starter Actors set contains Leonardo DiCaprio, Keanu Reeves, Aaron Paul, Emma Watson, and Bryan Cranston in shuffled order. The initial reviewed pool contained the original 15 Commons portraits plus Aaron Paul, whose identifying name placard was cropped out. Their individual image credits and licenses are saved in Supabase. The owner has since reviewed the full catalog and authorized gameplay approval for all 166 current people and 172 portraits. Each person has a short hint; imported source labels remain recorded, with clear spelling corrections kept as accepted aliases. Future imports remain pending until separately reviewed.
- Preserve browser-local completed scores and existing attempt snapshots during the switch. Older saved attempts retain their pinned questions and scores; legacy person-based portrait URLs resolve to approved Supabase portraits. If Supabase fails, show a recoverable error.

## Long-term goals

These goals guide future development beyond the initial prototype:

- Build a huge database of usable, accurate portraits across all offered categories, with enough variety to sustain daily play over the long term. Prioritize correct identities, recognizable faces, consistent framing, useful hints, and verified accepted names and aliases over raw image count.
- Keep the portrait catalog reproducible and maintainable. Record source URLs, licenses, and required attribution; validate downloads, review image quality and identity, and detect duplicates before content becomes eligible for daily games. Continue serving curated assets rather than depending on live image search during play.
- Deploy Blurrle publicly so players can access the game online.
- Let players create accounts to preserve progress and recorded scores across browsers and devices.
- Add leaderboards based on each player's first completed score for a category and day. Replays must continue to preserve that recorded score. Public rankings will require server-validated scoring and measures against score manipulation.

Accounts and leaderboards remain outside the initial prototype. Public deployment is a future milestone; documenting it here does not authorize deployment, paid services, or creation of external service accounts under `PERMISSIONS.md`.
