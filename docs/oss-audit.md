# OSS Audit

## Scope

This pass focused on making the repository safer and more legible as a public
open source project.

## What was checked

- no internal planning files in the public repo
- no committed local session data
- no committed auth tokens or `.env` files
- contributor docs, code of conduct, support, and security policy present
- issue templates, PR template, CI, release categories, and label taxonomy added
- README, package metadata, and app metadata aligned to public branding

## Validation

The public release candidate was validated locally with:

- `npm test`
- `npm run lint`
- `npm run build`
- `npm audit --audit-level=high`

Result:

- tests passed
- lint passed
- production build passed
- `npm audit` reported `0 vulnerabilities`

## Notable implementation notes

- Hermes CLI execution is an explicit part of the product and should remain documented
- provider fallbacks are optional and env-driven
- usage summary behavior depends on local profile auth state and external provider responses
- Next.js currently emits a non-blocking file tracing warning during build because Hermes discovery relies on filesystem inspection; the build still completes successfully

## Follow-up before public launch

- enable GitHub Discussions if you want community support separate from Issues
- enable GitHub Security Advisories
- push an annotated semver tag for the first release
- apply the label taxonomy from `.github/labels.yml`
