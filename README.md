# Aesir

Aesir is a local-first desktop shell for Hermes.

It discovers the Hermes installation already on your machine, shows the profiles
and transcript history that belong to that install, and gives you a calmer
desktop and web interface for starting or resuming chats.

## Highlights

- auto-detects Hermes on disk, with `HERMES_HOME` override support
- discovers local Hermes profiles dynamically
- imports transcript history as read-only threads
- keeps GUI-created thread state in a local JSON store
- runs as a Next.js web app and an Electron desktop app from the same codebase
- shows a first-run onboarding flow when Hermes is missing or incomplete

## Project status

Aesir is early, but functional. The current focus is:

- stability around Hermes discovery and session bridging
- contributor-friendly project structure and docs
- better desktop packaging and release workflows

## Requirements

- Node.js 20+
- Hermes installed locally
- macOS for the current desktop packaging workflow

Hermes documentation:
- https://hermes-agent.nousresearch.com/docs/

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm test
npm run lint
npm run build
npm run desktop:bundle
```

## Architecture

- Hermes transcript imports are read-only
- new GUI-created sessions are stored locally in `data/sessions.json`
- profile-backed runs preserve external Hermes session ids for resume flows
- Electron packaging reuses the production Next.js build output

See [docs/architecture.md](docs/architecture.md) for a higher-level overview.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), check
open issues, and feel free to propose improvements to the app, docs, testing, or
release workflow.

## Community

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Support](SUPPORT.md)

## License

MIT. See [LICENSE](LICENSE).
