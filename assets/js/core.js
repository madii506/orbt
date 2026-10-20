/* orbt core: data, formatting, the status bar, the drifting ambient orbits, reveals */
(function () {
  const O = window.OB = {};
  const RM = O.RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  O.$ = s => document.querySelector(s); O.$$ = s => [...document.querySelectorAll(s)];
  O.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  O.api = async (path, body) => {
    const r = await fetch('/api/' + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
    const j = await r.json().catch(() => ({ ok: false, error: 'No answer from the server.' }));
    if (j.ok === false) { const e = new Error(j.error || 'Request failed'); e.j = j; throw e; }
    return j;
  };
  O.usd = n => n == null || isNaN(n) ? '—' : n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'K' : '$' + Math.round(n);
  O.num = n => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('en-US');
  O.ago = t => { if (!t) return '—'; const s = Math.max(1, (Date.now() - new Date(t).getTime()) / 1000); return s < 60 ? Math.round(s) + 's ago' : s < 3600 ? Math.round(s / 60) + 'm ago' : s < 86400 ? (s / 3600).toFixed(s < 36000 ? 1 : 0) + 'h ago' : Math.round(s / 86400) + 'd ago'; };
  O.dur = ms => { ms = Math.max(0, ms); const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(ss).padStart(2, '0')}s`; };
  O.ll = (lat, lon) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
  O.short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';
  O.toast = m => { let t = O.$('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); };
  O.TAGS = { station: ['stations', '#c2470e'], starlink: ['starlink', '#8f9d98'], oneweb: ['oneweb', '#6a55c9'], gnss: ['navigation', '#966000'], weather: ['weather', '#2f8f6e'],
    earth: ['earth imaging', '#164296'], science: ['science', '#c0392b'], comms: ['comms', '#286ed6'], other: ['other', '#1d3934'] };

  // ---------- the catalogue: every active satellite, loaded once, shared by every part of the page ----------
  let CATP = null;
  O.catalog = () => CATP || (CATP = (window.__cat ? window.__cat.then(r => r && r.ok ? r.json() : fetch('/api/sky?op=catalog').then(r2 => r2.json())) : fetch('/api/sky?op=catalog').then(r => r.json())).then(j => { window.__cat = null;
    if (!j.ok) throw new Error(j.error || 'catalogue offline');
    const sats = j.sats.map((s, i) => ({ i, norad: s[0], name: s[1], tag: s[2], l1: s[3], l2: s[4], bright: !!s[5] }));
    const by = new Map(sats.map(s => [s.norad, s]));
    return { at: j.at, count: j.count, sats, by };
  }).catch(e => { CATP = null; throw e; }));
  O.rec = s => s.rec || (s.rec = ORB.rec(s.l1, s.l2));
  O.coins = () => O._coins || (O._coins = O.api('coins').then(j => { const m = new Map(); (j.taken || []).forEach(t => m.set(t[0], { symbol: t[1], state: t[2], mint: t[3] })); return { list: (j.coins || []).filter(c => c.state !== 'waiting'), taken: m }; }).catch(() => ({ list: [], taken: new Map(), offline: true })));

  // ---------- the decode effect: a line resolves out of random glyphs ----------
  const GL = '#@*+=-:./\\|01<>';
  O.decode = (el, ms = 900) => {
    if (!el || RM) return; const html = el.innerHTML; const text = el.textContent; if (!text.trim()) return;
    const nodes = []; const walk = n => n.childNodes.forEach(c => c.nodeType === 3 ? nodes.push([c, c.textContent]) : walk(c)); walk(el);
    const t0 = performance.now();
    const step = t => {
      const k = Math.min(1, (t - t0) / ms); let done = true;
      nodes.forEach(([n, s]) => { let o = ''; for (let i = 0; i < s.length; i++) { const at = (i / Math.max(1, s.length)) * .7; if (s[i] === ' ' || k > at + .3) o += s[i]; else { o += GL[(Math.random() * GL.length) | 0]; done = false; } } n.textContent = o; });
      if (!done && k < 1) requestAnimationFrame(step); else el.innerHTML = html;
    };
    requestAnimationFrame(step);
  };

  // ---------- reveals ----------
  O.reveals = () => {
    const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; e.target.classList.add('in'); io.unobserve(e.target); if (e.target.matches('h2.t')) O.decode(e.target, 1000); }), { rootMargin: '0px 0px -8% 0px' });
    O.$$('.rv:not(.in)').forEach(e => io.observe(e));
  };
  // the rail and bar follow the scroll
  O.spy = () => {
    const links = O.$$('.rail a[href^="#"], .bar .nav a[href^="#"]'); if (!links.length) return;
    const secs = [...new Set(links.map(a => a.getAttribute('href')))].map(h => O.$(h)).filter(Boolean);
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(s => io.observe(s));
  };

  // ---------- the status bar: UTC, objects tracked, the station overhead ----------
  O.bar = async () => {
    const clk = O.$('#utc'); const tick = () => { if (clk) clk.textContent = new Date().toISOString().slice(11, 19); };
    tick(); setInterval(tick, 1000);
    try {
      const c = await O.catalog();
      const n = O.$('#nobj'); if (n) n.textContent = O.num(c.count);
      const age = O.$('#catage'); if (age) age.textContent = O.ago(c.at);
      const iss = c.by.get(25544), el = O.$('#issnow');
      if (iss && el) { const up = () => { const p = ORB.at(O.rec(iss), new Date()); if (p) el.innerHTML = `ISS <b>${O.ll(p.lat, p.lon)}</b> · ${Math.round(p.alt)} km`; }; up(); setInterval(up, 1000); }
    } catch (e) { const n = O.$('#nobj'); if (n) n.textContent = 'offline'; }
  };

  // ---------- the ambient background: faint orbits drifting behind everything ----------
  O.ambient = () => {
    const c = O.$('#amb'); if (!c) return; const x = c.getContext('2d'); let w, h, d;
    const fit = () => { d = Math.min(2, devicePixelRatio || 1); w = innerWidth; h = innerHeight; c.width = w * d; c.height = h * d; x.setTransform(d, 0, 0, d, 0, 0); };
    fit(); addEventListener('resize', fit);
    const orbits = [{ cx: .82, cy: .2, rx: .55, ry: .12, rot: -.22, n: 3, v: .05 }, { cx: .1, cy: .85, rx: .4, ry: .1, rot: .3, n: 2, v: .07 }, { cx: .55, cy: .62, rx: .9, ry: .16, rot: -.08, n: 4, v: .03 }];
    let sy = 0; addEventListener('scroll', () => { sy = scrollY; }, { passive: true });
    const draw = t => {
      requestAnimationFrame(draw); if (document.hidden) return; const k = t / 1000; x.clearRect(0, 0, w, h);
      for (const o of orbits) {
        const cx = o.cx * w, cy = o.cy * h - (sy * .05) % h, rx = o.rx * w, ry = o.ry * h;
        x.save(); x.translate(cx, cy); x.rotate(o.rot);
        x.strokeStyle = 'rgba(29,57,52,.07)'; x.setLineDash([2, 7]); x.lineWidth = 1; x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
        for (let i = 0; i < o.n; i++) { const a = k * o.v * (RM ? 0 : 1) + i * Math.PI * 2 / o.n, px = Math.cos(a) * rx, py = Math.sin(a) * ry;
          for (let j = 1; j < 14; j++) { const b = a - j * .012, qx = Math.cos(b) * rx, qy = Math.sin(b) * ry; x.fillStyle = `rgba(40,110,214,${.22 * (1 - j / 14)})`; x.fillRect(qx - 1, qy - 1, 2, 2); }
          x.fillStyle = 'rgba(29,57,52,.45)'; x.font = '11px JBM, monospace'; x.fillText('=[]=', px - 13, py + 4); }
        x.restore();
      }
    };
    requestAnimationFrame(draw);
  };

  // consoles light up under the pointer
  document.addEventListener('pointermove', e => { const c = e.target.closest && e.target.closest('.con:not(.dark)'); if (O._lit && O._lit !== c) O._lit.classList.remove('lit'); if (!c) { O._lit = null; return; } const b = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - b.left) + 'px'); c.style.setProperty('--my', (e.clientY - b.top) + 'px'); c.classList.add('lit'); O._lit = c; }, { passive: true });
  document.addEventListener('DOMContentLoaded', () => { O.reveals(); O.spy(); O.bar(); O.ambient(); });
})();
