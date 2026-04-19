# Security Policy

## Supported versions

Security fixes are prioritized for the latest development branch and the latest
tagged release.

## Reporting a vulnerability

Please do not open a public GitHub issue for security-sensitive bugs.

Preferred disclosure order:

1. Use GitHub Security Advisories if the public repository has them enabled.
2. If advisories are not enabled yet, contact the maintainer privately before
   public disclosure.

When reporting a vulnerability, include:

- affected version or commit
- clear reproduction steps
- expected impact
- suggested mitigation, if known

## Areas of interest

Security reports are especially helpful for:

- command execution and process spawning
- local file access and path handling
- transcript import and storage flows
- Electron preload or IPC boundaries
- packaged desktop behavior
- provider fallback and outbound request handling

## Disclosure goal

The goal is coordinated disclosure with a fix or mitigation ready before details
are shared publicly.
