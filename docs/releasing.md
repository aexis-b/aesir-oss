# Releasing

## Versioning

Use semantic version tags for public releases:

- `v0.1.0`
- `v0.1.1`
- `v0.2.0`

## Before tagging

- update `CHANGELOG.md`
- run `npm test`
- run `npm run lint`
- run `npm run build`
- verify docs still match current behavior

## Create a local annotated tag

```bash
git tag -a v0.1.0 -m "Aesir OSS v0.1.0"
```

## Suggested first public release flow

1. Confirm the repo name, README copy, and issue labels.
2. Push the repository.
3. Push the release tag.
4. Publish a GitHub release using `.github/release.yml` categories.
