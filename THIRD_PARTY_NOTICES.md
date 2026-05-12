# Third-Party Notices

This project self-hosts the following open-source font package for consistent editor rendering and export metadata.

## Noto Sans SC Variable

- Package: `@fontsource-variable/noto-sans-sc`
- Version: `5.2.10`
- Upstream font: Noto Sans SC, part of the Noto CJK family
- Package homepage: https://fontsource.org/fonts/noto-sans-sc
- Package registry: https://www.npmjs.com/package/@fontsource-variable/noto-sans-sc
- License: SIL Open Font License 1.1 (`OFL-1.1`)
- License text: https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE

The application imports the package CSS from `src/main.ts`, and Vite bundles the WOFF2 font assets into the built application. Export metadata records `Noto Sans SC Variable` so downstream renderers can use the same font contract instead of an undocumented system fallback.
