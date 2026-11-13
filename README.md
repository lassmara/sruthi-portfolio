# Maraboina Sai Sruthi, portfolio

A static portfolio site: plain HTML, CSS and JavaScript. No build step, no dependencies, and the fonts are bundled, so it works anywhere you can host files.

## What is in it

- **Hero**: an interactive "map of my work" drawn on a canvas — your projects orbit a hub as draggable nodes. Drag one around, or click/tap it to jump to that project. It shows your range at a glance: VineNet, PVC detection, 3D anatomy, Chat ECG, SABA, CatVision and GreenDesk. (There's a hidden list of the same links for keyboard and screen-reader users.)
- **A custom probe cursor** (on desktop) that eases after the mouse and trails a fading comet, plus magnetic buttons and nav.
- **Work at Anumana**: three case studies, each with a measurement block and a small interactive diagram.
  - PVC detection and localization: a scan with a looping activation map.
  - Ablation landmarks: a 3D mesh you can drag to rotate (or use the arrow keys).
  - Chat ECG unwarping: a slider that flattens a warped photo, with a computed straightness score.
- **Before that**: the Interext Technologies internship (SABA, CatVision, GreenDesk).
- **Projects**: VineNet, with an input/segmentation slider.
- **Skills, Education and achievements, Contact**: all from the resume.
- Each section draws itself in as you scroll. Light and dark themes (the toggle uses a circular wipe), keyboard accessible, respects reduced-motion settings (the cursor and animations switch off), prints cleanly.

The diagrams beside each project are simulated illustrations. Every number and date on the page comes from the resume.

## Make it yours

- **`index.html`**: all the text. Change a number in a measurement block directly in its `<dd>`.
- **`script.js`, top block (`SITE`)**: the contact email.
- **`styles.css`, top block**: all colours are variables (`--paper`, `--ink`, `--signal`, `--pen-red`), with a dark-theme set just below.
- **`resume.pdf`**: the file behind the Resume buttons. It contains your phone number. If you would rather not publish that, replace it with a version without it, or delete the file and remove the two Resume links (header and Contact).

To preview on your computer, run a tiny server in this folder (`python -m http.server`) and open http://localhost:8000. Opening `index.html` directly with a double click also works for most things, but some browsers block the preloaded fonts on `file://`.

## Put it online with GitHub Pages (free)

1. Create a new public repository on GitHub. Name it `your-username.github.io` to get the address `https://your-username.github.io`, or any other name to get `https://your-username.github.io/that-name/`.
2. Upload everything in this folder to the repository root (the `.nojekyll` file included).
3. In the repository, open **Settings, Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. After a minute or two the site is live. For a custom domain, add it under the same Pages settings.

## Fonts

TeX Gyre Adventor (GUST Font License), Inter (SIL Open Font License) and Latin Modern Mono (GUST Font License) are bundled as Latin subsets in `assets/fonts/`. See `assets/fonts/LICENSES.txt`.
