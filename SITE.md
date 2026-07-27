# Website build

`README.md` is the single source of truth for site content.

## Local development

Requirements: Node.js 24 or newer. There are no npm dependencies.
The project pins Node 24 in `.node-version`, and the Pages workflow uses that same version for the build.

```bash
npm run build
```

Open `dist/index.html` in a browser. To build and run the lightweight validation checks:

```bash
npm run check
```

## What updates automatically

The generator understands the current README structure:

- `Introduction → What is Kettlebell Sport? → Lifts` becomes the lift cards.
- `Introduction → What is Kettlebell Sport? → Links` becomes the “Start here” list.
- Every top-level `#` section after `Introduction` becomes a resource-rack section.
- `##` and `###` headings become category headings.
- Markdown list items become searchable resource rows.
- Nested list items become notes under the parent resource.
- Markdown links and bold/emphasis are preserved.
- Link and resource counts are calculated during the build.

Normal content changes therefore require editing only `README.md`.

## GitHub Pages

The workflow at `.github/workflows/pages.yml` runs when the README, site template/assets, generator, or workflow changes. It builds `dist/`, validates it, uploads the Pages artifact, and deploys it.

In the repository, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions** once. After that, pushes to `main` deploy automatically.

## Files you edit

- `README.md` — content.
- `site/template.html` — page shell/layout.
- `site/styles.css` — visual design.
- `site/app.js` — browser behavior such as search.
- `scripts/build-site.mjs` — README parsing/rendering rules.

Do not hand-edit `dist/`; it is generated.
