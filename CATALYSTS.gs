/*******************************************************************************
 * Catalysts.gs  v2.7
 * SPX Daily Market Analysis — economic events, Fed, Treasury auctions,
 * earnings and headlines
 *
 * Owns:  Event Master (visible)      — every event type, with a Track checkbox
 *        Event Lookup (visible)      — pick an event, see every past release
 *                                      with Actual / Previous / Consensus /
 *                                      Forecast and the minute-by-minute reaction
 *        Earnings Watchlist (visible)— your tracked companies, next reports
 *        _EventLog  (hidden)         — one row per release / auction / speech
 *        _Earnings  (hidden)         — one row per company report
 *        _Headlines (hidden)         — every headline captured, with reactions
 * Feeds the day files (Report, Game Plan, Events & Earnings, Headlines,
 * Event Reactions) and the move matching in Intraday.gs.
 * Sources: FRED (free key), Alpha Vantage (free key), Treasury Fiscal Data,
 * Federal Reserve RSS, public news RSS. Requires Core 2.3+, MarketData 2.0+,
 * Intraday 1.1+, DayFile 1.1+.
 ******************************************************************************/

const CAT_VERSION = '2.7';

/* =============================================================================
 * THE EVENT LIST  (key, tracked by default, category, name, importance, time ET, source, spec)
 *   fred: series id · u: FRED units (pch = % change, pc1 = % change y/y, chg = change, lin = level)
 *   d: decimals · s: suffix · div: divide by · rule: how the date is found when no free schedule exists
 * ========================================================================== */
const CAT_EVENTS = [
  ['cpi_mm', true, 'Inflation', 'CPI m/m', '★★★', '08:30', 'FRED', { fred: 'CPIAUCSL', u: 'pch', d: 1, s: '%' }],
  ['core_cpi_mm', true, 'Inflation', 'Core CPI m/m', '★★★', '08:30', 'FRED', { fred: 'CPILFESL', u: 'pch', d: 1, s: '%' }],
  ['cpi_yy', true, 'Inflation', 'CPI y/y', '★★', '08:30', 'FRED', { fred: 'CPIAUCSL', u: 'pc1', d: 1, s: '%' }],
  ['ppi_mm', true, 'Inflation', 'PPI m/m', '★★', '08:30', 'FRED', { fred: 'PPIFIS', u: 'pch', d: 1, s: '%' }],
  ['core_pce', true, 'Inflation', 'Core PCE price index m/m', '★★★', '08:30', 'FRED', { fred: 'PCEPILFE', u: 'pch', d: 1, s: '%' }],
  ['pce_mm', false, 'Inflation', 'PCE price index m/m', '★★', '08:30', 'FRED', { fred: 'PCEPI', u: 'pch', d: 1, s: '%' }],
  ['nfp', true, 'Jobs', 'Nonfarm payrolls', '★★★', '08:30', 'FRED', { fred: 'PAYEMS', u: 'chg', d: 0, s: 'K' }],
  ['unrate', true, 'Jobs', 'Unemployment rate', '★★★', '08:30', 'FRED', { fred: 'UNRATE', u: 'lin', d: 1, s: '%' }],
  ['ahe', true, 'Jobs', 'Average hourly earnings m/m', '★★', '08:30', 'FRED', { fred: 'CES0500000003', u: 'pch', d: 1, s: '%' }],
  ['claims', true, 'Jobs', 'Initial jobless claims', '★★', '08:30', 'FRED', { fred: 'ICSA', u: 'lin', d: 0, s: 'K', div: 1000 }],
  ['cont_claims', false, 'Jobs', 'Continuing jobless claims', '★', '08:30', 'FRED', { fred: 'CCSA', u: 'lin', d: 2, s: 'M', div: 1000000 }],
  ['jolts', true, 'Jobs', 'JOLTS job openings', '★★', '10:00', 'FRED', { fred: 'JTSJOL', u: 'lin', d: 2, s: 'M', div: 1000 }],
  ['adp', true, 'Jobs', 'ADP employment', '★★', '08:15', 'Rule: 2 days before payrolls', { rule: 'nfp', offset: -2 }],
  ['retail', true, 'Growth', 'Retail sales m/m', '★★', '08:30', 'FRED', { fred: 'RSAFS', u: 'pch', d: 1, s: '%' }],
  ['gdp', true, 'Growth', 'GDP q/q (annualized)', '★★★', '08:30', 'FRED', { fred: 'A191RL1Q225SBEA', u: 'lin', d: 1, s: '%', est: ['advance estimate', 'second estimate', 'third estimate'] }],
  ['spending', false, 'Growth', 'Personal spending m/m', '★', '08:30', 'FRED', { fred: 'PCE', u: 'pch', d: 1, s: '%' }],
  ['durables', true, 'Growth', 'Durable goods orders m/m', '★★', '08:30', 'FRED', { fred: 'DGORDER', u: 'pch', d: 1, s: '%', minDay: 16 }],
  ['indpro', false, 'Growth', 'Industrial production m/m', '★', '09:15', 'FRED', { fred: 'INDPRO', u: 'pch', d: 1, s: '%' }],
  ['empire', false, 'Growth', 'Empire State manufacturing', '★', '08:30', 'FRED', { fred: 'GACDINA066MNFRBNY', u: 'lin', d: 1, s: '' }],
  ['philly', false, 'Growth', 'Philly Fed manufacturing', '★', '08:30', 'FRED', { fred: 'GACDFSA066MSFRBPHI', u: 'lin', d: 1, s: '' }],
  ['ism_mfg', true, 'Surveys', 'ISM manufacturing PMI', '★★★', '10:00', 'Rule: 1st business day', { rule: 'bizday', n: 1 }],
  ['ism_svc', true, 'Surveys', 'ISM services PMI', '★★★', '10:00', 'Rule: 3rd business day', { rule: 'bizday', n: 3 }],
  ['sp_mfg', false, 'Surveys', 'S&P Global manufacturing PMI (final)', '★', '09:45', 'Rule: 1st business day', { rule: 'bizday', n: 1 }],
  ['sp_comp', true, 'Surveys', 'S&P Global composite / services PMI (final)', '★★', '09:45', 'Rule: 3rd business day', { rule: 'bizday', n: 3 }],
  ['sp_flash', true, 'Surveys', 'S&P Global flash PMIs', '★★', '09:45', 'Your dates', { manual: true }],
  ['umich', true, 'Surveys', 'UMich consumer sentiment', '★★', '10:00', 'FRED', { fred: 'UMCSENT', u: 'lin', d: 1, s: '', est: ['preliminary', 'final'] }],
  ['confboard', true, 'Surveys', 'Conference Board consumer confidence', '★★', '10:00', 'Rule: last Tuesday', { rule: 'lastdow', dow: 2 }],
  ['houst', true, 'Housing', 'Housing starts', '★', '08:30', 'FRED', { fred: 'HOUST', u: 'lin', d: 2, s: 'M', div: 1000 }],
  ['newhome', false, 'Housing', 'New home sales', '★', '10:00', 'FRED', { fred: 'HSN1F', u: 'lin', d: 0, s: 'K' }],
  ['existing', false, 'Housing', 'Existing home sales', '★', '10:00', 'FRED', { fred: 'EXHOSLUSM495S', u: 'lin', d: 2, s: 'M', div: 1000000 }],
  ['fomc', true, 'Fed', 'FOMC rate decision', '★★★', '14:00', 'Fed calendar + FRED', { fomc: 'decision' }],
  ['fomc_min', true, 'Fed', 'FOMC minutes', '★★', '14:00', 'Fed calendar', { fomc: 'minutes' }],
  ['beige', false, 'Fed', 'Fed Beige Book', '★', '14:00', 'Rule: 2 weeks before FOMC', { rule: 'fomc', offset: -14 }],
  ['fed_speech', true, 'Fed', 'Fed speeches & testimony', '★★', '', 'Federal Reserve RSS', { rss: true }],
  ['eia_crude', true, 'Energy', 'EIA crude oil inventories', '★★', '10:30', 'Rule: every Wednesday (Thursday after a holiday)', { rule: 'weekly', dow: 3 }],
  ['opec', true, 'Energy', 'OPEC+ meeting', '★★', '', 'Your dates', { manual: true }],
  ['boj', true, 'Global', 'Bank of Japan decision (overnight)', '★★', '', 'BoJ calendar (Macro.gs)', { boj: true }],
  ['t2', true, 'Treasury', '2-year note auction', '★', '13:00', 'Treasury', { term: 2 }],
  ['t3', true, 'Treasury', '3-year note auction', '★★', '13:00', 'Treasury', { term: 3 }],
  ['t5', true, 'Treasury', '5-year note auction', '★', '13:00', 'Treasury', { term: 5 }],
  ['t7', true, 'Treasury', '7-year note auction', '★', '13:00', 'Treasury', { term: 7 }],
  ['t10', true, 'Treasury', '10-year note auction', '★★', '13:00', 'Treasury', { term: 10 }],
  ['t20', false, 'Treasury', '20-year bond auction', '★', '13:00', 'Treasury', { term: 20 }],
  ['t30', true, 'Treasury', '30-year bond auction', '★★', '13:00', 'Treasury', { term: 30 }]
];
const CAT_WATCH = [
  ['NVDA', 'Nvidia', true], ['MSFT', 'Microsoft', true], ['AAPL', 'Apple', true], ['AMZN', 'Amazon', true], ['GOOGL', 'Alphabet', true],
  ['META', 'Meta Platforms', true], ['AVGO', 'Broadcom', true], ['TSLA', 'Tesla', true], ['JPM', 'JPMorgan Chase', true], ['NFLX', 'Netflix', true],
  ['BRK-B', 'Berkshire Hathaway', false], ['LLY', 'Eli Lilly', false], ['V', 'Visa', false], ['WMT', 'Walmart', false], ['ORCL', 'Oracle', false],
  ['MA', 'Mastercard', false], ['XOM', 'Exxon Mobil', false], ['COST', 'Costco', false], ['UNH', 'UnitedHealth', false], ['AMD', 'AMD', false],
  ['MU', 'Micron', false], ['GS', 'Goldman Sachs', false], ['BAC', 'Bank of America', false], ['CRM', 'Salesforce', false], ['ADBE', 'Adobe', false]
];
const CAT_FEEDS = [
  ['CNBC', 'https://www.cnbc.com/id/100003114/device/rss/rss.html'],
  ['MarketWatch', 'https://feeds.content.dowjones.io/public/rss/mw_topstories'],
  ['Yahoo Finance', 'https://finance.yahoo.com/news/rssindex'],
  ['Google News', 'https://news.google.com/rss/search?q=%22stock+market%22+OR+%22S%26P+500%22+OR+%22Federal+Reserve%22+OR+Treasury+yields+when:1d&hl=en-US&gl=US&ceid=US:en']
];
const CAT_RELEVANT = /stock|s&p|dow |nasdaq|wall street|market|fed\b|federal reserve|powell|rate|yield|treasur|inflation|cpi|pce|jobs|payroll|unemploy|gdp|tariff|trade|oil|opec|china|iran|israel|russia|ukraine|earnings|recession|bank|dollar|bond|futures|vix|sell-?off|rally|economy|consumer/i;
const CAT_HIGH = /\bfed\b|fomc|powell|rate (cut|hike)|cpi\b|inflation|jobs report|payrolls|tariff|sanction|iran|\bwar\b|attack|missile|default|shutdown|downgrade|crash|plunge|record high|emergency|halt/i;
const CAT_MED = /yield|treasur|oil|opec|earnings|gdp|retail sales|jobless|china|bank|dollar|guidance|layoff|strike/i;
const CAT_TAGS = [['Fed', /\bfed\b|\bfomc\b|\bpowell\b|federal reserve|\bwaller\b|\bwilliams\b|\bjefferson\b|\bbowman\b|\bbarr\b|\bcook\b|\blogan\b|\bgoolsbee\b|\bkashkari\b|\bhammack\b|\bwarsh\b|\bbarkin\b|\bmusalem\b/i], ['Energy', /\boil\b|\bopec\b|\bcrude\b|\bbrent\b|\bwti\b|natural gas|\bgasoline\b|\brefiner/i],
  ['Rates', /\byields?\b|\btreasur|\bbonds?\b/i], ['Inflation', /\binflation\b|\bcpi\b|\bpce\b|\bprices\b/i], ['Jobs', /\bjobs?\b|\bpayrolls?\b|\bunemploy|\bjobless\b|\blabor market\b/i], ['Trade', /\btariffs?\b|trade (war|deal|talks|deficit)|trade agreement|export controls/i],
  ['Geopolitics', /\biran\b|\bisrael\b|\brussia\b|\bukraine\b|\bchina\b|\btaiwan\b|\bwar\b|\bmissiles?\b|\battack|\bsanctions?\b|\bhormuz\b/i], ['Earnings', /\bearnings\b|\brevenue\b|\bguidance\b|\bprofits?\b/i], ['Growth', /\bgdp\b|\bretail sales\b|\brecession\b|\beconomy\b|\bconsumer\b/i]];

/* =============================================================================
 * DATABASE SPECS
 * ========================================================================== */
function cat_masterSpec_() {
  const T = FMT.TEXT;
  return { name: 'Event Master', hidden: false, tab: COLOR.TAB_CAT,
    title: 'EVENT MASTER  —  choose the events you track',
    subtitle: 'Tick "Track" for anything you want on your day files, in Event Lookup and in move matching. For events without a free schedule, type upcoming dates in "Your dates" (YYYY-MM-DD, comma-separated).',
    cols: [['key', 'Key', 11, T], ['track', 'Track', 7, T, 'input'], ['category', 'Category', 11, T], ['name', 'Event', 38, T], ['importance', 'Importance', 10, T, 'input'],
      ['time', 'Time (ET)', 9, T], ['source', 'Source', 24, T], ['details', 'Details', 26, T], ['manual', 'Your dates', 26, T, 'input'], ['notes', 'Notes', 26, T, 'input']] };
}
function cat_watchSpec_() {
  const T = FMT.TEXT;
  return { name: 'Earnings Watchlist', hidden: false, tab: COLOR.TAB_CAT,
    title: 'EARNINGS WATCHLIST  —  the companies you track',
    subtitle: 'Tick "Track" for your top companies (about 10 keeps the free earnings feed well within its limit). Dates, timing, estimates and results fill automatically; whisper, confirmed and notes are yours.',
    cols: [['track', 'Track', 7, T, 'input'], ['ticker', 'Ticker', 8, T, 'input'], ['company', 'Company', 20, T, 'input'], ['next_date', 'Next report', 12, T], ['timing', 'Timing', 12, T],
      ['est', 'EPS est.', 9, FMT.NUM2], ['last_date', 'Last report', 12, T], ['last_eps', 'EPS actual', 9, FMT.NUM2], ['last_surprise', 'Surprise', 9, '+0.0%;-0.0%;0.0%'],
      ['last_move', 'Stock move', 9, '+0.0%;-0.0%;0.0%'], ['spx_next', 'SPX that session', 9, FMT.PCT], ['whisper', 'Whisper', 9, FMT.NUM2, 'input'],
      ['confirmed', 'Confirmed', 9, T, 'input'], ['notes', 'Notes', 28, T, 'input'], ['updated', 'Updated', 15, T]] };
}
function cat_logSpec_() {
  const T = FMT.TEXT, D = FMT.PTS1;
  return { name: '_EventLog', hidden: true, freezeCols: 2,
    title: '_EventLog  —  every release, auction, decision and speech',
    subtitle: 'One row per occurrence. Scheduled days in advance; actuals, reactions and your consensus / forecast / notes fill in over time.',
    cols: [['id', 'ID', 22, T], ['date', 'Date', 11, T], ['time', 'Time', 7, T], ['key', 'Key', 11, T], ['name', 'Event', 34, T], ['category', 'Category', 10, T], ['importance', 'Imp.', 6, T],
      ['actual', 'Actual', 10, T], ['previous', 'Previous', 10, T], ['consensus', 'Consensus', 10, T, 'input'], ['forecast', 'Forecast', 10, T, 'input'], ['surprise', 'Surprise', 8, '+0.00;-0.00;0'],
      ['detail', 'Detail', 30, T], ['status', 'Status', 10, T], ['series', 'Measured on', 8, T], ['w_pre', '−5 → 0', 7, D], ['w1', '+1', 7, D], ['w2', '+2', 7, D], ['w3', '+3', 7, D],
      ['w5', '+5', 7, D], ['w10', '+10', 7, D], ['w15', '+15', 7, D], ['w30', '+30', 7, D], ['w60', '+60', 7, D], ['w_close', 'To close', 8, D], ['peak', 'Peak', 7, D],
      ['peak_t', 'Peak time', 8, T], ['retrace', 'Back to pre-event (min)', 8, '0'], ['swing', 'Matched swing', 12, T], ['effect', 'Your market effect', 36, T, 'input'], ['updated', 'Updated', 15, T]] };
}
function cat_earnSpec_() {
  const T = FMT.TEXT;
  return { name: '_Earnings', hidden: true, title: '_Earnings  —  one row per company report',
    subtitle: 'From Alpha Vantage (estimates, results, timing) and Nasdaq (timing); stock and SPX moves from Yahoo / _Prices.',
    cols: [['id', 'ID', 18, T], ['ticker', 'Ticker', 8, T], ['fiscal', 'Fiscal quarter end', 12, T], ['date', 'Report date', 11, T], ['timing', 'Timing', 12, T],
      ['est', 'EPS est.', 9, FMT.NUM2], ['actual', 'EPS actual', 9, FMT.NUM2], ['surprise_pct', 'Surprise', 9, '+0.0%;-0.0%;0.0%'], ['move', 'Stock move', 9, '+0.0%;-0.0%;0.0%'],
      ['spx_next', 'SPX that session', 9, FMT.PCT], ['updated', 'Updated', 15, T]] };
}
function cat_newsSpec_() {
  const T = FMT.TEXT;
  return { name: '_Headlines', hidden: true, freezeCols: 3, title: '_Headlines  —  every headline captured',
    subtitle: 'Pulled from free news feeds through the day; relevance, tag and impact are automatic, "kept" and your tag / impact / note come from the day files.',
    cols: [['id', 'ID', 14, T], ['date', 'Date', 11, T], ['time', 'Time', 7, T], ['headline', 'Headline', 60, T], ['source', 'Source', 12, T], ['link', 'Link', 20, T],
      ['tag', 'Tag', 11, T, 'input'], ['impact', 'Impact', 8, T, 'input'], ['kept', 'Kept', 6, T, 'input'], ['w1', '+1', 7, FMT.PTS1], ['w5', '+5', 7, FMT.PTS1], ['w15', '+15', 7, FMT.PTS1],
      ['swing', 'Swing', 8, T], ['note', 'Your note', 30, T, 'input']] };
}

/* =============================================================================
 * BUILD (keeps every choice you've made)
 * ========================================================================== */
function cat_buildTabs() {
  [cat_logSpec_(), cat_earnSpec_(), cat_newsSpec_()].forEach(db_ensure);
  // Event Master: defaults + your Track / importance / dates / notes
  const mSpec = cat_masterSpec_(); db_ensure(mSpec);
  const have = {}; db_readAll(mSpec).rows.forEach(function (r) { have[String(r.key)] = r; });
  const rows = CAT_EVENTS.map(function (e) {
    const h = have[e[0]];
    return { key: e[0], track: h ? (h.track === true || String(h.track).toUpperCase() === 'TRUE') : e[1], category: e[2], name: e[3], importance: h && h.importance ? h.importance : e[4],
      time: e[5] ? md_ampm_(e[5]) : 'Varies', source: e[6], details: cat_details_(e[7]), manual: h ? h.manual : '', notes: h ? h.notes : '' };
  });
  db_writeAll(mSpec, rows);
  const msh = db_sheet_(mSpec);
  ui_checkbox(msh.getRange(DB.DATA_ROW, DB.COL + 1, rows.length, 1));
  msh.getRange(DB.DATA_ROW, DB.COL + 4, rows.length, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['★★★', '★★', '★'], true).build());
  // Earnings Watchlist
  const wSpec = cat_watchSpec_(); db_ensure(wSpec);
  const wr = db_readAll(wSpec).rows;
  if (!wr.length) db_writeAll(wSpec, CAT_WATCH.map(function (x) { return { track: x[2], ticker: x[0], company: x[1], confirmed: false }; }));
  const wsh = db_sheet_(wSpec), n = Math.max(1, db_readAll(wSpec).rows.length);
  ui_checkbox(wsh.getRange(DB.DATA_ROW, DB.COL, n, 1)); ui_checkbox(wsh.getRange(DB.DATA_ROW, DB.COL + 12, n, 1));
  if (!SpreadsheetApp.getActive().getSheetByName(CAT_LOOKUP)) cat_buildLookup_();
  if (!SpreadsheetApp.getActive().getSheetByName('Policy Posts')) cat_buildPosts_();
  db_ensure(cat_fedListSpec_());
}
function cat_details_(s) {
  if (s.fred) return s.fred + ' · ' + ({ pch: '% change', pc1: '% change y/y', chg: 'change', lin: 'level' })[s.u];
  if (s.rule === 'bizday') return 'Business day ' + s.n + ' of the month';
  if (s.rule === 'lastdow') return 'Last ' + DOW_NAMES[s.dow] + ' of the month';
  if (s.rule === 'nfp') return '2 days before nonfarm payrolls';
  if (s.rule === 'fomc') return '14 days before each FOMC decision';
  if (s.fomc) return s.fomc === 'decision' ? 'FOMC dates on Settings · target range from FRED' : '21 days after each decision';
  if (s.term) return s.term + '-year notes / bonds incl. reopenings';
  if (s.rule === 'weekly') return 'Every ' + DOW_NAMES[s.dow] + ' (next day after a holiday)';
  if (s.boj) return 'Announced around 11 PM – 1 AM ET the night before the U.S. session';
  if (s.rss) return 'federalreserve.gov speeches & testimony feeds';
  if (s.manual) return 'No free schedule — type the dates';
  return '';
}
function cat_openMaster() { const sh = SpreadsheetApp.getActive().getSheetByName('Event Master') || (cat_buildTabs(), SpreadsheetApp.getActive().getSheetByName('Event Master')); SpreadsheetApp.getActive().setActiveSheet(sh); }
function cat_openEarnings() { const sh = SpreadsheetApp.getActive().getSheetByName('Earnings Watchlist') || (cat_buildTabs(), SpreadsheetApp.getActive().getSheetByName('Earnings Watchlist')); SpreadsheetApp.getActive().setActiveSheet(sh); }
function cat_openLookup() { const sh = SpreadsheetApp.getActive().getSheetByName('Event Lookup') || (cat_buildLookup_(), SpreadsheetApp.getActive().getSheetByName('Event Lookup')); SpreadsheetApp.getActive().setActiveSheet(sh); }

/* =============================================================================
 * ENTRY POINTS (menu + triggers)
 * ========================================================================== */
/** Catalysts → Refresh catalysts now. */
function cat_refreshAll() {
  const t0 = Date.now(), log = [];
  cat_schedule_(cal_add(cal_today(), -10), cal_add(cal_today(), 45), log);
  cat_fillActuals_(log);
  cat_headlines_(log);
  try { cat_posts_(log, 2); } catch (e) { log.push('✗ Policy posts: ' + e.message); }
  cat_earnings_(false, log);
  try { cat_renderLookup_(); cat_renderPosts_(); } catch (e) { /* tab not built */ }
  core_alert('Catalysts refreshed', log.join('\n') + '\n\nFinished in ' + Math.round((Date.now() - t0) / 1000) + ' s');
}
/** Catalysts → Refresh event schedule: only the schedule (calendars, Fed speakers, consensus) — quick. */
function cat_refreshSchedule() {
  const t0 = Date.now(), log = [];
  cat_schedule_(cal_add(cal_today(), -10), cal_add(cal_today(), 45), log);
  try { cat_renderLookup_(); } catch (e) { /* tab not built */ }
  core_alert('Event schedule', log.join('\n') + '\n\nFinished in ' + Math.round((Date.now() - t0) / 1000) + ' s\nThen: Day files → Build or rebuild a specific day (today) to show new Fed speakers on today\'s file.');
}
/** Catalysts → Test event sources: each result is written to the "Source Test" tab as soon as it arrives,
 *  so even if one site never answers (and Google stops the run at 6 minutes) every earlier result is kept. */
function cat_testSources() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('Source Test'); if (!sh) sh = ss.insertSheet('Source Test');
  sh.clear(); sh.appendRow(['Time (ET)', 'Source', 'Result', 'HTTP', 'Size (KB)', 'Seconds', 'Page title', 'Finding']);
  sh.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground(COLOR.NAVY).setFontColor(COLOR.WHITE);
  ss.setActiveSheet(sh); SpreadsheetApp.flush();
  const ua = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', Accept: 'text/html,application/json,*/*' };
  const probe = function (label, url, test) {
    sh.appendRow([Utilities.formatDate(new Date(), TZ, 'HH:mm:ss'), label, 'testing… (if this stays, the site never answered)', '', '', '', '', '']); SpreadsheetApp.flush();
    const row = sh.getLastRow(), t0 = Date.now();
    try {
      const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: ua, followRedirects: true }), body = r.getContentText().slice(0, 300000);
      const title = ((body.match(/<title[^>]*>([^<]{0,80})/i) || [])[1] || '').trim();
      sh.getRange(row, 3, 1, 6).setValues([[r.getResponseCode() === 200 ? '✓ answered' : '✗ refused', r.getResponseCode(), Math.round(body.length / 1024), Math.round((Date.now() - t0) / 100) / 10, title, test ? test(body) : '']]);
    } catch (e) { sh.getRange(row, 3, 1, 6).setValues([['✗ error', '', '', Math.round((Date.now() - t0) / 100) / 10, '', e.message]]); }
    SpreadsheetApp.flush();
  };
  probe('Calendar feed (Fed speakers, consensus)', 'https://nfs.faireconomy.media/ff_calendar_thisweek.json', function (b) { return (b.match(/Speaks/g) || []).length + ' "Speaks" entries'; });
  probe('Fed Board calendar', 'https://www.federalreserve.gov/newsevents/calendar.htm', function (b) { return (b.match(/Speech/gi) || []).length + ' "speech" mentions'; });
  probe('Yahoo SPY forward P/E', 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=SPY', function (b) { const m = b.match(/"forwardPE":([\d.]+)/); return m ? 'forward P/E ' + Number(m[1]).toFixed(2) : 'no forward P/E in the reply'; });
  probe('FactSet Insight RSS', 'https://insight.factset.com/rss.xml', function (b) { return /forward 12-month P\/E/i.test(b) ? 'P/E sentence found' : 'P/E sentence not in feed'; });
  probe('FactSet earnings page', 'https://insight.factset.com/topic/earnings', function (b) { return /forward 12-month P\/E/i.test(b) ? 'P/E sentence found' : (/captcha|challenge|cf-|verify you are human/i.test(b) ? 'looks like a bot check' : 'P/E sentence not found'); });
  probe('S&P DJI estimates file', 'https://www.spglobal.com/spdji/en/documents/additional-material/sp-500-eps-est.xlsx');
  sh.appendRow([Utilities.formatDate(new Date(), TZ, 'HH:mm:ss'), 'Test finished', '', '', '', '', '', '']);
  sh.autoResizeColumns(1, 8);
}
/** Help → Test Fed bank pages: can each regional bank's events page be read from Google's servers, and does it list its president? */
const CAT_FED_BANKS = [
  ['New York', 'Williams', 'https://www.newyorkfed.org/newsevents/events'], ['Boston', 'Collins', 'https://www.bostonfed.org/news-and-events/events.aspx'],
  ['Philadelphia', 'Paulson', 'https://www.philadelphiafed.org/events'], ['Cleveland', 'Hammack', 'https://www.clevelandfed.org/events'],
  ['Richmond', 'Barkin', 'https://www.richmondfed.org/press_room/speeches'], ['Atlanta', 'Atlanta', 'https://www.atlantafed.org/news-and-events/events'],
  ['Chicago', 'Goolsbee', 'https://www.chicagofed.org/utilities/about-us/events'], ['St. Louis', 'Musalem', 'https://www.stlouisfed.org/events'],
  ['Minneapolis', 'Kashkari', 'https://www.minneapolisfed.org/events'], ['Kansas City', 'Schmid', 'https://www.kansascityfed.org/events/'],
  ['Dallas', 'Logan', 'https://www.dallasfed.org/news/events'], ['San Francisco', 'Daly', 'https://www.frbsf.org/news-and-media/events/'],
  ['Fed Board', 'Governor', 'https://www.federalreserve.gov/newsevents/calendar.htm']];
function cat_testFedBanks() {
  const ss = SpreadsheetApp.getActive(); let sh = ss.getSheetByName('Source Test'); if (!sh) sh = ss.insertSheet('Source Test');
  sh.clear(); sh.appendRow(['Bank', 'President', 'Result', 'HTTP', 'Size (KB)', 'Seconds', 'Page title', 'President named', 'Upcoming dates on page', 'URL']);
  sh.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground(COLOR.NAVY).setFontColor(COLOR.WHITE); ss.setActiveSheet(sh); SpreadsheetApp.flush();
  const ua = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', Accept: 'text/html,*/*' };
  const yr = String(cal_y(cal_today()));
  CAT_FED_BANKS.forEach(function (b) {
    sh.appendRow([b[0], b[1], 'testing…', '', '', '', '', '', '', b[2]]); SpreadsheetApp.flush();
    const row = sh.getLastRow(), t0 = Date.now();
    try {
      const r = UrlFetchApp.fetch(b[2], { muteHttpExceptions: true, headers: ua, followRedirects: true }), body = r.getContentText();
      const title = ((body.match(/<title[^>]*>([^<]{0,70})/i) || [])[1] || '').trim(), txt = body.replace(/<[^>]+>/g, ' ');
      const named = (txt.match(new RegExp(b[1], 'gi')) || []).length, dates = (txt.match(new RegExp('(January|February|March|April|May|June|July|August|September|October|November|December)\\.?\\s+\\d{1,2},?\\s+' + yr, 'g')) || []).length;
      sh.getRange(row, 3, 1, 7).setValues([[r.getResponseCode() === 200 ? '✓ answered' : '✗ refused', r.getResponseCode(), Math.round(body.length / 1024), Math.round((Date.now() - t0) / 100) / 10, title, named, dates]]);
    } catch (e) { sh.getRange(row, 3, 1, 7).setValues([['✗ error', '', '', Math.round((Date.now() - t0) / 100) / 10, '', '', e.message]]); }
    SpreadsheetApp.flush();
  });
  sh.appendRow(['Test finished']); sh.autoResizeColumns(1, 9);
}
/** Catalysts → Backfill catalysts: schedule + actuals + reactions for every day with price history in the data lake. */
function cat_backfill() {
  const t0 = Date.now(), log = [];
  const days = db_readAll(md_indexSpec_()).rows.map(function (r) { return String(r.date); }).sort();
  const start = days.length ? days[0] : cal_add(cal_today(), -60);
  cat_schedule_(start, cal_add(cal_today(), 45), log);
  cat_fillActuals_(log, t0);
  cat_headlines_(log);
  try { cat_posts_(log, 120); } catch (e) { log.push('✗ Policy posts: ' + e.message); }
  cat_earnings_(true, log);
  let n = 0, left = 0;
  const P = in_prices_();
  for (let i = 0; i < days.length; i++) {
    if (Date.now() - t0 > 285000) { left = days.length - i; break; }
    if (cat_updateReactions(days[i], P)) n++;
  }
  log.push('Reactions measured: ' + n + ' days' + (left ? ' · ' + left + ' remain — run Backfill again' : ''));
  if (!left) log.push('Tip: run Market data → Analyze intraday so every move is matched to its catalyst.');
  try { cat_renderLookup_(); cat_renderPosts_(); } catch (e) { /* tab not built */ }
  core_alert('Catalysts backfill', log.join('\n') + '\n\nFinished in ' + Math.round((Date.now() - t0) / 1000) + ' s');
}
/** Catalysts → Load 2 years of event history: release dates, actuals and previous values back 2 years (resumes where it stopped). */
function cat_historyBackfill() {
  const t0 = Date.now(), log = [];
  _CAT.slow = true;
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('CAT_HIST_SCHED')) { cat_schedule_(cal_add(cal_today(), -730), cal_add(cal_today(), 45), log); p.setProperty('CAT_HIST_SCHED', cal_today()); }
  cat_fillActuals_(log, t0);
  const byKey = {}; CAT_EVENTS.forEach(function (e) { byKey[e[0]] = e; });
  // releases FRED never has a value for: named in the message, and after 3 tries marked "Not available" so they stop counting
  const tries = JSON.parse(p.getProperty('CAT_HIST_TRIES') || '{}'), spec = cat_logSpec_(), all = db_readAll(spec).rows;
  const missing = all.filter(function (r) { const e = byKey[r.key]; return e && e[7].fred && String(r.date) < cal_today() && !r.actual && r.status !== 'Revision' && r.status !== 'Unavailable'; });
  const gaveUp = [];
  missing.forEach(function (r) { tries[r.id] = (tries[r.id] || 0) + 1; if (tries[r.id] >= 3) { r.status = 'Unavailable'; r.detail = 'Not available from FRED'; gaveUp.push(r.name + ' ' + cal_short(String(r.date)) + ', ' + cal_y(String(r.date))); } });
  if (gaveUp.length) { db_writeAll(spec, all.map(in_clean_)); _CAT.log = null; }
  p.setProperty('CAT_HIST_TRIES', JSON.stringify(tries));
  const stillMissing = missing.filter(function (r) { return r.status !== 'Unavailable'; });
  const left = stillMissing.length;
  if (gaveUp.length) log.push('Marked "not available from FRED" (no value exists for these dates): ' + gaveUp.join('; '));
  if (left && left <= 10) log.push('Still trying: ' + stillMissing.map(function (r) { return r.name + ' ' + cal_short(String(r.date)) + ', ' + cal_y(String(r.date)); }).join('; '));
  if (!left) p.deleteProperty('CAT_HIST_SCHED');
  try { cat_renderLookup_(); } catch (e) { /* tab not built */ }
  core_alert('Event history', log.join('\n') + '\n\n' + (left ? left + ' releases still to fill — run Load 2 years of event history again (it continues where it stopped).' : 'Two years of releases loaded ✓ — Event Lookup and every day file\'s "Last 3 releases" now have real history.') +
    '\nFinished in ' + Math.round((Date.now() - t0) / 1000) + ' s');
}
/** Every 30 minutes + morning: today's actuals and new headlines. */
function cat_refreshToday(k) {
  const log = [];
  try { cat_fillActuals_(log, null, k || cal_today()); } catch (e) { core_logError_('cat actuals', e); }
  try { cat_headlines_(log); } catch (e) { core_logError_('cat headlines', e); }
  try { cat_posts_(log, 2); } catch (e) { core_logError_('cat posts', e); }
}
/** Nightly: rebuild the schedule 45 days ahead; earnings calendar once a week (and after reports). */
function cat_nightly() {
  const log = [];
  try { cat_schedule_(cal_add(cal_today(), -10), cal_add(cal_today(), 45), log); } catch (e) { core_logError_('cat schedule', e); }
  try { cat_fillActuals_(log); } catch (e) { core_logError_('cat actuals', e); }
  try { cat_earnings_(false, log); } catch (e) { core_logError_('cat earnings', e); }
  try { cat_pruneHeadlines_(); } catch (e) { core_logError_('cat prune', e); }
  try { cat_renderLookup_(); cat_renderPosts_(); } catch (e) { /* tab not built */ }
}
/** End of day: final actuals + reaction windows for today's events and headlines. */
function cat_endOfDay(k) {
  k = k || cal_today();
  cat_refreshToday(k);
  cat_updateReactions(k);
  try { cat_renderLookup_(); } catch (e) { /* tab not built */ }
}

/* =============================================================================
 * SCHEDULE — every occurrence of every tracked event between two dates
 * ========================================================================== */
function cat_tracked_() {
  if (_CAT.tracked) return _CAT.tracked;
  const sh = SpreadsheetApp.getActive().getSheetByName('Event Master');
  const rows = sh ? db_readAll(cat_masterSpec_()).rows : [];
  const mine = {}; rows.forEach(function (r) { mine[String(r.key)] = r; });
  _CAT.tracked = CAT_EVENTS.map(function (e) {
    const m = mine[e[0]];
    return { key: e[0], track: m ? (m.track === true || String(m.track).toUpperCase() === 'TRUE') : e[1], category: e[2], name: e[3], importance: m && m.importance ? m.importance : e[4],
      time: e[5], source: e[6], spec: e[7], manual: m ? String(m.manual || '') : '' };
  });
  return _CAT.tracked;
}
function cat_schedule_(start, end, log) {
  const spec = cat_logSpec_(); if (!db_sheet_(spec)) cat_buildTabs();
  const ev = cat_tracked_().filter(function (e) { return e.track; });
  const map = {}; db_readAll(spec).rows.forEach(function (r) { map[String(r.id)] = r; });
  const want = {}, failed = {}, seenSp = {};                                  // seenSp: date|speaker already scheduled (no duplicates)                                              // failed: sources that did not answer this run (their rows are kept)
  const add = function (e, date, time, extra) {
    if (date < start || date > end || !cal_isTradingDay(date)) return;
    const id = date + '|' + e.key + (extra && extra.suffix ? '|' + extra.suffix : '');
    const r = map[id] || { id: id, date: date, key: e.key, status: 'Scheduled' };
    r.time = time !== undefined ? time : e.time; r.name = (extra && extra.name) || e.name; r.category = e.category; r.importance = e.importance;
    if (extra) Object.keys(extra).forEach(function (k) { if (k !== 'suffix' && k !== 'name' && extra[k] !== undefined && extra[k] !== '') r[k] = extra[k]; });
    map[id] = r; want[id] = true;
  };
  // FRED releases
  const nfpDates = [];
  const fredEv = ev.filter(function (e) { return e.spec.fred; });
  const relCache = {};
  fredEv.concat(ev.some(function (e) { return e.spec.rule === 'nfp'; }) && !fredEv.some(function (e) { return e.key === 'nfp'; }) ? [{ key: '_nfp', spec: { fred: 'PAYEMS' } }] : [])
    .forEach(function (e) {
      try {
        const rel = cat_fredRelease_(e.spec.fred);
        if (!relCache[rel]) Utilities.sleep(300);                             // stay well under FRED's 120 requests a minute
        const dates = relCache[rel] || (relCache[rel] = cat_fredDates_(rel, cal_add(start, -40)));
        if (e.spec.fred === 'PAYEMS') dates.forEach(function (d) { nfpDates.push(d); });
        if (e.key !== '_nfp') dates.forEach(function (d) { if (!e.spec.minDay || cal_d(d) >= e.spec.minDay) add(e, d); });
      } catch (x) { failed[e.key] = true; log.push('✗ ' + (e.name || e.key) + ': ' + x.message + ' (its scheduled dates are kept)'); }
    });
  if (fredEv.length) log.push('✓ FRED release calendar: ' + Object.keys(relCache).length + ' releases');
  // Rules, manual dates, FOMC
  const fomc = cal_fomcDecisions();
  ev.forEach(function (e) {
    const s = e.spec;
    if (s.rule === 'bizday') cat_months_(start, end).forEach(function (ym) { const days = cal_tradingDays(cal_ymd(ym[0], ym[1], 1), cal_ymd(ym[0], ym[1] + 1, 0)); if (days[s.n - 1]) add(e, days[s.n - 1]); });
    if (s.rule === 'lastdow') cat_months_(start, end).forEach(function (ym) { let d = cal_lastWeekday(ym[0], ym[1], s.dow); if (!cal_isTradingDay(d)) d = cal_prevTradingDay(d); add(e, d); });
    if (s.rule === 'nfp') nfpDates.forEach(function (d) { add(e, cal_add(d, s.offset)); });
    if (s.rule === 'fomc') fomc.forEach(function (d) { add(e, cal_add(d, s.offset)); });
    if (s.fomc === 'decision') fomc.forEach(function (d) { add(e, d); });
    if (s.fomc === 'minutes') fomc.forEach(function (d) { add(e, FOMC_MINUTES_OVERRIDE[d] || cal_add(d, 21)); });
    if (s.rule === 'weekly') { let d = cal_add(start, (s.dow - cal_dow(start) + 7) % 7); while (d <= end) { if (cal_isTradingDay(d)) add(e, d); else { const n = cal_nextTradingDay(d); add(e, n, '11:00'); } d = cal_add(d, 7); } }
    if (s.boj && typeof MC_BOJ !== 'undefined') MC_BOJ.forEach(function (d) { add(e, cal_isTradingDay(d) ? d : cal_nextTradingDay(d)); });
    if (e.manual) e.manual.split(/[,;\s]+/).forEach(function (x) { const k = cal_key(x); if (k) add(e, k); });
  });
  // Treasury auctions (announced ones appear ahead of time)
  const tEv = ev.filter(function (e) { return e.spec.term; });
  if (tEv.length) {
    try {
      const auctions = cat_treasury_(start);
      auctions.forEach(function (a) {
        const e = tEv.filter(function (x) { return x.spec.term === a.term; })[0]; if (!e) return;
        add(e, a.date, a.time || '13:00', { actual: a.yield !== '' ? Number(a.yield).toFixed(3) + '%' : '', detail: a.btc !== '' ? 'Bid-to-cover ' + Number(a.btc).toFixed(2) + (a.indirect !== '' ? ' · indirect ' + Math.round(a.indirect * 100) + '%' : '') + (a.amount ? ' · $' + Math.round(a.amount / 1e9) + 'B' : '') : (a.amount ? '$' + Math.round(a.amount / 1e9) + 'B offered' : ''),
          status: a.yield !== '' ? 'Released' : 'Scheduled' });
      });
      log.push('✓ Treasury auctions: ' + auctions.length);
    } catch (x) { ['t2', 't3', 't5', 't7', 't10', 't20', 't30'].forEach(function (k) { failed[k] = true; }); log.push('✗ Treasury auctions: ' + x.message + ' (their scheduled dates are kept)'); }
  }
  // Fed speakers days ahead (every Board member and regional president) + consensus / previous for releases — free public calendar feed
  try {
    const ff = cat_ff_(), sp = ev.filter(function (x) { return x.spec.rss; })[0], trk = {}; ev.forEach(function (x) { trk[x.key] = x; });
    let nSp = 0, nCons = 0;
    ff.forEach(function (f) {
      if (f.country !== 'USD' || !f.date) return;
      if (sp && /\b(speaks|speech|testifies|testimony|remarks)\b/i.test(f.title) && /fed|fomc|powell/i.test(f.title)) {
        const who = (f.title.match(/(?:Member|Chair|Governor|President)\s+([A-Z][a-zA-Z\-]+)/) || f.title.match(/\b(Powell)\b/) || [])[1] || f.title.replace(/\s+(Speaks|Testifies).*$/i, '');
        seenSp[f.date + '|' + String(who).toLowerCase()] = true;
        add(sp, f.date, f.time, { suffix: 'ff' + cat_hash_(f.title + f.date + f.time), name: 'Fed ' + who + ' ' + (/testif/i.test(f.title) ? 'Testimony' : 'Speech') + (/chair/i.test(f.title) ? ' (Chair)' : ''), importance: cat_fedRank_(f.title), detail: 'Scheduled (calendar relay)' }); nSp++; return;
      }
      const key = CAT_FF_MAP[f.title], e = key && trk[key]; if (!e) return;
      if (e.spec.manual) add(e, f.date, f.time || e.time);                      // e.g. S&P Global flash PMIs get their dates automatically
      const r = map[f.date + '|' + key];
      if (r) { if (!r.consensus && f.forecast) { r.consensus = f.forecast; nCons++; } if (!r.previous && f.previous) r.previous = f.previous; }
    });
    log.push('✓ Calendars: ' + nSp + ' Fed speakers scheduled · ' + nCons + ' consensus values filled' + (cat_ff_.why && cat_ff_.why.length ? ' (note: ' + cat_ff_.why.join('; ') + ')' : ''));
  } catch (x) { log.push('✗ Calendars: ' + x.message); }
  // Fed speakers: Board members from the Fed Board's calendar (automatic) and anyone on the hub's Fed Speakers list (yours)
  const spEv = ev.filter(function (x) { return x.spec.rss; })[0];
  if (spEv) {
    let nB = 0, nY = 0;
    try { cat_fedBoard_().forEach(function (x) { if (seenSp[x.date + '|' + x.who.toLowerCase()]) return; seenSp[x.date + '|' + x.who.toLowerCase()] = true; add(spEv, x.date, x.time, { suffix: 'fb' + cat_hash_(x.who + x.date), name: 'Fed ' + x.who + ' ' + (x.kind || 'Speech') + (x.topic ? ' — ' + x.topic : ''), importance: cat_fedRank_(x.who), detail: 'Scheduled (Fed Board calendar)' }); nB++; }); }
    catch (x) { log.push('✗ Fed Board calendar: ' + x.message); }
    cat_fedList_().forEach(function (x) { if (x.date >= start && x.date <= end && !seenSp[x.date + '|' + x.who.toLowerCase()]) { seenSp[x.date + '|' + x.who.toLowerCase()] = true; add(spEv, x.date, x.time, { suffix: 'fl' + cat_hash_(x.who + x.date + x.time), name: 'Fed ' + x.who + ' ' + (/testimon/i.test(x.topic) ? 'Testimony' : 'Speech') + (x.topic && !/^(speech|testimony)$/i.test(x.topic) ? ' — ' + x.topic : ''), importance: cat_fedRank_(x.who), detail: 'Scheduled (Fed Speakers list)' }); nY++; } });
    log.push('✓ Fed speakers scheduled: ' + nB + ' from the Fed Board calendar · ' + nY + ' from your Fed Speakers list');
  }
  // Fed speeches (feed keeps the recent ones; they stay in the log permanently)
  if (ev.some(function (e) { return e.spec.rss; })) {
    const e = ev.filter(function (x) { return x.spec.rss; })[0];
    try {
      const sp = cat_fedSpeeches_();
      sp.forEach(function (s) {
        const who = String(s.title).split(',')[0].trim().toLowerCase();
        const sched = Object.keys(map).map(function (k) { return map[k]; }).filter(function (r) { return String(r.date) === s.date && r.key === 'fed_speech' && who && String(r.name).toLowerCase().indexOf(who) > -1; })[0];
        if (sched) { sched.detail = s.title + ' · ' + s.link; sched.status = 'Released'; want[sched.id] = true; }
        else add(e, s.date, s.time, { suffix: s.id, name: s.title, detail: s.link, status: 'Released' });
      });
      log.push('✓ Fed speeches: ' + sp.length);
    } catch (x) { log.push('✗ Fed speeches: ' + x.message); }
  }
  // previous auction yield = previous for each Treasury term
  const all = Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; });
  const lastT = {};
  all.forEach(function (r) { if (/^t\d+$/.test(String(r.key))) { if (lastT[r.key]) r.previous = lastT[r.key]; if (r.actual) lastT[r.key] = r.actual; } });
  // drop future rows no longer scheduled (dates moved or event untracked) — never for a source that failed this run
  const minDay = {}; CAT_EVENTS.forEach(function (e) { if (e[7].minDay) minDay[e[0]] = e[7].minDay; });
  const keep = all.filter(function (r) {
    if (r.key === 'fed_speech' && !want[r.id]) {                                // an older copy of a speech the relay now lists (e.g. from your paste): drop the duplicate
      const w = (String(r.name).match(/^Fed\s+([A-Za-z\-]+)/) || [])[1];
      if (w && seenSp[String(r.date) + '|' + w.toLowerCase()] && !r.consensus && !r.effect) return false;
    }
    if (minDay[r.key] && cal_d(String(r.date)) < minDay[r.key] && !r.consensus && !r.effect) return false;   // e.g. factory-order dates listed as durable goods
    return want[r.id] || failed[r.key] || failed._all || r.key === 'fed_speech' || String(r.date) < start || String(r.date) > end || (r.status !== 'Scheduled') || r.consensus || r.effect;
  });
  db_writeAll(spec, keep.map(in_clean_));
  log.push('Schedule: ' + keep.filter(function (r) { return String(r.date) >= cal_today(); }).length + ' upcoming · ' + keep.length + ' total');
}
function cat_months_(a, b) {
  const out = []; let y = cal_y(a), m = cal_m(a);
  while (y < cal_y(b) || (y === cal_y(b) && m <= cal_m(b))) { out.push([y, m]); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

/** This week's and next week's calendar from a free public feed (times converted to ET). */
function cat_ff_() {
  const rel = cat_relay_();                                                   // your GitHub relay: every Fed speaker + consensus, never rate-limited
  if (rel.events.length) { cat_ff_.why = rel.stale ? ['relay last updated ' + rel.age + ' h ago'] : []; return rel.events; }
  const out = [], why = rel.why ? [rel.why] : [], p = PropertiesService.getScriptProperties();
  if (p.getProperty('CAT_FF_DAY') === cal_today()) throw new Error('calendar feed already tried today (it limits requests from Google\'s servers)');
  p.setProperty('CAT_FF_DAY', cal_today());
  ['https://nfs.faireconomy.media/ff_calendar_thisweek.json', 'https://nfs.faireconomy.media/ff_calendar_nextweek.json'].forEach(function (u, n) {
    try {
      let res = UrlFetchApp.fetch(u, { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.getResponseCode() !== 200) { if (n === 0) why.push('calendar feed HTTP ' + res.getResponseCode()); return; }
      JSON.parse(res.getContentText()).forEach(function (e) {
        const d = new Date(e.date); if (isNaN(d)) return;
        const t = Utilities.formatDate(d, TZ, 'HH:mm');
        out.push({ title: String(e.title || '').trim(), country: e.country, date: Utilities.formatDate(d, TZ, 'yyyy-MM-dd'), time: t === '00:00' ? '' : t, impact: e.impact, forecast: String(e.forecast || ''), previous: String(e.previous || '') });
      });
    } catch (x) { if (n === 0) why.push('calendar feed ' + x.message); }
  });
  if (!out.length) throw new Error(why.join('; ') || 'calendar feed unavailable');
  cat_ff_.why = why;
  return out;
}
/** Reads the relay's calendar.json (URL on Settings). Returns { events, age (hours), stale, why }. */
function cat_relay_() {
  const url = String(core_getSetting('Calendar relay (GitHub raw URL)', '') || '').trim();
  if (!url) return { events: [], why: 'no relay URL on Settings' };
  try {
    const res = UrlFetchApp.fetch(url + (url.indexOf('?') > -1 ? '&' : '?') + 't=' + Date.now(), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { events: [], why: 'relay HTTP ' + res.getResponseCode() };
    const j = JSON.parse(res.getContentText()), last = j.last_success ? new Date(j.last_success) : null, age = last ? Math.round((Date.now() - last.getTime()) / 36e5) : 999;
    PropertiesService.getScriptProperties().setProperty('CAT_RELAY', JSON.stringify({ age: age, at: Date.now(), count: j.count || 0, fed: j.fed_speeches || 0, errors: j.errors || {} }));
    const events = (j.events || []).map(function (e) {
      const d = new Date(e.date); if (isNaN(d)) return null;
      const t = Utilities.formatDate(d, TZ, 'HH:mm');
      return { title: String(e.title || '').trim(), country: 'USD', date: Utilities.formatDate(d, TZ, 'yyyy-MM-dd'), time: t === '00:00' ? '' : t, impact: e.impact || '', forecast: String(e.forecast || ''), previous: String(e.previous || '') };
    }).filter(String);
    return { events: events, age: age, stale: age > 24 };
  } catch (e) { return { events: [], why: 'relay ' + e.message }; }
}
/** Health check for "What matters today": warns when the calendar relay stops updating. */
function cat_healthAlerts_() {
  const out = []; let s = null; try { s = JSON.parse(PropertiesService.getScriptProperties().getProperty('CAT_RELAY') || 'null'); } catch (e) { s = null; }
  if (!String(core_getSetting('Calendar relay (GitHub raw URL)', '') || '').trim()) return out;
  if (!s) out.push(['yellow', 'Economic calendar relay not read yet — run Catalysts → Refresh event schedule']);
  else if (s.age > 24) out.push(['red', 'Economic calendar relay has not updated in ' + s.age + ' hours — Fed speakers and consensus may be missing (check the GitHub Actions tab)']);
  return out;
}
function cat_fedWho_(t) { const m = String(t).toLowerCase().match(/(powell|jefferson|barr|bowman|cook|waller|miran|williams|hammack|paulson|logan|kashkari|goolsbee|musalem|barkin|bostic|daly|schmid|collins|harker|kugler)/); return m ? m[1] : String(t).toLowerCase(); }
/** Board members' upcoming speeches / testimony from federalreserve.gov/newsevents/calendar.htm (times in ET). */
function cat_fedBoard_() {
  const res = UrlFetchApp.fetch('https://www.federalreserve.gov/newsevents/calendar.htm', { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
  const txt = res.getContentText().replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, '\n').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&');
  const lines = txt.split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(String);
  const mon = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }, out = [];
  let date = null;
  lines.forEach(function (l, i) {
    const dm = l.match(/^(?:[A-Z][a-z]+,\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})?/);
    if (dm) { date = cal_ymd(Number(dm[3] || cal_y(cal_today())), mon[dm[1].slice(0, 3).toLowerCase()], Number(dm[2])); return; }
    if (!date || !/^(Speech|Testimony)\b/i.test(l)) return;
    const near = lines.slice(i, i + 5).join(' ');
    const who = (near.match(/(Chair|Vice Chair(?: for Supervision)?|Governor)\s+([A-Z][a-zA-Z\-]+)/) || [])[2]; if (!who) return;
    const tm = near.match(/(\d{1,2}):(\d{2})\s*(a\.m\.|p\.m\.|am|pm)/i);
    let time = ''; if (tm) { let h = Number(tm[1]); if (/p/i.test(tm[3]) && h < 12) h += 12; if (/a/i.test(tm[3]) && h === 12) h = 0; time = ('0' + h).slice(-2) + ':' + tm[2]; }
    const topic = (near.match(/(?:Speech|Testimony)\s+(?:by|—|-)?\s*(?:Chair|Vice Chair(?: for Supervision)?|Governor)\s+[A-Za-z\-]+\s*(?:—|-|:|on)?\s*([^.]{0,60})/i) || [])[1] || '';
    if (date >= cal_add(cal_today(), -3)) out.push({ kind: /^Testimony/i.test(l) ? 'Testimony' : 'Speech', date: date, time: time, who: who, topic: topic.replace(/\s*\d{1,2}:\d{2}.*$/, '').replace(/\s+(At|In) the .*$/i, '').trim() });
  });
  return out;
}
/** The hub's "Fed Speakers" tab: regional presidents (and anyone else) you add — Date, Time (ET), Speaker, Topic. */
function cat_fedListSpec_() {
  const T = FMT.TEXT;
  return { name: 'Fed Speakers', hidden: false, tab: COLOR.TAB_CAT, title: 'FED SPEAKERS  —  your list (regional presidents and anyone the automatic calendar misses)',
    subtitle: 'Board members are added automatically from the Fed Board\'s calendar. Add regional presidents here once a week from your economic calendar: date (MM/DD/YYYY), time ET (e.g. 1:30 PM), speaker, optional topic. They appear on the day files, ranked, with their reactions measured.',
    cols: [['date', 'Date', 12, T, 'input'], ['time', 'Time (ET)', 10, T, 'input'], ['who', 'Speaker', 18, T, 'input'], ['topic', 'Topic / venue', 40, T, 'input'], ['rank', 'Rank (automatic)', 12, T]] };
}
function cat_fedList_() {
  if (!SpreadsheetApp.getActive().getSheetByName('Fed Speakers')) return [];
  return db_readAll(cat_fedListSpec_()).rows.map(function (r) {
    const d = cal_key(r.date), tm = String(r.time || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    let time = ''; if (tm) { let h = Number(tm[1]); if (tm[3] && /PM/i.test(tm[3]) && h < 12) h += 12; if (tm[3] && /AM/i.test(tm[3]) && h === 12) h = 0; time = ('0' + h).slice(-2) + ':' + tm[2]; }
    return { date: d, time: time, who: String(r.who || '').trim(), topic: String(r.topic || '').trim() };
  }).filter(function (x) { return x.date && x.who; });
}
/** Catalysts → Paste calendar: a tab to paste a copied economic-calendar table (e.g. Trading Economics, one week). */
function cat_openPaste() {
  const ss = SpreadsheetApp.getActive(); let sh = ss.getSheetByName('Calendar Paste');
  if (!sh) sh = ss.insertSheet('Calendar Paste');
  sh.clear(); sh.getRange('A1').setValue('Paste the copied calendar below (click A3, then Ctrl+V / ⌘+V), then run Catalysts → Import pasted calendar. Set Trading Economics to Eastern Time first.').setFontWeight('bold').setWrap(true);
  sh.setColumnWidth(1, 900); sh.setRowHeight(1, 40); ss.setActiveSheet(sh); sh.getRange('A3').activate();
}
/** Reads the pasted calendar: every Fed speech / testimony (date, time, speaker) goes into the Fed Speakers list and is scheduled. */
function cat_importPaste() {
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName('Calendar Paste');
  if (!sh || sh.getLastRow() < 3) { core_alert('Import pasted calendar', 'Nothing pasted yet — run Catalysts → Paste calendar first.'); return; }
  const found = cat_parsePaste_(sh.getRange(3, 1, sh.getLastRow() - 2, Math.max(1, sh.getLastColumn())).getDisplayValues().map(function (r) { return r.join(' ').replace(/\s+/g, ' ').trim(); }).filter(String));
  const spec = cat_fedListSpec_(); db_ensure(spec);
  const cur = db_readAll(spec).rows, have = {};
  cur.forEach(function (r) { have[cal_key(r.date) + '|' + String(r.who).toLowerCase()] = true; });
  let added = 0;
  found.forEach(function (f) { const k = f.date + '|' + f.who.toLowerCase(); if (have[k]) return; have[k] = true; cur.push({ date: Utilities.formatDate(cal_parse(f.date), 'UTC', 'MM/dd/yyyy'), time: f.time ? md_ampm_(f.time) : '', who: f.who, topic: f.kind, rank: '' }); added++; });
  cur.forEach(function (r) { r.rank = cat_fedRank_(r.who); });
  db_writeAll(spec, cur.sort(function (a, b) { return String(cal_key(a.date)) < String(cal_key(b.date)) ? -1 : 1; }));
  sh.getRange(3, 1, sh.getMaxRows() - 2, sh.getMaxColumns()).clearContent();
  const log = []; cat_schedule_(cal_add(cal_today(), -10), cal_add(cal_today(), 45), log);
  core_alert('Import pasted calendar', found.length + ' Fed speeches / testimony found · ' + added + ' new added to the Fed Speakers list and scheduled.\n\nNext: Day files → Build or rebuild a specific day (today) to show them on today\'s Report.');
}
function cat_parsePaste_(lines) {
  const mon = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }, found = [];
  let date = null;
  lines.forEach(function (l) {
    const dm = l.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i) || l.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i);
    if (dm) date = cal_ymd(Number(dm[3]), mon[dm[1].slice(0, 3).toLowerCase()], Number(dm[2]));
    const iso = l.match(/\b(\d{4})-(\d{2})-(\d{2})\b/); if (iso) date = iso[0];
    if (!date || !/\bfed\b|fomc|powell/i.test(l) || !/\b(speech|speaks|testimony|testifies|remarks)\b/i.test(l)) return;
    const tm = l.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    let time = ''; if (tm) { let h = Number(tm[1]); if (tm[3] && /PM/i.test(tm[3]) && h < 12) h += 12; if (tm[3] && /AM/i.test(tm[3]) && h === 12) h = 0; time = ('0' + h).slice(-2) + ':' + tm[2]; }
    const who = (l.match(/\bFed(?:eral Reserve)?(?:\s+(?:Chair|Vice Chair|Governor|President))?\s+([A-Z][a-zA-Z\-]+)\s+(?:Speech|Speaks|Testimony|Testifies|Remarks)/i) || [])[1];
    if (who && !/^(Fed|FOMC|The|Chair)$/i.test(who)) found.push({ date: date, time: time, who: who, kind: /testimon|testif/i.test(l) ? 'Testimony' : 'Speech' });
  });
  return found;
}
// Fed speaker importance: the Chair ★★★ · Board members, the New York Fed and this year's voting presidents ★★ · others ★
const CAT_FED_VOTERS = ['powell', 'jefferson', 'barr', 'bowman', 'cook', 'waller', 'miran', 'williams', 'hammack', 'paulson', 'logan', 'kashkari'];
function cat_fedVoters_() { const s = String(core_getSetting('FOMC voters this year', '') || ''); return s ? s.toLowerCase().split(/[,;\s]+/).filter(String) : CAT_FED_VOTERS; }
function cat_fedChair_() { return String(core_getSetting('Fed Chair', 'Powell') || 'Powell').toLowerCase(); }
function cat_fedRank_(t) { t = String(t).toLowerCase(); if (t.indexOf(cat_fedChair_()) > -1 || /fed chair/.test(t)) return '★★★'; return cat_fedVoters_().some(function (n) { return t.indexOf(n) > -1; }) || /governor|vice chair/.test(t) ? '★★' : '★'; }
// calendar-feed titles → tracked events (for consensus, previous and flash-PMI dates)
const CAT_FF_MAP = { 'CPI m/m': 'cpi_mm', 'Core CPI m/m': 'core_cpi_mm', 'CPI y/y': 'cpi_yy', 'PPI m/m': 'ppi_mm', 'Core PCE Price Index m/m': 'core_pce', 'PCE Price Index m/m': 'pce_mm',
  'Non-Farm Employment Change': 'nfp', 'Unemployment Rate': 'unrate', 'Average Hourly Earnings m/m': 'ahe', 'Unemployment Claims': 'claims', 'JOLTS Job Openings': 'jolts', 'ADP Non-Farm Employment Change': 'adp',
  'Retail Sales m/m': 'retail', 'Advance GDP q/q': 'gdp', 'Prelim GDP q/q': 'gdp', 'Final GDP q/q': 'gdp', 'Durable Goods Orders m/m': 'durables', 'Personal Spending m/m': 'spending', 'Industrial Production m/m': 'indpro',
  'ISM Manufacturing PMI': 'ism_mfg', 'ISM Services PMI': 'ism_svc', 'Final Manufacturing PMI': 'sp_mfg', 'Final Services PMI': 'sp_comp', 'Flash Manufacturing PMI': 'sp_flash', 'Flash Services PMI': 'sp_flash',
  'Prelim UoM Consumer Sentiment': 'umich', 'Revised UoM Consumer Sentiment': 'umich', 'CB Consumer Confidence': 'confboard', 'Housing Starts': 'houst', 'New Home Sales': 'newhome', 'Existing Home Sales': 'existing',
  'Empire State Manufacturing Index': 'empire', 'Philly Fed Manufacturing Index': 'philly', 'Crude Oil Inventories': 'eia_crude' };

/* =============================================================================
 * ACTUALS (FRED values as first released; FOMC target range; Treasury yields)
 * ========================================================================== */
function cat_fillActuals_(log, t0, onlyDay) {
  const spec = cat_logSpec_(); if (!db_sheet_(spec)) return;
  const rows = db_readAll(spec).rows, today = cal_today(), now = Utilities.formatDate(new Date(), TZ, 'HH:mm');
  const byKey = {}; CAT_EVENTS.forEach(function (e) { byKey[e[0]] = e; });
  let n = 0, err = 0; const prevCache = {};
  rows.forEach(function (r) {
    if (t0 && Date.now() - t0 > 150000) return;
    const k = String(r.date), e = byKey[r.key]; if (!e) return;
    if (onlyDay && k !== onlyDay) return;
    const s = e[7];
    if (k > today || (k === today && r.time && now < String(r.time))) {                // upcoming: show the latest value as "Previous"
      if (s.fred && !r.previous) {
        try { const ck = s.fred + s.u; if (!prevCache[ck]) prevCache[ck] = cat_fredVintage_(s.fred, s.u, today); if (prevCache[ck].length) r.previous = cat_fmt_(prevCache[ck][0].value, s); } catch (x) { /* next run */ }
      }
      if (/^t\d+$/.test(String(r.key)) && r.previous === '') { /* filled by the schedule from the last auction */ }
      return;
    }
    try {
      if (s.fred && !r.actual) {
        let v = cat_fredVintage_(s.fred, s.u, k);
        if ((!v.length || v[0].realtime !== k) && k < today) {                       // FRED sometimes posts a day or two late
          const late = cat_fredVintage_(s.fred, s.u, cal_add(k, 3) > today ? today : cal_add(k, 3));
          if (late.length && late[0].realtime >= k && late[0].realtime <= cal_add(k, 3) && (!v.length || late[0].date > v[0].date)) v = late.map(function (x, i) { return i === 0 ? Object.assign({}, x, { realtime: k }) : x; });
        }
        if (v.length && v[0].realtime === k) { r.actual = cat_fmt_(v[0].value, s); r.previous = v[1] ? cat_fmt_(v[1].value, s) : r.previous; r.detail = 'For ' + cat_period_(v[0].date, s.fred); r.status = 'Released'; n++; }
        else if (v.length && !r.previous) { r.previous = cat_fmt_(v[0].value, s); }
      }
      if (s.fomc === 'decision' && !r.actual && k < today) {
        const vint = cal_add(k, 3) > today ? today : cal_add(k, 3);
        const up = cat_fredVintage_('DFEDTARU', 'lin', vint, cal_add(k, 1)), lo = cat_fredVintage_('DFEDTARL', 'lin', vint, cal_add(k, 1));
        if (up.length >= 2 && lo.length >= 2) {
          r.actual = Number(lo[0].value).toFixed(2) + '–' + Number(up[0].value).toFixed(2) + '%';
          r.previous = Number(lo[1].value).toFixed(2) + '–' + Number(up[1].value).toFixed(2) + '%';
          const ch = Math.round((up[0].value - up[1].value) * 100);
          r.detail = ch === 0 ? 'Held' : (ch > 0 ? 'Hiked ' : 'Cut ') + Math.abs(ch) + ' bp';
          r.status = 'Released'; n++;
        }
      }
    } catch (x) { err++; if (err < 3) log.push('✗ ' + r.name + ' ' + k + ': ' + x.message); }
    ['actual', 'previous'].forEach(function (f) {
      if (/^-0(\.0+)?(%|[KMB]?)$/.test(String(r[f]))) r[f] = String(r[f]).slice(1);
      if (s.s === 'M' && /^[\d,.]+K$/.test(String(r[f]))) r[f] = (Number(String(r[f]).replace(/[K,]/g, '')) / 1000).toFixed(s.d) + 'M';   // saved before the unit changed
    });
    // surprise from your consensus
    const a = cat_num_(r.actual), c = cat_num_(r.consensus);
    r.surprise = a !== null && c !== null ? Math.round((a - c) * 1000) / 1000 : '';
  });
  rows.forEach(function (r) {                                                // stored values in the current units (e.g. continuing claims in millions)
    const e = byKey[r.key]; if (!e) return; const s2 = e[7];
    ['actual', 'previous'].forEach(function (f) { if (s2.s === 'M' && /^[\d,.]+K$/.test(String(r[f]))) r[f] = (Number(String(r[f]).replace(/[K,]/g, '')) / 1000).toFixed(s2.d) + 'M'; });
  });
  // a release that only revises a month already reported (e.g. factory orders re-stating durable goods) is kept but hidden;
  // GDP's three estimates of the same quarter are labelled advance / second / third
  const groups = {};
  rows.slice().sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; }).forEach(function (r) {
    const e = byKey[r.key]; if (!e) return;
    (groups[r.key] = groups[r.key] || []).push(r);
  });
  Object.keys(groups).forEach(function (key) {
    const e = byKey[key], s = e[7], seen = {}, firstOn = {};
    let lastActual = '';
    groups[key].forEach(function (r) {
      if (s.fred && r.actual && r.detail) {
        const per = String(r.detail).replace(/ · .*$/, '');
        seen[per] = (seen[per] || 0) + 1;
        if (s.est) { r.detail = per + ' · ' + s.est[Math.min(s.est.length - 1, seen[per] - 1)]; if (r.status === 'Revision') r.status = 'Released'; }   // UMich prelim/final, GDP estimates: each is its own release
        // a revision = the same data month released again within 20 days (e.g. full durable goods after the advance report);
        // an older row with the same month is a mislabeled history row, not a reason to hide today's release
        else if (firstOn[per] && (cal_parse(String(r.date)) - cal_parse(firstOn[per])) / 864e5 <= 20) r.status = 'Revision';
        else if (r.status === 'Revision') r.status = 'Released';
        if (!firstOn[per] || (cal_parse(String(r.date)) - cal_parse(firstOn[per])) / 864e5 > 20) firstOn[per] = String(r.date);
      }
      if (!s.fred && !s.term && !s.fomc && !s.rss) {                // your manual numbers: last month's actual becomes this month's previous
        if (!r.previous && lastActual) r.previous = lastActual;
        if (r.actual) lastActual = r.actual;
      }
    });
  });
  db_writeAll(spec, rows.map(in_clean_));
  _CAT.log = null;
  log.push('✓ Actuals filled: ' + n + (err ? ' · ' + err + ' errors' : ''));
}

/* =============================================================================
 * REACTIONS — minute windows for every event and headline on a day
 * ========================================================================== */
function cat_updateReactions(k, P) {
  k = cal_key(k);
  const bars = md_getBars(k);
  if (!bars.spx1.length && !bars.spx5.length && !bars.es1.length && !bars.es5.length) return false;
  P = P || in_prices_();
  const events = cat_eventsForDay(k);
  const A = in_analyze(k, bars, P, events);
  const spec = cat_logSpec_(), rows = db_readAll(spec).rows;
  let changed = false;
  rows.forEach(function (r) {
    if (String(r.date) !== k || !r.time) return;
    const w = in_eventWindows(A, String(r.time)); if (!w) return;
    r.series = w.series; r.w_pre = w.w[-5]; r.w1 = w.w[1]; r.w2 = w.w[2]; r.w3 = w.w[3]; r.w5 = w.w[5]; r.w10 = w.w[10]; r.w15 = w.w[15]; r.w30 = w.w[30]; r.w60 = w.w[60];
    r.w_close = w.w.close; r.peak = w.peak.v; r.peak_t = md_ampm_(w.peak_t); r.retrace = w.retrace || '';
    const sw = A.major.map(function (s, i) { return { s: s, i: i }; }).filter(function (x) { return x.s.ta <= r.time && r.time <= x.s.tb; })[0];
    r.swing = sw ? '#' + (sw.i + 1) + ' (' + (sw.s.pts >= 0 ? '+' : '') + sw.s.pts.toFixed(1) + ')' : '';
    r.updated = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); changed = true;
  });
  if (changed) db_writeAll(spec, rows.map(in_clean_));
  // headlines
  const hs = cat_newsSpec_(), hr = db_readAll(hs).rows; let hc = false;
  hr.forEach(function (h) {
    if (String(h.date) !== k || !h.time || String(h.time) < '04:00' || String(h.time) >= '16:00') return;
    const w = in_eventWindows(A, String(h.time)); if (!w) return;
    h.w1 = w.w[1]; h.w5 = w.w[5]; h.w15 = w.w[15];
    const sw = A.major.map(function (s, i) { return { s: s, i: i }; }).filter(function (x) { return x.s.ta <= h.time && h.time <= x.s.tb; })[0];
    h.swing = sw ? '#' + (sw.i + 1) : ''; hc = true;
  });
  if (hc) db_writeAll(hs, hr.map(in_clean_));
  return true;
}

/* =============================================================================
 * SOURCES
 * ========================================================================== */
function cat_fred_(path, params) {
  const key = core_getKey('FRED_KEY');
  if (!key) throw new Error('FRED key not set (Setup → Set API keys)');
  const qs = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
  if (_CAT.slow) Utilities.sleep(550);                                       // long history loads stay under FRED's 120 requests a minute
  const res = UrlFetchApp.fetch('https://api.stlouisfed.org/fred/' + path + '?' + qs + '&api_key=' + key + '&file_type=json', { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('FRED HTTP ' + res.getResponseCode());
  return JSON.parse(res.getContentText());
}
/** Release id for a series (cached). */
function cat_fredRelease_(series) {
  const p = PropertiesService.getScriptProperties(), k = 'CAT_REL_' + series;
  const c = p.getProperty(k); if (c) return c;
  const j = cat_fred_('series/release', { series_id: series });
  const id = String(j.releases[0].id); p.setProperty(k, id); return id;
}
/** Every release date from `start` onward, including scheduled future dates. */
function cat_fredDates_(rel, start) {
  const j = cat_fred_('release/dates', { release_id: rel, realtime_start: start, realtime_end: '9999-12-31', include_release_dates_with_no_data: 'true', sort_order: 'asc', limit: 10000 });
  return (j.release_dates || []).map(function (x) { return x.date; }).filter(function (d) { return d >= start; });
}
/** The two latest observations as they were known on `vintage` (the day's first print and the prior period). */
function cat_fredVintage_(series, units, vintage, obsEnd) {
  const params = { series_id: series, units: units, realtime_start: vintage, realtime_end: vintage, sort_order: 'desc', limit: 2, observation_start: cal_add(vintage, -800) };
  if (obsEnd) params.observation_end = obsEnd;
  const j = cat_fred_('series/observations', params);
  return (j.observations || []).filter(function (o) { return o.value !== '.'; }).map(function (o) { return { date: o.date, value: Number(o.value), realtime: o.realtime_start }; });
}
function cat_period_(d, series) {
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (/^(ICSA|CCSA)$/.test(series)) return 'week ending ' + cal_short(d);
  if (/A191RL1Q225SBEA/.test(series)) return 'Q' + (Math.floor((cal_m(d) - 1) / 3) + 1) + ' ' + cal_y(d);
  return m[cal_m(d) - 1] + ' ' + cal_y(d);
}
function cat_fmt_(v, s) {
  if (v === null || v === undefined || v === '' || !isFinite(v)) return '';
  let x = s.div ? v / s.div : v;
  if (Math.abs(x) < 0.5 * Math.pow(10, -s.d)) x = 0;                      // no "-0.0%"
  return x.toFixed(s.d) + (s.s || '');
}
function cat_num_(v) {
  if (v === null || v === undefined || v === '') return null;
  const m = String(v).replace(/−/g, '-').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Treasury note / bond auctions (announced and completed) from the Fiscal Data API — no key. */
function cat_treasury_(start) {
  const url = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query?filter=auction_date:gte:' + start +
    ',security_type:in:(Note,Bond)&sort=auction_date&page[size]=500';
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
  const data = JSON.parse(res.getContentText()).data || [];
  return data.filter(function (a) { return String(a.inflation_index_security || 'No') === 'No' && String(a.floating_rate || 'No') === 'No'; }).map(function (a) {
    const termS = String(a.original_security_term || a.security_term || ''), m = termS.match(/(\d+)-Year/);
    const t = String(a.closing_time_comp || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    let hh = t ? Number(t[1]) : 13; if (t && /PM/i.test(t[3]) && hh < 12) hh += 12;
    return { date: String(a.auction_date).slice(0, 10), term: m ? Number(m[1]) : null, time: t ? ('0' + hh).slice(-2) + ':' + t[2] : '13:00',
      yield: a.high_yield && a.high_yield !== 'null' ? Number(a.high_yield) : '', btc: a.bid_to_cover_ratio && a.bid_to_cover_ratio !== 'null' ? Number(a.bid_to_cover_ratio) : '',
      amount: a.offering_amt && a.offering_amt !== 'null' ? Number(a.offering_amt) : '',
      indirect: a.indirect_bidder_accepted && a.total_accepted && Number(a.total_accepted) ? Number(a.indirect_bidder_accepted) / Number(a.total_accepted) : '' };
  }).filter(function (a) { return a.term; });
}

/** Fed speeches and testimony from the Federal Reserve's RSS feeds — no key. */
function cat_fedSpeeches_() {
  const out = [];
  ['https://www.federalreserve.gov/feeds/speeches.xml', 'https://www.federalreserve.gov/feeds/testimony.xml'].forEach(function (u) {
    try { cat_rss_(u).forEach(function (it) { out.push({ id: it.id, date: it.date, time: it.time, title: it.title.replace(/\s+/g, ' ').slice(0, 90), link: it.link }); }); } catch (e) { /* one feed down */ }
  });
  return out;
}

/** Generic RSS reader → [{ id, title, link, date, time, source }] in Eastern time. */
function cat_rss_(url, sourceName) {
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
  const root = XmlService.parse(res.getContentText()).getRootElement();
  const ch = root.getChild('channel'); if (!ch) return [];
  return ch.getChildren('item').map(function (it) {
    const g = function (n) { const c = it.getChild(n); return c ? c.getText() : ''; };
    const title = g('title').trim(), pub = g('pubDate'), src = it.getChild('source') ? it.getChild('source').getText() : (sourceName || '');
    let date = '', time = '';
    const d = pub ? new Date(pub) : null;
    if (d && !isNaN(d)) {
      date = Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); time = Utilities.formatDate(d, TZ, 'HH:mm');
      if (/00:00:00 (GMT|\+0000)/.test(pub) || time === '00:00') time = '';
    }
    const id = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, title.toLowerCase().replace(/[^a-z0-9]/g, '')).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('').slice(0, 12);
    return { id: id, title: title, link: g('link'), date: date, time: time, source: src };
  }).filter(function (x) { return x.title && x.date; });
}

/** Pulls headline candidates from the free feeds and stores the relevant ones. */
function cat_headlines_(log) {
  const spec = cat_newsSpec_(); if (!db_sheet_(spec)) cat_buildTabs();
  const sh = db_sheet_(spec), lr = sh.getLastRow(), have = {}, rows = [];
  if (lr >= DB.DATA_ROW) sh.getRange(DB.DATA_ROW, DB.COL, lr - DB.DATA_ROW + 1, 1).getValues().forEach(function (v) { if (v[0]) have[String(v[0])] = true; });
  const since = cal_add(cal_today(), -3);
  let added = 0, failed = [];
  const recent = lr >= DB.DATA_ROW ? sh.getRange(Math.max(DB.DATA_ROW, lr - 500), DB.COL + 1, Math.min(501, lr - DB.DATA_ROW + 1), 3).getValues().map(function (v) { return { date: String(v[0]), time: String(v[1]), words: cat_words_(v[2]) }; }) : [];
  const watch = cat_watchTickers_();
  CAT_FEEDS.forEach(function (f) {
    try {
      cat_rss_(f[1], f[0]).forEach(function (it) {
        if (have[it.id] || it.date < since) return;
        const text = it.title, rel = CAT_RELEVANT.test(text) || watch.some(function (t) { return new RegExp('\\b' + t.replace('-', '\\-') + '\\b').test(text); });
        if (!rel) return;
        const src = String(it.source || f[0]).replace(/\s*-\s*$/, '');
        const title = f[0] === 'Google News' ? text.replace(/\s+-\s+[^-]+$/, '') : text;
        const tag = (CAT_TAGS.filter(function (t) { return t[1].test(text); })[0] || ['Markets'])[0];
        const w = cat_words_(title);
        if (recent.concat(rows.map(function (x) { return { date: x.date, time: x.time, words: cat_words_(x.headline) }; })).some(function (o) { return o.date === it.date && cat_minGap_(o.time, it.time) <= 15 && cat_similar_(o.words, w) >= 0.6; })) return;   // same story, another source
        rows.push({ id: it.id, date: it.date, time: it.time, headline: title, source: src, link: it.link, tag: tag,
          impact: CAT_HIGH.test(text) ? 'High' : (CAT_MED.test(text) ? 'Med' : 'Low'), kept: false });
        have[it.id] = true; added++;
      });
    } catch (e) { failed.push(f[0]); }
  });
  rows.sort(function (a, b) { const x = String(a.date) + String(a.time), y = String(b.date) + String(b.time); return x < y ? -1 : (x > y ? 1 : 0); });
  if (rows.length) db_append(spec, rows.map(in_clean_));             // only the new ones are written — fast even with months of history
  _CAT.news = null;
  log.push('✓ Headlines: ' + added + ' new' + (failed.length ? ' · feed(s) unavailable: ' + failed.join(', ') : ''));
}
function cat_pruneHeadlines_() {
  const spec = cat_newsSpec_(), cut90 = cal_add(cal_today(), -90), cut14 = cal_add(cal_today(), -14);
  const rows = db_readAll(spec).rows.filter(function (r) {
    const d = String(r.date);
    return cat_isTrue_(r.kept) || r.note || r.impact === 'High' || (r.impact === 'Med' && d >= cut90) || d >= cut14;   // low-impact items kept 14 days
  }).filter(function (r) {
    return r.source !== 'Truth Social' || cat_isTrue_(r.kept) || r.note || cat_postRel_(String(r.headline).replace(/^Truth Social: /, '').replace(/https?:\/\/\S+/g, ' ').replace(/\b[\w\-]+\.(com|org|gov|net|io|co)(\/\S*)?/gi, ' '));
  }).map(function (r) {
    if (r.source === 'Truth Social' && !cat_isTrue_(r.kept) && !r.note) { const t = String(r.headline).replace(/^Truth Social: /, '').replace(/https?:\/\/\S+/g, ' ').replace(/\b[\w\-]+\.(com|org|gov|net|io|co)(\/\S*)?/gi, ' '); r.impact = cat_postHigh_(t) ? 'High' : 'Med'; r.tag = (CAT_TAGS.filter(function (x) { return x[1].test(t); })[0] || ['Policy'])[0]; }
    if (!cat_isTrue_(r.kept) && !r.note && r.source !== 'Truth Social') r.tag = (CAT_TAGS.filter(function (t) { return t[1].test(String(r.headline)); })[0] || ['Markets'])[0];
    return r;
  }).sort(function (a, b) { const x = String(a.date) + String(a.time), y = String(b.date) + String(b.time); return x < y ? -1 : (x > y ? 1 : 0); });
  db_writeAll(spec, rows);
}

/* =============================================================================
 * EARNINGS (Alpha Vantage free key · Nasdaq timing · Yahoo moves)
 * ========================================================================== */
function cat_watchTickers_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Earnings Watchlist');
  if (!sh) return CAT_WATCH.filter(function (x) { return x[2]; }).map(function (x) { return x[0]; });
  return db_readAll(cat_watchSpec_()).rows.filter(function (r) { return r.track === true || String(r.track).toUpperCase() === 'TRUE'; }).map(function (r) { return String(r.ticker).trim().toUpperCase(); }).filter(function (t) { return t; });
}
function cat_av_(params) {
  const key = core_getKey('AV_KEY'); if (!key) throw new Error('Alpha Vantage key not set (Setup → Set API keys)');
  const p = PropertiesService.getScriptProperties(), dk = 'AV_USED_' + cal_today(), used = Number(p.getProperty(dk) || 0);
  if (used >= 22) throw new Error('daily free limit reached — continues tomorrow');
  p.setProperty(dk, String(used + 1));
  const last = Number(p.getProperty('AV_LAST') || 0), wait = 13000 - (Date.now() - last);   // free tier: about 5 calls a minute
  if (wait > 0) Utilities.sleep(wait);
  p.setProperty('AV_LAST', String(Date.now()));
  const qs = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
  const res = UrlFetchApp.fetch('https://www.alphavantage.co/query?' + qs + '&apikey=' + key, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
  const txt = res.getContentText();
  if (/"(Note|Information)"/.test(txt) && txt.length < 600) throw new Error('Alpha Vantage: ' + (JSON.parse(txt).Note || JSON.parse(txt).Information || '').slice(0, 80));
  return txt;
}
function cat_earnings_(full, log) {
  const tickers = cat_watchTickers_();
  const eSpec = cat_earnSpec_(), wSpec = cat_watchSpec_();
  if (!db_sheet_(eSpec)) cat_buildTabs();
  const hist = {}; db_readAll(eSpec).rows.forEach(function (r) { hist[String(r.id)] = r; });
  const p = PropertiesService.getScriptProperties();
  let calls = 0; const msgs = [];
  // 1. upcoming dates: the earnings calendar (one call) once a week or when forced
  const lastCal = p.getProperty('CAT_EARN_CAL') || '';
  if (full || !lastCal || cal_add(lastCal, 6) <= cal_today()) {
    try {
      const csv = Utilities.parseCsv(cat_av_({ function: 'EARNINGS_CALENDAR', horizon: '3month' })); calls++;
      const h = csv[0].map(function (x) { return String(x).trim(); });
      const ix = function (n) { return h.indexOf(n); };
      csv.slice(1).forEach(function (row) {
        const t = String(row[ix('symbol')] || '').toUpperCase(); if (tickers.indexOf(t) < 0) return;
        const date = row[ix('reportDate')], fiscal = row[ix('fiscalDateEnding')], id = t + '|' + fiscal;
        const r = hist[id] || { id: id, ticker: t, fiscal: fiscal };
        r.date = date;
        const est = row[ix('estimate')] !== '' ? Number(row[ix('estimate')]) : null;
        const recent = Object.keys(hist).map(function (k) { return hist[k]; }).filter(function (h) { return h.ticker === t && h.actual !== '' && h.actual !== undefined; }).slice(-4).map(function (h) { return Math.abs(Number(h.actual)); });
        const typical = recent.length ? Math.max.apply(null, recent) : null;
        if (est !== null && typical && Math.abs(est) > Math.max(1, typical * 3)) msgs.push(t + ' estimate ' + est + ' ignored (far from recent results ~' + typical.toFixed(2) + ')');
        else if (est !== null) r.est = est;
        const tod = ix('timeOfTheDay') > -1 ? String(row[ix('timeOfTheDay')] || '') : '';
        if (tod) r.timing = /pre/i.test(tod) ? 'Before open' : (/post|after/i.test(tod) ? 'After close' : r.timing || '');
        hist[id] = r;
      });
      p.setProperty('CAT_EARN_CAL', cal_today());
      msgs.push('calendar ✓');
    } catch (e) { msgs.push('calendar ✗ ' + e.message); }
  }
  // 2. timing comes from Alpha Vantage (calendar + results); Nasdaq is not used — it never answers Google's servers
  // 3. results: per company (history on backfill; otherwise only right after a report)
  const lastRes = JSON.parse(p.getProperty('CAT_EARN_RES') || '{}');
  let histCalls = 0;
  tickers.forEach(function (t) {
    const mine = Object.keys(hist).map(function (id) { return hist[id]; }).filter(function (r) { return r.ticker === t; });
    const reported = mine.filter(function (r) { return r.date && String(r.date) <= cal_today() && (r.actual === '' || r.actual === undefined); });
    const noHistory = !mine.some(function (r) { return r.actual !== '' && r.actual !== undefined; });
    if (lastRes[t] === cal_today() || (!noHistory && !reported.length)) return;
    if (histCalls >= 5) { msgs.push(t + ' history next run'); return; }        // at most 5 per run; the nightly run finishes the rest
    histCalls++;
    try {
      const j = JSON.parse(cat_av_({ function: 'EARNINGS', symbol: t.replace('-', '.') })); calls++;
      (j.quarterlyEarnings || []).slice(0, 8).forEach(function (q) {
        const id = t + '|' + q.fiscalDateEnding;
        const r = hist[id] || { id: id, ticker: t, fiscal: q.fiscalDateEnding };
        r.date = q.reportedDate || r.date; r.actual = q.reportedEPS !== 'None' ? Number(q.reportedEPS) : '';
        r.est = q.estimatedEPS !== 'None' && q.estimatedEPS !== undefined ? Number(q.estimatedEPS) : r.est;
        r.surprise_pct = q.surprisePercentage !== 'None' && q.surprisePercentage !== undefined ? Number(q.surprisePercentage) / 100 : '';
        if (q.reportTime) r.timing = /pre/i.test(q.reportTime) ? 'Before open' : (/post/i.test(q.reportTime) ? 'After close' : r.timing);
        hist[id] = r;
      });
      lastRes[t] = cal_today();
    } catch (e) { msgs.push(t + ' ✗ ' + e.message); }
  });
  p.setProperty('CAT_EARN_RES', JSON.stringify(lastRes));
  // 4. stock move (reaction session) and SPX that session
  const P = in_prices_();
  tickers.forEach(function (t) {
    const mine = Object.keys(hist).map(function (id) { return hist[id]; }).filter(function (r) { return r.ticker === t && r.date && String(r.date) <= cal_today() && (r.move === '' || r.move === undefined); });
    if (!mine.length) return;
    let daily = [];
    try { daily = md_yahooDaily_(t, '2y'); } catch (e) { return; }
    const by = {}; daily.forEach(function (b, i) { by[b.date] = i; });
    mine.forEach(function (r) {
      const d = String(r.date), after = r.timing === 'After close';
      const i = by[d]; if (i === undefined) return;
      const j = after ? i + 1 : i, base = after ? i : i - 1;
      if (!daily[j] || !daily[base]) return;
      r.move = (daily[j].c - daily[base].c) / daily[base].c;
      const sd = daily[j].date; r.spx_next = P.map[sd] ? P.map[sd].pct1 : '';
    });
  });
  const px = {};                                                              // latest share price, for the price-based check
  const needPx = {}; Object.keys(hist).forEach(function (id) { const r = hist[id]; if (r.est !== '' && r.est !== undefined && (r.actual === '' || r.actual === undefined)) needPx[r.ticker] = true; });
  Object.keys(needPx).forEach(function (t) { try { const b = md_yahooDaily_(t.replace('.', '-'), '5d'); if (b.length) px[t] = b[b.length - 1].c; } catch (e) { /* skip */ } });
  Object.keys(hist).forEach(function (id) {
    const r = hist[id];
    if (r.est !== '' && r.est !== undefined && (r.actual === '' || r.actual === undefined) && px[r.ticker] && Math.abs(Number(r.est)) > 0.04 * px[r.ticker]) { msgs.push(r.ticker + ' estimate ' + r.est + ' removed (implausible for one quarter at a $' + Math.round(px[r.ticker]) + ' share price)'); r.est = ''; }
  });
  Object.keys(hist).forEach(function (id) {                                   // drop estimates far out of line with the company's recent results
    const r = hist[id]; if (r.est === '' || r.est === undefined || (r.actual !== '' && r.actual !== undefined)) return;
    const recent = Object.keys(hist).map(function (k) { return hist[k]; }).filter(function (h) { return h.ticker === r.ticker && h.actual !== '' && h.actual !== undefined; }).slice(-4).map(function (h) { return Math.abs(Number(h.actual)); });
    const typical = recent.length ? Math.max.apply(null, recent) : null;
    if (typical && Math.abs(Number(r.est)) > Math.max(1, typical * 3)) { msgs.push(r.ticker + ' estimate ' + r.est + ' removed (recent results ~' + typical.toFixed(2) + ')'); r.est = ''; }
  });
  const list = Object.keys(hist).map(function (id) { hist[id].updated = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); return hist[id]; })
    .sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; });
  db_writeAll(eSpec, list.map(in_clean_));
  // 5. refresh the visible watchlist (your ticks, whisper, confirmed and notes are kept)
  const w = db_readAll(wSpec).rows;
  w.forEach(function (row) {
    const t = String(row.ticker).trim().toUpperCase();
    const mine = list.filter(function (r) { return r.ticker === t; });
    const next = mine.filter(function (r) { return String(r.date) >= cal_today() && (r.actual === '' || r.actual === undefined); })[0];
    const last = mine.filter(function (r) { return r.actual !== '' && r.actual !== undefined; }).slice(-1)[0];
    row.next_date = next ? String(next.date) : ''; row.timing = next ? (next.timing || '—') : ''; row.est = next ? next.est : '';
    row.last_date = last ? String(last.date) : ''; row.last_eps = last ? last.actual : ''; row.last_surprise = last ? last.surprise_pct : '';
    row.last_move = last ? last.move : ''; row.spx_next = last ? last.spx_next : ''; row.updated = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  });
  db_writeAll(wSpec, w.map(in_clean_));
  const wsh = db_sheet_(wSpec); if (w.length) { ui_checkbox(wsh.getRange(DB.DATA_ROW, DB.COL, w.length, 1)); ui_checkbox(wsh.getRange(DB.DATA_ROW, DB.COL + 12, w.length, 1)); }
  log.push('✓ Earnings: ' + tickers.length + ' companies · ' + calls + ' Alpha Vantage calls today' + (msgs.length ? ' · ' + msgs.join(' · ') : ''));
}

/* =============================================================================
 * DAY-FILE HOOKS (called by Intraday.gs and DayFile.gs)
 * ========================================================================== */
const _CAT = { log: null, news: null, earn: null, tracked: null, slow: false };
function cat_log_() { if (!_CAT.log) _CAT.log = db_sheet_(cat_logSpec_()) ? db_readAll(cat_logSpec_()).rows : []; return _CAT.log; }
function cat_news_() { if (!_CAT.news) _CAT.news = db_sheet_(cat_newsSpec_()) ? db_readAll(cat_newsSpec_()).rows : []; return _CAT.news; }
function cat_earn_() { if (!_CAT.earn) _CAT.earn = db_sheet_(cat_earnSpec_()) ? db_readAll(cat_earnSpec_()).rows : []; return _CAT.earn; }
function cat_kind_(cat) { return cat === 'Fed' ? 'Fed' : (cat === 'Treasury' ? 'Treasury' : 'Economic'); }
function cat_isTrue_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }

/** Every event on day k (tracked releases, Fed, auctions) + the headlines that mattered. */
function cat_eventsForDay(k) {
  k = cal_key(k);
  const tracked = {}; cat_tracked_().forEach(function (e) { tracked[e.key] = e.track; });
  const log = cat_log_();
  const out = log.filter(function (r) { return String(r.date) === k && tracked[String(r.key)] !== false && r.status !== 'Revision'; }).map(function (r) {
    return { key: String(r.key), id: String(r.id), t: String(r.time || ''), name: String(r.name), kind: cat_kind_(String(r.category)), category: String(r.category),
      actual: r.actual, previous: r.previous, consensus: r.consensus, forecast: r.forecast, surprise: r.surprise === '' || r.surprise === undefined || r.surprise === null ? undefined : Number(r.surprise),
      importance: String(r.importance || '★'), detail: String(r.detail || ''), effect: r.effect, history: cat_history_(String(r.key), k) };
  });
  const pk = cal_prevTradingDay(k);
  cat_news_().filter(function (h) {
    const d = String(h.date), t = String(h.time || '');
    const inWin = (d === k && (!t || t < '16:00')) || (d > pk && d < k) || (d === pk && t >= '16:00');
    return inWin && d === k && t && t >= '04:00' && (cat_isTrue_(h.kept) || h.impact === 'High');
  }).forEach(function (h) { out.push({ key: 'news', id: String(h.id), t: String(h.time), name: String(h.headline).slice(0, 80), kind: 'Headline', category: 'Headline', importance: h.impact === 'High' ? '★★' : '★', detail: String(h.source) }); });
  return out.sort(function (a, b) { return (a.t || '99') < (b.t || '99') ? -1 : 1; });
}
function cat_history_(key, k) {
  const prev = cat_log_().filter(function (r) { return String(r.key) === key && String(r.date) < k && r.w15 !== '' && r.w15 !== undefined && r.status !== 'Revision'; }).sort(function (a, b) { return String(a.date) < String(b.date) ? 1 : -1; }).slice(0, 3);
  if (!prev.length) return '';
  const avg = function (f) { return prev.reduce(function (s, r) { return s + Number(r[f] || 0); }, 0) / prev.length; };
  return 'Last ' + prev.length + ': +15m ' + df_s_(avg('w15'), 1) + ' · close ' + df_s_(avg('w_close'), 1);
}
/** The last 3 releases of the day's most important event (for the Report). */
function cat_lastReleases(k) {
  const ev = cat_eventsForDay(k).filter(function (e) { return e.kind !== 'Headline' && e.key !== 'fed_speech'; })
    .sort(function (a, b) { return b.importance.length - a.importance.length; })[0];
  if (!ev) return null;
  const rows = cat_log_().filter(function (r) { return String(r.key) === ev.key && String(r.date) < k && r.actual && r.status !== 'Revision'; }).sort(function (a, b) { return String(a.date) < String(b.date) ? 1 : -1; }).slice(0, 3);
  return { name: ev.name, rows: rows };
}
function cat_earningsForDay(k) {
  const t = cat_watchTickers_(), end = cal_tradingDays(cal_add(k, 1), cal_add(k, 14)).slice(0, 5).pop() || k, start = cal_tradingDays(cal_add(k, -10), cal_add(k, -1)).slice(-5)[0] || k;
  const all = cat_earn_().filter(function (r) { return t.indexOf(String(r.ticker)) > -1 && r.date; });
  const up = all.filter(function (r) { return String(r.date) >= k && String(r.date) <= end; });
  const recent = all.filter(function (r) { return String(r.date) >= start && String(r.date) < k && r.actual !== ''; }).reverse();
  return { upcoming: up, recent: recent, next: all.filter(function (r) { return String(r.date) > end; })[0] || null };
}
function cat_headlinesForDay(k) {
  const pk = cal_prevTradingDay(k);
  return cat_news_().filter(function (h) {
    const d = String(h.date), t = String(h.time || '');
    return (d === k && (!t || t < '16:00')) || (d > pk && d < k) || (d === pk && t >= '16:00');
  }).sort(function (a, b) { const x = String(a.date) + String(a.time), y = String(b.date) + String(b.time); return x < y ? -1 : (x > y ? 1 : 0); });
}

function cat_words_(t) { const s = {}; String(t || '').toLowerCase().replace(/^truth social: /, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).forEach(function (w) { if (w.length > 3) s[w] = true; }); return s; }
function cat_similar_(a, b) { const ka = Object.keys(a), kb = Object.keys(b); if (!ka.length || !kb.length) return 0; const inter = ka.filter(function (w) { return b[w]; }).length; return inter / Math.min(ka.length, kb.length); }
function cat_minGap_(t1, t2) { const m = function (t) { const p = String(t).split(':'); return Number(p[0]) * 60 + Number(p[1] || 0); }; return Math.abs(m(t1) - m(t2)); }
/** Consensus / forecast cells: anything Sheets turned into a number (0.3% → 0.003 shown as "0.30%") goes back to the released text. */
function cat_asText_(rg) {
  const vals = rg.getValues(), fmts = rg.getNumberFormats(); let fix = false;
  const out = vals.map(function (row, i) { return row.map(function (v, j) {
    if (typeof v !== 'number') return v; fix = true;
    const f = String(fmts[i][j]);
    if (/%/.test(f)) return String(Math.round(v * 1e6) / 1e4) + '%';
    return String(Math.round(v * 1e4) / 1e4);
  }); });
  if (fix) rg.setNumberFormat('@').setValues(out);
}
/** Watchlist reports shown on a day's Report: reporting that day, or reported the previous trading day (the day-after reaction). */
function cat_reportEarnings_(k) {
  const t = cat_watchTickers_(), pk = cal_prevTradingDay(k);
  return cat_earn_().filter(function (r) { const d = String(r.date); return t.indexOf(String(r.ticker)) > -1 && (d === k || d === pk); })
    .sort(function (a, b) { return String(a.date) === String(b.date) ? (String(a.ticker) < String(b.ticker) ? -1 : 1) : (String(a.date) === k ? -1 : 1); });
}
/** Headlines shown on a day's Report: the ones you kept, every high-impact one, and the biggest short-term market movers (up to 10, in time order). */
function cat_reportHeadlines_(k, A) {
  const scored = cat_headlinesForDay(k).map(function (h) {
    const t = String(h.time || ''), w = A && String(h.date) === k && t >= '04:00' && t < '16:00' ? in_eventWindows(A, t) : null;
    const mv = w ? Math.max(Math.abs(Number(w.w[5]) || 0), Math.abs(Number(w.w[15]) || 0) * 0.7) : 0;
    const offHours = String(h.date) !== k || !t || t < '04:00';
    const recency = (String(h.date) + String(h.time)).replace(/\D/g, '') / 1e13;               // later breaks ties
    const score = (cat_isTrue_(h.kept) ? 100 : 0) + (h.impact === 'High' ? 50 : 0) + mv * 3 - (offHours && !w ? 8 : 0) + recency;
    return { h: h, w: w, score: score, show: cat_isTrue_(h.kept) || h.impact === 'High' || mv >= 3, words: cat_words_(h.headline) };
  }).filter(function (x) { return x.show; }).sort(function (a, b) { return b.score - a.score; });
  const picked = [];
  scored.forEach(function (x) { if (picked.length < 10 && !picked.some(function (p) { return cat_similar_(p.words, x.words) >= 0.6; })) picked.push(x); });
  return picked
    .sort(function (a, b) { return String(a.h.date) + String(a.h.time) < String(b.h.date) + String(b.h.time) ? -1 : 1; });
}

/* ---------------- Events & Earnings tab (day file) ---------------- */
function cat_fillEventsTab(sh, ctx) {
  const keep = df_keep_(sh, 6, function (r) { return r[12] ? String(r[12]) : null; }, [6, 8, 9, 12]);
  df_clearBody_(sh, 6);
  df_legendNote_(sh, cal_pretty(ctx.k));
  const manual = {}; CAT_EVENTS.forEach(function (e) { manual[e[0]] = !e[7].fred && !e[7].term && !e[7].fomc && !e[7].rss; });
  let r = 6;
  const sub = function (cols) { ui_sub(sh, r, cols.map(function (c, i) { return [2 + i, 2 + i, c]; })); sh.setRowHeight(r, 28); r++; };
  const G = COLOR.GRAY, key = function (id) { return { v: id, fc: '#FFFFFF', h: 'left' }; };
  // today
  ui_header(sh, r, 2, 12, 'TODAY — ECONOMIC CALENDAR, FED & TREASURY  (Actual · Previous · Consensus · Forecast)'); r++;
  sub(['Time', 'Category', 'Event', 'Importance', 'Actual', 'Previous', 'Consensus', 'Forecast', 'Surprise', 'Detail', 'Your note']);
  const today = ctx.events.filter(function (e) { return e.kind !== 'Headline'; });
  if (!today.length) { df_placeholder_(sh, r, 2, 12, 'No tracked releases today. Add or remove events on the hub\'s Event Master tab.'); r += 2; }
  else {
    TW_(sh, r, 2, today.map(function (e) {
      const kp = keep[e.id] || ['', '', '', ''], isMan = manual[e.key];
      return [{ v: e.t ? md_ampm_(e.t) : 'Varies', b: true }, e.category, { v: e.name, h: 'left', b: e.importance === '★★★', bg: e.importance === '★★★' ? COLOR.PUR : COLOR.WHITE, fc: e.importance === '★★★' ? COLOR.PURF : COLOR.TEXT },
        { v: e.importance, fc: COLOR.GOLD }, isMan ? { v: kp[0] || e.actual || '', bg: COLOR.INP, fc: COLOR.INPF, nf: '@' } : { v: e.actual || '—', b: true, nf: '@' }, { v: e.previous || '—', nf: '@' },
        { v: kp[1] || e.consensus || '', bg: COLOR.INP, fc: COLOR.INPF, nf: '@' }, { v: kp[2] || e.forecast || '', bg: COLOR.INP, fc: COLOR.INPF, nf: '@' },
        { v: e.surprise === undefined ? '' : e.surprise, fc: df_pn_(e.surprise), nf: '+0.0##;-0.0##;0' }, { v: e.detail, fc: G, h: 'left' },
        { v: kp[3] || e.effect || '', bg: COLOR.INP, fc: COLOR.INPF, h: 'left' }, key(e.id)];
    }), { size: 9 });
    r += today.length + 1;
  }
  // week ahead
  ui_header(sh, r, 2, 12, 'WEEK AHEAD — next 5 trading days (type consensus / forecast any time)'); r++;
  sub(['Day', 'Time', 'Event', 'Importance', 'Actual', 'Previous', 'Consensus', 'Forecast', 'Last 3 reactions', 'Calendar flags', 'Your note']);
  let d = ctx.k; const rows = [];
  for (let i = 0; i < 5; i++) {
    d = cal_nextTradingDay(d);
    const fl = (core_fnExists_('df_flags_') ? df_flags_(d) : cal_getFlags(d).flags).map(function (x) { return x.label; }).slice(0, 2).join(' · ');
    const evs = cat_eventsForDay(d).filter(function (e) { return e.kind !== 'Headline'; });
    if (!evs.length) rows.push([{ v: DOW_NAMES[cal_dow(d)] + ' ' + cal_short(d), b: true }, '', { v: 'No tracked releases', fc: G, h: 'left' }, '', '', '', '', '', '', { v: fl, fc: COLOR.PURF, bg: fl ? COLOR.PUR : COLOR.WHITE }, '', '']);
    evs.forEach(function (e, j) {
      const kp = keep[e.id] || ['', '', '', ''];
      rows.push([{ v: j === 0 ? DOW_NAMES[cal_dow(d)] + ' ' + cal_short(d) : '', b: true }, e.t ? md_ampm_(e.t) : 'Varies',
        { v: e.name, h: 'left', b: e.importance === '★★★', bg: e.importance === '★★★' ? COLOR.PUR : COLOR.WHITE, fc: e.importance === '★★★' ? COLOR.PURF : COLOR.TEXT },
        { v: e.importance, fc: COLOR.GOLD }, { v: '—', fc: G }, { v: e.previous || '—', nf: '@' }, { v: kp[1] || e.consensus || '', bg: COLOR.INP, fc: COLOR.INPF, nf: '@' }, { v: kp[2] || e.forecast || '', bg: COLOR.INP, fc: COLOR.INPF, nf: '@' },
        { v: e.history || '', bg: COLOR.HIS, fc: COLOR.HISF }, { v: j === 0 ? fl : '', fc: COLOR.PURF, bg: j === 0 && fl ? COLOR.PUR : COLOR.WHITE }, { v: kp[3] || e.effect || '', bg: COLOR.INP, fc: COLOR.INPF, h: 'left' }, key(e.id)]);
    });
  }
  TW_(sh, r, 2, rows, { size: 9, wrap: true }); r += rows.length + 1;
  // earnings
  ui_header(sh, r, 2, 12, 'EARNINGS — YOUR WATCHLIST  (upcoming 5 trading days + recent results · edit the list on the hub\'s Earnings Watchlist)'); r++;
  sub(['Ticker', 'Company', 'Report date', 'Timing', 'EPS est.', 'EPS actual', 'Surprise', 'Stock move', 'SPX that session', 'Whisper', 'Notes']);
  const E = cat_earningsForDay(ctx.k), w = {};
  db_readAll(cat_watchSpec_()).rows.forEach(function (x) { w[String(x.ticker).toUpperCase()] = x; });
  const er = E.upcoming.concat(E.recent);
  if (!er.length) { df_placeholder_(sh, r, 2, 12, 'None of your companies report within 5 trading days.' + (E.next ? ' Next: ' + E.next.ticker + ' ' + cal_pretty(String(E.next.date)) + (E.next.timing ? ' (' + E.next.timing.toLowerCase() + ')' : '') : '')); r += 2; }
  else TW_(sh, r, 2, er.map(function (x) {
    const wr = w[String(x.ticker)] || {};
    return [{ v: x.ticker, b: true }, { v: wr.company || '', h: 'left' }, cal_short(String(x.date)), x.timing || '—', { v: x.est, nf: FMT.NUM2 }, { v: x.actual === '' ? '—' : x.actual, nf: FMT.NUM2, b: true },
      { v: x.surprise_pct, nf: '+0.0%;-0.0%;0.0%', fc: df_pn_(x.surprise_pct) }, { v: x.move, nf: '+0.0%;-0.0%;0.0%', fc: df_pn_(x.move) }, { v: x.spx_next, nf: FMT.PCT, fc: df_pn_(x.spx_next) },
      { v: wr.whisper || '', bg: COLOR.HIS, fc: COLOR.HISF }, { v: wr.notes || '', bg: COLOR.HIS, fc: COLOR.HISF, h: 'left' }, ''];
  }), { size: 9 });
  sh.setColumnWidth(13, 20);
}

/* ---------------- Headlines tab (day file) ---------------- */
function cat_fillHeadlinesTab(sh, ctx) {
  const keep = df_keep_(sh, 6, function (r) { return r[12] ? String(r[12]) : null; }, [5, 6, 11, 12]);
  df_clearBody_(sh, 6);
  const pk = cal_prevTradingDay(ctx.k), A = ctx.A;
  df_legendNote_(sh, cal_pretty(ctx.k) + '  ·  from ' + DOW_NAMES[cal_dow(pk)] + ' 4:00 PM through 4:00 PM');
  ui_header(sh, 6, 2, 12, 'ALL CANDIDATES (time-ordered)  —  tick "Kept" for the ones that mattered; kept and High-impact headlines are matched to moves');
  ui_sub(sh, 7, [[2, 2, 'Time'], [3, 3, 'Headline'], [4, 4, 'Source'], [5, 5, 'Tag'], [6, 6, 'Impact'], [7, 7, 'SPX +1m'], [8, 8, '+5m'], [9, 9, '+15m'], [10, 10, 'Swing'], [11, 11, 'Kept'], [12, 12, 'Your note']]);
  const hs = cat_headlinesForDay(ctx.k).slice(-100);
  if (!hs.length) { df_placeholder_(sh, 8, 2, 12, ctx.isFuture ? 'Headlines are collected from the evening before this day.' : 'No headlines captured for this window (headline capture started when Catalysts was installed).'); return; }
  TW_(sh, 8, 2, hs.map(function (h) {
    const kp = keep[String(h.id)] || ['', '', '', ''], t = String(h.time || '');
    const w = A && String(h.date) === ctx.k && t >= '04:00' && t < '16:00' ? in_eventWindows(A, t) : null;
    const sw = w ? A.major.map(function (s, i) { return { s: s, i: i }; }).filter(function (x) { return x.s.ta <= t && t <= x.s.tb; })[0] : null;
    const kept = kp[2] !== '' ? kp[2] : cat_isTrue_(h.kept);
    const imp = kp[1] || h.impact;
    return [{ v: (String(h.date) !== ctx.k ? DOW_NAMES[cal_dow(String(h.date))] + ' ' : '') + (t ? md_ampm_(t) : '—'), fc: String(h.date) !== ctx.k ? COLOR.GRAY : COLOR.TEXT },
      { v: h.link ? '=HYPERLINK("' + String(h.link).replace(/"/g, '') + '","' + String(h.headline).replace(/"/g, "'").slice(0, 240) + '")' : h.headline, h: 'left', b: imp === 'High', fc: COLOR.TEXT },
      { v: h.source, fc: COLOR.GRAY }, { v: kp[0] || h.tag, bg: COLOR.INP, fc: COLOR.INPF }, { v: imp, bg: COLOR.INP, fc: imp === 'High' ? COLOR.RED : COLOR.INPF, b: imp === 'High' },
      { v: w ? w.w[1] : '', bg: df_heat_(w && w.w[1], 15), fc: df_pn_(w && w.w[1]), nf: FMT.PTS1 }, { v: w ? w.w[5] : '', bg: df_heat_(w && w.w[5], 15), fc: df_pn_(w && w.w[5]), nf: FMT.PTS1 },
      { v: w ? w.w[15] : '', bg: df_heat_(w && w.w[15], 20), fc: df_pn_(w && w.w[15]), nf: FMT.PTS1 }, { v: sw ? '#' + (sw.i + 1) : '—', bg: COLOR.HIS, fc: COLOR.HISF },
      { v: kept === true || String(kept).toUpperCase() === 'TRUE', bg: COLOR.INP }, { v: kp[3] || h.note || '', bg: COLOR.INP, fc: COLOR.INPF, h: 'left' }, { v: String(h.id), fc: '#FFFFFF' }];
  }), { size: 9 });
  ui_checkbox(sh.getRange(8, 11, hs.length, 1));
  sh.setColumnWidth(13, 20);
}

/* ---------------- after every day-file refresh: sync your inputs both ways, fill Report sections ---------------- */
function cat_afterFill(ss, ctx) {
  const k = ctx.k, rp = ss.getSheetByName('Report'), gp = ss.getSheetByName('Game Plan'), ee = ss.getSheetByName('Events & Earnings'), hl = ss.getSheetByName('Headlines');
  const logSpec = cat_logSpec_(), log = db_readAll(logSpec).rows, byId = {}, byName = {};
  log.forEach(function (r) { byId[String(r.id)] = r; });
  ctx.events.forEach(function (e) { if (e.kind !== 'Headline') { byName[e.name] = e.id; byName['Fed: ' + e.name] = e.id; } });
  const manual = {}; CAT_EVENTS.forEach(function (e) { manual[e[0]] = !e[7].fred && !e[7].term && !e[7].fomc && !e[7].rss; });
  const set = function (id, f, v) { const r = byId[id]; if (!r || v === '' || v === null || v === undefined) return false; if (String(r[f]) === String(v)) return false; r[f] = v; return true; };
  let changed = false;
  // Game Plan (lowest priority), then Events & Earnings, then Report (highest)
  if (gp) gp.getRange(19, 3, 12, 8).getDisplayValues().forEach(function (v) { const id = byName[v[0]]; if (id) { changed = set(id, 'consensus', v[6]) || changed; changed = set(id, 'forecast', v[7]) || changed; } });
  if (ee && ee.getLastRow() >= 8) ee.getRange(8, 2, ee.getLastRow() - 7, 12).getDisplayValues().forEach(function (v) {
    const id = v[11]; if (!id || !byId[id]) return;
    if (manual[String(byId[id].key)]) changed = set(id, 'actual', v[4]) || changed;
    changed = set(id, 'consensus', v[6]) || changed; changed = set(id, 'forecast', v[7]) || changed; changed = set(id, 'effect', v[10]) || changed;
  });
  cat_asText_(rp.getRange(61, 8, 12, 3)); if (gp) cat_asText_(gp.getRange(19, 9, 12, 2));   // repair cells Sheets turned into numbers
  const rv = rp.getRange(61, 2, 12, 16).getDisplayValues();
  rv.forEach(function (v) { const id = byName[v[1]]; if (id) { changed = set(id, 'consensus', v[6]) || changed; changed = set(id, 'forecast', v[8]) || changed; changed = set(id, 'effect', v[14]) || changed; } });
  if (changed) {
    log.forEach(function (r) { const a = cat_num_(r.actual), c = cat_num_(r.consensus); r.surprise = a !== null && c !== null ? Math.round((a - c) * 1000) / 1000 : ''; });
    db_writeAll(logSpec, log.map(in_clean_)); _CAT.log = null;
  }
  // write merged values back into empty cells
  rv.forEach(function (v, i) {
    const r = byId[byName[v[1]]]; if (!r) return;
    if (!v[6] && r.consensus) rp.getRange(61 + i, 8).setNumberFormat('@').setValue(String(r.consensus));
    if (!v[8] && r.forecast) rp.getRange(61 + i, 10).setNumberFormat('@').setValue(String(r.forecast));
    if (!v[14] && r.effect) rp.getRange(61 + i, 16).setValue(r.effect);
    if (r.surprise !== '' && r.surprise !== undefined) rp.getRange(61 + i, 11).setValue(Number(r.surprise)).setFontColor(df_pn_(r.surprise));
    if (manual[String(r.key)] && r.actual) rp.getRange(61 + i, 6).setNumberFormat('@').setValue(String(r.actual));
  });
  if (gp) gp.getRange(19, 3, 12, 8).getDisplayValues().forEach(function (v, i) {
    const r = byId[byName[v[0]]]; if (!r) return;
    if (!v[6] && r.consensus) gp.getRange(19 + i, 9).setNumberFormat('@').setValue(String(r.consensus));
    if (!v[7] && r.forecast) gp.getRange(19 + i, 10).setNumberFormat('@').setValue(String(r.forecast));
  });
  // headlines: your tag / impact / kept / note → hub
  if (hl && hl.getLastRow() >= 8) {
    const nSpec = cat_newsSpec_(), news = db_readAll(nSpec).rows, nb = {}; news.forEach(function (h) { nb[String(h.id)] = h; });
    let nc = false;
    hl.getRange(8, 2, hl.getLastRow() - 7, 12).getValues().forEach(function (v) {
      const h = nb[String(v[11])]; if (!h) return;
      [['tag', v[3]], ['impact', v[4]], ['kept', v[9] === true], ['note', v[10]]].forEach(function (x) { if (x[1] !== '' && String(h[x[0]]) !== String(x[1])) { h[x[0]] = x[1]; nc = true; } });
    });
    if (nc) { db_writeAll(nSpec, news.map(in_clean_)); _CAT.news = null; }
  }
  // Report: last 3 releases (rows 71–75)
  const L3 = cat_lastReleases(k);
  rp.getRange(73, 2).setValue(L3 ? 'LAST 3 RELEASES — ' + L3.name + '  ·  full history in the hub\'s Event Lookup' : 'LAST 3 RELEASES — no tracked release today');
  const l3 = []; for (let i = 0; i < 3; i++) {
    const x = L3 && L3.rows[i];
    l3.push(x ? [cal_short(String(x.date)) + ', ' + cal_y(String(x.date)) + (/ · /.test(String(x.detail)) ? ' (' + String(x.detail).split(' · ')[1] + ')' : ''), '', x.actual, x.consensus || '—', x.surprise === '' ? '—' : x.surprise, x.w1, x.w15, '', x.w_close,
      [DOW_NAMES[cal_dow(String(x.date))]].concat((core_fnExists_('df_flags_') ? df_flags_(String(x.date)) : cal_getFlags(String(x.date)).flags).map(function (f) { return f.label.toLowerCase(); }).slice(0, 2)).join(' · '), '', x.effect || '', '', '', '', ''] : Array(16).fill(''));
  }
  rp.getRange('D75:E77').setNumberFormat('@');
  rp.getRange(75, 2, 3, 16).setValues(l3.map(function (row) { return row.map(function (x) { return x === undefined ? '' : x; }); }));
  rp.getRange(75, 6, 3, 5).setNumberFormat(FMT.PTS1);
  // Report: earnings (rows 79–88) — only on the day a watchlist company reports and the day after
  const ER = cat_reportEarnings_(k), wl = {};
  db_readAll(cat_watchSpec_()).rows.forEach(function (x) { wl[String(x.ticker).toUpperCase()] = x; });
  rp.getRange(79, 2).setValue('EARNINGS — YOUR WATCHLIST  ·  reporting today, or reported yesterday (the day-after reaction)');
  const eRows = [];
  for (let i = 0; i < 10; i++) {
    const x = ER[i];
    if (!x) { eRows.push(i === 0 ? ['—', 'No watchlist company reports today or reported yesterday', '', '', '', '', '', '', '', '', '', '', '', '', '', ''] : Array(16).fill('')); continue; }
    const w = wl[String(x.ticker)] || {}, today = String(x.date) === k, t = x.timing ? x.timing.toLowerCase() : '';
    const when = today ? 'TODAY' + (t ? ' · ' + t : '') : 'YESTERDAY' + (t ? ' · ' + t : '') + ' → reaction today';
    eRows.push([x.ticker, w.company || '', '', when, '', x.est, x.actual === '' || x.actual === undefined ? '—' : x.actual, '', x.surprise_pct, w.whisper || '', cat_isTrue_(w.confirmed) ? '✓' : '', x.move, x.spx_next, w.notes || '', '', '']);
  }
  rp.getRange(81, 2, 10, 16).setValues(eRows.map(function (row) { return row.map(function (x) { return x === undefined ? '' : x; }); }));
  rp.getRange(81, 7, 10, 2).setNumberFormat(FMT.NUM2); rp.getRange(81, 10, 10, 1).setNumberFormat('+0.0%;-0.0%;0.0%'); rp.getRange(81, 13, 10, 1).setNumberFormat('+0.0%;-0.0%;0.0%'); rp.getRange(81, 14, 10, 1).setNumberFormat(FMT.PCT);
  rp.getRange('E81:E90').setFontWeight('bold');
  rp.showRows(81, 10); if (Math.max(1, ER.length) < 10) rp.hideRows(81 + Math.max(1, ER.length), 10 - Math.max(1, ER.length));
  // Report: headlines (rows 92–101) — kept, high impact, and the biggest short-term market movers
  const HL = cat_reportHeadlines_(k, ctx.A);
  rp.getRange(92, 2).setValue('DAILY HEADLINES  —  kept, high-impact and the biggest market movers  (all candidates: Headlines tab)');
  const hRows = [];
  for (let i = 0; i < 10; i++) {
    const x = HL[i];
    if (!x) { hRows.push(Array(16).fill('')); continue; }
    const h = x.h, t = String(h.time || '');
    hRows.push([(String(h.date) !== k ? DOW_NAMES[cal_dow(String(h.date))] + ' ' : '') + (t ? md_ampm_(t) : '—'), h.headline, '', '', '', '', '', '', '', h.source, '', h.tag, h.impact, x.w ? x.w.w[1] : '', x.w ? x.w.w[5] : '', cat_isTrue_(h.kept) ? '✓' : '']);
  }
  rp.getRange(94, 2, 10, 16).setValues(hRows);
  rp.getRange('O94:P103').setNumberFormat(FMT.PTS1);
  rp.getRange('M94:N103').setBackground(COLOR.HIS).setFontColor(COLOR.HISF); rp.getRange('Q94:Q103').setBackground(COLOR.HIS).setFontColor(COLOR.HISF);
  rp.getRange('C94:C103').setWrap(true).setHorizontalAlignment('left');
  if (!HL.length) rp.getRange(94, 3).setValue('No headlines captured for this day yet');
  rp.showRows(94, 10); if (Math.max(1, HL.length) < 10) rp.hideRows(94 + Math.max(1, HL.length), 10 - Math.max(1, HL.length));
}

/* =============================================================================
 * EVENT LOOKUP (hub) — every past release of any event
 * ========================================================================== */
const CAT_LOOKUP = 'Event Lookup';
function cat_buildLookup_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CAT_LOOKUP);
  const prev = sh ? [sh.getRange(5, 4).getValue(), sh.getRange(5, 10).getValue(), sh.getRange(5, 14).getValue()] : ['CPI m/m', 'All releases', '24'];
  sh = ui_sheet(CAT_LOOKUP, COLOR.TAB_CAT, false);
  [11, 8, 10, 10, 10, 10, 9, 8, 8, 8, 8, 8, 11, 24, 36, 10].forEach(function (w, i) { ui_width(sh, i + 2, w); });
  ui_title(sh, 2, 2, 17, 'EVENT LOOKUP  —  how has the market reacted to this before?');
  ui_box(sh, 3, 2, 3, 17, 'Pick an event to see every release on file: Actual · Previous · Consensus · Forecast, the surprise, and SPX (or /ES before 9:30) at +1 / +5 / +15 / +60 minutes and to the close, with your notes and a link to that day\'s file.',
    { bg: COLOR.LAB, fc: COLOR.LABF, size: 9, italic: true, h: 'left', wrap: true });
  sh.setRowHeight(3, 30);
  const names = CAT_EVENTS.map(function (e) { return e[3]; });
  ui_label(sh, 5, 2, 3, 'Event ▾'); ui_input(sh, 5, 4, 7, prev[0] || 'CPI m/m', { h: 'left' });
  sh.getRange(5, 4).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(names, true).setAllowInvalid(false).build());
  ui_label(sh, 5, 8, 9, 'Filter ▾'); ui_input(sh, 5, 10, 11, prev[1] || 'All releases', { h: 'center' });
  sh.getRange(5, 10).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['All releases', 'Beats', 'Misses', 'Inline', 'With minute data'], true).build());
  ui_label(sh, 5, 12, 13, 'Show ▾'); ui_input(sh, 5, 14, 14, String(prev[2] || '24'), { h: 'center' });
  sh.getRange(5, 14).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['12', '24', '50', 'All'], true).build());
  ui_box(sh, 5, 15, 5, 17, 'Changes redraw instantly', { fc: COLOR.GRAY, size: 9, italic: true });
  sh.setFrozenRows(5);
  cat_renderLookup_();
}
function cat_onEdit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() === CAT_LOOKUP && e.range.getRow() === 5 && [4, 10, 14].indexOf(e.range.getColumn()) > -1) cat_renderLookup_();
  if (sh.getName() === 'Event Master' || sh.getName() === 'Earnings Watchlist') { _CAT.tracked = null; }
  if (sh.getName() === 'Policy Posts' && e.range.getRow() === 5 && e.range.getColumn() === 4) cat_renderPosts_();
}
function cat_renderLookup_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(CAT_LOOKUP); if (!sh) return;
  const name = String(sh.getRange(5, 4).getValue()), filt = String(sh.getRange(5, 10).getValue()), show = String(sh.getRange(5, 14).getValue());
  const ev = CAT_EVENTS.filter(function (x) { return x[3] === name; })[0];
  const body = sh.getRange(7, 2, Math.max(1, sh.getMaxRows() - 6), 16);
  body.breakApart(); body.clear();
  if (!ev) return;
  let rows = (db_sheet_(cat_logSpec_()) ? db_readAll(cat_logSpec_()).rows : []).filter(function (r) { return String(r.key) === ev[0] && String(r.date) <= cal_today() && r.status !== 'Revision' && (r.actual !== '' || r.w15 !== ''); })
    .sort(function (a, b) { return String(a.date) < String(b.date) ? 1 : -1; });
  const s = function (r) { return r.surprise === '' || r.surprise === undefined || r.surprise === null ? null : Number(r.surprise); };
  if (filt === 'Beats') rows = rows.filter(function (r) { return s(r) !== null && s(r) > 0; });
  if (filt === 'Misses') rows = rows.filter(function (r) { return s(r) !== null && s(r) < 0; });
  if (filt === 'Inline') rows = rows.filter(function (r) { return s(r) === 0; });
  if (filt === 'With minute data') rows = rows.filter(function (r) { return r.w15 !== ''; });
  const all = rows.slice();
  if (show !== 'All') rows = rows.slice(0, Number(show) || 24);
  // summary
  ui_header(sh, 7, 2, 17, 'SUMMARY  —  ' + name + '  ·  ' + all.length + ' release' + (all.length === 1 ? '' : 's') + ' on file');
  const withW = all.filter(function (r) { return r.w15 !== ''; });
  const avg = function (list, f) { return list.length ? list.reduce(function (a, r) { return a + Number(r[f] || 0); }, 0) / list.length : null; };
  const beats = withW.filter(function (r) { return s(r) > 0; }), misses = withW.filter(function (r) { return s(r) !== null && s(r) < 0; });
  const held = withW.filter(function (r) { return r.w_close !== '' && Math.sign(Number(r.w_close)) === Math.sign(Number(r.w15)); }).length;
  const big = withW.slice().sort(function (a, b) { return Math.abs(b.w15) - Math.abs(a.w15); })[0];
  const stats = [['Releases with consensus', all.filter(function (r) { return s(r) !== null; }).length + ' of ' + all.length],
    ['Beat / miss / inline', all.filter(function (r) { return s(r) > 0; }).length + ' / ' + all.filter(function (r) { return s(r) !== null && s(r) < 0; }).length + ' / ' + all.filter(function (r) { return s(r) === 0; }).length],
    ['Avg +15m (all)', withW.length ? df_s_(avg(withW, 'w15'), 1) + ' pts' : '—'], ['Avg +15m on beats', beats.length ? df_s_(avg(beats, 'w15'), 1) + ' pts' : '—'],
    ['Avg +15m on misses', misses.length ? df_s_(avg(misses, 'w15'), 1) + ' pts' : '—'], ['First move held to the close', withW.length ? Math.round(held / withW.length * 100) + '% (' + withW.length + ' with minute data)' : '—'],
    ['Largest +15m reaction', big ? df_s_(big.w15, 1) + ' pts on ' + cal_short(String(big.date)) + ', ' + cal_y(String(big.date)) : '—'], ['Avg to close', withW.length ? df_s_(avg(withW, 'w_close'), 1) + ' pts' : '—'],
    ['Time (ET) · importance', (ev[5] ? md_ampm_(ev[5]) : 'Varies') + ' · ' + ev[4]]];
  stats.forEach(function (x, i) { const r = 8 + Math.floor(i / 3), c = 2 + (i % 3) * 5; ui_label(sh, r, c, c + 1, x[0]); ui_auto(sh, r, c + 2, c < 12 ? c + 4 : 17, x[1], { bold: true, size: 9 }); });
  // history
  ui_header(sh, 12, 2, 17, 'RELEASE HISTORY  —  newest first  ·  reactions in SPX points (' + (ev[5] && ev[5] < '09:30' ? '/ES for pre-market releases' : 'SPX') + ')');
  ui_sub(sh, 13, [[2, 2, 'Date'], [3, 3, 'Time'], [4, 4, 'Actual'], [5, 5, 'Previous'], [6, 6, 'Consensus'], [7, 7, 'Forecast'], [8, 8, 'Surprise'], [9, 9, '+1m'], [10, 10, '+5m'], [11, 11, '+15m'],
    [12, 12, '+60m'], [13, 13, 'To close'], [14, 14, 'Peak (time)'], [15, 15, 'Calendar context'], [16, 16, 'Your market effect'], [17, 17, 'Day file']]);
  sh.setRowHeight(13, 28);
  if (!rows.length) { ui_box(sh, 14, 2, 14, 17, 'No releases on file yet for this event. Run Catalysts → Backfill catalysts, and make sure the event is ticked on the Event Master tab.', { fc: COLOR.GRAY, italic: true, size: 9, h: 'left' }); return; }
  const idx = {}; if (db_sheet_(df_indexSpec_())) db_readAll(df_indexSpec_()).rows.forEach(function (x) { idx[String(x.date)] = x.url; });
  TW_(sh, 14, 2, rows.map(function (r) {
    const d = String(r.date), w = function (f, sc) { const v = r[f]; return { v: v, bg: df_heat_(v, sc), fc: df_pn_(v), nf: FMT.PTS1 }; };
    const flags = cal_getFlags(d).flags.map(function (f) { return f.label; }).slice(0, 2).join(' · ');
    return [{ v: DOW_NAMES[cal_dow(d)] + ' ' + cal_short(d) + ', ' + String(cal_y(d)).slice(2), b: true }, r.time ? md_ampm_(String(r.time)) : '—', { v: r.actual || '—', b: true }, r.previous || '—',
      { v: r.consensus || '', bg: COLOR.HIS, fc: COLOR.HISF }, { v: r.forecast || '', bg: COLOR.HIS, fc: COLOR.HISF }, { v: s(r) === null ? '' : s(r), fc: df_pn_(s(r)), nf: '+0.0##;-0.0##;0' },
      w('w1', 15), w('w5', 20), Object.assign(w('w15', 25), { b: true }), w('w60', 35), w('w_close', 45), { v: r.peak !== '' ? df_s_(r.peak, 1) + ' @ ' + r.peak_t : '—', fc: df_pn_(r.peak) },
      { v: flags, fc: COLOR.PURF, bg: flags ? COLOR.PUR : COLOR.WHITE, h: 'left' }, { v: r.effect || '', bg: COLOR.HIS, fc: COLOR.HISF, h: 'left' },
      idx[d] ? { v: '=HYPERLINK("' + idx[d] + '","Open ↗")', fc: COLOR.LINK } : { v: '—', fc: COLOR.GRAY }];
  }), { size: 9, wrap: true });
}

/* =============================================================================
 * POLICY POSTS — Truth Social, from free public archives (tried in order)
 * ========================================================================== */
const CAT_POST_SOURCES = [
  ['trumpstruth.org', 'https://trumpstruth.org/feed', 'rss'],
  ['CNN archive', 'https://ix.cnn.io/data/truth-social/truth_archive.json', 'json'],
  ['Stiles archive', 'https://stilesdata.com/trump-truth-social-archive/truth_archive.json', 'json']
];
// A post is kept only when it contains a genuinely market-moving term (whole words — "rate" must not match "celebrate")
const CAT_POST_REL = /\btariffs?\b|\bfed\b|federal reserve|\bpowell\b|interest rates?|\brates? (cut|hike|cuts|hikes)\b|\binflation\b|stock market|\bthe market\b|\bdow\b|\bnasdaq\b|s&p|\beconomy\b|\beconomic\b|\boil\b|\bopec\b|\bgasoline\b|\bdrill|\benergy\b|\bsanctions?\b|\bceasefire\b|trade (deal|war|talks|agreement|deficit)|\bchips?\b|semiconductor|\bbitcoin\b|\bcrypto|\bdollar\b|\btreasury\b|\bbonds?\b|\bdeficit\b|debt ceiling|tax cuts?|jobs report|unemployment|manufactur|\bnvidia\b|\bapple\b|\btesla\b|\bintel\b|\bboeing\b|\bhormuz\b|\biran\b|\bisrael\b|\brussia\b|\bukraine\b|\bwar\b|\bstrikes? on\b|\battack(ed|s)?\b|\bxi\b|\bchina\b/i;
function cat_chairRe_() { const n = String(core_getSetting('Fed Chair', 'Powell') || 'Powell').trim(); return new RegExp('\\b(' + n + '|powell)\\b', 'i'); }
function cat_postRel_(t) { return CAT_POST_REL.test(t) || cat_chairRe_().test(t); }
function cat_postHigh_(t) { return CAT_POST_HIGH.test(t) || cat_chairRe_().test(t); }
const CAT_POST_HIGH = /\btariffs?\b|\bfed\b|\bpowell\b|interest rates?|\brates? cut|\boil\b|\bopec\b|\bsanctions?\b|\bceasefire\b|\biran\b|\bwar\b|\bstrikes? on\b|\battack(ed|s)?\b|trade deal|\bhormuz\b|stock market|emergency/i;
function cat_posts_(log, days) {
  const spec = cat_newsSpec_(); if (!db_sheet_(spec)) cat_buildTabs();
  const sh = db_sheet_(spec), lr = sh.getLastRow(), have = {};
  if (lr >= DB.DATA_ROW) sh.getRange(DB.DATA_ROW, DB.COL, lr - DB.DATA_ROW + 1, 1).getValues().forEach(function (v) { if (v[0]) have[String(v[0])] = true; });
  const since = cal_add(cal_today(), -(days || 2));
  let items = [], used = '';
  const order = days > 3 ? [1, 2, 0] : [0, 1, 2];                           // backfills read the full archives first; daily refreshes use the light feed
  for (let q = 0; q < order.length && !items.length; q++) {
    const i = order[q], src = CAT_POST_SOURCES[i];
    if (src[2] === 'json' && days <= 3) continue;                             // the large archives only for backfills
    try { items = src[2] === 'rss' ? cat_postsRss_(src[1]) : cat_postsJson_(src[1], since); used = src[0]; } catch (e) { items = []; }
  }
  if (!items.length) { log.push('✗ Policy posts: no source available right now'); return; }
  const fresh = [];
  items.forEach(function (p) {
    if (!p.date || p.date < since || have[p.id]) return;
    const text = String(p.text || '').replace(/https?:\/\/\S+/g, ' ').replace(/\b[\w\-]+\.(com|org|gov|net|io|co)(\/\S*)?/gi, ' ').replace(/\s+/g, ' ').trim(); if (!text || !cat_postRel_(text)) return;
    const tag = (CAT_TAGS.filter(function (t) { return t[1].test(text); })[0] || ['Policy'])[0];
    fresh.push({ id: p.id, date: p.date, time: p.time, headline: 'Truth Social: ' + text.slice(0, 230), source: 'Truth Social', link: p.link || '', tag: tag, impact: cat_postHigh_(text) ? 'High' : 'Med', kept: false });
    have[p.id] = true;
  });
  fresh.sort(function (a, b) { return String(a.date) + String(a.time) < String(b.date) + String(b.time) ? -1 : 1; });
  if (fresh.length) db_append(spec, fresh.map(in_clean_));
  _CAT.news = null;
  log.push('✓ Policy posts: ' + fresh.length + ' new market-relevant (' + used + ')');
}
function cat_postsRss_(url) {
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
  const ch = XmlService.parse(res.getContentText()).getRootElement().getChild('channel'); if (!ch) return [];
  return ch.getChildren('item').map(function (it) {
    const g = function (n) { const c = it.getChild(n); return c ? c.getText() : ''; };
    const d = new Date(g('pubDate')), text = (g('description') || g('title')).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
    return { id: 'ts' + cat_hash_(g('link') || text), date: isNaN(d) ? '' : Utilities.formatDate(d, TZ, 'yyyy-MM-dd'), time: isNaN(d) ? '' : Utilities.formatDate(d, TZ, 'HH:mm'), text: text, link: g('link') };
  });
}
function cat_postsJson_(url, since) {
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
  let data = JSON.parse(res.getContentText()); if (!Array.isArray(data)) data = data.posts || data.data || [];
  return data.map(function (p) {
    const d = new Date(p.created_at || p.date || p.timestamp), text = String(p.content || p.text || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
    return { id: 'ts' + (p.id || cat_hash_(text)), date: isNaN(d) ? '' : Utilities.formatDate(d, TZ, 'yyyy-MM-dd'), time: isNaN(d) ? '' : Utilities.formatDate(d, TZ, 'HH:mm'), text: text, link: p.url || '' };
  }).filter(function (p) { return p.date >= since; });
}
function cat_hash_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(s)).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('').slice(0, 12); }

/** Hub tab: Policy Posts — every market-relevant post with the SPX / ES reaction to the minute. */
function cat_openPosts() { const ss = SpreadsheetApp.getActive(); let sh = ss.getSheetByName('Policy Posts'); if (!sh) { cat_buildPosts_(); sh = ss.getSheetByName('Policy Posts'); } ss.setActiveSheet(sh); }
function cat_buildPosts_() {
  const sh = ui_sheet('Policy Posts', COLOR.TAB_CAT, false);
  for (let c = 2; c <= 17; c++) ui_width(sh, c, 11.5);
  ui_title(sh, 2, 2, 17, 'POLICY POSTS  —  Truth Social, time-stamped and matched to the market');
  ui_box(sh, 3, 2, 3, 17, 'Market-relevant posts from free public archives (a few minutes behind real time). Reactions: SPX in the session, /ES before 9:30. High-impact posts are matched to swings and tracked on the Aftermath Tracker when they move the market 8+ points.',
    { bg: COLOR.LAB, fc: COLOR.LABF, size: 9, italic: true, h: 'left', wrap: true });
  sh.setRowHeight(3, 30);
  ui_label(sh, 5, 2, 3, 'Show ▾'); ui_input(sh, 5, 4, 7, 'High impact', { h: 'left' });
  sh.getRange(5, 4).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['High impact', 'All market-relevant', 'Moved SPX 5+ pts'], true).build());
  sh.setFrozenRows(5);
  cat_renderPosts_();
}
function cat_renderPosts_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Policy Posts'); if (!sh) return;
  const body = sh.getRange(7, 1, Math.max(1, sh.getMaxRows() - 6), Math.max(17, sh.getMaxColumns())); body.breakApart(); body.clear();
  const pick = String(sh.getRange(5, 4).getValue());
  let rows = db_readAll(cat_newsSpec_()).rows.filter(function (h) { return h.source === 'Truth Social'; }).sort(function (a, b) { return String(a.date) + String(a.time) < String(b.date) + String(b.time) ? 1 : -1; });
  const all = rows.slice();
  if (pick === 'High impact') rows = rows.filter(function (h) { return h.impact === 'High'; });
  if (pick === 'Moved SPX 5+ pts') rows = rows.filter(function (h) { return Math.abs(Number(h.w15) || 0) >= 5; });
  rows = rows.slice(0, 150);
  const moved = all.filter(function (h) { return h.w15 !== '' && h.w15 !== undefined; });
  ui_header(sh, 7, 2, 17, 'SUMMARY');
  ui_box(sh, 8, 2, 8, 17, all.length + ' market-relevant posts on file  ·  ' + all.filter(function (h) { return h.impact === 'High'; }).length + ' high impact  ·  ' + moved.length + ' with a measured reaction' +
    (moved.length ? '  ·  average absolute 15-minute move ' + (moved.reduce(function (a, h) { return a + Math.abs(Number(h.w15)); }, 0) / moved.length).toFixed(1) + ' pts' : ''), { h: 'left', size: 10, bold: true });
  const idx = {}; if (db_sheet_(df_indexSpec_())) db_readAll(df_indexSpec_()).rows.forEach(function (x) { idx[String(x.date)] = x.url; });
  ui_header(sh, 10, 2, 17, 'POSTS  —  newest first');
  if (!rows.length) { ui_box(sh, 11, 2, 11, 17, 'No posts captured yet — they arrive with the next catalyst refresh.', { fc: COLOR.GRAY, italic: true, size: 9, h: 'left' }); return; }
  mc_table_(sh, 11, ['Date', 'Time (ET)', 'Post', 'Tag', 'Impact', '+1 min', '+5 min', '+15 min', 'Swing', 'Day file'], rows.map(function (h) {
    const d = String(h.date), txt = String(h.headline).replace(/^Truth Social: /, '');
    return [DOW_NAMES[cal_dow(d)] + ' ' + cal_short(d), h.time ? md_ampm_(String(h.time)) : '—', { v: h.link ? '=HYPERLINK("' + String(h.link).replace(/"/g, '') + '","' + txt.replace(/"/g, "'").slice(0, 200) + '")' : txt.slice(0, 200), h: 'left', b: h.impact === 'High' },
      { v: h.tag, bg: COLOR.PUR, fc: COLOR.PURF }, { v: h.impact, fc: h.impact === 'High' ? COLOR.RED : COLOR.TEXT, b: h.impact === 'High' }, { v: h.w1, nf: FMT.PTS1, fc: df_pn_(h.w1) }, { v: h.w5, nf: FMT.PTS1, fc: df_pn_(h.w5) },
      { v: h.w15, nf: FMT.PTS1, fc: df_pn_(h.w15), bg: df_heat_(h.w15, 20), b: true }, { v: h.swing || '—', bg: COLOR.HIS, fc: COLOR.HISF }, idx[d] ? { v: '=HYPERLINK("' + idx[d] + '","Open ↗")', fc: COLOR.LINK } : '—'];
  }), [1, 1, 7, 1, 1, 1, 1, 1, 1, 1]);
  sh.getRange(12, 4, rows.length, 1).setWrap(true);
}

/* =============================================================================
 * INSTRUCTIONS
 * ========================================================================== */
function cat_instructions() {
  return [
    { title: 'Catalysts — events, earnings, headlines (Catalysts.gs)', blocks: [
      { text: 'Catalysts.gs schedules every economic release, Fed decision / minutes / speech and Treasury auction you track, fills in the actual numbers as they are released, measures the market\'s reaction to the minute, and captures headlines through the day. Everything appears in your day files and in the hub\'s Event Lookup.' },
      { table: { head: ['Hub tab', 'What it is'], rows: [
        ['Event Master', 'The list of event types. Tick "Track" for the ones you want. Change importance if you like. For events without a free schedule (S&P flash PMIs) type the dates in "Your dates".'],
        ['Event Lookup', 'Pick an event → every release on file with Actual / Previous / Consensus / Forecast, surprise, reactions at +1 / +5 / +15 / +60 min and to the close, your notes and a link to the day file. Filter by beats, misses, inline.'],
        ['Earnings Watchlist', 'Your companies (tick about 10). Next report date, before/after the bell, EPS estimate, last results, stock move and SPX that session. Whisper, confirmed and notes are yours.'],
        ['_EventLog / _Earnings / _Headlines', 'Hidden databases — one row per release, per company report, per headline.']
      ] } },
      { table: { head: ['Data', 'Source', 'Automatic?'], rows: [
        ['Release dates & actual / previous for CPI, PPI, PCE, jobs, claims, retail sales, GDP, durable goods, housing, JOLTS, UMich…', 'FRED (free key)', '✓ Dates weeks ahead; actuals as first released, usually within the hour'],
        ['ISM & S&P Global PMIs, Conference Board, ADP, Beige Book', 'Calendar rules', '✓ Dates · ✗ actuals (type them on the Events & Earnings tab)'],
        ['FOMC decision & minutes', 'Settings FOMC dates + FRED', '✓ Dates · ✓ target range the next day'],
        ['Treasury auctions (2 / 3 / 5 / 7 / 10 / 20 / 30-year)', 'Treasury Fiscal Data (no key)', '✓ Announced dates, high yield, bid-to-cover'],
        ['Fed speeches & testimony', 'Federal Reserve RSS (no key)', '✓ Recent ones, kept permanently'],
        ['Earnings dates, timing, estimates, results', 'Alpha Vantage (free key) · Nasdaq', '✓ About 1–5 calls a day, well under the free limit'],
        ['Headlines', 'CNBC · MarketWatch · Yahoo · Google News RSS (no key)', '✓ Every 30 minutes; relevance, tag and impact automatic'],
        ['Consensus & forecast', '—', '✗ Yours — type them any time, even days ahead']
      ] } },
      { text: 'First-time setup:' },
      { steps: [
        'Get your free FRED and Alpha Vantage keys (see "API keys — when and how") and enter them: Market Report → Setup → Set API keys.',
        'Market Report → Setup → Build / rebuild ALL hub tabs (creates Event Master, Event Lookup, Earnings Watchlist and the databases).',
        'Review the Event Master tab (the most important events are already ticked) and the Earnings Watchlist (10 mega-caps are ticked).',
        'Market Report → Catalysts → Backfill catalysts. Takes 2–5 minutes: builds the schedule, fills actuals, earnings history and the reactions for every day with intraday data. Run it again if it says days remain.',
        'Market Report → Market data → Analyze intraday (all captured days) — so every move is matched to its catalyst.',
        'Market Report → Day files → Build / refresh future days now, and Setup → Install / refresh automatic triggers.'
      ] },
      { table: { head: ['Where you type', 'Syncs to'], rows: [
        ['Report tab → economic events: Consensus, Forecast, Market effect', 'Hub + Events & Earnings tab + Game Plan'],
        ['Events & Earnings tab → Consensus, Forecast, Your note (and Actual for ISM / S&P / ADP / Conference Board)', 'Hub + Report + Game Plan'],
        ['Game Plan → schedule Consensus / Forecast', 'Hub + Report + Events & Earnings'],
        ['Headlines tab → Tag, Impact, Kept, Your note', 'Hub (kept headlines are matched to moves and shown on the Report)'],
        ['Earnings Watchlist (hub) → Whisper, Confirmed, Notes', 'Every day file']
      ] } },
      { tip: 'Surprise = Actual − your Consensus, calculated automatically. Event Lookup\'s beat / miss statistics use it, so the more consensus numbers you enter, the better your history gets.' },
      { warn: 'Headlines can\'t be recovered for past days (free feeds only keep a few days). Everything else — releases, auctions, earnings, reactions — can be backfilled.' }
    ] }
  ];
}
