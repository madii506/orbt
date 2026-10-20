/* one satellite: where it is, its orbit, its passes over you, its ground track, and its coin with live rule readings */
(function () {
  const $ = OB.$, esc = OB.esc, n = Number(new URLSearchParams(location.search).get('n'));
  const fail = (t, m) => { $('#page').innerHTML = `<div style="padding:120px 0"><div class="con"><div class="empty"><b>${esc(t)}</b>${m}</div></div></div>`; };
  if (!(n > 0)) return fail('No satellite in this link.', '<a class="acc" href="/#catalogue">Pick one from the catalogue</a>.');
  let S = null, R = null, globe = null, HERE = null;
  try { HERE = JSON.parse(localStorage.getItem('orbt_here') || 'null'); } catch (e) {}
  if (!HERE) HERE = { lat: 51.51, lon: -0.13, name: 'London' };
  (async () => {
    let cat; try { cat = await OB.catalog(); } catch (e) { return fail('The catalogue didn’t answer.', esc(e.message)); }
    S = cat.by.get(n);
    if (!S) { // not in the active list: maybe it came down
      let sc = null; try { sc = (await OB.api('sky?op=sat&n=' + n)).satcat; } catch (e) {}
      return fail(`NORAD ${n} isn’t in the active catalogue.`, sc && sc.decay ? `It re-entered on ${esc(sc.decay)}.` : 'It may have re-entered, or it may never have been an active satellite. <a class="acc" href="/#catalogue">Back to the catalogue</a>.');
    }
    R = OB.rec(S); document.title = 'orbt';
    $('#sn').textContent = S.name; OB.decode($('#sn'), 900);
    const ageH = (Date.now() - R.epochMs) / 36e5;
    $('#sk').textContent = `NORAD ${S.norad} · ${OB.TAGS[S.tag][0]} · elements ${ageH < 48 ? ageH.toFixed(1) + ' h' : Math.round(ageH / 24) + ' d'} old`;
    $('#hereName').textContent = HERE.name;
    globe = new SKY.Globe($('#sglobe'), { cx: .5, cy: .5, r: .38, spin: 0, font: 11, labels: false });
    globe.setSats([S]); globe.focus = 0;
    const p0 = ORB.at(R, new Date()); if (p0) { globe.lon0 = p0.lon; globe.lat0 = Math.max(-50, Math.min(50, p0.lat)); }
    const tickPos = () => { const p = ORB.at(R, new Date()); if (!p) return; const b = new Float32Array([p.lat, p.lon, p.alt, ORB.lit(p.eci, new Date()) ? 1 : 0]); globe.setPos(b); globe.lon0 += ((p.lon - globe.lon0 + 540) % 360 - 180) * .02; };
    tickPos(); setInterval(tickPos, 1000);
    facts(); live(); setInterval(live, 1000); track(); setInterval(track, 15000); passes();
    let coin = null; try { coin = (await OB.api('coins?n=' + n)).coin; } catch (e) {}
    chips(coin); coinBox(coin); pairs();
    let sc = null; try { sc = (await OB.api('sky?op=sat&n=' + n)).satcat; } catch (e) {}
    if (sc) facts(sc);
  })();
  function chips(coin) {
    $('#schips').innerHTML = [`<span class="tag">${OB.TAGS[S.tag][0]}</span>`, S.bright ? '<span class="tag">bright · naked eye</span>' : '', coin ? `<span class="tag live">$${esc(coin.symbol)} ${esc(coin.state)}</span>` : '<span class="tag" style="border-color:var(--acc);color:var(--acc)">open: no coin yet</span>'].join(' ');
    $('#sacts').innerHTML = coin ? `<a class="btn s" href="https://pump.fun/coin/${coin.mint}" target="_blank" rel="noopener">pump.fun ↗</a><a class="btn s o" href="https://dexscreener.com/solana/${coin.mint}" target="_blank" rel="noopener">chart ↗</a><button class="btn s o" id="cpy" type="button">copy CA</button>`
      : `<a class="btn s" href="/launch?n=${S.norad}">launch a coin on ${esc(S.name)} ↗</a>`;
    const c = $('#cpy'); if (c) c.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(coin.mint).then(() => OB.toast('Contract address copied')); };
  }
  function live() {
    const now = new Date(), p = ORB.at(R, now); if (!p) return;
    $('#vAlt').textContent = OB.num(p.alt) + ' km'; $('#vSpd').textContent = p.speed.toFixed(2) + ' km/s'; $('#vPos').textContent = OB.ll(p.lat, p.lon);
    const lit = ORB.lit(p.eci, now); $('#vSun').innerHTML = lit ? '<span class="acc">sunlight</span>' : 'shadow';
    $('#vOrb').textContent = '#' + OB.num(ORB.orbitNo(R, now)); $('#vLap').textContent = OB.dur(ORB.nextOrbit(R, now) - now);
  }
  function facts(sc) {
    const sh = ORB.shape(R);
    const rows = [['inclination', sh.inc.toFixed(2) + '°'], ['period', sh.period.toFixed(2) + ' min'], ['laps a day', (1440 / sh.period).toFixed(2)], ['apogee', OB.num(sh.apogee) + ' km'], ['perigee', OB.num(sh.perigee) + ' km'], ['eccentricity', R.ecco.toFixed(5)]];
    if (sc) { if (sc.id) rows.push(['international id', esc(sc.id)]); if (sc.launch) rows.push(['launched', esc(sc.launch)]); if (sc.owner) rows.push(['owner code', esc(sc.owner)]); if (sc.type) rows.push(['object type', esc({ PAY: 'payload', 'R/B': 'rocket body', DEB: 'debris' }[sc.type] || sc.type)]); }
    $('#facts').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('#epoch').textContent = 'epoch ' + new Date(R.epochMs).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  }
  function passes() {
    setTimeout(() => {
      const ps = ORB.passes(R, HERE, new Date(), 48, 10, 8);
      const cmp = a => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(a / 45) % 8];
      $('#spass').innerHTML = ps.length ? `<div class="r h" style="grid-template-columns:minmax(0,1.4fr) 70px 70px 70px"><span>rises</span><span>from</span><span>highest</span><span>lasts</span></div>` + ps.map(p => `<div class="r" style="grid-template-columns:minmax(0,1.4fr) 70px 70px 70px;cursor:default"><b>${p.rise.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</b><span>${cmp(p.riseAz)}</span><span>${Math.round(p.maxEl)}°</span><span>${p.set ? Math.round((p.set - p.rise) / 6e4) + ' min' : '—'}</span></div>`).join('')
        : `<div class="empty">No pass over ${esc(HERE.name)} in the next 48 hours${ORB.shape(R).period > 600 ? ' (it sits far out, so it barely moves in the sky)' : ''}.</div>`;
    }, 50);
  }
  // the ground track: an ASCII world map with today's day and night, the track one orbit behind and one ahead
  function track() {
    const c = $('#gtrack'), x = c.getContext('2d'), d = Math.min(2, devicePixelRatio || 1), W = c.clientWidth, H = Math.round(W * .45);
    c.style.height = H + 'px'; c.width = W * d; c.height = H * d; x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, W, H);
    const fs = W < 700 ? 8 : 10.5; x.font = `${fs}px JBM, monospace`; const cw = x.measureText('M').width, lh = fs * 1.05; const cols = Math.floor(W / cw), rows = Math.floor(H / lh);
    const ss = ORB.subsolar(new Date()), D = Math.PI / 180; x.textAlign = 'center'; x.textBaseline = 'middle';
    const LAT0 = 80, LAT1 = -70, toXY = (lat, lon) => [(lon + 180) / 360 * W, (LAT0 - lat) / (LAT0 - LAT1) * H];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const lat = LAT0 - (j + .5) / rows * (LAT0 - LAT1), lon = -180 + (i + .5) / cols * 360;
      const day = Math.sin(lat * D) * Math.sin(ss.lat * D) + Math.cos(lat * D) * Math.cos(ss.lat * D) * Math.cos((lon - ss.lon) * D);
      const land = LAND.at(lat, lon);
      if (land) { x.fillStyle = day > 0 ? 'rgba(29,57,52,.6)' : 'rgba(40,110,214,.45)'; x.fillText(day > 0 ? '#' : ':', (i + .5) * cw, (j + .5) * lh); }
      else if (day < 0) { x.fillStyle = 'rgba(29,57,52,.13)'; x.fillText('.', (i + .5) * cw, (j + .5) * lh); }
    }
    const per = ORB.periodMin(R), span = Math.min(per, 720), now = new Date(); let prev = null;
    for (let m = -span; m <= span; m += Math.max(.25, span / 500)) {
      const p = ORB.at(R, new Date(now.getTime() + m * 6e4)); if (!p) continue; const [px, py] = toXY(p.lat, p.lon);
      if (prev && Math.abs(px - prev[0]) < W / 2) { x.strokeStyle = m > 0 ? 'rgba(40,110,214,.9)' : 'rgba(40,110,214,.3)'; x.lineWidth = m > 0 ? 1.6 : 1; x.beginPath(); x.moveTo(prev[0], prev[1]); x.lineTo(px, py); x.stroke(); }
      prev = [px, py];
    }
    const p = ORB.at(R, now); if (p) { const [px, py] = toXY(p.lat, p.lon); x.font = `800 ${fs + 5}px JBM, monospace`; x.fillStyle = '#1d3934'; x.fillText('=[]=', px, py); x.font = `700 ${fs + 1}px JBM, monospace`; x.textAlign = 'left'; x.fillText(S.name, px + 22, py - 12); }
    const [hx, hy] = toXY(HERE.lat, HERE.lon); x.textAlign = 'center'; x.fillStyle = '#c2470e'; x.font = `800 ${fs + 3}px JBM, monospace`; x.fillText('+', hx, hy); x.font = `${fs}px JBM, monospace`; x.fillText(HERE.name.split(' (')[0], hx, hy + 12);
  }
  // coins paired with it: public links, with their live market
  function pairs() {
    OB.api('pair?op=list&n=' + n).then(j => { const L = j.pairs || [];
      $('#pairBox').innerHTML = `<div class="con"><div class="ct">coins riding it<span class="r">${L.length} paired · <a class="acc" href="/#pair">pair a coin with it →</a></span></div>${L.length ? `<div class="pairs">${L.map(p => `<a href="https://pump.fun/coin/${esc(p.mint)}" target="_blank" rel="noopener">${p.icon ? `<img src="${esc(p.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">` : '<span class="gl">$</span>'}<div style="min-width:0"><b>$${esc(p.symbol)}</b><small>${esc(p.name)} · ${OB.usd(p.mcap)}${p.ch1h != null ? ' · 1h ' + (p.ch1h >= 0 ? '+' : '') + Math.round(p.ch1h) + '%' : ''}</small></div><span class="dim" style="font-size:10.5px">${OB.ago(p.at)}</span></a>`).join('')}</div>` : `<div class="empty">No coin rides ${esc(S.name)} yet. Any pump.fun coin can be paired with it, free.</div>`}</div>`; }).catch(() => {});
  }
  // the coin, if there is one: market, chest, rules with their latest readings, and everything the engine did
  function coinBox(coin) {
    const box = $('#coinBox');
    if (!coin) {
      const now = new Date(), nx = ORB.nextOrbit(R, now), ns = ORB.nextCrossing(R, now, true);
      box.innerHTML = `<div class="con"><div class="ct">its coin<span class="r">open</span></div><div class="empty" style="text-align:left;padding:6px 0"><b>${esc(S.name)} has no coin yet.</b>
        The first launch on it takes it. A rulebook on this satellite would see its next lap complete in ${OB.dur(nx - now)}${ns ? ' and its next sunrise in ' + OB.dur(ns - now) : ''}.<br><br><a class="btn" href="/launch?n=${S.norad}">launch a coin on ${esc(S.name)} ↗</a></div></div>`;
      return;
    }
    OB.api('coins?m=' + coin.mint).then(j => {
      const c = j.coin, log = j.log || [];
      const rules = (c.rules || []).map((r, i) => { const st = (c.state_rules || []).find(s => s.rule === i) || {}; return `<div class="ru"><code>${String(i + 1).padStart(2, '0')}  ${esc(r.line)}</code><div class="rd">${esc(r.words)}<br><b>reading:</b> ${esc(st.reading || 'waiting for the first engine pass')}${st.lastFire ? ' · <b>last fired</b> ' + OB.ago(st.lastFire) : ''}</div></div>`; }).join('');
      box.innerHTML = `<div class="cols" style="margin-top:0"><div class="con c5"><div class="ct">$${esc(c.symbol)}<span class="r">${esc(c.state)}</span></div>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px"><img src="${esc(c.img)}" alt="" style="width:64px;height:64px;border:1px solid var(--line)"><div><b style="font-size:18px">${esc(c.name)}</b><div class="dim" style="font-size:11.5px">${OB.short(c.mint)} · launched ${OB.ago(c.liveAt || c.createdAt)}</div></div></div>
        <dl class="kv"><dt>market cap</dt><dd>${OB.usd(c.mcapUsd)}</dd><dt>chest</dt><dd>${c.chestSol ?? '—'} SOL</dd><dt>fees claimed</dt><dd>${c.claimedSol ?? 0} SOL</dd><dt>spent by rules</dt><dd>${c.spentSol ?? 0} SOL</dd><dt>rules fired</dt><dd>${c.fires}</dd><dt>rulebook</dt><dd>${esc(c.fp)}</dd><dt>coin wallet</dt><dd><a class="acc" href="https://solscan.io/account/${c.wallet}" target="_blank" rel="noopener">${OB.short(c.wallet)}</a></dd></dl></div>
        <div class="con c7 rules"><div class="ct">rulebook<span class="r">readings from the last engine pass</span></div>${rules}</div>
        <div class="con c12 flog"><div class="ct">engine log<span class="r">every action is a Solana transaction</span></div>${log.length ? log.map(l => `<div><time>${new Date(l.at).toISOString().slice(5, 16).replace('T', ' ')}</time><span>${esc(l.text)}${l.sig ? ` · <a href="https://solscan.io/tx/${l.sig}" target="_blank" rel="noopener">tx</a>` : ''}</span></div>`).join('') : '<div class="empty">Nothing yet.</div>'}</div></div>`;
    }).catch(e => { box.innerHTML = `<div class="con"><div class="empty">${esc(e.message)}</div></div>`; });
  }
})();
