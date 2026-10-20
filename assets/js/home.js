/* orbt home: the live sky, your sky, the catalogue, a rulebook running on the ISS, the coins, the falling, the engine */
(function () {
  const $ = OB.$, esc = OB.esc;
  let CAT = null, POS = null, globe = null, focusI = null, COINS = { list: [], taken: new Map() };
  const mob = innerWidth < 900;

  // ---------- 01 the sky: a ground station you can drive ----------
  const CLK = SKY.clock, NOW = () => new Date(CLK.now());
  const hhmmss = t => new Date(t).toISOString().slice(11, 19);
  const booting = () => document.documentElement.classList.contains('booting');
  let idle = performance.now(), PINGS = [];
  globe = new SKY.Globe($('#globe'), { cx: mob ? .5 : .535, cy: mob ? .5 : .47, r: mob ? .38 : .3, lon: -40, lat: 22, spin: 2.4, font: 12, lens: true, parallax: !mob, shellLabels: false,
    onGround: (gp, px, py) => probe(gp, px, py),
    onPick: i => { focus(i, true); stopTour(); },
    onHover: i => { if (i != null) idle = performance.now(); },
    overlay: (x, g) => pings(x, g) });
  window.__globe = globe;
  $('#globe').addEventListener('pointerdown', () => { idle = performance.now(); });
  $('#zIn').onclick = () => globe.setZoom((globe.zt || globe.zoom) * 1.25); $('#zOut').onclick = () => globe.setZoom((globe.zt || globe.zoom) / 1.25);

  // the tour: when nobody is touching the globe, it flies from one notable satellite to the next
  const TOUR = [25544, 48274, 20580, 33591, 49260, 43013, 41866, 39084, 27424, 40697, 25994, 28654];
  let tourOn = !mob, tourK = 0, tourT = 0;
  const stopTour = () => { tourOn = false; $('#zTour').classList.remove('on'); insTour(); };
  $('#zTour').onclick = () => { tourOn = !tourOn; $('#zTour').classList.toggle('on', tourOn); tourT = 0; idle = 0; insTour(); };
  const tourList = () => TOUR.filter(n => CAT && CAT.by.has(n));
  function step(d) { const L = tourList(); if (!L.length) return; const cur = focusI != null ? L.indexOf(CAT.sats[focusI].norad) : -1; tourK = ((cur < 0 ? (d > 0 ? -1 : 0) : cur) + d + L.length) % L.length; focus(CAT.by.get(L[tourK]).i, true); }
  setInterval(() => { if (!tourOn || !CAT || document.hidden) return; const now = performance.now(); if (now - idle < 9000 || now - tourT < 8500) return;
    const L = tourList(); if (!L.length) return; const s = CAT.by.get(L[tourK++ % L.length]); tourT = now; focus(s.i, true, true); }, 1000);

  // layers: every group, its live count and how much of it is in sunlight right now
  const VIEW = { trails: true, labels: true, rings: true, coins: true }; let filter = null;
  function layers(by) {
    const rows = Object.entries(by).sort((a, b) => b[1] - a[1]), box = $('#layers');
    box.innerHTML = rows.map(([k, n]) => `<button type="button" class="ly" data-t="${k}"><i style="background:${OB.TAGS[k][1]}"></i><span class="nm">${OB.TAGS[k][0]}</span><span class="n">${OB.num(n)}</span><span class="lb"><u style="background:${OB.TAGS[k][1]}"></u></span></button>`).join('');
    box.querySelectorAll('.ly').forEach(b => {
      b.onclick = () => { b.classList.toggle('on'); applyFilter(); stopTour(); };
      b.onmouseenter = () => { globe.filter = new Set([b.dataset.t]); };
      b.onmouseleave = () => { globe.filter = filter; };
    });
  }
  function applyFilter() { const box = $('#layers'), on = [...box.querySelectorAll('.ly.on')].map(x => x.dataset.t); filter = on.length ? new Set(on) : null; globe.filter = filter; box.classList.toggle('some', !!filter); }
  function setLayer(t) { $('#layers').querySelectorAll('.ly').forEach(b => b.classList.toggle('on', b.dataset.t === t)); applyFilter(); }
  $('#views').querySelectorAll('button').forEach(b => b.onclick = () => { const v = b.dataset.v; VIEW[v] = !VIEW[v]; b.classList.toggle('on', VIEW[v]); globe.trails = VIEW.trails; globe.labels = VIEW.labels; globe.rings = VIEW.rings; globe.coinTags = VIEW.coins; });

  // the clock: live, fast-forward, rewind, pause, or drag through the next and last twelve hours
  const tb = { play: $('#tPlay'), clock: $('#tClock'), st: $('#tState'), live: $('#tLive'), sc: $('#scrub').querySelector('canvas') };
  const SPAN = 12 * 36e5; let scrubbing = false, shadeK = null, shade = null;
  function clockUI() {
    const st = CLK.state(), off = st.t - Date.now(); tb.clock.textContent = hhmmss(st.t);
    const o = Math.abs(off) < 2500 ? '' : (off > 0 ? '+' : '−') + OB.dur(Math.abs(off));
    tb.st.textContent = st.live ? 'utc · live' : `utc · ${st.paused ? 'paused' : st.rate === 1 ? '1×' : st.rate === 3600 ? '1h/s' : st.rate + '×'}${o ? ' · ' + o : ''}`;
    tb.play.textContent = st.paused ? '▶' : '❚❚'; tb.play.setAttribute('aria-label', st.paused ? 'play' : 'pause');
    tb.live.classList.toggle('on', st.live); $('#tbar').classList.toggle('sim', !st.live);
    $('#warp').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.w === st.rate && !st.paused));
    ruler();
  }
  function ruler() {
    const c = tb.sc, d = Math.min(2, devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight; if (!W) return; if (c.width !== W * d) { c.width = W * d; c.height = H * d; }
    const x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, W, H);
    const now = Date.now(), X = t => (t - now + SPAN) / (2 * SPAN) * W, st = CLK.now();
    // the focused satellite's own night: where in the next and last twelve hours it is in Earth's shadow
    if (shade) { x.fillStyle = 'rgba(29,57,52,.16)'; for (const [a, b] of shade) x.fillRect(X(a), 4, Math.max(1, X(b) - X(a)), H - 12); }
    x.strokeStyle = 'rgba(29,57,52,.35)'; x.lineWidth = 1;
    const h0 = Math.ceil((now - SPAN) / 36e5) * 36e5;
    for (let t = h0; t <= now + SPAN; t += 36e5) { const px = Math.round(X(t)) + .5, big = new Date(t).getUTCHours() % 6 === 0; x.beginPath(); x.moveTo(px, H - 8); x.lineTo(px, H - (big ? 16 : 11)); x.stroke(); }
    x.beginPath(); x.moveTo(0, H - 7.5); x.lineTo(W, H - 7.5); x.stroke();
    x.fillStyle = '#286ed6'; x.fillRect(Math.round(X(now)) - .5, 2, 1, H - 6);
    const hx = Math.max(3, Math.min(W - 3, X(st))); x.fillStyle = '#1d3934'; x.beginPath(); x.moveTo(hx - 5, 1); x.lineTo(hx + 5, 1); x.lineTo(hx, 8); x.fill(); x.fillRect(hx - .75, 6, 1.5, H - 10);
  }
  function shadeFor(s) {
    if (shadeK === s.norad) return; shadeK = s.norad; shade = null; const r = OB.rec(s), now = Date.now(), out = []; let a = null;
    for (let t = now - SPAN; t <= now + SPAN; t += 90e3) { const p = ORB.at(r, new Date(t)); if (!p) continue; const lit = ORB.lit(p.eci, new Date(t)); if (!lit && a == null) a = t; if (lit && a != null) { out.push([a, t]); a = null; } }
    if (a != null) out.push([a, now + SPAN]); shade = out; ruler();
  }
  tb.play.onclick = () => { const st = CLK.state(); CLK.set({ paused: !st.paused }); };
  tb.live.onclick = () => CLK.live();
  $('#warp').querySelectorAll('button').forEach(b => b.onclick = () => CLK.set({ rate: +b.dataset.w, paused: false }));
  (() => { const c = tb.sc; let was = false;
    const at = e => { const b = c.getBoundingClientRect(), k = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)); CLK.set({ t: Date.now() - SPAN + k * 2 * SPAN }); };
    c.addEventListener('pointerdown', e => { scrubbing = true; was = CLK.state().paused; CLK.set({ paused: true }); c.setPointerCapture(e.pointerId); at(e); });
    c.addEventListener('pointermove', e => { if (scrubbing) at(e); });
    const up = () => { if (!scrubbing) return; scrubbing = false; CLK.set({ paused: was }); }; c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  })();
  CLK.on(clockUI); setInterval(clockUI, 250);
  // the rest of the page is about right now: leaving the sky brings its clock back to live
  new IntersectionObserver(es => { if (!es[0].isIntersecting && !CLK.isLive()) CLK.live(); }, { threshold: 0 }).observe($('#sky'));

  // keys: space pauses, arrows step through the tour, L goes live, 1-4 set the speed, +/- zoom
  addEventListener('keydown', e => {
    if (booting() || e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) return;
    const r = $('#sky').getBoundingClientRect(); if (r.bottom < 80 || r.top > innerHeight * .6) return;
    if (e.key === ' ') { e.preventDefault(); tb.play.click(); }
    else if (e.key === 'ArrowRight') { stopTour(); step(1); } else if (e.key === 'ArrowLeft') { stopTour(); step(-1); }
    else if (e.key === 'l' || e.key === 'L') CLK.live();
    else if ('1234'.includes(e.key)) CLK.set({ rate: [1, 60, 600, 3600][+e.key - 1], paused: false });
    else if (e.key === '+' || e.key === '=') $('#zIn').click(); else if (e.key === '-') $('#zOut').click();
    else if (e.key === 'Escape') { globe.probe = null; $('#probe').classList.remove('on'); }
  });

  // the inspector: the focused satellite, recomputed from its real orbit on every tick of the clock
  const insp = $('#insp'); let IS = null;
  function focus(i, fly, auto) {
    focusI = i; globe.focus = i; const s = CAT.sats[i]; if (!s) return; if (!auto) idle = performance.now();
    const p = ORB.at(OB.rec(s), NOW()); if (fly && p) globe.lookAt(p.lat, p.lon);
    globe.focusLock = true; clearTimeout(focus._t); focus._t = setTimeout(() => { globe.focusLock = false; }, 9000);
    buildInsp(s); shadeFor(s);
  }
  function insTour() { const t = insp.querySelector('.tr'); if (t) t.classList.toggle('on', tourOn); }
  function buildInsp(s) {
    const r = OB.rec(s), sh = ORB.shape(r), ageH = (Date.now() - r.epochMs) / 36e5;
    IS = { s, r, sh, lap: null, spark: null, cross: null };
    insp.innerHTML = `<div class="ih"><i style="background:${OB.TAGS[s.tag][1]}"></i><span>${OB.TAGS[s.tag][0]}</span><span class="dim">· ${s.norad}</span><span class="tr${tourOn ? ' on' : ''}"><i class="live"></i>tour</span><span class="nv"><button type="button" data-d="-1" aria-label="previous">‹</button><button type="button" data-d="1" aria-label="next">›</button></span></div>
      <h3>${esc(s.name)}</h3>
      <div class="tele"><div><small>altitude</small><b id="iAlt">—</b><u>km</u></div><div><small>speed</small><b id="iSpd">—</b><u>km/s</u></div><div><small>latitude</small><b id="iLat">—</b></div><div><small>longitude</small><b id="iLon">—</b></div></div>
      <div class="lap"><div class="lt"><span>orbit <b id="iOrb">—</b></span><span id="iNx">—</span></div><div class="lb" id="iLb"></div></div>
      <div class="spk"><div class="lt"><span>altitude over this orbit</span><span id="iRg"></span></div><div class="sp" id="iSp"></div></div>
      <dl class="kv"><dt>sun</dt><dd id="iSun">—</dd><dt>below</dt><dd id="iBelow">—</dd><dt>orbit</dt><dd>${OB.num(sh.perigee)}–${OB.num(sh.apogee)} km · ${sh.inc.toFixed(1)}° · ${sh.period < 200 ? sh.period.toFixed(1) + ' min' : (sh.period / 60).toFixed(1) + ' h'}</dd><dt>elements</dt><dd>${ageH < 48 ? ageH.toFixed(1) + ' h' : Math.round(ageH / 24) + ' d'} old</dd><dt>coin</dt><dd id="iCoin">—</dd></dl>
      <div class="acts" id="iActs"></div>`;
    insp.querySelectorAll('.nv button').forEach(b => b.onclick = () => { stopTour(); step(+b.dataset.d); });
    insp.classList.remove('in'); void insp.offsetWidth; insp.classList.add('in');
    coinInsp(); updInsp();
  }
  function coinInsp() {
    if (!IS) return; const s = IS.s, coin = COINS.taken.get(s.norad), pairs = (PAIRS || []).filter(p => p.norad === s.norad);
    $('#iCoin').innerHTML = coin ? `<span class="tag live">$${esc(coin.symbol)} ${coin.state === 'live' ? 'live' : esc(coin.state)}</span>` : '<span class="acc">open</span>';
    $('#iCoin').innerHTML += pairs.length ? ` <span class="dim">+ ${pairs.length} paired</span>` : '';
    $('#iActs').innerHTML = `${coin ? '' : `<a class="btn s" href="/launch?n=${s.norad}">launch its coin ↗</a>`}<a class="btn s o" href="#pair" data-pair="${s.norad}">pair a coin</a><a class="btn s o" href="/sat?n=${s.norad}">its page</a>`;
    const pa = $('#iActs').querySelector('[data-pair]'); pa.onclick = () => { const q = $('#psQ'); if (q) { q.value = String(s.norad); q.dispatchEvent(new Event('input')); } };
  }
  function updInsp() {
    if (!IS) return; const { s, r } = IS, now = NOW(), p = ORB.at(r, now); if (!p) return;
    $('#iAlt').textContent = OB.num(p.alt); $('#iSpd').textContent = p.speed.toFixed(2);
    $('#iLat').textContent = Math.abs(p.lat).toFixed(2) + '°' + (p.lat >= 0 ? 'N' : 'S'); $('#iLon').textContent = Math.abs(p.lon).toFixed(2) + '°' + (p.lon >= 0 ? 'E' : 'W');
    const no = ORB.orbitNo(r, now), ph = ORB.orbitPhase(r, now), nx = ORB.nextOrbit(r, now), per = ORB.periodMin(r);
    $('#iOrb').textContent = '#' + OB.num(no); $('#iNx').textContent = 'next in ' + OB.dur(nx - now);
    const W = 34, f = Math.round(ph * W); $('#iLb').innerHTML = '<b>' + '#'.repeat(f) + '</b>' + '.'.repeat(W - f) + ` <span>${Math.round(ph * 100)}%</span>`;
    // altitude over the whole orbit, from the ascending node to the next; the caret is where it is now
    if (IS.lap !== no || !IS.spark) { IS.lap = no; const t0 = now.getTime() - ph * per * 6e4, A = []; for (let k = 0; k < 40; k++) { const q = ORB.at(r, new Date(t0 + k / 40 * per * 6e4)); A.push(q ? q.alt : NaN); }
      const ok = A.filter(v => v === v), lo = Math.min(...ok), hi = Math.max(...ok); IS.spark = { A, lo, hi }; $('#iRg').textContent = `${OB.num(lo)}–${OB.num(hi)} km`; }
    const { A, lo, hi } = IS.spark, B = '▁▂▃▄▅▆▇█', cur = Math.min(A.length - 1, Math.floor(ph * A.length));
    $('#iSp').innerHTML = A.map((v, k) => { const c = v === v ? B[Math.max(0, Math.min(7, Math.round((v - lo) / Math.max(1e-6, hi - lo) * 7)))] : ' '; return k === cur ? `<b>${c}</b>` : c; }).join('');
    // the sun: lit or not, and when that changes next (searched again only once the last answer has passed)
    const lit = ORB.lit(p.eci, now);
    if (!IS.cross || IS.cross.lit !== lit || (IS.cross.t && IS.cross.t < now) || Math.abs(now - IS.cross.at) > 6 * 36e5) { const t = ORB.nextCrossing(r, now, !lit, per > 200 ? 30 : 4); IS.cross = { lit, t, at: now.getTime() }; }
    $('#iSun').innerHTML = (lit ? '<span class="acc">sunlit</span>' : 'in shadow') + (IS.cross.t ? ` <span class="dim">· ${lit ? 'sets' : 'rises'} in ${OB.dur(IS.cross.t - now)}</span>` : '');
    const ss = ORB.subsolar(now), day = Math.sin(p.lat * D) * Math.sin(ss.lat * D) + Math.cos(p.lat * D) * Math.cos(ss.lat * D) * Math.cos((p.lon - ss.lon) * D) > 0;
    $('#iBelow').textContent = `${LAND.at(p.lat, p.lon) ? 'land' : 'ocean'} · ${day ? 'day' : 'night'}`;
  }

  // the event log: real laps, sunrises, sunsets and passes over cities, detected tick by tick from the positions
  const CITIES = [['Tokyo', 35.68, 139.69], ['New York', 40.71, -74.01], ['London', 51.51, -0.13], ['São Paulo', -23.55, -46.63], ['Sydney', -33.87, 151.21], ['Lagos', 6.52, 3.38], ['Mumbai', 19.08, 72.88], ['Los Angeles', 34.05, -118.24], ['Cairo', 30.04, 31.24], ['Moscow', 55.76, 37.62], ['Singapore', 1.35, 103.82], ['Mexico City', 19.43, -99.13], ['Stockholm', 59.33, 18.07], ['Beijing', 39.9, 116.4], ['Cape Town', -33.92, 18.42], ['Buenos Aires', -34.6, -58.38], ['Paris', 48.86, 2.35], ['Dubai', 25.2, 55.27], ['Seoul', 37.57, 126.98], ['Toronto', 43.65, -79.38], ['Jakarta', -6.2, 106.85], ['Nairobi', -1.29, 36.82], ['Honolulu', 21.31, -157.86], ['Reykjavík', 64.15, -21.94]].map(([n, la, lo]) => ({ n, lat: la, lon: lo }));
  const PRI = { station: 9, science: 8, weather: 6, earth: 5, gnss: 4, oneweb: 3, comms: 2, starlink: 1, other: 1 };
  let PV = null, PT = 0, PASSW = [], PEL = null, Q = [], RATE = [];
  function senseInit() {
    PASSW = CAT.sats.filter(s => (s.tag === 'station' && /^(ISS \(ZARYA|CSS \(TIANHE)/.test(s.name)) || s.tag === 'science' || (s.bright && s.tag !== 'starlink')).slice(0, 220).map(s => s.i);
    PEL = new Float32Array(PASSW.length * CITIES.length).fill(NaN);
  }
  function coinOf(s) { const c = COINS.taken.get(s.norad); if (c) return '$' + c.symbol; const t = globe.tags && globe.tags.get(s.i); return t || ''; }
  function sense(buf, t) {
    if (!CAT) return; const n = Math.min(CAT.sats.length, buf.length / 4), S = CAT.sats;
    const tot = {}, lt = {}; let L = 0, N = 0;
    for (let i = 0; i < n; i++) { const o = i * 4; if (buf[o] !== buf[o]) continue; const g = S[i].tag; tot[g] = (tot[g] || 0) + 1; N++; if (buf[o + 3] > .5) { lt[g] = (lt[g] || 0) + 1; L++; } }
    if (performance.now() - (sense.ui || 0) > 500) { sense.ui = performance.now(); $('#layers').querySelectorAll('.ly').forEach(b => { const g = b.dataset.t, k = tot[g] ? (lt[g] || 0) / tot[g] : 0; b.querySelector('u').style.width = (k * 100).toFixed(1) + '%'; b.title = `${OB.num(tot[g] || 0)} · ${Math.round(k * 100)}% in sunlight`; });
    $('#litN').textContent = N ? `☀ ${Math.round(L / N * 100)}% in sunlight` : ''; }
    const dt = t - PT;
    if (PV && dt > 0 && dt < 15 * 6e4) {
      let laps = 0, rises = 0; const said = new Set();
      for (let i = 0; i < n; i++) {
        const o = i * 4, la = buf[o], pa = PV[o]; if (la !== la || pa !== pa) continue; const s = S[i];
        let pr = PRI[s.tag] || 1; if (i === focusI) pr = 20; else if (coinOf(s)) pr = 15; else if (s.bright) pr = Math.max(pr, 7);
        const loud = pr > 1 || Math.random() < .02;
        if (pa < 0 && la >= 0 && buf[o + 2] < 30000) { laps++; if (loud) ev({ k: 'lap', i, t, pr }, said, la, buf[o + 1]); }
        const a = PV[o + 3] > .5, b = buf[o + 3] > .5; if (a !== b) { if (b) rises++; if (loud) ev({ k: b ? 'rise' : 'set', i, t, pr: pr - .5 }, said, la, buf[o + 1]); }
      }
      for (let a = 0; a < PASSW.length; a++) { const i = PASSW[a], o = i * 4; if (buf[o] !== buf[o]) continue;
        for (let c = 0; c < CITIES.length; c++) { const k = a * CITIES.length + c, el = lookFrom(CITIES[c], buf[o], buf[o + 1], buf[o + 2]).el, pe = PEL[k]; PEL[k] = el; if (pe === pe && pe < 10 && el >= 10) ev({ k: 'pass', i, t, c, pr: (i === focusI ? 20 : coinOf(S[i]) ? 15 : 9) + .5 }, said, c, i); } }
      RATE.push([t, dt, laps, rises]); while (RATE.length > 2 && t - RATE[0][0] > 10 * 6e4) RATE.shift();
      const sm = RATE.reduce((z, r) => z + r[1], 0) / 6e4, lp = RATE.reduce((z, r) => z + r[2], 0), rs = RATE.reduce((z, r) => z + r[3], 0);
      if (sm > .3) $('#feedRate').textContent = `↺ ${OB.num(lp / sm)} · ☀ ${OB.num(rs / sm)} /min`;
    } else { RATE = []; if (PEL) PEL.fill(NaN); if (PV) { Q = []; const d = document.createElement('div'); d.className = 'ev jump'; d.textContent = `clock → ${hhmmss(t)} utc`; const f = $('#feed'); f.prepend(d); while (f.children.length > (mob ? 5 : 9)) f.lastChild.remove(); } }
    PV = buf; PT = t;
  }
  function ev(e, said, a, b) { const key = e.k + ':' + Math.round(a) + ':' + Math.round(b); if (said.has(key)) return; said.add(key); e.at = performance.now(); Q.push(e); if (Q.length > 500) { Q.sort((x, y) => y.pr - x.pr); Q.length = 300; } }
  const KIND = { lap: ['↺', 'lap', 'var(--acc)'], rise: ['+', 'rise', 'var(--gold)'], set: ['−', 'set', 'var(--ink3)'], pass: ['^', 'pass', 'var(--burn)'] };
  function feedTick() {
    const pn = performance.now(); Q = Q.filter(e => pn - e.at < (CLK.isLive() ? 25000 : 4000)); if (!Q.length || !CAT) return;
    let bi = 0; for (let k = 1; k < Q.length; k++) if (Q[k].pr > Q[bi].pr || (Q[k].pr === Q[bi].pr && Q[k].t > Q[bi].t)) bi = k;
    const e = Q.splice(bi, 1)[0], s = CAT.sats[e.i], [g, , col] = KIND[e.k], cn = coinOf(s);
    const what = e.k === 'lap' ? `orbit #${OB.num(ORB.orbitNo(OB.rec(s), new Date(e.t)))}` : e.k === 'rise' ? 'out of Earth’s shadow' : e.k === 'set' ? 'into Earth’s shadow' : `over ${CITIES[e.c].n}`;
    const d = document.createElement('a'); d.className = 'ev'; d.href = '#'; d.dataset.i = e.i;
    d.innerHTML = `<time>${hhmmss(e.t)}</time><i style="color:${col}">${g}</i><b>${esc(s.name.replace(/\s*\((ZARYA|TIANHE)\)/, ''))}</b><span>${what}</span>${cn ? `<em>${esc(cn)}</em>` : ''}`;
    d.onclick = ev2 => { ev2.preventDefault(); stopTour(); focus(e.i, true); };
    const f = $('#feed'); f.prepend(d); while (f.children.length > (mob ? 5 : 9)) f.lastChild.remove();
    PINGS.push({ i: e.i, k: e.k, c: e.c, t0: pn });
  }
  let lastPop = 0; setInterval(() => { if (document.hidden) return; const pn = performance.now(); if (CLK.isLive() && pn - lastPop < 640) return; lastPop = pn; feedTick(); }, 300);
  function pings(x, g) {
    if (!POS || !PINGS.length) return; const pn = performance.now(), P = POS; PINGS = PINGS.filter(e => pn - e.t0 < 1800);
    x.save(); x.lineWidth = 1.2;
    for (const e of PINGS) { const k = (pn - e.t0) / 1800, o = e.i * 4; if (P[o] !== P[o]) continue; const p = g.proj(P[o], P[o + 1], SKY.altR(P[o + 2])); if (p[2] < 0 && p[0] * p[0] + p[1] * p[1] < 1) continue;
      const sx = g.X + p[0] * g.R, sy = g.Y - p[1] * g.R, col = e.k === 'lap' ? '40,110,214' : e.k === 'rise' ? '150,96,0' : e.k === 'set' ? '29,57,52' : '194,71,14';
      x.strokeStyle = `rgba(${col},${(1 - k) * .9})`; x.beginPath(); x.arc(sx, sy, 3 + k * 20, 0, Math.PI * 2); x.stroke();
      if (e.k === 'pass') { const cy = CITIES[e.c], q = g.proj(cy.lat, cy.lon, 1); if (q[2] > 0) { const cx = g.X + q[0] * g.R, cyy = g.Y - q[1] * g.R; x.setLineDash([2, 3]); x.beginPath(); x.moveTo(cx, cyy); x.lineTo(sx, sy); x.stroke(); x.setLineDash([]);
        x.fillStyle = `rgba(${col},${1 - k})`; x.font = `700 11px JBM, monospace`; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText('+ ' + cy.n, cx + 4, cyy); } } }
    x.restore();
  }

  // click the planet anywhere: what is above that spot at the clock's moment
  function probe(gp, px, py) {
    const pb = $('#probe'); if (!gp || !POS || !CAT) { globe.probe = null; pb.classList.remove('on'); return; }
    stopTour(); const here = { lat: gp.lat, lon: gp.lon }, up = [], n = Math.min(CAT.sats.length, POS.length / 4);
    for (let i = 0; i < n; i++) { const o = i * 4; if (POS[o] !== POS[o]) continue; const l = lookFrom(here, POS[o], POS[o + 1], POS[o + 2]); if (l.el > 30) up.push([l.el, i]); }
    up.sort((a, b) => b[0] - a[0]); globe.probe = { lat: gp.lat, lon: gp.lon, list: up.slice(0, 60).map(u => u[1]) };
    const named = up.filter(([, i]) => CAT.sats[i].tag !== 'starlink').slice(0, 5).concat(up.filter(([, i]) => CAT.sats[i].tag === 'starlink').slice(0, 1));
    pb.innerHTML = `<button class="x" type="button">×</button><b>${OB.ll(gp.lat, gp.lon)}</b><small>${OB.num(up.length)} satellites more than 30° up · ${CLK.isLive() ? 'now' : hhmmss(CLK.now()) + ' utc'}</small>` + named.map(([el, i]) => `<a data-i="${i}"><span style="color:var(--ink)">${esc(CAT.sats[i].name)}</span><span>${Math.round(el)}°</span></a>`).join('');
    const sky = $('#sky'), W = sky.clientWidth, H = sky.clientHeight; pb.style.left = Math.min(W - 290, px + 18) + 'px'; pb.style.top = Math.min(H - 260, Math.max(10, py - 20)) + 'px'; pb.classList.add('on');
    pb.querySelector('.x').onclick = () => { globe.probe = null; pb.classList.remove('on'); };
    pb.querySelectorAll('a').forEach(a => a.onclick = () => { focus(+a.dataset.i, true); pb.classList.remove('on'); globe.probe = null; });
  }

  // ---------- data ----------
  async function boot() {
    try { CAT = await OB.catalog(); } catch (e) { $('#layers').innerHTML = `<div class="empty">catalogue offline</div>`; $('#ctab').innerHTML = `<div class="empty"><b>The catalogue didn’t answer.</b>${esc(e.message)}. It retries on the next visit.</div>`; return; }
    const by = {}; CAT.sats.forEach(s => by[s.tag] = (by[s.tag] || 0) + 1); layers(by); senseInit();
    globe.setSats(CAT.sats); await SKY.start(CAT.sats);
    SKY.on((buf, t) => { POS = buf; globe.setPos(buf); sense(buf, t); updInsp(); });
    $('#catMeta').textContent = `${OB.num(CAT.count)} active · elements ${OB.ago(CAT.at)}`;
    const iss = CAT.by.get(25544); if (iss && focusI == null) focus(iss.i, false, true);
    COINS = await OB.coins(); coinInsp();
    tape(by); catalogue(); rulesDemo(); coinsGrid(); falling(); overheadInit();
    types(by); pairing();
  }
  // the sky by type: ASCII bars that fill when they come into view; a row lights its group up on the globe
  function types(by) {
    const tot = CAT.count, rows = Object.entries(by).sort((a, b) => b[1] - a[1]), max = rows[0][1];
    $('#typeMeta').textContent = `${OB.num(tot)} active · elements ${OB.ago(CAT.at)}`;
    const box = $('#typeBars'); box.innerHTML = rows.map(([k, n]) => `<div class="ty" data-t="${k}"><span class="nm"><i style="background:${OB.TAGS[k][1]}"></i>${OB.TAGS[k][0]}</span><span class="bars" data-n="${n}"></span><span class="n" data-v="${n}">0</span><span class="p">${(n / tot * 100).toFixed(1)}%</span></div>`).join('');
    const W = () => Math.max(10, Math.floor((box.querySelector('.bars').clientWidth || 400) / 7.2));
    const fill = () => { const w = W(); box.querySelectorAll('.ty').forEach((r, j) => { const n = +r.querySelector('.bars').dataset.n, full = Math.max(1, Math.round(n / max * w)); const t0 = performance.now() + j * 90;
      const step = t => { const k = Math.max(0, Math.min(1, (t - t0) / 1100)), e = 1 - Math.pow(1 - k, 3), m = Math.round(full * e); r.querySelector('.bars').innerHTML = '#'.repeat(m) + '<span>' + '.'.repeat(Math.max(0, w - m)) + '</span>'; r.querySelector('.n').textContent = OB.num(n * e); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }); };
    new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { fill(); io.disconnect(); } }, { threshold: .3 }).observe(box);
    box.querySelectorAll('.ty').forEach(r => r.onclick = () => { setLayer(r.dataset.t); stopTour(); $('#sky').scrollIntoView({ behavior: 'smooth' }); });
  }
  // the ticker: real counts and real positions
  function tape(by) {
    const t = $('#tape'); const iss = CAT.by.get(25544), now = new Date(); const it = [];
    it.push(`<span><b>${OB.num(CAT.count)}</b> active satellites tracked</span>`);
    Object.entries(by).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => it.push(`<span>${OB.TAGS[k][0]} <b>${OB.num(n)}</b></span>`));
    if (iss) { const p = ORB.at(OB.rec(iss), now); if (p) it.push(`<span>ISS over <b>${OB.ll(p.lat, p.lon)}</b> at ${Math.round(p.alt)} km</span>`); }
    const newest = CAT.sats.reduce((a, b) => b.norad > a.norad ? b : a, CAT.sats[0]); it.push(`<span>newest in the catalogue <b>${esc(newest.name)}</b> · ${newest.norad}</span>`);
    const ss = ORB.subsolar(now); it.push(`<span>sun overhead at <b>${OB.ll(ss.lat, ss.lon)}</b></span>`);
    it.push(`<span>coins in orbit <b>${COINS.list.filter(c => c.state === 'live').length}</b></span>`);
    t.innerHTML = it.join('') + it.join('');
  }

  // ---------- 02 overhead ----------
  let HERE = null; const D = Math.PI / 180;
  function overheadInit() {
    let h0 = null; try { h0 = JSON.parse(localStorage.getItem('orbt_here') || 'null'); } catch (e) {}
    if (h0 && isFinite(h0.lat)) setHere(h0, true); else { const z = tzCity(); setHere(z, true); }
    $('#locBtn').onclick = () => { if (!navigator.geolocation) return OB.toast('This browser has no location.'); $('#locBtn').textContent = 'locating…';
      navigator.geolocation.getCurrentPosition(p => { $('#locBtn').textContent = 'use my location'; setHere({ lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3), name: 'your location' }); },
        () => { $('#locBtn').textContent = 'use my location'; OB.toast('Location was declined. Search a city instead.'); }, { timeout: 10000 }); };
    const cq = $('#cityQ'), cr = $('#cityRes'); let h;
    cq.oninput = () => { clearTimeout(h); const v = cq.value.trim(); if (v.length < 2) { cr.classList.remove('on'); return; } h = setTimeout(async () => {
      try { const j = await (await fetch('https://geocoding-api.open-meteo.com/v1/search?count=6&language=en&name=' + encodeURIComponent(v))).json(); const rs = j.results || [];
        cr.innerHTML = rs.length ? rs.map((r, i) => `<a href="#" data-i="${i}">${esc(r.name)}<span>${esc(r.country || '')}</span></a>`).join('') : '<div class="empty">No city by that name.</div>'; cr.classList.add('on');
        cr.querySelectorAll('a').forEach(a => a.onclick = e => { e.preventDefault(); const r = rs[+a.dataset.i]; cr.classList.remove('on'); cq.value = ''; setHere({ lat: r.latitude, lon: r.longitude, name: r.name + (r.country ? ', ' + r.country : '') }); });
      } catch (e) { OB.toast('City search didn’t answer.'); } }, 260); };
    setInterval(sky, 2000);
  }
  function tzCity() {
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').split('/').pop().replace(/_/g, ' ');
    const C = { 'Stockholm': [59.33, 18.07], 'London': [51.51, -0.13], 'Paris': [48.86, 2.35], 'Berlin': [52.52, 13.4], 'Madrid': [40.42, -3.7], 'Rome': [41.9, 12.5], 'Amsterdam': [52.37, 4.9], 'Oslo': [59.91, 10.75], 'Copenhagen': [55.68, 12.57], 'Helsinki': [60.17, 24.94], 'Warsaw': [52.23, 21.01], 'Istanbul': [41.01, 28.98], 'Dubai': [25.2, 55.27], 'Kolkata': [22.57, 88.36], 'Singapore': [1.35, 103.82], 'Tokyo': [35.68, 139.69], 'Shanghai': [31.23, 121.47], 'Hong Kong': [22.32, 114.17], 'Seoul': [37.57, 126.98], 'Sydney': [-33.87, 151.21], 'New York': [40.71, -74.01], 'Chicago': [41.88, -87.63], 'Denver': [39.74, -104.99], 'Los Angeles': [34.05, -118.24], 'Toronto': [43.65, -79.38], 'Sao Paulo': [-23.55, -46.63], 'Mexico City': [19.43, -99.13], 'Lagos': [6.52, 3.38], 'Johannesburg': [-26.2, 28.05], 'Moscow': [55.76, 37.62] };
    const c = C[tz] || C['London']; return { lat: c[0], lon: c[1], name: (C[tz] ? tz : 'London') + ' (from your time zone)' };
  }
  function setHere(h, quiet) { HERE = h; if (!quiet) try { localStorage.setItem('orbt_here', JSON.stringify(h)); } catch (e) {} $('#here').textContent = `${h.name} · ${OB.ll(h.lat, h.lon)}`; sky(); passes(); }
  // look angles straight from the worker's positions (fast enough for every satellite, every two seconds)
  function lookFrom(h, lat, lon, alt) {
    const Re = 6378.137, la = lat * D, lo = lon * D, ha = h.lat * D, ho = h.lon * D, r = Re + alt;
    const sx = r * Math.cos(la) * Math.cos(lo), sy = r * Math.cos(la) * Math.sin(lo), sz = r * Math.sin(la);
    const ox = Re * Math.cos(ha) * Math.cos(ho), oy = Re * Math.cos(ha) * Math.sin(ho), oz = Re * Math.sin(ha);
    const dx = sx - ox, dy = sy - oy, dz = sz - oz;
    const e = -Math.sin(ho) * dx + Math.cos(ho) * dy, n = -Math.sin(ha) * Math.cos(ho) * dx - Math.sin(ha) * Math.sin(ho) * dy + Math.cos(ha) * dz, u = Math.cos(ha) * Math.cos(ho) * dx + Math.cos(ha) * Math.sin(ho) * dy + Math.sin(ha) * dz;
    const rg = Math.hypot(dx, dy, dz); return { el: Math.asin(u / rg) / D, az: (Math.atan2(e, n) / D + 360) % 360, rg };
  }
  const compass = a => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(a / 45) % 8];
  function sunEl(h) { const s = ORB.subsolar(new Date()); return Math.asin(Math.sin(h.lat * D) * Math.sin(s.lat * D) + Math.cos(h.lat * D) * Math.cos(s.lat * D) * Math.cos((h.lon - s.lon) * D)) / D; }
  function sky() {
    if (!HERE || !POS || !CAT || !CLK.isLive()) return; const up = [], P = POS, n = Math.min(CAT.sats.length, P.length / 4); const se = sunEl(HERE), dark = se < -6;
    for (let i = 0; i < n; i++) { const o = i * 4; if (P[o] !== P[o]) continue; const l = lookFrom(HERE, P[o], P[o + 1], P[o + 2]); if (l.el > 0) up.push({ i, ...l, lit: P[o + 3] > .5 }); }
    up.sort((a, b) => b.el - a.el);
    $('#domeN').textContent = `${OB.num(up.length)} above the horizon · sun ${se > 0 ? 'up' : dark ? 'down, sky dark' : 'just down, twilight'}`;
    $('#ohMeta').textContent = `${HERE.name}`;
    dome(up, dark);
    const vis = s => dark && s.lit;
    const top = up.filter(s => CAT.sats[s.i].tag !== 'starlink' || s.el > 60).slice(0, 14);
    $('#olist').innerHTML = `<div class="r h"><span>satellite</span><span>height</span><span>look</span><span>distance</span><span></span></div>` + top.map(s => { const c = CAT.sats[s.i];
      return `<div class="r" data-i="${s.i}"><b>${esc(c.name)}</b><span>${Math.round(s.el)}°</span><span>${compass(s.az)} ${Math.round(s.az)}°</span><span>${OB.num(s.rg)} km</span><span class="vis">${vis(s) ? 'visible' : s.lit ? 'sunlit' : 'in shadow'}</span></div>`; }).join('');
    $('#olist').querySelectorAll('.r[data-i]').forEach(r => r.onclick = () => { focus(+r.dataset.i, true); $('#sky').scrollIntoView({ behavior: 'smooth' }); });
  }
  function dome(up, dark) {
    const c = $('#dome'), x = c.getContext('2d'), d = Math.min(2, devicePixelRatio || 1), W = c.clientWidth; c.width = W * d; c.height = W * d; x.setTransform(d, 0, 0, d, 0, 0);
    const R = W / 2 - 18, X = W / 2, Y = W / 2; x.clearRect(0, 0, W, W);
    x.strokeStyle = 'rgba(29,57,52,.25)'; x.setLineDash([2, 5]); [0, 30, 60].forEach(e => { x.beginPath(); x.arc(X, Y, R * (1 - e / 90), 0, Math.PI * 2); x.stroke(); }); x.setLineDash([]);
    x.strokeStyle = 'rgba(29,57,52,.12)'; for (let a = 0; a < 360; a += 45) { x.beginPath(); x.moveTo(X, Y); x.lineTo(X + Math.sin(a * D) * R, Y - Math.cos(a * D) * R); x.stroke(); }
    x.font = '11px JBM, monospace'; x.fillStyle = 'rgba(29,57,52,.6)'; x.textAlign = 'center'; x.textBaseline = 'middle';
    [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([t, a]) => x.fillText(t, X + Math.sin(a * D) * (R + 10), Y - Math.cos(a * D) * (R + 10)));
    x.fillText('+', X, Y);
    for (const s of up) { const c2 = CAT.sats[s.i], r = R * (1 - s.el / 90), px = X + Math.sin(s.az * D) * r, py = Y - Math.cos(s.az * D) * r;
      x.fillStyle = OB.TAGS[c2.tag][1]; x.globalAlpha = s.lit ? (c2.tag === 'starlink' ? .5 : .9) : .25; const z = c2.tag === 'station' ? 5 : c2.tag === 'starlink' ? 2 : 3; x.fillRect(px - z / 2, py - z / 2, z, z);
      if (c2.tag === 'station' || (c2.bright && s.el > 25)) { x.globalAlpha = .9; x.fillStyle = '#1d3934'; x.textAlign = 'left'; x.fillText(c2.name.replace(/\s*\(.*\)/, '').slice(0, 14), px + 6, py - 6); x.textAlign = 'center'; } }
    x.globalAlpha = 1;
  }
  // the next passes of the stations and the brightest satellites, computed in small chunks so the page stays smooth
  let passJob = 0;
  function passes() {
    if (!HERE || !CAT) return; const job = ++passJob; const el = $('#passes'); el.innerHTML = '<div class="empty">Computing passes for the next 24 hours…</div>';
    const list = CAT.sats.filter(s => s.tag === 'station' || s.bright).slice(0, 60); const out = []; const now = new Date(); let k = 0;
    const step = () => {
      if (job !== passJob) return; const t0 = performance.now();
      while (k < list.length && performance.now() - t0 < 30) { const s = list[k++]; try { for (const p of ORB.passes(OB.rec(s), HERE, now, 24, 25, 4)) out.push({ s, p }); } catch (e) {} }
      if (k < list.length) return setTimeout(step, 0);
      out.sort((a, b) => a.p.rise - b.p.rise);
      $('#passMeta').textContent = `${out.length} passes higher than 25° · ${list.length} bright satellites and stations`;
      el.innerHTML = out.length ? `<div class="pass" style="color:var(--ink3);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase"><span>satellite</span><span>rises (your time)</span><span>highest</span><span>lasts</span></div>` + out.slice(0, 14).map(({ s, p }) =>
        `<div class="pass"><a href="/sat?n=${s.norad}"><b>${esc(s.name)}</b></a><span>${p.rise.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · ${compass(p.riseAz)}</span><span>${Math.round(p.maxEl)}° ${compass(p.maxAz)}</span><span>${p.set ? Math.round((p.set - p.rise) / 6e4) + ' min' : '—'}</span></div>`).join('')
        : '<div class="empty">No pass above 25° in the next 24 hours from here.</div>';
    };
    step();
  }

  // ---------- 03 the catalogue ----------
  let csort = 'vis', ctag = null, cq = '', copen = false, cshow = 60;
  function catalogue() {
    const by = {}; CAT.sats.forEach(s => by[s.tag] = (by[s.tag] || 0) + 1);
    $('#ctags').innerHTML = Object.entries(OB.TAGS).filter(([k]) => by[k]).map(([k, [nm]]) => `<button class="chip" data-t="${k}" type="button">${nm}</button>`).join('');
    $('#ctags').querySelectorAll('.chip').forEach(b => b.onclick = () => { const on = !b.classList.contains('on'); $('#ctags').querySelectorAll('.chip').forEach(x => x.classList.remove('on')); if (on) b.classList.add('on'); ctag = on ? b.dataset.t : null; cshow = 60; ctable(); });
    $('#csort').querySelectorAll('.chip').forEach(b => b.onclick = () => { $('#csort').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); csort = b.dataset.s; cshow = 60; ctable(); });
    let h; $('#cq').oninput = e => { clearTimeout(h); h = setTimeout(() => { cq = e.target.value.trim().toLowerCase(); cshow = 60; ctable(); }, 150); };
    $('#copen').onchange = e => { copen = e.target.checked; ctable(); };
    ctable(); setInterval(() => { if (!document.hidden) liveAlt(); }, 3000);
  }
  const rank = s => (s.tag === 'station' ? 0 : s.bright ? 1 : s.tag === 'science' ? 2 : s.tag === 'weather' ? 3 : s.tag === 'earth' ? 4 : s.tag === 'gnss' ? 5 : s.tag === 'comms' ? 6 : s.tag === 'other' ? 7 : 8);
  const altOf = s => POS && POS[s.i * 4] === POS[s.i * 4] ? POS[s.i * 4 + 2] : null;
  function ctable() {
    let L = CAT.sats.filter(s => (!ctag || s.tag === ctag) && (!cq || s.name.toLowerCase().includes(cq) || String(s.norad) === cq) && (!copen || !COINS.taken.has(s.norad)));
    if (csort === 'vis') L.sort((a, b) => rank(a) - rank(b) || a.norad - b.norad);
    else if (csort === 'new') L.sort((a, b) => b.norad - a.norad);
    else if (csort === 'name') L.sort((a, b) => a.name.localeCompare(b.name));
    else L.sort((a, b) => (altOf(a) ?? 1e9) - (altOf(b) ?? 1e9));
    const total = L.length; L = L.slice(0, cshow);
    $('#ctab').innerHTML = `<div class="r h"><span>norad</span><span>name</span><span>type</span><span>altitude</span><span>period</span><span>incl.</span><span class="go">coin</span></div>` + L.map(s => {
      const r = OB.rec(s), sh = ORB.shape(r), a = altOf(s), c = COINS.taken.get(s.norad);
      return `<div class="r" data-n="${s.norad}"><span class="dim">${s.norad}</span><a class="nm" href="/sat?n=${s.norad}">${esc(s.name)}</a><span><span class="tag">${OB.TAGS[s.tag][0]}</span></span><span class="al">${a != null ? OB.num(a) + ' km' : '—'}</span><span>${sh.period.toFixed(1)}m</span><span>${sh.inc.toFixed(1)}°</span>
        <span class="go">${c ? `<a class="tag live" href="/sat?n=${s.norad}">$${esc(c.symbol)}</a>` : `<a class="btn s o" href="/launch?n=${s.norad}">launch →</a>`}</span></div>`; }).join('')
      + (total > cshow ? `<div class="more"><button class="btn s o" id="cmore" type="button">show more · ${OB.num(total - cshow)} left</button></div>` : '') + (!total ? '<div class="empty">Nothing matches.</div>' : '');
    const m = $('#cmore'); if (m) m.onclick = () => { cshow += 60; ctable(); };
    $('#ctab').querySelectorAll('.r[data-n]').forEach(r => r.onclick = e => { if (e.target.closest('a')) return; const s = CAT.by.get(+r.dataset.n); if (!s) return; stopTour(); focus(s.i, true); $('#sky').scrollIntoView({ behavior: 'smooth' }); });
  }
  function liveAlt() { if (!POS) return; $('#ctab').querySelectorAll('.r[data-n]').forEach(r => { const s = CAT.by.get(+r.dataset.n); const a = s && altOf(s); const el = r.querySelector('.al'); if (el && a != null) el.textContent = OB.num(a) + ' km'; }); }

  // ---------- 04 a rulebook running on the ISS ----------
  let demoT = null;
  function rulesDemo(norad) {
    const DEMO = [[25544, 'ISS'], [48274, 'Tiangong'], [20580, 'Hubble'], [33591, 'NOAA 19']].filter(([n]) => CAT.by.has(n));
    norad = norad || (DEMO[0] && DEMO[0][0]); const iss = CAT.by.get(norad); if (!iss) { $('#book').textContent = 'The example satellite is not in the catalogue right now.'; return; }
    $('#bookPick').innerHTML = DEMO.map(([n, t]) => `<button class="chip ${n === norad ? 'on' : ''}" type="button" data-n="${n}" style="border-color:#2a3f3a;color:${n === norad ? '#0f1f1c' : '#cfe0da'};background:${n === norad ? '#cfe0da' : 'transparent'}">${t}</button>`).join('');
    $('#bookPick').querySelectorAll('button').forEach(b => b.onclick = () => rulesDemo(+b.dataset.n));
    $('#bookSat').textContent = iss.name; clearInterval(demoT);
    const r = OB.rec(iss), NY = { name: 'New York', lat: 40.713, lon: -74.006 };
    const book = () => {
      const now = new Date(), p = ORB.at(r, now), lit = p && ORB.lit(p.eci, now), nx = ORB.nextOrbit(r, now), ns = ORB.nextCrossing(r, now, true), np = ORB.passes(r, NY, now, 36, 20, 1)[0];
      $('#book').innerHTML = `<span class="c"># ${esc(iss.name)} · NORAD ${iss.norad} · example rulebook</span>
<span class="k">01</span>  when <span class="s">sat.orbit.complete</span>            -> <span class="a">buyback_burn(5% chest)</span>
    <span class="c"># orbit #${OB.num(ORB.orbitNo(r, now))} · next lap in ${OB.dur(nx - now)}</span>
<span class="k">02</span>  when <span class="s">sat.sunrise</span>                   -> <span class="a">buyback_burn(8% chest)</span>
    <span class="c"># ${lit ? 'in sunlight now' : 'in Earth’s shadow now'}${ns ? ' · next sunrise in ' + OB.dur(ns - now) : ''}</span>
<span class="k">03</span>  when <span class="s">sat.passes("New York", el > 20°)</span> -> <span class="a">airdrop_holders(20% chest)</span>
    <span class="c"># ${np ? 'next pass ' + np.rise.toISOString().slice(11, 16) + ' UTC, ' + Math.round(np.maxEl) + '° high' : 'no pass above 20° in 36 h'}</span>
<span class="k">04</span>  when <span class="s">sat.reenters</span>                  -> <span class="a">pay_holders(100% chest)</span>
    <span class="c"># altitude ${p ? Math.round(p.alt) : '—'} km · still flying</span>`;
      $('#lapMeta').textContent = `orbit #${OB.num(ORB.orbitNo(r, now))} · ${(ORB.orbitPhase(r, now) * 100).toFixed(1)}% of the lap`;
    };
    book(); demoT = setInterval(book, 1000);
    // what it would have fired: real laps, real sunrises, real passes over New York, last 6 hours
    const now = new Date(), from = new Date(now - 6 * 36e5), ev = [];
    const per = ORB.periodMin(r); for (let t = ORB.nextOrbit(r, from); t < now; t = new Date(t.getTime() + per * 6e4)) ev.push([t, `orbit #${OB.num(ORB.orbitNo(r, new Date(t.getTime() + 5e3)))} complete`, 'buyback_burn(5% chest)']);
    ORB.crossings(r, from, now).filter(c => c.rise).forEach(c => ev.push([c.t, 'sunrise: out of Earth’s shadow', 'buyback_burn(8% chest)']));
    ORB.passes(r, NY, from, 6, 20).forEach(p => ev.push([p.rise, `pass over New York, ${Math.round(p.maxEl)}° high`, 'airdrop_holders(20% chest)']));
    ev.sort((a, b) => b[0] - a[0]);
    $('#flog').innerHTML = ev.map(([t, w, a]) => `<div><span class="dim">${t.toISOString().slice(11, 19)} UTC</span>  ${esc(w)}  <span class="acc">→ ${a}</span></div>`).join('') || '<div class="dim">Nothing in the last 6 hours.</div>';
    lapR = r; if (!lapOn) { lapOn = true; lap(); }
  }
  let lapR = null, lapOn = false;
  function lap() {
    const c = $('#lap'), x = c.getContext('2d'); let W, H; const fit = () => { const d = Math.min(2, devicePixelRatio || 1); W = c.clientWidth; H = c.clientHeight; c.width = W * d; c.height = H * d; x.setTransform(d, 0, 0, d, 0, 0); }; fit(); addEventListener('resize', fit);
    let vis = true; new IntersectionObserver(e => { vis = e[0].isIntersecting; }).observe(c);
    const draw = () => {
      requestAnimationFrame(draw); if (!vis || document.hidden) return; const r = lapR, now = new Date(), ph = ORB.orbitPhase(r, now), p = ORB.at(r, now); x.clearRect(0, 0, W, H);
      const X = W / 2, Y = H / 2 + 6, rx = Math.min(W * .42, 230), ry = rx * .38;
      x.font = '12px JBM, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      // the planet as characters
      const R = ry * 1.25; for (let yy = -R; yy <= R; yy += 13) for (let xx = -R; xx <= R; xx += 7.5) { if (xx * xx + yy * yy > R * R) continue; const lat = -yy / R * 80, lon = xx / R * 80 + (p ? p.lon : 0); x.fillStyle = LAND.at(lat, ((lon + 540) % 360) - 180) ? 'rgba(29,57,52,.75)' : 'rgba(29,57,52,.12)'; x.fillText(LAND.at(lat, ((lon + 540) % 360) - 180) ? '#' : '.', X + xx, Y + yy); }
      // the orbit, dotted, with the part already flown this lap in blue
      for (let a = 0; a < 1; a += .006) { const ang = a * Math.PI * 2 - Math.PI / 2, px = X + Math.cos(ang) * rx, py = Y + Math.sin(ang) * ry; const behind = Math.sin(ang) < 0 && Math.abs(px - X) < R; if (behind) continue; x.fillStyle = a <= ph ? 'rgba(40,110,214,.9)' : 'rgba(29,57,52,.3)'; x.fillRect(px - 1, py - 1, 2, 2); }
      const ang = ph * Math.PI * 2 - Math.PI / 2, sx = X + Math.cos(ang) * rx, sy = Y + Math.sin(ang) * ry;
      x.font = '800 15px JBM, monospace'; x.fillStyle = '#1d3934'; x.fillText('=[]=', sx, sy);
      x.font = '11px JBM, monospace'; x.fillStyle = 'rgba(29,57,52,.6)'; x.fillText('lap start · ascending node', X, Y - ry - 14); x.fillText('|', X, Y - ry - 3);
      x.fillStyle = '#286ed6'; x.font = '700 12px JBM, monospace'; x.fillText(`${(ph * 100).toFixed(2)}%  ·  next fire in ${OB.dur(ORB.nextOrbit(r, now) - now)}`, X, H - 16);
    };
    requestAnimationFrame(draw);
  }

  // ---------- pair any pump.fun coin with a satellite ----------
  let PC = null, PS = null, PAIRS = [];
  const coinRow = c => `<a data-m="${esc(c.mint)}">${c.icon ? `<img src="${esc(c.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">` : '<span class="gl">$</span>'}<div style="min-width:0"><b>$${esc(c.symbol)}</b><small>${esc(c.name)} · ${OB.short(c.mint)}</small></div><span>${OB.usd(c.mcap)}${c.ch1h != null ? `<br><em class="${c.ch1h >= 0 ? 'up' : 'down'}" style="font-style:normal">${c.ch1h >= 0 ? '+' : ''}${Math.round(c.ch1h)}%</em>` : ''}</span></a>`;
  const satRow = s => { const p = POS && POS[s.i * 4] === POS[s.i * 4] ? POS[s.i * 4 + 2] : null; return `<a data-n="${s.norad}"><span class="gl">=[]=</span><div style="min-width:0"><b>${esc(s.name)}</b><small>${s.norad} · ${OB.TAGS[s.tag][0]}</small></div><span>${p != null ? OB.num(p) + ' km' : ''}</span></a>`; };
  function pairing() {
    const pick = c => { PC = c; $('#pvCoin').innerHTML = `${c.icon ? `<img src="${esc(c.icon)}" alt="" style="width:34px;height:34px;object-fit:cover;border:1px solid var(--line);float:left;margin-right:8px" referrerpolicy="no-referrer">` : ''}<b>$${esc(c.symbol)}</b>${esc(c.name)}<br><span class="dim">${OB.usd(c.mcap)}</span>`; $('#pvCoin').classList.remove('dim'); ready(); };
    const pickS = s => { PS = s; $('#pvSat').innerHTML = `<b>${esc(s.name)}</b>NORAD ${s.norad}<br><span class="dim">${OB.TAGS[s.tag][0]}</span>`; $('#pvSat').classList.remove('dim'); ready(); };
    const ready = () => { $('#pairBtn').disabled = !(PC && PS); $('#pairState').textContent = PC && PS ? 'ready' : PC ? 'now pick a satellite' : PS ? 'now pick a coin' : 'pick both'; $('#pairBtn').textContent = PC && PS ? `pair $${PC.symbol} with ${PS.name.slice(0, 18)} →` : 'pair them →'; };
    const bindCoins = (box, list) => box.querySelectorAll('a').forEach(a => a.onclick = () => { box.querySelectorAll('a').forEach(x => x.classList.toggle('on', x === a)); pick(list.find(c => c.mint === a.dataset.m)); });
    let h; $('#pcQ').oninput = () => { clearTimeout(h); const v = $('#pcQ').value.trim(); if (v.length < 2) { $('#pcRes').innerHTML = ''; return; } $('#pcRes').innerHTML = '<div class="empty">searching pump.fun coins…</div>';
      h = setTimeout(async () => { try { const j = await OB.api('pair?op=search&q=' + encodeURIComponent(v)); $('#pcRes').innerHTML = j.coins.length ? j.coins.map(coinRow).join('') : '<div class="empty">No pump.fun coin by that name or address.</div>'; bindCoins($('#pcRes'), j.coins); } catch (e) { $('#pcRes').innerHTML = `<div class="empty">${esc(e.message)}</div>`; } }, 300); };
    OB.api('pair?op=trending').then(j => { const L = j.coins || []; $('#trAt').textContent = L.length + ' coins · 1h'; $('#trend').innerHTML = L.slice(0, 12).map(c => `<button type="button" data-m="${esc(c.mint)}">${c.icon ? `<img src="${esc(c.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">` : ''}<div style="min-width:0"><b>$${esc(c.symbol)}</b><em class="${(c.ch1h || 0) >= 0 ? 'up' : 'down'}">${c.ch1h != null ? (c.ch1h >= 0 ? '+' : '') + Math.round(c.ch1h) + '%' : OB.usd(c.mcap)}</em></div></button>`).join('') || '<div class="empty">The boards are quiet.</div>';
      $('#trend').querySelectorAll('button').forEach(b => b.onclick = () => { $('#trend').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); pick(L.find(c => c.mint === b.dataset.m)); }); }).catch(() => { $('#trend').innerHTML = '<div class="empty">Jupiter didn’t answer. Search by name instead.</div>'; });
    let h2; $('#psQ').oninput = () => { clearTimeout(h2); h2 = setTimeout(() => { const v = $('#psQ').value.trim().toLowerCase(); if (!v) { $('#psRes').innerHTML = ''; return; }
      const L = CAT.sats.filter(s => s.name.toLowerCase().includes(v) || String(s.norad) === v).sort((a, b) => (b.tag === 'station') - (a.tag === 'station') || b.bright - a.bright || a.name.length - b.name.length).slice(0, 30);
      $('#psRes').innerHTML = L.map(satRow).join('') || '<div class="empty">No active satellite by that name.</div>'; bindSats($('#psRes')); }, 120); };
    const bindSats = box => box.querySelectorAll('a').forEach(a => a.onclick = () => { OB.$$('#psRes a, #psSug a').forEach(x => x.classList.toggle('on', x === a)); pickS(CAT.by.get(+a.dataset.n)); });
    const sug = () => { // satellites over the visitor right now, then the famous ones
      const up = []; if (HERE && POS) { const n = Math.min(CAT.sats.length, POS.length / 4); for (let i = 0; i < n; i++) { const o = i * 4; if (POS[o] !== POS[o]) continue; const s = CAT.sats[i]; if (s.tag === 'starlink' && !s.bright) continue; const l = lookFrom(HERE, POS[o], POS[o + 1], POS[o + 2]); if (l.el > 25) up.push([l.el, s]); } }
      up.sort((a, b) => b[0] - a[0]); const L = up.slice(0, 5).map(x => x[1]).concat([25544, 48274, 20580, 33591].map(n => CAT.by.get(n)).filter(Boolean)).filter((s, i, a) => a.indexOf(s) === i).slice(0, 8);
      $('#psSug').innerHTML = L.map(satRow).join(''); bindSats($('#psSug'));
    };
    setTimeout(sug, 2500); setInterval(() => { if (!PS) sug(); }, 30000);
    $('#pairBtn').onclick = async () => {
      if (!PC || !PS) return; const b = $('#pairBtn'); b.disabled = true; b.textContent = 'pairing…'; $('#pairOut').className = 'out'; $('#pairOut').textContent = '';
      try { const j = await OB.api('pair', { mint: PC.mint, norad: PS.norad }); $('#pairOut').innerHTML = `<b>$${esc(j.pair.symbol)} now rides ${esc(j.pair.sat)}.</b> <a class="acc" href="/sat?n=${j.pair.norad}">open its page →</a>`; linkFx = performance.now();
        await loadPairs(j.pair.mint); setTimeout(() => { focus(PS.i, true); stopTour(); $('#sky').scrollIntoView({ behavior: 'smooth' }); }, 1600); }
      catch (e) { $('#pairOut').className = 'out err'; $('#pairOut').textContent = e.message; }
      b.disabled = false; ready();
    };
    linkCanvas(); loadPairs(); setInterval(() => loadPairs(), 30000);
  }
  async function loadPairs(fresh) {
    try { const j = await OB.api('pair?op=list'); PAIRS = j.pairs || []; $('#pairCount').textContent = `${OB.num(j.total)} paired`; $('#pairMeta').textContent = `${OB.num(j.total)} coins paired · free · no wallet`;
      $('#pairs').innerHTML = PAIRS.length ? PAIRS.slice(0, 24).map(p => `<a href="/sat?n=${p.norad}" class="${p.mint === fresh ? 'new' : ''}">${p.icon ? `<img src="${esc(p.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">` : '<span class="gl">$</span>'}<div style="min-width:0"><b>$${esc(p.symbol)} → ${esc(p.sat)}</b><small>${OB.usd(p.mcap)}${p.ch1h != null ? ' · 1h ' + (p.ch1h >= 0 ? '+' : '') + Math.round(p.ch1h) + '%' : ''} · ${OB.ago(p.at)}</small></div><span class="dim" style="font-size:10.5px">${p.norad}</span></a>`).join('') : '<div class="empty">No coin paired yet. Be the first.</div>';
      // the coins ride their satellites on the globe: the biggest one per satellite gets the label
      const best = new Map(); for (const p of PAIRS) { const s = CAT.by.get(p.norad); if (!s) continue; const o = best.get(s.i); if (!o || (p.mcap || 0) > (o.mcap || 0)) best.set(s.i, p); }
      globe.tags = new Map([...best].sort((a, b) => (b[1].mcap || 0) - (a[1].mcap || 0)).slice(0, 30).map(([i, p]) => [i, '$' + p.symbol])); coinInsp();
    } catch (e) {}
  }
  // the link: a coin glyph and a satellite glyph, a dotted line pulsing between them; a burst when they pair
  let linkFx = 0;
  function linkCanvas() {
    const c = $('#link'), x = c.getContext('2d'); let W, H; const fit = () => { const d = Math.min(2, devicePixelRatio || 1); W = c.clientWidth; H = c.clientHeight; c.width = W * d; c.height = H * d; x.setTransform(d, 0, 0, d, 0, 0); }; fit(); addEventListener('resize', fit);
    let vis = true; new IntersectionObserver(e => { vis = e[0].isIntersecting; }).observe(c);
    const draw = t => { requestAnimationFrame(draw); if (!vis) return; x.clearRect(0, 0, W, H); const k = t / 1000, ax = 46, bx = W - 56, y = H / 2;
      x.font = '800 20px JBM, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = PC ? '#286ed6' : 'rgba(29,57,52,.3)'; x.fillText(PC ? '$' + PC.symbol.slice(0, 6) : '$???', ax, y);
      // the satellite circles a tiny planet
      const a = k * 1.4; x.font = '13px JBM, monospace'; x.fillStyle = 'rgba(29,57,52,.5)'; x.fillText('(@)', bx, y); x.font = '800 13px JBM, monospace'; x.fillStyle = PS ? '#1d3934' : 'rgba(29,57,52,.3)'; x.fillText('=[]=', bx + Math.cos(a) * 30, y + Math.sin(a) * 12);
      const both = PC && PS, n = 22;
      for (let i = 0; i < n; i++) { const f = i / (n - 1), px = ax + 38 + f * (bx - ax - 86), on = both && ((f - (k * .7) % 1 + 1) % 1) < .12; x.fillStyle = on ? '#286ed6' : both ? 'rgba(29,57,52,.45)' : 'rgba(29,57,52,.15)'; x.fillRect(px - (on ? 2 : 1), y - (on ? 2 : 1), on ? 4 : 2, on ? 4 : 2); }
      if (linkFx && t - linkFx < 1400) { const f = (t - linkFx) / 1400; x.strokeStyle = `rgba(40,110,214,${1 - f})`; x.lineWidth = 2; x.beginPath(); x.arc(bx, y, 10 + f * 70, 0, Math.PI * 2); x.stroke(); x.lineWidth = 1; }
      x.font = '11px JBM, monospace'; x.fillStyle = 'rgba(29,57,52,.5)'; x.fillText(both ? 'ready to pair' : 'pick a coin and a satellite', W / 2, H - 14);
    };
    requestAnimationFrame(draw);
  }

  // ---------- 05 coins ----------
  function coinsGrid() {
    const g = $('#coinGrid'), L = COINS.list.filter(c => c.state === 'live' || c.state === 'creating');
    $('#coinMeta').textContent = COINS.offline ? 'records offline' : `${L.length} in orbit`;
    if (!L.length) { g.innerHTML = `<div class="con" style="grid-column:1/-1"><div class="empty"><b>No coins in orbit yet.</b>Every satellite above is open. The first launch on each one takes it.<br><br><a class="btn" href="/launch">launch the first one ↗</a></div></div>`; return; }
    g.innerHTML = L.map(c => `<a class="coin rv in" href="/sat?n=${c.norad}"><div class="top"><img src="${esc(c.img)}" alt="" loading="lazy"><div><b>$${esc(c.symbol)}</b><div class="s">${esc(c.sat)} · ${c.norad}</div></div><span class="tag ${c.state === 'live' ? 'live' : ''}" style="margin-left:auto">${c.state}</span></div>
      <div class="rl">${c.rules.slice(0, 3).map(r => esc(r.line)).join('<br>')}</div><div class="s" style="margin-top:8px">mcap ${OB.usd(c.mcapUsd)} · fired ${c.fires} · claimed ${c.claimedSol ?? 0} SOL</div></a>`).join('');
  }

  // ---------- 06 falling ----------
  async function falling() {
    try {
      const j = await OB.api('sky?op=low'); const L = j.low || [];
      $('#fallMeta').textContent = `${L.length} lowest · perigee from the latest elements`;
      $('#fall').innerHTML = `<div class="r h"><span>norad</span><span>satellite</span><span>perigee</span><span>altitude now</span><span>how low</span></div>` + L.slice(0, 20).map(s => {
        const n = Math.max(1, Math.min(28, Math.round((420 - s.perigee) / 8)));
        return `<div class="r"><span class="dim">${s.norad}</span><a href="/sat?n=${s.norad}"><b>${esc(s.name)}</b></a><span>${s.perigee} km</span><span>${s.alt != null ? s.alt + ' km' : '—'}</span><span class="meter">${'#'.repeat(n)}${'.'.repeat(28 - n)}</span></div>`; }).join('');
    } catch (e) { $('#fall').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  // ---------- 07 engine ----------
  async function engine() {
    try { const s = await OB.api('coins?op=stats'); $('#bTick').textContent = s.lastTick ? OB.ago(s.lastTick) : 'not yet'; $('#bLive').textContent = s.live; $('#bFires').textContent = s.fires; $('#bClaim').textContent = (s.claimedSol || 0) + ' SOL'; $('#beatMeta').textContent = s.lastTick ? 'heartbeat ' + OB.ago(s.lastTick) : ''; }
    catch (e) { $('#bTick').textContent = 'offline'; }
    try { const c = await OB.api('launch?op=config'); $('#feeOn').textContent = c.feeTaken ? 'set: the 5% is taken' : 'not set: nothing is taken'; } catch (e) { $('#feeOn').textContent = 'unknown'; }
    fetch('/api/tick').catch(() => {});   // every visit nudges the engine
  }
  $('#selfBtn').onclick = async () => {
    const b = $('#selfBtn'); b.disabled = true; b.textContent = 'testing…'; $('#selfOut').style.display = 'block'; $('#selfCode').textContent = '> building a pump.fun create, a fee claim and a key check with throwaway keys…';
    try { const j = await OB.api('launch?op=selftest'); const L = ['> ' + j.note];
      for (const k of ['create', 'claim', 'keys']) { const s = j[k]; if (!s) continue; L.push(`${k.padEnd(7)} ${s.ok ? 'ok ' : 'ERR'} ${s.ms}ms  ${s.ok ? (s.bytes ? s.bytes + ' bytes · ' : '') + (s.sim ? 'simulated: ' + (s.sim.err ? JSON.stringify(s.sim.err).slice(0, 90) : 'no error') : JSON.stringify(s).slice(0, 90)) : s.error}`); }
      $('#selfCode').textContent = L.join('\n'); }
    catch (e) { $('#selfCode').textContent = 'self-test failed: ' + e.message; }
    b.disabled = false; b.textContent = 'run the engine self-test';
  };

  boot(); engine();
})();
