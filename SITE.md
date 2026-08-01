# Website build

`README.md` remains the single source of truth for site content. The website is a minimal documentation layout with a generated desktop sidebar and a mobile navigation drawer.

## Local development

Requirements: Node.js 24 or newer. There are no npm dependencies.

```sh
npm run build
```

Open `dist/index.html` in a browser. To build and run validation checks:

```sh
npm run check
```

## Site options

Display-only options live in `site/config.json`; README content does not need to change.

```json
{
  "renderLeadImage": true
}
```

The standalone image immediately below the README title is rendered by default. Set `renderLeadImage` to `false` to hide it. Commit the config change and the existing `site/**` workflow trigger will rebuild and deploy the site.

## README mapping

The generator renders the existing README structure directly:

- The first `#` heading becomes the site title.
- Every following `#` heading becomes a document section and sidebar link.
- `##` and `###` headings become nested document headings.
- Paragraphs are rendered in source order.
- Top-level list items become resource rows.
- Nested list items become notes under their parent row.
- The first link in a row receives primary-link styling; additional links receive quieter utility-link styling.
- Top-level list items outside `Introduction` become searchable resources.
- Resource and section counts are calculated during the build.

The standalone image immediately below the README title is rendered by default and can be disabled through `site/config.json`.

No section descriptions, lift cards, promotional headings, or other editorial content are maintained separately from the README.

## Files

- `README.md` — all site content.
- `site/config.json` — display-only build options, including the README lead image toggle.
- `site/template.html` — semantic page shell and sidebar.
- `site/styles.css` — light documentation styling and responsive layout.
- `site/app.js` — resource filtering, mobile navigation, keyboard search, and active-section state.
- `scripts/build-site.mjs` — Markdown parsing and HTML generation.
- `scripts/check-site.mjs` — generated-output validation against the README structure, text, links, resource count, and required interface behavior.
- `dist/` — generated output; do not edit by hand.

## Search behavior

The search field indexes the 59 current top-level resource entries after `Introduction`. Search data is generated from each row, its nested notes, and its surrounding section/category headings. `/` focuses the search field. Pressing Escape clears an active search or closes the mobile sidebar.

The count is not hardcoded. If the README is later edited, the generated count and validation expectations update from the Markdown. The current validator also confirms that all 95 non-image README text lines and all 88 README content links are represented in the generated HTML.

## Responsive behavior

The mobile drawer is removed from the focus order while closed and marks the obscured document inert while open. The `/` shortcut opens the drawer and focuses search on mobile.

## GitHub Pages

The existing workflow at `.github/workflows/pages.yml` requires no changes. It already runs when the README, site assets, generator, package metadata, Node version, or workflow changes. It executes `npm run check`, uploads `dist/`, and deploys it to GitHub Pages.
