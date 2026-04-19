# Architecture

## Overview

Aesir is a local-first shell around an existing Hermes installation.

The app does not try to replace Hermes. Instead, it discovers a local Hermes
home, reads available profiles and transcript history, and provides a cleaner UI
for browsing and continuing that work.

## Main parts

- `src/app/`
  - Next.js App Router entrypoints and API routes
- `src/components/`
  - UI, including the main chat shell
- `src/lib/hermes-install.ts`
  - Hermes home and binary discovery
- `src/lib/profile-registry.ts`
  - dynamic profile metadata
- `src/lib/hermes-session-bridge.ts`
  - transcript import and bridging logic
- `src/lib/hermes-profile-runtime.ts`
  - profile-backed runtime execution
- `src/lib/session-store.ts`
  - local writable session state
- `electron/`
  - desktop entrypoint, preload, and packaging helpers

## Data model

- imported Hermes transcript threads are read-only
- new sessions created in the UI are stored in `data/sessions.json`
- profile-backed runs preserve Hermes session identifiers for resume behavior

## Release shape

- web development uses the Next.js app directly
- desktop packaging builds Next.js first, then wraps the production output in Electron
- packaging assets are sourced from `aesir.icon/` during the desktop build flow
