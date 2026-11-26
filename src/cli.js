// `npm start`: run the Handland server for play in a browser.
import { start, lan } from './server.js';

start().then((port) => {
  console.log(`\n  HANDLAND is running.\n\n  Play on this Mac:        http://localhost:${port}\n  Friends on your Wi-Fi:   ${lan()}\n\n  Leave this window open while you play. Press Ctrl+C to stop.\n`);
}).catch((e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.log('\n  Handland is already running. Just open http://localhost:8790 in your browser.\n');
  process.exit(0);
});
