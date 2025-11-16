# Slides: Build & Export

This repo includes a Marp-based deck with a custom theme.

- Source: `docs/slides/subjects-deck.marp.md`
- Theme: `docs/theme/skillswap-theme.css`
- Placeholders: `docs/assets/*.svg` (replace with real screenshots)
- Outputs: `docs/out/subjects-deck.pptx` and `docs/out/subjects-deck.pdf`

## Install (one-time)

```cmd
npm install
```

## Live Preview (local server)

```cmd
npm run slides:serve
```

Then open the URL shown in the terminal.

## Export to PowerPoint (PPTX)

```cmd
npm run slides:pptx
```

Output: `docs/out/subjects-deck.pptx` — Import this into Google Slides if preferred.

## Export to PDF

```cmd
npm run slides:pdf
```

Output: `docs/out/subjects-deck.pdf`

## Replace Screenshots

Drop real images in `docs/assets/` and update references in `docs/slides/subjects-deck.marp.md`:

- `screenshot-auth.svg` → Auth/Profile
- `screenshot-search.svg` → Search/Matching
- `screenshot-transaction.svg` → Transaction/Chat

Use PNG/JPG for best fidelity.
