# Project permissions

The project owner authorizes the agent to build the Blurrle prototype described in `SPEC.md` from start to finish, including implementation, local setup, testing, and fixes. Proceed autonomously with routine, reversible work instead of asking for approval at each step.

These permissions apply to this project and its development artifacts. They do not override system instructions, sandbox restrictions, tool approval requirements, or service access controls. This file records the owner's authorization; it does not grant technical access that the environment has not provided.

## Authorized work

- Read and inspect the repository, its history, and relevant local development configuration. Avoid exposing credentials or unrelated personal files.
- Create, edit, move, and remove project source files, documentation, assets, tests, configuration, and generated artifacts as needed. Preserve unrelated user work and existing secrets.
- Choose a suitable stack, architecture, dependencies, and development tools. Create the application and its package manifests, lockfiles, and configuration.
- Download, install, update, and run dependencies needed for this project using project-local environments where possible. Use standard package managers and avoid unnecessary machine-wide changes.
- Consult official documentation and public sources, make network requests needed for development, and download suitable image assets. Respect source terms and record image provenance and applicable license or attribution details.
- Implement all specified screens, game rules, category selection, daily image selection, answer handling, score persistence, and SQLite storage.
- Create and seed the development database. Run migrations and change its schema. Reset disposable test databases and generated sample data when needed; preserve existing user data.
- Create example environment files and configure local services. Use credentials already supplied for this project only for their intended purpose; keep secrets out of source control, logs, and browser bundles.
- Run formatters, linters, type checks, tests, builds, database tools, and browser-based verification. Install project testing tools if needed.
- Start and stop project development servers and other processes the agent launches. Open a local preview when supported, subject to environment approval requirements.
- Fix bugs and integration issues discovered during implementation or verification without requesting separate approval for each fix.
- Use read-only Git commands, create local branches, and make local commits when useful. Keep commits scoped to the task and do not include secrets or unrelated changes.

## Decisions the agent may make

- Resolve ordinary implementation details using `SPEC.md`, `AGENTS.md`, and sound engineering judgment.
- Choose reasonable defaults for unspecified details, document material assumptions, and continue working when they do not require an external commitment.
- Select a simple local persistence approach for player identity and recorded scores without introducing accounts for the prototype.
- Use local fixtures or a curated seed dataset if an external image service is unavailable. Clearly identify incomplete content and never present placeholders as verified data.

## Actions requiring separate authorization

- Spending money, subscribing to paid services, accepting new contracts, or creating external accounts.
- Publishing or deploying publicly, pushing commits, merging pull requests, or modifying shared or production infrastructure and data.
- Sending messages to other people or uploading private project data to an external service.
- Deleting unrelated files, discarding user changes, rewriting existing Git history, or removing non-disposable data.
- Changing system security settings, requesting broad credentials, or making unrelated machine-wide changes.

If an environment approval is required for authorized work, request it through the prescribed approval mechanism. If genuinely blocked, explain the specific blocker and the smallest action needed to proceed. Prepare and verify all work possible before requesting approval for a final external action.
