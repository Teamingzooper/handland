#!/bin/zsh
# Double-click to start Handland and open it in your browser.
cd "$(dirname "$0")"
(sleep 1; open "http://localhost:8790") &
node src/cli.js
