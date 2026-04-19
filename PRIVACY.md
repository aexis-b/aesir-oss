# Privacy

## Local-first by default

Aesir OSS is designed to work against a Hermes installation that already exists
on your machine. It reads local Hermes profile and session data to build the UI.

## What the app reads locally

- Hermes home and profile directories
- local transcript and session metadata
- local auth metadata when provider status or usage information is requested
- local session data stored in `data/sessions.json`

## What the app may send over the network

- Hermes CLI may call its configured providers, depending on your local Hermes setup
- optional OpenRouter or OpenAI-compatible fallbacks send chat requests to those providers
- usage summary requests may call provider-backed usage endpoints when profile auth data is available

## What this repo does not include

- no bundled user transcripts
- no committed auth tokens
- no committed local session data

## Contributor note

When sharing logs, screenshots, or issue reports, review them for profile names,
paths, tokens, or transcript content before posting publicly.
