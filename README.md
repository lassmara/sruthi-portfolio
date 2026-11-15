# Maraboina Sai Sruthi, portfolio

A static portfolio site: plain HTML, CSS and JavaScript. No build step, no dependencies, and the fonts are bundled, so it works anywhere you can host files.

## What is in it

- **Hero**: an interactive "map of my work" drawn on a canvas — your projects orbit a hub as draggable nodes. Drag one around, or click/tap it to jump to that project. It shows your range at a glance: VineNet, PVC detection, 3D anatomy, Chat ECG, SABA, CatVision and GreenDesk. (There's a hidden list of the same links for keyboard and screen-reader users.)
- **Background and section transitions**: the site opens in dark mode with a soft "aurora" of colour light drifting behind the page, plus a fine grain. Each section has its own colour, and as you scroll the page and the light blend into the next section's colour, while a giant outlined word (Now, Before, Built, Toolkit, Learning, Say hello) slides behind each section and headings wipe up into view. The colours live in the `CHAPTERS` list in `script.js`. To try another background, set `SITE.bg` in `script.js` to `"grain"` or `"clean"`, or preview with `?bg=grain` in the address.
- **Work at Anumana**: three case studies, each with a measurement block and a small interactive diagram.
  - PVC detection and localization: a scan with a looping activation map.
  - Ablation landmarks: a 3D mesh you can drag to rotate (or use the arrow keys).
  - Chat ECG preprocessing: a slider that flattens a warped ECG photo before the disease models run, with a computed straightness score.
- **Before that**: the Interext Technologies internship. SABA (document extraction feeding a RAG chatbot) and CatVision (images extracted from scanned and digital PDFs, image to metadata) each have an interactive panel; Agentic SaaS and GreenDesk are short entries.
- **Projects**: VineNet, with an input/segmentation slider.
- **Skills, Education and achievements, Contact**: all from the resume.
- Each section draws itself in as you scroll. Light and dark themes (the toggle uses a circular wipe), keyboard accessible, respects reduced-motion settings (the moving background and animations switch off), prints cleanly.

The diagrams beside each project are simulated illustrations. Every number and date on the page comes from the resume.

## Make it yours

- **`index.html`**: all the text. Change a number in a measurement block directly in its `<dd>`.
- **`script.js`, top block (`SITE`)**: the contact email.
- **`styles.css`, top block**: all colours are variables (`--paper`, `--ink`, `--signal`, `--pen-red`), with a dark-theme set just below.
- **`resume.pdf`**: the file behind the Resume buttons. It contains your phone number. If you would rather not publish that, replace it with a version without it, or delete the file and remove the two Resume links (header and Contact).

To preview on your computer, run a tiny server in this folder (`python -m http.server`) and open http://localhost:8000. Opening `index.html` directly with a double click also works for most things, but some browsers block the preloaded fonts on `file://`.

## See how many people viewed it

The page already has Vercel Web Analytics built in. It only runs on the live site.

1. Deploy on Vercel (steps below).
2. In Vercel, open the project, choose **Analytics** in the sidebar, and click **Enable**.
3. Redeploy once (push any commit, or click **Redeploy**).
4. Open **Analytics** any time to see visitors, page views, which sites they came from (LinkedIn, GitHub, etc.), countries and devices.

Free on the Hobby plan up to 50,000 events a month, with one month of history. It counts visits; it can't tell you who the visitors are.

If the Analytics page shows a different script path to paste, replace `/_vercel/insights/script.js` in `index.html` with it.

## Put it online with Vercel (free)

1. Push this folder to a GitHub repository (everything in it, at the repository root).
2. On vercel.com: **Add New, Project**, then **Import** that repository.
3. Framework preset **Other**; leave the build command and output directory empty.
4. **Deploy**. You get a `*.vercel.app` address, and every push to `main` redeploys automatically.
5. Turn on **Analytics** as described above.

## Or put it online with GitHub Pages (free)

1. Create a new public repository on GitHub. Name it `your-username.github.io` to get the address `https://your-username.github.io`, or any other name to get `https://your-username.github.io/that-name/`.
2. Upload everything in this folder to the repository root (the `.nojekyll` file included).
3. In the repository, open **Settings, Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. After a minute or two the site is live. For a custom domain, add it under the same Pages settings.

## Fonts

TeX Gyre Adventor (GUST Font License), Inter (SIL Open Font License) and Latin Modern Mono (GUST Font License) are bundled as Latin subsets in `assets/fonts/`. See `assets/fonts/LICENSES.txt`.
