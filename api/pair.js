// pair any pump.fun coin with a satellite. A pairing is a public link, free, and needs no wallet: the coin shows on its
// satellite on the live sky and on the satellite's page, with its live market. Rules can't run on a paired coin (the
// engine only spends fees it holds, which means coins launched on orbt); pairing says so.
// GET  /api/pair?op=search&q=      pump.fun coins by name, ticker or address (Jupiter's token search)
// GET  /api/pair?op=trending       the pump.fun coins trending on Jupiter right now
// GET  /api/pair?op=list[&n=]      recent pairings (or one satellite's), with live market numbers
// POST /api/pair {mint, norad}     pair it (one satellite per coin; a satellite can carry many coins)
const crypto = require('crypto');
const L = require('./_lib');
const SK = require('./_sky');
const JUP = 'https://lite-api.jup.ag';
const isPump = t => t && (t.launchpad === 'pump.fun' || /pump$/.test(t.id || ''));
const shape = t => ({ mint: t.id, symbol: L.clean(t.symbol, 16), name: L.clean(t.name, 48), icon: t.icon || null, mcap: Math.round(t.mcap || t.fdv || 0), price: t.usdPrice || null,
  ch1h: t.stats1h && t.stats1h.priceChange != null ? +Number(t.stats1h.priceChange).toFixed(2) : null, ch24: t.stats24h && t.stats24h.priceChange != null ? +Number(t.stats24h.priceChange).toFixed(2) : null,
  vol24: t.stats24h ? Math.round((t.stats24h.buyVolume || 0) + (t.stats24h.sellVolume || 0)) : null, holders: t.holderCount || null, bonded: !!(t.graduatedPool || t.graduatedAt) });
async function jup(path, ms = 8000) { const r = await L.getJson(JUP + path, {}, ms); if (r.status !== 200 || !Array.isArray(r.json)) throw new Error('jupiter ' + r.status); return r.json; }
async function search(q) {
  q = String(q || '').trim().slice(0, 64); if (q.length < 2) return [];
  return L.remember('ps:' + q.toLowerCase(), 30000, async () => (await jup('/tokens/v2/search?query=' + encodeURIComponent(q))).filter(isPump).filter(t => !L.BANNED.test((t.name || '') + ' ' + (t.symbol || ''))).slice(0, 14).map(shape));
}
async function trending() {
  return L.remember('trend', 60000, async () => (await jup('/tokens/v2/toptrending/1h?limit=100')).filter(isPump).filter(t => !L.BANNED.test((t.name || '') + ' ' + (t.symbol || ''))).slice(0, 18).map(shape));
}
async function live(mints) {   // live numbers for paired coins, 100 per call
  const out = {}; for (let i = 0; i < mints.length; i += 100) { const chunk = mints.slice(i, i + 100); try { const js = await L.remember('pl:' + chunk.join(',').slice(0, 400) + chunk.length, 60000, () => jup('/tokens/v2/search?query=' + chunk.join(','))); js.forEach(t => out[t.id] = shape(t)); } catch {} }
  return out;
}
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return L.send(res, 204, {});
  const qy = L.query(req), op = String(qy.op || 'list');
  try {
    if (op === 'search') return L.send(res, 200, { ok: true, coins: await search(qy.q) }, L.CACHE(30));
    if (op === 'trending') return L.send(res, 200, { ok: true, coins: await trending() }, L.CACHE(60));
    if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'the records are offline' });
    await L.ready();
    if (req.method === 'POST') {
      if (L.limited('pair:' + L.ip(req), 6, 600000)) return L.send(res, 200, { ok: false, error: 'Six pairings every ten minutes from one place. Try again in a bit.' });
      const b = await L.body(req, 4096); const mint = String(b.mint || '').trim(), norad = Number(b.norad);
      if (!L.isAddr(mint)) return L.send(res, 200, { ok: false, error: 'Pick a coin first.' });
      const st = await SK.sat(norad); if (!st) return L.send(res, 200, { ok: false, error: 'Pick a satellite that is in orbit right now.' });
      const had = (await L.q(`SELECT norad, sat FROM ob_pairs WHERE mint=$1`, [mint]))[0];
      if (had) return L.send(res, 200, { ok: false, error: `That coin is already paired with ${had.sat} (${had.norad}). One satellite per coin.` });
      const launched = (await L.q(`SELECT norad FROM ob_coins WHERE mint=$1`, [mint]))[0];
      if (launched) return L.send(res, 200, { ok: false, error: 'That coin was launched on orbt and already belongs to its satellite.' });
      const found = (await jup('/tokens/v2/search?query=' + mint)).find(t => t.id === mint);
      if (!found || !isPump(found)) return L.send(res, 200, { ok: false, error: 'That isn’t a pump.fun coin with a market.' });
      const c = shape(found); if (L.BANNED.test(c.name + ' ' + c.symbol)) return L.send(res, 200, { ok: false, error: 'That coin can’t be paired here.' });
      const who = crypto.createHash('sha256').update('pair:' + L.ip(req)).digest('hex').slice(0, 10);
      await L.q(`INSERT INTO ob_pairs (mint, norad, sat, symbol, name, icon, who) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [mint, norad, st.name, c.symbol, c.name, c.icon, who]);
      return L.send(res, 200, { ok: true, pair: { ...c, norad, sat: st.name, at: new Date().toISOString() } });
    }
    const n = Number(qy.n) || 0;
    const rows = n > 0 ? await L.q(`SELECT * FROM ob_pairs WHERE norad=$1 ORDER BY at DESC LIMIT 60`, [n]) : await L.q(`SELECT * FROM ob_pairs ORDER BY at DESC LIMIT 300`);
    const lv = await live(rows.map(r => r.mint));
    const pairs = rows.map(r => ({ mint: r.mint, norad: r.norad, sat: r.sat, symbol: r.symbol, name: r.name, icon: r.icon, at: r.at, ...(lv[r.mint] ? { mcap: lv[r.mint].mcap, ch1h: lv[r.mint].ch1h, ch24: lv[r.mint].ch24, holders: lv[r.mint].holders, icon: lv[r.mint].icon || r.icon } : {}) }));
    const tot = n > 0 ? pairs.length : Number((await L.q(`SELECT count(*)::int AS n FROM ob_pairs`))[0].n);
    L.send(res, 200, { ok: true, total: tot, pairs }, L.CACHE(10));
  } catch (e) { L.send(res, 200, { ok: false, error: 'That didn’t go through: ' + String(e && e.message).slice(0, 120) }); }
};
