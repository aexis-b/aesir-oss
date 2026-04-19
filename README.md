# Aesir OSS

> A local-first desktop shell for Hermes profiles, sessions, and transcript history.

Aesir OSS is for people who already run Hermes locally and want a cleaner shell
around profile discovery, transcript imports, and day-to-day chat flows.

It discovers the Hermes installation already on your machine, reflects the real
profiles and sessions attached to that install, and gives you both a web app and
desktop shell for browsing, resuming, and continuing work.

## Why Aesir OSS

- local-first by default
- generic Hermes install discovery instead of hardcoded profiles
- read-only imports for Hermes transcript history
- lightweight writable local state for GUI-created sessions
- one codebase for web and Electron desktop workflows

## Feature set

- detects Hermes on disk, with `HERMES_HOME` and `HERMES_BIN` overrides
- discovers local Hermes profiles dynamically
- imports transcript history as read-only threads
- stores GUI-created sessions in a local JSON store
- supports Hermes CLI runtime, OpenRouter, or OpenAI-compatible fallback flows
- exposes usage summaries when profile auth data is available
- shows a first-run onboarding flow when Hermes is missing or incomplete

## Who this is for

Aesir OSS is a good fit if you:

- already use Hermes locally
- want a calmer shell for browsing and resuming profile-backed work
- want an open, inspectable codebase you can adapt to your own setup

## Requirements

- Node.js 20+
- Hermes installed locally
- macOS for the current desktop packaging workflow

Hermes docs:
- https://hermes-agent.nousresearch.com/docs/

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy the sample file if you need overrides:

```bash
cp .env.example .env.local
```

Available variables are documented in [.env.example](.env.example).

## Common commands

```bash
npm test
npm run lint
npm run build
npm run desktop:bundle
```

## Project docs

- [Architecture](docs/architecture.md)
- [Branding](docs/branding.md)
- [Releasing](docs/releasing.md)
- [OSS audit](docs/oss-audit.md)
- [Privacy](PRIVACY.md)
- [Security](SECURITY.md)
- [Support](SUPPORT.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## Release posture

- semver tags are expected for public releases
- issue labels are defined in `.github/labels.yml`
- GitHub release note categories are defined in `.github/release.yml`
- CI validates test, lint, and production build on pushes and pull requests

## Project status

Aesir OSS is early, but contributor-ready. The current emphasis is:

- stability around Hermes discovery and session bridging
- contributor experience and release hygiene
- better cross-machine packaging and distribution

## License

MIT. See [LICENSE](LICENSE).
