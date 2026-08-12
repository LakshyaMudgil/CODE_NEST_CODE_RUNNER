# Typing Racer

A fast-paced, dependency-free typing game. Words fly in from the right —
type each one and hit **Enter**/**Space** before it crosses the red line.
Pure HTML/CSS/JS, no build step, no npm packages.

## What changed from the original upload

**Critical bugs fixed**
- `index.html` was pointing at `game.js`, but the actual file was
  `scrpt.js` — the game never loaded at all. Everything now lives in
  `script.js` and the reference matches.
- The countdown ("3, 2, 1, GO!") code referenced `#countdownOverlay`
  and `#countdownNum` elements that didn't exist in the HTML, so
  clicking **Start Race** threw immediately. That markup now exists,
  styled as a glowing ring.
- The leaderboard and power-up legend inside the modals were built in
  JS with classes (`.leaderboard`, `.lb-row`, `.powerup-legend`,
  `.pl-dot`, …) that had no matching CSS anywhere — they rendered as
  unstyled, cramped text. Full styles were added for both.
- The Combo pill, the combo-fire glow at the bottom of the stage, and
  the power-up timer indicator all had markup and CSS already in place
  but were never wired up in JS — dead UI. All three are now live.
- The difficulty selector (`.diff-chip`, `.difficulty-row` CSS existed
  but no JS ever rendered it) is now a real Easy/Normal/Hard setting
  that affects word speed, starting lives, and score.
- Fixed an edge case where tying (not beating) your best score still
  showed a "New personal best" badge.

**New/improved**
- A fourth power-up (cyan ring) triggers a temporary slow-motion
  effect with a live countdown bar in the HUD.
- Combo streaks now visibly build a rising ember glow at the bottom of
  the stage and a glowing input field, with milestone toasts every 5x.
- Ambient parallax "speed lines" drift across the track for a sense of
  motion, and the danger zone flashes hazard stripes as a word is
  about to breach it.
- The game now auto-pauses if you switch tabs or the window loses
  focus, and the input field silently re-focuses itself if it's ever
  blurred mid-race, so keystrokes never get lost.
- Added a favicon, web manifest (installable "Add to Home Screen"),
  Open Graph tags, and safe-area padding for notched phones.
- Small accessibility passes: dialog roles on the modal, a live region
  on the toast, and focus-visible outlines on every interactive chip.

## Running locally

No build step required — just serve the folder statically:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed local URL. (Opening `index.html` directly via
`file://` also works, but you'll need internet access for the Google
Fonts request.)

## Deploying to Vercel

This is a zero-config static site — there's no `package.json` and none
is needed. Pick whichever of these is easiest:

**Vercel CLI**
```bash
npm i -g vercel
vercel
```
Follow the prompts from inside this folder; accept the defaults
(framework: **Other**).

**Vercel dashboard**
1. Push this folder to a GitHub/GitLab/Bitbucket repo.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Leave the build settings blank/default and deploy.

**Drag-and-drop**
Go to [vercel.com/new](https://vercel.com/new) and drag this project
folder directly onto the page.

## Files

- `index.html` — markup
- `styles.css` — all styling
- `script.js` — game logic (canvas rendering, input, audio, scoring)
- `favicon.svg` / `manifest.json` — icon + installable app metadata
