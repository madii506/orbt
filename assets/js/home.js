/* orbt home: the live sky, your sky, the catalogue, a rulebook running on the ISS, the coins, the falling, the engine */
(function () {
  const $ = OB.$, esc = OB.esc;
  let CAT = null, POS = null, globe = null, focusI = null, COINS = { list: [], taken: new Map() };
  const mob = innerWidth < 900;

  // ---------- 01 the sky ----------
  const tip = $('#tip');
  let idle = performance.now();
  globe = new SKY.Globe($('#globe'), { cx: mob ? .5 : .63, cy: mob ? .5 : .53, r: mob ? .38 : .315, lon: -40, lat: 22, spin: 2.4, font: 12, lens: true, parallax: !mob, shellLabels: false,
    onGround: (gp, px, py) => probe(gp, px, py),
    onPick: i => { focus(i, true); stopTour(); },
    onHover: i => { if (i != null) idle = performance.now(); } });
  window.__globe = globe;
  $('#globe').addEventListener('pointerdown', () => { idle = performance.now(); });
  $('#zIn').onclick = () => globe.setZoom((globe.zt || globe.zoom) * 1.25); $('#zOut').onclick = () => globe.setZoom((globe.zt || globe.zoom) / 1.25);
  // the tour: when nobody is touching the globe, it flies from one notable satellite to the next
  const TOUR = [25544, 48274, 20580, 33591, 49260, 43013, 41866, 39084, 27424, 40697, 25994, 28654];
  let tourOn = !mob, tourK = 0, tourT = 0;
  const stopTour = () => { tourOn = false; $('#zTour').classList.remove('on'); };
  $('#zTour').onclick = () => { tourOn = !tourOn; $('#zTour').classList.toggle('on', tourOn); tourT = 0; };
  setInterval(() => { if (!tourOn || !CAT || document.hidden) return; const now = performance.now(); if (now - idle < 9000 || now - tourT < 8500) return;
    const list = TOUR.filter(n => CAT.by.has(n)); if (!list.length) return; const s = CAT.by.get(list[tourK++ % list.length]); tourT = now; focus(s.i, true, true); }, 1000);
  const tagsEl = $('#tags'); let filter = null;
  function chips(by) {
    tagsEl.innerHTML = Object.entries(OB.TAGS).filter(([k]) => by[k]).map(([k, [nm, col]]) => `<button class="chip" data-t="${k}" type="button" title="${OB.num(by[k])}"><i style="background:${col}"></i>${nm}</button>`).join('');
    tagsEl.querySelectorAll('.chip').forEach(b => b.onclick = () => {
      b.classList.toggle('on'); const on = [...tagsEl.querySelectorAll('.chip.on')].map(x => x.dataset.t); filter = on.length ? new Set(on) : null; globe.filter = filter;
    });
  }
  // search
  const q = $('#q'), res = $('#res');
  if (q) q.oninput = () => {
    const v = q.value.trim().toLowerCase(); if (!v || !CAT) { res.classList.remove('on'); return; }
    const hits = CAT.sats.filter(s => s.name.toLowerCase().includes(v) || String(s.norad) === v).sort((a, b) => (b.tag === 'station') - (a.tag === 'station') || b.bright - a.bright || a.name.length - b.name.length).slice(0, 12);
    res.innerHTML = hits.length ? hits.map(s => `<a href="#" data-i="${s.i}">${esc(s.name)}<span>${s.norad}</span></a>`).join('') : '<div class="empty">No active satellite by that name.</div>';
    res.classList.add('on'); res.querySelectorAll('a').forEach(a => a.onclick = e => { e.preventDefault(); res.classList.remove('on'); q.value = ''; focus(+a.dataset.i, true); });
  };
  // the focus card, updated every second from the real orbit
  const card = $('#card');
  function focus(i, fly, auto) {
    focusI = i; globe.focus = i; const s = CAT.sats[i]; if (!s) return; if (!auto) idle = performance.now();
    const qk = $('#quick'); if (qk) qk.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.n === s.norad));
    const p = ORB.at(OB.rec(s), new Date()); if (fly && p) globe.lookAt(p.lat, p.lon);
    globe.focusLock = true; clearTimeout(focus._t); focus._t = setTimeout(() => { globe.focusLock = false; }, 9000);
    if (!auto) { card.classList.add('on'); drawCard(); } else if (!card.classList.contains('on')) card.innerHTML = '';
  }
  function drawCard() {
    if (focusI == null || !CAT || !card.classList.contains('on') && card.innerHTML === '') return; const s = CAT.sats[focusI], r = OB.rec(s), now = new Date(), p = ORB.at(r, now); if (!p) return;
    const sh = ORB.shape(r), lit = ORB.lit(p.eci, now), nx = ORB.nextOrbit(r, now), coin = COINS.taken.get(s.norad);
    const ageH = (Date.now() - r.epochMs) / 36e5;
    card.innerHTML = `<h3>${esc(s.name)}</h3><div class="sub">NORAD ${s.norad} · ${OB.TAGS[s.tag][0]} · elements ${ageH < 48 ? ageH.toFixed(1) + ' h' : Math.round(ageH / 24) + ' d'} old</div>
      <dl class="kv"><dt>position</dt><dd>${OB.ll(p.lat, p.lon)}</dd><dt>altitude</dt><dd>${OB.num(p.alt)} km</dd><dt>speed</dt><dd>${p.speed.toFixed(2)} km/s</dd>
      <dt>sun</dt><dd>${lit ? '<span class="acc">in sunlight</span>' : 'in Earth’s shadow'}</dd><dt>orbit</dt><dd>#${OB.num(ORB.orbitNo(r, now))} · ${sh.period.toFixed(1)} min</dd><dt>next lap in</dt><dd>${OB.dur(nx - now)}</dd>
      <dt>coin</dt><dd>${coin ? `<span class="tag live">$${esc(coin.symbol)} ${coin.state === 'live' ? 'live' : coin.state}</span>` : '<span class="acc">open</span>'}</dd></dl>
      <div class="acts"><a class="btn s" href="/sat?n=${s.norad}">open its page</a>${coin ? '' : `<a class="btn s o" href="/launch?n=${s.norad}">launch its coin ↗</a>`}<button class="btn s o" type="button" id="unf">×</button></div>`;
    $('#unf').onclick = () => { focusI = null; globe.focus = null; card.classList.remove('on'); };
  }
  setInterval(drawCard, 1000);

  // click the planet anywhere: what is above that spot right now
  function probe(gp, px, py) {
    const pb = $('#probe'); if (!gp || !POS || !CAT) { globe.probe = null; pb.classList.remove('on'); return; }
    stopTour(); const here = { lat: gp.lat, lon: gp.lon }, up = [], n = Math.min(CAT.sats.length, POS.length / 4);
    for (let i = 0; i < n; i++) { const o = i * 4; if (POS[o] !== POS[o]) continue; const l = lookFrom(here, POS[o], POS[o + 1], POS[o + 2]); if (l.el > 30) up.push([l.el, i]); }
    up.sort((a, b) => b[0] - a[0]); globe.probe = { lat: gp.lat, lon: gp.lon, list: up.slice(0, 60).map(u => u[1]) };
    const named = up.filter(([, i]) => CAT.sats[i].tag !== 'starlink').slice(0, 5).concat(up.filter(([, i]) => CAT.sats[i].tag === 'starlink').slice(0, 1));
    pb.innerHTML = `<button class="x" type="button">×</button><b>${OB.ll(gp.lat, gp.lon)}</b><small>${OB.num(up.length)} satellites more than 30° up from here, right now</small>` + named.map(([el, i]) => `<a data-i="${i}"><span style="color:var(--ink)">${esc(CAT.sats[i].name)}</span><span>${Math.round(el)}°</span></a>`).join('');
    const sky = $('#sky'), W = sky.clientWidth, H = sky.clientHeight; pb.style.left = Math.min(W - 290, px + 18) + 'px'; pb.style.top = Math.min(H - 260, Math.max(10, py - 20)) + 'px'; pb.classList.add('on');
    pb.querySelector('.x').onclick = () => { globe.probe = null; pb.classList.remove('on'); };
    pb.querySelectorAll('a').forEach(a => a.onclick = () => { focus(+a.dataset.i, true); pb.classList.remove('on'); globe.probe = null; });
  }
  addEventListener('keydown', e => { if (e.key === 'Escape') { globe.probe = null; $('#probe').classList.remove('on'); } });

  // ---------- data ----------
  async function boot() {
    try { CAT = await OB.catalog(); } catch (e) { $('#hcount').textContent = 'catalogue offline'; $('#ctab').innerHTML = `<div class="empty"><b>The catalogue didn’t answer.</b>${esc(e.message)}. It retries on the next visit.</div>`; return; }
    $('#hcount').textContent = OB.num(CAT.count);
    const by = {}; CAT.sats.forEach(s => by[s.tag] = (by[s.tag] || 0) + 1); chips(by);
    globe.setSats(CAT.sats); await SKY.start(CAT.sats);
    SKY.on(buf => { POS = buf; globe.setPos(buf); });
    $('#catMeta').textContent = `${OB.num(CAT.count)} active · elements ${OB.ago(CAT.at)}`;
    COINS = await OB.coins(); drawCard();
    tape(by); catalogue(); rulesDemo(); coinsGrid(); falling(); overheadInit();
    const iss = CAT.by.get(25544); if (iss && !mob) setTimeout(() => { if (focusI == null) focus(iss.i, false, true); }, 2600);
    quick(); types(by); pairing();
  }
  function quick() {
    if (!$('#quick')) return;
    const Q = [[25544, 'ISS'], [48274, 'Tiangong'], [20580, 'Hubble'], [33591, 'NOAA 19'], [49260, 'Landsat 9'], [41866, 'GOES-16']].filter(([n]) => CAT.by.has(n));
    $('#quick').innerHTML = Q.map(([n, t]) => `<button type="button" data-n="${n}">${t}</button>`).join('');
    $('#quick').querySelectorAll('button').forEach(b => b.onclick = () => { stopTour(); focus(CAT.by.get(+b.dataset.n).i, true); });
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
    box.querySelectorAll('.ty').forEach(r => r.onclick = () => { const t = r.dataset.t; tagsEl.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.t === t)); filter = new Set([t]); globe.filter = filter; stopTour(); $('#sky').scrollIntoView({ behavior: 'smooth' }); });
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
    if (!HERE || !POS || !CAT) return; const up = [], P = POS, n = Math.min(CAT.sats.length, P.length / 4); const se = sunEl(HERE), dark = se < -6;
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
      globe.tags = new Map([...best].sort((a, b) => (b[1].mcap || 0) - (a[1].mcap || 0)).slice(0, 30).map(([i, p]) => [i, '$' + p.symbol]));
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
  addEventListener('orbt:enter', () => { const h = $('.sky .tl h1'); if (h) OB.decode(h, 1100); });
})();
