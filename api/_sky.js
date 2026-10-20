// orbt's sky: the public catalogue of active satellites (CelesTrak element sets, refreshed every few hours and kept in
// the database), and the readers that check a rule against the satellite's real orbit. Nothing here guesses: if a
// source can't be read, the rule waits.
const L = require('./_lib');
const O = require('../assets/js/orb.js');
const R = require('../assets/js/rules.js');

const CT = 'https://celestrak.org';
const GROUPS = { station: 'stations', visual: 'visual', weather: 'weather', gnss: 'gnss', science: 'science' };
const STALE = 3 * 36e5;          // refresh the catalogue every 3 hours (CelesTrak updates a few times a day)
const now = () => new Date().toISOString();

function parseTle(text) {
  const out = []; const ls = String(text || '').split(/\r?\n/).map(s => s.replace(/\s+$/, '')).filter(Boolean);
  for (let i = 0; i + 2 < ls.length + 1; i++) {
    if (ls[i + 1] && ls[i + 2] && ls[i + 1].startsWith('1 ') && ls[i + 2].startsWith('2 ')) {
      const norad = parseInt(ls[i + 1].slice(2, 7), 10); out.push({ norad, name: ls[i].trim(), l1: ls[i + 1], l2: ls[i + 2] }); i += 2;
    }
  }
  return out;
}
async function fetchTle(group, ms) {
  const r = await L.getJson(`${CT}/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`, { headers: { accept: 'text/plain' } }, ms);
  if (r.status !== 200 || !/^\S.*\r?\n1 /m.test(r.text || '')) throw new Error('celestrak ' + group + ' ' + r.status);
  return parseTle(r.text);
}
let MEM = null;
// the catalogue: [[norad, name, tag, l1, l2, bright], ...]. Requests read the stored copy; the engine tick refreshes it.
async function catalog() {
  if (MEM && Date.now() - MEM.loaded < 10 * 6e4) return MEM;
  await L.ready();
  const row = (await L.q(`SELECT v, at FROM ob_cat WHERE k='cat'`))[0];
  if (!row) return refresh();
  return (MEM = { at: new Date(row.at).getTime(), sats: JSON.parse(row.v), loaded: Date.now() });
}
async function fresh() {   // called by the tick: refresh when older than STALE
  await L.ready();
  const row = (await L.q(`SELECT at FROM ob_cat WHERE k='cat'`))[0];
  if (row && Date.now() - new Date(row.at).getTime() < STALE) return { ok: true, fresh: true };
  const c = await refresh(); return { ok: !c.error, count: c.sats.length, error: c.error };
}
async function refresh() {
  await L.ready();
  // one refresher at a time, at most once every 20 minutes
  const lock = await L.q(`INSERT INTO ob_meta (k, v) VALUES ('catlock', $1) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v WHERE ob_meta.v::bigint < $2 RETURNING v`, [String(Date.now()), Date.now() - 20 * 6e4]);
  const row = (await L.q(`SELECT v, at FROM ob_cat WHERE k='cat'`))[0];
  if (!lock.length) { if (row) return (MEM = { at: new Date(row.at).getTime(), sats: JSON.parse(row.v), loaded: Date.now() }); throw new Error('the catalogue is loading, try again in a minute'); }
  try {
    const all = await fetchTle('active', 45000);
    const tags = {};
    for (const [tag, g] of Object.entries(GROUPS)) { try { for (const s of await fetchTle(g, 12000)) (tags[s.norad] = tags[s.norad] || {})[tag] = 1; } catch {} }
    const seen = new Set(); const sats = [];
    for (const s of all) { if (seen.has(s.norad)) continue; seen.add(s.norad); const t = tags[s.norad] || {}; sats.push([s.norad, s.name, O.tagOf(s.name, t), s.l1, s.l2, t.visual ? 1 : 0]); }
    if (sats.length < 1000) throw new Error('catalogue too small: ' + sats.length);
    await L.q(`INSERT INTO ob_cat (k, v, at) VALUES ('cat', $1, now()) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v, at=now()`, [JSON.stringify(sats)]);
    await L.q(`INSERT INTO ob_meta (k, v) VALUES ('catcount', $1) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v`, [String(sats.length)]);
    return (MEM = { at: Date.now(), sats, loaded: Date.now() });
  } catch (e) {
    await L.q(`UPDATE ob_meta SET v='0' WHERE k='catlock'`).catch(() => {});
    if (row) return (MEM = { at: new Date(row.at).getTime(), sats: JSON.parse(row.v), loaded: Date.now(), error: String(e.message) });
    throw e;
  }
}
async function sat(norad) {
  const c = await catalog(); const s = c.sats.find(x => x[0] === Number(norad));
  return s ? { norad: s[0], name: s[1], tag: s[2], l1: s[3], l2: s[4], bright: !!s[5], at: c.at } : null;
}
// CelesTrak's satellite catalogue: launch date, owner, and the decay date once it has come down
async function satcat(norad) {
  return L.remember('sc:' + norad, 6 * 36e5, async () => {
    const r = await L.getJson(`${CT}/satcat/records.php?CATNR=${Number(norad)}&FORMAT=json`, {}, 12000);
    const j = Array.isArray(r.json) ? r.json[0] : null; if (!j) throw new Error('satcat ' + r.status);
    return { name: j.OBJECT_NAME, id: j.OBJECT_ID, type: j.OBJECT_TYPE, owner: j.OWNER, launch: j.LAUNCH_DATE, site: j.LAUNCH_SITE, decay: j.DECAY_DATE || null,
      period: j.PERIOD, inc: j.INCLINATION, apogee: j.APOGEE, perigee: j.PERIGEE, rcs: j.RCS, status: j.OPS_STATUS_CODE };
  });
}

// ---------- the coin's market (Dexscreener, then the pump.fun curve) ----------
async function coinMarket(mint) {
  if (!L.isAddr(mint)) return { ok: false };
  return L.remember('cm:' + mint, 60000, async () => {
    try {
      const r = await L.getJson(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {}, 7000);
      const ps = ((r.json && r.json.pairs) || []).filter(p => p.chainId === 'solana').sort((a, b) => ((b.liquidity || {}).usd || 0) - ((a.liquidity || {}).usd || 0));
      if (ps.length) { const p = ps[0]; return { ok: true, mcapUsd: Number(p.marketCap || p.fdv || 0) || null, priceUsd: Number(p.priceUsd) || null, complete: p.dexId !== 'pumpfun', ch1h: (p.priceChange || {}).h1 ?? null, ch24: (p.priceChange || {}).h24 ?? null, vol24: (p.volume || {}).h24 ?? null, src: p.url, at: now() }; }
    } catch {}
    try {
      const [bc] = await L.accounts([L.bondingCurveOf(mint)]);
      if (bc && bc.data.length >= 49) {
        const vTok = Number(bc.data.readBigUInt64LE(8)), vSol = Number(bc.data.readBigUInt64LE(16)), supply = Number(bc.data.readBigUInt64LE(40)), complete = bc.data[48] === 1;
        const sp = await solUsd().catch(() => null);
        const mcapSol = vTok ? (vSol / 1e9) * (supply / vTok) : null;
        return { ok: true, mcapUsd: mcapSol && sp ? mcapSol * sp : null, mcapSol, complete, src: 'https://pump.fun/coin/' + mint, at: now() };
      }
    } catch {}
    return { ok: false, error: 'no market yet', src: 'https://pump.fun/coin/' + mint };
  });
}
async function solUsd() {
  return L.remember('solusd', 60000, async () => { const r = await L.getJson('https://api.coinbase.com/v2/prices/SOL-USD/spot', {}, 6000); const v = Number(r.json && r.json.data && r.json.data.amount); if (!v) throw new Error('price'); return v; });
}

// ---------- reading a rule against the satellite, right now ----------
// returns { ok, now, key, text }   ok=false: the source couldn't be read (the rule waits; it never guesses)
const fmtMin = ms => { const m = Math.max(0, Math.round(ms / 6e4)); return m < 60 ? m + ' min' : (m / 60).toFixed(1) + ' h'; };
async function evaluate(r, ctx = {}) {
  try {
    if (r.src === 'coin') {
      const m = await coinMarket(ctx.mint); if (!m.ok) return { ok: false, text: 'market offline' };
      if (r.op === 'grad') return { ok: true, now: !!m.complete, text: m.complete ? 'graduated' : 'on the bonding curve' };
      return { ok: true, now: (m.mcapUsd || 0) >= r.value, text: `market cap ${m.mcapUsd ? R.usd(m.mcapUsd) : '—'}` };
    }
    if (r.src === 'time') {
      const from = ctx.since ? new Date(ctx.since).getTime() : Date.now();
      const n = Math.floor((Date.now() - from) / (r.every * 36e5));
      return { ok: true, now: n >= 1, key: n >= 1 ? 't' + n : null, text: n >= 1 ? `period ${n} since launch` : `first one in ${fmtMin(from + r.every * 36e5 - Date.now())}` };
    }
    const s = await sat(ctx.norad);
    if (r.src === 'reentry') {
      if (s) { const p = O.at(O.rec(s.l1, s.l2), new Date()); if (p && p.alt > 0) return { ok: true, now: false, text: `still in orbit at ${Math.round(p.alt)} km` }; }
      const sc = await satcat(ctx.norad).catch(() => null);
      if (!sc) return { ok: false, text: 'not in the active catalogue; waiting for the satellite catalogue to confirm' };
      if (sc.decay) return { ok: true, now: true, key: 'reentry', text: `re-entered on ${sc.decay}` };
      return { ok: true, now: false, text: s ? 'in orbit' : 'missing from the active list, not confirmed down yet' };
    }
    if (!s) return { ok: false, text: 'satellite not in the active catalogue right now' };
    const rec = O.rec(s.l1, s.l2), t = new Date(), p = O.at(rec, t);
    if (!p) return { ok: false, text: 'its orbit could not be computed' };
    const since = ctx.since ? new Date(ctx.since) : t;
    if (r.src === 'alt') { const v = p.alt; return { ok: true, now: r.op === 'below' ? v < r.value : v > r.value, text: `altitude ${Math.round(v)} km` }; }
    if (r.src === 'orbit') {
      const n0 = O.orbitNo(rec, since), n = O.orbitNo(rec, t), done = n - n0, k = Math.floor(done / r.every);
      const nx = O.nextOrbit(rec, t);
      return { ok: true, now: k >= 1, key: k >= 1 ? 'o' + k : null, text: `orbit ${n} · ${done} since launch · next lap in ${fmtMin(nx - t)}` };
    }
    if (r.src === 'sun') {
      const from = new Date(Math.max(since.getTime(), t.getTime() - 40 * 6e4));
      const cr = O.crossings(rec, from, t).filter(c => c.rise === (r.op === 'rise'));
      const last = cr[cr.length - 1]; const lit = O.lit(p.eci, t);
      const nx = O.nextCrossing(rec, t, r.op === 'rise');
      return { ok: true, now: !!last, key: last ? 's' + Math.round(last.t.getTime() / 6e4) : null, text: `${lit ? 'in sunlight' : 'in Earth’s shadow'}${nx ? ` · next ${r.op === 'rise' ? 'sunrise' : 'sunset'} in ${fmtMin(nx - t)}` : ''}` };
    }
    if (r.src === 'pass') {
      const obs = { lat: r.city.lat, lon: r.city.lon };
      const from = new Date(Math.max(since.getTime(), t.getTime() - 40 * 6e4));
      const ps = O.passes(rec, obs, from, (t - from) / 36e5 + 0.2, r.el).filter(x => x.maxAt <= t);
      const l = O.look(rec, t, obs);
      const last = ps[ps.length - 1];
      const nx = O.passes(rec, obs, t, 36, r.el, 1)[0];
      return { ok: true, now: !!last, key: last ? 'p' + Math.round(last.rise.getTime() / 6e4) : null,
        text: `${l && l.el > 0 ? `in ${r.city.name}’s sky now at ${Math.round(l.el)}°` : 'below the horizon'}${nx ? ` · next pass above ${r.el}° in ${fmtMin(nx.rise - t)}` : ' · no pass in the next 36 h'}` };
    }
  } catch (e) { return { ok: false, text: 'source error: ' + String(e && e.message).slice(0, 80) }; }
  return { ok: false, text: 'unknown rule' };
}

// the lowest active satellites right now: the ones closest to coming down
async function lowest(n = 40) {
  const c = await catalog(); const t = new Date(); const out = [];
  for (const s of c.sats) {
    const ecc = parseFloat('0.' + s[4].slice(26, 33)), mmd = parseFloat(s[4].slice(52, 63));
    if (!(mmd > 15.6)) continue;   // only the low ones (period under ~92 minutes)
    const a = Math.pow(398600.4418 / Math.pow(mmd * 2 * Math.PI / 86400, 2), 1 / 3), per = a * (1 - ecc) - O.RE;
    out.push({ norad: s[0], name: s[1], tag: s[2], perigee: Math.round(per), mmd });
  }
  out.sort((a, b) => a.perigee - b.perigee);
  return out.slice(0, n).map(x => { const s = c.sats.find(y => y[0] === x.norad); const p = O.at(O.rec(s[3], s[4]), t); return { ...x, alt: p ? Math.round(p.alt) : null }; });
}

module.exports = { catalog, refresh, fresh, sat, satcat, coinMarket, evaluate, lowest, parseTle, solUsd };
