# Contributing

Thanks for considering a contribution to Aesir.

## Before you start

- read the README for project scope and setup
- search existing issues before opening a new one
- prefer focused pull requests over large mixed changes

## Local setup

```bash
npm install
npm test
npm run lint
npm run build
```

Start the app locally:

```bash
npm run dev
```

Build the desktop bundle:

```bash
npm run desktop:bundle
```

## What makes a good contribution

- fixes a clear bug or improves a concrete workflow
- keeps Hermes discovery generic and local-first
- includes tests for non-trivial behavior changes
- updates docs when behavior or setup changes

## Pull request checklist

- keep the change scoped
- explain the user-facing impact
- include validation steps
- attach screenshots for UI work when helpful

## Areas where contributions are especially welcome

- install and onboarding edge cases
- Hermes profile discovery and transcript import
- Electron packaging and release automation
- tests, docs, and contributor experience

## Community expectations

By participating in this project, you agree to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).
