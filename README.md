# TWENTYONE — GITHUB UPLOAD

This folder is the complete static web app, with `index.html` at the root. No installation, build step, backend, keys, or account services are needed. All fonts, card art and the photorealistic dealer scene are bundled locally.

## UPLOAD TO GITHUB

1. Create or open your repository.
2. Choose Add file → Upload files. Upload the **contents of this folder**, including `index.html`, `app.js`, `engine.js`, `styles.css`, `assets/`, and `fonts/`. Keep their relative locations.
3. Commit the upload.
4. To host with GitHub Pages: repository Settings → Pages → Build and deployment → Deploy from a branch; choose your branch and **/(root)**, then Save. The Pages screen will show the website URL after deployment. Repository visibility and Pages availability depend on your GitHub account.

Official instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## FEATURES

- Photorealistic dealer/table with playable cards and 1–7 seats (including you). Other players and the dealer are automated.
- Six-deck S17 blackjack, hit/stand/double/split, 3:2 naturals and practice units.
- Basic-strategy strategist and chart; guided decisions are excluded from accuracy.
- A live, hideable count-hint bubble in both modes, synchronized with each dealt card.
- Table speed: 0.15–1.50 seconds per card; separate configurable count-drill speed.
- Counting shoes of 1/2/4/6/8 decks, checkpoints, running/true count practice, detailed post-submission explanations, streaks and accuracy.
- Explicit Restart practice, preserving saved statistics.
- Uppercase interface; keyboard shortcuts; mobile table panning; reduced-motion support.

Open `index.html` in a browser for local play. For an HTTP preview, run `python3 -m http.server 4173` in this folder. Optional logic checks: `node --test tests/engine.test.cjs`. Browser progress is local to each website/origin.

## ASSET CREDITS

Cards: Adrian Kennard (RevK), CC0 public domain: https://www.me.uk/cards/ ; bundled from https://github.com/letele/playing-cards . CC0 license and credits are in `assets/cards/`. Inter's Open Font License is in `fonts/`. The dealer/table photo was created using the built-in image-generation tool; the exact prompt is in `assets/dealer-table.prompt.txt` and embedded in `assets/dealer-table.jpg`.

Basic strategy: https://www.blackjackapprenticeship.com/wp-content/uploads/2024/09/S17-Basic-Strategy.pdf (S17/DAS, no surrender). Counting: https://wizardofodds.com/games/blackjack/card-counting/high-low/ .
