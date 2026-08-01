## Website

`README.md` is the single source of truth for the generated Kettlebell Sport website. The site presents that Markdown as a minimal documentation page with a desktop sidebar, a mobile navigation drawer, and resource search.

### Normal content updates

Edit only `README.md` and retain its existing structure:

- `#` headings define main sections and sidebar navigation.
- `##` and `###` headings define categories.
- Top-level list items define resource rows.
- Nested list items define notes attached to a resource.
- Markdown links, bold text, emphasis, and inline code are preserved.

There is no separately maintained promotional or landing-page content. Display-only build options live in `site/config.json`. The README's lead image is enabled by default; set `renderLeadImage` to `false` there to hide it.

### Local preview

Requires Node.js 24 or newer. The generator has no npm dependencies.

```sh
npm run build
```

Open `dist/index.html` in a browser. Run the complete build and structural validation with:

```sh
npm run check
```

Do not edit `dist/` by hand. Layout and styling live in `site/`; Markdown parsing and validation live in `scripts/`. See `SITE.md` for the complete mapping and implementation notes.
