# Working on Blurrle

## Scope and source of truth

Build the daily blurred-person guessing game described in `SPEC.md`. Read that file and `PERMISSIONS.md` before implementation. Follow the owner's latest instructions when they change the spec, and update documentation to reflect agreed changes.

Deliver a working prototype through implementation and verification. Resolve routine choices independently within the project permissions. Ask for clarification only when a consequential ambiguity cannot be resolved reasonably; continue independent work while waiting.

## Product requirements

- Keep the experience minimal: landing page, five-round game, and results page.
- Put a simple category dropdown on the landing page: actors, world leaders, politicians, and CEOs / founders.
- Provide the same five images in the same order to every player for a given category and day.
- Keep the category fixed throughout an attempt. Track daily recorded scores separately by category; replay results must not overwrite the first completed score.
- End a round immediately for zero points when wrong-guess penalties and time decay exhaust its available score. Reveal the person and wait for Next.
- Each round lasts 10 seconds. Unblur progressively and fully reveal the image on a correct answer or when time expires. Award zero on timeout.
- Use the exact scoring formula in `SPEC.md`: 1,000 starting points, accelerating exponential time decay, 100 points per wrong guess, and one free optional hint per five-round game. Clamp scores to zero.
- Support Shift+Enter and a visible mobile-friendly hint button. Allow the free hint on only one round per game, tracking its use across rounds and refresh. Pause the timer, score decay, and unblurring while an animated hint card is open; resume from the saved elapsed time when the player continues. Preserve the paused state on refresh.
- Wait for a fresh Enter press after a round ends. A correct-answer submission must not also advance. After round five, show results.
- Support Escape to skip an active face; inside the hint card, Escape only dismisses the card.
- Include a visible touch-friendly control for advancing rounds so the game remains usable without a physical keyboard.
- Show each image's result and the total, then allow return to the landing page.
- Exclude leaderboards, authentication, payments, and other unrequested features from the prototype.

## Implementation approach

- Inspect the existing repository before choosing tools. Preserve established conventions if a stack is already present; otherwise choose a small, maintainable stack and document setup commands.
- Prefer straightforward components, explicit game states, and a small number of dependencies. Avoid infrastructure or abstraction layers that the prototype does not need.
- Keep scoring, answer normalization, daily selection, and persistence rules separate from rendering so they can be verified directly.
- Use elapsed time from a reliable clock rather than counting animation frames or timer callbacks. Clamp elapsed time, freeze results at submission, and clean up timers on transitions and unmount.
- Prevent duplicate submissions, repeated hint use, and changes to completed round results. Shift+Enter must request a hint without also submitting a guess.
- Follow the forgiving name-matching policy in `SPEC.md`: normalized names and aliases, first names or surnames, and small spelling mistakes. Reject ambiguous matches within the pinned daily set. Document the policy.
- Use one documented daily boundary, defaulting to UTC. Pin the category, date, and image order when an attempt starts so midnight cannot change an active game's questions.
- Keep daily selection deterministic and persistent. Handle insufficient category content explicitly rather than silently producing different games for different players.
- Use SQLite for people, image references, accepted answers, hints, category memberships, and daily selections. For the prototype, browser storage may hold player progress and recorded scores; document its browser/device limitations.
- Preserve recorded scores on replay. Save enough active-attempt state to handle refresh consistently; refreshing must not reset an active round's timer or penalties.

## Images and content

- Prefer a curated, reproducible seed dataset over a fragile dependency on live image search during gameplay.
- Record image source URLs and applicable license or attribution information. Use assets permitted for the intended use and follow attribution requirements.
- Provide at least five usable people per offered category for the initial playable day. Explain how future daily sets are populated and how long the supplied dataset supports play.
- Load the image before starting its round timer. Handle unavailable images with a clear recovery path; do not run the timer against an empty screen.
- Frame portraits consistently and verify that the blur effect makes the round playable.
- Do not expose answers through image filenames, visible loading text, or accessible labels during an active round. Provide the person's name after the round ends.

## Interface and accessibility

- Follow the spec's restrained visual style: prominent logo, focused game image, readable controls, and minimal supporting text.
- Fit primary views within the viewport across desktop and mobile, accounting for the on-screen keyboard. Keep controls usable and allow scrolling when necessary for accessibility or very small screens.
- Support keyboard and touch interaction, visible focus, properly labeled controls, sufficient contrast, and reduced-motion preferences.
- Manage focus deliberately when entering a round and showing results. Make timer and result information accessible without announcing every animation frame.
- Keep essential controls visible over the image and distinguish active, correct, and timed-out states clearly.

## Verification and delivery

The owner’s latest instruction is to keep testing to the absolute minimum and focus on the product. Run type checking, lint, a build, and a brief visual check when available. Maintain existing rule/API tests and the single smoke flow as behavior changes, but do not expand or routinely run the suite. The owner will request additional testing if something fails during playtesting.

- Keep the existing focused tests aligned with consequential rules: scoring boundaries and penalties, timeout behavior, accepted answers, deterministic daily selection, and recorded-score protection on replay.
- Leave broader flow verification to owner playtesting unless a concrete failure calls for targeted investigation.
- Run type checking, lint, and the production build. Inspect the interface at desktop and mobile sizes when browser tools are available. Report any verification that could not be performed.
- Do not add tests that merely reproduce implementation details or expand testing after sufficient checks pass without a concrete reason.
- Maintain a README with setup, environment variables, database initialization and seeding, development and build commands, verification commands, daily reset policy, and known limitations.
- Keep secrets out of tracked files. Provide `.env.example` if configuration is needed, and ignore local databases, credentials, dependencies, and generated output as appropriate.
- Preserve unrelated changes. Do not deploy or push unless separately authorized under `PERMISSIONS.md`.
- Finish with a concise report of what works, how to run it, what was verified, and any remaining limitations. Do not claim unrun checks passed.
