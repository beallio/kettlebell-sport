# Kettlebell Sport sidebar redesign — complete replacement package

This archive contains the complete repository working tree, excluding only Git metadata. It is structured for extraction at the root of `beallio/kettlebell-sport`.

## Apply

1. Back up or commit the current working tree.
2. Extract this archive over the repository root and allow all files to be replaced.
3. Run:

```sh
npm run check
```

4. Commit and push the result. The existing GitHub Pages workflow will rebuild and deploy `dist/`.

## Included behavior

- `README.md` remains the content source for headings, paragraphs, lists, links, notes, sidebar sections, and search data.
- The README lead image is enabled by default through `site/config.json`. Set `renderLeadImage` to `false` to hide it.
- The document header contains only the README title and optional lead image; it does not display a resource-count or generation-source label.
- The footer contains only the “Back to top” link.
- The final Ranking Tables section can become active in the sidebar at the bottom of the page.
- Desktop sidebar, mobile drawer, resource filtering, keyboard search, and structural validation are included.

No npm dependencies are introduced.
