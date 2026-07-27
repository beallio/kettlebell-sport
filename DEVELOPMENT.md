## Website

This README is the **single source of truth** for the [Kettlebell Sport Field Guide](https://beallio.github.io/kettlebell-sport/). The website is generated from the Markdown in this file, so normal content updates only require editing `README.md`.

### Updating content

Keep using the existing Markdown structure:

- `#` headings define the main resource sections shown on the website.
- `##` and `###` headings define categories within those sections.
- Markdown list items become searchable resource entries.
- Nested list items become notes attached to the parent resource.
- `Introduction → What is Kettlebell Sport? → Lifts` generates the lift cards.
- `Introduction → What is Kettlebell Sport? → Links` generates the “Start here” resources.

For a typical update, add or edit the relevant Markdown entry and push the change to `main`. GitHub Actions rebuilds and republishes the site automatically.

### Local preview

Requires [Node.js](https://nodejs.org/) 20 or newer. The site generator has no npm dependencies.

```bash
npm run build
```

Then open `dist/index.html` in a browser. To build and run the validation checks:

```bash
npm run check
```

The generated `dist/` directory should not be edited by hand. Site layout, styling, and browser behavior live in `site/`; README parsing and rendering live in `scripts/`. More implementation details are in [`SITE.md`](SITE.md).