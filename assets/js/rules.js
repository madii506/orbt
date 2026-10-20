/* orbt rulebooks: one shape, shared by the browser and the engine.
   Every coin on orbt belongs to one real satellite. A rule is
       when <its satellite does something in orbit>  ->  <the coin does something>   with a cooldown.
   Nothing here talks to the network; the orbital readers live in assets/js/orb.js and api/_sky.js. */
(function (root, make) { const R = make(); if (typeof module === 'object' && module.exports) module.exports = R; else root.OR = R; })(this, function () {
  const SRC = {
    orbit: { label: 'orbits', ops: { every: 'completes orbits' } },
    pass: { label: 'passes', ops: { over: 'passes over' } },
    sun: { label: 'sunlight', ops: { rise: 'flies out of Earth’s shadow', set: 'flies into Earth’s shadow' } },
    alt: { label: 'altitude', ops: { below: 'drops below', above: 'climbs above' } },
    reentry: { label: 're-entry', ops: { falls: 're-enters the atmosphere' } },
    coin: { label: 'the coin', ops: { mcap: 'market cap reaches', grad: 'graduates' } },
    time: { label: 'time', ops: { every: 'every' } },
  };
  const ACTS = {
    burn: { label: 'buy back & burn', fn: 'buyback_burn', cls: 'burn' },
    airdrop: { label: 'buy back & airdrop holders', fn: 'airdrop_holders', cls: 'air' },
    holders: { label: 'pay holders in SOL', fn: 'pay_holders', cls: 'hold' },
    creator: { label: 'pay the creator', fn: 'pay_creator', cls: 'crea' },
  };
  const MAX_RULES = 6;
  const num = (v, lo, hi) => { if (v === '' || v == null) return null; const n = Number(v); if (!isFinite(n)) return null; return Math.min(hi, Math.max(lo, n)); };
  const s = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f"\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
  function fail(m) { const e = new Error(m); e.rule = true; throw e; }

  function normalize(r) {
    if (!r || typeof r !== 'object') fail('A rule is empty.');
    const src = String(r.src || ''); if (!SRC[src]) fail('Pick what the rule watches.');
    const op = String(r.op || ''); if (!SRC[src].ops[op]) fail('Pick a condition for the ' + SRC[src].label + ' rule.');
    const act = String(r.act || ''); if (!ACTS[act]) fail('Pick what the coin does.');
    const out = { src, op };
    if (src === 'orbit') { out.every = num(r.every, 1, 500); if (out.every == null) fail('How many orbits between fires?'); out.every = Math.round(out.every); }
    else if (src === 'pass') {
      const c = r.city || {}; const lat = num(c.lat, -90, 90), lon = num(c.lon, -180, 180);
      if (lat == null || lon == null || !s(c.name, 60)) fail('Pick a city for the pass rule.');
      out.city = { name: s(c.name, 60), country: s(c.country, 40), lat: +lat.toFixed(3), lon: +lon.toFixed(3) };
      out.el = Math.round(num(r.el, 10, 80) || 20);
    } else if (src === 'alt') { out.value = num(r.value, 100, 50000); if (out.value == null) fail('Give the altitude in km.'); out.value = Math.round(out.value); }
    else if (src === 'coin') { if (op === 'mcap') { out.value = num(r.value, 1000, 1e11); if (out.value == null) fail('Give a market cap in USD.'); out.value = Math.round(out.value); } }
    else if (src === 'time') { out.every = num(r.every, 1, 168); if (out.every == null) fail('Give the interval in hours.'); out.every = Math.round(out.every); }
    out.act = act; out.pct = Math.round(num(r.pct, 1, 100) || 10);
    out.cool = Math.round(num(r.cool, 0, 168) ?? 1);
    if (src === 'reentry') out.cool = 0;
    return out;
  }
  function normalizeBook(list) {
    if (!Array.isArray(list) || !list.length) fail('Add at least one rule.');
    if (list.length > MAX_RULES) fail('Up to ' + MAX_RULES + ' rules.');
    return list.map(normalize);
  }
  const usd = v => '$' + (v >= 1 ? Number(v).toLocaleString('en-US', { maximumFractionDigits: v >= 1000 ? 0 : 2 }) : Number(v).toPrecision(3));
  function cond(r) {
    switch (r.src) {
      case 'orbit': return r.every === 1 ? 'sat.orbit.complete' : `sat.orbits % ${r.every} == 0`;
      case 'pass': return `sat.passes("${r.city.name}", el > ${r.el}°)`;
      case 'sun': return r.op === 'rise' ? 'sat.sunrise' : 'sat.sunset';
      case 'alt': return `sat.alt ${r.op === 'below' ? '<' : '>'} ${r.value}km`;
      case 'reentry': return 'sat.reenters';
      case 'coin': return r.op === 'mcap' ? `coin.mcap >= ${usd(r.value)}` : 'coin.graduates';
      case 'time': return `every(${r.every}h)`;
    }
    return '?';
  }
  const action = r => `${ACTS[r.act].fn}(${r.pct}% chest)`;
  const line = r => `when ${cond(r)} -> ${action(r)}`;
  function words(r) {
    let w;
    switch (r.src) {
      case 'orbit': w = r.every === 1 ? 'the satellite completes an orbit' : `the satellite completes another ${r.every} orbits`; break;
      case 'pass': w = `the satellite passes over ${r.city.name} (higher than ${r.el}° in its sky)`; break;
      case 'sun': w = r.op === 'rise' ? 'the satellite flies out of Earth’s shadow into sunlight' : 'the satellite flies into Earth’s shadow'; break;
      case 'alt': w = `the satellite ${r.op === 'below' ? 'drops below' : 'climbs above'} ${r.value} km`; break;
      case 'reentry': w = 'the satellite re-enters the atmosphere'; break;
      case 'coin': w = r.op === 'mcap' ? `the coin reaches ${usd(r.value)} market cap` : 'the coin graduates from pump.fun'; break;
      case 'time': w = `every ${r.every} hours`; break;
    }
    const a = { burn: 'buy back and burn', airdrop: 'buy back and airdrop the top holders', holders: 'pay the top holders', creator: 'pay the creator' }[r.act];
    return r.src === 'time' ? `Every ${r.every} hours, ${a} with ${r.pct}% of the chest.` : `When ${w}, ${a} with ${r.pct}% of the chest.`;
  }
  // events fire once per event (each orbit, each pass, each sunrise); levels fire when reached and re-arm when left
  const isEvent = r => r.src === 'orbit' || r.src === 'pass' || r.src === 'sun' || r.src === 'reentry' || r.src === 'time';
  function book(rules, meta) {
    const head = meta ? [`# ${meta.name} ($${meta.symbol}) · NORAD ${meta.norad || ''}`, `# rulebook ${meta.fp || ''}`.trim()] : [];
    return head.concat(rules.map((r, i) => `${String(i + 1).padStart(2, '0')}  ${line(r)}${r.cool ? `  # max once per ${r.cool}h` : ''}`)).join('\n');
  }
  function canon(rules) {
    const order = ['src', 'op', 'every', 'city', 'name', 'country', 'lat', 'lon', 'el', 'value', 'act', 'pct', 'cool'];
    const sortv = v => Array.isArray(v) ? v.map(sortv) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(k => [k, sortv(v[k])])) : v;
    return JSON.stringify({ v: 1, rules: sortv(rules) });
  }
  const TEMPLATES = [
    { id: 'orbiter', name: 'Every Orbit', blurb: 'One lap of the planet, one buyback. Low orbit means about 15 a day.', rules: [
      { src: 'orbit', op: 'every', every: 1, act: 'burn', pct: 5, cool: 1 }] },
    { id: 'dawn', name: 'Orbital Dawn', blurb: 'Out of the shadow, into the sun: the supply melts at every sunrise.', rules: [
      { src: 'sun', op: 'rise', act: 'burn', pct: 8, cool: 1 },
      { src: 'orbit', op: 'every', every: 16, act: 'holders', pct: 20, cool: 20 }] },
    { id: 'flyover', name: 'Flyover', blurb: 'When it crosses your city’s sky, the holders get paid.', rules: [
      { src: 'pass', op: 'over', city: { name: 'New York', country: 'United States', lat: 40.713, lon: -74.006 }, el: 20, act: 'airdrop', pct: 20, cool: 6 },
      { src: 'orbit', op: 'every', every: 4, act: 'burn', pct: 5, cool: 4 }] },
    { id: 'falling', name: 'Last Light', blurb: 'For satellites near the end: when it burns up, everything goes to the holders.', rules: [
      { src: 'alt', op: 'below', value: 300, act: 'burn', pct: 25, cool: 24 },
      { src: 'reentry', op: 'falls', act: 'holders', pct: 100, cool: 0 }] },
    { id: 'clock', name: 'Mission Clock', blurb: 'A steady burn and a payday at a round number.', rules: [
      { src: 'time', op: 'every', every: 6, act: 'burn', pct: 10, cool: 6 },
      { src: 'coin', op: 'mcap', value: 100000, act: 'holders', pct: 25, cool: 24 }] },
  ];
  return { SRC, ACTS, MAX_RULES, normalize, normalizeBook, cond, action, line, words, isEvent, book, canon, usd, TEMPLATES };
});
