// Playing with friends over the internet, with no game server.
//
// The host's page runs the game (the same room.js the server uses). Everyone else's page talks to the host's page
// directly, browser to browser (WebRTC), using the PeerJS library in vendor/. To find each other the browsers use
// PeerJS's free public broker; after that the game messages go straight between the players.
// So: the host must keep their page open, and a few very locked-down networks will not let two browsers connect.
//
// What crosses the link is the same thing the server speaks: a request ("api": join, act, lobby...) with its answer,
// and a stream of that seat's view of the table ("push"). Guests can only reach the one room they were invited to.

const idFor = (code) => `handland-v1-${String(code).toUpperCase()}`; // the host's address at the broker, from the game code
const GUEST_MAY = ['join', 'watch', 'act', 'lobby', 'leave', 'getdeck'];

let loading = null;
function library() {
  if (window.Peer) return Promise.resolve(window.Peer);
  loading ||= new Promise((ok, bad) => {
    const s = document.createElement('script');
    s.src = 'vendor/peerjs.min.js';
    s.onload = () => (window.Peer ? ok(window.Peer) : bad(new Error('The online-play code did not load.')));
    s.onerror = () => { loading = null; bad(new Error('The online-play code did not load. Check your connection.')); };
    document.head.appendChild(s);
  });
  return loading;
}
// Opens this page's own line to the broker. `id` is only given by a host (guests get a random one).
function line(Peer, id) {
  return new Promise((ok, bad) => {
    const peer = id ? new Peer(id) : new Peer();
    const timer = setTimeout(() => { peer.destroy(); bad(new Error('Could not reach the online-play service. Check your connection and try again.')); }, 15000);
    peer.on('open', () => { clearTimeout(timer); ok(peer); });
    peer.on('error', (e) => {
      if (peer.open) return; // later errors are handled where they matter
      clearTimeout(timer); peer.destroy();
      bad(new Error(e.type === 'unavailable-id' ? 'taken' : 'Could not reach the online-play service. Check your connection and try again.'));
    });
  });
}

// Host: let other players in to `room` (the room.js module) for the game with this code. Returns { stop() }.
export async function hostRoom(room, code, onCount = () => {}) {
  const peer = await line(await library(), idFor(code));
  const guests = new Set();
  peer.on('connection', (conn) => {
    const stops = [];
    guests.add(conn); onCount(guests.size);
    conn.on('data', (m) => {
      if (m?.t === 'api') {
        let out;
        if (!GUEST_MAY.includes(m.route)) out = { error: 'That is not available here.' };
        else { try { out = room.api(m.route, { ...(m.body && typeof m.body === 'object' ? m.body : {}), code }); } catch (e) { console.error(e); out = { error: 'Something went wrong.' }; } }
        conn.send({ t: 'res', id: m.id, out });
      } else if (m?.t === 'attach') {
        const stop = room.attach(code, m.token, { write: (d) => { if (conn.open) conn.send({ t: 'push', d }); }, end: () => conn.close() });
        if (stop) stops.push(stop); else conn.send({ t: 'gone' });
      }
    });
    const closed = () => { if (!guests.delete(conn)) return; stops.forEach((f) => f()); onCount(guests.size); };
    conn.on('close', closed); conn.on('error', closed);
  });
  // Losing the broker does not drop players who are already in; reconnect so that new ones can still find the game.
  peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => { if (!peer.destroyed) peer.reconnect(); }, 2000); });
  return { stop: () => peer.destroy() };
}

// Guest: connect to the host of the game with this code. Returns a link with api(route, body), attach(...), close().
export async function joinRoom(code, onLost = () => {}) {
  const peer = await line(await library());
  const conn = peer.connect(idFor(code), { reliable: true });
  await new Promise((ok, bad) => {
    const fail = () => { clearTimeout(timer); peer.destroy(); bad(new Error('No online game with that code, or its host cannot be reached.')); };
    const timer = setTimeout(fail, 15000);
    conn.on('open', () => { clearTimeout(timer); ok(); });
    peer.on('error', fail); // "peer-unavailable": nobody is hosting under that code
  });
  let n = 0, sink = null, closed = false;
  const waiting = new Map();
  conn.on('data', (m) => {
    if (m?.t === 'res') { waiting.get(m.id)?.(m.out); waiting.delete(m.id); }
    else if (m?.t === 'push') sink?.write(m.d);
    else if (m?.t === 'gone') sink?.gone?.();
  });
  const lost = () => { if (closed) return; closed = true; for (const done of waiting.values()) done({ error: 'The connection to the host was lost.' }); waiting.clear(); onLost(); };
  conn.on('close', lost); conn.on('error', lost);
  return {
    api: (route, body) => new Promise((done) => {
      if (closed) { done({ error: 'The connection to the host was lost.' }); return; }
      const id = ++n;
      waiting.set(id, done);
      conn.send({ t: 'api', id, route, body });
      setTimeout(() => { if (waiting.delete(id)) done({ error: 'The host did not answer.' }); }, 15000);
    }),
    attach: (token, s) => { sink = s; conn.send({ t: 'attach', token }); return () => { sink = null; }; },
    close: () => { closed = true; peer.destroy(); },
  };
}
