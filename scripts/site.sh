#!/bin/bash
# Builds the web version of Handland into site/: plain files that any static host (GitHub Pages, for one) can serve.
# There is no server behind such a page, so the game code itself is copied in (site/game/) and the page runs it.
# Run with:  bash scripts/site.sh
set -e
cd "$(dirname "$0")/.."
rm -rf site
mkdir -p site/game
cp -R public/. site/
find site -name '_*' -delete            # dev-only helpers
find site -name '.DS_Store' -delete
cp src/engine.js src/bots.js src/tutorial.js src/room.js site/game/
# Sound effects are uncompressed recordings (5 MB), which is fine inside the app but slow over a phone connection.
# For the web they are squeezed to MP3 (about a tenth of the size) and the sound code is pointed at those.
if command -v ffmpeg >/dev/null; then
  for f in site/audio/*.wav; do ffmpeg -loglevel error -y -i "$f" -codec:a libmp3lame -q:a 5 "${f%.wav}.mp3" && rm "$f"; done
  sed -i '' "s/const ext = (n) => (n === 'room' ? '.mp3' : '.wav');/const ext = () => '.mp3';/" site/sfx.js
  grep -q "const ext = () => '.mp3';" site/sfx.js || { echo "could not point the sound code at the MP3 files"; exit 1; }
fi
cp print/Handland-rulebook.pdf site/rulebook.pdf 2>/dev/null || true   # the illustrated rulebook, at <site>/rulebook.pdf
touch site/.nojekyll                     # GitHub Pages: serve the files as they are
du -sh site | awk '{print "built site/ (" $1 ")"}'
