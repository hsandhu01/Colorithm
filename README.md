# Colorithm

Colorithm is a fast, candy-bright line-clearing puzzle game from [Sandhu Software](https://www.sandhusoftware.com/).

Built for the browser with `three.js`, Colorithm focuses on:

- clean full-line clears
- satisfying multi-line combos
- glossy arcade-style presentation
- procedural music and reactive sound design

## Play Locally

Start a local server:

```bash
npm start
```

Or:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## How It Works

- Pick one of the three shards in the tray
- Hover the board to preview placement
- Click to place the shard
- Rotate with `Q`, `E`, or `R`
- Clear only full horizontal rows or full vertical columns
- Chain multiple line clears to run up the score
- Stay alive as long as at least one shard still fits

## Project Structure

- `index.html` contains the app shell and import map
- `styles.css` contains the visual system and HUD styling
- `src/main.js` contains gameplay, rendering, input, and animation
- `src/audio.js` contains procedural music and sound effects

## Notes

- This project loads `three.js` and Google Fonts from CDNs
- Best score is stored locally in the browser

## Links

- Live Site: [hsandhu01.github.io/Colorithm](https://hsandhu01.github.io/Colorithm/)
- Website: [www.sandhusoftware.com](https://www.sandhusoftware.com/)
- Repository: `https://github.com/hsandhu01/Colorithm`
