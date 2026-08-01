# Kettlebell Sport sidebar redesign — drop-in files

This archive is structured for extraction at the root of `beallio/kettlebell-sport`.

## Apply

1. Back up or commit the current working tree.
2. Extract this archive over the repository root, allowing these files to be replaced:
   - `site/template.html`
   - `site/styles.css`
   - `site/app.js`
   - `scripts/build-site.mjs`
   - `scripts/check-site.mjs`
   - `SITE.md`
   - `DEVELOPMENT.md`
3. Do not change `README.md`, `package.json`, `.node-version`, or `.github/workflows/pages.yml`.
4. Run:

```sh
npm run check
```

The current README should produce seven document sections, 59 searchable resources, 88 content links, and 95 non-image text lines. Commit and push the replacement files; the existing GitHub Pages workflow will rebuild and deploy `dist/`.

## Design behavior

- All visible document content is generated from the existing README.
- The first README heading supplies the site title.
- Subsequent level-one headings supply both the sidebar and main sections.
- Level-two and level-three headings, paragraphs, lists, links, formatting, and nested notes are rendered in source order.
- Search data and counts are generated during the build.
- The README's standalone lead image is omitted by default for the minimal layout. Set `RENDER_LEAD_IMAGE` to `true` in `scripts/build-site.mjs` to include it without editing the README.

No npm dependencies or workflow changes are introduced.
