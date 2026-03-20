# Chromafall

Chromafall is a browser puzzle prototype that blends:

- Block Blast style piece placement
- Tetris-like cascade pressure
- Big full-line clears and combo chains

The current build is dependency-free at install time. It uses `three.js` from a CDN, so you can run it with a tiny local server.

## Run It

```bash
npm start
```

Or:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## How To Play

- Pick one of the three shards in the tray
- Hover the board to preview the placement
- Click to place it
- Rotate with `Q`, `E`, or `R`
- Clear only full rows or full columns
- Multi-line clears score big and can cascade into more clears
- Survive as long as at least one shard can still fit

## Tech Notes

- `index.html` sets up the app shell and import map
- `styles.css` handles the glassy HUD and animated backdrop
- `src/main.js` contains the Three.js scene, input handling, game state, and rendering
- `src/audio.js` generates procedural music and sound effects with the Web Audio API
