# Contributing

Thanks for considering a contribution to Aesir OSS.

## Working principles

- keep Hermes discovery generic and local-first
- prefer small, testable changes over broad rewrites
- avoid assumptions about personal profiles, paths, or provider setups
- document behavior changes when they affect setup, packaging, or runtime modes

## Setup

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

## Pull request checklist

- keep the change scoped
- explain the user-facing impact
- include validation steps
- add or update tests for non-trivial behavior
- attach screenshots for UI work when useful

## Issue labels

The project label set is defined in `.github/labels.yml`.

Recommended starter issues for new contributors:

- `good first issue`
- `documentation`
- `tests`
- `packaging`

## Release notes

If your change is notable, add a short line to the `Unreleased` section of
[CHANGELOG.md](CHANGELOG.md).

## Community expectations

By participating in this project, you agree to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).
