/*******************************************************************************
 * Macro.gs  v1.9
 * SPX Daily Market Analysis — rates, yield curve, dollar & yen carry, global
 * markets, commodities, crypto, sectors — with stress meters and alerts
 *
 * Owns:  Macro Radar (visible)         — meters, risk regime, "what matters today"
 *        Yield Curve (visible)         — curve snapshot, spreads, real yields,
 *                                        term premium, MOVE, equity risk premium
 *        FX & Carry (visible)          — dollar, yen, carry-trade stress, JGBs, positioning
 *        Global Markets (visible)      — Asia / Europe / EM overnight picture
 *        Commodities & Crypto (visible)— oil, gold, silver, copper, gas, BTC, ETH, sectors
 *        _Macro (hidden)               — one row per trading day, every series + meters
 *        _MacroCharts (hidden)         — data behind the hub charts
 * Day files: fills the "Macro" tab, the MACRO RADAR row on the Report (row 8),
 * the red-alert flag and the Game Plan's "What matters today" banner.
 * Sources (free): Yahoo Finance, FRED public data, U.S. Treasury yield curve,
 * Japan MOF (JGBs), CFTC (positioning). Requires Core 2.5+, MarketData 2.0+, DayFile 1.3+.
 ******************************************************************************/

const MC_VERSION = '1.9';

// key, Yahoo symbol, label, group
const MC_SYM = [
  ['tnx', '^TNX', '10Y yield (live)', 'rates'], ['tyx', '^TYX', '30Y yield (live)', 'rates'], ['fvx', '^FVX', '5Y yield (live)', 'rates'], ['irx', '^IRX', '13-week bill', 'rates'],
  ['move', '^MOVE', 'MOVE (bond volatility)', 'rates'],
  ['dxy', 'DX-Y.NYB', 'Dollar index (DXY)', 'fx'], ['usdjpy', 'JPY=X', 'USD/JPY', 'fx'], ['eurusd', 'EURUSD=X', 'EUR/USD', 'fx'], ['gbpusd', 'GBPUSD=X', 'GBP/USD', 'fx'],
  ['usdcnh', 'CNH=X', 'USD/CNH', 'fx'], ['usdchf', 'CHF=X', 'USD/CHF', 'fx'], ['audjpy', 'AUDJPY=X', 'AUD/JPY (carry)', 'fx'], ['mxnjpy', 'MXNJPY=X', 'MXN/JPY (carry)', 'fx'],
  ['n225', '^N225', 'Nikkei 225', 'asia'], ['hsi', '^HSI', 'Hang Seng', 'asia'], ['sse', '000001.SS', 'Shanghai Composite', 'asia'], ['kospi', '^KS11', 'KOSPI', 'asia'], ['asx', '^AXJO', 'ASX 200', 'asia'],
  ['dax', '^GDAXI', 'DAX', 'europe'], ['ftse', '^FTSE', 'FTSE 100', 'europe'], ['cac', '^FCHI', 'CAC 40', 'europe'], ['sx5e', '^STOXX50E', 'Euro Stoxx 50', 'europe'], ['eem', 'EEM', 'Emerging markets (EEM)', 'em'],
  ['wti', 'CL=F', 'WTI crude', 'energy'], ['brent', 'BZ=F', 'Brent crude', 'energy'], ['natgas', 'NG=F', 'Natural gas', 'energy'], ['ovx', '^OVX', 'Oil volatility (OVX)', 'energy'],
  ['gold', 'GC=F', 'Gold', 'metals'], ['silver', 'SI=F', 'Silver', 'metals'], ['copper', 'HG=F', 'Copper', 'metals'], ['gvz', '^GVZ', 'Gold volatility (GVZ)', 'metals'],
  ['btc', 'BTC-USD', 'Bitcoin', 'crypto'], ['eth', 'ETH-USD', 'Ethereum', 'crypto'],
  ['xlk', 'XLK', 'Technology', 'sector'], ['xlf', 'XLF', 'Financials', 'sector'], ['xle', 'XLE', 'Energy', 'sector'], ['xlv', 'XLV', 'Health care', 'sector'], ['xly', 'XLY', 'Consumer discretionary', 'sector'],
  ['xlp', 'XLP', 'Consumer staples', 'sector'], ['xli', 'XLI', 'Industrials', 'sector'], ['xlb', 'XLB', 'Materials', 'sector'], ['xlu', 'XLU', 'Utilities', 'sector'], ['xlre', 'XLRE', 'Real estate', 'sector'],
  ['xlc', 'XLC', 'Communication', 'sector'], ['smh', 'SMH', 'Semiconductors', 'sector'], ['iwm', 'IWM', 'Small caps (IWM)', 'sector'], ['rsp', 'RSP', 'Equal-weight S&P (RSP)', 'sector'],
  ['kre', 'KRE', 'Regional banks', 'sector'], ['hyg', 'HYG', 'High-yield bonds (HYG)', 'sector'], ['tlt', 'TLT', '20Y+ Treasuries (TLT)', 'sector']
];
// FRED public series (no key): official daily curve + real yields, breakevens, credit, liquidity, term premium
const MC_FRED = [['y_1m', 'DGS1MO'], ['y_3m', 'DGS3MO'], ['y_6m', 'DGS6MO'], ['y_1y', 'DGS1'], ['y_2y', 'DGS2'], ['y_3y', 'DGS3'], ['y_5y', 'DGS5'], ['y_7y', 'DGS7'],
  ['y_10y', 'DGS10'], ['y_20y', 'DGS20'], ['y_30y', 'DGS30'], ['real10', 'DFII10'], ['be10', 'T10YIE'], ['hy_oas', 'BAMLH0A0HYM2'], ['ig_oas', 'BAMLC0A0CM'],
  ['fed_bs', 'WALCL'], ['tga', 'WTREGEN'], ['rrp', 'RRPONTSYD'], ['termprem', 'THREEFYTP10']];
const MC_CURVE = [['1M', 'y_1m'], ['3M', 'y_3m'], ['6M', 'y_6m'], ['1Y', 'y_1y'], ['2Y', 'y_2y'], ['3Y', 'y_3y'], ['5Y', 'y_5y'], ['7Y', 'y_7y'], ['10Y', 'y_10y'], ['20Y', 'y_20y'], ['30Y', 'y_30y']];
// Bank of Japan policy meetings (decision day). Add future years here or ask for an update.
const MC_BOJ = ['2026-01-23', '2026-03-19', '2026-04-30', '2026-06-16', '2026-07-31', '2026-09-18', '2026-10-30', '2026-12-18'];
const MC_METERS = [['rates', 'Rates'], ['credit', 'Credit'], ['carry', 'Dollar / Yen'], ['oil', 'Oil'], ['vol', 'Volatility'], ['global', 'Global'], ['liq', 'Liquidity'], ['crypto', 'Crypto']];

/* =============================================================================
 * DATABASE SPECS
 * ========================================================================== */
function mc_spec_() {
  const cols = [['date', 'Date', 12, FMT.TEXT]];
  MC_FRED.forEach(function (f) { cols.push([f[0], f[1], 9, '0.000']); });
  cols.push(['jgb10', 'JGB 10Y', 8, '0.000']);
  MC_SYM.forEach(function (s) { cols.push([s[0], s[2], 10, '#,##0.00##']); });
  MC_METERS.forEach(function (m) { cols.push(['m_' + m[0], m[1] + ' meter', 8, '0']); });
  cols.push(['regime', 'Risk regime', 12, FMT.TEXT], ['alerts', 'Alerts (data)', 30, FMT.TEXT], ['corr', 'Correlations (data)', 20, FMT.TEXT], ['updated', 'Updated', 15, FMT.TEXT]);
  return { name: '_Macro', hidden: true, freezeCols: 1, title: '_Macro  —  one row per trading day: every cross-asset series and the stress meters',
    subtitle: 'Yahoo Finance · FRED · U.S. Treasury · Japan MOF · CFTC. Rebuilt by Macro.gs each morning and at the close.', cols: cols };
}
const MC_TABS = ['Macro Radar', 'Yield Curve', 'FX & Carry', 'Global Markets', 'Commodities & Crypto'];

function mc_buildTabs() {
  db_ensure(mc_spec_());
  const ss = SpreadsheetApp.getActive();
  let cd = ss.getSheetByName('_MacroCharts'); if (!cd) cd = ss.insertSheet('_MacroCharts');
  if (cd.getMaxColumns() < 40) cd.insertColumnsAfter(cd.getMaxColumns(), 40 - cd.getMaxColumns());
  if (cd.getMaxRows() < 600) cd.insertRowsAfter(cd.getMaxRows(), 600 - cd.getMaxRows());
  cd.hideSheet();
  const missing = MC_TABS.filter(function (t) { return !ss.getSheetByName(t); });
  missing.forEach(function (t) { mc_layout_(t); });
  if (missing.length) mc_renderAll_();                    // existing tabs are redrawn by Macro → Update macro now and the schedule
}

/* =============================================================================
 * ENTRY POINTS
 * ========================================================================== */
/** Macro → Update macro now; also the morning and end-of-day triggers. */
function mc_updateAll(silent) {
  let peLog = [];
  try { if (silent !== true || mc_peStore_().checked !== cal_today()) peLog = mc_peUpdate_(); } catch (e) { peLog = ['P/E ✗ ' + e.message]; }   // both P/E sources (every manual run; once a day automatically)
  const t0 = Date.now(), log = (peLog.length ? ['Forward P/E — ' + peLog.join(' · ')] : []).concat(mc_run_({ range: '3mo', fredStart: cal_add(cal_today(), -120) }));
  try { if (core_fnExists_('cv_update')) log.push(cv_update(false)); } catch (e) { log.push('✗ Yield-curve health: ' + e.message); }
  mc_renderAll_();
  if (silent !== true) core_alert('Macro updated', log.join('\n') + '\n\nFinished in ' + Math.round((Date.now() - t0) / 1000) + ' s');
}
/** Macro → Backfill macro history (2 years). */
function mc_backfill() {
  try { mc_peUpdate_(); } catch (e) { /* shown as unavailable */ }
  try { if (core_fnExists_('cv_buildTabs')) cv_buildTabs(); } catch (e) { /* next run */ }
  const t0 = Date.now(), log = mc_run_({ range: '2y', fredStart: cal_add(cal_today(), -800), full: true });
  try { if (core_fnExists_('cv_update')) log.push(cv_update(true)); } catch (e) { log.push('✗ Yield-curve health: ' + e.message); }
  mc_renderAll_();
  core_alert('Macro history', log.join('\n') + '\n\nFinished in ' + Math.round((Date.now() - t0) / 1000) + ' s');
}
/** Nightly: weekly positioning (CFTC) and JGB yields. */
function mc_nightly() {
  try { mc_cot_(); } catch (e) { core_logError_('mc cot', e); }
  try { mc_peUpdate_(); } catch (e) { core_logError_('mc pe', e); }
}
function mc_open_(name) { const ss = SpreadsheetApp.getActive(); let sh = ss.getSheetByName(name); if (!sh) { mc_buildTabs(); sh = ss.getSheetByName(name); } ss.setActiveSheet(sh); }
function mc_openRadar() { mc_open_('Macro Radar'); }
function mc_openCurve() { mc_open_('Yield Curve'); }
function mc_openFx() { mc_open_('FX & Carry'); }
function mc_openGlobal() { mc_open_('Global Markets'); }
function mc_openCommod() { mc_open_('Commodities & Crypto'); }

/* =============================================================================
 * DATA
 * ========================================================================== */
function mc_run_(opt) {
  const spec = mc_spec_(); if (!db_sheet_(spec)) db_ensure(spec);
  const log = [];
  const P = in_prices_();
  const byDate = {};
  db_readAll(spec).rows.forEach(function (r) { byDate[String(r.date)] = r; });
  const start = opt.full ? cal_add(cal_today(), -740) : cal_add(cal_today(), -100);
  const days = P.rows.map(function (r) { return String(r.date); }).filter(function (d) { return d >= start; });
  if (cal_isTradingDay(cal_today()) && days[days.length - 1] !== cal_today()) days.push(cal_today());
  days.forEach(function (d) { if (!byDate[d]) byDate[d] = { date: d }; });
  // 1. Yahoo daily closes, fetched in parallel batches
  const req = MC_SYM.map(function (s) {
    return { url: 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(s[1]) + '?interval=1d&range=' + opt.range, muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' } };
  });
  let ok = 0; const bad = [];
  for (let i = 0; i < req.length; i += 12) {
    const res = UrlFetchApp.fetchAll(req.slice(i, i + 12));
    res.forEach(function (r, j) {
      const s = MC_SYM[i + j];
      try {
        if (r.getResponseCode() !== 200) throw new Error('HTTP ' + r.getResponseCode());
        const series = mc_parseDaily_(JSON.parse(r.getContentText()));
        const dates = Object.keys(series).sort();
        let p = 0, last = '';
        days.forEach(function (d) { while (p < dates.length && dates[p] <= d) { last = series[dates[p]]; p++; } if (last !== '') byDate[d][s[0]] = last; });
        ok++;
      } catch (e) { bad.push(s[2]); }
    });
  }
  log.push('✓ Markets: ' + ok + ' of ' + MC_SYM.length + ' series' + (bad.length ? ' · unavailable: ' + bad.join(', ') : ''));
  // 2. FRED public series (official curve, real yields, breakevens, credit, liquidity, term premium)
  try {
    const f = mc_fredMulti_(MC_FRED.map(function (x) { return x[1]; }), opt.fredStart);
    MC_FRED.forEach(function (x) {
      const s = f[x[1]] || {}, dates = Object.keys(s).sort(); let p = 0, last = '';
      days.forEach(function (d) { while (p < dates.length && dates[p] <= d) { last = s[dates[p]]; p++; } if (last !== '') byDate[d][x[0]] = last; });
    });
    log.push('✓ FRED: ' + Object.keys(f).length + ' series');
  } catch (e) { log.push('✗ FRED: ' + e.message); }
  // 3. Today's official curve from the U.S. Treasury (FRED posts it the next morning)
  try {
    const tc = mc_treasuryCurve_(cal_y(cal_today()));
    let n = 0;
    Object.keys(tc).forEach(function (d) { if (byDate[d]) { Object.assign(byDate[d], tc[d]); n++; } });
    log.push('✓ Treasury curve: ' + n + ' days');
  } catch (e) { log.push('✗ Treasury curve: ' + e.message); }
  // 4. JGB 10-year (Japan Ministry of Finance)
  try { const j = mc_jgb_(); let n = 0; Object.keys(j).forEach(function (d) { if (byDate[d]) { byDate[d].jgb10 = j[d]; n++; } }); log.push('✓ JGB 10Y: ' + n + ' days'); }
  catch (e) { log.push('✗ JGB 10Y: ' + e.message); }
  // carry JGB forward over Japanese holidays
  let lj = ''; days.forEach(function (d) { if (byDate[d].jgb10 !== undefined && byDate[d].jgb10 !== '') lj = byDate[d].jgb10; else if (lj !== '') byDate[d].jgb10 = lj; });
  // 5. meters, alerts, correlations
  const rows = Object.keys(byDate).sort().map(function (d) { return byDate[d]; }).filter(function (r) { return cal_isTradingDay(String(r.date)); });
  const pe = function (d, px) { return mc_peFor_(d, px).avg; };
  rows.forEach(function (r, i) { if (i >= rows.length - (opt.full ? rows.length : 40)) mc_score_(rows, i, P, pe); });
  const stamp = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  if (rows.length) rows[rows.length - 1].updated = stamp;
  db_writeAll(mc_spec_(), rows.map(in_clean_));
  PropertiesService.getScriptProperties().setProperty('MC_HEALTH', JSON.stringify({ time: stamp, log: log }));
  log.push('Days stored: ' + rows.length);
  return log;
}
function mc_parseDaily_(j) {
  const r = j && j.chart && j.chart.result && j.chart.result[0], out = {};
  if (!r || !r.timestamp) return out;
  const q = r.indicators.quote[0], off = (r.meta && r.meta.gmtoffset) || 0;
  r.timestamp.forEach(function (t, i) {
    const c = q.close[i]; if (c === null || c === undefined) return;
    out[Utilities.formatDate(new Date((t + off) * 1000), 'UTC', 'yyyy-MM-dd')] = Math.round(c * 10000) / 10000;
  });
  return out;
}
function mc_fredMulti_(ids, start) {
  const out = {};
  const res = UrlFetchApp.fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=' + ids.join(',') + '&cosd=' + start, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {                                   // fall back to one request per series
    ids.forEach(function (id) { try { out[id] = md_fredCsv_(id, start); } catch (e) { /* skip */ } });
    return out;
  }
  const lines = res.getContentText().split(/\r?\n/), head = lines[0].split(',');
  head.slice(1).forEach(function (id) { out[id] = {}; });
  lines.slice(1).forEach(function (ln) {
    const p = ln.split(','); if (p.length < 2) return;
    head.slice(1).forEach(function (id, j) { const v = p[j + 1]; if (v && v !== '.' && isFinite(Number(v))) out[id][p[0]] = Number(v); });
  });
  return out;
}
function mc_treasuryCurve_(year) {
  const url = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/' + year +
    '/all?type=daily_treasury_yield_curve&field_tdr_date_value=' + year + '&page&_format=csv';
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
  const rows = Utilities.parseCsv(res.getContentText()), h = rows[0].map(function (x) { return String(x).trim(); });
  const map = { '1 Mo': 'y_1m', '3 Mo': 'y_3m', '6 Mo': 'y_6m', '1 Yr': 'y_1y', '2 Yr': 'y_2y', '3 Yr': 'y_3y', '5 Yr': 'y_5y', '7 Yr': 'y_7y', '10 Yr': 'y_10y', '20 Yr': 'y_20y', '30 Yr': 'y_30y' };
  const out = {};
  rows.slice(1).forEach(function (r) {
    const m = String(r[0]).match(/(\d{2})\/(\d{2})\/(\d{4})/); if (!m) return;
    const d = m[3] + '-' + m[1] + '-' + m[2], o = {};
    h.forEach(function (name, j) { if (map[name] && r[j] !== '' && isFinite(Number(r[j]))) o[map[name]] = Number(r[j]); });
    out[d] = o;
  });
  return out;
}
function mc_jgb_() {
  const res = UrlFetchApp.fetch('https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/jgbcme.csv', { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
  const rows = Utilities.parseCsv(res.getContentText()), out = {};
  let col = -1;
  rows.forEach(function (r) {
    if (col < 0) { col = r.map(function (x) { return String(x).trim(); }).indexOf('10Y'); return; }
    const m = String(r[0]).match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/); if (!m || col < 0) return;
    const v = Number(r[col]); if (isFinite(v) && r[col] !== '') out[cal_ymd(+m[1], +m[2], +m[3])] = v;
  });
  return out;
}
/** Weekly CFTC positioning (non-commercial net, % of open interest) for yen, S&P, 10-year, crude, gold. */
function mc_cot_() {
  const codes = { '097741': 'Yen', '13874A': 'E-mini S&P', '043602': '10-year note', '067651': 'WTI crude', '088691': 'Gold' };
  const url = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json?$select=cftc_contract_market_code,report_date_as_yyyy_mm_dd,noncomm_positions_long_all,noncomm_positions_short_all,open_interest_all' +
    '&$where=cftc_contract_market_code%20in(%27' + Object.keys(codes).join('%27,%27') + '%27)&$order=report_date_as_yyyy_mm_dd%20DESC&$limit=300';
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
  const data = JSON.parse(res.getContentText()), out = {};
  data.forEach(function (r) {
    const name = codes[r.cftc_contract_market_code]; if (!name) return;
    const net = Number(r.noncomm_positions_long_all) - Number(r.noncomm_positions_short_all), oi = Number(r.open_interest_all) || 1;
    (out[name] = out[name] || []).push({ date: String(r.report_date_as_yyyy_mm_dd).slice(0, 10), net: net, pct: net / oi });
  });
  const summary = {};
  Object.keys(out).forEach(function (k) {
    const s = out[k], nets = s.map(function (x) { return x.net; }), lo = Math.min.apply(null, nets), hi = Math.max.apply(null, nets);
    summary[k] = { date: s[0].date, net: s[0].net, pct: s[0].pct, chg: s[1] ? s[0].net - s[1].net : 0, rank: hi > lo ? (s[0].net - lo) / (hi - lo) : 0.5 };
  });
  PropertiesService.getScriptProperties().setProperty('MC_COT', JSON.stringify(summary));
  return summary;
}
function mc_fwdPe_() {
  try {
    const rows = db_readAll(df_logSpec_()).rows.filter(function (r) { return Number(r.fwd_pe) > 5; }).sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; });
    return rows.length ? Number(rows[rows.length - 1].fwd_pe) : null;
  } catch (e) { return null; }
}

/* =============================================================================
 * METERS, ALERTS, CORRELATIONS
 * Each meter scores 0 (calm) → 100 (stress): under 35 GREEN, 35–59 YELLOW, 60+ RED.
 * ========================================================================== */
function mc_status_(s) { return s >= 60 ? 'RED' : (s >= 35 ? 'YELLOW' : 'GREEN'); }
function mc_score_(rows, i, P, pe) {
  const r = rows[i], d = String(r.date), p = P.map[d] || {};
  const v = function (k, j) { const x = rows[j] ? rows[j][k] : ''; return x === '' || x === undefined || x === null || !isFinite(Number(x)) ? null : Number(x); };
  const at = function (k, n) { return v(k, i - n); };
  const pct = function (k, n) { const a = v(k, i), b = at(k, n); return a !== null && b ? a / b - 1 : null; };
  const ten = function (j) { const x = v('tnx', j); return x !== null ? x : v('y_10y', j); };
  const two = function (j) { return v('y_2y', j); };
  const M = {}, alerts = [];
  const add = function (key, pts, why) { if (pts > 0) { M[key].s += pts; if (why) M[key].d.push(why); } };
  MC_METERS.forEach(function (m) { M[m[0]] = { s: 0, d: [] }; });
  // ---- rates
  const t0 = ten(i), t5 = ten(i - 5), t1 = ten(i - 1);
  if (t0 !== null && t5 !== null) { const d5 = (t0 - t5) * 100; if (d5 > 10) add('rates', Math.min(35, (d5 - 10) / 25 * 35), '10Y ' + (d5 >= 0 ? '+' : '') + Math.round(d5) + ' bp in 5 days'); }
  const hist = []; for (let j = Math.max(0, i - 250); j <= i; j++) { const x = ten(j); if (x !== null) hist.push(x); }
  if (t0 !== null && hist.length > 60) {
    const rank = hist.filter(function (x) { return x <= t0; }).length / hist.length;
    if (rank >= 0.97) add('rates', 25, '10Y at a 1-year high (' + t0.toFixed(2) + '%)'); else if (rank >= 0.9) add('rates', 15, '10Y in the top 10% of its 1-year range');
  }
  const t30 = v('tyx', i) !== null ? v('tyx', i) : v('y_30y', i);
  if (t30 !== null && t30 >= 5) add('rates', 10, '30Y at ' + t30.toFixed(2) + '%');
  const mv = v('move', i); if (mv !== null) { if (mv >= 130) add('rates', 20, 'MOVE ' + Math.round(mv) + ' (bond volatility high)'); else if (mv >= 110) add('rates', 10, 'MOVE ' + Math.round(mv)); }
  if (t0 !== null && t1 !== null && two(i) !== null && two(i - 1) !== null) {
    const dT = (t0 - t1) * 100, dS = ((t0 - two(i)) - (t1 - two(i - 1))) * 100;
    if (dT >= 5 && dS > 0) add('rates', 10, 'Bear steepening today (10Y +' + Math.round(dT) + ' bp)');
  }
  const peV = typeof pe === 'function' ? pe(d, Number(p.spx_c) || null) : pe;
  const erp = peV && t0 !== null ? 100 / peV - t0 : null;
  if (erp !== null) { if (erp < 0) add('rates', 15, 'Equity risk premium negative (' + erp.toFixed(2) + '%)'); else if (erp < 1) add('rates', 8, 'Equity risk premium thin (' + erp.toFixed(2) + '%)'); }
  // ---- credit
  const hy = v('hy_oas', i), hy20 = at('hy_oas', 20);
  if (hy !== null) {
    if (hy >= 5) add('credit', 30, 'High-yield spread ' + hy.toFixed(2) + '%'); else if (hy >= 4) add('credit', 15, 'High-yield spread ' + hy.toFixed(2) + '%');
    if (hy20 !== null) { const c = (hy - hy20) * 100; if (c > 25) add('credit', Math.min(50, c / 75 * 50), 'HY spread +' + Math.round(c) + ' bp in 20 days'); }
  }
  // ---- dollar / yen carry
  const j5 = pct('usdjpy', 5);
  if (j5 !== null && j5 < -0.01) add('carry', Math.min(40, (-j5 - 0.01) / 0.04 * 40), 'Yen +' + (-j5 * 100).toFixed(1) + '% vs USD in 5 days');
  const vol = function (k, n, end) { const x = []; for (let j = end - n + 1; j <= end; j++) { const a = v(k, j), b = v(k, j - 1); if (a && b) x.push(Math.log(a / b)); } if (x.length < n / 2) return null; const m = x.reduce(function (s, y) { return s + y; }, 0) / x.length; return Math.sqrt(x.reduce(function (s, y) { return s + (y - m) * (y - m); }, 0) / x.length); };
  const v10 = vol('usdjpy', 10, i), v250 = vol('usdjpy', 250, i);
  if (v10 && v250) { const q = v10 / v250; if (q >= 2) add('carry', 30, 'USD/JPY volatility ' + q.toFixed(1) + '× normal'); else if (q >= 1.5) add('carry', 20, 'USD/JPY volatility ' + q.toFixed(1) + '× normal'); }
  const aj = pct('audjpy', 5); if (aj !== null && aj < -0.03) add('carry', 15, 'AUD/JPY ' + (aj * 100).toFixed(1) + '% in 5 days');
  const nk = pct('n225', 1); if (nk !== null && nk <= -0.02) add('carry', nk <= -0.04 ? 25 : 15, 'Nikkei ' + (nk * 100).toFixed(1) + '% today');
  const jg = v('jgb10', i), jg20 = at('jgb10', 20), t20 = ten(i - 20);
  if (jg !== null && jg20 !== null && t0 !== null && t20 !== null) { const sp = ((t0 - jg) - (t20 - jg20)) * 100; if (sp < -30) add('carry', 10, 'US–Japan 10Y spread ' + Math.round(sp) + ' bp in 20 days'); }
  if (MC_BOJ.indexOf(d) > -1) alerts.push(['info', 'Bank of Japan decision today']);
  // ---- oil
  const w1 = pct('wti', 1), w5 = pct('wti', 5), ov = v('ovx', i), br = v('brent', i), wt = v('wti', i);
  if (w5 !== null && Math.abs(w5) > 0.06) add('oil', Math.min(35, (Math.abs(w5) - 0.06) / 0.1 * 35 + 10), 'WTI ' + (w5 >= 0 ? '+' : '') + (w5 * 100).toFixed(1) + '% in 5 days');
  if (w1 !== null && Math.abs(w1) > 0.04) add('oil', 20, 'WTI ' + (w1 >= 0 ? '+' : '') + (w1 * 100).toFixed(1) + '% today');
  if (ov !== null) { if (ov >= 55) add('oil', 35, 'OVX ' + Math.round(ov) + ' (oil volatility extreme)'); else if (ov >= 40) add('oil', 20, 'OVX ' + Math.round(ov)); }
  if (br !== null && wt !== null && br - wt > 6) add('oil', 10, 'Brent–WTI spread $' + (br - wt).toFixed(2));
  // ---- volatility (from _Prices)
  const vix = Number(p.vix_c) || null, vr = Number(p.vix_ratio) || null, pv = P.map[cal_prevTradingDay(d)] || {};
  if (vix) { if (vix >= 30) add('vol', 50, 'VIX ' + vix.toFixed(1)); else if (vix >= 25) add('vol', 35, 'VIX ' + vix.toFixed(1)); else if (vix >= 20) add('vol', 20, 'VIX ' + vix.toFixed(1)); }
  if (vr && vr > 1) add('vol', 25, 'VIX term structure inverted (VIX9D/VIX ' + vr.toFixed(2) + ')');
  if (vix && Number(pv.vix_c) && vix / Number(pv.vix_c) - 1 > 0.15) add('vol', 15, 'VIX +' + Math.round((vix / Number(pv.vix_c) - 1) * 100) + '% today');
  // ---- global
  const idx = ['n225', 'hsi', 'sse', 'kospi', 'asx', 'dax', 'ftse', 'cac', 'sx5e'].map(function (k) { return pct(k, 1); }).filter(function (x) { return x !== null; });
  if (idx.length) {
    const down = idx.filter(function (x) { return x <= -0.01; }).length, avg = idx.reduce(function (a, b) { return a + b; }, 0) / idx.length;
    if (down) add('global', Math.min(48, down * 8), down + ' of ' + idx.length + ' major overseas indices down 1%+');
    if (avg <= -0.01) add('global', 20, 'Overseas average ' + (avg * 100).toFixed(1) + '%');
  }
  // ---- liquidity (Fed balance sheet − Treasury account − reverse repo, $bn)
  const net = function (j) { const a = v('fed_bs', j), b = v('tga', j), c = v('rrp', j); return a !== null && b !== null && c !== null ? a / 1000 - b - c : null; };
  const n0 = net(i), n20 = net(i - 20);
  if (n0 !== null && n20 !== null) { const c = n0 - n20; if (c < -300) add('liq', 50, 'Net liquidity −$' + Math.round(-c) + 'bn in 20 days'); else if (c < -150) add('liq', 30, 'Net liquidity −$' + Math.round(-c) + 'bn in 20 days'); }
  // ---- crypto
  const b1 = pct('btc', 1), b5 = pct('btc', 5);
  if (b1 !== null && b1 <= -0.05) add('crypto', 30, 'Bitcoin ' + (b1 * 100).toFixed(1) + (cal_dow(d) === 1 ? '% since Friday' : '% today'));
  if (b5 !== null && b5 <= -0.1) add('crypto', 30, 'Bitcoin ' + (b5 * 100).toFixed(1) + '% in 5 days');
  // ---- store meters
  MC_METERS.forEach(function (m) { M[m[0]].s = Math.min(100, Math.round(M[m[0]].s)); M[m[0]].st = mc_status_(M[m[0]].s); r['m_' + m[0]] = M[m[0]].s; });
  const wts = { rates: 0.2, credit: 0.15, carry: 0.15, oil: 0.1, vol: 0.2, global: 0.1, liq: 0.05, crypto: 0.05 };
  const comp = Object.keys(wts).reduce(function (a, k) { return a + M[k].s * wts[k]; }, 0) + (MC_METERS.filter(function (m) { return M[m[0]].st === 'RED'; }).length >= 2 ? 15 : 0);
  r.regime = comp >= 60 ? 'Stress' : (comp >= 40 ? 'Risk-off' : (comp >= 20 ? 'Neutral' : 'Risk-on'));
  // ---- threshold alerts
  MC_METERS.forEach(function (m) { if (M[m[0]].st !== 'GREEN') alerts.push([M[m[0]].st === 'RED' ? 'red' : 'yellow', m[1].toUpperCase() + ' ' + M[m[0]].st + ': ' + M[m[0]].d.slice(0, 2).join(' · ')]); });
  if (t0 !== null && t1 !== null && t0 >= 5 && t1 < 5) alerts.push(['red', '10Y crossed above 5.00% (' + t0.toFixed(2) + '%)']);
  const s0 = t0 !== null && two(i) !== null ? t0 - two(i) : null, s1 = t1 !== null && two(i - 1) !== null ? t1 - two(i - 1) : null;
  if (s0 !== null && s1 !== null && (s0 >= 0) !== (s1 >= 0)) alerts.push(['yellow', '2s10s ' + (s0 >= 0 ? 'un-inverted' : 'inverted') + ' (' + Math.round(s0 * 100) + ' bp)']);
  const hi52 = function (k) { let hi = -Infinity; for (let j = Math.max(0, i - 250); j < i; j++) { const x = v(k, j); if (x !== null && x > hi) hi = x; } return v(k, i) !== null && v(k, i) > hi && hi > -Infinity; };
  if (hi52('dxy')) alerts.push(['yellow', 'Dollar index at a 1-year high']);
  if (hi52('gold')) alerts.push(['info', 'Gold at a 1-year high']);
  const u1 = pct('usdjpy', 1); if (u1 !== null && Math.abs(u1) >= 0.01) alerts.push([Math.abs(u1) >= 0.02 ? 'red' : 'yellow', 'USD/JPY ' + (u1 >= 0 ? '+' : '') + (u1 * 100).toFixed(1) + '% today']);
  if (b1 !== null && Math.abs(b1) >= 0.05 && b1 > 0) alerts.push(['info', 'Bitcoin +' + (b1 * 100).toFixed(1) + '%']);
  const order = { red: 0, yellow: 1, info: 2 };
  alerts.sort(function (a, b) { return order[a[0]] - order[b[0]]; });
  // ---- what is driving SPX (20-day correlations)
  const corr = {};
  [['ten', function (j) { const a = ten(j), b = ten(j - 1); return a !== null && b !== null ? (a - b) * 100 : null; }, '10Y yield'], ['dxy', function (j) { const a = v('dxy', j), b = v('dxy', j - 1); return a && b ? a / b - 1 : null; }, 'Dollar'],
   ['wti', function (j) { const a = v('wti', j), b = v('wti', j - 1); return a && b ? a / b - 1 : null; }, 'Oil'], ['usdjpy', function (j) { const a = v('usdjpy', j), b = v('usdjpy', j - 1); return a && b ? a / b - 1 : null; }, 'USD/JPY']]
    .forEach(function (c) {
      const xs = [], ys = [];
      for (let j = i - 19; j <= i; j++) { const pr = P.map[String(rows[j] ? rows[j].date : '')]; const x = c[1](j); if (pr && pr.pct1 !== '' && x !== null) { xs.push(x); ys.push(Number(pr.pct1)); } }
      corr[c[0]] = xs.length >= 12 ? Math.round(mc_corr_(xs, ys) * 100) / 100 : '';
    });
  r.corr = JSON.stringify(corr);
  r.alerts = JSON.stringify({ meters: M, alerts: alerts.slice(0, 8), erp: erp, comp: Math.round(comp) });
}
function mc_corr_(x, y) {
  const n = x.length, mx = x.reduce(function (a, b) { return a + b; }, 0) / n, my = y.reduce(function (a, b) { return a + b; }, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let k = 0; k < n; k++) { sxy += (x[k] - mx) * (y[k] - my); sxx += (x[k] - mx) * (x[k] - mx); syy += (y[k] - my) * (y[k] - my); }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}


/* =============================================================================
 * FORWARD P/E — two automatic sources
 *   FactSet (weekly): "The forward 12-month P/E ratio for the S&P 500 is 22.4" from FactSet Insight
 *   S&P DJI (daily):  the S&P close ÷ the next four quarters of operating EPS estimates published by
 *                     S&P Dow Jones Indices (sp-500-eps-est.xlsx, updated weekly)
 * The equity risk premium uses the average of the two (or whichever is available).
 * ========================================================================== */
function mc_peStore_() { if (_MC.pe) return _MC.pe; try { _MC.pe = JSON.parse(PropertiesService.getScriptProperties().getProperty('MC_PE') || '{}'); } catch (e) { _MC.pe = {}; } return _MC.pe; }
function mc_peUpdate_() {
  const st = mc_peStore_(); st.fs = st.fs || []; st.sp = st.sp || [];
  const today = cal_today(), log = [];
  // FactSet's weekly forward P/E from your GitHub relay (pe.json) — FactSet blocks Google's servers but answers GitHub
  try {
    const R = mc_peRelay_();
    if (R && R.value) {
      if (!st.fs.length || st.fs[st.fs.length - 1][1] !== R.value || st.fs[st.fs.length - 1][0] < R.date) { st.fs = st.fs.filter(function (x) { return x[0] < R.date; }); st.fs.push([R.date, R.value]); }
      log.push('FactSet ✓ ' + R.value + ' (report of ' + R.date + ', via the relay)' + (R.age > 10 ? ' ⚠ ' + R.age + ' days old' : ''));
    } else log.push('FactSet ✗ relay has no value yet' + (R && R.why ? ' (' + R.why + ')' : ''));
  } catch (e) { log.push('FactSet ✗ ' + e.message); }
  // S&P DJI (403) and Yahoo (401) refuse Google's servers, so they are not tried; the second row is FactSet-based (daily)
  const man = Number(core_getSetting('Fwd P/E — FactSet (manual, weekly)', ''));
  if (!log.some(function (x) { return /FactSet ✓/.test(x); }) && man > 5 && man < 60) {
    if (!st.fs.length || st.fs[st.fs.length - 1][1] !== man) st.fs.push([today, man]);
    log.push('using your Settings value ' + man);
  }
  st.fs = st.fs.slice(-110); st.sp = st.sp.slice(-110); st.checked = today;
  PropertiesService.getScriptProperties().setProperty('MC_PE', JSON.stringify(st)); _MC.pe = st;
  return log;
}
function mc_peFactSet_() {
  const ua = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' };
  const re = /forward 12-month P\/E ratio (?:for the S&(?:amp;)?P 500 )?is (\d{1,2}\.\d)/i;
  try {                                                                       // FactSet Insight's RSS feed: find the latest post that states the forward P/E
    const rss = UrlFetchApp.fetch('https://insight.factset.com/rss.xml', { muteHttpExceptions: true, headers: ua });
    if (rss.getResponseCode() === 200) {
      const txt = rss.getContentText().replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/<[^>]+>/g, ' ');
      const m1 = txt.match(re); if (m1) return Number(m1[1]);
      const links = (rss.getContentText().match(/<link>(https:\/\/insight\.factset\.com\/[^<]+)<\/link>/g) || []).map(function (x) { return x.replace(/<\/?link>/g, ''); })
        .filter(function (u) { return /s-?p-?500|earnings/i.test(u); }).slice(0, 5);
      for (let i = 0; i < links.length; i++) { const r2 = UrlFetchApp.fetch(links[i], { muteHttpExceptions: true, headers: ua }); if (r2.getResponseCode() === 200) { const m2 = r2.getContentText().match(re); if (m2) return Number(m2[1]); } }
    }
  } catch (e) { /* fall back to the topic page below */ }
  const list = UrlFetchApp.fetch('https://insight.factset.com/topic/earnings', { muteHttpExceptions: true, headers: ua });
  if (list.getResponseCode() !== 200) throw new Error('FactSet page returned HTTP ' + list.getResponseCode());
  const html = list.getContentText(), m0 = html.match(re); if (m0) return Number(m0[1]);
  const links = (html.match(/href="(https:\/\/insight\.factset\.com)?\/[a-z0-9\-]+"/gi) || []).map(function (h) { return 'https://insight.factset.com' + h.replace(/^href="(https:\/\/insight\.factset\.com)?/i, '').replace(/"$/, ''); })
    .filter(function (u, i, a) { return a.indexOf(u) === i && /s-?p-?500|earnings-insight|earnings-season|forward|p-e/i.test(u); }).slice(0, 6);
  for (let i = 0; i < links.length; i++) {
    const r = UrlFetchApp.fetch(links[i], { muteHttpExceptions: true, headers: ua });
    if (r.getResponseCode() !== 200) continue;
    const m = r.getContentText().match(re); if (m) return Number(m[1]);
  }
  return null;
}
/** Next four quarters of S&P 500 operating EPS estimates from S&P DJI's public spreadsheet. */
function mc_epsSpdji_() {
  const res = UrlFetchApp.fetch('https://www.spglobal.com/spdji/en/documents/additional-material/sp-500-eps-est.xlsx', { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*', 'Accept-Language': 'en-US,en;q=0.9' } });
  if (res.getResponseCode() !== 200) throw new Error('S&P DJI file returned HTTP ' + res.getResponseCode());
  if (!/zip|spreadsheet|octet/i.test(String(res.getHeaders()['Content-Type'] || res.getBlob().getContentType()))) throw new Error('S&P DJI returned a web page instead of the spreadsheet (blocked or moved)');
  const files = Utilities.unzip(res.getBlob().setContentType('application/zip')), byName = {};
  files.forEach(function (f) { byName[f.getName()] = f; });
  const shared = [];
  if (byName['xl/sharedStrings.xml']) {
    const root = XmlService.parse(byName['xl/sharedStrings.xml'].getDataAsString()).getRootElement(), ns = root.getNamespace();
    root.getChildren('si', ns).forEach(function (si) { let t = ''; si.getDescendants().forEach(function (d) { if (d.getType() === XmlService.ContentTypes.TEXT) t += d.getText(); }); shared.push(t); });
  }
  const sheet = byName['xl/worksheets/sheet1.xml']; if (!sheet) throw new Error('no worksheet');
  const root = XmlService.parse(sheet.getDataAsString()).getRootElement(), ns = root.getNamespace();
  const rows = [];
  root.getChild('sheetData', ns).getChildren('row', ns).forEach(function (row) {
    const cells = {};
    row.getChildren('c', ns).forEach(function (c) {
      const ref = c.getAttribute('r').getValue(), col = ref.replace(/\d+/g, ''), v = c.getChild('v', ns); if (!v) return;
      cells[col] = c.getAttribute('t') && c.getAttribute('t').getValue() === 's' ? shared[Number(v.getText())] : v.getText();
    });
    rows.push(cells);
  });
  let opCol = null;
  rows.some(function (c) { return Object.keys(c).some(function (k) { const t = String(c[k]); if (/OPERATING/i.test(t) && /EARN|EPS/i.test(t) && /SH/i.test(t)) { opCol = k; return true; } return false; }); });
  if (!opCol) throw new Error('operating EPS column not found');
  const toDate = function (x) {
    if (/^\d{5}(\.\d+)?$/.test(String(x))) return Utilities.formatDate(new Date(Date.UTC(1899, 11, 30) + Number(x) * 86400000), 'UTC', 'yyyy-MM-dd');
    const m = String(x).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? cal_ymd(+m[3], +m[1], +m[2]) : null;
  };
  const q = [];
  rows.forEach(function (c) { const d = toDate(c.A), v = Number(c[opCol]); if (d && isFinite(v) && v > 0 && v < 200) q.push([d, v]); });
  const future = q.filter(function (x) { return x[0] > cal_today(); }).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; })
    .filter(function (x, i, a) { return i === 0 || x[0] !== a[i - 1][0]; }).slice(0, 4);
  if (future.length < 4) throw new Error('only ' + future.length + ' future quarters found');
  return Math.round(future.reduce(function (s0, x) { return s0 + x[1]; }, 0) * 100) / 100;
}
/** Reads pe.json from the GitHub relay (address on Settings, or next to calendar.json). */
function mc_peRelay_() {
  let url = String(core_getSetting('P/E relay (GitHub raw URL)', '') || '').trim();
  if (!url) url = String(core_getSetting('Calendar relay (GitHub raw URL)', '') || '').trim().replace(/calendar\.json$/, 'pe.json');
  if (!url) return { why: 'no relay address on Settings' };
  const res = UrlFetchApp.fetch(url + (url.indexOf('?') > -1 ? '&' : '?') + 't=' + Date.now(), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return { why: 'relay HTTP ' + res.getResponseCode() };
  const j = JSON.parse(res.getContentText()), f = j.factset || {};
  if (!f.value) return { why: (j.errors && j.errors.factset) || 'no FactSet value' };
  const rep = (String(f.source || '').match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || String(f.as_of || '').slice(0, 10);
  const age = Math.round((Date.now() - new Date(rep + 'T12:00:00Z').getTime()) / 864e5);
  PropertiesService.getScriptProperties().setProperty('MC_PE_RELAY', JSON.stringify({ date: rep, value: Number(f.value), age: age, at: Date.now() }));
  return { value: Number(f.value), date: rep, age: age };
}
/** Health: warns when FactSet's weekly P/E is more than 10 days old (it is published every week). */
function mc_peAlerts_() {
  let s = null; try { s = JSON.parse(PropertiesService.getScriptProperties().getProperty('MC_PE_RELAY') || 'null'); } catch (e) { s = null; }
  if (!s) return [];
  const age = Math.round((Date.now() - new Date(s.date + 'T12:00:00Z').getTime()) / 864e5);
  return age > 10 ? [['yellow', 'Forward P/E is ' + age + ' days old (FactSet report of ' + s.date + ') — check the relay\'s "Update forward P/E" run on GitHub']] : [];
}
/** Both P/E values as known on day d (px = that day's S&P close) and their average. */
function mc_peFor_(d, px) {
  const st = mc_peStore_(), pick = function (arr) { let v = null; (arr || []).forEach(function (x) { if (x[0] <= d) v = x; }); return v; };
  const fs = pick(st.fs), sp = pick(st.sp);
  const fsV = fs ? Number(fs[1]) : null;
  let spV = sp && px ? px / Number(sp[1]) : null, src = 'S&P DJI', eps = sp ? Number(sp[1]) : null;
  if (spV === null && fs && px) {                                            // fallback: FactSet's forward EPS (its P/E ÷ the S&P close that day) with today's close
    if (!_MC.P) _MC.P = in_prices_();
    const pr = _MC.P.map[fs[0]] || _MC.P.map[cal_prevTradingDay(fs[0])];
    if (pr && Number(pr.spx_c)) { eps = Number(pr.spx_c) / fsV; spV = px / eps; src = 'FactSet-based'; }
  }
  let manual = null;
  if (fsV === null && spV === null) { try { manual = mc_fwdPe_(); } catch (e) { manual = null; } }
  const vals = [fsV, spV].filter(function (x) { return x !== null && isFinite(x); });
  return { fs: fsV, fsDate: fs ? fs[0] : '', fsPrev: (function () { const a = (st.fs || []).filter(function (x) { return x[0] <= d; }); return a.length > 1 ? Number(a[a.length - 2][1]) : null; })(),
    sp: spV, eps: eps, src: src, avg: src === 'FactSet-based' && spV !== null ? spV : (vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : manual) };
}

/* ---------- reading helpers ---------- */
const _MC = { rows: null, pe: null, P: null };
function mc_rows_() { if (!_MC.rows) _MC.rows = db_sheet_(mc_spec_()) ? db_readAll(mc_spec_()).rows.sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; }) : []; return _MC.rows; }
/** The macro row for day k (or the latest before it, for future days) and its index. */
function mc_day_(k) {
  const rows = mc_rows_(); let i = -1;
  for (let j = rows.length - 1; j >= 0; j--) if (String(rows[j].date) <= k) { i = j; break; }
  if (i < 0) return null;
  let info = {}; try { info = JSON.parse(rows[i].alerts || '{}'); } catch (e) { /* none */ }
  let corr = {}; try { corr = JSON.parse(rows[i].corr || '{}'); } catch (e) { /* none */ }
  return { i: i, row: rows[i], rows: rows, info: info, corr: corr, asOf: String(rows[i].date) };
}
function mc_val_(rows, i, k) { const x = rows[i] ? rows[i][k] : ''; return x === '' || x === undefined || x === null || !isFinite(Number(x)) ? null : Number(x); }
function mc_chg_(rows, i, k, n, bp) { const a = mc_val_(rows, i, k), b = mc_val_(rows, i - n, k); if (a === null || b === null) return ''; return bp ? (a - b) * 100 : (b ? a / b - 1 : ''); }
function mc_label_(k) { const s = MC_SYM.filter(function (x) { return x[0] === k; })[0]; return s ? s[2] : k; }
function mc_color_(st) { return st === 'RED' ? [COLOR.ERRBG, COLOR.RED] : (st === 'YELLOW' ? [COLOR.INP, COLOR.INPF] : [COLOR.OKBG, COLOR.GRN]); }
function mc_ten_(rows, i) { const a = mc_val_(rows, i, 'tnx'); return a !== null ? a : mc_val_(rows, i, 'y_10y'); }

/* =============================================================================
 * HUB TABS
 * ========================================================================== */
const MC_TITLES = {
  'Macro Radar': ['MACRO RADAR  —  the whole market in one view', 'Eight stress meters (0 calm → 100 stress), the day\'s risk regime, what matters today, and what is driving the S&P. Updated each morning and at the close.'],
  'Yield Curve': ['YIELD CURVE  —  rates, spreads and the stock/bond trade-off', 'Official U.S. Treasury curve (1-month to 30-year), key spreads, real yields and breakevens, term premium, bond volatility (MOVE) and the equity risk premium.'],
  'FX & Carry': ['FX & CARRY  —  the dollar, the yen and the carry trade', 'Major currencies, carry-trade stress (yen speed, volatility, AUD/JPY, Nikkei, US–Japan spread), Japan and weekly positioning from the CFTC.'],
  'Global Markets': ['GLOBAL MARKETS  —  Asia, Europe and emerging markets', 'What happened overnight before the U.S. open, and the last 10 sessions at a glance.'],
  'Commodities & Crypto': ['COMMODITIES, CRYPTO & SECTORS', 'Oil (WTI, Brent, OVX), gold, silver, copper, natural gas, Bitcoin, Ethereum, and the 11 sectors plus semis, small caps, equal-weight, regional banks, high yield and long Treasuries.']
};
function mc_layout_(name) {
  const sh = ui_sheet(name, name === 'Macro Radar' ? COLOR.TAB_MAIN : COLOR.TAB_CAT, false);
  for (let c = 2; c <= 17; c++) ui_width(sh, c, 11.5);
  ui_title(sh, 2, 2, 17, MC_TITLES[name][0]);
  ui_box(sh, 3, 2, 3, 17, MC_TITLES[name][1], { bg: COLOR.LAB, fc: COLOR.LABF, size: 9, italic: true, h: 'left', wrap: true });
  sh.setRowHeight(3, 30);
  ui_box(sh, 5, 2, 5, 9, '', { fc: COLOR.GRAY, size: 9, italic: true, h: 'left' });
  if (['Yield Curve', 'FX & Carry', 'Commodities & Crypto'].indexOf(name) > -1) {
    ui_label(sh, 5, 12, 13, 'Chart range ▾'); ui_input(sh, 5, 14, 15, '1Y', { h: 'center' });
    sh.getRange(5, 14).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['1M', '3M', '1Y', '2Y'], true).build());
  }
  sh.setFrozenRows(5);
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  const cd = SpreadsheetApp.getActive().getSheetByName('_MacroCharts');
  const line = function (a1, title, row, col, opts) {
    let b = sh.newChart().setChartType(Charts.ChartType.LINE).addRange(cd.getRange(a1)).setNumHeaders(1).setPosition(row, col, 0, 0)
      .setOption('title', title).setOption('legend', { position: 'bottom' }).setOption('width', 640).setOption('height', 300).setOption('fontName', FONT).setOption('lineWidth', 1.6);
    Object.keys(opts || {}).forEach(function (k) { b = b.setOption(k, opts[k]); });
    sh.insertChart(b.build());
  };
  if (name === 'Yield Curve') {
    line('A1:E12', 'Yield curve: today vs 1 week, 1 month, 1 year ago', 33, 2, { colors: ['#1F2A44', '#0F6E56', '#BA7517', '#B4B2A9'], pointSize: 4 });
    line('G1:J600', '2Y · 10Y · 30Y yields (%)', 33, 10, { colors: ['#0F6E56', '#1F2A44', '#B42318'] });
    line('L1:N600', 'Curve spreads (bp): 2s10s and 3m10y', 51, 2, { colors: ['#1F2A44', '#BA7517'] });
    line('P1:R600', 'S&P 500 vs 10Y yield', 51, 10, { colors: ['#1F2A44', '#B42318'], series: { 1: { targetAxisIndex: 1 } }, vAxes: { 0: { title: 'SPX' }, 1: { title: '10Y %' } } });
  }
  if (name === 'FX & Carry') {
    line('T1:V600', 'USD/JPY vs Dollar index', 37, 2, { colors: ['#B42318', '#1F2A44'], series: { 1: { targetAxisIndex: 1 } } });
    line('X1:Y600', 'AUD/JPY (carry-trade barometer)', 37, 10, { colors: ['#BA7517'] });
  }
  if (name === 'Commodities & Crypto') {
    line('Z1:AB600', 'WTI and Brent crude ($)', 49, 2, { colors: ['#1F2A44', '#BA7517'] });
    line('AD1:AE600', 'Gold ($)', 49, 10, { colors: ['#BA7517'] });
    line('AG1:AH600', 'Bitcoin ($)', 67, 2, { colors: ['#534AB7'] });
    line('AJ1:AL600', 'Copper/gold ratio vs 10Y yield', 67, 10, { colors: ['#0F6E56', '#1F2A44'], series: { 1: { targetAxisIndex: 1 } } });
  }
}
function mc_onEdit(e) {
  if (!e || !e.range) return;
  const n = e.range.getSheet().getName();
  if (MC_TABS.indexOf(n) > -1 && e.range.getRow() === 5 && e.range.getColumn() === 14) mc_renderCharts_(n);
}
function mc_renderAll_() {
  _MC.rows = null;
  const D = mc_day_(cal_today()); if (!D) return;
  const R = { 'Macro Radar': mc_renderRadar_, 'Yield Curve': mc_renderCurve_, 'FX & Carry': mc_renderFx_, 'Global Markets': mc_renderGlobal_, 'Commodities & Crypto': mc_renderCommod_ };
  MC_TABS.forEach(function (t) {
    const sh = SpreadsheetApp.getActive().getSheetByName(t); if (!sh) return;
    try {
      const body = sh.getRange(7, 1, Math.max(1, sh.getMaxRows() - 6), Math.max(17, sh.getMaxColumns())); body.breakApart(); body.clear();
      sh.getRange(5, 2).setValue('As of ' + cal_pretty(D.asOf) + '  ·  updated ' + (D.rows[D.rows.length - 1].updated || ''));
      R[t](sh, D); mc_renderCharts_(t);
    } catch (e) { core_logError_('mc render ' + t, e); }
  });
}
function mc_hdr_(sh, r, text) { ui_header(sh, r, 2, 17, text); }
function mc_table_(sh, r, head, rows, widths) {
  ui_sub(sh, r, head.map(function (h, i) { const c = 2 + (widths ? widths.slice(0, i).reduce(function (a, b) { return a + b; }, 0) : i); return [c, c + (widths ? widths[i] - 1 : 0), h]; }));
  if (!rows.length) return r + 1;
  const full = rows.map(function (row) {
    const out = [];
    row.forEach(function (cell, i) { out.push(cell); for (let k = 1; k < (widths ? widths[i] : 1); k++) out.push(''); });
    return out;
  });
  TW_(sh, r + 1, 2, full, { size: 9 });
  if (widths) rows.forEach(function (row, j) { let c = 2; widths.forEach(function (w) { if (w > 1) sh.getRange(r + 1 + j, c, 1, w).merge(); c += w; }); });
  return r + 1 + rows.length;
}
function mc_pc_(v) { return { v: v, nf: '+0.00%;-0.00%;0.00%', fc: df_pn_(v), bg: df_heat_(v === '' ? '' : v * 100, 3) }; }
function mc_bp_(v) { return { v: v === '' ? '' : Math.round(v), nf: '+0" bp";-0" bp";0" bp"', fc: v === '' ? COLOR.TEXT : (v > 0 ? COLOR.RED : COLOR.GRN) }; }

function mc_renderRadar_(sh, D) {
  const info = D.info, M = info.meters || {}, rg = D.row.regime || '—';
  const rc = rg === 'Stress' ? [COLOR.RED, COLOR.WHITE] : (rg === 'Risk-off' ? [COLOR.ERRBG, COLOR.RED] : (rg === 'Neutral' ? [COLOR.INP, COLOR.INPF] : [COLOR.OKBG, COLOR.GRN]));
  mc_hdr_(sh, 7, 'RISK REGIME  —  ' + cal_pretty(D.asOf));
  ui_box(sh, 8, 2, 8, 5, rg.toUpperCase(), { bg: rc[0], fc: rc[1], bold: true, size: 14 });
  ui_box(sh, 8, 6, 8, 17, 'Composite ' + (info.comp !== undefined ? info.comp : '—') + ' / 100  ·  ' + MC_METERS.filter(function (m) { return M[m[0]] && M[m[0]].st === 'RED'; }).length + ' red · ' +
    MC_METERS.filter(function (m) { return M[m[0]] && M[m[0]].st === 'YELLOW'; }).length + ' yellow meters' + (info.erp !== null && info.erp !== undefined ? '  ·  equity risk premium ' + info.erp.toFixed(2) + '%' : ''), { h: 'left', size: 10, bold: true });
  sh.setRowHeight(8, 32);
  mc_hdr_(sh, 10, 'STRESS METERS  (0 calm → 100 stress · under 35 green, 35–59 yellow, 60+ red)');
  mc_table_(sh, 11, ['Meter', 'Score', 'Gauge', 'Status', 'What is driving it'], MC_METERS.map(function (m) {
    const x = M[m[0]] || { s: 0, st: 'GREEN', d: [] }, c = mc_color_(x.st);
    return [{ v: m[1], b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }, { v: x.s, b: true }, { v: '█'.repeat(Math.round(x.s / 10)) + '░'.repeat(10 - Math.round(x.s / 10)), fc: c[1], h: 'left' },
      { v: '● ' + x.st, bg: c[0], fc: c[1], b: true }, { v: x.d.length ? x.d.join(' · ') : 'Calm', h: 'left', fc: x.d.length ? COLOR.TEXT : COLOR.GRAY }];
  }), [2, 1, 2, 2, 9]);
  mc_hdr_(sh, 21, 'WHAT MATTERS TODAY  (automatic, most severe first)');
  const al = (info.alerts || []).concat(mc_eventAlerts_(D.asOf));
  const ar = al.length ? al.slice(0, 8).map(function (a) { const c = a[0] === 'red' ? mc_color_('RED') : (a[0] === 'yellow' ? mc_color_('YELLOW') : [COLOR.PUR, COLOR.PURF]); return [{ v: a[0] === 'red' ? '▲ RED' : (a[0] === 'yellow' ? '▲ WATCH' : '● INFO'), bg: c[0], fc: c[1], b: true }, { v: a[1], h: 'left', b: a[0] === 'red' }]; })
    : [[{ v: '● CALM', bg: COLOR.OKBG, fc: COLOR.GRN, b: true }, { v: 'No macro alerts — every meter is green.', h: 'left' }]];
  mc_table_(sh, 22, ['Level', 'Alert'], ar, [2, 14]);
  mc_hdr_(sh, 32, 'WHAT IS DRIVING THE S&P  (20-day correlation of daily moves)');
  const cr = [['ten', '10Y yield change', 'Negative = stocks falling when yields rise (trading off rates)'], ['dxy', 'Dollar index', 'Negative = a stronger dollar is hurting stocks'], ['wti', 'WTI crude', 'Negative = oil spikes are hurting stocks'], ['usdjpy', 'USD/JPY', 'Positive = yen strength (carry unwind) is hurting stocks']];
  mc_table_(sh, 33, ['Driver', 'Correlation', 'Strength', 'How to read it'], cr.map(function (c) {
    const v = D.corr[c[0]], a = v === '' || v === undefined ? null : Math.abs(v);
    return [{ v: c[1], b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }, { v: v === undefined ? '' : v, nf: '+0.00;-0.00', b: true, fc: df_pn_(v) }, a === null ? '—' : (a >= 0.6 ? 'Strong' : (a >= 0.35 ? 'Moderate' : 'Weak')), { v: c[2], h: 'left', fc: COLOR.GRAY }];
  }), [3, 2, 2, 9]);
  mc_hdr_(sh, 39, 'METER HISTORY  —  last 20 trading days');
  const rows = D.rows.slice(Math.max(0, D.i - 19), D.i + 1);
  const head = [{ v: 'Meter', b: true, bg: COLOR.SUB, fc: COLOR.WHITE }].concat(rows.map(function (r) { return { v: cal_short(String(r.date)).replace(/^\w+ /, ''), bg: COLOR.SUB, fc: COLOR.WHITE, b: true }; }));
  const body = MC_METERS.map(function (m) { return [{ v: m[1], b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }].concat(rows.map(function (r) { const s = Number(r['m_' + m[0]]) || 0, c = mc_color_(mc_status_(s)); return { v: s, bg: c[0], fc: c[1] }; })); });
  body.push([{ v: 'Regime', b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }].concat(rows.map(function (r) { return { v: String(r.regime || '').replace('Risk-', ''), fc: r.regime === 'Risk-on' ? COLOR.GRN : (r.regime === 'Neutral' ? COLOR.INPF : COLOR.RED), b: true }; })));
  const pad = function (row) { while (row.length < 21) row.push(''); return row.slice(0, 21); };
  TW_(sh, 40, 2, [head].concat(body).map(pad), { size: 8 });
  for (let c = 18; c <= 22; c++) ui_width(sh, c, 6);
}
function mc_eventAlerts_(k) {
  const out = [];
  if (core_fnExists_('cat_eventsForDay')) {
    try {
      cat_eventsForDay(k).filter(function (e) { return e.kind !== 'Headline' && e.importance === '★★★'; }).forEach(function (e) { out.push(['info', 'Today: ' + e.name + (e.t ? ' at ' + md_ampm_(e.t) : '') + (e.previous ? ' (previous ' + e.previous + ')' : '')]); });
      const E = cat_earningsForDay(k); E.upcoming.filter(function (x) { return String(x.date) <= cal_nextTradingDay(k); }).forEach(function (x) { out.push(['info', x.ticker + ' reports ' + cal_short(String(x.date)) + (x.timing ? ' ' + x.timing.toLowerCase() : '')]); });
      const man = {}; CAT_EVENTS.forEach(function (e) { man[e[0]] = !e[7].fred && !e[7].term && !e[7].fomc && !e[7].rss; });
      const need = cat_eventsForDay(k).filter(function (e) { return man[e.key] && e.kind !== 'Headline' && !e.actual; });
      if (need.length) out.push(['yellow', 'Type today\'s actual' + (need.length > 1 ? 's' : '') + ' (Events & Earnings tab or the Report): ' + need.map(function (e) { return e.name + (e.t ? ' ' + md_ampm_(e.t) : ''); }).join(', ')]);
    } catch (e) { /* ignore */ }
  }
  if (MC_BOJ.indexOf(cal_nextTradingDay(k)) > -1) out.push(['info', 'Bank of Japan decision next session']);
  if (core_fnExists_('cv_alerts_')) { try { cv_alerts_(k).forEach(function (a) { out.push(a); }); } catch (e) { /* none */ } }
  if (core_fnExists_('cat_healthAlerts_')) { try { cat_healthAlerts_().forEach(function (a) { out.push(a); }); } catch (e) { /* none */ } }
  try { mc_peAlerts_().forEach(function (a) { out.push(a); }); } catch (e) { /* none */ }
  try { const fc = JSON.parse(PropertiesService.getScriptProperties().getProperty('FOMC_CHANGE') || 'null'); if (fc && fc.at >= cal_add(k, -7)) out.push(['info', fc.text]); } catch (e) { /* none */ }
  return out;
}
function mc_renderCurve_(sh, D) {
  const rows = D.rows, i = D.i;
  mc_hdr_(sh, 7, 'TODAY\'S CURVE  —  official U.S. Treasury yields (%)');
  mc_table_(sh, 8, ['Maturity', 'Today', '1 week ago', '1 month ago', '1 year ago', 'Δ 1 week', 'Δ 1 month', 'Δ 1 year'], MC_CURVE.map(function (m) {
    const g = function (n) { return mc_val_(rows, i - n, m[1]); };
    return [{ v: m[0], b: true, bg: COLOR.LAB, fc: COLOR.LABF }, { v: g(0), nf: '0.00', b: true }, { v: g(5), nf: '0.00' }, { v: g(21), nf: '0.00' }, { v: g(252), nf: '0.00', fc: COLOR.HISF, bg: COLOR.HIS },
      mc_bp_(mc_chg_(rows, i, m[1], 5, true)), mc_bp_(mc_chg_(rows, i, m[1], 21, true)), mc_bp_(mc_chg_(rows, i, m[1], 252, true))];
  }), [2, 2, 2, 2, 2, 2, 2, 2]);
  const t0 = mc_ten_(rows, i), y2 = mc_val_(rows, i, 'y_2y'), y3m = mc_val_(rows, i, 'y_3m'), y5 = mc_val_(rows, i, 'y_5y'), y30 = mc_val_(rows, i, 'y_30y');
  const t1 = mc_ten_(rows, i - 1), y2p = mc_val_(rows, i - 1, 'y_2y');
  let shape = '—';
  if (t0 !== null && t1 !== null && y2 !== null && y2p !== null) { const dT = t0 - t1, d2 = y2 - y2p, steep = (t0 - y2) - (t1 - y2p); shape = (Math.abs(dT) < 0.01 && Math.abs(d2) < 0.01) ? 'Unchanged' : ((dT + d2) / 2 > 0 ? 'Bear ' : 'Bull ') + (steep > 0 ? 'steepening' : 'flattening'); }
  const M = (D.info.meters || {}).rates || { s: 0, st: 'GREEN', d: [] }, c = mc_color_(M.st);
  mc_hdr_(sh, 21, 'KEY RATES, SPREADS & THE STOCK / BOND TRADE-OFF');
  const kv = [['2s10s spread', t0 !== null && y2 !== null ? Math.round((t0 - y2) * 100) + ' bp' : '—'], ['3m10y spread (recession signal)', t0 !== null && y3m !== null ? Math.round((t0 - y3m) * 100) + ' bp' : '—'],
    ['5s30s spread', y30 !== null && y5 !== null ? Math.round((y30 - y5) * 100) + ' bp' : '—'], ['Curve today', shape], ['10Y real yield (TIPS)', mc_val_(rows, i, 'real10') !== null ? mc_val_(rows, i, 'real10').toFixed(2) + '%' : '—'],
    ['10Y breakeven inflation', mc_val_(rows, i, 'be10') !== null ? mc_val_(rows, i, 'be10').toFixed(2) + '%' : '—'], ['10Y term premium (Kim-Wright, lagged)', mc_val_(rows, i, 'termprem') !== null ? mc_val_(rows, i, 'termprem').toFixed(2) + '%' : '—'],
    ['MOVE (bond volatility)', mc_val_(rows, i, 'move') !== null ? Math.round(mc_val_(rows, i, 'move')) : '—'], ['10Y change: 5 days / 20 days', mc_bpTxt_(mc_chg_(rows, i, 'tnx', 5, true)) + ' / ' + mc_bpTxt_(mc_chg_(rows, i, 'tnx', 20, true))],
    ['Equity risk premium (fwd earnings yield − 10Y)', D.info.erp !== null && D.info.erp !== undefined ? D.info.erp.toFixed(2) + '%' + (D.info.erp < 0 ? '  (stocks yield less than bonds)' : '') : 'Enter the weekly forward P/E on your Report'],
    ['High-yield / investment-grade spreads', (mc_val_(rows, i, 'hy_oas') !== null ? mc_val_(rows, i, 'hy_oas').toFixed(2) + '%' : '—') + ' / ' + (mc_val_(rows, i, 'ig_oas') !== null ? mc_val_(rows, i, 'ig_oas').toFixed(2) + '%' : '—')],
    ['Rates stress meter', M.s + ' · ' + M.st + (M.d.length ? ' — ' + M.d.join(' · ') : '')]];
  kv.forEach(function (x, j) { const r = 22 + Math.floor(j / 2), c0 = j % 2 ? 10 : 2; ui_label(sh, r, c0, c0 + 3, x[0]); ui_auto(sh, r, c0 + 4, c0 + 7, x[1], { bold: true, size: 9, h: 'left', color: x[0] === 'Rates stress meter' ? c[1] : COLOR.TEXT }); });
  mc_hdr_(sh, 32, mc_chartsLabel_(sh));
}
function mc_bpTxt_(v) { return v === '' ? '—' : (v >= 0 ? '+' : '') + Math.round(v) + ' bp'; }
function mc_rangePos_(rows, i, k) {
  let lo = Infinity, hi = -Infinity; for (let j = Math.max(0, i - 251); j <= i; j++) { const x = mc_val_(rows, j, k); if (x !== null) { lo = Math.min(lo, x); hi = Math.max(hi, x); } }
  const x = mc_val_(rows, i, k); return { lo: lo === Infinity ? '' : lo, hi: hi === -Infinity ? '' : hi, pos: x !== null && hi > lo ? (x - lo) / (hi - lo) : '' };
}
function mc_renderFx_(sh, D) {
  const rows = D.rows, i = D.i, M = (D.info.meters || {}).carry || { s: 0, st: 'GREEN', d: [] }, c = mc_color_(M.st);
  mc_hdr_(sh, 7, 'CARRY-TRADE STRESS');
  ui_box(sh, 8, 2, 8, 4, '● ' + M.st + '  ' + M.s, { bg: c[0], fc: c[1], bold: true, size: 12 });
  ui_box(sh, 8, 5, 8, 17, M.d.length ? M.d.join(' · ') : 'Calm — the yen is not moving fast, volatility is normal, AUD/JPY and the Nikkei are steady.', { h: 'left', size: 9, wrap: true });
  sh.setRowHeight(8, 30);
  mc_hdr_(sh, 10, 'CURRENCIES');
  mc_table_(sh, 11, ['Pair', 'Level', '1 day', '5 days', '20 days', '1-yr low', '1-yr high', 'Where in 1-yr range'], ['dxy', 'usdjpy', 'eurusd', 'gbpusd', 'usdcnh', 'usdchf', 'audjpy', 'mxnjpy'].map(function (k) {
    const rp = mc_rangePos_(rows, i, k);
    return [{ v: mc_label_(k), b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }, { v: mc_val_(rows, i, k), nf: '0.00##', b: true }, mc_pc_(mc_chg_(rows, i, k, 1)), mc_pc_(mc_chg_(rows, i, k, 5)), mc_pc_(mc_chg_(rows, i, k, 20)),
      { v: rp.lo, nf: '0.00##', fc: COLOR.HISF, bg: COLOR.HIS }, { v: rp.hi, nf: '0.00##', fc: COLOR.HISF, bg: COLOR.HIS }, { v: rp.pos === '' ? '—' : '█'.repeat(Math.round(rp.pos * 10)) + '░'.repeat(10 - Math.round(rp.pos * 10)) + ' ' + Math.round(rp.pos * 100) + '%', h: 'left' }];
  }), [3, 2, 2, 2, 2, 2, 2, 1].map(function (w, j) { return j === 7 ? 1 : w; }));
  const jg = mc_val_(rows, i, 'jgb10'), t0 = mc_ten_(rows, i), nextBoj = MC_BOJ.filter(function (d) { return d >= D.asOf; })[0];
  const jg20 = mc_val_(rows, i - 20, 'jgb10'), t20 = mc_ten_(rows, i - 20);
  mc_hdr_(sh, 21, 'JAPAN');
  [['JGB 10-year', jg !== null ? jg.toFixed(3) + '%' : '— (Japan MOF feed unavailable)'], ['US–Japan 10Y spread', jg !== null && t0 !== null ? Math.round((t0 - jg) * 100) + ' bp' : '—'],
   ['Spread change, 20 days', jg !== null && jg20 !== null && t0 !== null && t20 !== null ? mc_bpTxt_(((t0 - jg) - (t20 - jg20)) * 100) + ' (narrowing = carry pressure)' : '—'],
   ['Next Bank of Japan decision', nextBoj ? DOW_NAMES[cal_dow(nextBoj)] + ' ' + cal_pretty(nextBoj) : 'Add 2027 dates (ask for an update)'],
   ['Nikkei 225: 1 day / 5 days', mc_pcTxt_(mc_chg_(rows, i, 'n225', 1)) + ' / ' + mc_pcTxt_(mc_chg_(rows, i, 'n225', 5))], ['USD/JPY: 1 day / 5 days', mc_pcTxt_(mc_chg_(rows, i, 'usdjpy', 1)) + ' / ' + mc_pcTxt_(mc_chg_(rows, i, 'usdjpy', 5))]]
    .forEach(function (x, j) { const r = 22 + Math.floor(j / 2), c0 = j % 2 ? 10 : 2; ui_label(sh, r, c0, c0 + 3, x[0]); ui_auto(sh, r, c0 + 4, c0 + 7, x[1], { bold: true, size: 9, h: 'left' }); });
  mc_hdr_(sh, 26, 'POSITIONING  —  CFTC Commitments of Traders, speculators\' net position (weekly, Tuesday data released Friday)');
  let cot = {}; try { cot = JSON.parse(PropertiesService.getScriptProperties().getProperty('MC_COT') || '{}'); } catch (e) { /* none */ }
  const cr = Object.keys(cot).map(function (k) { const x = cot[k]; const ext = x.rank >= 0.9 ? 'Extreme long' : (x.rank <= 0.1 ? 'Extreme short' : ''); return [{ v: k, b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }, x.date, { v: x.net, nf: '+#,##0;-#,##0', fc: df_pn_(x.net) }, { v: x.pct, nf: '+0.0%;-0.0%' }, { v: x.chg, nf: '+#,##0;-#,##0', fc: df_pn_(x.chg) }, { v: Math.round(x.rank * 100) + '%', fc: ext ? COLOR.RED : COLOR.TEXT, b: !!ext }, { v: ext || '—', fc: ext ? COLOR.RED : COLOR.GRAY }]; });
  if (cr.length) mc_table_(sh, 27, ['Market', 'Report date', 'Net contracts', '% of open interest', 'Weekly change', 'Rank vs history', 'Flag'], cr, [3, 2, 2, 2, 2, 2, 3]);
  else ui_box(sh, 27, 2, 27, 17, 'Positioning loads with the nightly run (or Macro → Update macro now).', { fc: COLOR.GRAY, italic: true, size: 9, h: 'left' });
  mc_hdr_(sh, 36, mc_chartsLabel_(sh));
}
function mc_pcTxt_(v) { return v === '' || v === null ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%'; }
function mc_renderGlobal_(sh, D) {
  const rows = D.rows, i = D.i, M = (D.info.meters || {}).global || { s: 0, st: 'GREEN', d: [] }, c = mc_color_(M.st);
  const idx = [['Asia', 'n225', 'Closes 2:00 AM ET'], ['Asia', 'hsi', 'Closes 4:00 AM ET'], ['Asia', 'sse', 'Closes 3:00 AM ET'], ['Asia', 'kospi', 'Closes 2:30 AM ET'], ['Asia', 'asx', 'Closes 2:00 AM ET'],
    ['Europe', 'dax', 'Closes 11:30 AM ET'], ['Europe', 'ftse', 'Closes 11:30 AM ET'], ['Europe', 'cac', 'Closes 11:30 AM ET'], ['Europe', 'sx5e', 'Closes 11:30 AM ET'], ['EM', 'eem', 'U.S. hours']];
  const avg = function (reg) { const x = idx.filter(function (z) { return z[0] === reg; }).map(function (z) { return mc_chg_(rows, i, z[1], 1); }).filter(function (v) { return v !== ''; }); return x.length ? x.reduce(function (a, b) { return a + b; }, 0) / x.length : ''; };
  const a = avg('Asia'), e = avg('Europe'), tone = a === '' ? '—' : ((a + (e === '' ? a : e)) / 2 <= -0.005 ? 'Risk-off' : ((a + (e === '' ? a : e)) / 2 >= 0.005 ? 'Risk-on' : 'Mixed'));
  mc_hdr_(sh, 7, 'GLOBAL RISK TONE  —  ' + cal_pretty(D.asOf));
  ui_box(sh, 8, 2, 8, 4, tone.toUpperCase(), { bg: tone === 'Risk-off' ? COLOR.ERRBG : (tone === 'Risk-on' ? COLOR.OKBG : COLOR.INP), fc: tone === 'Risk-off' ? COLOR.RED : (tone === 'Risk-on' ? COLOR.GRN : COLOR.INPF), bold: true, size: 12 });
  ui_box(sh, 8, 5, 8, 17, 'Asia ' + mc_pcTxt_(a) + '  ·  Europe ' + mc_pcTxt_(e) + '  ·  meter ' + M.s + ' ' + M.st + (M.d.length ? ' — ' + M.d.join(' · ') : ''), { h: 'left', size: 10, bold: true, color: c[1] });
  mc_hdr_(sh, 10, 'INDICES');
  mc_table_(sh, 11, ['Region', 'Index', 'Close', '1 day', '5 days', '20 days', 'Where in 1-yr range', 'Session'], idx.map(function (z) {
    const rp = mc_rangePos_(rows, i, z[1]);
    return [{ v: z[0], bg: COLOR.PUR, fc: COLOR.PURF, b: true }, { v: mc_label_(z[1]), b: true, h: 'left' }, { v: mc_val_(rows, i, z[1]), nf: '#,##0.00' }, mc_pc_(mc_chg_(rows, i, z[1], 1)), mc_pc_(mc_chg_(rows, i, z[1], 5)), mc_pc_(mc_chg_(rows, i, z[1], 20)),
      { v: rp.pos === '' ? '—' : Math.round(rp.pos * 100) + '%' }, { v: z[2], fc: COLOR.GRAY }];
  }), [2, 3, 2, 2, 2, 2, 1, 2]);
  mc_hdr_(sh, 23, 'LAST 10 SESSIONS  —  daily % change');
  const rs = rows.slice(Math.max(1, i - 9), i + 1);
  const head = [{ v: 'Index', b: true, bg: COLOR.SUB, fc: COLOR.WHITE }].concat(rs.map(function (r) { return { v: cal_short(String(r.date)), bg: COLOR.SUB, fc: COLOR.WHITE, b: true }; }));
  const body = idx.map(function (z) { return [{ v: mc_label_(z[1]), b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }].concat(rs.map(function (r, j) { const k = rows.indexOf(r); return mc_pc_(mc_chg_(rows, k, z[1], 1)); })); });
  TW_(sh, 24, 2, [head].concat(body), { size: 8 });
}
function mc_renderCommod_(sh, D) {
  const rows = D.rows, i = D.i, O = (D.info.meters || {}).oil || { s: 0, st: 'GREEN', d: [] }, oc = mc_color_(O.st);
  const line = function (k, nf) { const rp = mc_rangePos_(rows, i, k); return [{ v: mc_label_(k), b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }, { v: mc_val_(rows, i, k), nf: nf || '#,##0.00', b: true }, mc_pc_(mc_chg_(rows, i, k, 1)), mc_pc_(mc_chg_(rows, i, k, 5)), mc_pc_(mc_chg_(rows, i, k, 20)), { v: rp.lo, nf: nf || '#,##0.00', bg: COLOR.HIS, fc: COLOR.HISF }, { v: rp.hi, nf: nf || '#,##0.00', bg: COLOR.HIS, fc: COLOR.HISF }]; };
  const head = ['Market', 'Last', '1 day', '5 days', '20 days', '1-yr low', '1-yr high'], w = [3, 2, 2, 2, 2, 2, 3];
  mc_hdr_(sh, 7, 'OIL  —  meter ' + O.s + ' ' + O.st + (O.d.length ? ': ' + O.d.join(' · ') : ''));
  sh.getRange(7, 2).setBackground(O.st === 'GREEN' ? COLOR.NAVY : oc[1]);
  let r = mc_table_(sh, 8, head, ['wti', 'brent', 'natgas', 'ovx'].map(function (k) { return line(k); }), w);
  const br = mc_val_(rows, i, 'brent'), wt = mc_val_(rows, i, 'wti');
  ui_label(sh, r, 2, 4, 'Brent – WTI spread'); ui_auto(sh, r, 5, 8, br !== null && wt !== null ? '$' + (br - wt).toFixed(2) : '—', { bold: true, h: 'left' });
  r += 2;
  mc_hdr_(sh, r, 'METALS'); r++;
  r = mc_table_(sh, r, head, ['gold', 'silver', 'copper', 'gvz'].map(function (k) { return line(k); }), w);
  const g = mc_val_(rows, i, 'gold'), s = mc_val_(rows, i, 'silver'), cu = mc_val_(rows, i, 'copper');
  ui_label(sh, r, 2, 4, 'Gold / silver ratio'); ui_auto(sh, r, 5, 8, g && s ? (g / s).toFixed(1) : '—', { bold: true, h: 'left' });
  ui_label(sh, r, 10, 12, 'Copper / gold ratio (×1000)'); ui_auto(sh, r, 13, 17, g && cu ? (cu / g * 1000).toFixed(3) + '  (rising = growth, falling = fear)' : '—', { bold: true, h: 'left' });
  r += 2;
  const C = (D.info.meters || {}).crypto || { s: 0, st: 'GREEN', d: [] };
  mc_hdr_(sh, r, 'CRYPTO  (trades 24/7 — Monday shows the weekend)  —  meter ' + C.s + ' ' + C.st); r++;
  r = mc_table_(sh, r, head, ['btc', 'eth'].map(function (k) { return line(k); }), w) + 1;
  mc_hdr_(sh, r, 'SECTORS & BREADTH  (relative = vs the S&P over 20 days)'); r++;
  const P = in_prices_(), spx20 = (function () { const d0 = P.map[D.asOf], d20 = P.rows[P.rows.map(function (x) { return String(x.date); }).indexOf(D.asOf) - 20]; return d0 && d20 ? d0.spx_c / d20.spx_c - 1 : ''; })();
  const sec = MC_SYM.filter(function (x) { return x[3] === 'sector'; }).map(function (x) {
    const c20 = mc_chg_(rows, i, x[0], 20), rel = c20 !== '' && spx20 !== '' ? c20 - spx20 : '';
    return [{ v: x[1], b: true, bg: COLOR.LAB, fc: COLOR.LABF }, { v: x[2], h: 'left' }, mc_pc_(mc_chg_(rows, i, x[0], 1)), mc_pc_(mc_chg_(rows, i, x[0], 5)), mc_pc_(c20), mc_pc_(rel)];
  }).sort(function (a, b) { return (Number(b[5].v) || 0) - (Number(a[5].v) || 0); });
  r = mc_table_(sh, r, ['ETF', 'Sector', '1 day', '5 days', '20 days', 'Relative 20d'], sec, [2, 4, 2, 2, 2, 4]);
  const xly = mc_chg_(rows, i, 'xly', 20), xlp = mc_chg_(rows, i, 'xlp', 20), rsp = mc_chg_(rows, i, 'rsp', 20);
  ui_label(sh, r, 2, 5, 'Risk appetite: discretionary vs staples (20d)'); ui_auto(sh, r, 6, 9, xly !== '' && xlp !== '' ? mc_pcTxt_(xly - xlp) + (xly > xlp ? '  risk-on' : '  defensive') : '—', { bold: true, h: 'left' });
  ui_label(sh, r, 10, 13, 'Breadth: equal-weight vs S&P (20d)'); ui_auto(sh, r, 14, 17, rsp !== '' && spx20 !== '' ? mc_pcTxt_(rsp - spx20) + (rsp > spx20 ? '  broad' : '  narrow (mega-caps leading)') : '—', { bold: true, h: 'left' });
  sh.getCharts().forEach(function (ch, j) { sh.updateChart(ch.modify().setPosition(r + 3 + Math.floor(j / 2) * 18, j % 2 ? 10 : 2, 0, 0).build()); });
  mc_hdr_(sh, r + 2, mc_chartsLabel_(sh));
}
/** Every line chart's vertical axis is fitted to its data (dual-axis charts per side) instead of starting at zero. */
const MC_DUAL = ['P1:R600', 'T1:V600', 'AJ1:AL600', 'BI1:BK21', 'BT1:BV21', 'AY1:BA400'];
function mc_scaleCharts_(sh) {
  sh.getCharts().forEach(function (ch) {
    try {
      const rg = ch.getRanges()[0]; if (!rg) return;
      const vals = rg.getValues().slice(1), a1 = rg.getA1Notation(), dual = MC_DUAL.indexOf(a1) > -1, cols = vals.length ? vals[0].length : 0;
      if (cols < 2 || /^L1:N/.test(a1)) return;                                      // spreads chart can go negative: leave it
      const win = function (from, to) {
        let lo = Infinity, hi = -Infinity;
        vals.forEach(function (r) { for (let c = from; c <= to; c++) { const v = r[c]; if (v !== '' && v !== null && isFinite(v)) { lo = Math.min(lo, Number(v)); hi = Math.max(hi, Number(v)); } } });
        if (lo === Infinity) return null; const pad = Math.max((hi - lo) * 0.08, Math.abs(hi) * 0.002 || 0.01);
        return { viewWindow: { min: lo - pad, max: hi + pad } };
      };
      const axes = dual ? { 0: win(1, 1), 1: win(2, cols - 1) } : { 0: win(1, cols - 1) };
      if (!axes[0]) return;
      sh.updateChart(ch.modify().setOption('vAxes', axes).build());
    } catch (e) { /* leave that chart as is */ }
  });
}
/** Writes chart data for a tab, for the range picked in N5. */
function mc_renderCharts_(name) {
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(name), cd = ss.getSheetByName('_MacroCharts'); if (!sh || !cd) return;
  const D = mc_day_(cal_today()); if (!D) return;
  const n = { '1M': 21, '3M': 63, '1Y': 252, '2Y': 504 }[String(sh.getRange(5, 14).getValue())] || 252;
  const rows = D.rows.slice(Math.max(0, D.i - n + 1), D.i + 1), lab = function (r) { return String(r.date).slice(5).replace('-', '/') + (n > 300 ? '/' + String(r.date).slice(2, 4) : ''); };
  const put = function (col, head, data) { cd.getRange(1, col, 600, head.length).clearContent(); cd.getRange(1, col, 1, head.length).setValues([head]); if (data.length) cd.getRange(2, col, data.length, head.length).setValues(data); };
  const val = function (r, k) { const x = r[k]; return x === '' || x === undefined || x === null ? '' : Number(x); };
  if (name === 'Yield Curve') {
    const i = D.i, g = function (n2, k) { return mc_val_(D.rows, i - n2, k); };
    put(1, ['Maturity', 'Today', '1 week ago', '1 month ago', '1 year ago'], MC_CURVE.map(function (m) { return [m[0], g(0, m[1]), g(5, m[1]), g(21, m[1]), g(252, m[1])].map(function (x) { return x === null ? '' : x; }); }));
    put(7, ['Date', '2Y', '10Y', '30Y'], rows.map(function (r) { return [lab(r), val(r, 'y_2y'), val(r, 'tnx') !== '' ? val(r, 'tnx') : val(r, 'y_10y'), val(r, 'y_30y')]; }));
    put(12, ['Date', '2s10s (bp)', '3m10y (bp)'], rows.map(function (r) { const t = val(r, 'y_10y'); return [lab(r), t !== '' && val(r, 'y_2y') !== '' ? Math.round((t - val(r, 'y_2y')) * 100) : '', t !== '' && val(r, 'y_3m') !== '' ? Math.round((t - val(r, 'y_3m')) * 100) : '']; }));
    const P = in_prices_();
    put(16, ['Date', 'SPX', '10Y %'], rows.map(function (r) { const p = P.map[String(r.date)]; return [lab(r), p ? Number(p.spx_c) : '', val(r, 'tnx') !== '' ? val(r, 'tnx') : val(r, 'y_10y')]; }));
  }
  if (name === 'FX & Carry') {
    put(20, ['Date', 'USD/JPY', 'DXY'], rows.map(function (r) { return [lab(r), val(r, 'usdjpy'), val(r, 'dxy')]; }));
    put(24, ['Date', 'AUD/JPY'], rows.map(function (r) { return [lab(r), val(r, 'audjpy')]; }));
  }
  if (name === 'Commodities & Crypto') {
    put(26, ['Date', 'WTI', 'Brent'], rows.map(function (r) { return [lab(r), val(r, 'wti'), val(r, 'brent')]; }));
    put(30, ['Date', 'Gold'], rows.map(function (r) { return [lab(r), val(r, 'gold')]; }));
    put(33, ['Date', 'Bitcoin'], rows.map(function (r) { return [lab(r), val(r, 'btc')]; }));
    put(36, ['Date', 'Copper/gold ×1000', '10Y %'], rows.map(function (r) { const g = val(r, 'gold'), c = val(r, 'copper'); return [lab(r), g && c ? Math.round(c / g * 1e6) / 1000 : '', val(r, 'tnx')]; }));
  }
  if (name === 'Yield Curve' && core_fnExists_('cv_hubCharts_')) { try { cv_hubCharts_(sh, cd); } catch (e) { core_logError_('cv hub charts', e); } }
  SpreadsheetApp.flush(); mc_scaleCharts_(sh);
}

/* =============================================================================
 * DAY-FILE HOOKS
 * ========================================================================== */
/** The day file's "Macro" tab: that day's snapshot, kept forever. Future days show the latest known values. */
function mc_fillMacroTab(sh, ctx) {
  df_clearBody_(sh, 6);
  const D = mc_day_(ctx.k);
  if (!D) { df_placeholder_(sh, 6, 2, 17, 'Macro data arrives after Macro → Backfill macro history is run in the hub.'); return; }
  const rows = D.rows, i = D.i, info = D.info, M = info.meters || {};
  df_legendNote_(sh, (D.asOf === ctx.k ? cal_pretty(ctx.k) : 'As of ' + cal_pretty(D.asOf) + ' (latest available)') + '  ·  regime: ' + (D.row.regime || '—'));
  let r = 6;
  const hdr = function (t) { ui_header(sh, r, 2, 17, t); r++; };
  const tbl = function (head, data, widths) { r = mc_table_(sh, r, head, data, widths) + 1; };
  hdr('WHAT MATTERS TODAY');
  const al = (info.alerts || []).concat(mc_eventAlerts_(ctx.k));
  tbl(['Level', 'Alert'], al.length ? al.slice(0, 8).map(function (a) { const c = a[0] === 'red' ? mc_color_('RED') : (a[0] === 'yellow' ? mc_color_('YELLOW') : [COLOR.PUR, COLOR.PURF]); return [{ v: a[0] === 'red' ? '▲ RED' : (a[0] === 'yellow' ? '▲ WATCH' : '● INFO'), bg: c[0], fc: c[1], b: true }, { v: a[1], h: 'left', b: a[0] === 'red' }]; })
    : [[{ v: '● CALM', bg: COLOR.OKBG, fc: COLOR.GRN, b: true }, { v: 'No macro alerts — every meter is green.', h: 'left' }]], [2, 14]);
  hdr('STRESS METERS  —  regime ' + (D.row.regime || '—') + (info.comp !== undefined ? ' (composite ' + info.comp + ')' : ''));
  tbl(['Meter', 'Score', 'Status', 'What is driving it'], MC_METERS.map(function (m) { const x = M[m[0]] || { s: 0, st: 'GREEN', d: [] }, c = mc_color_(x.st); return [{ v: m[1], b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }, { v: x.s, b: true }, { v: '● ' + x.st, bg: c[0], fc: c[1], b: true }, { v: x.d.join(' · ') || 'Calm', h: 'left', fc: x.d.length ? COLOR.TEXT : COLOR.GRAY }]; }), [2, 1, 2, 11]);
  hdr('RATES  —  Treasury curve (%)');
  tbl(['Maturity'].concat(MC_CURVE.map(function (m) { return m[0]; })), [
    [{ v: 'Yield', b: true, bg: COLOR.LAB, fc: COLOR.LABF }].concat(MC_CURVE.map(function (m) { return { v: mc_val_(rows, i, m[1]), nf: '0.00', b: true }; })),
    [{ v: 'Δ 1 day', b: true, bg: COLOR.LAB, fc: COLOR.LABF }].concat(MC_CURVE.map(function (m) { return mc_bp_(mc_chg_(rows, i, m[1], 1, true)); })),
    [{ v: 'Δ 1 week', b: true, bg: COLOR.LAB, fc: COLOR.LABF }].concat(MC_CURVE.map(function (m) { return mc_bp_(mc_chg_(rows, i, m[1], 5, true)); }))], [2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2]);
  const t0 = mc_ten_(rows, i), y2 = mc_val_(rows, i, 'y_2y'), y3m = mc_val_(rows, i, 'y_3m');
  ui_box(sh, r - 1, 2, r - 1, 17, '2s10s ' + (t0 !== null && y2 !== null ? Math.round((t0 - y2) * 100) + ' bp' : '—') + '  ·  3m10y ' + (t0 !== null && y3m !== null ? Math.round((t0 - y3m) * 100) + ' bp' : '—') +
    '  ·  10Y real ' + (mc_val_(rows, i, 'real10') !== null ? mc_val_(rows, i, 'real10').toFixed(2) + '%' : '—') + '  ·  breakeven ' + (mc_val_(rows, i, 'be10') !== null ? mc_val_(rows, i, 'be10').toFixed(2) + '%' : '—') +
    '  ·  MOVE ' + (mc_val_(rows, i, 'move') !== null ? Math.round(mc_val_(rows, i, 'move')) : '—') + '  ·  HY spread ' + (mc_val_(rows, i, 'hy_oas') !== null ? mc_val_(rows, i, 'hy_oas').toFixed(2) + '%' : '—') +
    '  ·  equity risk premium ' + (info.erp !== null && info.erp !== undefined ? info.erp.toFixed(2) + '%' : '—'), { bg: COLOR.HIS, fc: COLOR.HISF, size: 9, h: 'left', bold: true });
  r++;
  const mk = function (k, nf) { return [{ v: mc_label_(k), b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }, { v: mc_val_(rows, i, k), nf: nf || '#,##0.00##', b: true }, mc_pc_(mc_chg_(rows, i, k, 1)), mc_pc_(mc_chg_(rows, i, k, 5)), mc_pc_(mc_chg_(rows, i, k, 20))]; };
  const two = function (a, b) { const out = []; for (let j = 0; j < Math.max(a.length, b.length); j++) out.push((a[j] || ['', '', '', '', '']).concat(b[j] || ['', '', '', '', ''])); return out; };
  hdr('CURRENCIES & GLOBAL MARKETS');
  tbl(['Currency', 'Level', '1 day', '5 days', '20 days', 'Index', 'Close', '1 day', '5 days', '20 days'],
    two(['dxy', 'usdjpy', 'eurusd', 'gbpusd', 'usdcnh', 'usdchf', 'audjpy', 'mxnjpy'].map(function (k) { return mk(k); }), ['n225', 'hsi', 'sse', 'kospi', 'asx', 'dax', 'ftse', 'cac', 'sx5e', 'eem'].map(function (k) { return mk(k, '#,##0.00'); })), [2, 1, 1, 2, 2, 2, 1, 1, 2, 2]);
  hdr('COMMODITIES & CRYPTO');
  tbl(['Market', 'Last', '1 day', '5 days', '20 days', 'Market', 'Last', '1 day', '5 days', '20 days'],
    two(['wti', 'brent', 'natgas', 'ovx', 'btc'].map(function (k) { return mk(k, '#,##0.00'); }), ['gold', 'silver', 'copper', 'gvz', 'eth'].map(function (k) { return mk(k, '#,##0.00'); })), [2, 1, 1, 2, 2, 2, 1, 1, 2, 2]);
  hdr('SECTORS  —  1 day / 5 days / 20 days');
  const sec = MC_SYM.filter(function (x) { return x[3] === 'sector'; }).map(function (x) { return [{ v: x[1] + ' · ' + x[2], b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }, mc_pc_(mc_chg_(rows, i, x[0], 1)), mc_pc_(mc_chg_(rows, i, x[0], 5)), mc_pc_(mc_chg_(rows, i, x[0], 20))]; });
  const half = Math.ceil(sec.length / 2), secRows = [];
  for (let j = 0; j < half; j++) secRows.push(sec[j].concat(sec[j + half] || ['', '', '', '']));
  tbl(['Sector', '1 day', '5 days', '20 days', 'Sector', '1 day', '5 days', '20 days'], secRows, [3, 2, 1, 2, 3, 2, 1, 2]);
  r = mc_xSection_(sh, ctx, r);
  hdr('WHAT IS DRIVING THE S&P  (20-day correlation of daily moves)');
  tbl(['10Y yield', 'Dollar', 'Oil', 'USD/JPY'], [[['ten'], ['dxy'], ['wti'], ['usdjpy']].map(function (k) { const v = D.corr[k[0]]; return { v: v === undefined ? '' : v, nf: '+0.00;-0.00', b: true, fc: df_pn_(v) }; })], [4, 4, 4, 4]);
}
/** After every day-file refresh: MACRO RADAR pills on the Report (row 8), the Game Plan banner, and the same-day 2-year yield. */
function mc_afterFill(ss, ctx) {
  const D = mc_day_(ctx.k); if (!D) return;
  const rp = ss.getSheetByName('Report'), M = D.info.meters || {};
  rp.setRowHeight(8, 24);
  MC_METERS.forEach(function (m, j) {
    const x = M[m[0]] || { s: 0, st: 'GREEN', d: [] }, c = mc_color_(x.st), col = 2 + j * 2;
    const rg = rp.getRange(8, col, 1, 2); rg.merge();
    rg.setValue(m[1].toUpperCase() + '  ● ' + x.st).setBackground(c[0]).setFontColor(c[1]).setFontWeight('bold').setFontSize(8).setFontFamily(FONT).setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setBorder(true, true, true, true, null, null, COLOR.BORDER, SpreadsheetApp.BorderStyle.SOLID)
      .setNote(m[1] + ' meter ' + x.s + '/100 (' + x.st + ')' + (x.d.length ? '\n' + x.d.join('\n') : '\nCalm') + '\nAs of ' + cal_pretty(D.asOf) + ' · details on the Macro tab');
  });
  // 2-year yield: same day from the Treasury curve; upcoming days show the latest known value
  const y2 = mc_val_(D.rows, D.i, 'y_2y');
  if (y2 !== null && rp.getRange('M15').getDisplayValue() === '—') { rp.getRange('M15').setValue(y2).setNumberFormat('0.000'); rp.getRange('O15').setValue(D.asOf === ctx.k ? 'U.S. Treasury curve (same day)' : 'Latest known (' + cal_short(D.asOf) + ')').setFontColor(COLOR.GRAY); }
  // forward P/E (two sources) and the equity risk premium from their average — Report rows 17–19
  const pxRow = (ctx.P || in_prices_()).map[D.asOf] || {}, PE = mc_peFor_(D.asOf, Number(pxRow.spx_c) || null), ten = mc_ten_(D.rows, D.i);
  const put = function (r, v, note, fc, bg) { rp.getRange(r, 13).setValue(v).setFontColor(fc || COLOR.TEXT).setBackground(bg || COLOR.WHITE).setFontWeight('bold').setHorizontalAlignment('center'); rp.getRange(r, 15).setValue(note).setFontColor(COLOR.GRAY); };
  put(17, PE.fs !== null ? PE.fs.toFixed(1) : '—', PE.fs !== null ? 'FactSet Earnings Insight of ' + cal_short(PE.fsDate) + (PE.fsPrev !== null ? ' · ' + (PE.fs - PE.fsPrev >= 0 ? '+' : '') + (PE.fs - PE.fsPrev).toFixed(1) + ' vs prior week' : '') : 'Weekly source not available yet');
  rp.getRange(18, 10).setValue(PE.src === 'FactSet-based' ? 'Fwd P/E — FactSet-based (daily)' : 'Fwd P/E — S&P DJI (daily)');
  put(18, PE.sp !== null ? PE.sp.toFixed(1) : '—', PE.sp !== null ? 'Fwd 12-mo EPS $' + PE.eps.toFixed(2) + (PE.src === 'FactSet-based' ? ' (FactSet, carried daily — S&P DJI unreachable)' : ' (S&P DJI estimates)') + ' · close ' + df_f_(pxRow.spx_c) : 'Daily source not available yet');
  const erp = PE.avg && ten !== null ? 100 / PE.avg - ten : null, st = erp === null ? '' : (erp < 0 ? 'RED' : (erp < 1 ? 'YELLOW' : 'GREEN')), c = st ? mc_color_(st) : [COLOR.WHITE, COLOR.GRAY];
  put(19, erp === null ? '—' : (erp >= 0 ? '+' : '−') + Math.abs(erp).toFixed(2) + '%', erp === null ? 'Needs a forward P/E and the 10Y' : 'Avg P/E ' + PE.avg.toFixed(2) + ' → earnings yield ' + (100 / PE.avg).toFixed(2) + '% − 10Y ' + ten.toFixed(2) + '%  ·  ● ' + st + (PE.fs === null || PE.sp === null ? ' (one source)' : ''), c[1], c[0]);
  // Game Plan: What matters today banner
  const gp = ss.getSheetByName('Game Plan');
  if (gp) {
    const al = (D.info.alerts || []).concat(mc_eventAlerts_(ctx.k)).slice(0, 4);
    const top = al.length ? al[0][0] : 'calm', c = top === 'red' ? mc_color_('RED') : (top === 'yellow' ? mc_color_('YELLOW') : (top === 'info' ? [COLOR.PUR, COLOR.PURF] : mc_color_('GREEN')));
    const rg = gp.getRange(5, 2, 1, 16); rg.merge();
    rg.setValue('WHAT MATTERS TODAY  ▸  ' + (al.length ? al.map(function (a) { return a[1]; }).join('   ·   ') : 'No macro alerts — every meter is green') + '   (regime: ' + (D.row.regime || '—') + ')')
      .setBackground(c[0]).setFontColor(c[1]).setFontWeight('bold').setFontSize(9).setFontFamily(FONT).setWrap(true).setHorizontalAlignment('left').setVerticalAlignment('middle');
    gp.setRowHeight(5, 40);
  }
}


/* =============================================================================
 * CROSS-ASSET MINUTE BARS — 10Y yield, WTI, gold, USD/JPY, Bitcoin
 * Stored in the Drive data lake as YYYY-MM-DD-x.json (4:00 AM – 8:00 PM ET),
 * shown beside SPX in each day file's 1-Min Tape and on its Macro tab.
 * ========================================================================== */
const MC_XA = [['tnx', '^TNX', '10Y yield', 'bp'], ['us2y', '2YY=F', '2Y yield', 'bp'], ['wti', 'CL=F', 'WTI crude', '%'], ['gold', 'GC=F', 'Gold', '%'], ['usdjpy', 'JPY=X', 'USD/JPY', '%'], ['btc', 'BTC-USD', 'Bitcoin', '%']];
/** Every intraday refresh and the end of day: today's bars. */
function mc_captureIntraday(silent) { return mc_xCapture_({ range: '2d' }); }
/** Macro → Backfill cross-asset minute bars (about 4 weeks of 1-minute, 60 days of 5-minute). */
function mc_backfillIntraday() {
  const t0 = Date.now(), n = mc_xCapture_({ back: 28, five: true });
  core_alert('Cross-asset minute bars', n + ' days saved for 10Y, WTI, gold, USD/JPY and Bitcoin.\nFinished in ' + Math.round((Date.now() - t0) / 1000) + ' s');
}
function mc_xCapture_(opt) {
  const reqs = [], meta = [], now = Math.floor(Date.now() / 1000), ua = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' };
  MC_XA.forEach(function (a) {
    const base = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(a[1]) + '?includePrePost=true';
    if (opt.range) { reqs.push({ url: base + '&interval=1m&range=' + opt.range, muteHttpExceptions: true, headers: ua }); meta.push([a[0], '1']); }
    else {
      for (let end = now; end > now - opt.back * 86400; end -= 6 * 86400) { reqs.push({ url: base + '&interval=1m&period1=' + Math.max(end - 6 * 86400, now - opt.back * 86400) + '&period2=' + end, muteHttpExceptions: true, headers: ua }); meta.push([a[0], '1']); }
      if (opt.five) { reqs.push({ url: base + '&interval=5m&range=60d', muteHttpExceptions: true, headers: ua }); meta.push([a[0], '5']); }
    }
  });
  const fresh = {};                                           // date -> series -> m -> bar
  for (let i = 0; i < reqs.length; i += 12) {
    UrlFetchApp.fetchAll(reqs.slice(i, i + 12)).forEach(function (res, j) {
      const mm = meta[i + j];
      try {
        if (res.getResponseCode() !== 200) return;
        const r = JSON.parse(res.getContentText()).chart.result[0], q = r.indicators.quote[0];
        (r.timestamp || []).forEach(function (t, x) {
          if (q.close[x] === null || q.close[x] === undefined) return;
          const et = md_et_(t); if (!cal_isTradingDay(et.date) || et.mod < 240 || et.mod >= 1200) return;
          const d = fresh[et.date] = fresh[et.date] || {}, key = mm[0] + mm[1], s = d[key] = d[key] || {};
          s[et.mod] = [et.mod, md_r4_(q.open[x]), md_r4_(q.high[x]), md_r4_(q.low[x]), md_r4_(q.close[x])];
        });
      } catch (e) { /* one symbol unavailable */ }
    });
  }
  const p = PropertiesService.getScriptProperties(), idx = JSON.parse(p.getProperty('MC_XIDX') || '{}');
  Object.keys(fresh).forEach(function (d) {
    let old = {}; if (idx[d]) { try { old = JSON.parse(DriveApp.getFileById(idx[d]).getBlob().getDataAsString()).s || {}; } catch (e) { old = {}; } }
    const merged = {};
    Object.keys(old).concat(Object.keys(fresh[d])).forEach(function (key) {
      if (merged[key]) return;
      const map = {}; (old[key] || []).forEach(function (b) { map[b[0]] = b; }); Object.keys(fresh[d][key] || {}).forEach(function (m) { map[m] = fresh[d][key][m]; });
      merged[key] = Object.keys(map).map(Number).sort(function (a, b) { return a - b; }).map(function (m) { return map[m]; });
    });
    const body = JSON.stringify({ v: 1, date: d, s: merged });
    let id = idx[d];
    if (id) { try { DriveApp.getFileById(id).setContent(body); } catch (e) { id = null; } }
    if (!id) id = md_lakeFolder_(d).createFile(d + '-x.json', body, MimeType.PLAIN_TEXT).getId();
    idx[d] = id;
  });
  const keep = Object.keys(idx).sort().slice(-150), trimmed = {}; keep.forEach(function (d) { trimmed[d] = idx[d]; });
  p.setProperty('MC_XIDX', JSON.stringify(trimmed));
  return Object.keys(fresh).length;
}
/** One day's cross-asset bars: { tnx: [bar…], wti, gold, usdjpy, btc } (1-minute when available, else 5-minute). */
function mc_xBars_(k) {
  const id = JSON.parse(PropertiesService.getScriptProperties().getProperty('MC_XIDX') || '{}')[k];
  const out = {}; if (!id) return out;
  let s = {}; try { s = JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString()).s || {}; } catch (e) { return out; }
  MC_XA.forEach(function (a) { const b = (s[a[0] + '1'] && s[a[0] + '1'].length ? s[a[0] + '1'] : s[a[0] + '5']) || []; out[a[0]] = b.map(function (x) { return { m: x[0], o: x[1], h: x[2], l: x[3], c: x[4] }; }); });
  return out;
}
function mc_xAt_(bars, m) { let v = null; for (let i = 0; i < bars.length; i++) { if (bars[i].m <= m) v = bars[i].c; else break; } return v; }
/** DayFile hook: five extra columns beside the regular-session rows of the 1-Min Tape. */
function mc_tapeExtra(sh, ctx, row0, spx) {
  const X = mc_xBars_(ctx.k); if (!Object.keys(X).some(function (k) { return X[k].length; })) return;
  const c0 = 20;
  if (sh.getMaxColumns() < c0 + 5) sh.insertColumnsAfter(sh.getMaxColumns(), c0 + 5 - sh.getMaxColumns());
  MC_XA.forEach(function (a, j) { sh.setColumnWidth(c0 + j, 95); });
  ui_sub(sh, row0 - 1, MC_XA.map(function (a, j) { return [c0 + j, c0 + j, a[2] + (a[3] === 'bp' ? ' (Δbp)' : ' (Δ%)')]; }));
  TW_(sh, row0, c0, spx.map(function (b) {
    return MC_XA.map(function (a) {
      const s = X[a[0]] || [], v = mc_xAt_(s, b.m), p = mc_xAt_(s, b.m - (ctx.A && ctx.A.step || 1));
      if (v === null) return { v: '—', fc: COLOR.GRAY };
      const ch = p === null ? '' : (a[3] === 'bp' ? (v - p) * 100 : (v / p - 1) * 100);
      const txt = (a[0] === 'tnx' ? v.toFixed(3) : (a[0] === 'usdjpy' ? v.toFixed(2) : (a[0] === 'btc' ? Math.round(v).toLocaleString('en-US') : v.toFixed(2)))) + (ch === '' ? '' : '  ' + (ch >= 0 ? '+' : '') + ch.toFixed(a[3] === 'bp' ? 1 : 2));
      return { v: txt, fc: ch === '' ? COLOR.TEXT : (a[0] === 'tnx' || a[0] === 'usdjpy' ? (ch > 0 ? COLOR.RED : COLOR.GRN) : df_pn_(ch)), bg: ch === '' ? COLOR.WHITE : df_heat_(a[0] === 'tnx' || a[0] === 'usdjpy' ? -ch : ch, a[3] === 'bp' ? 1 : 0.15) };
    });
  }), { size: 8 });
}
/** Macro tab section: how each asset traded during the session, and during the day's biggest SPX swing. */
function mc_xSection_(sh, ctx, r) {
  const A = ctx.A; if (!A || !A.spx || !A.spx.length) return r;
  const X = mc_xBars_(ctx.k); if (!Object.keys(X).some(function (k) { return X[k].length; })) return r;
  const big = (A.major || []).slice().sort(function (a, b) { return Math.abs(b.pts) - Math.abs(a.pts); })[0];
  const spxCh = A.spx.map(function (b, i) { return i ? b.c - A.spx[i - 1].c : 0; });
  ui_header(sh, r, 2, 17, 'CROSS-ASSET DURING THE SESSION  (9:30 AM – 4:00 PM ET)' + (big ? '  ·  biggest SPX swing ' + df_s_(big.pts, 1) + ' pts, ' + md_ampm_(big.ta) + ' → ' + md_ampm_(big.tb) : '')); r++;
  return mc_table_(sh, r, ['Asset', '9:30 AM', '4:00 PM', 'Session change', 'High (time)', 'Low (time)', 'Moves with SPX (1-min corr.)', 'During the biggest SPX swing'], MC_XA.map(function (a) {
    const s = (X[a[0]] || []).filter(function (b) { return b.m >= 570 && b.m < 960; });
    if (!s.length) return [{ v: a[2], b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }, '—', '—', '—', '—', '—', '—', '—'];
    const o = mc_xAt_(s, 570) || s[0].c, c = mc_xAt_(s, 959), ch = a[3] === 'bp' ? (c - o) * 100 : (c / o - 1);
    let hi = s[0], lo = s[0]; s.forEach(function (b) { if (b.h > hi.h) hi = b; if (b.l < lo.l) lo = b; });
    const xs = [], ys = []; A.spx.forEach(function (b, i) { if (!i) return; const v = mc_xAt_(s, b.m), p = mc_xAt_(s, A.spx[i - 1].m); if (v !== null && p !== null) { xs.push(v - p); ys.push(spxCh[i]); } });
    const cr = xs.length > 30 ? mc_corr_(xs, ys) : null;
    let sw = '—'; if (big) { const v0 = mc_xAt_(s, in_m_(big.ta)), v1 = mc_xAt_(s, in_m_(big.tb)); if (v0 !== null && v1 !== null) sw = a[3] === 'bp' ? mc_bpTxt_((v1 - v0) * 100) : mc_pcTxt_(v1 / v0 - 1); }
    const fmt = function (v) { return a[0] === 'btc' ? Math.round(v).toLocaleString('en-US') : v.toFixed(a[0] === 'tnx' ? 3 : 2); };
    return [{ v: a[2], b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }, fmt(o), { v: fmt(c), b: true }, a[3] === 'bp' ? mc_bpTxt_(ch) : mc_pcTxt_(ch),
      fmt(hi.h) + ' (' + md_ampm_(('0' + Math.floor(hi.m / 60)).slice(-2) + ':' + ('0' + hi.m % 60).slice(-2)) + ')', fmt(lo.l) + ' (' + md_ampm_(('0' + Math.floor(lo.m / 60)).slice(-2) + ':' + ('0' + lo.m % 60).slice(-2)) + ')',
      { v: cr === null ? '—' : cr.toFixed(2), fc: cr === null ? COLOR.GRAY : df_pn_(cr), b: cr !== null && Math.abs(cr) >= 0.3 }, { v: sw, b: true }];
  }), [2, 2, 2, 2, 2, 2, 2, 2]) + 1;
}


/* =============================================================================
 * DAY-FILE MACRO TABS — Yield Curve, FX & Carry, Global Markets, Commodities & Crypto
 * Each is a frozen snapshot of its day: a day-focused section first (the day's moves,
 * intraday paths, events), then the same full picture as the hub tab, as it stood that
 * day, then charts of the day and the last 20 sessions.
 * ========================================================================== */
function mc_fillDayTab(name, sh, ctx) {
  df_clearBody_(sh, 6);
  const D = mc_day_(ctx.k);
  if (!D) { df_placeholder_(sh, 6, 2, 17, 'Macro data arrives after Macro → Backfill macro history is run in the hub.'); return; }
  const live = D.asOf === ctx.k, X = live ? mc_xBars_(ctx.k) : {};
  df_legendNote_(sh, live ? cal_pretty(ctx.k) + '  ·  regime ' + (D.row.regime || '—') : 'As of ' + cal_pretty(D.asOf) + ' (latest available — this day has not happened yet)');
  const DAY = { 'Yield Curve': mc_dayCurve_, 'FX & Carry': mc_dayFx_, 'Global Markets': mc_dayGlobal_, 'Commodities & Crypto': mc_dayCommod_ };
  const HUB = { 'Yield Curve': mc_renderCurve_, 'FX & Carry': mc_renderFx_, 'Global Markets': mc_renderGlobal_, 'Commodities & Crypto': mc_renderCommod_ };
  let r = DAY[name](sh, ctx, D, X, 6);
  ui_header(sh, r, 2, 17, 'THE FULL PICTURE AS OF ' + cal_pretty(D.asOf).toUpperCase()); r += 1;
  HUB[name](mc_shift_(sh, r - 7), D);
  mc_dayCharts_(name, sh, ctx, D, X, sh.getLastRow() + 2);
}
/** A view of the sheet with every row moved down by `off`, so the hub layouts can be drawn below the day section. */
function mc_shift_(sh, off) {
  return { __day: true,
    getRange: function (a, b, c, d) { if (typeof a !== 'number') return sh.getRange(a); return c === undefined ? sh.getRange(a + off, b) : sh.getRange(a + off, b, c, d); },
    setRowHeight: function (r, h) { return sh.setRowHeight(r + off, h); }, setRowHeights: function (r, n, h) { return sh.setRowHeights(r + off, n, h); },
    getMaxRows: function () { return sh.getMaxRows() - off; }, getMaxColumns: function () { return sh.getMaxColumns(); },
    insertRowsAfter: function (r, n) { return sh.insertRowsAfter(Math.min(sh.getMaxRows(), r + off), n); }, insertColumnsAfter: function (c, n) { return sh.insertColumnsAfter(c, n); },
    setColumnWidth: function (c, w) { return sh.setColumnWidth(c, w); }, getCharts: function () { return []; }, updateChart: function () {}, getName: function () { return sh.getName(); }, setFrozenRows: function () {} };
}
function mc_chartsLabel_(sh) { return sh.__day ? 'CHARTS — this day and the last 20 sessions are below' : 'CHARTS  (choose the range at the top right)'; }
const MC_SNAP = [570, 600, 630, 660, 690, 720, 750, 780, 810, 840, 870, 900, 930, 959];
function mc_snapRow_(label, bars, fmt, base) {
  return [{ v: label, b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }].concat(MC_SNAP.map(function (m) {
    const v = mc_xAt_(bars, m); if (v === null) return { v: '—', fc: COLOR.GRAY };
    const ch = base === 'bp' ? (v - (mc_xAt_(bars, 570) || v)) * 100 : (v / (mc_xAt_(bars, 570) || v) - 1) * 100;
    return { v: fmt(v), bg: df_heat_(base === 'bp' ? -ch : ch, base === 'bp' ? 6 : 0.8), fc: COLOR.TEXT };
  }));
}
function mc_snapHead_() { return [{ v: 'ET', bg: COLOR.SUB, fc: COLOR.WHITE, b: true }].concat(MC_SNAP.map(function (m) { return { v: df_short_(in_hhmm_(m === 959 ? 960 : m)), bg: COLOR.SUB, fc: COLOR.WHITE, b: true }; })); }
function mc_hiLo_(bars) {
  const s = bars.filter(function (b) { return b.m >= 570 && b.m < 960; }); if (!s.length) return null;
  let hi = s[0], lo = s[0]; s.forEach(function (b) { if (b.h > hi.h) hi = b; if (b.l < lo.l) lo = b; });
  const t = function (m) { return md_ampm_(in_hhmm_(m)); };
  return { o: s[0].o, c: s[s.length - 1].c, hi: hi.h, hiT: t(hi.m), lo: lo.l, loT: t(lo.m) };
}
function mc_meterLine_(sh, r, D, key, label) {
  const x = ((D.info.meters || {})[key]) || { s: 0, st: 'GREEN', d: [] }, c = mc_color_(x.st);
  ui_box(sh, r, 2, r, 4, label + '  ● ' + x.st + '  ' + x.s, { bg: c[0], fc: c[1], bold: true, size: 10 });
  ui_box(sh, r, 5, r, 17, x.d.length ? x.d.join(' · ') : 'Calm on this day.', { h: 'left', size: 9, wrap: true });
  sh.setRowHeight(r, 28); return r + 2;
}
function mc_dayEvents_(k, cats) {
  if (!core_fnExists_('cat_eventsForDay')) return [];
  return cat_eventsForDay(k).filter(function (e) { return cats.indexOf(e.category) > -1; });
}
function mc_dayCurve_(sh, ctx, D, X, r) {
  const rows = D.rows, i = D.i;
  if (core_fnExists_('cv_daySection_')) { try { r = cv_daySection_(sh, ctx, D, X, r); } catch (e) { core_logError_('curve section', e); } }
  ui_header(sh, r, 2, 17, 'THIS DAY  —  ' + cal_pretty(D.asOf) + (D.asOf === ctx.k ? '' : '  (latest available)')); r++;
  r = mc_meterLine_(sh, r, D, 'rates', 'RATES');
  const yl = [['3-month', 'y_3m'], ['2-year', 'y_2y'], ['5-year', 'y_5y'], ['10-year', 'ten'], ['30-year', 'y_30y'], ['10Y real (TIPS)', 'real10'], ['10Y breakeven', 'be10']];
  const v = function (k, n) { return k === 'ten' ? mc_ten_(rows, i - n) : mc_val_(rows, i - n, k); };
  const bp = function (k, n) { const a = v(k, 0), b = v(k, n); return a !== null && b !== null ? (a - b) * 100 : ''; };
  r = mc_table_(sh, r, ['Rate', 'Close', 'Δ 1 day', 'Δ 5 days', 'Δ 20 days', '1-year low', '1-year high'], yl.map(function (x) {
    const rp = mc_rangePos_(rows, i, x[1] === 'ten' ? 'tnx' : x[1]);
    return [{ v: x[0], b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }, { v: v(x[1], 0), nf: '0.000', b: true }, mc_bp_(bp(x[1], 1)), mc_bp_(bp(x[1], 5)), mc_bp_(bp(x[1], 20)), { v: rp.lo, nf: '0.00', bg: COLOR.HIS, fc: COLOR.HISF }, { v: rp.hi, nf: '0.00', bg: COLOR.HIS, fc: COLOR.HISF }];
  }).concat([[{ v: 'MOVE (bond volatility)', b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }, { v: mc_val_(rows, i, 'move'), nf: '0.0', b: true }, { v: mc_chg_(rows, i, 'move', 1) === '' ? '' : mc_val_(rows, i, 'move') - mc_val_(rows, i - 1, 'move'), nf: '+0.0;-0.0' }, '', '', '', '']]), [3, 2, 2, 2, 2, 2, 3]) + 1;
  const t0 = mc_ten_(rows, i), t1 = mc_ten_(rows, i - 1), y2 = mc_val_(rows, i, 'y_2y'), y2p = mc_val_(rows, i - 1, 'y_2y'), y3m = mc_val_(rows, i, 'y_3m'), y5 = mc_val_(rows, i, 'y_5y'), y30 = mc_val_(rows, i, 'y_30y');
  let shape = '—'; if (t0 !== null && t1 !== null && y2 !== null && y2p !== null) { const dT = t0 - t1, d2 = y2 - y2p, st = (t0 - y2) - (t1 - y2p); shape = (Math.abs(dT) < 0.01 && Math.abs(d2) < 0.01) ? 'Unchanged' : ((dT + d2) / 2 > 0 ? 'Bear ' : 'Bull ') + (st > 0 ? 'steepening' : 'flattening'); }
  ui_box(sh, r, 2, r, 17, 'Curve on this day: ' + shape + '   ·   2s10s ' + (t0 !== null && y2 !== null ? Math.round((t0 - y2) * 100) + ' bp' + (t1 !== null && y2p !== null ? ' (' + mc_bpTxt_(((t0 - y2) - (t1 - y2p)) * 100) + ')' : '') : '—') +
    '   ·   3m10y ' + (t0 !== null && y3m !== null ? Math.round((t0 - y3m) * 100) + ' bp' : '—') + '   ·   5s30s ' + (y30 !== null && y5 !== null ? Math.round((y30 - y5) * 100) + ' bp' : '—') +
    (D.info.erp !== null && D.info.erp !== undefined ? '   ·   equity risk premium ' + D.info.erp.toFixed(2) + '%' : ''), { bg: COLOR.HIS, fc: COLOR.HISF, bold: true, size: 9, h: 'left' });
  r += 2;
  const tn = X.tnx || [], hl = mc_hiLo_(tn);
  ui_header(sh, r, 2, 17, '10-YEAR YIELD THROUGH THE SESSION' + (hl ? '  —  ' + hl.o.toFixed(3) + '% → ' + hl.c.toFixed(3) + '% (' + mc_bpTxt_((hl.c - hl.o) * 100) + ')  ·  high ' + hl.hi.toFixed(3) + '% at ' + hl.hiT + '  ·  low ' + hl.lo.toFixed(3) + '% at ' + hl.loT : '')); r++;
  if (hl) { TW_(sh, r, 2, [mc_snapHead_().concat(['']), mc_snapRow_('10Y %', tn, function (x) { return x.toFixed(3); }, 'bp').concat([''])], { size: 8 }); r += 3; }
  else { df_placeholder_(sh, r, 2, 17, D.asOf === ctx.k ? 'Minute data for the 10-year starts with Macro → Backfill cross-asset minute bars (about 4 weeks) and every day going forward.' : 'Appears once this day has traded.'); r += 2; }
  const ev = mc_dayEvents_(D.asOf, ['Treasury', 'Fed']);
  ui_header(sh, r, 2, 17, 'TREASURY AUCTIONS & FED ON THIS DAY'); r++;
  if (ev.length) r = mc_table_(sh, r, ['Time', 'Event', 'Result', 'Previous / detail'], ev.map(function (e) { return [e.t ? md_ampm_(e.t) : '—', { v: e.name, h: 'left', b: e.importance === '★★★' }, { v: e.actual || '—', b: true }, { v: [e.previous, e.detail].filter(String).join(' · ') || '—', h: 'left' }]; }), [2, 6, 2, 6]) + 1;
  else { df_placeholder_(sh, r, 2, 17, 'No Treasury auctions or Fed events on this day.'); r += 2; }
  return r;
}
function mc_dayFx_(sh, ctx, D, X, r) {
  const rows = D.rows, i = D.i;
  ui_header(sh, r, 2, 17, 'THIS DAY  —  ' + cal_pretty(D.asOf) + (D.asOf === ctx.k ? '' : '  (latest available)')); r++;
  r = mc_meterLine_(sh, r, D, 'carry', 'DOLLAR / YEN');
  r = mc_table_(sh, r, ['Pair', 'Close', 'This day', '5 days', '20 days', 'Where in 1-yr range'], ['dxy', 'usdjpy', 'eurusd', 'gbpusd', 'usdcnh', 'audjpy', 'mxnjpy'].map(function (k) {
    const rp = mc_rangePos_(rows, i, k);
    return [{ v: mc_label_(k), b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }, { v: mc_val_(rows, i, k), nf: '0.00##', b: true }, mc_pc_(mc_chg_(rows, i, k, 1)), mc_pc_(mc_chg_(rows, i, k, 5)), mc_pc_(mc_chg_(rows, i, k, 20)), rp.pos === '' ? '—' : Math.round(rp.pos * 100) + '%'];
  }), [4, 2, 2, 2, 2, 4]) + 1;
  const u = X.usdjpy || [], hl = mc_hiLo_(u);
  ui_header(sh, r, 2, 17, 'USD/JPY THROUGH THE SESSION' + (hl ? '  —  ' + hl.o.toFixed(2) + ' → ' + hl.c.toFixed(2) + ' (' + mc_pcTxt_(hl.c / hl.o - 1) + ')  ·  high ' + hl.hi.toFixed(2) + ' at ' + hl.hiT + '  ·  low ' + hl.lo.toFixed(2) + ' at ' + hl.loT : '')); r++;
  if (hl) { TW_(sh, r, 2, [mc_snapHead_().concat(['']), mc_snapRow_('USD/JPY', u, function (x) { return x.toFixed(2); }, 'bp').concat([''])], { size: 8 }); r += 3; }
  else { df_placeholder_(sh, r, 2, 17, 'Minute data for USD/JPY starts with Macro → Backfill cross-asset minute bars and every day going forward.'); r += 2; }
  const jg = mc_val_(rows, i, 'jgb10'), jgp = mc_val_(rows, i - 1, 'jgb10'), t0 = mc_ten_(rows, i), t1 = mc_ten_(rows, i - 1), boj = MC_BOJ.filter(function (d) { return d >= D.asOf; })[0];
  ui_box(sh, r, 2, r, 17, 'JGB 10Y ' + (jg !== null ? jg.toFixed(3) + '%' : '—') + '   ·   US–Japan 10Y spread ' + (jg !== null && t0 !== null ? Math.round((t0 - jg) * 100) + ' bp' + (jgp !== null && t1 !== null ? ' (' + mc_bpTxt_(((t0 - jg) - (t1 - jgp)) * 100) + ' this day)' : '') : '—') +
    '   ·   Nikkei ' + mc_pcTxt_(mc_chg_(rows, i, 'n225', 1)) + '   ·   ' + (MC_BOJ.indexOf(D.asOf) > -1 ? 'Bank of Japan decided on this day' : (boj ? 'Next Bank of Japan decision ' + cal_pretty(boj) : '')), { bg: COLOR.HIS, fc: COLOR.HISF, bold: true, size: 9, h: 'left' });
  return r + 2;
}
function mc_dayGlobal_(sh, ctx, D, X, r) {
  const rows = D.rows, i = D.i;
  ui_header(sh, r, 2, 17, 'THIS DAY  —  ' + cal_pretty(D.asOf) + (D.asOf === ctx.k ? '' : '  (latest available)')); r++;
  r = mc_meterLine_(sh, r, D, 'global', 'GLOBAL');
  const idx = [['n225', 'Asia', 'Closed before the U.S. open'], ['hsi', 'Asia', 'Closed before the U.S. open'], ['sse', 'Asia', 'Closed before the U.S. open'], ['kospi', 'Asia', 'Closed before the U.S. open'], ['asx', 'Asia', 'Closed before the U.S. open'],
    ['dax', 'Europe', 'Closed 11:30 AM ET, during the U.S. session'], ['ftse', 'Europe', 'Closed 11:30 AM ET'], ['cac', 'Europe', 'Closed 11:30 AM ET'], ['sx5e', 'Europe', 'Closed 11:30 AM ET'], ['eem', 'EM', 'Traded with the U.S. session']];
  const list = idx.map(function (z) { return { z: z, c: mc_chg_(rows, i, z[0], 1) }; }).filter(function (x) { return x.c !== ''; }).sort(function (a, b) { return b.c - a.c; });
  r = mc_table_(sh, r, ['Rank', 'Index', 'Region', 'This day', '5 days', 'Timing vs the U.S. session'], list.map(function (x, j) {
    return [j + 1, { v: mc_label_(x.z[0]), b: true, h: 'left' }, { v: x.z[1], bg: COLOR.PUR, fc: COLOR.PURF }, mc_pc_(x.c), mc_pc_(mc_chg_(rows, i, x.z[0], 5)), { v: x.z[2], fc: COLOR.GRAY, h: 'left' }];
  }), [1, 3, 2, 2, 2, 6]) + 1;
  const asia = list.filter(function (x) { return x.z[1] === 'Asia'; }), eu = list.filter(function (x) { return x.z[1] === 'Europe'; });
  const avg = function (a) { return a.length ? a.reduce(function (s, x) { return s + x.c; }, 0) / a.length : ''; };
  ui_box(sh, r, 2, r, 17, 'Into the U.S. open, Asia averaged ' + mc_pcTxt_(avg(asia)) + (list.length ? ' (best ' + mc_label_(list[0].z[0]) + ' ' + mc_pcTxt_(list[0].c) + ', worst ' + mc_label_(list[list.length - 1].z[0]) + ' ' + mc_pcTxt_(list[list.length - 1].c) + ')' : '') +
    '. Europe, which closes mid-session, averaged ' + mc_pcTxt_(avg(eu)) + '.', { bg: COLOR.HIS, fc: COLOR.HISF, bold: true, size: 9, h: 'left', wrap: true });
  sh.setRowHeight(r, 30);
  return r + 2;
}
function mc_dayCommod_(sh, ctx, D, X, r) {
  const rows = D.rows, i = D.i;
  ui_header(sh, r, 2, 17, 'THIS DAY  —  ' + cal_pretty(D.asOf) + (D.asOf === ctx.k ? '' : '  (latest available)')); r++;
  r = mc_meterLine_(sh, r, D, 'oil', 'OIL');
  r = mc_meterLine_(sh, r - 1, D, 'crypto', 'CRYPTO');
  r = mc_table_(sh, r, ['Market', 'Close', 'This day', '5 days', '20 days', 'Where in 1-yr range'], ['wti', 'brent', 'natgas', 'gold', 'silver', 'copper', 'btc', 'eth'].map(function (k) {
    const rp = mc_rangePos_(rows, i, k);
    return [{ v: mc_label_(k) + (k === 'btc' && cal_dow(D.asOf) === 1 ? ' (incl. weekend)' : ''), b: true, bg: COLOR.LAB, fc: COLOR.LABF, h: 'left' }, { v: mc_val_(rows, i, k), nf: '#,##0.00', b: true }, mc_pc_(mc_chg_(rows, i, k, 1)), mc_pc_(mc_chg_(rows, i, k, 5)), mc_pc_(mc_chg_(rows, i, k, 20)), rp.pos === '' ? '—' : Math.round(rp.pos * 100) + '%'];
  }), [4, 2, 2, 2, 2, 4]) + 1;
  const W = X.wti || [], G = X.gold || [], B = X.btc || [], hw = mc_hiLo_(W), hg = mc_hiLo_(G), hb = mc_hiLo_(B);
  ui_header(sh, r, 2, 17, 'OIL, GOLD & BITCOIN THROUGH THE SESSION  (shaded by the move from 9:30)'); r++;
  if (hw || hg || hb) {
    TW_(sh, r, 2, [mc_snapHead_().concat(['']), mc_snapRow_('WTI', W, function (x) { return x.toFixed(2); }).concat(['']), mc_snapRow_('Gold', G, function (x) { return Math.round(x).toLocaleString('en-US'); }).concat(['']), mc_snapRow_('Bitcoin', B, function (x) { return Math.round(x).toLocaleString('en-US'); }).concat([''])], { size: 8 });
    r += 5;
    ui_box(sh, r, 2, r, 17, [hw ? 'WTI ' + mc_pcTxt_(hw.c / hw.o - 1) + ' · high ' + hw.hiT + ' · low ' + hw.loT : '', hg ? 'Gold ' + mc_pcTxt_(hg.c / hg.o - 1) + ' · high ' + hg.hiT + ' · low ' + hg.loT : '', hb ? 'Bitcoin ' + mc_pcTxt_(hb.c / hb.o - 1) + ' · high ' + hb.hiT + ' · low ' + hb.loT : ''].filter(String).join('     |     '), { size: 9, h: 'left', bold: true });
    r += 2;
  } else { df_placeholder_(sh, r, 2, 17, 'Minute data for oil, gold and Bitcoin starts with Macro → Backfill cross-asset minute bars and every day going forward.'); r += 2; }
  const eia = mc_dayEvents_(D.asOf, ['Energy']);
  if (eia.length) { ui_box(sh, r, 2, r, 17, eia.map(function (e) { return (e.t ? md_ampm_(e.t) + ' ' : '') + e.name + (e.actual ? ': ' + e.actual : '') + (e.previous ? ' (previous ' + e.previous + ')' : ''); }).join('   ·   '), { bg: COLOR.PUR, fc: COLOR.PURF, bold: true, size: 9, h: 'left' }); r += 2; }
  const sec = MC_SYM.filter(function (x) { return x[3] === 'sector'; }).map(function (x) { return { x: x, c: mc_chg_(rows, i, x[0], 1) }; }).filter(function (y) { return y.c !== ''; }).sort(function (a, b) { return b.c - a.c; });
  if (sec.length >= 6) {
    ui_header(sh, r, 2, 17, 'SECTORS ON THIS DAY  —  leaders and laggards'); r++;
    const lead = sec.slice(0, 4), lag = sec.slice(-4).reverse();
    r = mc_table_(sh, r, ['Leaders', 'This day', 'Laggards', 'This day'], lead.map(function (y, j) { return [{ v: y.x[1] + ' · ' + y.x[2], h: 'left', fc: COLOR.GRN, b: true }, mc_pc_(y.c), { v: lag[j].x[1] + ' · ' + lag[j].x[2], h: 'left', fc: COLOR.RED, b: true }, mc_pc_(lag[j].c)]; }), [5, 3, 5, 3]) + 1;
  }
  return r;
}
/** Charts for a day tab, built from this file's own chart data (created once, then only their data changes). */
function mc_dayCharts_(name, sh, ctx, D, X, row) {
  if (name === 'Global Markets') return;
  const cd = ctx.ss.getSheetByName('_ChartData'); if (!cd) return;
  if (cd.getMaxColumns() < 80) cd.insertColumnsAfter(cd.getMaxColumns(), 80 - cd.getMaxColumns());
  if (cd.getMaxRows() < 420) cd.insertRowsAfter(cd.getMaxRows(), 420 - cd.getMaxRows());
  const put = function (col, head, data) { cd.getRange(1, col, 420, head.length).clearContent(); cd.getRange(1, col, 1, head.length).setValues([head]); if (data.length) cd.getRange(2, col, data.length, head.length).setValues(data); };
  const rows = D.rows, i = D.i, last = rows.slice(Math.max(0, i - 19), i + 1), lab = function (r) { return String(r.date).slice(5).replace('-', '/'); }, val = function (r, k) { const x = r[k]; return x === '' || x === undefined || x === null ? '' : Number(x); };
  const intra = function (bars, fn) { return bars.filter(function (b) { return b.m >= 570 && b.m < 960; }).map(function (b) { return [md_ampm_(in_hhmm_(b.m)).replace(' AM', 'a').replace(' PM', 'p'), fn(b)]; }); };
  const specs = [];
  if (name === 'Yield Curve') {
    const g = function (n, k) { const x = mc_val_(rows, i - n, k); return x === null ? '' : x; };
    put(45, ['Maturity', 'This day', '1 day before', '1 week before', '1 month before'], MC_CURVE.map(function (m) { return [m[0], g(0, m[1]), g(1, m[1]), g(5, m[1]), g(21, m[1])]; }));
    const t2 = X.us2y || [];
    put(51, ['Time', '10Y %', '2Y %'], intra(X.tnx || [], function (b) { return b.c; }).map(function (r0, j) { const tb = (X.tnx || []).filter(function (b) { return b.m >= 570 && b.m < 960; })[j]; const v2 = tb ? mc_xAt_(t2, tb.m) : null; return [r0[0], r0[1], v2 === null ? '' : v2]; }));
    put(54, ['Date', '2Y', '10Y'], last.map(function (r) { return [lab(r), val(r, 'y_2y'), val(r, 'tnx') !== '' ? val(r, 'tnx') : val(r, 'y_10y')]; }));
    specs.push(['AS1:AW12', 'The curve: this day vs 1 day, 1 week, 1 month before', { colors: ['#1F2A44', '#0F6E56', '#BA7517', '#B4B2A9'], pointSize: 4 }], ['AY1:BA400', '10-year and 2-year yields through the session', { colors: ['#B42318', '#0F6E56'], series: { 1: { targetAxisIndex: 1 } } }], ['BB1:BD21', '2Y and 10Y — last 20 sessions', { colors: ['#0F6E56', '#1F2A44'] }]);
  }
  if (name === 'FX & Carry') {
    put(58, ['Time', 'USD/JPY'], intra(X.usdjpy || [], function (b) { return b.c; }));
    put(61, ['Date', 'USD/JPY', 'DXY'], last.map(function (r) { return [lab(r), val(r, 'usdjpy'), val(r, 'dxy')]; }));
    specs.push(['BF1:BG400', 'USD/JPY through the session', { colors: ['#B42318'] }], ['BI1:BK21', 'USD/JPY and the dollar index — last 20 sessions', { colors: ['#B42318', '#1F2A44'], series: { 1: { targetAxisIndex: 1 } } }]);
  }
  if (name === 'Commodities & Crypto') {
    const w = X.wti || [], g2 = X.gold || [], w0 = mc_xAt_(w, 570), g0 = mc_xAt_(g2, 570);
    put(65, ['Time', 'WTI % from 9:30', 'Gold % from 9:30'], w.filter(function (b) { return b.m >= 570 && b.m < 960; }).map(function (b) { const gv = mc_xAt_(g2, b.m); return [md_ampm_(in_hhmm_(b.m)).replace(' AM', 'a').replace(' PM', 'p'), w0 ? (b.c / w0 - 1) * 100 : '', gv && g0 ? (gv / g0 - 1) * 100 : '']; }));
    put(69, ['Time', 'Bitcoin'], intra(X.btc || [], function (b) { return b.c; }));
    put(72, ['Date', 'WTI', 'Gold'], last.map(function (r) { return [lab(r), val(r, 'wti'), val(r, 'gold')]; }));
    specs.push(['BM1:BO400', 'Oil and gold through the session (% from 9:30)', { colors: ['#1F2A44', '#BA7517'] }], ['BQ1:BR400', 'Bitcoin through the session', { colors: ['#534AB7'] }], ['BT1:BV21', 'WTI and gold — last 20 sessions', { colors: ['#1F2A44', '#BA7517'], series: { 1: { targetAxisIndex: 1 } } }]);
  }
  const noMin = !((X.tnx || []).length || (X.usdjpy || []).length || (X.wti || []).length);
  ui_header(sh, row, 2, 17, 'CHARTS  —  this day and the last 20 sessions' + (noMin ? '   (no minute data for this day — the intraday charts stay empty)' : (name === 'Yield Curve' && !(X.us2y || []).length ? '   (2-year minute data unavailable — the 10-year is shown alone)' : '')));
  const have = sh.getCharts();
  specs.forEach(function (s, j) {
    const at = [row + 1 + Math.floor(j / 2) * 18, j % 2 ? 10 : 2];
    if (have[j]) { sh.updateChart(have[j].modify().clearRanges().addRange(cd.getRange(s[0])).setPosition(at[0], at[1], 0, 0).build()); return; }
    let b = sh.newChart().setChartType(Charts.ChartType.LINE).addRange(cd.getRange(s[0])).setNumHeaders(1).setPosition(at[0], at[1], 0, 0)
      .setOption('title', s[1]).setOption('legend', { position: 'bottom' }).setOption('width', 640).setOption('height', 300).setOption('fontName', FONT).setOption('lineWidth', 1.6);
    Object.keys(s[2]).forEach(function (k) { b = b.setOption(k, s[2][k]); });
    sh.insertChart(b.build());
  });
  SpreadsheetApp.flush(); mc_scaleCharts_(sh);
}

/* =============================================================================
 * INSTRUCTIONS
 * ========================================================================== */
function mc_instructions() {
  return [
    { title: 'Macro — rates, FX & carry, global, commodities, crypto (Macro.gs)', blocks: [
      { text: 'Macro.gs adds the cross-asset picture: about 50 markets plus the official Treasury curve, real yields, credit spreads, Fed liquidity, JGBs and weekly positioning. Eight stress meters (0 calm → 100 stress) summarize it, with plain-English reasons, and every day\'s snapshot is kept in its day file so you can look back years from now.' },
      { table: { head: ['Meter', 'Turns yellow / red when…'], rows: [
        ['Rates', '10Y rises fast (more than ~10 bp in 5 days), sits at a 1-year high, 30Y above 5%, bond volatility (MOVE) is high, the curve bear-steepens, or the equity risk premium is thin / negative.'],
        ['Credit', 'High-yield spreads widen quickly or exceed 4–5%. Credit usually cracks before stocks.'],
        ['Dollar / Yen', 'The yen strengthens fast, USD/JPY volatility jumps, AUD/JPY falls, the Nikkei drops, or the US–Japan yield gap narrows — the signature of a carry-trade unwind (August 2024).'],
        ['Oil', 'WTI moves more than ~6% in 5 days or 4% in a day, oil volatility (OVX) above 40, or the Brent–WTI spread blows out.'],
        ['Volatility', 'VIX above 20 / 25 / 30, VIX term structure inverted, or a VIX spike.'],
        ['Global', 'Several major overseas indices fall 1%+ overnight.'],
        ['Liquidity', 'Fed balance sheet − Treasury account − reverse repo falls more than $150–300bn in 20 days.'],
        ['Crypto', 'Bitcoin falls 5%+ in a day (Monday = the weekend) or 10%+ in 5 days.']
      ] } },
      { table: { head: ['Where', 'What you see'], rows: [
        ['Report — row under the calendar flags', 'MACRO RADAR: eight pills (green / yellow / red). Hover a pill for its score and reasons.'],
        ['Game Plan — top banner', 'WHAT MATTERS TODAY: the most important alerts plus today\'s ★★★ releases and earnings.'],
        ['Day file — Macro tab', 'That day\'s alerts, meters, full curve, currencies, global markets, commodities, crypto, sectors and correlations.'],
        ['Hub — Macro Radar, Yield Curve, FX & Carry, Global Markets, Commodities & Crypto', 'The live dashboards with history and charts (pick 1M / 3M / 1Y / 2Y at the top right).'],
        ['Day file — Yield Curve, FX & Carry, Global Markets, Commodities & Crypto tabs', 'The same four pictures as the hub, frozen for that day: a day-focused section first (the day\'s moves, intraday paths, auctions / Fed / EIA, leaders and laggards), then the full picture as it stood that day, then charts of the day and the last 20 sessions.'],
        ['Day file — 1-Min Tape (columns T–X) and Macro tab', 'Minute bars for the 10Y yield, WTI, gold, USD/JPY and Bitcoin beside SPX, and how each traded during the session and during the day\'s biggest SPX swing. Captured every refresh; Macro → Backfill cross-asset minute bars loads about 4 weeks.']
      ] } },
      { steps: [
        'Market Report → Setup → Build / rebuild ALL hub tabs (creates the five macro tabs).',
        'Market Report → Macro → Backfill macro history (2 years, about 1–2 minutes).',
        'Market Report → Day files → Rebuild the day template, then Build or rebuild a specific day for any day you want refreshed, and Build / refresh future days now.',
        'Market Report → Setup → Install / refresh automatic triggers. Macro then updates at the morning prep and the end of day, positioning weekly.'
      ] },
      { tip: 'Forward P/E is automatic from two sources, shown on the Report\'s Market Context: FactSet (weekly, from its Earnings Insight) and S&P Dow Jones Indices (daily: the S&P close ÷ the next four quarters of operating EPS estimates). The equity risk premium uses their average, and the Rates meter warns when it is thin or negative.' },
      { warn: 'Bank of Japan meeting dates are listed in Macro.gs for 2026. Ask for an update when the 2027 schedule is published.' }
    ] }
  ];
}
