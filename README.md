# Quadle

Four logic puzzles, a new set every day. No words in any of them, so it works in
every country without translation. No accounts, no server, works offline.

| Game | What you do |
|---|---|
| **Suns** | Equal suns and stars in every row and column, never three of a kind in a row, and `=` / `×` links between neighbouring squares |
| **Crowns** | One crown per row, per column and per colour, and no two crowns touching — not even at corners |
| **Path** | One unbroken line covering every square, passing the numbers in order |
| **Plots** | Split the grid into rectangles, one badge each: the number is the area, the badge shape is the shape |

All four are public-domain puzzle types. Nothing here copies anyone's name,
artwork or code.

---

## What's in here

```
index.html               the app shell
styles.css               all styling, light and dark
app.js                   the four games, generators, solvers, UI
manifest.webmanifest     makes it installable on a phone
sw.js                    service worker, so it runs with no internet
privacy.html             privacy policy (needed for both app stores)
data/
  daily-boards.json      730 days x 4 games = 2,920 pre-made boards
  practice-boards.json   crown and path boards for practice mode
icons/                   192, 512, maskable and apple-touch icons
play-feature-graphic.png 1024x500 for the Play listing
```

---

## Running it

It is a plain static site. Anything that serves files over HTTPS will do.

Locally:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

A service worker needs HTTPS (or localhost), so opening `index.html` straight
from the file system will work but will not cache offline.

---

## Putting it on GitHub Pages

```bash
git init
git add .
git commit -m "Quadle: four daily logic puzzles"
git branch -M main
git remote add origin https://github.com/<your-username>/quadle.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Source: Deploy from a branch → main /
(root) → Save.** A minute later it is live at
`https://<your-username>.github.io/quadle/`.

Your privacy policy URL, which both stores ask for, is then
`https://<your-username>.github.io/quadle/privacy.html`.

---

## Installing it on your phone

Open the Pages URL in Chrome on Android, then **⋮ → Add to home screen**. It
gets the icon, opens full screen with no browser bar, and works with no
connection after the first load. On iPhone it is **Share → Add to Home Screen**.

---

## How the daily board works

There is no server and nothing is fetched. `data/daily-boards.json` holds two
years of boards. The date on the phone picks the index, so everyone playing on
the same date gets the same board.

The anchor is `EPOCH` in `app.js`, set to 7 September 2026, which was a Monday.
That is why `index % 7 === 0` is always a Monday and the weekly difficulty ramp
lines up.

Difficulty climbs across the week:

| | Monday | Sunday |
|---|---|---|
| Crowns | 6x6, level 1 | 8x8, level 3 |
| Suns | 7 links | 4 links |
| Plots | 5x5, level 1 | 7x7, level 2 |
| Path | 3.5 squares per clue | 5.3 squares per clue |

Path is graded by how many squares you must work out per numbered stop, not by
grid size. A bigger grid with more stops can be easier than a small sparse one,
which is why sorting it by size gave a dip midweek.

Every board was checked before it went in: exactly one solution, and reachable
by pure logic. No board in the pack ever needs a guess.

---

## Practice mode

Separate from the daily. Endless boards, any size, any level, and it never
touches your streak. Suns and Plots are generated live on the device in a few
milliseconds. Crowns and Path are too slow to build on a phone, so those come
from `practice-boards.json`.

---

## Notes for whoever works on this next

- **Never strip a puzzle to its minimum clues.** It stays uniquely solvable but
  stops being solvable by human logic. Both Suns and Plots strip only while a
  solver using human tactics can still finish the board.
- **Crown regions grown at random are never unique.** The repair loop reshapes
  cells until one solution survives, and the loosening pass afterwards is what
  makes easy boards possible at all.
- **Eight colours is the hard limit** for crown regions, checked against all
  three kinds of colour blindness. Nine and something always collapses.
- **Never let colour carry meaning alone.** Sun and star differ in silhouette,
  region borders are drawn thick, badge shapes carry the shape rule.
- **Every text element sets its own colour.** Relying on inheritance breaks in
  dark mode.
- Bump `CACHE` in `sw.js` whenever you change a file, or phones keep the old one.

---

Cooperkite Games
