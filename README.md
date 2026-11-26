# Handland

A bluffing and trading card game. Everyone is trying to corner one market: hold five of the same resource for a
full round. Every trade is made face down, anything you say about a card may be a lie, and anyone can call your bluff.

**Play in a browser:** https://teamingzooper.github.io/handland/
**Rulebook (PDF):** https://teamingzooper.github.io/handland/rulebook.pdf
**Print and play (PDF):** https://teamingzooper.github.io/handland/cards.pdf (all 154 cards and the tokens, to cut out)

## Ways to play

- **Against bots**, four difficulties, plus a short tutorial. Works in the browser with nothing to install.
- **With friends online.** One player picks "Host a game online" and sends the link. The game runs in the host's
  browser and the others connect to it directly, so the host keeps their page open.
- **With friends on the same Wi-Fi**, from the desktop app or `npm start`: join by code or QR code. A TV can watch.

## Running it yourself

Needs Node 22 or newer. No install step is needed to play.

```bash
npm start          # the game server, then open http://localhost:8790
npm test           # the rules tests
npm run site       # build the static web version into site/
npm run rulebook   # rebuild print/Handland-rulebook.pdf (needs: npm install)
npm run cards      # rebuild print/Handland-cards.pdf, the print-and-play sheets
```

## How it is put together

- `src/engine.js` is the rules, with no screen or network code. `src/bots.js` plays the computer seats.
- `src/room.js` is a game room (seats, clocks, bot moves, the tutorial). `src/server.js` puts HTTP in front of it;
  on the static web version the page loads the room itself.
- `public/` is the screen: plain JavaScript and CSS, no framework. All card art is drawn in code (`public/art.js`).
- `RULES.md` is the full rulebook text; `docs/physical-audit.md` checks every rule against play with real cards.

Sounds and textures are CC0 recordings and photographs by other people; see `public/audio/CREDITS.md` and
`public/tex/CREDITS.md`. Online play uses [PeerJS](https://peerjs.com) (MIT licence, in `public/vendor/`).
