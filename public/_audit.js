// Dev-only layout audit (not shipped: scripts/package.sh removes files starting with "_").
// Usage in the page console: (await import('/_audit.js')).audit()
// Reports text that is cut off, text too small to read, controls that hang off the window, and panels that overlap.
const name = (el) => {
  const bits = [];
  for (let e = el, i = 0; e && e !== document.body && i < 3; e = e.parentElement, i++) bits.unshift(e.tagName.toLowerCase() + (e.id ? `#${e.id}` : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
  return bits.join('>');
};
const shown = (el) => { const c = getComputedStyle(el); return c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) > 0.05; };
export function audit() {
  const W = innerWidth, H = innerHeight, out = { clipped: [], tiny: [], offscreen: [], overlap: [] };
  const seen = new Set();
  const add = (k, row) => { const key = k + row.slice(0, 2).join('|'); if (!seen.has(key)) { seen.add(key); out[k].push(row.join('  ')); } };
  for (const el of document.querySelectorAll('#app *, #reveal *, #banner *, .dlg *')) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el), text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue.trim()).join(' ').trim();
    if (text) {
      const scale = el.offsetWidth ? r.width / el.offsetWidth : 1, px = parseFloat(cs.fontSize) * scale;
      if (px < 9 && r.top < H && r.bottom > 0) add('tiny', [name(el), px.toFixed(1) + 'px', text.slice(0, 28)]);
    }
    if (cs.overflow !== 'visible' || cs.textOverflow === 'ellipsis') {
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && !el.matches('.shop, .prompt, .sheet, .hand, #rules, .scene, .plane')) add('clipped', [name(el), `w ${el.scrollWidth}>${el.clientWidth}`, el.textContent.trim().slice(0, 28)]);
      if (el.scrollHeight > el.clientHeight + 3 && el.clientHeight > 0 && cs.overflowY === 'hidden' && !el.matches('.cardface, .scene, #room, .world, .plane, body')) add('clipped', [name(el), `h ${el.scrollHeight}>${el.clientHeight}`, el.textContent.trim().slice(0, 28)]);
    }
    if (el.matches('button, .btn, input, .field, h2, .prompt, .handcol, .seatbox.me, .corner') && (r.right > W + 2 || r.bottom > H + 2 || r.left < -2 || r.top < -2)) add('offscreen', [name(el), `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`, (el.textContent || '').trim().slice(0, 20)]);
  }
  const box = (sel) => { const e = document.querySelector(sel); return e && shown(e) ? [sel, e.getBoundingClientRect()] : null; };
  const zones = ['.dock', '.handcol', '.seatbox.me', '.mine .cards', '#stage', '.piles', '.corner', '.opps'].map(box).filter(Boolean);
  for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) {
    const [a, ra] = zones[i], [b, rb] = zones[j];
    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (w > 6 && h > 6) add('overlap', [a, b, `${Math.round(w)}x${Math.round(h)}px`]);
  }
  const tents = [...document.querySelectorAll('.seatbox.opp .tent')].map((e) => e.getBoundingClientRect());
  for (let i = 1; i < tents.length; i++) if (tents[i].left < tents[i - 1].right - 2) add('overlap', ['tent ' + (i - 1), 'tent ' + i, `${Math.round(tents[i - 1].right - tents[i].left)}px`]);
  return out;
}
