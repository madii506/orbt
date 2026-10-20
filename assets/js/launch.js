/* launch: pick a satellite, name its coin, wire the rulebook, one deposit. The engine does the rest, in public. */
(function () {
  const $ = OB.$, esc = OB.esc;
  let CAT = null, SAT = null, step = 0, IMG = null, OWN = false, style = 0, CFG = { createSol: .03, reserveSol: .015, minDev: .01, maxDev: 10 }, COINS = { taken: new Map() };
  // ---------- wallets ----------
  const prov = () => { const w = window; return [['phantom', w.phantom && w.phantom.solana], ['solflare', w.solflare && w.solflare.isSolflare ? w.solflare : null], ['backpack', w.backpack]].filter(p => p[1]); };
  let W = null;
  async function connect() {
    const ps = prov(); if (!ps.length) { OB.toast('No Solana wallet found in this browser. Paste your address instead.'); return null; }
    try { const p = ps[0][1]; const r = await p.connect(); const pk = (r && r.publicKey ? r.publicKey : p.publicKey).toString(); W = { p, pk }; $('#wbtn').textContent = OB.short(pk); if (!$('#fWal').value) $('#fWal').value = pk; return W; }
    catch (e) { OB.toast('The wallet didn’t connect.'); return null; }
  }
  $('#wbtn').onclick = connect;
  // ---------- steps ----------
  function go(i, force) {
    if (!force && i > step && !valid(step)) return;
    step = Math.max(0, Math.min(3, i));
    OB.$$('.pane').forEach(p => p.classList.toggle('on', +p.dataset.p === step));
    OB.$$('#steps button').forEach(b => { const k = +b.dataset.i; b.classList.toggle('on', k === step); b.classList.toggle('done', k < step); });
    $('#prev').hidden = step === 0; $('#next').hidden = step === 3;
    if (step === 1) art(); if (step === 2) book(); if (step === 3) { costs(); summary(); }
    scrollTo({ top: 0, behavior: 'smooth' });
  }
  function valid(i) {
    if (i === 0 && !SAT) { OB.toast('Pick a satellite first.'); return false; }
    if (i === 1) { if (!$('#fName').value.trim()) { OB.toast('Give the coin a name.'); return false; } if (!/^[A-Za-z0-9]{1,10}$/.test($('#fSym').value.trim().replace(/^\$/, ''))) { OB.toast('The ticker is 1–10 letters or numbers.'); return false; } }
    if (i === 2) { try { OR.normalizeBook(rules.map(r => r.get())); } catch (e) { OB.toast(e.message); return false; } }
    return true;
  }
  OB.$$('#steps button').forEach(b => b.onclick = () => go(+b.dataset.i));
  $('#prev').onclick = () => go(step - 1); $('#next').onclick = () => go(step + 1);

  // ---------- 1 the satellite ----------
  let ptag = null;
  function pick() {
    const q = $('#pq').value.trim().toLowerCase(); const rank = s => s.tag === 'station' ? 0 : s.bright ? 1 : s.tag === 'science' ? 2 : s.tag === 'weather' ? 3 : 4;
    const L = CAT.sats.filter(s => (!ptag || s.tag === ptag) && (!q || s.name.toLowerCase().includes(q) || String(s.norad) === q)).sort((a, b) => rank(a) - rank(b) || a.norad - b.norad).slice(0, 80);
    $('#pick').innerHTML = L.length ? L.map(s => { const t = COINS.taken.get(s.norad); const sh = ORB.shape(OB.rec(s));
      return `<a class="${SAT && SAT.norad === s.norad ? 'on' : ''} ${t ? 'taken' : ''}" data-n="${s.norad}"><span>${s.norad}</span><b>${esc(s.name)}</b><span>${OB.TAGS[s.tag][0]}</span><span>${t ? '$' + esc(t.symbol) : Math.round((sh.apogee + sh.perigee) / 2) + ' km'}</span></a>`; }).join('') : '<div class="empty">No active satellite matches.</div>';
    $('#pick').querySelectorAll('a').forEach(a => a.onclick = () => choose(+a.dataset.n));
  }
  function choose(n) {
    const s = CAT.by.get(n); if (!s) return; if (COINS.taken.has(n)) return OB.toast('That satellite already has a coin.');
    SAT = s; OWN = false; pick(); const r = OB.rec(s), now = new Date(), p = ORB.at(r, now), sh = ORB.shape(r);
    $('#chosen').style.display = 'block';
    $('#chosen').innerHTML = `<div class="ct">picked<span class="r">NORAD ${s.norad}</span></div><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center"><div><b style="font-size:20px">${esc(s.name)}</b><div class="dim" style="font-size:12px">${OB.TAGS[s.tag][0]} · ${p ? OB.num(p.alt) + ' km up over ' + OB.ll(p.lat, p.lon) : ''} · laps every ${sh.period.toFixed(1)} min · inclination ${sh.inc.toFixed(1)}°</div></div><button class="btn" type="button" id="toCoin">name its coin →</button></div>`;
    $('#toCoin').onclick = () => go(1);
    const nm = s.name.replace(/\s+/g, ' ').trim().slice(0, 32); $('#fName').value = nm;
    $('#fSym').value = (s.name.replace(/\(.*?\)/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'SAT' + s.norad).slice(0, 10);
    $('#fDesc').value = `${s.name}, NORAD ${s.norad}, ${p ? Math.round(p.alt) + ' km up, ' : ''}lapping the planet every ${sh.period.toFixed(0)} minutes.`;
    history.replaceState(null, '', '/launch?n=' + n);
  }
  let ph; $('#pq').oninput = () => { clearTimeout(ph); ph = setTimeout(pick, 120); };

  // ---------- 2 the picture: drawn from the satellite's real orbit ----------
  const STY = [{ bg: '#f6f3ec', ink: '#1d3934', acc: '#286ed6', dot: '#d0c8b9' }, { bg: '#0f1f1c', ink: '#e8f1ed', acc: '#7fb0ff', dot: '#22352f' }, { bg: '#286ed6', ink: '#f6f3ec', acc: '#0f1f1c', dot: '#3d7fe0' }];
  function art() {
    if (OWN || !SAT) return; const c = $('#art'), x = c.getContext('2d'), S = STY[style % STY.length], r = OB.rec(SAT), now = new Date(), p = ORB.at(r, now) || { lat: 0, lon: 0 }, sh = ORB.shape(r);
    x.fillStyle = S.bg; x.fillRect(0, 0, 512, 512); x.fillStyle = S.dot; for (let yy = 16; yy < 512; yy += 32) for (let xx = 16; xx < 512; xx += 32) x.fillRect(xx, yy, 2, 2);
    const X = 256, Y = 236, R = 118, D = Math.PI / 180, l0 = p.lat * D; x.font = '13px JBM, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let yy = -R; yy <= R; yy += 12) for (let xx = -R; xx <= R; xx += 7.8) {
      const a = xx / R, b = -yy / R, rr = a * a + b * b; if (rr > 1) continue; const z = Math.sqrt(1 - rr);
      const lat = Math.asin(z * Math.sin(l0) + b * Math.cos(l0)) / D, lon = p.lon + Math.atan2(a, z * Math.cos(l0) - b * Math.sin(l0)) / D;
      if (rr > .9) { x.fillStyle = S.ink; x.globalAlpha = .7; x.fillText('.', X + xx, Y + yy); continue; }
      if (LAND.at(lat, ((lon + 540) % 360) - 180)) { x.fillStyle = S.acc; x.globalAlpha = .95; x.fillText('#', X + xx, Y + yy); }
      else { x.fillStyle = S.ink; x.globalAlpha = .12; x.fillText('.', X + xx, Y + yy); }
    }
    x.globalAlpha = 1;
    // its orbit, tilted by its real inclination
    const tilt = Math.min(80, sh.inc > 90 ? 180 - sh.inc : sh.inc) * D * .9, rx = R * 1.62, ry = R * .42;
    for (let t = 0; t < 1; t += .004) { const a = t * Math.PI * 2, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry, qx = ex * Math.cos(-tilt) - ey * Math.sin(-tilt), qy = ex * Math.sin(-tilt) + ey * Math.cos(-tilt);
      if (Math.sin(a) < 0 && qx * qx + qy * qy < R * R) continue; x.fillStyle = Math.sin(a) >= 0 ? S.ink : S.acc; x.globalAlpha = Math.sin(a) >= 0 ? .85 : .5; x.fillRect(X + qx - 1.2, Y + qy - 1.2, 2.4, 2.4); }
    x.globalAlpha = 1; const a0 = .3 * Math.PI, ex = Math.cos(a0) * rx, ey = Math.sin(a0) * ry, sx = X + ex * Math.cos(-tilt) - ey * Math.sin(-tilt), sy = Y + ex * Math.sin(-tilt) + ey * Math.cos(-tilt);
    x.font = '800 22px JBM, monospace'; x.fillStyle = S.ink; x.fillText('=[]=', sx, sy);
    const sym = ($('#fSym').value || 'ORBT').toUpperCase().replace(/^\$/, '');
    x.font = `800 ${sym.length > 7 ? 40 : 52}px JBM, monospace`; x.fillStyle = S.ink; x.fillText('$' + sym, 256, 432);
    x.font = '13px JBM, monospace'; x.globalAlpha = .7; x.fillText(`NORAD ${SAT.norad} · ${SAT.name}`.slice(0, 44), 256, 470); x.globalAlpha = 1;
    x.textAlign = 'left'; x.font = '800 15px JBM, monospace'; x.fillStyle = S.ink; x.fillText('orbt', 22, 30); x.fillStyle = S.acc; x.fillText('_', 22 + x.measureText('orbt').width, 30);
    IMG = c.toDataURL('image/png');
  }
  $('#artNext').onclick = () => { OWN = false; style++; art(); };
  $('#fSym').oninput = () => art();
  $('#fImg').onchange = e => {
    const f = e.target.files[0]; if (!f) return; if (f.size > 8 * 1024 * 1024) return OB.toast('That picture is over 8 MB');
    const im = new Image(); im.onload = () => { const c = $('#art'), x = c.getContext('2d'), s = Math.max(512 / im.width, 512 / im.height), w = im.width * s, h = im.height * s; x.fillStyle = '#f6f3ec'; x.fillRect(0, 0, 512, 512); x.drawImage(im, (512 - w) / 2, (512 - h) / 2, w, h); IMG = c.toDataURL('image/jpeg', .9); OWN = true; };
    im.onerror = () => OB.toast('That picture couldn’t be read'); im.src = URL.createObjectURL(f);
  };

  // ---------- 3 the rulebook ----------
  let rules = [];
  const SRCS = Object.entries(OR.SRC), ACTS = Object.entries(OR.ACTS);
  function rowFor(init) {
    const el = document.createElement('div'); el.className = 'ruleRow';
    el.innerHTML = `<select data-k="src">${SRCS.map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select><select data-k="op"></select><span data-k="arg"></span>
      <input data-k="pct" type="number" min="1" max="100" value="10" title="% of the chest"><input data-k="cool" type="number" min="0" max="168" value="1" title="cooldown, hours"><button class="x" type="button" title="remove">×</button><div class="w"></div>`;
    const src = el.querySelector('[data-k=src]'), op = el.querySelector('[data-k=op]'), arg = el.querySelector('[data-k=arg]');
    const actSel = document.createElement('select'); actSel.dataset.k = 'act'; actSel.innerHTML = ACTS.map(([k, v]) => `<option value="${k}">${v.label}</option>`).join(''); arg.after(actSel);
    const fill = () => {
      const s = src.value; op.innerHTML = Object.entries(OR.SRC[s].ops).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
      if (init && init.src === s && init.op) op.value = init.op;
      argFor();
    };
    const argFor = () => {
      const s = src.value; const v = init && init.src === s ? init : {};
      arg.innerHTML = s === 'orbit' ? `<input data-a="every" type="number" min="1" max="500" value="${v.every || 1}" title="every N orbits">`
        : s === 'pass' ? `<input data-a="city" placeholder="city" value="${esc((v.city && v.city.name) || '')}" data-lat="${v.city ? v.city.lat : ''}" data-lon="${v.city ? v.city.lon : ''}" data-country="${esc((v.city && v.city.country) || '')}"><input data-a="el" type="number" min="10" max="80" value="${v.el || 20}" title="min height in the sky (°)" style="margin-top:4px">`
        : s === 'alt' ? `<input data-a="value" type="number" min="100" max="50000" value="${v.value || 300}" title="km">`
        : s === 'coin' && op.value === 'mcap' ? `<input data-a="value" type="number" min="1000" value="${v.value || 100000}" title="USD">`
        : s === 'time' ? `<input data-a="every" type="number" min="1" max="168" value="${v.every || 6}" title="hours">` : '<span class="dim">—</span>';
      const ci = arg.querySelector('[data-a=city]'); if (ci) { let h; ci.oninput = () => { clearTimeout(h); ci.dataset.lat = ''; h = setTimeout(async () => { try { const j = await (await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=' + encodeURIComponent(ci.value))).json(); const r = (j.results || [])[0]; if (r) { ci.dataset.lat = r.latitude; ci.dataset.lon = r.longitude; ci.dataset.country = r.country || ''; ci.title = r.name + ', ' + (r.country || ''); } } catch (e) {} upd(); }, 350); }; }
      arg.querySelectorAll('input').forEach(i => i.addEventListener('input', upd)); upd();
    };
    const get = () => {
      const r = { src: src.value, op: op.value, act: actSel.value, pct: +el.querySelector('[data-k=pct]').value, cool: +el.querySelector('[data-k=cool]').value };
      arg.querySelectorAll('[data-a]').forEach(i => { const k = i.dataset.a; if (k === 'city') r.city = { name: i.value.trim(), country: i.dataset.country || '', lat: +i.dataset.lat, lon: +i.dataset.lon }; else r[k] = +i.value; });
      if (r.city && !isFinite(r.city.lat)) r.city.lat = null; return r;
    };
    const upd = () => { let t; try { t = OR.words(OR.normalize(get())); } catch (e) { t = e.message; } el.querySelector('.w').textContent = t; book(); };
    src.onchange = () => { init = null; fill(); }; op.onchange = () => { argFor(); }; actSel.onchange = upd; el.querySelectorAll('[data-k=pct],[data-k=cool]').forEach(i => i.oninput = upd);
    el.querySelector('.x').onclick = () => { rules = rules.filter(r => r.el !== el); el.remove(); book(); };
    if (init) { src.value = init.src; actSel.value = init.act; el.querySelector('[data-k=pct]').value = init.pct; el.querySelector('[data-k=cool]').value = init.cool; }
    fill(); return { el, get };
  }
  function addRule(init) { if (rules.length >= OR.MAX_RULES) return OB.toast('Six rules at most.'); const r = rowFor(init); rules.push(r); $('#rules').appendChild(r.el); book(); }
  $('#addRule').onclick = () => addRule({ src: 'orbit', op: 'every', every: 1, act: 'burn', pct: 5, cool: 1 });
  $('#tpls').innerHTML = OR.TEMPLATES.map((t, i) => `<button type="button" data-i="${i}"><b>${esc(t.name)}</b><span>${esc(t.blurb)}</span></button>`).join('');
  $('#tpls').querySelectorAll('button').forEach(b => b.onclick = () => { $('#rules').innerHTML = ''; rules = []; OR.TEMPLATES[+b.dataset.i].rules.forEach(r => addRule(JSON.parse(JSON.stringify(r)))); });
  function book() {
    const out = $('#bookOut'); if (!out) return; let txt;
    try { const L = OR.normalizeBook(rules.map(r => r.get())); txt = OR.book(L, { name: $('#fName').value, symbol: $('#fSym').value.toUpperCase(), norad: SAT && SAT.norad });
      if (SAT) { const r = OB.rec(SAT), now = new Date(); txt += `\n\n# live on ${SAT.name}: next lap in ${OB.dur(ORB.nextOrbit(r, now) - now)}`; const ns = ORB.nextCrossing(r, now, true); if (ns) txt += `, next sunrise in ${OB.dur(ns - now)}`; }
    } catch (e) { txt = '# ' + e.message; }
    out.textContent = txt;
  }

  // ---------- 4 launch ----------
  const needSol = dev => Math.ceil((CFG.createSol + dev * 1.02 + CFG.reserveSol) * 1000) / 1000;
  function costs() {
    const dev = +$('#fDev').value; $('#devV').textContent = dev.toFixed(2);
    $('#costs').innerHTML = `<div><span>first buy (+2% for fees and slippage)</span><b>${(dev * 1.02).toFixed(4)} SOL</b></div><div><span>pump.fun rent and fees (unused part comes back)</span><b>${CFG.createSol.toFixed(3)} SOL</b></div><div><span>gas reserve kept in the coin’s wallet</span><b>${CFG.reserveSol.toFixed(3)} SOL</b></div><div><span><b>one deposit</b></span><b>${needSol(dev).toFixed(3)} SOL</b></div>`;
  }
  $('#fDev').oninput = costs;
  function summary() {
    let L = []; try { L = OR.normalizeBook(rules.map(r => r.get())); } catch (e) {}
    $('#sum').innerHTML = [['satellite', SAT ? `${esc(SAT.name)} · ${SAT.norad}` : '—'], ['coin', `${esc($('#fName').value)} · $${esc($('#fSym').value.toUpperCase())}`], ['picture', IMG ? 'ready' : 'missing'], ['rules', L.length + ''], ...L.map((r, i) => ['  ' + (i + 1), esc(OR.cond(r)) + ' → ' + esc(OR.ACTS[r.act].label) + ' ' + r.pct + '%'])].map(([a, b]) => `<div><span>${a}</span><b style="text-align:right">${b}</b></div>`).join('')
      + `<div style="border:0;margin-top:14px"><button class="btn" id="goBtn" type="button">launch $${esc($('#fSym').value.toUpperCase() || '…')} →</button></div>`;
    $('#goBtn').onclick = launch;
  }
  const err = m => { const e = $('#err'); e.textContent = m; e.hidden = !m; };
  let LN = null, poll = null;
  async function launch() {
    err(''); const launcher = $('#fWal').value.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(launcher)) return err('Connect a wallet or paste your Solana address.');
    if (!$('#fOk').checked) return err('Tick the box to confirm you understand how the engine works.');
    if (!IMG) art(); let L; try { L = OR.normalizeBook(rules.map(r => r.get())); } catch (e) { return err(e.message); }
    const b = $('#goBtn'); b.disabled = true; b.textContent = 'recording…';
    try {
      const r = await OB.api('launch?op=prepare', { norad: SAT.norad, launcher, name: $('#fName').value.trim(), symbol: $('#fSym').value.trim(), description: $('#fDesc').value.trim(), twitter: $('#fX').value.trim(), website: $('#fWeb').value.trim(), image: IMG, devBuy: +$('#fDev').value, rules: L });
      track({ ...r, symbol: $('#fSym').value.trim().toUpperCase() }); OB.toast('Rulebook ' + r.fp + ' recorded');
    } catch (e) { err(e.message); b.disabled = false; b.textContent = 'launch →'; }
  }
  function track(d) {
    LN = d; try { localStorage.setItem('orbt_launch', JSON.stringify(d)); } catch (e) {}
    $('#flow').innerHTML = `<div class="con"><div class="ct">deposit<span class="r">launch ${esc(d.id)}</span></div>send exactly <b>${d.needSol} SOL</b> to the coin’s own wallet:<span class="addr">${esc(d.wallet)}</span>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="sendDep" type="button">send it with my wallet →</button><button class="btn o s" type="button" id="cpW">copy address</button></div>
      <div class="out" id="depMsg">This page checks every few seconds; the engine checks too, so you can close it once the transfer is sent. A launch not funded within 45 minutes is cancelled and anything sent comes back.</div>
      <div class="dim" style="font-size:11.5px;margin-top:6px">the coin’s address will be ${esc(d.mint)}</div></div>`;
    $('#cpW').onclick = () => navigator.clipboard && navigator.clipboard.writeText(d.wallet).then(() => OB.toast('Address copied'));
    $('#sendDep').onclick = deposit; clearInterval(poll); poll = setInterval(check, 3500); check();
  }
  async function deposit() {
    const w = W || await connect(); if (!w || !LN) return;
    try {
      if (!window.solanaWeb3) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/assets/js/web3.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
      const { Transaction, SystemProgram, PublicKey } = window.solanaWeb3; const bh = await OB.api('launch?op=blockhash'); const from = new PublicKey(w.pk);
      const tx = new Transaction({ feePayer: from, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }).add(SystemProgram.transfer({ fromPubkey: from, toPubkey: new PublicKey(LN.wallet), lamports: LN.need }));
      $('#depMsg').textContent = 'approve the transfer in your wallet…'; let sig;
      if (w.p.signAndSendTransaction) { const r = await w.p.signAndSendTransaction(tx); sig = r && (r.signature || r); }
      else { const s = await w.p.signTransaction(tx); const r = await OB.api('launch?op=relay', { tx: btoa(String.fromCharCode(...s.serialize())) }); sig = r.sig; }
      $('#depMsg').innerHTML = `sent: <a class="acc" href="https://solscan.io/tx/${esc(String(sig))}" target="_blank" rel="noopener">${esc(OB.short(String(sig)))}</a>. waiting for it to land…`;
    } catch (e) { $('#depMsg').innerHTML = `<span class="down">${esc((e && e.message) || 'The transfer was cancelled.')}</span> You can also send it from any wallet.`; }
  }
  async function check() {
    if (!LN) return; let d; try { d = await OB.api('launch?op=status&id=' + encodeURIComponent(LN.id)); } catch (e) { return; }
    const m = $('#depMsg');
    if (d.state === 'waiting' && d.balance > 0 && m) m.textContent = `${(d.balance / 1e9).toFixed(4)} of ${d.needSol} SOL arrived.`;
    if (d.state === 'creating') $('#flow').innerHTML = '<div class="con"><div class="empty"><b>Deposit in.</b>Creating the coin on pump.fun…</div></div>';
    if (d.state === 'live') { clearInterval(poll); try { localStorage.removeItem('orbt_launch'); } catch (e) {}
      $('#flow').innerHTML = `<div class="con"><div class="empty" style="text-align:left"><b>$${esc(d.symbol)} is in orbit.</b>Its rules are watching ${esc(d.sat || 'its satellite')}.<br><br><a class="btn" href="/sat?n=${d.norad}">open its page →</a> <a class="btn o" href="https://pump.fun/coin/${esc(d.mint)}" target="_blank" rel="noopener">pump.fun ↗</a></div></div>`; }
    if (['failed', 'expired', 'refunded'].includes(d.state)) { clearInterval(poll); try { localStorage.removeItem('orbt_launch'); } catch (e) {}
      $('#flow').innerHTML = `<div class="con"><div class="empty" style="text-align:left"><b>The launch ${d.state === 'expired' ? 'expired' : 'didn’t go through'}.</b>${esc((d.err || '').slice(0, 160))} ${d.refund_sig ? `Your deposit was returned: <a class="acc" href="https://solscan.io/tx/${esc(d.refund_sig)}" target="_blank" rel="noopener">refund tx</a>.` : 'Anything you sent is returned automatically.'}</div></div>`; }
  }

  // ---------- boot ----------
  (async () => {
    try { CFG = { ...CFG, ...(await OB.api('launch?op=config')) }; } catch (e) {}
    try { CAT = await OB.catalog(); } catch (e) { $('#pick').innerHTML = `<div class="empty"><b>The catalogue didn’t answer.</b>${esc(e.message)}</div>`; return; }
    COINS = await OB.coins();
    const by = {}; CAT.sats.forEach(s => by[s.tag] = (by[s.tag] || 0) + 1);
    $('#ptags').innerHTML = Object.entries(OB.TAGS).filter(([k]) => by[k]).map(([k, [nm]]) => `<button class="chip" data-t="${k}" type="button">${nm}</button>`).join('');
    $('#ptags').querySelectorAll('.chip').forEach(b => b.onclick = () => { const on = !b.classList.contains('on'); $('#ptags').querySelectorAll('.chip').forEach(x => x.classList.remove('on')); if (on) b.classList.add('on'); ptag = on ? b.dataset.t : null; pick(); });
    pick(); addRule({ src: 'orbit', op: 'every', every: 1, act: 'burn', pct: 5, cool: 1 });
    const n = +new URLSearchParams(location.search).get('n'); if (n) choose(n);
    try { const s = JSON.parse(localStorage.getItem('orbt_launch') || 'null'); if (s && s.id) { go(3, true); track(s); OB.toast('Picking up your launch where it left off'); } } catch (e) {}
    costs();
  })();
})();
