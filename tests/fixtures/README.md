# tests/fixtures

Static asset fixtures for Playwright E2E tests. Committed to the repo so
tests are deterministic and don't depend on network or runtime asset
generation.

## test-logo.png

A 600x600 solid-colour RGB PNG (slate-blue, RGB 55,86,109), ~2.3 KB.

Used by `tests/customizer-flow.spec.ts` to exercise the customiser's
client-side file checks (DPI estimation, raster-vs-vector classification,
dimension probe via `<img>.naturalWidth/Height`). A real on-disk PNG is
required because the customiser's pipeline is too strict to accept a
synthetic 1x1 buffer constructed in-memory at test time.

### Regenerating

The PNG is generated from pure-Node stdlib (no `sharp` / `pngjs` / PIL
dependency). To regenerate, restore `scripts/make-test-fixture.cjs` from
git history and run:

```sh
node scripts/make-test-fixture.cjs
```

The generator writes a manually CRC32'd PNG with `IHDR + IDAT + IEND`
chunks. See git log for the original commit
(`test(v2/customizer): real PNG fixture + un-fixme customizer-flow E2E`)
for the script content.
