/*******************************************************************************
 * DayFile.gs  v2.5
 * SPX Daily Market Analysis — day files
 *
 * Owns:  Day Files tab (visible hub archive), _DayFiles (hidden index),
 *        _DailyLog (hidden: your inputs + snapshot per day),
 *        the Day Template (Drive: <Main folder>/_Template), and every day file
 *        (Drive: <Main folder>/<YYYY>/<MM-Month>/<YYYY-MM-DD> SPX Daily).
 * Day files are created days in advance, refreshed automatically, and locked
 * from the hub (inputs collected, PDF saved). Requires Core.gs v2.1+,
 * MarketData.gs v2.0+ and Intraday.gs v1.1+. Catalysts.gs (optional) fills the event,
 * earnings and headline sections through the cat_* hooks.
 ******************************************************************************/

const DF_VERSION = '2.5';
const DF_TEMPLATE_VERSION = '5.0';     // bump to force a template rebuild
const DF_MACRO_TABS = ['Yield Curve', 'FX & Carry', 'Global Markets', 'Commodities & Crypto'];
const DF_TABS = ['Report', 'Macro', 'Yield Curve', 'FX & Carry', 'Global Markets', 'Commodities & Crypto', 'Game Plan', 'Intraday Map', 'Moves (1-min)', 'Minute Heat Map', 'Event Reactions', 'Charts', 'Levels',
  'Events & Earnings', 'Headlines', 'OPEX Cycle', 'Overnight ES', 'Trades & Journal', 'Similar Days', '1-Min Tape', '5-Min Tape', 'About This Day', '_ChartData'];

/* =============================================================================
 * HUB DATABASES
 * ========================================================================== */
function df_indexSpec_() {
  const T = FMT.TEXT;
  return { name: '_DayFiles', hidden: true, title: '_DayFiles  —  one row per day file',
    subtitle: 'Where each day file lives and its status. Maintained by DayFile.gs.',
    cols: [['date', 'Date', 12, T], ['file_id', 'File ID', 30, T], ['url', 'URL', 30, T], ['status', 'Status', 10, T],
      ['created', 'Created', 16, T], ['updated', 'Last refresh', 16, T], ['refreshes', 'Refreshes', 8, '0'],
      ['locked_at', 'Locked at', 16, T], ['pdf_id', 'PDF ID', 30, T], ['template', 'Template', 8, T]] };
}
function df_logSpec_() {
  const T = FMT.TEXT;
  return { name: '_DailyLog', hidden: true, freezeCols: 1, title: '_DailyLog  —  your inputs and a snapshot of every locked day',
    subtitle: 'Collected from each day file when it is locked (and nightly for recent days). The permanent record of your notes.',
    cols: [['date', 'Date', 12, T], ['status', 'Status', 9, T], ['flags', 'Calendar flags', 30, T],
      ['spx_c', 'SPX close', 10, FMT.PRICE], ['pct1', 'Chg %', 8, FMT.PCT], ['range', 'Range', 8, FMT.NUM2], ['vix_c', 'VIX', 7, FMT.NUM2],
      ['day_type_auto', 'Day type (auto)', 14, T], ['day_type', 'Day type (yours)', 14, T], ['regime', 'Regime', 14, T],
      ['readiness', 'Readiness', 12, T], ['followed_plan', 'Followed plan', 12, T], ['discipline', 'Discipline', 18, T],
      ['trades_n', 'Trades', 7, '0'], ['net_pnl', 'Net P&L', 10, '+$#,##0;-$#,##0;$0'], ['fwd_pe', 'Fwd P/E', 8, FMT.NUM2],
      ['strategy', 'Strategy', 30, T], ['objectives', 'Objectives', 30, T], ['evaluation', 'Evaluation', 40, T], ['notes', 'Intraday notes', 40, T],
      ['inputs_json', 'All inputs (data)', 30, T], ['collected', 'Collected', 16, T]] };
}
function df_buildTabs() {
  db_ensure(df_indexSpec_());
  db_ensure(df_logSpec_());
  df_buildArchiveTab_();
}

/* =============================================================================
 * ENTRY POINTS — menu items and triggers
 * ========================================================================== */
/** The trading day the system treats as "today" (next trading day on weekends / holidays). */
function df_workDay_() { const t = cal_today(); return cal_isTradingDay(t) ? t : cal_nextTradingDay(t); }

function df_openToday() {
  const k = df_workDay_();
  const row = df_ensureDay_(k, { fill: !df_indexRow_(k) });
  df_linkDialog_('Today — ' + cal_pretty(k), row.url);
}
function df_refreshTodayNow() {
  const k = df_workDay_();
  core_toast('Refreshing ' + cal_pretty(k) + '…');
  if (k === cal_today()) { md_refreshToday(true); in_processDay(k); }
  df_fillDay_(k);
  core_toast('Day file refreshed ✓');
}
function df_morningPrep(k) { k = k || cal_today(); df_ensureDay_(k, { fill: true }); df_updateShortcut_(k); df_syncEditTriggers_(); }
function df_intradayRefresh(k) { k = k || cal_today(); df_ensureDay_(k, { fill: true, mode: 'light' }); }
function df_endOfDay(k) {
  k = k || cal_today();
  df_ensureDay_(k, { fill: true });
  df_collect_(k, false);
}
/** Keeps the next N trading days built and refreshed (nightly trigger + menu). */
function df_buildFutureDays(fromTrigger) {
  const t0 = Date.now();
  const n = Math.max(1, Math.min(10, core_getSettingNum('Days ahead to build', 5)));
  let k = df_workDay_(); const list = [k];
  while (list.length < n + 1) { k = cal_nextTradingDay(k); list.push(k); }
  let made = 0, refreshed = 0, left = 0, fresh = 0;
  list.forEach(function (d, i) {
    if (Date.now() - t0 > 210000) { left++; return; }          // stay well inside Google's 6-minute limit; the rest continue next run
    const row0 = df_indexRow_(d), existed = !!row0;
    if (fromTrigger !== true && existed && df_ageHours_(row0.updated) < 3) { fresh++; return; }   // a re-run picks up where the last one stopped
    const existed2 = existed;
    df_ensureDay_(d, { fill: true, mode: i === 0 ? 'full' : 'future' });
    if (existed2) refreshed++; else made++;
  });
  if (Date.now() - t0 > 270000) { if (fromTrigger !== true) core_alert('Future days', 'Created ' + made + ' · refreshed ' + refreshed + ' · ' + (left + fresh) + ' already current or left for the next run.'); return; }
  // collect inputs from recent unlocked days so the hub stays current
  df_index_().filter(function (r) { return r.status !== 'Locked' && String(r.date) < cal_today() && String(r.date) >= cal_add(cal_today(), -10); })
    .forEach(function (r) { try { df_collect_(String(r.date), false); } catch (e) { /* skip */ } });
  df_updateShortcut_(df_workDay_());
  df_syncEditTriggers_();
  df_buildArchiveTab_();
  if (fromTrigger !== true) core_alert('Future days', 'Created ' + made + ' · refreshed ' + refreshed + ' day files' + (fresh ? ' · ' + fresh + ' already current' : '') + (left ? ' · ' + left + ' left — run it again' : '') + '\n' + list.map(cal_pretty).join('\n'));
}
function df_rebuildDayPrompt() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Build or rebuild a day', 'Enter a date (MM/DD/YYYY). Existing days are refreshed in place — your notes are kept.', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const k = cal_key(res.getResponseText());
  if (!k || !cal_isTradingDay(k)) { ui.alert('That is not a trading day.'); return; }
  const row = df_ensureDay_(k, { fill: true, force: true });
  df_linkDialog_(cal_pretty(k), row.url);
}
function df_rebuildTemplate() {
  PropertiesService.getScriptProperties().deleteProperty('DF_TEMPLATE_ID');
  const id = df_templateId_();
  core_alert('Day template', 'Template rebuilt ✓\nNew day files use it. Existing days keep their layout; use Day files → Build or rebuild a specific day to refresh one.\n\n' + DriveApp.getFileById(id).getUrl());
}
function df_lockDayPrompt() {
  const ui = SpreadsheetApp.getUi();
  const open = df_index_().filter(function (r) { return r.status !== 'Locked' && String(r.date) <= cal_today(); }).map(function (r) { return String(r.date); }).sort();
  const dflt = open.length ? open[0] : cal_today();
  const res = ui.prompt('Save & Lock a day', 'Date to lock (MM/DD/YYYY). Oldest unlocked day: ' + (open.length ? cal_pretty(dflt) : 'none') +
    '\nLeave blank to lock ' + cal_pretty(dflt) + '.', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const k = res.getResponseText().trim() ? cal_key(res.getResponseText()) : dflt;
  if (!k || !df_indexRow_(k)) { ui.alert('No day file for that date.'); return; }
  if (k === cal_today() && Utilities.formatDate(new Date(), TZ, 'HH:mm') < '16:00' &&
    ui.alert('Market still open', 'Lock ' + cal_pretty(k) + ' before the close?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  core_toast('Locking ' + cal_pretty(k) + '…');
  if (k === cal_today()) { md_updateAll(true); in_processDay(k); }
  df_fillDay_(k);
  df_collect_(k, true);
  const pdf = df_exportPdf_(k);
  df_setIndex_(k, { status: 'Locked', locked_at: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd h:mm a'), pdf_id: pdf || '' });
  df_stampStatus_(k);
  df_buildArchiveTab_();
  ui.alert('🔒 Locked', cal_pretty(k) + ' is locked.\nYour inputs were saved to the hub' + (pdf ? ' and a PDF was archived next to the day file.' : '.'), ui.ButtonSet.OK);
}
function df_unlockDayPrompt() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Unlock a day', 'Date to unlock (MM/DD/YYYY):', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const k = cal_key(res.getResponseText());
  const row = k && df_indexRow_(k);
  if (!row || row.status !== 'Locked') { ui.alert('That day is not locked.'); return; }
  df_setIndex_(k, { status: 'Draft', locked_at: '' });
  df_stampStatus_(k);
  df_buildArchiveTab_();
  ui.alert('🔓 Unlocked', cal_pretty(k) + ' can be edited again. Lock it when done — the PDF is replaced.', ui.ButtonSet.OK);
}


/* =============================================================================
 * PAST DAYS — build a range of past day files in the background
 * Small batches every 10 minutes, only outside market hours on weekdays, within a
 * daily time budget so the regular automation always has room. Stops by itself.
 * ========================================================================== */
function df_rangeJob_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('DF_RANGE') || 'null'); } catch (e) { return null; } }
function df_rangeSave_(job) { PropertiesService.getScriptProperties().setProperty('DF_RANGE', JSON.stringify(job)); }
function df_rangePrompt() {
  const ui = SpreadsheetApp.getUi(), job = df_rangeJob_();
  if (job) { df_rangeStatus(); return; }
  const have = {}; df_index_().forEach(function (r) { have[String(r.date)] = true; });
  const earliest = Object.keys(have).sort()[0] || cal_today();
  const a = ui.prompt('Build or rebuild past days — first day', 'First day to build (MM/DD/YYYY).\n\nRecommended: 07/02/2026 — every day from then on has minute data (5-minute to Aug 27, 1-minute from Aug 28).\nEarlier days are built with daily data only.', ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return;
  const from = cal_key(a.getResponseText()); if (!from) { ui.alert('Could not read that date.'); return; }
  const dflt = cal_prevTradingDay(earliest);
  const b = ui.prompt('Build past days — last day', 'Last day to build (MM/DD/YYYY). Leave blank for ' + cal_pretty(dflt) + ' (the day before your first day file).', ui.ButtonSet.OK_CANCEL);
  if (b.getSelectedButton() !== ui.Button.OK) return;
  const to = b.getResponseText().trim() ? cal_key(b.getResponseText()) : dflt;
  if (!to || to < from || to > cal_today()) { ui.alert('The last day must be on or after the first day and not in the future.'); return; }
  const all = cal_tradingDays(from, to), existing = all.filter(function (d) { return have[d]; }).length;
  let rebuild = false;
  if (existing) {
    const c = ui.alert('Existing day files', existing + ' of the ' + all.length + ' days in that range already have a day file.\n\nYES — rebuild those too, in the latest layout (your amber entries are kept; locked days stay locked)\nNO — build only the missing days', ui.ButtonSet.YES_NO_CANCEL);
    if (c === ui.Button.CANCEL || c === ui.Button.CLOSE) return;
    rebuild = c === ui.Button.YES;
  }
  const days = rebuild ? all : all.filter(function (d) { return !have[d]; });
  if (!days.length) { ui.alert('Every trading day in that range already has a day file.'); return; }
  const j = { from: from, to: to, days: days, rebuild: rebuild, i: 0, made: 0, skipped: 0, rebuilt: 0, errors: 0, started: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd h:mm a') };
  df_rangeSave_(j);
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'df_rangeTick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('df_rangeTick').timeBased().everyMinutes(10).create();
  ui.alert('Past days queued', days.length + ' trading days queued (' + cal_pretty(from) + ' → ' + cal_pretty(to) + ').\n\nThe first batch builds now; the rest continue in the background every 10 minutes — overnight and on weekends, never during market hours — and the job stops by itself when done.\nCheck progress any time: Day files → Past-days build status.', ui.ButtonSet.OK);
  df_rangeTick(true);
}
/** Background step (every 10 minutes while a job exists). */
function df_rangeTick(manual) {
  const job = df_rangeJob_();
  if (!job) { df_rangeStopTrigger_(); return; }
  const p = PropertiesService.getScriptProperties(), today = cal_today(), usedKey = 'DF_RANGE_USED_' + today, used = Number(p.getProperty(usedKey) || 0);
  if (manual !== true) {
    const t = Utilities.formatDate(new Date(), TZ, 'HH:mm'), trading = cal_isTradingDay(today);
    if (trading && t >= '04:00' && t < '20:00') return;                        // leave the whole trading day to the regular automation
    if (used >= (trading ? 45 : 75) * 60) return;                            // daily budget: 45 min on trading days, 75 on weekends / holidays
  }
  const t0 = Date.now();
  while (job.i < job.days.length && Date.now() - t0 < 230000) {
    const d = job.days[job.i];
    try {
      if (!df_indexRow_(d)) { df_ensureDay_(d, { fill: true, mode: 'full' }); job.made++; }
      else if (job.rebuild) { df_ensureDay_(d, { fill: true, mode: 'full', force: true }); job.rebuilt = (job.rebuilt || 0) + 1; }
      else job.skipped++;
    }
    catch (e) { job.errors++; core_logError_('past day ' + d, e); }
    job.i++; df_rangeSave_(job);
  }
  p.setProperty(usedKey, String(used + Math.round((Date.now() - t0) / 1000)));
  if (job.i >= job.days.length) {
    df_rangeStopTrigger_();
    p.deleteProperty('DF_RANGE');
    p.setProperty('DF_RANGE_DONE', 'Finished ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd h:mm a') + ': ' + job.made + ' built, ' + (job.rebuilt ? job.rebuilt + ' rebuilt, ' : '') + job.skipped + ' already existed' + (job.errors ? ', ' + job.errors + ' errors (see the log)' : '') + ' — ' + cal_pretty(job.from) + ' → ' + cal_pretty(job.to));
    try { df_buildArchiveTab_(); } catch (e) { /* next nightly */ }
  }
  if (manual === true) core_toast(job.i >= job.days.length ? 'Past days complete ✓' : 'Past days: ' + job.i + ' of ' + job.days.length + ' done — continuing in the background');
}
function df_rangeStatus() {
  const job = df_rangeJob_(), done = PropertiesService.getScriptProperties().getProperty('DF_RANGE_DONE');
  const msg = job ? 'In progress: ' + job.i + ' of ' + job.days.length + ' trading days (' + cal_pretty(job.from) + ' → ' + cal_pretty(job.to) + ')\nBuilt ' + job.made + (job.rebuilt ? ' · rebuilt ' + job.rebuilt : '') + ' · skipped ' + job.skipped + (job.errors ? ' · errors ' + job.errors : '') +
    (job.days[job.i] ? '\nNext: ' + cal_pretty(job.days[job.i]) : '') + '\n\nRuns every 10 minutes outside market hours (8 PM – 4 AM on weekdays, any time on weekends).'
    : (done || 'No past-days build has been run yet.');
  SpreadsheetApp.getUi().alert('Past-days build', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}
function df_rangeCancel() {
  df_rangeStopTrigger_();
  const job = df_rangeJob_(); PropertiesService.getScriptProperties().deleteProperty('DF_RANGE');
  SpreadsheetApp.getUi().alert('Past-days build', job ? 'Stopped after ' + job.i + ' of ' + job.days.length + ' days. Everything already built is kept; start again any time and it skips days that exist.' : 'Nothing was running.', SpreadsheetApp.getUi().ButtonSet.OK);
}
function df_rangeStopTrigger_() { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'df_rangeTick') ScriptApp.deleteTrigger(t); }); }

/* =============================================================================
 * FILE MANAGEMENT
 * ========================================================================== */
/** Makes sure a day file exists; optionally fills it. Returns its index row. */
function df_ensureDay_(k, o) {
  o = o || {};
  let row = df_indexRow_(k);
  if (row) { try { DriveApp.getFileById(String(row.file_id)).getName(); } catch (e) { row = null; } }
  if (!row) {
    const tid = df_templateId_();
    const folder = core_subFolder(core_pattern(core_getSetting('Day file folders', '{YYYY} / {MM-Month}'), k).split('/'));
    const name = core_pattern(core_getSetting('Day file name', '{YYYY-MM-DD} SPX Daily'), k);
    const file = DriveApp.getFileById(tid).makeCopy(name, folder);
    const stamp = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd h:mm a');
    row = { date: k, file_id: file.getId(), url: file.getUrl(), status: k > cal_today() ? 'Future' : 'Draft', created: stamp, updated: '', refreshes: 0, locked_at: '', pdf_id: '', template: DF_TEMPLATE_VERSION };
    df_setIndex_(k, row);
    df_carryForward_(k, file.getId());
    o.fill = true; o.mode = 'full';                                  // a brand-new file is always drawn in full once
  }
  if (o.fill && (row.status !== 'Locked' || o.force)) df_fillDay_(k, o.mode || 'full');
  return df_indexRow_(k);
}

function df_templateId_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('DF_TEMPLATE_ID'), ver = props.getProperty('DF_TEMPLATE_VER');
  if (id && ver === DF_TEMPLATE_VERSION) { try { if (!DriveApp.getFileById(id).isTrashed()) return id; } catch (e) { /* rebuild */ } }
  if (id) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { /* gone */ } }
  const ss = SpreadsheetApp.create('Day Template v' + DF_TEMPLATE_VERSION);
  df_buildTemplate_(ss);
  DriveApp.getFileById(ss.getId()).moveTo(core_subFolder(['_Template']));
  props.setProperty('DF_TEMPLATE_ID', ss.getId()); props.setProperty('DF_TEMPLATE_VER', DF_TEMPLATE_VERSION);
  return ss.getId();
}

function df_index_() { return db_readAll(df_indexSpec_()).rows; }
function df_indexRow_(k) { const r = df_index_().filter(function (x) { return String(x.date) === k; }); return r.length ? r[0] : null; }
function df_setIndex_(k, patch) {
  const spec = df_indexSpec_();
  const rows = df_index_(); let found = false;
  rows.forEach(function (r) { if (String(r.date) === k) { Object.assign(r, patch); found = true; } });
  if (!found) rows.push(Object.assign({ date: k }, patch));
  rows.sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; });
  db_writeAll(spec, rows);
}

/** Copies carry-forward inputs (levels, strategy, objectives, P/E, checklist, OPEX notes) from the previous day file. */
function df_carryForward_(k, newId) {
  const prev = df_index_().filter(function (r) { return String(r.date) < k; }).sort(function (a, b) { return String(a.date) < String(b.date) ? 1 : -1; })[0];
  if (!prev) return;
  let src;
  try { src = SpreadsheetApp.openById(String(prev.file_id)); df_migrateReport_(src.getSheetByName('Report')); } catch (e) { return; }
  const dst = SpreadsheetApp.openById(newId);
  DF_CARRY.forEach(function (c) {
    try {
      const a = src.getSheetByName(c[0]).getRange(c[1]).getValues();
      dst.getSheetByName(c[0]).getRange(c[1]).setValues(a);
    } catch (e) { /* layout changed */ }
  });
}
// [tab, A1 range] carried from one day to the next
const DF_CARRY = [
  ['Report', 'B45:M56'], ['Report', 'D116'], ['Report', 'D120'],
  ['Game Plan', 'C50:H56'], ['OPEX Cycle', 'C14'], ['Trades & Journal', 'J15:O20']
];

/** Saves a day's inputs into the hub's _DailyLog. */
function df_collect_(k, final) {
  const row = df_indexRow_(k); if (!row) return;
  const ss = SpreadsheetApp.openById(String(row.file_id)), rp = ss.getSheetByName('Report');
  const g = function (a1) { return rp.getRange(a1).getDisplayValue(); };
  const inputs = {};
  DF_INPUT_RANGES.forEach(function (x) { try { inputs[x[0] + '!' + x[1]] = ss.getSheetByName(x[0]).getRange(x[1]).getDisplayValues(); } catch (e) { /* skip */ } });
  const P = in_prices_(), d = P.map[k] || {};
  const tradeRows = rp.getRange('J117:P121').getValues().filter(function (r) { return r[6] !== '' && r[6] !== null; });
  const net = tradeRows.reduce(function (s, r) { return s + (Number(r[6]) || 0); }, 0);
  const logRow = { date: k, status: final ? 'Locked' : (row.status === 'Locked' ? 'Locked' : 'Draft'),
    flags: cal_getFlags(k).flags.map(function (f) { return f.label; }).join(' · '),
    spx_c: d.spx_c, pct1: d.pct1, range: d.range, vix_c: d.vix_c, day_type_auto: d.day_type,
    day_type: g('D134'), regime: g('H134'), readiness: g('L134'), followed_plan: g('P134'), discipline: g('M123'),
    trades_n: tradeRows.length, net_pnl: tradeRows.length ? net : '', fwd_pe: (function () { const a = [g('M17'), g('M18')].map(function (x) { return Number(String(x).replace(/[^0-9.]/g, '')); }).filter(function (x) { return x > 5 && x < 60; }); return a.length ? Math.round(a.reduce(function (p, q) { return p + q; }, 0) / a.length * 100) / 100 : ''; })(),
    strategy: g('D116'), objectives: g('D120'), evaluation: g('B135'), notes: g('B127'),
    inputs_json: JSON.stringify(inputs), collected: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd h:mm a') };
  const spec = df_logSpec_();
  const rows = db_readAll(spec).rows.filter(function (r) { return String(r.date) !== k; });
  rows.push(logRow);
  rows.sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; });
  db_writeAll(spec, rows.map(in_clean_));
}
// Every input area in a day file (collected into _DailyLog as data)
const DF_INPUT_RANGES = [
  ['Report', 'B45:M56'], ['Report', 'H61:Q72'], ['Report', 'K81:Q90'], ['Report', 'M94:Q103'],
  ['Report', 'J117:Q121'], ['Report', 'D116'], ['Report', 'D120'], ['Report', 'M123'], ['Report', 'B127'], ['Report', 'D134:Q134'], ['Report', 'B135'],
  ['Game Plan', 'B8:Q15'], ['Game Plan', 'I19:Q30'], ['Game Plan', 'B45:Q47'], ['Game Plan', 'B50:H56'], ['OPEX Cycle', 'C14'], ['OPEX Cycle', 'C33'],
  ['Trades & Journal', 'C8:C12'], ['Trades & Journal', 'K8:P12'], ['Trades & Journal', 'J15:P20'], ['Trades & Journal', 'B22'], ['Trades & Journal', 'E27:P29']
];

function df_exportPdf_(k) {
  try {
    const row = df_indexRow_(k);
    const ss = SpreadsheetApp.openById(String(row.file_id));
    SpreadsheetApp.flush();
    const gid = ss.getSheetByName('Report').getSheetId();
    const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=pdf&gid=' + gid +
      '&size=letter&portrait=true&fitw=true&gridlines=false&printtitle=false&sheetnames=false&pagenum=UNDEFINED' +
      '&top_margin=0.35&bottom_margin=0.35&left_margin=0.3&right_margin=0.3&horizontal_alignment=CENTER';
    const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return '';
    const name = core_pattern(core_getSetting('PDF file name', '{YYYY-MM-DD} SPX Daily.pdf'), k);
    const folder = DriveApp.getFileById(ss.getId()).getParents().next();
    const old = folder.getFilesByName(name); while (old.hasNext()) old.next().setTrashed(true);
    return folder.createFile(res.getBlob().setName(name)).getId();
  } catch (e) { core_logError_('pdf', e); return ''; }
}

/** Writes the status (Future / Draft / Locked) into the day file header. */
function df_stampStatus_(k) {
  const row = df_indexRow_(k); if (!row) return;
  const rp = SpreadsheetApp.openById(String(row.file_id)).getSheetByName('Report');
  const st = row.status;
  const cell = rp.getRange('P2');
  if (st === 'Locked') cell.setValue('🔒 LOCKED').setBackground(COLOR.OKBG).setFontColor(COLOR.GRN);
  else if (st === 'Future') cell.setValue('◷ UPCOMING').setBackground(COLOR.LAB).setFontColor(COLOR.LABF);
  else cell.setValue(df_isLive_(k) ? '● LIVE' : '✎ DRAFT').setBackground(COLOR.INP).setFontColor(COLOR.INPF);
  rp.getRange('P3').setValue(st === 'Locked' ? 'Locked ' + row.locked_at : 'Updated ' + (row.updated || ''));
}

/* =============================================================================
 * ▶ TODAY SHORTCUT, EDIT TRIGGERS, LINK DIALOG
 * ========================================================================== */
function df_updateShortcut_(k) {
  const row = df_indexRow_(k); if (!row) return;
  const root = core_rootFolder();
  const it = root.getFiles();
  while (it.hasNext()) { const f = it.next(); if (f.getMimeType() === MimeType.SHORTCUT && /^▶ Today/.test(f.getName())) f.setTrashed(true); }
  const sc = DriveApp.createShortcut(String(row.file_id));
  sc.moveTo(root);
  sc.setName('▶ Today — ' + DOW_NAMES[cal_dow(k)] + ' ' + cal_short(k));
}

/** Day files get an edit trigger (for time-stamped notes) while they are current: today and the future days. */
function df_syncEditTriggers_() {
  const want = {};
  df_index_().filter(function (r) { return String(r.date) >= cal_prevTradingDay(cal_today()) && r.status !== 'Locked'; })
    .slice(0, 8).forEach(function (r) { want[String(r.file_id)] = true; });
  const have = {};
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() !== 'df_onDayEdit') return;
    const id = t.getTriggerSourceId();
    if (!want[id] || have[id]) ScriptApp.deleteTrigger(t); else have[id] = true;
  });
  Object.keys(want).forEach(function (id) {
    if (!have[id]) { try { ScriptApp.newTrigger('df_onDayEdit').forSpreadsheet(id).onEdit().create(); } catch (e) { core_logError_('edit trigger', e); } }
  });
}

/** Runs when you type in a current day file. */
function df_onDayEdit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet(), name = sh.getName(), r = e.range.getRow(), c = e.range.getColumn();
  const now = Utilities.formatDate(new Date(), TZ, 'h:mm a');
  if (name === 'Report' && r >= 45 && r < 45 + DF_LV_ROWS && c === 2 && e.range.getValue() !== '' && r + 1 < 45 + DF_LV_ROWS) sh.showRows(r + 1);   // a new key level opens the next row
  if (name === 'Report' && r === 126 && c >= 2 && c <= 17) {
    const text = String(e.range.getValue() || '').trim(); if (!text) return;
    const log = sh.getRange('B127'); const old = String(log.getValue() || '');
    log.setValue(now + '   ' + text + (old && old !== 'No intraday notes yet.' ? '\n' + old : ''));
    e.range.setValue('');
  }
  if (name === 'Game Plan' && r >= 8 && r <= 15 && c >= 4 && c <= 17) {
    const d = sh.getRange(r, 2);
    if (!d.getValue() && e.range.getValue()) d.setValue(cal_short(cal_today()) + ', ' + now);
  }
}

/** Hours since a stamp like "2026-09-26 4:39 PM" (large if unknown). */
function df_ageHours_(s) {
  const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2}) (AM|PM)/);
  if (!m) return 999;
  let h = Number(m[4]); if (m[6] === 'PM' && h < 12) h += 12; if (m[6] === 'AM' && h === 12) h = 0;
  const nowS = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const now = new Date(Number(nowS.slice(0, 4)), Number(nowS.slice(5, 7)) - 1, Number(nowS.slice(8, 10)), Number(nowS.slice(11, 13)), Number(nowS.slice(14, 16)));
  return (now - new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h, Number(m[5]))) / 3600000;
}
/** "Live" only while the session is in progress (4:00 AM – 4:15 PM ET on the day itself). */
function df_isLive_(k) {
  if (k !== cal_today()) return false;
  const t = Utilities.formatDate(new Date(), TZ, 'HH:mm');
  return t >= '04:00' && t <= '16:15';
}

function df_linkDialog_(title, url) {
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Helvetica Neue,Arial;padding:8px 4px">' +
    '<p style="margin:0 0 14px;color:#3A4250">Your day file is ready.</p>' +
    '<a href="' + url + '" target="_blank" onclick="setTimeout(function(){google.script.host.close()},300)" ' +
    'style="background:#1F2A44;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">Open ' + title.replace(/</g, '') + ' ↗</a>' +
    '<script>try{window.open("' + url + '","_blank")}catch(e){}</script></div>').setWidth(420).setHeight(130);
  SpreadsheetApp.getUi().showModalDialog(html, title);
}

/* =============================================================================
 * HUB ARCHIVE TAB (visible) — every day file with links
 * ========================================================================== */
function df_buildArchiveTab_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('Day Files'); if (!sh) sh = ss.insertSheet('Day Files', 0);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart().clear();
  sh.setHiddenGridlines(true); sh.setTabColor(COLOR.TAB_MAIN); sh.setColumnWidth(1, 16);
  [14, 7, 11, 11, 9, 16, 34, 10, 22, 10].forEach(function (w, i) { ui_width(sh, i + 2, w); });
  ui_title(sh, 2, 2, 11, 'DAY FILES  —  every trading day, one click away');
  ui_box(sh, 3, 2, 3, 11, 'Newest first. Future days are created ' + core_getSetting('Days ahead to build', '5') + ' trading days ahead. Lock days from Market Report → Save & Lock a day.',
    { bg: COLOR.LAB, fc: COLOR.LABF, size: 9, italic: true, h: 'left' });
  ui_sub(sh, 5, [[2, 2, 'Date'], [3, 3, 'Day'], [4, 4, 'Status'], [5, 5, 'SPX close'], [6, 6, '%'], [7, 7, 'Day type'], [8, 8, 'Calendar flags'], [9, 9, 'Day file'], [10, 10, 'Your evaluation'], [11, 11, 'PDF']]);
  const P = in_prices_(), logs = {};
  db_readAll(df_logSpec_()).rows.forEach(function (r) { logs[String(r.date)] = r; });
  const rows = df_index_().sort(function (a, b) { return String(a.date) < String(b.date) ? 1 : -1; });
  if (!rows.length) { ui_box(sh, 6, 2, 6, 11, 'No day files yet — Market Report → Day files → Build / refresh future days now.', { fc: COLOR.GRAY, italic: true, h: 'left' }); return; }
  const vals = [], fcs = [], bgs = [];
  rows.forEach(function (r) {
    const k = String(r.date), d = P.map[k] || {}, lg = logs[k] || {};
    const st = r.status === 'Locked' ? '🔒 Locked' : (r.status === 'Future' ? '◷ Upcoming' : (df_isLive_(k) ? '● Live' : '✎ Draft'));
    vals.push([k, DOW_NAMES[cal_dow(k)], st, d.spx_c || '', d.pct1 === undefined ? '' : d.pct1, d.day_type || '',
      df_flags_(k).map(function (f) { return f.label; }).slice(0, 3).join(' · '),
      '=HYPERLINK("' + r.url + '","Open ↗")', String(lg.evaluation || '').slice(0, 60),
      r.pdf_id ? '=HYPERLINK("https://drive.google.com/file/d/' + r.pdf_id + '/view","PDF ↗")' : '']);
    const pc = Number(d.pct1);
    fcs.push([COLOR.TEXT, COLOR.GRAY, r.status === 'Locked' ? COLOR.GRN : (r.status === 'Future' ? COLOR.LABF : COLOR.INPF), COLOR.TEXT, d.pct1 === '' || d.pct1 === undefined ? COLOR.TEXT : (pc >= 0 ? COLOR.GRN : COLOR.RED), COLOR.TEXT, COLOR.PURF, COLOR.LINK, COLOR.HISF, COLOR.LINK]);
    bgs.push([COLOR.WHITE, COLOR.WHITE, COLOR.WHITE, COLOR.WHITE, COLOR.WHITE, COLOR.WHITE, COLOR.PUR, COLOR.WHITE, COLOR.HIS, COLOR.WHITE]);
  });
  const rg = sh.getRange(6, 2, vals.length, 10);
  rg.setValues(vals).setFontColors(fcs).setBackgrounds(bgs).setFontFamily(FONT).setFontSize(9).setHorizontalAlignment('center')
    .setBorder(true, true, true, true, true, true, COLOR.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(6, 5, vals.length, 1).setNumberFormat(FMT.PRICE); sh.getRange(6, 6, vals.length, 1).setNumberFormat(FMT.PCT);
  sh.getRange(6, 8, vals.length, 1).setHorizontalAlignment('left'); sh.getRange(6, 10, vals.length, 1).setHorizontalAlignment('left');
  sh.setFrozenRows(5);
}

/* =============================================================================
 * THE DAY TEMPLATE — every tab's fixed layout, drawn once
 * ========================================================================== */
const DF_W16 = [11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 2.5, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5];
const DF_U16 = [11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5];
const DF_LAYOUT = {
  'Report': [DF_W16, COLOR.TAB_MAIN], 'Macro': [DF_U16, COLOR.TAB_CAT], 'Yield Curve': [DF_U16, COLOR.TAB_CAT], 'FX & Carry': [DF_U16, COLOR.TAB_CAT], 'Global Markets': [DF_U16, COLOR.TAB_CAT], 'Commodities & Crypto': [DF_U16, COLOR.TAB_CAT], 'Game Plan': [DF_U16, COLOR.TAB_MAIN], 'Intraday Map': [DF_U16, COLOR.TAB_TOOL],
  'Moves (1-min)': [[5, 10, 10, 8, 9, 11, 11, 10, 9, 9, 10, 10, 26, 13, 26], COLOR.TAB_TOOL],
  'Minute Heat Map': [[9].concat(Array(30).fill(4.4)).concat([9]), COLOR.TAB_TOOL],
  'Event Reactions': [[10, 30, 11, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 13, 13, 30], COLOR.TAB_CAT],
  'Charts': [DF_U16, COLOR.TAB_TOOL], 'Levels': [[11, 26, 16, 16, 10, 10, 16, 9, 12, 13, 28], COLOR.TAB_TOOL],
  'Events & Earnings': [[10, 11, 32, 10, 9, 9, 10, 10, 10, 12, 26], COLOR.TAB_CAT], 'Headlines': [[9, 50, 12, 12, 8, 8, 8, 8, 10, 8, 24], COLOR.TAB_CAT],
  'OPEX Cycle': [[30, 20, 18, 13, 13, 13, 13, 13, 13, 30], COLOR.TAB_CAT], 'Overnight ES': [[9, 9, 10, 10, 10, 10, 9, 10, 10, 10, 11, 26], COLOR.TAB_TOOL],
  'Trades & Journal': [[9, 9, 17, 7, 6, 8, 8, 10, 9, 12, 14, 9, 11, 12, 26], COLOR.TAB_JOUR],
  'Similar Days': [[12, 8, 9, 9, 9, 9, 9, 11, 9, 9, 9, 9, 9, 9, 9, 26], COLOR.TAB_CAT],
  '1-Min Tape': [[8, 7, 10, 10, 10, 10, 8, 9, 9, 10, 8, 10, 8, 9, 16, 6, 6, 28], COLOR.TAB_RAW],
  '5-Min Tape': [[9, 9, 10, 10, 10, 10, 9, 10, 9, 11, 8, 10, 9, 10, 15, 7, 30], COLOR.TAB_RAW],
  'About This Day': [[28, 22, 20, 52], COLOR.TAB_RAW], '_ChartData': [[], COLOR.TAB_HIDDEN]
};
const DF_TITLES = {
  'Yield Curve': ['YIELD CURVE  —  rates on this day', 'This day first: the curve and its move, the 10-year minute by minute, auctions and Fed speakers — then the full curve, spreads, real yields, term premium and the stock/bond trade-off as they stood that day.'],
  'FX & Carry': ['FX & CARRY  —  the dollar and the yen on this day', 'This day first: USD/JPY and the dollar through the session, carry-trade stress and its reasons — then every major pair, Japan and positioning as they stood that day.'],
  'Global Markets': ['GLOBAL MARKETS  —  the world into this session', 'This day first: how Asia and Europe traded into and during the U.S. session, best and worst — then every index and the last 10 sessions.'],
  'Commodities & Crypto': ['COMMODITIES, CRYPTO & SECTORS  —  this day', 'This day first: oil, gold and Bitcoin minute by minute, the EIA report, sector leaders and laggards — then every market, ratios and sector trends as they stood that day.'],
  'Macro': ['MACRO  —  the cross-asset picture for this day', 'What mattered, the eight stress meters, the Treasury curve, currencies, global markets, commodities, crypto, sectors and what drove the S&P. Kept as a permanent record of the day.'],
  'Game Plan': ['GAME PLAN', 'Opened for planning days ahead. Everything automatic fills as the day approaches; amber cells are yours and are never overwritten.'],
  'Intraday Map': ['INTRADAY MAP  —  when the market moved, how far, and why', 'Session cross-reference, statistics, 30-minute and overnight maps, swings to the minute with matched catalysts, event reaction windows, and charts.'],
  'Moves (1-min)': ['MOVES — TO THE MINUTE', 'Every swing on 1-minute bars at two sizes, plus the fastest bursts. Each move is matched to events, headlines and flows, with the lag from event to move. Sizes are set on the hub\'s Settings tab.'],
  'Minute Heat Map': ['MINUTE HEAT MAP  —  every minute of the session at a glance', 'Each cell is one minute. Top: SPX 1-minute change (green up, red down; darker = bigger). Bottom: SPY volume vs the day\'s average. Purple outline = event or headline minute.'],
  'Event Reactions': ['EVENT REACTIONS  —  every event measured to the minute', 'Points from the price at the event minute. Pre-market events (e.g. 8:30) are measured on /ES. Peak = largest move within 60 minutes. Blue rows compare with past releases.'],
  'Charts': ['CHARTS', 'Native charts, redrawn for this day. Event and headline times are listed beside the charts and outlined in the Minute Heat Map.'],
  'Levels': ['LEVELS — THE LADDER', 'Every level that mattered — yours and automatic — sorted by price around the close. Status is validated against 1-minute data.'],
  'Events & Earnings': ['EVENTS & EARNINGS', 'Today\'s calendar and the next 5 trading days, filled automatically days in advance. Actual / Previous / Consensus / Forecast on every release; consensus and forecast are yours.'],
  'Headlines': ['HEADLINES', 'Candidates pulled from free news feeds through the day. Check the ones that mattered; reactions are measured to the minute and matched to swings.'],
  'OPEX Cycle': ['OPEX CYCLE', 'Where this day sits in the monthly options-expiration cycle, the last expiration and next-trading-day behavior, and recent cycle history.'],
  'Overnight ES': ['OVERNIGHT /ES', 'Asia, London and US pre-market sessions for /ES in 15-minute bars, with SPY pre-market beside it.'],
  'Trades & Journal': ['TRADES & JOURNAL', 'Trades from the Report\'s trade log with context, rules check, lessons and mental state. Amber cells are yours.'],
  'Similar Days': ['SIMILAR DAYS', 'The closest past days by setup, how each one unfolded, and your notes from those days.'],
  '1-Min Tape': ['1-MINUTE TAPE  —  SPX · SPY · /ES', 'Every minute from 8:00 AM (pre-market: SPY & /ES) through 4:00 PM, with heat shading, volume spikes, flags, swing and burst numbers and events.'],
  '5-Min Tape': ['5-MINUTE TAPE  —  the day at a glance', '/ES overnight in 30-minute blocks, pre-market in 5-minute bars, and every 5-minute bar of the regular session.'],
  'About This Day': ['ABOUT THIS DAY FILE', 'How this file was made, its status, data sources, and a guide to every tab.']
};

function df_buildTemplate_(ss) {
  const first = ss.getSheets()[0];
  DF_TABS.forEach(function (name, i) {
    const sh = i === 0 ? first.setName(name) : ss.insertSheet(name);
    const lay = DF_LAYOUT[name];
    sh.setHiddenGridlines(true); sh.setTabColor(lay[1]); sh.setColumnWidth(1, 16);
    const need = Math.max(lay[0].length + 2, 20);
    if (sh.getMaxColumns() < need) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
    lay[0].forEach(function (w, j) { ui_width(sh, j + 2, w); });
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setFontFamily(FONT).setFontSize(10).setFontColor(COLOR.TEXT).setVerticalAlignment('middle');
  });
  const gid = ss.getSheetByName('Report').getSheetId();
  DF_TABS.forEach(function (name) {
    if (name === 'Report' || name === '_ChartData') return;
    const sh = ss.getSheetByName(name), c2 = DF_LAYOUT[name][0].length + 1;
    ui_box(sh, 2, 2, 2, c2 - 2, DF_TITLES[name][0], { bg: COLOR.NAVY, fc: COLOR.WHITE, bold: true, size: 15, h: 'left' });
    ui_box(sh, 2, c2 - 1, 2, c2, null, { fc: COLOR.LINK, bold: true, size: 9 }).setFormula('=HYPERLINK("#gid=' + gid + '","◀ Report")');
    sh.setRowHeight(2, 28);
    ui_box(sh, 3, 2, 3, c2, DF_TITLES[name][1], { bg: COLOR.LAB, fc: COLOR.LABF, size: 9, italic: true, h: 'left', wrap: true });
    sh.setRowHeight(3, 30);
    df_legend_(sh, 4, c2);
    sh.setFrozenRows(4);
  });
  df_tplReport_(ss.getSheetByName('Report'), ss);
  df_tplGamePlan_(ss.getSheetByName('Game Plan'));
  df_tplHeat_(ss.getSheetByName('Minute Heat Map'));
  df_tplOpex_(ss.getSheetByName('OPEX Cycle'));
  df_tplJournal_(ss.getSheetByName('Trades & Journal'));
  df_tplCharts_(ss);
  ss.getSheetByName('_ChartData').hideSheet();
  ss.setActiveSheet(ss.getSheetByName('Report')); ss.moveActiveSheet(1);
}

function df_legend_(sh, r, c2) {
  ui_box(sh, r, 2, r, 2, 'Legend:', { fc: COLOR.LABF, bold: true, size: 9, h: 'left' });
  ui_box(sh, r, 3, r, 3, 'Automated', { size: 9 });
  ui_box(sh, r, 4, r, 4, 'Your input', { bg: COLOR.INP, fc: COLOR.INPF, size: 9 });
  ui_box(sh, r, 5, r, 5, 'From history', { bg: COLOR.HIS, fc: COLOR.HISF, size: 9 });
  ui_box(sh, r, 6, r, 6, 'Event / flag', { bg: COLOR.PUR, fc: COLOR.PURF, size: 9 });
  if (c2 > 7) ui_box(sh, r, 7, r, c2, '', { fc: COLOR.GRAY, size: 9, italic: true });
}

/* ---------------------------------------------------------------- REPORT LAYOUT v4
 * Sections that grow with the day: key levels (12 rows, rows 43–54), economic events
 * (12, rows 59–70), earnings (10, rows 79–88) and headlines (10, rows 92–101). Unused
 * rows are hidden. Older day files are upgraded in place by inserting rows inside each
 * section — everything below, including every amber entry, moves down with its row.
 */
const DF_EV_ROWS = 12, DF_LV_ROWS = 12, DF_ER_ROWS = 10, DF_HL_ROWS = 10;
// calendar flags not shown on day files (still used by Research and the Calendar Ledger)
const DF_FLAG_HIDE = ['TURN_OF_MONTH', 'OPEX_WEEK', 'PRE_HOLIDAY', 'POST_HOLIDAY', 'DAY_BEFORE_OPEX', 'FOMC_WEEK', 'FED_BLACKOUT'];
function df_flags_(k) { return cal_getFlags(k).flags.filter(function (f) { return DF_FLAG_HIDE.indexOf(f.code) < 0; }); }
function df_migrateReport_(sh) {
  const md = sh.getDeveloperMetadata().filter(function (m) { return m.getKey() === 'df_report_layout'; })[0];
  const v = md ? String(md.getValue()) : '2';
  if (v === '5') return false;
  const grow = function (after, n) {                       // n more rows under row `after`, formatted like it
    sh.insertRowsAfter(after, n);
    sh.getRange(after, 1, 1, 17).copyTo(sh.getRange(after + 1, 1, n, 17), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    sh.getRange(after, 1, 1, 17).copyTo(sh.getRange(after + 1, 1, n, 17), SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
    sh.getRange(after + 1, 2, n, 16).clearContent();
    sh.setRowHeights(after + 1, n, sh.getRowHeight(after));
  };
  if (v === '3') { grow(84, 6); grow(77, 7); grow(50, 4); }                  // events were already 12
  else if (v === '2') { grow(75, 6); grow(68, 7); grow(57, 9); grow(50, 4); } // bottom-up, so positions above stay put
  grow(18, 2);                                                                // v5: momentum / context gain two rows
  df_restyleSections_(sh, true);                                              // v5: column I merged, text wraps
  if (md) md.setValue('5'); else sh.addDeveloperMetadata('df_report_layout', '5');
  return true;
}
/*
 * v5 column layouts for the sections that used to put a value in the narrow column I.
 * [first col, last col, style]  styles: a = automated, aL = automated left, i = yours, iL = yours left/top,
 * h = from history, hL = history left, p = purple left
 */
const DF_SEC = {
  events: { sub: 60, r1: 61, n: DF_EV_ROWS, g: [[2, 2, 'a'], [3, 5, 'aL'], [6, 6, 'a'], [7, 7, 'a'], [8, 9, 'i'], [10, 10, 'i'], [11, 11, 'a'], [12, 12, 'a'], [13, 13, 'a'], [14, 14, 'a'], [15, 15, 'a'], [16, 17, 'iL']],
    labels: ['Time', 'Event', 'Actual', 'Previous', 'Consensus', 'Forecast', 'Surprise', 'SPX +5m', '+15m', '+30m', '+1 hr', 'Market effect (your notes)'] },
  last3: { sub: 74, r1: 75, n: 3, g: [[2, 3, 'hL'], [4, 4, 'h'], [5, 5, 'h'], [6, 6, 'h'], [7, 7, 'h'], [8, 9, 'h'], [10, 10, 'h'], [11, 12, 'p'], [13, 17, 'hL']],
    labels: ['Date', 'Actual', 'Consensus', 'Surprise', 'SPX +1m', '+15m', 'To close', 'Calendar context', 'Your note from that day'] },
  earnings: { sub: 80, r1: 81, n: DF_ER_ROWS, g: [[2, 2, 'a'], [3, 4, 'aL'], [5, 6, 'p'], [7, 7, 'a'], [8, 9, 'a'], [10, 10, 'a'], [11, 11, 'h'], [12, 12, 'h'], [13, 13, 'a'], [14, 14, 'a'], [15, 17, 'hL']],
    labels: ['Ticker', 'Company', 'When', 'EPS est.', 'EPS actual', 'Surprise', 'Whisper', 'Confirmed', 'Stock move', 'SPX reaction session', 'Notes'] }
};
function df_restyleSections_(sh, move) {
  // your entries in the events block: Forecast (old column I) → J, Market effect (old O) → P
  let keepF = null, keepE = null;
  if (move) { keepF = sh.getRange(DF_SEC.events.r1, 9, DF_EV_ROWS, 1).getValues(); keepE = sh.getRange(DF_SEC.events.r1, 15, DF_EV_ROWS, 1).getValues(); }
  Object.keys(DF_SEC).forEach(function (k) {
    const S = DF_SEC[k], block = sh.getRange(S.sub, 2, S.n + 1, 16);
    block.breakApart();
    // column header row
    const lab = Array(16).fill(''); S.g.forEach(function (g, j) { lab[g[0] - 2] = S.labels[j]; });
    sh.getRange(S.sub, 2, 1, 16).setValues([lab]).setBackground(COLOR.SUB).setFontColor(COLOR.WHITE).setFontWeight('bold').setFontSize(8).setFontFamily(FONT)
      .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true).setBorder(true, true, true, true, true, true, COLOR.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    // body rows
    const body = sh.getRange(S.r1, 2, S.n, 16), bg = [], fc = [], ha = [], va = [], wr = [];
    for (let r = 0; r < S.n; r++) {
      const b1 = [], f1 = [], h1 = [], v1 = [], w1 = [];
      S.g.forEach(function (g) {
        const st = g[2];
        for (let c = g[0]; c <= g[1]; c++) {
          b1.push(st[0] === 'i' ? COLOR.INP : (st[0] === 'h' ? COLOR.HIS : (st === 'p' ? COLOR.PUR : COLOR.WHITE)));
          f1.push(st[0] === 'i' ? COLOR.INPF : (st[0] === 'h' ? COLOR.HISF : (st === 'p' ? COLOR.PURF : COLOR.TEXT)));
          h1.push(/L$|^p$/.test(st) ? 'left' : 'center'); v1.push(st === 'iL' ? 'top' : 'middle'); w1.push(/L$|^p$/.test(st));
        }
      });
      bg.push(b1); fc.push(f1); ha.push(h1); va.push(v1); wr.push(w1);
    }
    if (k !== 'events') body.clearContent();
    body.setBackgrounds(bg).setFontColors(fc).setHorizontalAlignments(ha).setVerticalAlignments(va).setWraps(wr).setFontFamily(FONT).setFontSize(9)
      .setBorder(true, true, true, true, true, true, COLOR.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    S.g.forEach(function (g) { if (g[1] > g[0]) { sh.getRange(S.sub, g[0], 1, g[1] - g[0] + 1).mergeAcross(); sh.getRange(S.r1, g[0], S.n, g[1] - g[0] + 1).mergeAcross(); } });
  });
  if (move) {
    const ev = DF_SEC.events;
    sh.getRange(ev.r1, 9, ev.n, 1).clearContent();                           // I is now part of Consensus (H:I)
    sh.getRange(ev.r1, 10, ev.n, 1).setValues(keepF.map(function (x) { return [x[0]]; }));
    sh.getRange(ev.r1, 16, ev.n, 1).setValues(keepE.map(function (x) { return [x[0]]; }));
  }
}
/** Rows in the wrapped sections grow to fit their longest text (Sheets does not do this for merged cells). */
function df_fitReportRows_(ss) {
  const sh = ss.getSheetByName('Report'); if (!sh) return;
  const w = []; for (let c = 2; c <= 17; c++) w.push(sh.getColumnWidth(c));
  const fit = function (r1, n, groups, minH) {
    const vals = sh.getRange(r1, 2, n, 16).getDisplayValues();
    vals.forEach(function (row, i) {
      if (sh.isRowHiddenByUser(r1 + i)) return;
      let lines = 1;
      groups.forEach(function (g) {
        const txt = String(row[g[0] - 2] || ''); if (!txt) return;
        let px = 0; for (let c = g[0]; c <= g[1]; c++) px += w[c - 2];
        const per = Math.max(6, Math.floor((px - 10) / 6.3));
        const L = txt.split('\n').reduce(function (a, part) { return a + Math.max(1, Math.ceil(part.length / per)); }, 0);
        lines = Math.max(lines, L);
      });
      sh.setRowHeight(r1 + i, Math.max(minH, 14 * lines + 8));
    });
  };
  fit(DF_SEC.events.r1, DF_EV_ROWS, DF_SEC.events.g, 24);
  fit(DF_SEC.last3.r1, 3, DF_SEC.last3.g, 22);
  fit(DF_SEC.earnings.r1, DF_ER_ROWS, DF_SEC.earnings.g, 22);
  fit(94, DF_HL_ROWS, [[3, 10], [11, 12]], 21);
}
/** Your text areas read left-to-right from the top (not centered) — applied once per file. */
function df_alignInputs_(ss) {
  const rp = ss.getSheetByName('Report');
  if (!rp || rp.getDeveloperMetadata().some(function (m) { return m.getKey() === 'df_align' && m.getValue() === '1'; })) return;
  const L = function (sh, a1, top) { try { const r = sh.getRange(a1); r.setHorizontalAlignment('left').setWrap(true); if (top) r.setVerticalAlignment('top'); } catch (e) { /* layout differs */ } };
  ['D116:H119', 'D120:H123', 'B127:Q131', 'B135:Q140', 'P61:Q72'].forEach(function (a) { L(rp, a, true); });
  ['B126:Q126', 'D45:I56'].forEach(function (a) { L(rp, a, false); });
  const gp = ss.getSheetByName('Game Plan'); if (gp) { ['D8:Q15', 'N19:Q30', 'C50:H56'].forEach(function (a) { L(gp, a, false); }); L(gp, 'D45:Q47', true); }
  const tj = ss.getSheetByName('Trades & Journal'); if (tj) { ['O8:P12', 'E27:P29', 'J15:O20'].forEach(function (a) { L(tj, a, false); }); L(tj, 'B22:P25', true); }
  const ox = ss.getSheetByName('OPEX Cycle'); if (ox) { L(ox, 'C14:K14', false); L(ox, 'C33:K33', false); }
  rp.addDeveloperMetadata('df_align', '1');
}

/* ---------------------------------------------------------------- REPORT */
function df_tplReport_(sh, ss) {
  const A = ui_auto, Lb = ui_label, I = ui_input, H = ui_header;
  const gids = {}; ss.getSheets().forEach(function (s) { gids[s.getName()] = s.getSheetId(); });
  ui_box(sh, 2, 2, 3, 11, 'MARKET TREND  |  Daily Market Analysis — S&P 500', { bg: COLOR.NAVY, fc: COLOR.WHITE, bold: true, size: 16, h: 'left' });
  sh.setRowHeight(2, 24); sh.setRowHeight(3, 24);
  Lb(sh, 2, 12, 13, 'Report date'); A(sh, 2, 14, 15, '', { bold: true });
  ui_box(sh, 2, 16, 2, 17, '', { bold: true });
  Lb(sh, 3, 12, 13, 'Trading day #'); A(sh, 3, 14, 15, '');
  ui_box(sh, 3, 16, 3, 17, '', { fc: COLOR.GRAY, size: 8, italic: true });
  ui_box(sh, 4, 2, 4, 2, 'Legend:', { fc: COLOR.LABF, bold: true, size: 9, h: 'left' });
  ui_box(sh, 4, 3, 4, 4, 'Automated', { size: 9 }); ui_box(sh, 4, 5, 4, 6, 'Your input', { bg: COLOR.INP, fc: COLOR.INPF, size: 9 });
  ui_box(sh, 4, 7, 4, 8, 'From history', { bg: COLOR.HIS, fc: COLOR.HISF, size: 9 }); ui_box(sh, 4, 10, 4, 11, 'Calendar flag', { bg: COLOR.PUR, fc: COLOR.PURF, size: 9 });
  ui_box(sh, 4, 12, 4, 17, 'Amber cells are yours and are never overwritten', { fc: COLOR.GRAY, size: 9, italic: true });
  ui_box(sh, 5, 2, 5, 3, 'NAVIGATE ▸', { bg: COLOR.LAB, fc: COLOR.LABF, bold: true, size: 9, h: 'left' });
  [[4, 5], [6, 7], [8, 9], [10, 11]].forEach(function (p) { ui_box(sh, 5, p[0], 5, p[1], '', { bg: COLOR.LAB, fc: COLOR.LINK, bold: true, size: 9 }); });
  [[12, 13, 'Game Plan'], [14, 15, 'Intraday Map'], [16, 17, 'Moves (1-min)']].forEach(function (p) {
    ui_box(sh, 5, p[0], 5, p[1], null, { bg: COLOR.LAB, fc: COLOR.LINK, bold: true, size: 9 }).setFormula('=HYPERLINK("#gid=' + gids[p[2]] + '","' + p[2] + '")');
  });
  H(sh, 6, 2, 17, 'CALENDAR FLAGS & LOOK-AHEAD');
  [[2, 4], [5, 7], [8, 11], [12, 14], [15, 17]].forEach(function (s) { ui_box(sh, 7, s[0], 7, s[1], '', { bg: COLOR.PUR, fc: COLOR.PURF, bold: true, size: 9, wrap: true }); });
  sh.setRowHeight(7, 30);
  H(sh, 9, 2, 8, 'MOMENTUM'); H(sh, 9, 10, 17, 'MARKET CONTEXT');
  ui_sub(sh, 10, [[2, 4, 'Window'], [5, 6, 'Points'], [7, 8, '%']]); ui_sub(sh, 10, [[10, 12, 'Measure'], [13, 14, 'Value'], [15, 17, 'Change / note']]);
  ['Pre-market (SPY-implied)', 'Daily', 'Prev 3 days', 'Prev 5 days', 'Prev 10 days', 'Prev 20 days'].forEach(function (n, i) {
    Lb(sh, 11 + i, 2, 4, n); A(sh, 11 + i, 5, 6, '', { fmt: FMT.PTS }); A(sh, 11 + i, 7, 8, '', { fmt: FMT.PCT });
  });
  Lb(sh, 17, 2, 4, 'Win / loss streak'); A(sh, 17, 5, 8, '');
  Lb(sh, 18, 2, 4, 'RSI (14) / ATR (14)'); A(sh, 18, 5, 8, '');
  ['VIX @ close', 'VIX9D', 'VIX9D / VIX ratio', '10-yr yield', '2-yr yield', 'DXY'].forEach(function (n, i) {
    Lb(sh, 11 + i, 10, 12, n); A(sh, 11 + i, 13, 14, '', { fmt: i === 3 || i === 4 ? '0.000' : FMT.NUM2 }); A(sh, 11 + i, 15, 17, '', { size: 9 });
  });
  Lb(sh, 17, 10, 12, 'Fwd S&P 500 P/E (weekly)'); I(sh, 17, 13, 14, '', { fmt: '0.0', h: 'center' }); A(sh, 17, 15, 17, '', { size: 9 });
  Lb(sh, 18, 10, 12, 'Expected move vs actual'); A(sh, 18, 13, 14, ''); A(sh, 18, 15, 17, '', { size: 9 });
  H(sh, 20, 2, 8, 'SESSION DATA — SPX (CASH)'); H(sh, 20, 10, 17, 'SPY — PRE-MARKET & INTRADAY');
  ['Open', 'Intraday high', 'Intraday low', 'Close', 'Range (pts)', 'Gap vs prior close', 'Volume (bn)'].forEach(function (n, i) {
    Lb(sh, 21 + i, 2, 4, n); A(sh, 21 + i, 5, 6, '', { fmt: i === 5 ? FMT.PTS : (i === 6 ? FMT.NUM2 : FMT.PRICE), bold: i === 3 }); A(sh, 21 + i, 7, 8, '', { size: 9 });
  });
  Lb(sh, 28, 2, 4, 'Day type (auto)'); A(sh, 28, 5, 8, '', { bold: true, size: 9 });
  ['Pre-market high', 'Pre-market low', 'Pre-market range', 'Opening range 30m high', 'Opening range 30m low', 'VWAP', 'SPY close'].forEach(function (n, i) {
    Lb(sh, 21 + i, 10, 12, n); A(sh, 21 + i, 13, 14, '', { fmt: FMT.PRICE }); A(sh, 21 + i, 15, 17, '', { size: 9 });
  });
  Lb(sh, 28, 10, 12, 'Time of HOD / LOD'); A(sh, 28, 13, 17, '', { size: 9 });
  H(sh, 30, 2, 8, 'MOVING AVERAGES @ CLOSE'); H(sh, 30, 10, 17, 'PREVIOUS DAY KEY LEVELS & PIVOTS');
  ui_sub(sh, 31, [[2, 3, 'Average'], [4, 5, 'Value'], [6, 6, 'Pts'], [7, 7, '%'], [8, 8, 'Position']]);
  ui_sub(sh, 31, [[10, 12, 'Level'], [13, 14, 'Price'], [15, 16, 'Dist. from close'], [17, 17, 'Status']]);
  ['9-day EMA', '21-day SMA', '50-day SMA', '100-day SMA', '200-day SMA'].forEach(function (n, i) {
    Lb(sh, 32 + i, 2, 3, n); A(sh, 32 + i, 4, 5, '', { fmt: FMT.PRICE }); A(sh, 32 + i, 6, 6, '', { fmt: FMT.PTS }); A(sh, 32 + i, 7, 7, '', { fmt: FMT.PCT }); A(sh, 32 + i, 8, 8, '', { bold: true });
  });
  [['9 / 21 cross', 37], ['50 / 200 cross', 38], ['Bollinger (20,2)', 39]].forEach(function (x) { Lb(sh, x[1], 2, 3, x[0]); A(sh, x[1], 4, 8, '', { size: 9 }); });
  ['Prev open', 'Prev high', 'Prev low', 'Prev close', 'Prior week high', 'Prior week low', 'Pivot (P)'].forEach(function (n, i) {
    Lb(sh, 32 + i, 10, 12, n); A(sh, 32 + i, 13, 14, '', { fmt: FMT.PRICE }); A(sh, 32 + i, 15, 16, '', { fmt: FMT.PTS }); A(sh, 32 + i, 17, 17, '', { bold: true });
  });
  Lb(sh, 39, 10, 12, 'R1 / S1 / R2 / S2'); A(sh, 39, 13, 17, '', { size: 9 });
  H(sh, 41, 2, 17, 'KEY SUPPORT / RESISTANCE LEVELS  —  you enter the level, the script validates it  (full ladder: Levels tab)');
  ui_sub(sh, 42, [[2, 2, 'Price'], [3, 3, 'Type'], [4, 6, 'Daily description'], [7, 9, 'Historical comments'], [10, 11, 'Validation'], [12, 12, 'Position'], [13, 13, 'Impact'], [14, 14, 'Touches (30d)'], [15, 15, 'Last test'], [16, 17, 'Status today']]);
  const dv = function (list) { return SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(true).build(); };
  for (let i = 0; i < 8; i++) {
    const r = 43 + i;
    I(sh, r, 2, 2, '', { fmt: '#,##0.00', h: 'center' }); I(sh, r, 3, 3, '', { h: 'center' }); I(sh, r, 4, 6, ''); I(sh, r, 7, 9, '');
    A(sh, r, 10, 11, '', { size: 9 }); A(sh, r, 12, 12, '', { size: 9 }); I(sh, r, 13, 13, '', { h: 'center' }); A(sh, r, 14, 14, ''); A(sh, r, 15, 15, '', { size: 9 }); A(sh, r, 16, 17, '', { size: 9 });
    sh.getRange(r, 3).setDataValidation(dv(['Support', 'Resistance', 'Pivot', 'Support → Resistance', 'Resistance → Support']));
    sh.getRange(r, 13).setDataValidation(dv(['High', 'Med', 'Low']));
  }
  ui_hist(sh, 51, 2, 17, '', { h: 'left', size: 9 });
  H(sh, 53, 2, 17, 'NOTABLE ECONOMIC EVENTS  (ET)  —  reactions measured to the minute  (detail: Event Reactions tab)');
  ui_sub(sh, 54, [[2, 2, 'Time'], [3, 5, 'Event'], [6, 6, 'Actual'], [7, 7, 'Previous'], [8, 8, 'Consensus'], [9, 9, 'Forecast'], [10, 10, 'Surprise'], [11, 11, 'SPX +1m'], [12, 12, '+5m'], [13, 13, '+15m'], [14, 14, 'To close'], [15, 17, 'Market effect (your notes)']]);
  for (let i = 0; i < 3; i++) {
    const r = 55 + i;
    A(sh, r, 2, 2, '', { size: 9 }); A(sh, r, 3, 5, '', { h: 'left', size: 9, bold: true }); A(sh, r, 6, 6, '', { bold: true }); A(sh, r, 7, 7, '');
    I(sh, r, 8, 8, '', { h: 'center' }); I(sh, r, 9, 9, '', { h: 'center' });
    for (let c = 10; c <= 14; c++) A(sh, r, c, c, '', { fmt: FMT.PTS1, size: 9 });
    I(sh, r, 15, 17, ''); sh.setRowHeight(r, 28);
  }
  ui_hist(sh, 58, 2, 17, '', { bold: true, size: 9, h: 'left' });
  ui_sub(sh, 59, [[2, 3, 'Date'], [4, 4, 'Actual'], [5, 5, 'Consensus'], [6, 6, 'Surprise'], [7, 7, 'SPX +1m'], [8, 8, '+15m'], [9, 9, 'To close'], [10, 12, 'Calendar context'], [13, 17, 'Your note from that day']]);
  for (let i = 0; i < 3; i++) { const r = 60 + i; [[2, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8], [9, 9], [10, 12], [13, 17]].forEach(function (p) { ui_hist(sh, r, p[0], p[1], '', { size: 9 }); }); }
  H(sh, 64, 2, 17, 'EARNINGS — TOP-10 WATCHLIST  (today + next 5 trading days · recent results)');
  ui_sub(sh, 65, [[2, 2, 'Ticker'], [3, 4, 'Company'], [5, 5, 'Date'], [6, 6, 'Timing'], [7, 7, 'EPS est.'], [8, 8, 'EPS actual'], [9, 9, 'Surprise'], [10, 10, 'Whisper'], [11, 11, 'Confirmed'], [12, 12, 'Stock move'], [13, 13, 'SPX next day'], [14, 17, 'Notes']]);
  for (let i = 0; i < 3; i++) { const r = 66 + i; [[2, 2], [3, 4], [5, 5], [6, 6], [7, 7], [8, 8], [9, 9], [12, 12], [13, 13]].forEach(function (p) { A(sh, r, p[0], p[1], '', { size: 9 }); }); I(sh, r, 10, 10, '', { h: 'center' }); I(sh, r, 11, 11, '', { h: 'center' }); I(sh, r, 14, 17, ''); }
  H(sh, 70, 2, 17, 'DAILY HEADLINES  —  kept items, with SPX reaction to the minute  (all candidates: Headlines tab)');
  ui_sub(sh, 71, [[2, 2, 'Time'], [3, 10, 'Headline'], [11, 12, 'Source'], [13, 13, 'Tag'], [14, 14, 'Impact'], [15, 15, 'SPX +1m'], [16, 16, 'SPX +5m'], [17, 17, 'Kept']]);
  for (let i = 0; i < 4; i++) { const r = 72 + i; A(sh, r, 2, 2, '', { size: 9 }); A(sh, r, 3, 10, '', { h: 'left', size: 9 }); A(sh, r, 11, 12, '', { size: 9 }); I(sh, r, 13, 13, '', { h: 'center' }); I(sh, r, 14, 14, '', { h: 'center' }); A(sh, r, 15, 15, '', { fmt: FMT.PTS1 }); A(sh, r, 16, 16, '', { fmt: FMT.PTS1 }); I(sh, r, 17, 17, '', { h: 'center' }); }
  H(sh, 77, 2, 17, 'OPTIONS EXPIRATION  —  cycle view  (detail: OPEX Cycle tab)');
  for (let i = 0; i < 3; i++) { Lb(sh, 78 + i, 2, 4, ''); A(sh, 78 + i, 5, 8, '', { size: 9 }); Lb(sh, 78 + i, 10, 12, ''); A(sh, 78 + i, 13, 17, '', { size: 9 }); }
  H(sh, 82, 2, 17, 'INTRADAY AT A GLANCE  —  (full detail: Intraday Map · Moves (1-min) · Minute Heat Map · Charts)');
  for (let i = 0; i < 3; i++) { Lb(sh, 83 + i, 2, 4, ''); A(sh, 83 + i, 5, 8, '', { size: 9, bold: true }); Lb(sh, 83 + i, 10, 12, ''); A(sh, 83 + i, 13, 17, '', { size: 9, bold: true }); }
  H(sh, 87, 2, 8, 'TRADE STRATEGY / OBJECTIVES'); H(sh, 87, 10, 17, 'TRADE LOG  (full journal: Trades & Journal tab)');
  Lb(sh, 88, 2, 3, 'Strategy'); I(sh, 88, 4, 8, '', { r2: 91 });
  Lb(sh, 92, 2, 3, 'Objectives'); I(sh, 92, 4, 8, '', { r2: 95 });
  ui_sub(sh, 88, [[10, 10, 'Time'], [11, 11, 'Contract'], [12, 12, 'Side'], [13, 13, 'Qty'], [14, 14, 'Entry'], [15, 15, 'Exit'], [16, 16, 'P&L'], [17, 17, 'Setup']]);
  for (let i = 0; i < 5; i++) {
    const r = 89 + i;
    [10, 11, 12, 13, 14, 15, 17].forEach(function (c) { I(sh, r, c, c, '', { h: 'center', fmt: c === 14 || c === 15 ? '0.00' : null }); });
    A(sh, r, 16, 16, null, { fmt: '+$#,##0;-$#,##0;$0', bold: true }).setFormula('=IF(AND(ISNUMBER(N' + r + '),ISNUMBER(O' + r + ')),(O' + r + '-N' + r + ')*IF(ISNUMBER(M' + r + '),M' + r + ',1)*100*IF(L' + r + '="Short",-1,1),"")');
    sh.getRange(r, 12).setDataValidation(dv(['Long', 'Short']));
  }
  sh.getRange('P89:P93').setFontColor(COLOR.TEXT);
  const cf = sh.getConditionalFormatRules();
  cf.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setFontColor(COLOR.GRN).setRanges([sh.getRange('P89:P93')]).build());
  cf.push(SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setFontColor(COLOR.RED).setRanges([sh.getRange('P89:P93')]).build());
  sh.setConditionalFormatRules(cf);
  Lb(sh, 94, 10, 12, 'Net P&L / win rate');
  A(sh, 94, 13, 17, null, { bold: true }).setFormula('=IF(COUNT(P89:P93)=0,"No completed trades",TEXT(SUM(P89:P93),"+$#,##0;-$#,##0")&"   ·   "&COUNTIF(P89:P93,">0")&" of "&COUNT(P89:P93)&" ("&TEXT(COUNTIF(P89:P93,">0")/COUNT(P89:P93),"0%")&")")');
  Lb(sh, 95, 10, 12, 'Discipline score'); I(sh, 95, 13, 17, '');
  H(sh, 97, 2, 17, 'INTRADAY NOTES  —  type in the amber bar and press Enter; each note is time-stamped (ET)');
  I(sh, 98, 2, 17, '');
  A(sh, 99, 2, 17, 'No intraday notes yet.', { r2: 103, h: 'left', wrap: true, size: 9 }); sh.getRange(99, 2).setVerticalAlignment('top').setFontColor(COLOR.GRAY);
  H(sh, 105, 2, 17, 'DAILY EVALUATION & OBSERVATIONS');
  [[2, 3, 'Day type ▾', 4, 5, ['Trend up', 'Trend down', 'Range', 'V-reversal up', 'Reversal down', 'Inside day', 'Outside day', 'Mixed']],
   [6, 7, 'Regime ▾', 8, 9, ['Bull trend', 'Bear trend', 'Choppy / range', 'Event-driven', 'High volatility', 'Low volatility']],
   [10, 11, 'Readiness ▾', 12, 13, ['Focused', 'Confident', 'Tired', 'Distracted', 'Emotional', 'Mental reset']],
   [14, 15, 'Followed plan ▾', 16, 17, ['Yes', 'Mostly', 'Partly', 'No', 'Did not trade']]].forEach(function (x) {
    Lb(sh, 106, x[0], x[1], x[2]); I(sh, 106, x[3], x[4], '', { h: 'center' }); sh.getRange(106, x[3]).setDataValidation(dv(x[5]));
  });
  I(sh, 107, 2, 17, '', { r2: 112 });
  H(sh, 114, 2, 17, 'SIMILAR PAST DAYS  —  auto-matched on gap, VIX, MA position, calendar flags, and events  (detail: Similar Days tab)');
  ui_sub(sh, 115, [[2, 3, 'Date'], [4, 4, 'Match'], [5, 9, 'Setup'], [10, 10, 'SPX move'], [11, 11, 'Range'], [12, 13, 'Day type'], [14, 17, 'Your note that day']]);
  for (let i = 0; i < 3; i++) { const r = 116 + i; [[2, 3], [4, 4], [5, 9], [10, 10], [11, 11], [12, 13], [14, 17]].forEach(function (p) { ui_hist(sh, r, p[0], p[1], '', { size: 9 }); }); }
  ui_hist(sh, 119, 2, 17, '', { h: 'left', bold: true, size: 9 });
  H(sh, 121, 2, 17, 'DATA HEALTH & ARCHIVE');
  for (let i = 0; i < 8; i++) ui_box(sh, 122, 2 + i * 2, 122, 3 + i * 2, '', { bold: true, size: 9 });
  A(sh, 123, 2, 17, '', { h: 'left', italic: true, size: 9, color: COLOR.GRAY });
  sh.setFrozenRows(5);
  df_migrateReport_(sh);                                                 // template is drawn, then given the growing-sections layout
}

/* ---------------------------------------------------------------- GAME PLAN */
function df_tplGamePlan_(sh) {
  const A = ui_auto, Lb = ui_label, I = ui_input, H = ui_header;
  H(sh, 6, 2, 17, 'WHAT TO WATCH  —  your notes, typed any day in advance (the date fills itself)');
  ui_sub(sh, 7, [[2, 3, 'Added'], [4, 17, 'Note']]);
  for (let i = 0; i < 8; i++) { I(sh, 8 + i, 2, 3, '', { h: 'center' }); I(sh, 8 + i, 4, 17, ''); }
  H(sh, 17, 2, 17, 'TODAY\'S SCHEDULE  (ET)  —  with how the market reacted last time');
  ui_sub(sh, 18, [[2, 2, 'Time'], [3, 6, 'Item'], [7, 7, 'Actual'], [8, 8, 'Previous'], [9, 9, 'Consensus'], [10, 10, 'Forecast'], [11, 11, 'Importance'], [12, 13, 'History'], [14, 17, 'Your plan']]);
  for (let i = 0; i < 12; i++) {
    const r = 19 + i;
    A(sh, r, 2, 2, '', { size: 9, bold: true }); A(sh, r, 3, 6, '', { h: 'left', size: 9 }); A(sh, r, 7, 7, '', { size: 9 }); A(sh, r, 8, 8, '', { size: 9 });
    I(sh, r, 9, 9, '', { h: 'center' }); I(sh, r, 10, 10, '', { h: 'center' }); A(sh, r, 11, 11, '', { size: 9, color: COLOR.GOLD });
    ui_hist(sh, r, 12, 13, '', { size: 9 }); I(sh, r, 14, 17, '');
  }
  H(sh, 32, 2, 9, 'LEVELS TO WATCH  (nearest to the reference close)'); H(sh, 32, 10, 17, 'EXPECTED MOVE & VOLATILITY');
  ui_sub(sh, 33, [[2, 3, 'Level'], [4, 6, 'Source'], [7, 8, 'Distance'], [9, 9, 'Type']]); ui_sub(sh, 33, [[10, 13, 'Measure'], [14, 17, 'Value']]);
  for (let i = 0; i < 8; i++) {
    const r = 34 + i;
    A(sh, r, 2, 3, '', { fmt: FMT.PRICE, bold: true }); A(sh, r, 4, 6, '', { size: 9 }); A(sh, r, 7, 8, '', { fmt: FMT.PTS }); A(sh, r, 9, 9, '', { size: 9 });
    Lb(sh, r, 10, 13, ''); A(sh, r, 14, 17, '', { size: 9 });
  }
  H(sh, 43, 2, 17, 'SCENARIOS  —  if / then (yours)');
  ui_sub(sh, 44, [[2, 3, 'Scenario'], [4, 8, 'Trigger'], [9, 13, 'Plan'], [14, 17, 'Invalidation']]);
  [['Bull', COLOR.OKBG, COLOR.GRN], ['Bear', COLOR.ERRBG, COLOR.RED], ['Chop', COLOR.LAB, COLOR.LABF]].forEach(function (x, i) {
    const r = 45 + i; ui_box(sh, r, 2, r, 3, x[0], { bg: x[1], fc: x[2], bold: true }); I(sh, r, 4, 8, ''); I(sh, r, 9, 13, ''); I(sh, r, 14, 17, '');
  });
  H(sh, 49, 2, 8, 'PRE-MARKET CHECKLIST  (edit the items to make it yours)'); H(sh, 49, 10, 17, 'HISTORY FOR THIS SETUP');
  ['Review overnight /ES — Asia & London ranges', 'Check VIX term structure & 10Y yield', 'Confirm event times & consensus entered', 'Set alerts at key levels',
   'Max loss for the day set', 'No trades within ±3 min of major releases', 'Re-read yesterday\'s lesson'].forEach(function (t, i) {
    I(sh, 50 + i, 2, 2, false, { h: 'center' }); sh.getRange(50 + i, 2).insertCheckboxes(); I(sh, 50 + i, 3, 8, t);
    Lb(sh, 50 + i, 10, 13, ''); ui_hist(sh, 50 + i, 14, 17, '', { size: 9 });
  });
}

/* ---------------------------------------------------------------- HEAT MAP */
function df_tplHeat_(sh) {
  [[6, 'SPX — 1-MINUTE CHANGE (pts)'], [22, 'SPY — 1-MINUTE VOLUME vs DAY AVERAGE']].forEach(function (x) {
    ui_header(sh, x[0], 2, 33, x[1]);
    ui_box(sh, x[0] + 1, 2, x[0] + 1, 2, 'Half-hour', { bg: COLOR.SUB, fc: COLOR.WHITE, bold: true, size: 8 });
    for (let j = 0; j < 30; j++) ui_box(sh, x[0] + 1, 3 + j, x[0] + 1, 3 + j, j % 5 === 0 ? ':' + ('0' + j).slice(-2) : '', { bg: COLOR.SUB, fc: COLOR.WHITE, bold: true, size: 7 });
    ui_box(sh, x[0] + 1, 33, x[0] + 1, 33, x[0] === 6 ? 'Net' : 'Avg', { bg: COLOR.SUB, fc: COLOR.WHITE, bold: true, size: 8 });
    for (let k = 0; k < 13; k++) {
      const r = x[0] + 2 + k, m = 570 + 30 * k;
      ui_label(sh, r, 2, 2, md_ampm_(in_hhmm_(m)).replace(' AM', 'a').replace(' PM', 'p'));
      sh.setRowHeight(r, 18);
    }
    const body = sh.getRange(x[0] + 2, 3, 13, 31);
    body.setFontSize(6).setHorizontalAlignment('center').setBorder(true, true, true, true, true, true, COLOR.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(x[0] + 2, 3, 13, 30).setNumberFormat(x[0] === 6 ? '+0.0;-0.0;0' : '0.0"x"');
  });
  ui_header(sh, 38, 2, 33, 'READING THE MAP');
  ui_auto(sh, 39, 2, 33, '', { h: 'left', size: 9, wrap: true, r2: 42 }); sh.getRange(39, 2).setVerticalAlignment('top');
}

/* ---------------------------------------------------------------- OPEX */
function df_tplOpex_(sh) {
  const Lb = ui_label, A = ui_auto;
  ui_header(sh, 6, 2, 11, 'CURRENT CYCLE');
  for (let i = 0; i < 7; i++) { Lb(sh, 7 + i, 2, 2, ''); A(sh, 7 + i, 3, 6, '', { h: 'left', bold: true }); }
  Lb(sh, 14, 2, 2, 'Your cycle notes'); ui_input(sh, 14, 3, 11, '');
  ui_header(sh, 16, 2, 11, 'LAST EXPIRATION');
  for (let i = 0; i < 6; i++) { Lb(sh, 17 + i, 2, 2, ''); A(sh, 17 + i, 3, 6, '', { h: 'left', bold: true }); }
  Lb(sh, 23, 2, 2, 'Your notes (last cycle)'); A(sh, 23, 3, 11, '', { h: 'left', size: 9 });
  ui_header(sh, 25, 2, 11, 'NEXT TRADING DAY AFTER THE LAST EXPIRATION');
  ui_sub(sh, 26, [[2, 2, 'Measure'], [3, 3, 'Value'], [4, 4, 'Time'], [5, 11, 'Detail']]);
  for (let i = 0; i < 6; i++) { Lb(sh, 27 + i, 2, 2, ''); A(sh, 27 + i, 3, 3, '', { bold: true, size: 9 }); A(sh, 27 + i, 4, 4, '', { size: 9 }); A(sh, 27 + i, 5, 11, '', { h: 'left', size: 9 }); }
  Lb(sh, 33, 2, 2, 'Your notes (next day)'); ui_input(sh, 33, 3, 11, '');
  ui_header(sh, 35, 2, 11, 'HISTORY — last 6 cycles');
  ui_sub(sh, 36, [[2, 2, 'Expiration'], [3, 3, 'Type'], [4, 4, 'Cycle %'], [5, 5, 'OPEX day %'], [6, 6, 'Next day'], [7, 7, 'Gap'], [8, 8, 'Gap filled'], [9, 9, 'Next-day %'], [10, 10, 'Range vs ATR'], [11, 11, 'Note']]);
  for (let i = 0; i < 6; i++) [[2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8], [9, 9], [10, 10], [11, 11]].forEach(function (p) { ui_hist(sh, 37 + i, p[0], p[1], '', { size: 9 }); });
  ui_hist(sh, 43, 2, 11, '', { h: 'left', bold: true, size: 9 });
}

/* ---------------------------------------------------------------- TRADES & JOURNAL */
function df_tplJournal_(sh) {
  const I = ui_input, A = ui_auto, Lb = ui_label;
  ui_header(sh, 6, 2, 16, 'TRADE DETAIL  (trades come from the Report\'s trade log; context is automatic; the rest is yours)');
  ui_sub(sh, 7, [[2, 2, 'Time'], [3, 3, 'Exit time'], [4, 4, 'Contract'], [5, 5, 'Side'], [6, 6, 'Qty'], [7, 7, 'Entry $'], [8, 8, 'Exit $'], [9, 9, 'P&L'], [10, 10, 'SPX at entry'], [11, 11, 'R multiple'], [12, 12, 'Setup'], [13, 13, 'Rules followed'], [14, 14, 'Emotion'], [15, 16, 'What I\'d do again / differently']]);
  sh.setRowHeight(7, 30);
  for (let i = 0; i < 5; i++) {
    const r = 8 + i, s = 89 + i;
    const f = function (c, formula, o) { A(sh, r, c, c, null, o || { size: 9 }).setFormula(formula); };
    f(2, '=IF(Report!J' + s + '="","",Report!J' + s + ')'); I(sh, r, 3, 3, '', { h: 'center' });
    f(4, '=IF(Report!K' + s + '="","",Report!K' + s + ')'); f(5, '=IF(Report!L' + s + '="","",Report!L' + s + ')');
    f(6, '=IF(Report!M' + s + '="","",Report!M' + s + ')'); f(7, '=IF(Report!N' + s + '="","",Report!N' + s + ')', { fmt: '0.00', size: 9 });
    f(8, '=IF(Report!O' + s + '="","",Report!O' + s + ')', { fmt: '0.00', size: 9 }); f(9, '=Report!P' + s, { fmt: '+$#,##0;-$#,##0;$0', bold: true });
    A(sh, r, 10, 10, '', { fmt: FMT.PRICE, size: 9 }); I(sh, r, 11, 11, '', { h: 'center', fmt: '+0.0"R";-0.0"R"' });
    f(12, '=IF(Report!Q' + s + '="","",Report!Q' + s + ')'); I(sh, r, 13, 13, '', { h: 'center' }); I(sh, r, 14, 14, '', { h: 'center' }); I(sh, r, 15, 16, '');
  }
  ui_header(sh, 14, 2, 8, 'DAY STATS'); ui_header(sh, 14, 10, 16, 'RULES CHECK');
  [['Net P&L', '=IF(COUNT(I8:I12)=0,"—",TEXT(SUM(I8:I12),"+$#,##0;-$#,##0"))'], ['Win rate', '=IF(COUNT(I8:I12)=0,"—",COUNTIF(I8:I12,">0")&" of "&COUNT(I8:I12))'],
   ['Avg R', '=IF(COUNT(K8:K12)=0,"—",TEXT(AVERAGE(K8:K12),"+0.0""R"";-0.0""R"""))'], ['Largest win', '=IF(COUNTIF(I8:I12,">0")=0,"—",TEXT(MAX(I8:I12),"+$#,##0"))'],
   ['Largest loss', '=IF(COUNTIF(I8:I12,"<0")=0,"—",TEXT(MIN(I8:I12),"-$#,##0"))'], ['Trades', '=COUNTA(D8:D12)']].forEach(function (x, i) {
    Lb(sh, 15 + i, 2, 4, x[0]); A(sh, 15 + i, 5, 8, null, { bold: true }).setFormula(x[1]);
  });
  ['Waited for the planned setup', 'Traded only at planned levels', 'Max loss respected', 'No trades in lunch chop', 'Stopped after hitting the day\'s goal', 'Journaled each trade within 5 minutes'].forEach(function (t, i) {
    I(sh, 15 + i, 10, 15, t); I(sh, 15 + i, 16, 16, false, { h: 'center' }); sh.getRange(15 + i, 16).insertCheckboxes();
  });
  ui_header(sh, 21, 2, 16, 'LESSONS & RULES');
  ui_input(sh, 22, 2, 16, '', { r2: 25 });
  ui_header(sh, 26, 2, 16, 'EMOTIONAL & MENTAL STATE');
  ['Pre-market readiness', 'During the session', 'After the close'].forEach(function (t, i) { Lb(sh, 27 + i, 2, 4, t); I(sh, 27 + i, 5, 16, ''); });
}

/* ---------------------------------------------------------------- CHARTS (template objects) */
function df_tplCharts_(ss) {
  const cd = ss.getSheetByName('_ChartData');
  if (cd.getMaxColumns() < 40) cd.insertColumnsAfter(cd.getMaxColumns(), 40 - cd.getMaxColumns());
  if (cd.getMaxRows() < 400) cd.insertRowsAfter(cd.getMaxRows(), 400 - cd.getMaxRows());
  cd.getRange('A1:E1').setValues([['Time', 'Low', 'Open', 'Close', 'High']]); cd.getRange('G1:K1').setValues([['Time', 'Low', 'Open', 'Close', 'High']]);
  cd.getRange('M1:P1').setValues([['Time', 'SPX %', 'SPY %', '/ES %']]); cd.getRange('R1:S1').setValues([['Time', 'SPY volume (M)']]);
  cd.getRange('U1:V1').setValues([['SPX level', 'SPY volume (M)']]); cd.getRange('X1:AB1').setValues([['Time', 'Low', 'Open', 'Close', 'High']]);
  cd.getRange('AD1:AH1').setValues([['Time', 'Low', 'Open', 'Close', 'High']]);
  const candle = function (sh, a1, title, row, col, w, h) {
    return sh.newChart().setChartType(Charts.ChartType.CANDLESTICK).addRange(cd.getRange(a1)).setNumHeaders(1)
      .setPosition(row, col, 0, 0).setOption('title', title).setOption('legend', { position: 'none' })
      .setOption('candlestick', { fallingColor: { fill: '#B42318', stroke: '#B42318' }, risingColor: { fill: '#1B7F3B', stroke: '#1B7F3B' } })
      .setOption('colors', ['#3A4250']).setOption('width', w).setOption('height', h).setOption('fontName', FONT).build();
  };
  const ch = ss.getSheetByName('Charts'), im = ss.getSheetByName('Intraday Map');
  ui_header(ch, 6, 2, 13, 'SPX — 1-MINUTE CANDLES'); ui_header(ch, 6, 14, 17, 'EVENT MARKERS');
  ch.insertChart(candle(ch, 'A1:E391', 'SPX 1-minute', 7, 2, 1000, 330));
  ui_sub(ch, 7, [[14, 14, 'Time'], [15, 15, 'SPX'], [16, 17, 'Event']]);
  ui_header(ch, 25, 2, 9, 'SPX — 5-MINUTE CANDLES'); ui_header(ch, 25, 10, 17, 'CUMULATIVE % — SPX vs SPY vs /ES');
  ch.insertChart(candle(ch, 'G1:K79', 'SPX 5-minute', 26, 2, 640, 300));
  const line = function (sh, row, col, w, h) {
    return sh.newChart().setChartType(Charts.ChartType.LINE).addRange(cd.getRange('M1:P391')).setNumHeaders(1).setPosition(row, col, 0, 0)
      .setOption('title', 'Cumulative % from the 9:30 open').setOption('colors', ['#1F2A44', '#0F6E56', '#BA7517']).setOption('legend', { position: 'bottom' })
      .setOption('lineWidth', 1.5).setOption('width', w).setOption('height', h).setOption('fontName', FONT).build();
  };
  ch.insertChart(line(ch, 26, 10, 640, 300));
  ui_header(ch, 43, 2, 9, 'SPY VOLUME BY 5 MINUTES'); ui_header(ch, 43, 10, 17, 'VOLUME AT PRICE (SPY volume by SPX 5-pt level)');
  ch.insertChart(ch.newChart().setChartType(Charts.ChartType.COLUMN).addRange(cd.getRange('R1:S79')).setNumHeaders(1).setPosition(44, 2, 0, 0)
    .setOption('title', 'SPY volume (M) per 5 minutes').setOption('colors', ['#185FA5']).setOption('legend', { position: 'none' }).setOption('width', 640).setOption('height', 300).setOption('fontName', FONT).build());
  ch.insertChart(ch.newChart().setChartType(Charts.ChartType.BAR).addRange(cd.getRange('U1:V41')).setNumHeaders(1).setPosition(44, 10, 0, 0)
    .setOption('title', 'Volume at price').setOption('colors', ['#534AB7']).setOption('legend', { position: 'none' }).setOption('width', 640).setOption('height', 300).setOption('fontName', FONT).build());
  ui_header(ch, 61, 2, 17, '/ES OVERNIGHT — 15-MINUTE CANDLES (prior evening → 9:30 AM)');
  ch.insertChart(candle(ch, 'X1:AB121', '/ES overnight 15-minute', 62, 2, 1300, 300));
  // Intraday Map charts (moved into place on each refresh)
  im.insertChart(candle(im, 'AD1:AH27', 'SPX — 15-minute candles', 120, 2, 640, 300));
  im.insertChart(line(im, 120, 10, 640, 300));
}

/* =============================================================================
 * FILLING A DAY FILE
 * ========================================================================== */
// Which tabs each kind of refresh redraws: 'full' = all; 'light' = what changes during the session; 'future' = what can change before the day
const DF_LIGHT = ['Report', 'Intraday Map', 'Moves (1-min)', 'Minute Heat Map', 'Event Reactions', 'Charts', 'Levels', 'Events & Earnings', 'Headlines', 'Trades & Journal', '1-Min Tape'];
const DF_FUTURE = ['Report', 'Macro', 'Yield Curve', 'FX & Carry', 'Global Markets', 'Commodities & Crypto', 'Game Plan', 'Events & Earnings', 'Headlines', 'OPEX Cycle', 'Levels', 'Overnight ES', 'About This Day'];
function df_fillDay_(k, mode) {
  mode = mode || 'full';
  const row = df_indexRow_(k); if (!row) return;
  const ss = SpreadsheetApp.openById(String(row.file_id));
  const ctx = df_ctx_(k); ctx.row = row; ctx.ss = ss; ctx.index = df_index_();
  ctx.gids = {}; ss.getSheets().forEach(function (s) { ctx.gids[s.getName()] = s.getSheetId(); });
  // older day files: upgrade the Report to the 12-event layout, and copy in any tabs added since they were made
  try { df_migrateReport_(ss.getSheetByName('Report')); df_alignInputs_(ss); } catch (e) { core_logError_('upgrade Report', e); }
  const missing = ['Macro'].concat(DF_MACRO_TABS).filter(function (t) { return !ss.getSheetByName(t); });
  if (missing.length) {
    try {
      const tpl = SpreadsheetApp.openById(df_templateId_());
      missing.forEach(function (t) { const src = tpl.getSheetByName(t); if (!src) return; const m = src.copyTo(ss).setName(t); ss.setActiveSheet(m); ss.moveActiveSheet(DF_TABS.indexOf(t) + 1); ctx.gids[t] = m.getSheetId(); });
    } catch (e) { core_logError_('add macro tabs', e); }
  }
  [['Report', df_fillReport_], ['Macro', df_fillMacro_], ['Yield Curve', df_fillMacroDay_], ['FX & Carry', df_fillMacroDay_], ['Global Markets', df_fillMacroDay_], ['Commodities & Crypto', df_fillMacroDay_], ['Game Plan', df_fillGamePlan_], ['Intraday Map', df_fillIntraday_], ['Moves (1-min)', df_fillMoves_],
   ['Minute Heat Map', df_fillHeat_], ['Event Reactions', df_fillReactions_], ['Charts', df_fillCharts_], ['Levels', df_fillLevels_],
   ['Events & Earnings', df_fillEvents_], ['Headlines', df_fillHeadlines_], ['OPEX Cycle', df_fillOpex_], ['Overnight ES', df_fillOvernight_],
   ['Trades & Journal', df_fillJournal_], ['Similar Days', df_fillSimilar_], ['1-Min Tape', df_fillTape1_], ['5-Min Tape', df_fillTape5_],
   ['About This Day', df_fillAbout_]].forEach(function (x) {
    const sh = ss.getSheetByName(x[0]);
    if (!sh) return;
    if ((mode === 'light' && DF_LIGHT.indexOf(x[0]) < 0) || (mode === 'future' && DF_FUTURE.indexOf(x[0]) < 0)) return;
    try { x[1](sh, ctx); } catch (e) { core_logError_('fill ' + x[0] + ' ' + k, e); }
  });
  if (core_fnExists_('cat_afterFill')) { try { cat_afterFill(ss, ctx); } catch (e) { core_logError_('cat afterFill ' + k, e); } }
  if (core_fnExists_('mc_afterFill')) { try { mc_afterFill(ss, ctx); } catch (e) { core_logError_('mc afterFill ' + k, e); } }
  if (core_fnExists_('af_afterFill')) { try { af_afterFill(ss, ctx); } catch (e) { core_logError_('af afterFill ' + k, e); } }
  if (core_fnExists_('an_afterFill') && mode !== 'light') { try { an_afterFill(ss, ctx); } catch (e) { core_logError_('an afterFill ' + k, e); } }
  try { df_fitReportRows_(ss); } catch (e) { core_logError_('fit rows ' + k, e); }
  // links always point at this file's own tabs
  DF_TABS.forEach(function (name) {
    if (name === 'Report' || name === '_ChartData') return;
    const sh = ss.getSheetByName(name); if (!sh) return;
    sh.getRange(2, DF_LAYOUT[name][0].length).setFormula('=HYPERLINK("#gid=' + ctx.gids['Report'] + '","◀ Report")');
  });
  const rp = ss.getSheetByName('Report');
  [[12, 'Game Plan'], [14, 'Intraday Map'], [16, 'Moves (1-min)']].forEach(function (x) { rp.getRange(5, x[0]).setFormula('=HYPERLINK("#gid=' + ctx.gids[x[1]] + '","' + x[1] + '")'); });
  const stamp = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd h:mm a');
  const status = row.status === 'Future' && k <= cal_today() ? 'Draft' : row.status;
  df_setIndex_(k, { updated: stamp, refreshes: (Number(row.refreshes) || 0) + 1, status: status });
  df_stampStatus_(k);
  SpreadsheetApp.flush();
}

function df_ctx_(k) {
  const P = in_prices_(), today = cal_today();
  const d = P.map[k] || null, pk = cal_prevTradingDay(k), pd = P.map[pk] || null;
  const last = P.rows[P.rows.length - 1] || {};
  const ref = d || pd || last, refDate = d ? k : (pd ? pk : String(last.date || ''));
  const events = in_events_(k);
  let bars = null, A = null;
  if (k <= today) {
    bars = md_getBars(k);
    if (bars.spx1.length || bars.spx5.length || bars.es1.length || bars.es5.length || bars.spy1.length || bars.spy5.length) A = in_analyze(k, bars, P, events);
  }
  let health = {}; try { health = JSON.parse(PropertiesService.getScriptProperties().getProperty('MD_HEALTH') || '{}'); } catch (e) { /* none */ }
  const sessions = {}; db_readAll(in_sessionsSpec_()).rows.forEach(function (r) { sessions[String(r.date)] = r; });
  return { k: k, flags: cal_getFlags(k), P: P, d: d, pd: pd, ref: ref, refDate: refDate, A: A, bars: bars, events: events, today: today,
    isFuture: k > today, health: health, sessions: sessions, idx: md_indexRow_(k) };
}

/* ---------- small helpers ---------- */
function DC_(sh, r1, c1, r2, c2) {                     // read-modify-write canvas (never touches cells you don't set)
  const rg = sh.getRange(r1, c1, r2 - r1 + 1, c2 - c1 + 1);
  const o = { v: rg.getValues(), f: rg.getFormulas(), fc: rg.getFontColors(), fw: rg.getFontWeights(), bg: rg.getBackgrounds(), dirty: {} };
  o.set = function (r, c, val, opt) {
    const i = r - r1, j = c - c1;
    o.v[i][j] = (val === null || val === undefined || (typeof val === 'number' && !isFinite(val))) ? '' : val; o.f[i][j] = '';
    opt = opt || {};
    o.fc[i][j] = opt.fc || COLOR.TEXT; o.dirty.fc = true;
    if (opt.bg) { o.bg[i][j] = opt.bg; o.dirty.bg = true; }
    if (opt.b !== undefined) { o.fw[i][j] = opt.b ? 'bold' : 'normal'; o.dirty.fw = true; }
  };
  o.get = function (r, c) { return o.v[r - r1][c - c1]; };
  o.flush = function () {
    rg.setValues(o.v.map(function (row, i) { return row.map(function (x, j) { return o.f[i][j] ? o.f[i][j] : x; }); }));
    if (o.dirty.fc) rg.setFontColors(o.fc); if (o.dirty.bg) rg.setBackgrounds(o.bg); if (o.dirty.fw) rg.setFontWeights(o.fw);
  };
  return o;
}
/** Writes a table in one pass. cells: rows of values or {v, fc, bg, b, nf, h}. o.nf / o.h: per-column defaults. */
function TW_(sh, r, c, cells, o) {
  if (!cells.length) return;
  o = o || {};
  const w = cells[0].length, n = cells.length;
  if (sh.getMaxRows() < r + n) sh.insertRowsAfter(sh.getMaxRows(), r + n - sh.getMaxRows() + 20);
  const V = [], FC = [], BG = [], FW = [], NF = [], HA = [];
  cells.forEach(function (row) {
    const v = [], fc = [], bg = [], fw = [], nf = [], ha = [];
    for (let j = 0; j < w; j++) {
      let x = row[j]; if (x === undefined) x = '';
      const obj = x !== null && typeof x === 'object' && !(x instanceof Date) ? x : { v: x };
      let val = obj.v; if (val === null || val === undefined || (typeof val === 'number' && !isFinite(val))) val = '';
      v.push(val); fc.push(obj.fc || (o.fc && o.fc[j]) || COLOR.TEXT); bg.push(obj.bg || (o.bg && o.bg[j]) || COLOR.WHITE);
      fw.push(obj.b ? 'bold' : 'normal'); nf.push(obj.nf || (o.nf && o.nf[j]) || 'General'); ha.push(obj.h || (o.h && o.h[j]) || 'center');
    }
    V.push(v); FC.push(fc); BG.push(bg); FW.push(fw); NF.push(nf); HA.push(ha);
  });
  const rg = sh.getRange(r, c, n, w);
  rg.setNumberFormats(NF).setValues(V).setFontColors(FC).setBackgrounds(BG).setFontWeights(FW).setHorizontalAlignments(HA)
    .setFontFamily(FONT).setFontSize(o.size || 9).setVerticalAlignment('middle').setWrap(!!o.wrap)
    .setBorder(true, true, true, true, true, true, COLOR.BORDER, SpreadsheetApp.BorderStyle.SOLID);
}
function df_clearBody_(sh, r0) {
  const n = sh.getMaxRows() - r0 + 1; if (n <= 0) return;
  const rg = sh.getRange(r0, 1, n, sh.getMaxColumns());
  rg.breakApart(); rg.clear(); rg.clearDataValidations(); rg.clearNote();
  sh.setRowHeights(r0, n, 21);
}
/** Reads the amber inputs in a dynamic table so they can be put back after the table is redrawn. */
function df_keep_(sh, r0, keyFn, cols) {
  const lr = sh.getLastRow(); const map = {};
  if (lr < r0) return map;
  const w = Math.max.apply(null, cols) + 1;
  sh.getRange(r0, 1, lr - r0 + 1, w).getValues().forEach(function (row) {
    const k = keyFn(row); if (!k) return;
    const vals = cols.map(function (c) { return row[c - 1]; });
    if (vals.some(function (x) { return x !== '' && x !== false; })) map[k] = vals;
  });
  return map;
}
/** Groups bars into clock-aligned buckets (e.g. 5 → :00, :05, :10…), so a missing minute never shifts later bars. */
function df_bucket_(bars, mins) {
  const out = [], by = {};
  bars.forEach(function (b) {
    const k = Math.floor(b.m / mins) * mins;
    let g = by[k];
    if (!g) { g = by[k] = { time: in_hhmm_(k), m: k, off: b.off, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v || 0 }; out.push(g); }
    else { g.h = Math.max(g.h, b.h); g.l = Math.min(g.l, b.l); g.c = b.c; g.v += b.v || 0; }
  });
  return out;
}
/** Highest high / lowest low of the Monday–Friday week before day k (days far ahead use the latest completed week). */
function df_priorWeek_(ctx) {
  let mon = cal_add(ctx.k, -((cal_dow(ctx.k) + 6) % 7));
  for (let back = 1; back <= 4; back++) {
    const a = cal_add(mon, -7 * back), b = cal_add(a, 4);
    const rows = ctx.P.rows.filter(function (r) { const x = String(r.date); return x >= a && x <= b; });
    const complete = rows.length && cal_tradingDays(a, b).every(function (x) { return ctx.P.map[x]; });
    if (rows.length && (complete || back > 1)) return { h: Math.max.apply(null, rows.map(function (r) { return Number(r.spx_h); })),
      l: Math.min.apply(null, rows.map(function (r) { return Number(r.spx_l); })), label: back === 1 ? '' : ' (wk of ' + cal_short(a) + ')' };
    if (rows.length) return { h: Math.max.apply(null, rows.map(function (r) { return Number(r.spx_h); })), l: Math.min.apply(null, rows.map(function (r) { return Number(r.spx_l); })), label: ' (so far)' };
  }
  return null;
}
function df_pn_(v) { return v === '' || v === null || v === undefined || isNaN(v) ? COLOR.TEXT : (Number(v) >= 0 ? COLOR.GRN : COLOR.RED); }
function df_heat_(v, scale) {
  if (v === '' || v === null || v === undefined || isNaN(v)) return COLOR.WHITE;
  const a = Math.min(1, Math.abs(v) / scale), base = v >= 0 ? [0x1B, 0x7F, 0x3B] : [0xB4, 0x23, 0x18];
  return '#' + base.map(function (c) { return ('0' + Math.round(255 - (255 - c) * a * 0.6).toString(16)).slice(-2); }).join('').toUpperCase();
}
function df_vheat_(v) {
  const a = Math.min(1, Math.max(0, (v - 0.6)) / 3);
  return '#' + [0x18, 0x5F, 0xA5].map(function (c) { return ('0' + Math.round(255 - (255 - c) * a * 0.7).toString(16)).slice(-2); }).join('').toUpperCase();
}
function df_f_(v, dec) { return v === '' || v === null || v === undefined || isNaN(v) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: dec === undefined ? 2 : dec, maximumFractionDigits: dec === undefined ? 2 : dec }); }
function df_s_(v, dec) { return v === '' || v === null || v === undefined || isNaN(v) ? '—' : (Number(v) >= 0 ? '+' : '−') + df_f_(Math.abs(v), dec); }
function df_p_(v) { return v === '' || v === null || v === undefined || isNaN(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(2) + '%'; }
function df_t_(t) { return t ? md_ampm_(t) : '—'; }
function df_n_(v) { return v === '' || v === null || v === undefined ? null : Number(v); }
function df_short_(t) { return md_ampm_(t).replace(' AM', 'a').replace(' PM', 'p'); }
function df_link_(url, text) { return '=HYPERLINK("' + url + '","' + String(text).replace(/"/g, "'") + '")'; }
function df_placeholder_(sh, r, c1, c2, text) { ui_box(sh, r, c1, r, c2, text, { fc: COLOR.GRAY, italic: true, size: 9, h: 'left', wrap: true }); sh.setRowHeight(r, 28); }
function df_fileUrl_(ctx, k) { const r = ctx.index.filter(function (x) { return String(x.date) === k; })[0]; return r ? r.url : ''; }
function df_title_(sh, ctx, text) { sh.getRange(2, 2).setValue(text + '  —  ' + cal_pretty(ctx.k)); }
function df_legendNote_(sh, text) { sh.getRange(4, 7).setValue(text); }

/* ---------------------------------------------------------------- REPORT */
function df_fillReport_(sh, ctx) {
  const k = ctx.k, d = ctx.d, pd = ctx.pd, ref = ctx.ref, A = ctx.A, f = ctx.flags;
  const C = DC_(sh, 1, 1, 151, 17);
  const n = df_n_, T = COLOR.TEXT, G = COLOR.GRAY;
  const note = function (r, c, v, fc) { C.set(r, c, v === '' || v === null || v === undefined ? '' : v, { fc: fc || G }); };
  const val = function (r, c, v, fc, b) { C.set(r, c, v === null || v === '' || v === undefined ? '—' : v, { fc: fc || T, b: b }); };
  // header & navigation
  C.set(2, 14, cal_pretty(k), { b: true });
  C.set(3, 14, f.isTradingDay ? f.meta.tradingDayOfYear + ' of ' + f.meta.tradingDaysInYear : f.closedReason);
  const pk = cal_prevTradingDay(k), nk = cal_nextTradingDay(k), today = df_workDay_();
  const link = function (c, day, label) {
    const u = df_fileUrl_(ctx, day);
    if (u) { C.set(5, c, df_link_(u, label), { fc: COLOR.LINK, b: true }); C.f[4][c - 1] = df_link_(u, label); }
    else C.set(5, c, label, { fc: G, b: true });
  };
  link(4, pk, '◀ ' + DOW_NAMES[cal_dow(pk)] + ' ' + cal_short(pk)); link(6, nk, DOW_NAMES[cal_dow(nk)] + ' ' + cal_short(nk) + ' ▶');
  link(8, today, '▶ Today'); C.set(5, 10, df_link_(SpreadsheetApp.getActive().getUrl(), 'Hub ↗'), { fc: COLOR.LINK, b: true }); C.f[4][9] = df_link_(SpreadsheetApp.getActive().getUrl(), 'Hub ↗');
  // calendar flags & look-ahead
  const pills = df_flags_(k).map(function (x) { return x.label; });
  if (!pills.length) pills.push(f.isTradingDay ? 'No calendar flags today' : 'MARKET CLOSED — ' + f.closedReason.toUpperCase());
  const po = cal_prevOpex(k), poRow = ctx.P.map[po.date];
  const cyc = poRow && ref && ref.spx_c ? (Number(ref.spx_c) - Number(poRow.spx_c)) / Number(poRow.spx_c) : null;
  const look = ['Next OPEX ' + DOW_NAMES[cal_dow(f.meta.nextOpex)] + ' ' + cal_short(f.meta.nextOpex) + ' (' + f.meta.calendarDaysToOpex + 'd)' + (cyc !== null ? ' · cycle ' + df_p_(cyc) : '')];
  if (f.meta.nextFomc) look.unshift('Next FOMC ' + DOW_NAMES[cal_dow(f.meta.nextFomc)] + ' ' + cal_short(f.meta.nextFomc) + ' (' + Math.round((cal_parse(f.meta.nextFomc) - cal_parse(k)) / 864e5) + 'd)');
  const me = cal_lastTradingDayOfMonth(cal_y(k), cal_m(k));
  if (me > k && cal_tradingDays(cal_add(k, 1), me).length <= 5) look.unshift((cal_m(k) % 3 === 0 ? 'Q' + (cal_m(k) / 3) + ' ends ' : 'Month ends ') + DOW_NAMES[cal_dow(me)] + ' ' + cal_short(me) + ' (' + cal_tradingDays(cal_add(k, 1), me).length + ' trading days)');
  const slots = [2, 5, 8, 12, 15], all = pills.slice(0, 5 - Math.min(look.length, 2)).concat(look).slice(0, 5);
  if (pills.length > 5 - Math.min(look.length, 2)) all[5 - Math.min(look.length, 2) - 1] += '  +' + (pills.length - (5 - Math.min(look.length, 2)) + 1) + ' more';
  slots.forEach(function (c, i) { C.set(7, c, all[i] || '', { fc: COLOR.PURF, bg: all[i] ? COLOR.PUR : COLOR.WHITE, b: true }); });
  // momentum
  const asOf = !d && ref ? ' (as of ' + cal_short(ctx.refDate) + ')' : '';
  let pm = null, pmPts = null;
  if (A && A.spyPreLast && pd && pd.spy_c) { pm = (A.spyPreLast - pd.spy_c) / pd.spy_c; pmPts = pm * pd.spx_c; }
  [[pmPts, pm]].concat([1, 3, 5, 10, 20].map(function (x) { return d ? [n(d['chg' + x]), n(d['pct' + x])] : [null, null]; })).forEach(function (m, i) {
    val(11 + i, 5, m[0], df_pn_(m[0])); val(11 + i, 7, m[1], df_pn_(m[1]));
  });
  // month to date / year to date (vs the last close of the prior month / year)
  const lastBefore = function (cut) { let x = null; ctx.P.rows.forEach(function (r0) { if (String(r0.date) < cut) x = r0; }); return x; };
  const cur = d || null, mBase = cur ? lastBefore(k.slice(0, 8) + '01') : null, yBase = cur ? lastBefore(k.slice(0, 5) + '01-01') : null;
  [[17, 'Month to date', mBase], [18, 'Year to date', yBase]].forEach(function (x) {
    C.set(x[0], 2, x[1], { fc: COLOR.LABF, b: true });
    const pts = cur && x[2] ? Number(cur.spx_c) - Number(x[2].spx_c) : null, pc = pts !== null ? pts / Number(x[2].spx_c) : null;
    val(x[0], 5, pts, df_pn_(pts)); val(x[0], 7, pc, df_pn_(pc));
  });
  sh.getRange('E11:F18').setNumberFormat(FMT.PTS); sh.getRange('G11:H18').setNumberFormat(FMT.PCT);   // momentum points / % (repairs files where the % format was lost)
  C.set(19, 2, 'Win / loss streak', { fc: COLOR.LABF, b: true }); C.set(20, 2, 'RSI (14) / ATR (14)', { fc: COLOR.LABF, b: true });
  const stk = d ? n(d.streak) : null;
  val(19, 5, stk ? (stk > 0 ? '▲ ' + stk + ' day' + (stk > 1 ? 's' : '') + ' up' : '▼ ' + (-stk) + ' day' + (stk < -1 ? 's' : '') + ' down') : '', df_pn_(stk));
  val(20, 5, ref ? df_f_(ref.rsi14) + '   /   ' + df_f_(ref.atr14, 1) + ' pts' + asOf : '');
  // context
  const cv = function (key) { return ref ? n(ref[key]) : null; };
  const pv = function (key) { const r2 = d ? pd : ctx.P.map[cal_prevTradingDay(ctx.refDate)]; return r2 ? n(r2[key]) : null; };
  const vix = cv('vix_c'), vixP = pv('vix_c');
  val(11, 13, vix); note(11, 15, vix !== null && vixP ? df_s_(vix - vixP) + ' / ' + df_p_((vix - vixP) / vixP) + asOf : '', vix !== null && vixP ? (vix - vixP > 0 ? COLOR.RED : COLOR.GRN) : G);
  val(12, 13, cv('vix9d')); note(12, 15, cv('vix9d') !== null && vix ? (cv('vix9d') < vix ? 'Below VIX' : 'Above VIX') : '');
  const vr = cv('vix_ratio'); val(13, 13, vr); note(13, 15, vr !== null ? (vr < 1 ? 'Contango — calm' : 'Backwardation — near-term stress') : '', vr !== null && vr >= 1 ? COLOR.RED : COLOR.GRN);
  val(14, 13, cv('us10y')); note(14, 15, cv('us10y') !== null && pv('us10y') !== null ? df_s_((cv('us10y') - pv('us10y')) * 100, 0) + ' bp' : '');
  val(15, 13, cv('us2y')); note(15, 15, ref && ref.spread_2s10s !== '' && ref.spread_2s10s !== undefined ? '2s10s ' + df_s_(n(ref.spread_2s10s), 0) + ' bp' : (cv('us2y') === null ? 'FRED posts the next morning' : ''));
  val(16, 13, cv('dxy')); note(16, 15, cv('dxy') !== null && pv('dxy') ? df_s_(cv('dxy') - pv('dxy')) : '');
  [[17, 'Fwd P/E — FactSet (weekly)'], [18, 'Fwd P/E — S&P DJI (daily)'], [19, 'Equity risk premium'], [20, 'Expected move vs actual']].forEach(function (x) { C.set(x[0], 10, x[1], { fc: COLOR.LABF, b: true }); });
  [17, 18, 19].forEach(function (r0) { C.set(r0, 13, '—', { fc: G, bg: COLOR.WHITE }); C.set(r0, 15, 'Filled by Macro.gs', { fc: G }); });
  const emBase = pd || ref, emPts = emBase && emBase.vix_c && emBase.spx_c ? Number(emBase.spx_c) * Number(emBase.vix_c) / 100 / Math.sqrt(252) : null;
  val(20, 13, emPts !== null ? '±' + df_f_(emPts, 0) + (d ? ' / ' + df_f_(d.range, 0) : '') : '');
  const emR = emPts && d ? Number(d.range) / emPts : null;
  note(20, 15, emR !== null ? (emR <= 1 ? 'Inside EM (' : 'Exceeded EM (') + Math.round(emR * 100) + '%)' : (emPts ? 'Implied range ' + df_f_(Number(emBase.spx_c) - emPts, 0) + '–' + df_f_(Number(emBase.spx_c) + emPts, 0) : ''), emR !== null ? (emR <= 1 ? COLOR.GRN : COLOR.RED) : G);
  // session SPX
  // labels for this block are rewritten every refresh (repairs files filled while positions were off)
  [2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17].forEach(function (c) { C.set(21, c, ''); C.set(31, c, ''); });
  C.set(22, 2, 'SESSION DATA — SPX (CASH)', { fc: COLOR.WHITE, b: true }); C.set(22, 10, 'SPY — PRE-MARKET & INTRADAY', { fc: COLOR.WHITE, b: true });
  C.set(32, 2, 'MOVING AVERAGES @ CLOSE', { fc: COLOR.WHITE, b: true }); C.set(32, 10, 'PREVIOUS DAY KEY LEVELS & PIVOTS', { fc: COLOR.WHITE, b: true });
  [[4, ''], [6, ''], [7, ''], [8, ''], [13, ''], [15, ''], [17, '']].forEach(function (x) { C.set(32, x[0], x[1]); });
  [[2, 'Average'], [4, 'Value'], [6, 'Pts'], [7, '%'], [8, 'Position'], [10, 'Level'], [13, 'Price'], [17, 'Status']].forEach(function (x) { C.set(33, x[0], x[1], { fc: COLOR.WHITE, b: true }); });
  ['Open', 'Intraday high', 'Intraday low', 'Close', 'Range (pts)', 'Gap vs prior close', 'Volume (bn)'].forEach(function (t, i) { C.set(23 + i, 2, t, { fc: COLOR.LABF, b: true }); });
  C.set(30, 2, 'Day type (auto)', { fc: COLOR.LABF, b: true });
  ['Pre-market high', 'Pre-market low', 'Pre-market range', 'Opening range 30m high', 'Opening range 30m low', 'VWAP', 'SPY close'].forEach(function (t, i) { C.set(23 + i, 10, t, { fc: COLOR.LABF, b: true }); });
  C.set(30, 10, 'Time of HOD / LOD', { fc: COLOR.LABF, b: true });
  ['9-day EMA', '21-day SMA', '50-day SMA', '100-day SMA', '200-day SMA', '9 / 21 cross', '50 / 200 cross', 'Bollinger (20,2)'].forEach(function (t, i) { C.set(34 + i, 2, t, { fc: COLOR.LABF, b: true }); });
  C.set(41, 10, 'R1 / S1 / R2 / S2', { fc: COLOR.LABF, b: true });
  val(23, 5, d ? n(d.spx_o) : null); note(23, 7, d ? '9:30 AM' : '');
  val(24, 5, d ? n(d.spx_h) : null); note(24, 7, A && A.hod_t ? df_t_(A.hod_t) : '');
  val(25, 5, d ? n(d.spx_l) : null); note(25, 7, A && A.lod_t ? df_t_(A.lod_t) : '');
  val(26, 5, d ? n(d.spx_c) : null, T, true); note(26, 7, d ? df_s_(n(d.chg1)) : '', df_pn_(d && d.chg1));
  val(27, 5, d ? n(d.range) : null); note(27, 7, d && d.range_atr !== '' ? Math.round(d.range_atr * 100) + '% of ATR' : '');
  val(28, 5, d ? n(d.gap_pts) : null, df_pn_(d && d.gap_pts)); note(28, 7, d ? (d.gap_fill || '') : '');
  val(29, 5, d ? n(d.spx_v) : null); note(29, 7, d && d.vol_ratio !== '' ? Math.round(d.vol_ratio * 100) + '% of 20d avg' : '');
  const dt = d ? d.day_type : '';
  val(30, 5, dt ? dt + (A && A.trend !== undefined ? ' · trend score ' + A.trend + '/10' : '') : '', /up/i.test(dt) ? COLOR.GRN : (/down/i.test(dt) ? COLOR.RED : T), true);
  // SPY
  const spy = function (key) { return d && d[key] !== '' ? d[key] : ''; };
  const pmH = A && A.spyPreH ? A.spyPreH.h : n(spy('spy_pm_h')), pmL = A && A.spyPreL ? A.spyPreL.l : n(spy('spy_pm_l'));
  val(23, 13, pmH); note(23, 15, A && A.spyPreH ? df_t_(A.spyPreH.time) : spy('spy_pm_h_t'));
  val(24, 13, pmL); note(24, 15, A && A.spyPreL ? df_t_(A.spyPreL.time) : spy('spy_pm_l_t'));
  val(25, 13, pmH !== null && pmL !== null ? pmH - pmL : null); note(25, 15, A && A.spyPreLast ? 'Last pre-mkt ' + df_f_(A.spyPreLast) : '');
  val(26, 13, n(spy('spy_or_h'))); note(26, 15, '');
  const br = spy('spy_or_break');
  val(27, 13, n(spy('spy_or_l'))); note(27, 15, br ? 'Break: ' + br : '', /Up/.test(br) ? COLOR.GRN : (/Down/.test(br) ? COLOR.RED : G));
  const vw = n(spy('spy_vwap')), spyC = d ? n(d.spy_c) : null;
  val(28, 13, vw); note(28, 15, vw !== null && spyC !== null ? (spyC >= vw ? 'Close above VWAP' : 'Close below VWAP') + (A && A.above_vwap !== undefined ? ' · above ' + Math.round(A.above_vwap * 100) + '% of day' : '') : '', vw !== null && spyC !== null ? df_pn_(spyC - vw) : G);
  val(29, 13, spyC); note(29, 15, spyC !== null && pd && pd.spy_c ? df_p_((spyC - pd.spy_c) / pd.spy_c) : '', spyC !== null && pd ? df_pn_(spyC - pd.spy_c) : G);
  note(30, 13, A && A.hod_t ? 'HOD ' + df_t_(A.hod_t) + '  ·  LOD ' + df_t_(A.lod_t) + '  (to the minute)' : '', T);
  // moving averages
  const px = ref ? Number(ref.spx_c) : null;
  ['ema9', 'sma21', 'sma50', 'sma100', 'sma200'].forEach(function (key, i) {
    const v = ref ? n(ref[key]) : null, diff = v !== null && px !== null ? px - v : null;
    val(34 + i, 4, v); val(34 + i, 6, diff, df_pn_(diff)); val(34 + i, 7, diff !== null ? diff / v : null, df_pn_(diff)); val(34 + i, 8, diff !== null ? (diff >= 0 ? 'Above' : 'Below') : '', df_pn_(diff), true);
  });
  val(39, 4, ref ? ref.cross_9_21 + asOf : '', ref && /Bull/.test(ref.cross_9_21) ? COLOR.GRN : COLOR.RED);
  val(40, 4, ref ? ref.cross_50_200 : '', ref && /Golden/.test(ref.cross_50_200) ? COLOR.GRN : COLOR.RED);
  val(41, 4, ref ? 'Upper ' + df_f_(ref.bb_up) + '  ·  Lower ' + df_f_(ref.bb_lo) : '');
  // previous-day levels
  const pr = d ? pd : ref, pw = df_priorWeek_(ctx), pwRow = { pw_high: pw ? pw.h : '', pw_low: pw ? pw.l : '' };
  C.set(33, 15, d ? 'Dist. from close' : 'Dist. from last close', { fc: COLOR.WHITE, b: true });
  // days more than one session ahead show the latest known session, labelled as such
  const lastRef = !d && !pd, sfx = lastRef ? ' (' + cal_short(ctx.refDate) + ')' : '';
  ['open', 'high', 'low', 'close'].forEach(function (x, i) { C.set(34 + i, 10, (lastRef ? 'Last ' : 'Prev ') + x + sfx, { fc: COLOR.LABF, b: true }); });
  C.set(38, 10, 'Prior week high' + (pw ? pw.label : ''), { fc: COLOR.LABF, b: true }); C.set(39, 10, 'Prior week low' + (pw ? pw.label : ''), { fc: COLOR.LABF, b: true });
  C.set(40, 10, 'Pivot (P)' + sfx, { fc: COLOR.LABF, b: true });
  [['spx_o', pr], ['spx_h', pr], ['spx_l', pr], ['spx_c', pr], ['pw_high', pwRow], ['pw_low', pwRow], ['piv_p', pr]].forEach(function (x, i) {
    const v = x[1] ? n(x[1][x[0]]) : null, cur = d ? Number(d.spx_c) : (ref ? Number(ref.spx_c) : null), dist = v !== null && cur !== null ? cur - v : null;
    val(34 + i, 13, v); val(34 + i, 15, dist, df_pn_(dist));
    let st = dist === null ? '' : (dist >= 0 ? 'Above' : 'Below'), col = df_pn_(dist);
    if (d && v !== null) {
      if (x[0] === 'spx_h' || x[0] === 'pw_high') { st = Number(d.spx_h) > v ? 'Broke ▲' : 'Held'; col = Number(d.spx_h) > v ? COLOR.GRN : COLOR.RED; }
      if (x[0] === 'spx_l' || x[0] === 'pw_low') { st = Number(d.spx_l) < v ? 'Broke ▼' : 'Held'; col = Number(d.spx_l) < v ? COLOR.RED : COLOR.GRN; }
    }
    val(34 + i, 17, st, col, true);
  });
  val(41, 13, pr ? 'R1 ' + df_f_(pr.piv_r1) + ' · S1 ' + df_f_(pr.piv_s1) + ' · R2 ' + df_f_(pr.piv_r2) + ' · S2 ' + df_f_(pr.piv_s2) : '');
  // key levels (your inputs in B, C, D, G, M — status is automatic)
  const tol = core_getSettingNum("Level 'test' tolerance (pts)", 3);
  const hist30 = ctx.P.rows.filter(function (r) { return String(r.date) <= k; }).slice(-30);
  let lvFilled = 0;
  for (let i = 0; i < DF_LV_ROWS; i++) {
    const r = 45 + i, p = C.get(r, 2) === '' ? null : Number(C.get(r, 2));
    if (C.get(r, 2) !== '' || C.get(r, 4) !== '') lvFilled = i + 1;
    if (p === null || isNaN(p)) { [10, 12, 14, 15, 16].forEach(function (c) { C.set(r, c, ''); }); continue; }
    const touches = hist30.filter(function (x) { return Number(x.spx_l) - tol <= p && p <= Number(x.spx_h) + tol; });
    const last = touches.length ? String(touches[touches.length - 1].date) : '';
    C.set(r, 10, touches.length >= 3 ? 'Validated' : (touches.length ? 'Tested' : 'Untested'), { fc: touches.length >= 3 ? COLOR.GRN : G });
    C.set(r, 12, px !== null ? (p > px ? 'Above' : 'Below') : '', { fc: T });
    C.set(r, 14, touches.length, { fc: T }); C.set(r, 15, last ? (last === k ? 'Today' : cal_short(last)) : '—', { fc: G });
    let st = d || (A && A.spx.length) ? 'Untested today' : '', col = G;
    if (A && A.spx.length) {
      const hit = A.spx.filter(function (b) { return b.l - tol <= p && p <= b.h + tol; })[0];
      if (hit) {
        const O = A.O, Cl = d ? Number(d.spx_c) : A.spx[A.spx.length - 1].c, crossed = (O - p) * (Cl - p) < 0;
        st = crossed ? (Cl > p ? 'BROKE ▲ ' : 'BROKE ▼ ') + df_t_(hit.time) : 'TESTED — held ' + df_t_(hit.time);
        col = crossed ? (Cl > p ? COLOR.GRN : COLOR.RED) : COLOR.GRN;
      }
    } else if (d && Number(d.spx_l) - tol <= p && p <= Number(d.spx_h) + tol) {
      const crossed = (Number(d.spx_o) - p) * (Number(d.spx_c) - p) < 0;
      st = crossed ? (Number(d.spx_c) > p ? 'BROKE ▲' : 'BROKE ▼') : 'TESTED — held'; col = crossed && Number(d.spx_c) < p ? COLOR.RED : COLOR.GRN;
    }
    C.set(r, 16, st, { fc: col, b: /BROKE|TESTED/.test(st) });
  }
  if (A && A.spx.length) {
    const s = df_suggest_(A);
    C.set(57, 2, 'Script-suggested levels:  ' + s.map(function (x) { return df_f_(x[0], 0) + ' ' + x[1]; }).join('  ·  ') + '   (accept them on the Levels tab)', { fc: COLOR.HISF });
  } else C.set(57, 2, 'Script-suggested levels appear once the session has traded.', { fc: COLOR.HISF });
  // economic events (from Catalysts when installed)
  // up to 12 events (Fed speakers included), most important kept when there are more, shown in time order
  const evs = (ctx.events || []).filter(function (e) { return e.kind !== 'Headline' && e.kind !== 'Flow'; })
    .map(function (e, i) { return { e: e, i: i }; }).sort(function (a, b) { return String(b.e.importance).length - String(a.e.importance).length || a.i - b.i; })
    .slice(0, DF_EV_ROWS).sort(function (a, b) { return a.i - b.i; }).map(function (x) { return x.e; });
  for (let i = 0; i < DF_EV_ROWS; i++) {
    const r = 61 + i, e = evs[i];
    if (!e) { [2, 3, 6, 7, 11, 12, 13, 14, 15].forEach(function (c) { C.set(r, c, ''); }); continue; }
    C.set(r, 2, e.t ? df_t_(e.t) : '—'); C.set(r, 3, e.key === 'fed_speech' && !/^Fed\b/i.test(String(e.name)) ? 'Fed: ' + e.name : e.name, { b: true }); C.set(r, 6, e.actual || '', { b: true }); C.set(r, 7, e.previous || '');
    C.set(r, 11, e.surprise === undefined ? '' : e.surprise, { fc: df_pn_(e.surprise) });
    const w = A ? in_eventWindows(A, e.t) : null;
    [[12, 5, 25], [13, 15, 25], [14, 30, 35], [15, 60, 40]].forEach(function (x) { const v = w ? w.w[x[1]] : ''; C.set(r, x[0], v, { fc: df_pn_(v), bg: df_heat_(v, x[2]), b: x[1] === 15 }); });
  }
  if (!evs.length) C.set(61, 3, core_fnExists_('cat_eventsForDay') ? 'No tracked economic releases today' : 'Economic calendar arrives with Catalysts (Stage 5)', { fc: G, b: false });
  sh.getRange('F61:G72').setNumberFormat('@'); sh.getRange('L61:O72').setNumberFormat(FMT.PTS1);                       // show "4.1%" exactly as released (no auto-conversion to 4.10%)
  C.set(73, 2, core_fnExists_('cat_lastReleases') ? '' : 'LAST 3 RELEASES — appear here once Catalysts is installed (full history in the hub\'s Event Lookup)', { fc: COLOR.HISF, b: true });
  if (!core_fnExists_('cat_earningsForDay')) C.set(81, 3, 'Top-10 earnings watchlist arrives with Catalysts (Stage 5)', { fc: G });
  if (!core_fnExists_('cat_headlinesForDay')) C.set(94, 3, 'Headlines arrive with Catalysts (Stage 5)', { fc: G });
  // OPEX panel
  const no = cal_nextOpex(f.isTradingDay ? k : cal_add(k, 1)), nd = ctx.P.map[po.nextDay], poPrev = ctx.P.map[cal_prevTradingDay(po.date)];
  const ox = [['Current cycle', cal_short(po.date) + ' ' + (po.quarterly ? 'quad witching' : 'OPEX') + ' → ' + DOW_NAMES[cal_dow(no.date)] + ' ' + cal_short(no.date) + ' (' + no.type + ')'],
    ['Prev OPEX close (' + cal_short(po.date) + ')', poRow ? df_f_(poRow.spx_c) : '—'],
    ['Cycle to date', poRow && ref ? df_s_(Number(ref.spx_c) - Number(poRow.spx_c)) + ' pts / ' + df_p_(cyc) + asOf : '—'],
    ['Days left', cal_tradingDays(cal_add(k, 1), no.date).length + ' trading / ' + Math.round((cal_parse(no.date) - cal_parse(k)) / 864e5) + ' calendar'],
    ['Last day-after (' + cal_short(po.nextDay) + ')', nd && poRow ? 'Gap ' + df_s_(Number(nd.spx_o) - Number(poRow.spx_c), 1) + ' · ' + (nd.gap_fill || 'fill n/a') + ' · closed ' + df_p_((Number(nd.spx_c) - Number(poRow.spx_c)) / Number(poRow.spx_c)) : '—'],
    ['OPEX-day move (' + cal_short(po.date) + ')', poRow && poPrev ? df_s_(Number(poRow.spx_c) - Number(poPrev.spx_c)) + ' pts / ' + df_p_((Number(poRow.spx_c) - Number(poPrev.spx_c)) / Number(poPrev.spx_c)) : '—']];
  ox.forEach(function (x, i) { const r = 106 + Math.floor(i / 2), c = i % 2 === 0 ? 2 : 10; C.set(r, c, x[0], { fc: COLOR.LABF, b: true }); C.set(r, c + 3, x[1], { fc: /^\+/.test(x[1]) ? COLOR.GRN : T }); });
  // intraday at a glance
  const gl = A && A.spx.length ? [['Swings ≥ ' + A.settings.major + ' pts', String(A.major.length)], ['Largest swing', A.big_swing !== '' ? df_s_(A.big_swing, 1) + ' pts  ' + A.big_swing_t : '—'],
    ['Fastest move', A.bursts.length ? (function () { const b = A.bursts.slice().sort(function (x, y) { return Math.abs(y.speed) - Math.abs(x.speed); })[0]; return df_s_(b.pts, 1) + ' pts in ' + b.mins + ' min @ ' + df_t_(b.ta); })() : '—'],
    ['Overnight /ES range', A.on ? df_f_(A.on.h - A.on.l, 1) + ' pts · high ' + df_t_(A.on.ht) : '—'], ['Time above VWAP', A.above_vwap !== undefined ? Math.round(A.above_vwap * 100) + '%' : '—'], ['HOD / LOD order', A.order || '—']]
    : [['Intraday', ctx.isFuture ? 'Fills in on the day' : (A && A.on ? 'Overnight /ES range ' + df_f_(A.on.h - A.on.l, 1) + ' pts so far' : 'Waiting for the session')], ['', ''], ['', ''], ['', ''], ['', ''], ['', '']];
  gl.forEach(function (x, i) { const r = 111 + Math.floor(i / 2), c = i % 2 === 0 ? 2 : 10; C.set(r, c, x[0], { fc: COLOR.LABF, b: true }); C.set(r, c + 3, x[1], { b: true }); });
  // similar days (Analytics) & data health
  if (!core_fnExists_('an_similarForDay')) { for (let r = 144; r <= 146; r++) [2, 4, 5, 10, 11, 12, 14].forEach(function (c) { C.set(r, c, '', { fc: COLOR.HISF }); }); C.set(147, 2, 'Similar past days arrive with Analytics (Stage 6).', { fc: COLOR.HISF, b: true }); }
  const ix = ctx.idx || {}, hs = ctx.health.sources || {};
  const pill = function (i, label, ok) { C.set(150, 2 + i * 2, label + (ok === null ? '  —' : ok ? '  ✓' : '  ✗'), { fc: ok === null ? G : ok ? COLOR.GRN : COLOR.RED, bg: ok === null ? COLOR.LAB : ok ? COLOR.OKBG : COLOR.ERRBG, b: true }); };
  const has = function (x) { return ctx.isFuture ? null : Number(x) > 0; };
  pill(0, 'SPX 1-min', has(ix.spx1)); pill(1, 'SPY 1-min', has(ix.spy1)); pill(2, '/ES 1-min', has(ix.es1));
  pill(3, 'Daily prices', d ? true : (ctx.isFuture ? null : false));
  pill(4, 'VIX family', hs['Daily ^VIX'] ? hs['Daily ^VIX'].indexOf('✓') === 0 : null); pill(5, 'Yields', hs['Daily ^TNX'] ? hs['Daily ^TNX'].indexOf('✓') === 0 : null);
  pill(6, 'Events', core_fnExists_('cat_eventsForDay') ? true : null); pill(7, 'Headlines', core_fnExists_('cat_headlinesForDay') ? true : null);
  C.set(151, 2, 'Data run ' + (ctx.health.time || '—') + '  ·  bars: ' + (ix.date ? ix.spx1 + ' / ' + ix.spy1 + ' / ' + ix.es1 + ' (1-min SPX/SPY/ES)' : 'none yet') +
    '  ·  created ' + (ctx.row.created || '') + '  ·  ' + ((Number(ctx.row.refreshes) || 0) + 1) + ((Number(ctx.row.refreshes) || 0) + 1 === 1 ? ' refresh' : ' refreshes'), { fc: G });
  C.flush();
  const used = Math.max(1, evs.length);                               // hide the empty event rows (at least one row always shows)
  sh.showRows(61, DF_EV_ROWS); if (used < DF_EV_ROWS) sh.hideRows(61 + used, DF_EV_ROWS - used);
  const lv = Math.min(DF_LV_ROWS, Math.max(5, lvFilled + 1));         // key levels: 5 rows to start, always one empty row ready
  sh.showRows(45, DF_LV_ROWS); if (lv < DF_LV_ROWS) sh.hideRows(45 + lv, DF_LV_ROWS - lv);
}

function df_suggest_(A) {
  const out = [[A.L, 'today\'s LOD'], [A.H, 'today\'s HOD']];
  const drive = A.spx.filter(function (b) { return b.m < 600; });
  if (drive.length) out.push([in_max_(drive, 'h'), 'opening-range high']);
  const lunch = A.spx.filter(function (b) { return b.m >= 720 && b.m < 810; });
  if (lunch.length) out.push([in_min_(lunch, 'l'), 'lunch low']);
  if (A.on && A.basis !== '') out.push([A.on.h - A.basis, '/ES overnight high (SPX-equiv)']);
  return out;
}

/* ---------------------------------------------------------------- MACRO (filled by Macro.gs) */
function df_fillMacro_(sh, ctx) {
  if (core_fnExists_('mc_fillMacroTab')) { mc_fillMacroTab(sh, ctx); return; }
  df_clearBody_(sh, 6);
  df_placeholder_(sh, 6, 2, 17, 'The cross-asset picture (rates, currencies, global markets, commodities, crypto, stress meters) arrives with Macro.gs.');
}

function df_fillMacroDay_(sh, ctx) {
  if (core_fnExists_('mc_fillDayTab')) { mc_fillDayTab(sh.getName(), sh, ctx); return; }
  df_clearBody_(sh, 6);
  df_placeholder_(sh, 6, 2, 17, 'This tab fills in with Macro.gs v1.2 or later.');
}

/* ---------------------------------------------------------------- GAME PLAN */
function df_fillGamePlan_(sh, ctx) {
  const k = ctx.k, ref = ctx.ref, f = ctx.flags, C = DC_(sh, 1, 1, 56, 17), G = COLOR.GRAY;
  C.set(2, 2, 'GAME PLAN  —  ' + cal_pretty(k), { fc: COLOR.WHITE, b: true });
  C.set(4, 7, 'Created ' + (ctx.row.created || '') + (ctx.isFuture ? '  ·  levels and history as of ' + cal_short(ctx.refDate) : ''), { fc: G });
  // schedule: structural times + calendar + events (inputs follow their item)
  const items = [];
  if (f.isTradingDay) {
    items.push(['04:00', 'SPY pre-market opens · London session under way', '', '', '', '']);
    items.push(['09:30', 'Cash open · 30-minute opening range until 10:00', '', '', '★★', df_orStat_(ctx)]);
    if (f.flags.some(function (x) { return x.code === 'VIX_EXP'; })) items.push(['09:30', 'VIX expiration (AM settlement)', '', '', '★★', '']);
    (ctx.events || []).filter(function (e) { return e.kind !== 'Headline' && !(e.key === 'fomc' || e.key === 'fomc_min'); })
      .forEach(function (e) { items.push([e.t || '12:00', e.name, e.actual || '', e.previous || '', e.importance || '★★', e.history || '']); });
    if (f.flags.some(function (x) { return x.code === 'FOMC_DECISION'; })) items.push(['14:00', 'FOMC decision · statement 2:00 PM · press conference 2:30 PM', '', '', '★★★', df_flagStat_(ctx, 'FOMC_DECISION')]);
    if (f.flags.some(function (x) { return x.code === 'FOMC_MINUTES'; })) items.push(['14:00', 'FOMC minutes', '', '', '★★', '']);
    const early = f.flags.some(function (x) { return x.code === 'EARLY_CLOSE'; });
    if (!early) items.push(['15:50', 'MOC imbalance published', '', '', '★', '']);
    const op = f.flags.filter(function (x) { return /OPEX|QUAD/.test(x.code) && !/DAY_BEFORE|WEEK|AFTER/.test(x.code); })[0];
    if (op) items.push([early ? '13:00' : '16:00', op.label + ' — PM-settled options expire', '', '', '★★★', df_flagStat_(ctx, op.code)]);
    items.push([early ? '13:00' : '16:00', early ? 'Early close 1:00 PM' : 'Cash close', '', '', '', '']);
  }
  items.sort(function (a, b) { return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0); });
  const keep = {};
  for (let r = 19; r <= 30; r++) { const it = C.get(r, 3); if (it) keep[it] = [C.get(r, 9), C.get(r, 10), C.get(r, 14)]; }
  for (let i = 0; i < 12; i++) {
    const r = 19 + i, x = items[i];
    const kp = x && keep[x[1]] ? keep[x[1]] : ['', '', ''];
    C.set(r, 2, x ? df_t_(x[0]) : '', { b: true }); C.set(r, 3, x ? x[1] : ''); C.set(r, 7, x ? x[2] : ''); C.set(r, 8, x ? x[3] : '');
    C.set(r, 9, kp[0], { fc: COLOR.INPF }); C.set(r, 10, kp[1], { fc: COLOR.INPF }); C.set(r, 11, x ? x[4] : '', { fc: COLOR.GOLD });
    C.set(r, 12, x ? x[5] : '', { fc: COLOR.HISF }); C.set(r, 14, kp[2], { fc: COLOR.INPF });
  }
  if (!items.length) C.set(19, 3, 'Market closed — ' + f.closedReason, { fc: G });
  sh.getRange('G19:H30').setNumberFormat('@');
  // levels to watch
  const lv = df_autoLevels_(ctx).concat(df_yourLevels_(ctx));
  const px = ref ? Number(ref.spx_c) : null;
  const near = lv.filter(function (x) { return x[0]; }).sort(function (a, b) { return Math.abs(a[0] - px) - Math.abs(b[0] - px); }).slice(0, 8).sort(function (a, b) { return b[0] - a[0]; });
  for (let i = 0; i < 8; i++) {
    const r = 34 + i, x = near[i];
    C.set(r, 2, x ? x[0] : '', { b: true }); C.set(r, 4, x ? x[1] : ''); const dist = x && px ? x[0] - px : '';
    C.set(r, 7, dist, { fc: df_pn_(dist) }); C.set(r, 9, x ? (x[0] > px ? 'Resistance' : 'Support') : '', { fc: x ? (x[0] > px ? COLOR.RED : COLOR.GRN) : G });
  }
  // expected move & volatility
  const em = ref && ref.vix_c ? Number(ref.spx_c) * Number(ref.vix_c) / 100 / Math.sqrt(252) : null;
  const wd = ctx.P.rows.filter(function (r) { return cal_dow(String(r.date)) === cal_dow(k) && String(r.date) < k; }).slice(-50);
  const avgR = function (rows) { const v = rows.map(function (r) { return Number(r.range); }).filter(function (x) { return x > 0; }); return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; };
  [['Reference close (' + cal_short(ctx.refDate) + ')', ref ? df_f_(ref.spx_c) : '—'], ['VIX / VIX9D', ref ? df_f_(ref.vix_c) + '  /  ' + df_f_(ref.vix9d) : '—'],
   ['Implied daily move (±)', em ? '±' + df_f_(em, 0) + ' pts  /  ±' + (em / Number(ref.spx_c) * 100).toFixed(2) + '%' : '—'],
   ['Implied range', em ? df_f_(Number(ref.spx_c) - em, 0) + ' – ' + df_f_(Number(ref.spx_c) + em, 0) : '—'], ['ATR (14)', ref ? df_f_(ref.atr14, 1) + ' pts' : '—'],
   ['Avg range on ' + DOW_NAMES[cal_dow(k)] + 's (last 50)', avgR(wd) ? df_f_(avgR(wd), 1) + ' pts' : '—'],
   ['VIX9D / VIX term structure', ref && ref.vix_ratio ? df_f_(ref.vix_ratio) + (Number(ref.vix_ratio) < 1 ? ' — calm' : ' — stress') : '—'], ['', '']]
    .forEach(function (x, i) { C.set(34 + i, 10, x[0], { fc: COLOR.LABF, b: true }); C.set(34 + i, 14, x[1], { fc: /Avg/.test(x[0]) ? COLOR.HISF : COLOR.TEXT }); });
  // history for this setup
  const up = function (rows) { return rows.length ? Math.round(rows.filter(function (r) { return Number(r.chg1) > 0; }).length / rows.length * 100) + '% up · avg ' + df_p_(rows.reduce(function (a, r) { return a + (Number(r.pct1) || 0); }, 0) / rows.length) : '—'; };
  const hist = [[DOW_NAMES[cal_dow(k)] + 's (last 50)', up(wd)]];
  f.flags.slice(0, 3).forEach(function (fl) { hist.push([df_cap_(fl.label) + ' days', df_flagStat_(ctx, fl.code, true)]); });
  const vx = ref ? Number(ref.vix_c) : null;
  if (vx) { const band = vx < 16 ? [0, 16] : (vx < 20 ? [16, 20] : [20, 99]); const rows = ctx.P.rows.filter(function (r) { return Number(r.vix_c) >= band[0] && Number(r.vix_c) < band[1]; }).slice(-250);
    hist.push(['VIX ' + (band[1] === 99 ? '> 20' : band[0] + '–' + band[1]) + ' (last 250)', up(rows) + ' · range ' + df_f_(avgR(rows), 1)]); }
  const s = Object.keys(ctx.sessions).map(function (x) { return ctx.sessions[x]; });
  if (s.length) { const ups = s.filter(function (r) { return /^Up/.test(r.or_break); }).length; hist.push(['Opening range broke up first', ups + ' of ' + s.length + ' days (' + Math.round(ups / s.length * 100) + '%)']); }
  const lg = db_readAll(df_logSpec_()).rows.filter(function (r) { return cal_dow(String(r.date)) === cal_dow(k) && r.net_pnl !== ''; });
  hist.push(['Your P&L on ' + DOW_NAMES[cal_dow(k)] + 's', lg.length ? df_s_(lg.reduce(function (a, r) { return a + Number(r.net_pnl); }, 0), 0).replace(/^([+−])/, '$1$') + ' over ' + lg.length + ' days' : 'No locked days yet']);
  for (let i = 0; i < 7; i++) { const x = hist[i] || ['', '']; C.set(50 + i, 10, x[0], { fc: COLOR.LABF, b: true }); C.set(50 + i, 14, x[1], { fc: COLOR.HISF }); }
  C.flush();
}
function df_cap_(s) { return s.charAt(0) + s.slice(1).toLowerCase().replace(/ · .*/, ''); }
function df_orStat_(ctx) {
  const s = Object.keys(ctx.sessions).map(function (x) { return ctx.sessions[x]; }).filter(function (r) { return r.or_break; });
  if (!s.length) return '';
  const ups = s.filter(function (r) { return /^Up/.test(r.or_break); }).length;
  return 'Broke up first ' + Math.round(ups / s.length * 100) + '% (' + s.length + 'd)';
}
function df_flagStat_(ctx, code, long) {
  const rows = ctx.P.rows.filter(function (r) { return String(r.date) < ctx.k; }).slice(-1500).filter(function (r) { return cal_getFlags(String(r.date)).flags.some(function (x) { return x.code === code; }); });
  if (!rows.length) return '';
  const up = rows.filter(function (r) { return Number(r.chg1) > 0; }).length;
  const rng = rows.reduce(function (a, r) { return a + (Number(r.range) || 0); }, 0) / rows.length;
  return long ? Math.round(up / rows.length * 100) + '% up · avg range ' + df_f_(rng, 1) + ' (' + rows.length + 'd)' : 'Avg range ' + df_f_(rng, 0) + ' · ' + Math.round(up / rows.length * 100) + '% up';
}
function df_autoLevels_(ctx) {
  const d = ctx.d, pr = d ? ctx.pd : ctx.ref, ref = ctx.ref, out = [];
  const add = function (v, name, src) { const x = Number(v); if (v !== '' && v !== undefined && v !== null && isFinite(x) && x > 0) out.push([x, name, src]); };
  if (pr) { add(pr.spx_h, 'Prev day high', 'Auto · prior day'); add(pr.spx_l, 'Prev day low', 'Auto · prior day'); add(pr.spx_c, 'Prev close', 'Auto · prior day');
    add(pr.piv_p, 'Pivot P', 'Auto · pivot'); add(pr.piv_r1, 'R1 pivot', 'Auto · pivot'); add(pr.piv_s1, 'S1 pivot', 'Auto · pivot'); add(pr.piv_r2, 'R2 pivot', 'Auto · pivot'); add(pr.piv_s2, 'S2 pivot', 'Auto · pivot'); }
  if (ref) { add(ref.ema9, '9-day EMA', 'Auto · MA'); add(ref.sma21, '21-day SMA', 'Auto · MA'); add(ref.sma50, '50-day SMA', 'Auto · MA');
    const pw = df_priorWeek_(ctx); if (pw) { add(pw.h, 'Prior week high', 'Auto · prior week'); add(pw.l, 'Prior week low', 'Auto · prior week'); } add(ref.bb_up, 'Upper Bollinger', 'Auto · indicator'); add(ref.bb_lo, 'Lower Bollinger', 'Auto · indicator'); }
  const A = ctx.A;
  if (A && A.spx.length) { add(A.H, 'Today\'s HOD', 'Auto · session'); add(A.L, 'Today\'s LOD', 'Auto · session'); add(A.ib_h, 'Initial balance high', 'Auto · session'); add(A.ib_l, 'Initial balance low', 'Auto · session'); add(A.vwap, 'VWAP', 'Auto · session'); }
  if (A && A.on && A.basis !== '') { add(A.on.h - A.basis, '/ES overnight high (SPX-equiv)', 'Auto · overnight'); add(A.on.l - A.basis, '/ES overnight low (SPX-equiv)', 'Auto · overnight'); }
  return out;
}
function df_yourLevels_(ctx) {
  const v = ctx.ss.getSheetByName('Report').getRange('B45:I56').getValues();
  return v.filter(function (r) { return r[0] !== '' && isFinite(Number(r[0])); }).map(function (r) { return [Number(r[0]), r[2] || (r[1] || 'Your level'), 'You', r[1]]; });
}

/* ---------------------------------------------------------------- INTRADAY MAP */
function df_fillIntraday_(sh, ctx) {
  const A = ctx.A;
  const keepMv = df_keep_(sh, 6, function (r) { return typeof r[1] === 'number' && /M$/.test(String(r[2])) ? 'mv|' + r[2] + '|' + r[3] : null; }, [16]);
  const keepEv = df_keep_(sh, 6, function (r) { return /M$/.test(String(r[1])) && r[2] && typeof r[1] === 'string' ? 'ev|' + r[2] : null; }, [15]);
  df_clearBody_(sh, 6);
  df_legendNote_(sh, cal_pretty(ctx.k) + (A ? '  ·  ' + A.res + ' bars' : ''));
  let r = 6;
  if (!A || (!A.spx.length && !A.on)) {
    df_placeholder_(sh, r, 2, 17, ctx.isFuture ? 'This day hasn\'t happened yet. The overnight /ES session appears from 6 PM ET the evening before, pre-market from 4 AM, and the full map during the session.' : 'No intraday bars saved for this day (the free feed only keeps recent history).');
    df_moveCharts_(sh, r + 2); return;
  }
  // cross-reference
  ui_header(sh, r, 2, 17, 'SESSION CROSS-REFERENCE  —  SPX (cash index)  ·  SPY (ETF)  ·  /ES (futures, nearly 24h)');
  ui_sub(sh, r + 1, [[2, 4, 'Measure'], [5, 6, 'SPX'], [7, 7, 'Time'], [8, 9, 'SPY'], [10, 10, 'Time'], [11, 12, '/ES'], [13, 13, 'Time'], [14, 17, 'What it tells you']]);
  const cr = df_crossRows_(ctx);
  cr.forEach(function (x, i) {
    const rr = r + 2 + i;
    ui_label(sh, rr, 2, 4, x[0]);
    [[5, 6, x[1], x[2]], [8, 9, x[3], x[4]], [11, 12, x[5], x[6]]].forEach(function (y) {
      const isNum = typeof y[2] === 'number', signed = /Gap|drive|After|premium/.test(x[0]);
      ui_box(sh, rr, y[0], rr, y[1], y[2] === '' || y[2] === null || y[2] === undefined ? '—' : y[2], { fmt: isNum ? (signed ? FMT.PTS : FMT.PRICE) : null, fc: isNum && signed ? df_pn_(y[2]) : (y[2] === 'n/a' ? COLOR.GRAY : COLOR.TEXT), size: isNum ? 10 : 9, bg: /SPY-implied/.test(y[3] || '') ? COLOR.HIS : COLOR.WHITE });
      ui_box(sh, rr, y[0] + 2, rr, y[0] + 2, /SPY-implied/.test(y[3] || '') ? '' : (y[3] || ''), { fc: COLOR.GRAY, size: 8 });
    });
    ui_box(sh, rr, 14, rr, 17, x[7] || '', { fc: COLOR.GRAY, size: 9, h: 'left' });
  });
  r += cr.length + 3;
  // statistics
  ui_header(sh, r, 2, 17, 'INTRADAY STATISTICS'); r++;
  const st = df_statRows_(A);
  st.forEach(function (x, i) { const rr = r + Math.floor(i / 3), c = 2 + (i % 3) * 5; ui_label(sh, rr, c, c + 1, x[0]); ui_auto(sh, rr, c + 2, c < 12 ? c + 4 : 17, x[1], { bold: true, size: 9 }); });
  r += Math.ceil(st.length / 3) + 1;
  // 30-minute map
  if (A.blocks30.length) {
    ui_header(sh, r, 2, 17, '30-MINUTE MAP  —  regular session (green = up, red = down; darker = bigger)'); r++;
    const head = [{ v: 'Block (ET)', bg: COLOR.LAB, fc: COLOR.LABF, b: true, h: 'left' }].concat(A.blocks30.map(function (b) { return { v: df_short_(b.t), bg: COLOR.SUB, fc: COLOR.WHITE, b: true }; })).concat([{ v: 'Day', bg: COLOR.SUB, fc: COLOR.WHITE, b: true }]);
    const evBlk = {};
    (A.events || []).forEach(function (e) { const j = Math.floor((in_m_(e.t) - 570) / 30); if (j >= 0 && j < 13) (evBlk[j] = evBlk[j] || []).push(df_short_(e.t) + ' ' + String(e.name).split(' ')[0]); });
    const row = function (label, fn, tot, nf) { return [{ v: label, bg: COLOR.LAB, fc: COLOR.LABF, b: true, h: 'left' }].concat(A.blocks30.map(fn)).concat([{ v: tot, b: true, nf: nf }]); };
    const rows = [head,
      row('SPX net pts', function (b) { return { v: b.net, bg: df_heat_(b.net, 30), fc: df_pn_(b.net), b: true, nf: FMT.PTS1 }; }, A.C - A.O, FMT.PTS1),
      row('SPX range', function (b) { return { v: b.range, nf: '0.0' }; }, A.H - A.L, '0.0'),
      row('Cum. from open', function (b) { return { v: b.cum, bg: df_heat_(b.cum, 45), fc: df_pn_(b.cum), nf: FMT.PTS1 }; }, A.C - A.O, FMT.PTS1),
      row('SPY vol % of day', function (b) { return { v: b.vol, bg: b.vol > 0.09 ? df_vheat_(b.vol * 25) : COLOR.WHITE, nf: '0%' }; }, 1, '0%'),
      row('/ES net pts', function (b) { return { v: b.esNet, bg: df_heat_(b.esNet, 30), fc: df_pn_(b.esNet), nf: FMT.PTS1 }; }, A.esRth ? A.esRth.net : '', FMT.PTS1),
      row('Swings active', function (b, j) { const a = 570 + 30 * j; return { v: A.major.map(function (s, i) { return in_m_(s.ta) < a + 30 && in_m_(s.tb) >= a ? i + 1 : null; }).filter(function (x) { return x; }).join(','), bg: COLOR.HIS, fc: COLOR.HISF }; }, A.major.length + ' swings'),
      row('Events & headlines', function (b, j) { return evBlk[j] ? { v: evBlk[j].join('\n'), bg: COLOR.PUR, fc: COLOR.PURF, b: true } : ''; }, (A.events || []).length + ' items')];
    TW_(sh, r, 2, rows.map(function (x) { return x.concat(['']); }), { size: 9 });
    for (let i = 0; i < rows.length; i++) sh.getRange(r + i, 16, 1, 2).merge();
    sh.setRowHeight(r + rows.length - 1, 34);
    r += rows.length + 1;
  }
  // overnight map
  ui_header(sh, r, 2, 17, 'OVERNIGHT & PRE-MARKET MAP  —  /ES from 6 PM the prior evening, SPY from 4 AM  (detail: Overnight ES tab)'); r++;
  const on = [[{ v: 'Block (ET)', bg: COLOR.LAB, fc: COLOR.LABF, b: true, h: 'left' }].concat(A.blocksON.map(function (b) { return { v: b.label, bg: COLOR.SUB, fc: COLOR.WHITE, b: true }; })),
    [{ v: 'Session', bg: COLOR.LAB, fc: COLOR.LABF, b: true, h: 'left' }].concat(A.blocksON.map(function (b) { return { v: b.session, bg: COLOR.PUR, fc: COLOR.PURF, b: true }; })),
    [{ v: '/ES net pts', bg: COLOR.LAB, fc: COLOR.LABF, b: true, h: 'left' }].concat(A.blocksON.map(function (b) { return { v: b.net, bg: df_heat_(b.net, 25), fc: df_pn_(b.net), b: true, nf: FMT.PTS1 }; })),
    [{ v: '/ES range', bg: COLOR.LAB, fc: COLOR.LABF, b: true, h: 'left' }].concat(A.blocksON.map(function (b) { return { v: b.range, nf: '0.0' }; })),
    [{ v: 'SPY net (4a+)', bg: COLOR.LAB, fc: COLOR.LABF, b: true, h: 'left' }].concat(A.blocksON.map(function (b) { return { v: b.spyNet === '' ? '—' : b.spyNet, fc: b.spyNet === '' ? COLOR.GRAY : df_pn_(b.spyNet), nf: '+0.00;-0.00' }; }))];
  TW_(sh, r, 2, on, { size: 9 });
  const summ = A.on ? ['ON high ' + df_f_(A.on.h) + ' (' + df_t_(A.on.ht) + ')', 'ON low ' + df_f_(A.on.l) + ' (' + df_t_(A.on.lt) + ')', 'ON range ' + df_f_(A.on.h - A.on.l, 1) + ' pts',
    A.inventory !== '' ? 'Cash opened at ' + Math.round(A.inventory * 100) + '% of the ON range' : '', A.london && A.asia ? 'Asia ' + df_s_(A.asia.net, 1) + ' · London ' + df_s_(A.london.net, 1) : ''] : ['', '', '', '', ''];
  summ.forEach(function (t, i) { ui_auto(sh, r + i, 13, 17, t, { h: 'left', size: 9 }); });
  r += on.length + 1;
  // moves
  ui_header(sh, r, 2, 17, 'INTRADAY MOVES  —  every swing ≥ ' + A.settings.major + ' SPX pts, to the minute, matched to catalysts  (micro-moves & bursts: Moves (1-min) tab)'); r++;
  ui_sub(sh, r, [[2, 2, '#'], [3, 3, 'Start'], [4, 4, 'End'], [5, 5, 'Minutes'], [6, 6, 'Direction'], [7, 7, 'From'], [8, 8, 'To'], [9, 9, 'Pts'], [10, 10, '%'], [11, 11, 'Pts / min'], [12, 12, 'SPY vol vs avg'], [13, 15, 'Matched catalyst (auto)'], [16, 17, 'Your note']]);
  sh.setRowHeight(r, 28); r++;
  if (A.major.length) {
    TW_(sh, r, 2, A.major.map(function (s, i) {
      const cat = s.cat_t ? s.cat + '  (' + df_t_(s.cat_t) + ', ' + (s.lag >= 0 ? '+' : '') + s.lag + ' min)' : s.cat;
      const kp = keepMv['mv|' + df_t_(s.ta) + '|' + df_t_(s.tb)];
      return [{ v: i + 1, b: true }, df_t_(s.ta), df_t_(s.tb), s.mins, { v: s.pts > 0 ? '▲ Up' : '▼ Down', fc: df_pn_(s.pts), b: true }, { v: s.pa, nf: FMT.PRICE }, { v: s.pb, nf: FMT.PRICE },
        { v: s.pts, bg: df_heat_(s.pts, 40), fc: df_pn_(s.pts), b: true, nf: FMT.PTS }, { v: s.pct, fc: df_pn_(s.pts), nf: FMT.PCT }, { v: s.speed, fc: df_pn_(s.pts), nf: '+0.00;-0.00' },
        { v: s.volx, nf: FMT.MULT }, { v: cat, bg: s.cat_t ? COLOR.PUR : COLOR.HIS, fc: s.cat_t ? COLOR.PURF : COLOR.HISF, h: 'left' }, '', '', { v: kp ? kp[0] : '', bg: COLOR.INP, fc: COLOR.INPF, h: 'left' }, { v: '', bg: COLOR.INP }];
    }), { size: 9 });
    for (let i = 0; i < A.major.length; i++) { sh.getRange(r + i, 13, 1, 3).merge(); sh.getRange(r + i, 16, 1, 2).merge(); }
    r += A.major.length;
  }
  r++;
  // event -> move links
  ui_header(sh, r, 2, 17, 'EVENT → MOVE LINKS  —  SPX reaction to the minute around each event / headline  (detail: Event Reactions tab)'); r++;
  ui_sub(sh, r, [[2, 2, 'Time'], [3, 5, 'Event / headline'], [6, 6, 'Surprise'], [7, 7, '−5 → 0'], [8, 8, '+1 min'], [9, 9, '+5 min'], [10, 10, '+15 min'], [11, 11, '+60 min'], [12, 12, 'To close'], [13, 14, 'Matched swing'], [15, 17, 'Verdict (yours)']]); r++;
  const evs = (A.events || []).filter(function (e, i, a) { return a.findIndex(function (x) { return x.name === e.name; }) === i; });
  if (!evs.length) { df_placeholder_(sh, r, 2, 17, core_fnExists_('cat_eventsForDay') ? 'No tracked events or headlines today.' : 'Event and headline links fill in once Catalysts (Stage 5) is installed. Moves above are already detected and timed.'); r++; }
  evs.forEach(function (e) {
    const w = in_eventWindows(A, e.t);
    const sw = A.major.map(function (s, i) { return { s: s, i: i }; }).filter(function (x) { return x.s.ta <= e.t && e.t <= x.s.tb; })[0];
    const kp = keepEv['ev|' + e.name];
    TW_(sh, r, 2, [[df_t_(e.t), { v: e.name, bg: COLOR.PUR, fc: COLOR.PURF, b: true, h: 'left' }, '', '', { v: e.surprise === undefined ? (e.detail || '—') : e.surprise, fc: df_pn_(e.surprise) }]
      .concat([-5, 1, 5, 15, 60].map(function (x) { const v = w ? w.w[x] : ''; return { v: v, bg: df_heat_(v, 30), fc: df_pn_(v), nf: FMT.PTS1, b: x === 15 }; }))
      .concat([{ v: w ? w.w.close : '', bg: df_heat_(w && w.w.close, 40), fc: df_pn_(w && w.w.close), nf: FMT.PTS1 }, { v: sw ? '#' + (sw.i + 1) + ' (' + df_s_(sw.s.pts, 1) + ')' : '—', bg: COLOR.HIS, fc: COLOR.HISF }, { v: '', bg: COLOR.HIS },
        { v: kp ? kp[0] : '', bg: COLOR.INP, fc: COLOR.INPF, h: 'left' }, { v: '', bg: COLOR.INP }, { v: '', bg: COLOR.INP }])], { size: 9 });
    sh.getRange(r, 3, 1, 3).merge(); sh.getRange(r, 13, 1, 2).merge(); sh.getRange(r, 15, 1, 3).merge();
    r++;
  });
  r++;
  ui_header(sh, r, 2, 17, 'CHARTS  —  15-minute SPX candles · cumulative % move SPX vs SPY vs /ES  (all charts: Charts tab)');
  df_moveCharts_(sh, r + 1);
}
function df_moveCharts_(sh, row) {
  sh.getCharts().forEach(function (c, i) { sh.updateChart(c.modify().setPosition(row, i === 0 ? 2 : 10, 0, 0).build()); });
}
function df_crossRows_(ctx) {
  const A = ctx.A, d = ctx.d || {}, na = 'n/a', f2 = function (a, b) { return a === '' || a === undefined || a === null ? '—' : df_f_(a) + ' / ' + df_f_(b); };
  const R = A.ratio || 10, B = A.basis === '' || A.basis === undefined ? null : A.basis;
  const spyO = A.spy.length ? A.spy[0].o : '', spyC = d.spy_c || (A.spy.length ? A.spy[A.spy.length - 1].c : '');
  const rows = [];
  rows.push(['Overnight / pre-market high', A.spyPreH ? A.spyPreH.h * R : '', A.spyPreH ? 'SPY-implied' : '', A.spyPreH ? A.spyPreH.h : '', A.spyPreH ? df_t_(A.spyPreH.time) : '', A.on ? A.on.h : '', A.on ? df_t_(A.on.ht) : '', 'SPX has no pre-market — blue = SPY-implied']);
  rows.push(['Overnight / pre-market low', A.spyPreL ? A.spyPreL.l * R : '', A.spyPreL ? 'SPY-implied' : '', A.spyPreL ? A.spyPreL.l : '', A.spyPreL ? df_t_(A.spyPreL.time) : '', A.on ? A.on.l : '', A.on ? df_t_(A.on.lt) : '', A.on ? 'Overnight range ' + df_f_(A.on.h - A.on.l, 1) + ' pts' : '']);
  rows.push(['Asia session H / L  (6 PM–2 AM)', na, '', na, '', A.asia ? f2(A.asia.h, A.asia.l) : '—', '', A.asia ? 'Net ' + df_s_(A.asia.net, 1) : '']);
  rows.push(['London session H / L  (2–8 AM)', na, '', na, '', A.london ? f2(A.london.h, A.london.l) : '—', '', A.london ? 'Net ' + df_s_(A.london.net, 1) : '']);
  if (A.spx.length) {
    rows.push(['Open (9:30)', A.O, '9:30 AM', spyO, '9:30 AM', A.es_open, '9:30 AM', A.inventory !== '' ? 'Opened at ' + Math.round(A.inventory * 100) + '% of the overnight range' : '']);
    rows.push(['Gap vs prior close', ctx.pd ? A.O - Number(ctx.pd.spx_c) : '', '', ctx.pd && spyO ? spyO - Number(ctx.pd.spy_c) : '', '', ctx.pd && ctx.pd.es_c && A.es_open ? A.es_open - Number(ctx.pd.es_c) : '', '', d.gap_fill ? 'Gap: ' + d.gap_fill : '']);
    rows.push(['Opening drive (first 15 min)', A.drive15, '9:45 AM', '', '', '', '', A.drive15 > 0 ? 'Up drive' : 'Down drive']);
    rows.push(['OR30 high / low', f2(A.or_h, A.or_l), '', d.spy_or_h ? f2(d.spy_or_h, d.spy_or_l) : '—', '', B !== null ? f2(A.or_h + B, A.or_l + B) : '—', '', 'Break: ' + (A.or_break || '—')]);
    rows.push(['Initial balance (1st hour) H / L', f2(A.ib_h, A.ib_l), '', A.ib_h ? f2(A.ib_h / R, A.ib_l / R) : '—', '', B !== null ? f2(A.ib_h + B, A.ib_l + B) : '—', '', 'IB extension +' + df_f_(A.ib_ext_up, 1) + ' up / −' + df_f_(A.ib_ext_dn, 1) + ' down']);
    rows.push(['VWAP (session)', A.vwap, '', A.spy_vwap, '', B !== null && A.vwap ? A.vwap + B : '', '', A.above_vwap !== undefined ? 'Above VWAP ' + Math.round(A.above_vwap * 100) + '% of the day · ' + A.vwap_x + ' crosses' : '']);
    rows.push(['High of day', A.H, df_t_(A.hod_t), A.spyH ? A.spyH.h : '', A.spyH ? df_t_(A.spyH.time) : '', A.esRth ? A.esRth.h : '', A.esRth ? df_t_(A.esRth.ht) : '', '']);
    rows.push(['Low of day', A.L, df_t_(A.lod_t), A.spyL ? A.spyL.l : '', A.spyL ? df_t_(A.spyL.time) : '', A.esRth ? A.esRth.l : '', A.esRth ? df_t_(A.esRth.lt) : '', A.order || '']);
    rows.push(['Close (4:00) / /ES 4:15 settle', A.C, '4:00 PM', spyC, '4:00 PM', A.es_settle, '4:15 PM', A.close_loc !== '' ? 'Closed at ' + Math.round(A.close_loc * 100) + '% of the day\'s range' : '']);
    rows.push(['Range (pts)', A.H - A.L, '', A.spyH && A.spyL ? A.spyH.h - A.spyL.l : '', '', A.esRth ? A.esRth.h - A.esRth.l : '', '', d.range_atr ? Math.round(d.range_atr * 100) + '% of ATR' : '']);
    rows.push(['/ES premium to SPX (basis)', na, '', na, '', B, '9:30 AM', 'Jumps on quarterly roll days']);
    rows.push(['After-hours (4:00 → 5:00 PM)', na, '', '', '', A.after_hrs, '', 'Post-close drift']);
  }
  return rows;
}
function df_statRows_(A) {
  if (!A.spx.length) return [['Session', 'Not started']];
  const fast = A.bursts.slice().sort(function (x, y) { return Math.abs(y.speed) - Math.abs(x.speed); })[0];
  return [['Opening drive', df_s_(A.drive15, 1) + ' pts in 15 min'], ['1st-hour share of range', A.first_hr !== '' ? Math.round(A.first_hr * 100) + '%' : '—'], ['Lunch range (12:00–1:30)', A.lunch_rng !== '' ? df_f_(A.lunch_rng, 1) + ' pts' : '—'],
    ['Power hour (3–4 PM)', df_s_(A.power_hr, 1) + ' pts'], ['Largest 1-bar up', df_s_(A.big_up, 1) + ' @ ' + df_t_(A.big_up_t)], ['Largest 1-bar down', df_s_(A.big_dn, 1) + ' @ ' + df_t_(A.big_dn_t)],
    ['Largest swing', A.big_swing !== '' ? df_s_(A.big_swing, 1) + ' (' + A.big_swing_t + ')' : '—'], ['Swings ≥ ' + A.settings.major + ' / ≥ ' + A.settings.micro + ' pts', A.major.length + ' / ' + A.micro.length],
    ['Bursts ≥ ' + A.settings.burst + ' pts in ≤ ' + A.settings.burstWin + ' min', String(A.bursts.length)], ['VWAP crosses', A.vwap_x !== undefined ? String(A.vwap_x) : '—'],
    ['HOD / LOD order', A.order || '—'], ['Close location in range', A.close_loc !== '' ? Math.round(A.close_loc * 100) + '%' : '—'], ['Trend score', A.trend + ' / 10'],
    ['Fastest move', fast ? df_s_(fast.pts, 1) + ' in ' + fast.mins + ' min @ ' + df_t_(fast.ta) : '—'], ['Bars used', A.res]];
}

/* ---------------------------------------------------------------- MOVES (1-min) */
function df_fillMoves_(sh, ctx) {
  const A = ctx.A;
  const keep = df_keep_(sh, 6, function (r) { return typeof r[1] === 'number' && /M$/.test(String(r[2])) ? String(r[2]) + '|' + r[3] + '|' + r[5] : null; }, [16]);
  df_clearBody_(sh, 6);
  df_legendNote_(sh, cal_pretty(ctx.k) + (A ? '  ·  ' + A.res + ' bars' : ''));
  if (!A || !A.spx.length) { df_placeholder_(sh, 6, 2, 16, ctx.isFuture ? 'Moves are detected during the session.' : 'No regular-session bars saved for this day.'); return; }
  let r = 6;
  const table = function (title, list, burst) {
    ui_header(sh, r, 2, 16, title); r++;
    ui_sub(sh, r, [[2, 2, '#'], [3, 3, 'Start'], [4, 4, 'End'], [5, 5, 'Minutes'], [6, 6, 'Direction'], [7, 7, 'From'], [8, 8, 'To'], [9, 9, 'Pts'], [10, 10, '%'], [11, 11, 'Pts / min'],
      [12, 12, burst ? 'Inside swing #' : 'Max counter-move'], [13, 13, 'SPY vol vs avg'], [14, 14, 'Matched catalyst'], [15, 15, 'Event time · lag'], [16, 16, 'Your note']]);
    sh.setRowHeight(r, 30); r++;
    if (!list.length) { df_placeholder_(sh, r, 2, 16, 'None today.'); r += 2; return; }
    TW_(sh, r, 2, list.map(function (s, i) {
      const sw = burst ? A.major.map(function (x, j) { return { x: x, j: j }; }).filter(function (y) { return y.x.ta <= s.ta && s.ta <= y.x.tb; })[0] : null;
      const kp = keep[df_t_(s.ta) + '|' + df_t_(s.tb) + '|' + (s.pts > 0 ? '▲ Up' : '▼ Down')];
      return [{ v: i + 1, b: true }, df_t_(s.ta), df_t_(s.tb), s.mins, { v: s.pts > 0 ? '▲ Up' : '▼ Down', fc: df_pn_(s.pts), b: true }, { v: s.pa, nf: FMT.PRICE }, { v: s.pb, nf: FMT.PRICE },
        { v: s.pts, bg: df_heat_(s.pts, burst ? 6 : 35), fc: df_pn_(s.pts), b: true, nf: FMT.PTS }, { v: s.pct, fc: df_pn_(s.pts), nf: FMT.PCT }, { v: s.speed, fc: df_pn_(s.pts), nf: '+0.00;-0.00' },
        burst ? { v: sw ? '#' + (sw.j + 1) : '—', bg: COLOR.HIS, fc: COLOR.HISF } : { v: s.counter, nf: '0.0' }, { v: s.volx, nf: FMT.MULT },
        { v: s.cat, bg: s.cat_t ? COLOR.PUR : COLOR.HIS, fc: s.cat_t ? COLOR.PURF : COLOR.HISF, b: !!s.cat_t, h: 'left' },
        s.cat_t ? df_t_(s.cat_t) + ' · ' + (s.lag >= 0 ? '+' : '') + s.lag + ' min' : '—', { v: kp ? kp[0] : '', bg: COLOR.INP, fc: COLOR.INPF, h: 'left' }];
    }), { size: 9, wrap: true });
    r += list.length + 1;
  };
  table('MAJOR SWINGS  (≥ ' + A.settings.major + ' SPX pts · reversal confirmed by a ' + A.settings.major + '-pt move the other way)', A.major, false);
  table('MICRO-MOVES  (≥ ' + A.settings.micro + ' SPX pts · the rotation inside the big swings)', A.micro, false);
  table('BURSTS  —  the fastest moves of the day (≥ ' + A.settings.burst + ' SPX pts within ' + A.settings.burstWin + ' minutes)', A.bursts, true);
  ui_header(sh, r, 2, 16, 'MOVE STATISTICS'); r++;
  const avg = A.major.length ? A.major.reduce(function (a, s) { return a + Math.abs(s.pts); }, 0) / A.major.length : 0;
  const avgM = A.major.length ? A.major.reduce(function (a, s) { return a + s.mins; }, 0) / A.major.length : 0;
  const up = A.spx.filter(function (b) { return b.c > b.o; }).length, dn = A.spx.filter(function (b) { return b.c < b.o; }).length;
  const inSw = A.major.reduce(function (a, s) { return a + s.mins; }, 0);
  const matched = A.major.filter(function (s) { return s.cat_t; }).length;
  const fast = A.bursts.slice().sort(function (x, y) { return Math.abs(y.speed) - Math.abs(x.speed); })[0];
  [['Average major swing', df_f_(avg, 1) + ' pts over ' + Math.round(avgM) + ' min'], ['Bars ≥ 2 pts', A.spx.filter(function (b) { return Math.abs(b.c - b.o) >= 2; }).length + ' of ' + A.spx.length],
   ['Bars up / down', up + ' / ' + dn], ['Time inside major swings', Math.round(inSw / 390 * 100) + '% of the session'],
   ['Major swings matched to a catalyst', matched + ' of ' + A.major.length], ['Fastest move', fast ? df_s_(fast.pts, 1) + ' pts in ' + fast.mins + ' min @ ' + df_t_(fast.ta) : '—']]
    .forEach(function (x, i) { const rr = r + Math.floor(i / 2), c = i % 2 === 0 ? 2 : 10; ui_label(sh, rr, c, c + 2, x[0]); ui_auto(sh, rr, c + 3, c === 10 ? 16 : 8, x[1], { bold: true, size: 9 }); });
}

/* ---------------------------------------------------------------- MINUTE HEAT MAP */
function df_fillHeat_(sh, ctx) {
  const A = ctx.A;
  df_legendNote_(sh, cal_pretty(ctx.k) + (A ? '  ·  ' + A.res + ' bars' : ''));
  const grids = [[8, function (i) { return A.heatPx[i]; }, function (v) { return df_heat_(v, 4); }], [24, function (i) { return A.heatVol[i]; }, function (v) { return df_vheat_(v); }]];
  const evm = {}; ((A && A.events) || []).forEach(function (e) { evm[in_m_(e.t)] = true; });
  grids.forEach(function (g, gi) {
    const V = [], BG = [];
    for (let row = 0; row < 13; row++) {
      const v = [], bg = []; let tot = 0, cnt = 0;
      for (let col = 0; col < 30; col++) {
        const m = 570 + row * 30 + col;
        let x = '';
        if (A && A.spx.length) {
          const i = A.res === '1-min' ? row * 30 + col : (col % 5 === 0 ? row * 6 + col / 5 : -1);
          if (i >= 0 && (gi === 0 ? i < A.heatPx.length : i < A.heatVol.length)) { const val = g[1](i); x = Math.round(val * 10) / 10; tot += val; cnt++; }
        }
        v.push(x); bg.push(x === '' ? COLOR.WHITE : g[2](x));
      }
      v.push(cnt ? Math.round((gi === 0 ? tot : tot / cnt) * 10) / 10 : ''); bg.push(COLOR.WHITE);
      V.push(v); BG.push(bg);
    }
    const rg = sh.getRange(g[0], 3, 13, 31);
    rg.setValues(V).setBackgrounds(BG).setBorder(true, true, true, true, true, true, COLOR.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(g[0], 33, 13, 1).setNumberFormat(gi === 0 ? '+0.0;-0.0;0' : '0.0"x"').setFontWeight('bold').setFontSize(8);
    Object.keys(evm).forEach(function (m) {
      const mm = Number(m) - 570; if (mm < 0 || mm >= 390) return;
      sh.getRange(g[0] + Math.floor(mm / 30), 3 + (mm % 30)).setBorder(true, true, true, true, null, null, '#534AB7', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    });
  });
  let txt = 'Each row is a half hour; each cell one minute. ';
  if (A && A.spx.length) {
    const b = A.bursts.slice().sort(function (x, y) { return Math.abs(y.pts) - Math.abs(x.pts); }).slice(0, 3);
    txt += 'Biggest bursts today: ' + b.map(function (x) { return df_s_(x.pts, 1) + ' pts from ' + df_t_(x.ta) + (x.cat_t ? ' (' + x.cat + ')' : ''); }).join(' · ') + '.';
    const hv = A.heatVol.map(function (v, i) { return { v: v, t: A.spy[i] ? A.spy[i].time : '' }; }).sort(function (x, y) { return y.v - x.v; })[0];
    if (hv) txt += ' Heaviest SPY minute: ' + df_t_(hv.t) + ' (' + df_f_(hv.v, 1) + 'x average).';
  } else txt += ctx.isFuture ? 'The grids fill in during the session.' : 'No minute bars saved for this day.';
  sh.getRange(39, 2).setValue(txt);
}

/* ---------------------------------------------------------------- EVENT REACTIONS */
function df_fillReactions_(sh, ctx) {
  const A = ctx.A;
  const keep = df_keep_(sh, 6, function (r) { return /M$/.test(String(r[1])) && r[2] ? 'ev|' + r[2] : null; }, [17]);
  df_clearBody_(sh, 6);
  df_legendNote_(sh, cal_pretty(ctx.k));
  let r = 6;
  ui_header(sh, r, 2, 17, 'REACTION WINDOWS  (points from the price at the event minute)'); r++;
  ui_sub(sh, r, [[2, 2, 'Time'], [3, 3, 'Event / headline'], [4, 4, 'Surprise'], [5, 5, '−5 → 0'], [6, 6, '+1'], [7, 7, '+2'], [8, 8, '+3'], [9, 9, '+5'], [10, 10, '+10'], [11, 11, '+15'], [12, 12, '+30'], [13, 13, '+60'], [14, 14, 'Close'], [15, 15, 'Peak (time)'], [16, 16, 'Back to pre-event'], [17, 17, 'Verdict (yours)']]);
  sh.setRowHeight(r, 30); r++;
  const evs = (ctx.events || []).filter(function (e, i, a) { return a.findIndex(function (x) { return x.name === e.name; }) === i; });
  const list = evs.length ? evs : (A && A.spx.length ? [{ t: '09:30', name: 'Cash open (reference)', kind: 'Open' }] : []);
  if (!list.length) { df_placeholder_(sh, r, 2, 17, ctx.isFuture ? 'Reactions are measured during the session.' : 'No bars saved for this day.'); return; }
  TW_(sh, r, 2, list.map(function (e) {
    const w = A ? in_eventWindows(A, e.t) : null, kp = keep['ev|' + e.name];
    return [{ v: df_t_(e.t), b: true }, { v: e.name + (w && w.series === '/ES' ? '  (/ES)' : ''), bg: COLOR.PUR, fc: COLOR.PURF, b: true, h: 'left' }, { v: e.surprise === undefined ? (e.detail || '—') : e.surprise, fc: df_pn_(e.surprise) }]
      .concat([-5, 1, 2, 3, 5, 10, 15, 30, 60].map(function (x) { const v = w ? w.w[x] : ''; return { v: v, bg: df_heat_(v, 25), fc: df_pn_(v), nf: FMT.PTS1, b: x === 15 }; }))
      .concat([{ v: w ? w.w.close : '', bg: df_heat_(w && w.w.close, 40), fc: df_pn_(w && w.w.close), nf: FMT.PTS1 },
        { v: w ? df_s_(w.peak.v, 1) + ' @ ' + df_t_(w.peak_t) : '—', fc: df_pn_(w && w.peak.v), b: true }, w && w.retrace ? df_t_(in_hhmm_(in_m_(e.t) + w.retrace)) + ' (+' + w.retrace + ' min)' : 'Not within 2 hrs',
        { v: kp ? kp[0] : '', bg: COLOR.INP, fc: COLOR.INPF, h: 'left' }]);
  }), { size: 9, wrap: true });
  r += list.length + 1;
  if (!evs.length) { df_placeholder_(sh, r, 2, 17, core_fnExists_('cat_eventsForDay') ? 'No tracked events today — the open is shown as a reference.' : 'Economic events, Fed speeches and headlines are added by Catalysts (Stage 5). Until then the cash open is shown as a reference.'); r += 2; }
  if (!A || (!A.spx.length && !A.es.length)) return;
  // minute-by-minute around the first event (or the open)
  const e0 = list[0], m0 = in_m_(e0.t), useEs = m0 < 570, ser = useEs ? A.es : A.spx;
  ui_header(sh, r, 2, 17, 'MINUTE-BY-MINUTE AROUND ' + df_t_(e0.t) + '  —  ' + e0.name + (useEs ? '  (/ES — pre-market)' : '')); r++;
  ui_sub(sh, r, [[2, 2, 'Time'], [3, 3, useEs ? '/ES close' : 'SPX close'], [4, 4, 'From event'], [5, 5, '1-min Δ'], [6, 6, 'SPY vol ×'], [7, 7, useEs ? 'SPY close' : '/ES close'], [8, 8, 'vs VWAP'], [9, 17, 'What happened']]); r++;
  const base = in_px_(ser, m0, useEs ? A.esStep : A.step, null);
  const rows = [];
  ser.filter(function (b) { return b.off === 0 && b.m >= m0 - 5 && b.m <= m0 + 35; }).forEach(function (b) {
    const y = A.spy.concat(A.spyPre).filter(function (x) { return x.m === b.m; })[0], e = A.es.filter(function (x) { return x.m === b.m && x.off === 0; })[0];
    const i = A.spy.indexOf(y), vw = i >= 0 && A.vwapPath ? y.c - A.vwapPath[i] : '';
    let what = '';
    if (b.m === m0) what = 'Event: ' + e0.name;
    if (A.hod_t === b.time) what = 'High of day'; if (A.lod_t === b.time) what = 'Low of day';
    if (A.or_break_t === b.time) what = 'Opening-range break: ' + A.or_break;
    const burst = A.bursts.filter(function (x) { return x.ta === b.time; })[0]; if (burst && !what) what = 'Burst ' + df_s_(burst.pts, 1) + ' pts in ' + burst.mins + ' min';
    rows.push([{ v: df_t_(b.time), b: !!what }, { v: b.c, nf: FMT.PRICE }, { v: b.m >= m0 && base !== null ? b.c - base : '', fc: df_pn_(b.c - base), nf: FMT.PTS1 },
      { v: b.c - b.o, bg: df_heat_(b.c - b.o, 5), fc: df_pn_(b.c - b.o), nf: FMT.PTS1 }, { v: y && A.avgVol ? y.v / A.avgVol : '', nf: FMT.MULT, bg: y && A.avgVol && y.v / A.avgVol >= 2 ? COLOR.INP : COLOR.WHITE },
      { v: useEs ? (y ? y.c : '') : (e ? e.c : ''), nf: FMT.PRICE }, { v: vw, fc: df_pn_(vw), nf: '+0.00;-0.00' }, { v: what, bg: what ? COLOR.PUR : COLOR.WHITE, fc: COLOR.PURF, b: !!what, h: 'left' }, '', '', '', '', '', '', '', '']);
  });
  if (rows.length) { TW_(sh, r, 2, rows, { size: 9 }); for (let i = 0; i < rows.length; i++) sh.getRange(r + i, 9, 1, 9).merge(); }
}

/* ---------------------------------------------------------------- CHARTS */
function df_fillCharts_(sh, ctx) {
  const A = ctx.A, cd = ctx.ss.getSheetByName('_ChartData');
  cd.getRange(2, 1, cd.getMaxRows() - 1, cd.getMaxColumns()).clearContent();
  df_legendNote_(sh, cal_pretty(ctx.k));
  sh.getRange(8, 14, 12, 4).breakApart().clear();
  if (!A) return;
  const lab = function (t) { return df_short_(t); };
  const put = function (col, rows) { if (rows.length) cd.getRange(2, col, rows.length, rows[0].length).setValues(rows); };
  const agg = function (bars, n) { return df_bucket_(bars, n * (bars === A.es || (bars[0] && bars[0].m < 570) ? A.esStep : A.step)); };
  if (A.spx.length) {
    put(1, A.spx.map(function (b) { return [lab(b.time), b.l, b.o, b.c, b.h]; }));
    const five = A.step === 1 ? agg(A.spx, 5) : A.spx;
    put(7, five.map(function (b) { return [lab(b.time), b.l, b.o, b.c, b.h]; }));
    const spyO = A.spy.length ? A.spy[0].o : null, esO = A.es_open;
    const spyBy = {}, esBy = {}; A.spy.forEach(function (b) { spyBy[b.m] = b.c; }); A.es.forEach(function (b) { if (b.off === 0) esBy[b.m] = b.c; });
    put(13, A.spx.map(function (b) { return [lab(b.time), (b.c - A.O) / A.O * 100, spyO && spyBy[b.m] ? (spyBy[b.m] - spyO) / spyO * 100 : '', esO && esBy[b.m] ? (esBy[b.m] - esO) / esO * 100 : '']; }));
    const v5 = A.step === 1 ? agg(A.spy, 5) : A.spy;
    put(18, v5.map(function (b) { return [lab(b.time), (b.v || 0) / 1e6]; }));
    const bins = {}; A.spx.forEach(function (b, i) { const y = A.spy[i]; const kk = Math.floor(b.c / 5) * 5; bins[kk] = (bins[kk] || 0) + (y ? y.v : 0); });
    put(21, Object.keys(bins).map(Number).sort(function (a, b) { return b - a; }).slice(0, 40).map(function (kk) { return [df_f_(kk, 0) + '–' + df_f_(kk + 5, 0), bins[kk] / 1e6]; }));
    const f15 = A.step === 1 ? agg(A.spx, 15) : agg(A.spx, 3);
    put(30, f15.map(function (b) { return [lab(b.time), b.l, b.o, b.c, b.h]; }));
  }
  const on = A.es.filter(function (b) { return b.m < 570; });
  if (on.length) put(24, agg(on, A.esStep === 1 ? 15 : 3).slice(-120).map(function (b) { return [df_short_(b.time), b.l, b.o, b.c, b.h]; }));
  const evs = (A.events || []).slice(0, 12);
  if (evs.length) {
    TW_(sh, 8, 14, evs.map(function (e) { const w = in_eventWindows(A, e.t); return [df_t_(e.t), { v: w ? w.base : '', nf: FMT.PRICE }, { v: e.name, bg: COLOR.PUR, fc: COLOR.PURF, b: true, h: 'left' }, '']; }), { size: 8 });
    for (let i = 0; i < evs.length; i++) sh.getRange(8 + i, 16, 1, 2).merge();
  }
  if (A.spx.length) TW_(sh, 8 + evs.length + 1, 14, [[{ v: 'LOD', bg: COLOR.LAB, fc: COLOR.LABF, b: true }, { v: df_f_(A.L) + ' @ ' + df_t_(A.lod_t), h: 'left' }, '', ''], [{ v: 'HOD', bg: COLOR.LAB, fc: COLOR.LABF, b: true }, { v: df_f_(A.H) + ' @ ' + df_t_(A.hod_t), h: 'left' }, '', ''],
    [{ v: 'OR break', bg: COLOR.LAB, fc: COLOR.LABF, b: true }, { v: A.or_break || '—', h: 'left' }, '', ''], [{ v: 'Gap', bg: COLOR.LAB, fc: COLOR.LABF, b: true }, { v: (ctx.d && ctx.d.gap_fill) || '—', h: 'left' }, '', '']], { size: 8 });
}

/* ---------------------------------------------------------------- LEVELS */
function df_fillLevels_(sh, ctx) {
  const A = ctx.A, d = ctx.d, ref = ctx.ref, tol = core_getSettingNum("Level 'test' tolerance (pts)", 3);
  const keepN = df_keep_(sh, 6, function (r) { return typeof r[1] === 'number' && r[2] ? 'lv|' + Math.round(r[1] * 100) + '|' + r[2] : null; }, [12]);
  const keepA = df_keep_(sh, 6, function (r) { return typeof r[1] === 'number' && r[3] && /^(Session|Overnight)$/.test(r[3]) ? 'sg|' + Math.round(r[1]) : null; }, [11]);
  df_clearBody_(sh, 6);
  const px = d ? Number(d.spx_c) : (ref ? Number(ref.spx_c) : null);
  df_legendNote_(sh, cal_pretty(ctx.k) + (px ? '  ·  ' + (d ? 'close ' : 'reference close ') + df_f_(px) : ''));
  let r = 6;
  ui_header(sh, r, 2, 12, 'LEVEL LADDER  —  sorted by price around the ' + (d ? 'close' : 'reference close (' + cal_short(ctx.refDate) + ')')); r++;
  ui_sub(sh, r, [[2, 2, 'Price'], [3, 3, 'Level'], [4, 4, 'Source'], [5, 5, 'Type'], [6, 6, 'Distance'], [7, 7, '%'], [8, 8, 'Status today'], [9, 9, 'Touches (30d)'], [10, 10, 'First touch today'], [11, 11, 'Validation'], [12, 12, 'Your note']]);
  sh.setRowHeight(r, 30); r++;
  const lv = df_autoLevels_(ctx).concat(df_yourLevels_(ctx)).sort(function (a, b) { return b[0] - a[0]; });
  const hist30 = ctx.P.rows.filter(function (x) { return String(x.date) <= ctx.k; }).slice(-30);
  const rows = []; let closeDone = false;
  lv.forEach(function (x) {
    if (!closeDone && px !== null && x[0] < px) { rows.push('CLOSE'); closeDone = true; }
    rows.push(x);
  });
  if (!closeDone && px !== null) rows.push('CLOSE');
  const cells = rows.map(function (x) {
    if (x === 'CLOSE') return [{ v: px, nf: FMT.PRICE, bg: COLOR.NAVY, fc: COLOR.WHITE, b: true }, { v: '◀  ' + (d ? 'CLOSE' : 'REFERENCE CLOSE') + '  ' + df_f_(px), bg: COLOR.NAVY, fc: COLOR.WHITE, b: true, h: 'left' }].concat(Array(9).fill({ v: '', bg: COLOR.NAVY }));
    const p = x[0], you = x[2] === 'You', dist = px !== null ? p - px : '';
    const t30 = hist30.filter(function (h) { return Number(h.spx_l) - tol <= p && p <= Number(h.spx_h) + tol; }).length;
    let st = '', first = '—', col = COLOR.GRAY;
    if (A && A.spx.length) {
      const hit = A.spx.filter(function (b) { return b.l - tol <= p && p <= b.h + tol; })[0];
      if (hit) { first = df_t_(hit.time); const crossed = (A.O - p) * (A.C - p) < 0; st = crossed ? (A.C > p ? 'BROKE ▲' : 'BROKE ▼') : 'TESTED — held'; col = crossed && A.C < p ? COLOR.RED : COLOR.GRN; }
      else st = 'Untested';
    }
    const type = x[3] || (p > px ? 'Resistance' : 'Support');
    const kp = keepN['lv|' + Math.round(p * 100) + '|' + x[1]];
    return [{ v: p, nf: FMT.PRICE, b: true, bg: you ? COLOR.INP : COLOR.WHITE, fc: you ? COLOR.INPF : COLOR.TEXT }, { v: x[1], h: 'left', bg: you ? COLOR.INP : COLOR.WHITE, fc: you ? COLOR.INPF : COLOR.TEXT },
      { v: you ? 'You' : x[2], fc: COLOR.GRAY }, { v: type, fc: /Resist/.test(type) ? COLOR.RED : (/Support/.test(type) ? COLOR.GRN : COLOR.TEXT) },
      { v: dist, nf: FMT.PTS, fc: df_pn_(dist) }, { v: px ? dist / px : '', nf: FMT.PCT, fc: df_pn_(dist) }, { v: st || '—', fc: col, b: /BROKE|TESTED/.test(st) },
      t30, first, { v: t30 >= 3 ? 'Validated' : (t30 ? 'Tested' : '—'), bg: COLOR.HIS, fc: COLOR.HISF }, { v: kp ? kp[0] : '', bg: COLOR.INP, fc: COLOR.INPF, h: 'left' }];
  });
  if (cells.length) TW_(sh, r, 2, cells, { size: 9 });
  r += cells.length + 1;
  ui_header(sh, r, 2, 12, 'SUGGESTED NEW LEVELS  (script)  —  tick "Accept?" and add the ones you want to your Report levels'); r++;
  ui_sub(sh, r, [[2, 2, 'Price'], [3, 3, 'Why'], [4, 4, 'Source'], [5, 5, 'Type'], [6, 6, 'Distance'], [7, 10, 'Evidence'], [11, 11, 'Accept?'], [12, 12, 'Note']]); r++;
  if (A && A.spx.length) {
    const sg = df_suggest_(A);
    TW_(sh, r, 2, sg.map(function (x) {
      const src = /overnight/.test(x[1]) ? 'Overnight' : 'Session', kp = keepA['sg|' + Math.round(x[0])];
      return [{ v: x[0], nf: '#,##0', b: true }, { v: x[1], h: 'left' }, src, x[0] > A.C ? 'Resistance' : 'Support', { v: x[0] - A.C, nf: FMT.PTS, fc: df_pn_(x[0] - A.C) },
        { v: 'Set ' + (x[1].indexOf('LOD') > -1 ? df_t_(A.lod_t) : (x[1].indexOf('HOD') > -1 ? df_t_(A.hod_t) : 'today')), bg: COLOR.HIS, fc: COLOR.HISF, h: 'left' }, { v: '', bg: COLOR.HIS }, { v: '', bg: COLOR.HIS }, { v: '', bg: COLOR.HIS },
        { v: kp ? kp[0] : false, bg: COLOR.INP }, { v: '', bg: COLOR.INP }];
    }), { size: 9 });
    for (let i = 0; i < sg.length; i++) sh.getRange(r + i, 7, 1, 4).merge();
    ui_checkbox(sh.getRange(r, 11, sg.length, 1));
  } else df_placeholder_(sh, r, 2, 12, 'Suggestions appear once the session has traded.');
}

/* ---------------------------------------------------------------- EVENTS & EARNINGS */
function df_fillEvents_(sh, ctx) {
  if (core_fnExists_('cat_fillEventsTab')) { cat_fillEventsTab(sh, ctx); return; }
  df_clearBody_(sh, 6);
  df_legendNote_(sh, cal_pretty(ctx.k));
  let r = 6;
  ui_header(sh, r, 2, 12, 'TODAY — ECONOMIC CALENDAR  (Actual · Previous · Consensus · Forecast)'); r++;
  ui_sub(sh, r, [[2, 2, 'Time'], [3, 3, 'Category'], [4, 4, 'Event'], [5, 5, 'Importance'], [6, 6, 'Actual'], [7, 7, 'Previous'], [8, 8, 'Consensus'], [9, 9, 'Forecast'], [10, 10, 'Surprise'], [11, 11, 'Source'], [12, 12, 'Your note']]); r++;
  df_placeholder_(sh, r, 2, 12, 'The economic calendar (with Actual, Previous, Consensus and Forecast for every release), Fed speakers, Treasury auctions and your top-10 earnings arrive with Catalysts (Stage 5).'); r += 2;
  ui_header(sh, r, 2, 12, 'WEEK AHEAD — calendar flags for the next 5 trading days'); r++;
  ui_sub(sh, r, [[2, 2, 'Day'], [3, 3, 'Date'], [4, 7, 'Calendar flags'], [8, 9, 'OPEX cycle'], [10, 12, 'Next FOMC']]); r++;
  let k = ctx.k; const rows = [];
  for (let i = 0; i < 5; i++) {
    k = cal_nextTradingDay(k); const f = { flags: df_flags_(k), meta: cal_getFlags(k).meta };
    rows.push([{ v: DOW_NAMES[cal_dow(k)], b: true }, cal_short(k), { v: f.flags.map(function (x) { return x.label; }).join(' · ') || '—', bg: f.flags.length ? COLOR.PUR : COLOR.WHITE, fc: COLOR.PURF, b: f.flags.length > 0, h: 'left' }, '', '', '',
      f.meta.tradingDaysToOpex + ' trading days to ' + cal_short(f.meta.nextOpex), '', f.meta.nextFomc ? cal_short(f.meta.nextFomc) : '—', '', '']);
  }
  TW_(sh, r, 2, rows, { size: 9, wrap: true });
  for (let i = 0; i < rows.length; i++) { sh.getRange(r + i, 4, 1, 4).merge(); sh.getRange(r + i, 8, 1, 2).merge(); sh.getRange(r + i, 10, 1, 3).merge(); sh.setRowHeight(r + i, 30); }
}

/* ---------------------------------------------------------------- HEADLINES */
function df_fillHeadlines_(sh, ctx) {
  if (core_fnExists_('cat_fillHeadlinesTab')) { globalThis.cat_fillHeadlinesTab(sh, ctx); return; }
  df_clearBody_(sh, 6);
  df_legendNote_(sh, cal_pretty(ctx.k));
  ui_header(sh, 6, 2, 12, 'ALL CANDIDATES (time-ordered)');
  ui_sub(sh, 7, [[2, 2, 'Time'], [3, 3, 'Headline'], [4, 4, 'Source'], [5, 5, 'Tag'], [6, 6, 'Impact'], [7, 7, 'SPX +1m'], [8, 8, '+5m'], [9, 9, '+15m'], [10, 10, 'Swing'], [11, 11, 'Kept'], [12, 12, 'Your note']]);
  df_placeholder_(sh, 8, 2, 12, 'Headlines from free news feeds arrive with Catalysts (Stage 5). Each one will show its SPX reaction at 1, 5 and 15 minutes and the swing it belongs to.');
}

/* ---------------------------------------------------------------- OPEX CYCLE */
function df_fillOpex_(sh, ctx) {
  const k = ctx.k, P = ctx.P, ref = ctx.ref, C = DC_(sh, 1, 1, 43, 11), T = COLOR.TEXT;
  const po = cal_prevOpex(cal_isTradingDay(k) ? k : cal_add(k, 1)), no = cal_nextOpex(cal_isTradingDay(k) ? cal_add(k, 1) : k);
  const poR = P.map[po.date], cyc = poR && ref ? (Number(ref.spx_c) - Number(poR.spx_c)) : null;
  C.set(4, 7, cal_pretty(k), { fc: COLOR.GRAY });
  C.set(6, 2, 'CURRENT CYCLE  —  ' + DOW_NAMES[cal_dow(po.date)] + ' ' + cal_short(po.date) + ' (' + (po.quarterly ? 'quad witching' : 'monthly') + ') → ' + DOW_NAMES[cal_dow(no.date)] + ' ' + cal_short(no.date) + ' (' + no.type.toLowerCase() + ')', { fc: COLOR.WHITE, b: true });
  const vx = cal_vixExp(cal_y(no.date), cal_m(no.date) === 1 ? 12 : cal_m(no.date) - 1);
  [['Previous OPEX close (' + cal_short(po.date) + ')', poR ? df_f_(poR.spx_c) : '—'], [(ctx.d ? 'Today\'s close' : 'Latest close (' + cal_short(ctx.refDate) + ')'), ref ? df_f_(ref.spx_c) : '—'],
   ['Cycle to date', cyc !== null ? df_s_(cyc) + ' pts  /  ' + df_p_(cyc / Number(poR.spx_c)) : '—'],
   ['Trading days elapsed / left', cal_tradingDays(cal_add(po.date, 1), k).length + ' / ' + cal_tradingDays(cal_add(k, 1), no.date).length],
   ['Next expiration', DOW_NAMES[cal_dow(no.date)] + ' ' + cal_short(no.date) + ' · ' + no.type + ' · ' + Math.round((cal_parse(no.date) - cal_parse(k)) / 864e5) + ' calendar days'],
   ['Thursday before (' + cal_short(no.thursdayBefore) + ') close', P.map[no.thursdayBefore] ? df_f_(P.map[no.thursdayBefore].spx_c) : '— (fills that day)'],
   ['VIX expiration this cycle', DOW_NAMES[cal_dow(vx)] + ' ' + cal_short(vx) + ' (AM settle)']].forEach(function (x, i) {
    C.set(7 + i, 2, x[0], { fc: COLOR.LABF, b: true }); C.set(7 + i, 3, x[1], { fc: /^\+/.test(x[1]) ? COLOR.GRN : (/^−/.test(x[1]) ? COLOR.RED : T), b: true });
  });
  // last expiration
  const pp = cal_prevOpex(po.date), ppR = P.map[pp.date], thu = P.map[po.thursdayBefore];
  C.set(16, 2, 'LAST EXPIRATION  —  ' + cal_pretty(po.date) + ' (' + (po.quarterly ? 'quarterly · quad witching' : 'monthly') + ')', { fc: COLOR.WHITE, b: true });
  [['Prior OPEX close (' + cal_short(pp.date) + ')', ppR ? df_f_(ppR.spx_c) : '—'], ['Thursday before (' + cal_short(po.thursdayBefore) + ') close', thu ? df_f_(thu.spx_c) : '—'],
   ['OPEX day close (' + cal_short(po.date) + ')', poR ? df_f_(poR.spx_c) : '—'],
   ['Cycle gain / loss (to Thursday)', ppR && thu ? df_s_(thu.spx_c - ppR.spx_c) + ' pts / ' + df_p_((thu.spx_c - ppR.spx_c) / ppR.spx_c) : '—'],
   ['Cycle gain / loss (to OPEX close)', ppR && poR ? df_s_(poR.spx_c - ppR.spx_c) + ' pts / ' + df_p_((poR.spx_c - ppR.spx_c) / ppR.spx_c) : '—'],
   ['Expiration-day move (Thu → Fri)', thu && poR ? df_s_(poR.spx_c - thu.spx_c) + ' pts / ' + df_p_((poR.spx_c - thu.spx_c) / thu.spx_c) : '—']].forEach(function (x, i) {
    C.set(17 + i, 2, x[0], { fc: COLOR.LABF, b: true }); C.set(17 + i, 3, x[1], { fc: /^\+/.test(x[1]) ? COLOR.GRN : (/^−/.test(x[1]) ? COLOR.RED : T), b: true });
  });
  C.set(23, 3, 'Your notes for that cycle are in the ' + cal_short(po.date) + ' day file (OPEX Cycle tab).', { fc: COLOR.GRAY });
  // next trading day after the last expiration
  const nd = P.map[po.nextDay], ns = ctx.sessions[po.nextDay] || {};
  C.set(25, 2, 'NEXT TRADING DAY AFTER THE LAST EXPIRATION  —  ' + cal_pretty(po.nextDay), { fc: COLOR.WHITE, b: true });
  const mv = db_readAll(in_movesSpec_()).rows.filter(function (x) { return String(x.date) === po.nextDay && x.tier === 'Major'; }).sort(function (a, b) { return Math.abs(b.pts) - Math.abs(a.pts); })[0];
  [['Open', nd ? df_f_(nd.spx_o) : '—', '9:30 AM', nd && poR ? 'Gap ' + df_s_(nd.spx_o - poR.spx_c) + ' pts / ' + df_p_((nd.spx_o - poR.spx_c) / poR.spx_c) + ' vs expiration close' : ''],
   ['Gap filled?', nd && nd.gap_fill ? (/Filled/.test(nd.gap_fill) ? 'Yes' : nd.gap_fill) : '—', nd && /Filled/.test(nd.gap_fill) ? nd.gap_fill.replace('Filled ', '') : '', nd && nd.gap_fill ? 'From SPY minute bars' : 'Needs intraday bars'],
   ['High / low', nd ? df_f_(nd.spx_h) + ' / ' + df_f_(nd.spx_l) : '—', ns.hod_t ? ns.hod_t + ' / ' + ns.lod_t : '', nd ? 'Range ' + df_f_(nd.range, 1) + ' pts (' + (nd.range_atr ? df_f_(nd.range_atr) + 'x ATR' : '') + ')' : ''],
   ['OR30 break', nd && nd.spy_or_break ? nd.spy_or_break.split(' ')[0] : '—', nd && nd.spy_or_break ? nd.spy_or_break.split(' ').slice(1).join(' ') : '', ''],
   ['Close', nd ? df_f_(nd.spx_c) : '—', '4:00 PM', nd && poR ? df_s_(nd.spx_c - poR.spx_c) + ' pts / ' + df_p_((nd.spx_c - poR.spx_c) / poR.spx_c) + ' vs expiration close' : ''],
   ['Largest move', mv ? df_s_(mv.pts, 1) + ' pts' : '—', mv ? mv.start + ' → ' + mv.end : '', mv ? (mv.catalyst || '') : '']].forEach(function (x, i) {
    C.set(27 + i, 2, x[0], { fc: COLOR.LABF, b: true }); C.set(27 + i, 3, x[1], { b: true }); C.set(27 + i, 4, x[2], { fc: T }); C.set(27 + i, 5, x[3], { fc: /^\+|Gap \+/.test(x[3]) ? COLOR.GRN : (/^−|Gap −/.test(x[3]) ? COLOR.RED : T) });
  });
  // history
  const hist = []; let o = po;
  for (let i = 0; i < 24 && P.map[o.date]; i++) {
    const pr = cal_prevOpex(o.date), prR = P.map[pr.date], oR = P.map[o.date], th = P.map[o.thursdayBefore], n1 = P.map[o.nextDay];
    if (prR && oR) hist.push({ o: o, cyc: (oR.spx_c - prR.spx_c) / prR.spx_c, day: th ? (oR.spx_c - th.spx_c) / th.spx_c : '', n1: n1, gap: n1 ? (n1.spx_o - oR.spx_c) / oR.spx_c : '', nd: n1 ? (n1.spx_c - oR.spx_c) / oR.spx_c : '', rng: n1 ? n1.range_atr : '' });
    o = pr;
  }
  for (let i = 0; i < 6; i++) {
    const h = hist[i], r = 37 + i;
    const vals = h ? [cal_short(h.o.date) + ', ' + cal_y(h.o.date), h.o.quarterly ? 'Quarterly' : 'Monthly', h.cyc, h.day, h.n1 ? DOW_NAMES[cal_dow(h.o.nextDay)] + ' ' + cal_short(h.o.nextDay) : '—', h.gap, h.n1 && h.n1.gap_fill ? h.n1.gap_fill.replace('Filled ', '') : '—', h.nd, h.rng, ''] : Array(10).fill('');
    vals.forEach(function (v, j) { C.set(r, 2 + j, v, { fc: typeof v === 'number' ? df_pn_(v) : COLOR.HISF }); });
  }
  sh.getRange('D37:E42').setNumberFormat(FMT.PCT); sh.getRange('G37:G42').setNumberFormat(FMT.PCT); sh.getRange('I37:I42').setNumberFormat(FMT.PCT); sh.getRange('J37:J42').setNumberFormat('0.00"x"');
  if (hist.length) {
    const gd = hist.filter(function (h) { return h.gap !== '' && h.gap < 0; }).length, n = hist.filter(function (h) { return h.n1; }).length;
    const filled = hist.filter(function (h) { return h.n1 && /Filled/.test(h.n1.gap_fill || ''); }).length, withFill = hist.filter(function (h) { return h.n1 && h.n1.gap_fill; }).length;
    const upD = hist.filter(function (h) { return h.nd !== '' && h.nd > 0; }).length;
    const rr = hist.filter(function (h) { return h.rng; }).map(function (h) { return Number(h.rng); });
    C.set(43, 2, 'Next-day summary (last ' + n + ' cycles): gap down ' + Math.round(gd / Math.max(1, n) * 100) + '% · up day ' + Math.round(upD / Math.max(1, n) * 100) + '%' +
      (withFill ? ' · gap filled ' + Math.round(filled / withFill * 100) + '% (' + withFill + ' days with minute data)' : '') + (rr.length ? ' · avg range ' + df_f_(rr.reduce(function (a, b) { return a + b; }, 0) / rr.length) + 'x ATR' : ''), { fc: COLOR.HISF, b: true });
  }
  C.flush();
}

/* ---------------------------------------------------------------- OVERNIGHT ES */
function df_fillOvernight_(sh, ctx) {
  const A = ctx.A;
  df_clearBody_(sh, 6);
  df_legendNote_(sh, cal_pretty(ctx.k));
  if (!A || !A.es.length) { df_placeholder_(sh, 6, 2, 13, ctx.isFuture ? 'The overnight /ES session appears from 6 PM ET the evening before this day.' : 'No /ES bars saved for this day.'); return; }
  let r = 6;
  ui_header(sh, r, 2, 13, 'SESSION SUMMARY'); r++;
  ui_sub(sh, r, [[2, 3, 'Session'], [4, 4, 'Open'], [5, 5, 'High'], [6, 6, 'Low'], [7, 7, 'Close'], [8, 8, 'Net'], [9, 9, 'Range'], [10, 11, 'High / low time'], [12, 13, 'Character']]); r++;
  const ses = [['Asia (6 PM–2 AM)', A.asia], ['London (2–8 AM)', A.london], ['US pre (8–9:30 AM)', A.uspre], ['Full overnight', A.on], ['Regular session /ES', A.esRth]];
  TW_(sh, r, 2, ses.map(function (x) {
    const s = x[1]; if (!s) return [{ v: x[0], bg: COLOR.LAB, fc: COLOR.LABF, b: true, h: 'left' }, '', '—', '', '', '', '', '', '', '', '', ''];
    const ch = x[0] === 'Full overnight' && A.inventory !== '' ? 'Cash opened at ' + Math.round(A.inventory * 100) + '% of the range' : (Math.abs(s.net) < (s.h - s.l) * 0.3 ? 'Two-sided' : (s.net > 0 ? 'Trended up' : 'Trended down'));
    return [{ v: x[0], bg: COLOR.LAB, fc: COLOR.LABF, b: true, h: 'left' }, '', { v: s.o, nf: FMT.PRICE }, { v: s.h, nf: FMT.PRICE }, { v: s.l, nf: FMT.PRICE }, { v: s.c, nf: FMT.PRICE },
      { v: s.net, nf: FMT.PTS1, fc: df_pn_(s.net), b: true }, { v: s.h - s.l, nf: '0.0' }, df_t_(s.ht) + ' / ' + df_t_(s.lt), '', { v: ch, bg: COLOR.INP, fc: COLOR.INPF, h: 'left' }, { v: '', bg: COLOR.INP }];
  }), { size: 9 });
  for (let i = 0; i < ses.length; i++) { sh.getRange(r + i, 2, 1, 2).merge(); sh.getRange(r + i, 10, 1, 2).merge(); sh.getRange(r + i, 12, 1, 2).merge(); }
  r += ses.length + 1;
  ui_header(sh, r, 2, 13, '15-MINUTE BARS  —  prior evening through 9:30 AM'); r++;
  ui_sub(sh, r, [[2, 2, 'Time'], [3, 3, 'Session'], [4, 4, '/ES open'], [5, 5, '/ES high'], [6, 6, '/ES low'], [7, 7, '/ES close'], [8, 8, '/ES Δ'], [9, 9, 'Cum. from start'], [10, 10, 'SPY close'], [11, 11, 'SPY Δ %'], [12, 13, 'Flags / events']]); r++;
  const on = A.es.filter(function (b) { return b.m < 570; }), n = A.esStep === 1 ? 15 : 3, rows = [], o0 = on.length ? on[0].o : 0;
  for (let i = 0; i < on.length; i += n) {
    const s = on.slice(i, i + n), h = in_max_(s, 'h'), l = in_min_(s, 'l'), c = s[s.length - 1].c, m = s[0].m;
    const sess = m < 120 ? 'Asia' : (m < 480 ? 'London' : 'US pre');
    const y = A.spyPre.filter(function (b) { return b.m >= m && b.m < m + 15; });
    const fl = [];
    if (A.on && h === A.on.h) fl.push('ON HIGH'); if (A.on && l === A.on.l) fl.push('ON LOW');
    if (m === 120) fl.push('London open'); if (m === 240) fl.push('SPY pre-market opens');
    (A.events || []).forEach(function (e) { const em = in_m_(e.t); if (em >= m && em < m + 15) fl.push(df_short_(e.t) + ' ' + e.name); });
    rows.push([df_t_(s[0].time), { v: sess, bg: COLOR.PUR, fc: COLOR.PURF, b: true }, { v: s[0].o, nf: FMT.PRICE }, { v: h, nf: FMT.PRICE }, { v: l, nf: FMT.PRICE }, { v: c, nf: FMT.PRICE },
      { v: c - s[0].o, bg: df_heat_(c - s[0].o, 6), fc: df_pn_(c - s[0].o), nf: FMT.PTS1 }, { v: c - o0, fc: df_pn_(c - o0), nf: FMT.PTS1 },
      { v: y.length ? y[y.length - 1].c : '—', nf: FMT.PRICE, fc: y.length ? COLOR.TEXT : COLOR.GRAY }, { v: y.length ? (y[y.length - 1].c - y[0].o) / y[0].o : '', nf: FMT.PCT, fc: y.length ? df_pn_(y[y.length - 1].c - y[0].o) : COLOR.TEXT },
      fl.length ? { v: fl.join(' · '), bg: COLOR.PUR, fc: COLOR.PURF, b: true, h: 'left' } : '', '']);
  }
  if (rows.length) { TW_(sh, r, 2, rows, { size: 9 }); for (let i = 0; i < rows.length; i++) sh.getRange(r + i, 12, 1, 2).merge(); }
}

/* ---------------------------------------------------------------- TRADES & JOURNAL */
function df_fillJournal_(sh, ctx) {
  const A = ctx.A;
  sh.getRange(4, 7).setValue(cal_pretty(ctx.k));
  if (!A || !A.spx.length) return;
  const times = ctx.ss.getSheetByName('Report').getRange('J117:J121').getDisplayValues();
  const out = times.map(function (t) {
    const m = String(t[0]).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return [''];
    let h = Number(m[1]); if (m[3] && /PM/i.test(m[3]) && h < 12) h += 12; if (m[3] && /AM/i.test(m[3]) && h === 12) h = 0;
    const px = in_px_(A.spx, h * 60 + Number(m[2]) + 1, A.step, null);
    return [px === null ? '' : px];
  });
  sh.getRange(8, 10, 5, 1).setValues(out);
}

/* ---------------------------------------------------------------- SIMILAR DAYS */
function df_fillSimilar_(sh, ctx) {
  if (core_fnExists_('an_fillSimilarTab')) { globalThis.an_fillSimilarTab(sh, ctx); return; }
  df_clearBody_(sh, 6);
  df_legendNote_(sh, cal_pretty(ctx.k));
  ui_header(sh, 6, 2, 17, 'MATCH SCORES  (what made each day similar)');
  df_placeholder_(sh, 7, 2, 17, 'Similar past days — match scores, how each day unfolded checkpoint by checkpoint, and your notes from those days — arrive with Analytics (Stage 6).');
}

/* ---------------------------------------------------------------- 1-MIN TAPE */
function df_fillTape1_(sh, ctx) {
  const A = ctx.A;
  df_clearBody_(sh, 6);
  df_legendNote_(sh, cal_pretty(ctx.k) + (A ? '  ·  ' + A.res + ' bars' : ''));
  if (!A || (!A.spx.length && !A.spyPre.length)) { df_placeholder_(sh, 6, 2, 19, ctx.isFuture ? 'The tape fills in from the pre-market onward.' : 'No minute bars saved for this day.'); return; }
  const head = ['Time', 'Session', 'SPX open', 'SPX high', 'SPX low', 'SPX close', 'SPX Δ', 'Cum. from open', 'SPY close', 'SPY volume', 'Vol vs avg', '/ES close', '/ES Δ', 'SPY vs VWAP', 'Flags', 'Swing', 'Burst', 'Event / headline'];
  const evm = {}; (A.events || []).forEach(function (e) { evm[e.t] = (evm[e.t] ? evm[e.t] + ' · ' : '') + e.name; });
  const esBy = {}; A.es.forEach(function (b) { if (b.off === 0) esBy[b.m] = b; });
  let r = 6;
  const section = function (title) { ui_header(sh, r, 2, 19, title); r++; ui_sub(sh, r, head.map(function (h, i) { return [2 + i, 2 + i, h]; })); sh.setRowHeight(r, 28); r++; };
  if (A.spyPre.length) {
    section('PRE-MARKET  (8:00 → 9:29 AM · SPY & /ES)');
    const pre = A.spyPre.filter(function (b) { return b.m >= 480; });
    TW_(sh, r, 2, pre.map(function (y) {
      const e = esBy[y.m];
      return [df_t_(y.time), { v: 'Pre', fc: COLOR.GRAY }, '—', '—', '—', '—', '', '', { v: y.c, nf: FMT.PRICE }, { v: y.v, nf: '#,##0' }, '', { v: e ? e.c : '', nf: FMT.PRICE },
        { v: e ? e.c - e.o : '', bg: df_heat_(e ? e.c - e.o : '', 3), fc: df_pn_(e ? e.c - e.o : ''), nf: FMT.PTS1 }, '', '', '', '', evm[y.time] ? { v: evm[y.time], bg: COLOR.PUR, fc: COLOR.PURF, b: true, h: 'left' } : ''];
    }), { size: 8 });
    r += pre.length + 1;
  }
  if (A.spx.length) {
    section('REGULAR SESSION  (9:30 AM → 4:00 PM)');
    const avgAbs = A.spx.reduce(function (a, b) { return a + Math.abs(b.c - b.o); }, 0) / A.spx.length;
    const swingOf = function (t) { for (let i = 0; i < A.major.length; i++) if (A.major[i].ta <= t && t < A.major[i].tb) return i + 1; return A.major.length && t >= A.major[A.major.length - 1].ta ? A.major.length : ''; };
    const burstOf = {}; A.bursts.forEach(function (b, i) { for (let x = b.ia; x <= b.ib; x++) burstOf[x] = i + 1; });
    const spyBy = {}; A.spy.forEach(function (b, i) { spyBy[b.m] = { b: b, i: i }; });
    TW_(sh, r, 2, A.spx.map(function (b, i) {
      const y = spyBy[b.m], e = esBy[b.m], dd = b.c - b.o, fl = [];
      if (b.time === A.hod_t) fl.push('HOD'); if (b.time === A.lod_t) fl.push('LOD');
      if (Math.abs(dd) >= 3 * avgAbs) fl.push('Big bar'); if (b.time === A.or_break_t) fl.push('OR break');
      if (ctx.d && ctx.d.gap_fill && ctx.d.gap_fill.indexOf(md_ampm_(b.time)) > -1) fl.push('Gap filled');
      const vw = y && A.vwapPath ? y.b.c - A.vwapPath[y.i] : '';
      if (y && y.i > 0 && A.vwapPath && (y.b.c - A.vwapPath[y.i]) * (A.spy[y.i - 1].c - A.vwapPath[y.i - 1]) < 0) fl.push('VWAP ✕');
      const vx = y && A.avgVol ? y.b.v / A.avgVol : '';
      return [{ v: df_t_(b.time), b: !!evm[b.time] }, { v: 'RTH', fc: COLOR.GRAY }, { v: b.o, nf: FMT.PRICE }, { v: b.h, nf: FMT.PRICE, b: b.time === A.hod_t }, { v: b.l, nf: FMT.PRICE, b: b.time === A.lod_t }, { v: b.c, nf: FMT.PRICE },
        { v: dd, bg: df_heat_(dd, 4), fc: df_pn_(dd), nf: '+0.00;-0.00', b: Math.abs(dd) >= 3 * avgAbs }, { v: b.c - A.O, fc: df_pn_(b.c - A.O), nf: FMT.PTS1 },
        { v: y ? y.b.c : '', nf: FMT.PRICE }, { v: y ? y.b.v : '', nf: '#,##0' }, { v: vx, nf: FMT.MULT, bg: vx !== '' && vx >= 2 ? COLOR.INP : COLOR.WHITE, fc: vx !== '' && vx >= 2 ? COLOR.INPF : COLOR.TEXT, b: vx !== '' && vx >= 2 },
        { v: e ? e.c : '', nf: FMT.PRICE }, { v: e ? e.c - e.o : '', fc: df_pn_(e ? e.c - e.o : ''), nf: FMT.PTS1 }, { v: vw, fc: df_pn_(vw), nf: '+0.00;-0.00' },
        fl.length ? { v: fl.join(' · '), bg: COLOR.PUR, fc: COLOR.PURF, b: true } : '', { v: swingOf(b.time), bg: COLOR.HIS, fc: COLOR.HISF }, { v: burstOf[i] || '', bg: COLOR.HIS, fc: COLOR.HISF },
        evm[b.time] ? { v: evm[b.time], bg: COLOR.PUR, fc: COLOR.PURF, b: true, h: 'left' } : ''];
    }), { size: 8 });
    if (core_fnExists_('mc_tapeExtra')) { try { mc_tapeExtra(sh, ctx, r, A.spx); } catch (e) { core_logError_('tape extra', e); } }
  }
  sh.setFrozenRows(4);
}

/* ---------------------------------------------------------------- 5-MIN TAPE */
function df_fillTape5_(sh, ctx) {
  const A = ctx.A;
  df_clearBody_(sh, 6);
  df_legendNote_(sh, cal_pretty(ctx.k));
  if (!A || (!A.spx.length && !A.es.length)) { df_placeholder_(sh, 6, 2, 18, ctx.isFuture ? 'The tape fills in from the prior evening onward.' : 'No bars saved for this day.'); return; }
  const head = ['Time', 'Session', 'SPX open', 'SPX high', 'SPX low', 'SPX close', 'SPX Δ', 'Cum. from open', 'SPY close', 'SPY volume', 'Vol vs avg', '/ES close', '/ES Δ', 'SPY vs VWAP', 'Flags', 'Swing', 'Event / headline'];
  let r = 6;
  const section = function (title) { ui_header(sh, r, 2, 18, title); r++; ui_sub(sh, r, head.map(function (h, i) { return [2 + i, 2 + i, h]; })); sh.setRowHeight(r, 28); r++; };
  const agg = function (bars, n, step) { return df_bucket_(bars, n * (step || 1)); };
  const on = A.es.filter(function (b) { return b.m < 480; });
  if (on.length) {
    section('OVERNIGHT  —  /ES 30-minute blocks (prior evening → 8:00 AM)');
    const rows = agg(on, 30).map(function (b) {
      return [df_t_(b.time), { v: b.m < 120 ? 'Asia' : 'London', bg: COLOR.PUR, fc: COLOR.PURF, b: true }, '—', '—', '—', '—', '', '', '', '', '', { v: b.c, nf: FMT.PRICE },
        { v: b.c - b.o, bg: df_heat_(b.c - b.o, 10), fc: df_pn_(b.c - b.o), nf: FMT.PTS1 }, '', '', '', ''];
    });
    TW_(sh, r, 2, rows, { size: 9 }); r += rows.length + 1;
  }
  const pre = agg(A.spyPre.filter(function (b) { return b.m >= 480; }), 5);
  const esP = agg(A.es.filter(function (b) { return b.m >= 480 && b.m < 570; }), 5);
  if (pre.length || esP.length) {
    section('PRE-MARKET  —  5-minute bars (8:00 → 9:25 AM)');
    const esBy = {}; esP.forEach(function (b) { esBy[b.m] = b; });
    const rows = (pre.length ? pre : esP).map(function (b) {
      const y = pre.length ? b : null, e = esBy[b.m];
      return [df_t_(b.time), { v: 'US pre', bg: COLOR.PUR, fc: COLOR.PURF, b: true }, '—', '—', '—', '—', '', '', { v: y ? y.c : '', nf: FMT.PRICE }, { v: y ? y.v : '', nf: '#,##0' }, '',
        { v: e ? e.c : '', nf: FMT.PRICE }, { v: e ? e.c - e.o : '', bg: df_heat_(e ? e.c - e.o : '', 6), fc: df_pn_(e ? e.c - e.o : ''), nf: FMT.PTS1 }, '', '', '', ''];
    });
    TW_(sh, r, 2, rows, { size: 9 }); r += rows.length + 1;
  }
  if (A.spx.length) {
    section('REGULAR SESSION  —  5-minute bars (9:30 AM → 4:00 PM)');
    const s5 = agg(A.spx, 5), y5 = agg(A.spy, 5), e5 = agg(A.es.filter(function (b) { return b.off === 0 && b.m >= 570 && b.m < 960; }), 5);
    const yBy = {}, eBy = {}; y5.forEach(function (b) { yBy[b.m] = b; }); e5.forEach(function (b) { eBy[b.m] = b; });
    const avgV = y5.length ? y5.reduce(function (a, b) { return a + b.v; }, 0) / y5.length : 0;
    TW_(sh, r, 2, s5.map(function (b, i) {
      const y = yBy[b.m], e = eBy[b.m], dd = b.c - b.o, evs = (A.events || []).filter(function (x) { const m = in_m_(x.t); return m >= b.m && m < b.m + 5; }).map(function (x) { return x.name; });
      const fl = []; if (b.h === A.H || (A.hod_t && in_m_(A.hod_t) >= b.m && in_m_(A.hod_t) < b.m + 5)) fl.push('HOD'); if (A.lod_t && in_m_(A.lod_t) >= b.m && in_m_(A.lod_t) < b.m + 5) fl.push('LOD'); if (Math.abs(dd) >= 12) fl.push('Big bar');
      let vi = -1; for (let q = 0; q < A.spy.length && A.spy[q].m < b.m + 5; q++) vi = q; const vw = y && vi >= 0 && A.vwapPath ? y.c - A.vwapPath[vi] : '';
      const sw = A.major.map(function (s, j) { return in_m_(s.ta) <= b.m && b.m < in_m_(s.tb) ? j + 1 : null; }).filter(function (x) { return x; })[0] || '';
      const vx = y && avgV ? y.v / avgV : '';
      return [{ v: df_t_(b.time), b: evs.length > 0 }, { v: 'RTH', fc: COLOR.GRAY }, { v: b.o, nf: FMT.PRICE }, { v: b.h, nf: FMT.PRICE }, { v: b.l, nf: FMT.PRICE }, { v: b.c, nf: FMT.PRICE },
        { v: dd, bg: df_heat_(dd, 12), fc: df_pn_(dd), nf: '+0.00;-0.00', b: Math.abs(dd) >= 8 }, { v: b.c - A.O, fc: df_pn_(b.c - A.O), nf: FMT.PTS1 },
        { v: y ? y.c : '', nf: FMT.PRICE }, { v: y ? y.v : '', nf: '#,##0' }, { v: vx, nf: FMT.MULT, bg: vx !== '' && vx >= 1.8 ? COLOR.INP : COLOR.WHITE, b: vx !== '' && vx >= 1.8 },
        { v: e ? e.c : '', nf: FMT.PRICE }, { v: e ? e.c - e.o : '', fc: df_pn_(e ? e.c - e.o : ''), nf: FMT.PTS1 }, { v: vw, fc: df_pn_(vw), nf: '+0.00;-0.00' },
        fl.length ? { v: fl.join(' · '), bg: COLOR.PUR, fc: COLOR.PURF, b: true } : '', { v: sw, bg: COLOR.HIS, fc: COLOR.HISF }, evs.length ? { v: evs.join(' · '), bg: COLOR.PUR, fc: COLOR.PURF, b: true, h: 'left' } : ''];
    }), { size: 9 });
  }
}

/* ---------------------------------------------------------------- ABOUT THIS DAY */
function df_fillAbout_(sh, ctx) {
  df_clearBody_(sh, 6);
  const row = ctx.row, ix = ctx.idx || {};
  let r = 6;
  ui_header(sh, r, 2, 5, 'FILE'); r++;
  const hub = SpreadsheetApp.getActive();
  const rows = [['Trading day', cal_pretty(ctx.k) + (ctx.flags.isTradingDay ? ' · day ' + ctx.flags.meta.tradingDayOfYear + ' of ' + ctx.flags.meta.tradingDaysInYear : '')],
    ['Status', row.status === 'Locked' ? '🔒 Locked ' + row.locked_at : (row.status === 'Future' ? '◷ Upcoming — created in advance' : '✎ Draft — refreshed automatically')],
    ['Created', row.created || ''], ['Last refresh', Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd h:mm a')], ['Refreshes', String((Number(row.refreshes) || 0) + 1)],
    ['Template version', 'Day Template v' + DF_TEMPLATE_VERSION + ' · DayFile.gs v' + DF_VERSION], ['Hub', df_link_(hub.getUrl(), hub.getName() + ' ↗')]];
  TW_(sh, r, 2, rows.map(function (x) { return [{ v: x[0], bg: COLOR.LAB, fc: COLOR.LABF, b: true, h: 'left' }, { v: x[1], h: 'left', fc: /HYPERLINK/.test(x[1]) ? COLOR.LINK : COLOR.TEXT }, '', '']; }), { size: 9 });
  for (let i = 0; i < rows.length; i++) sh.getRange(r + i, 3, 1, 3).merge();
  r += rows.length + 1;
  ui_header(sh, r, 2, 5, 'DATA SOURCES'); r++;
  ui_sub(sh, r, [[2, 2, 'Data'], [3, 3, 'Source'], [4, 4, 'Status'], [5, 5, 'Notes']]); r++;
  const ok = function (b) { return b ? { v: '✓', bg: COLOR.OKBG, fc: COLOR.GRN, b: true } : { v: ctx.isFuture ? '—' : '✗', bg: ctx.isFuture ? COLOR.LAB : COLOR.ERRBG, fc: ctx.isFuture ? COLOR.GRAY : COLOR.RED, b: true }; };
  const src = [['SPX / SPY / /ES 1-minute bars', 'Yahoo Finance → Drive data lake', ok(Number(ix.spx1) > 0), ix.date ? ix.spx1 + ' / ' + ix.spy1 + ' / ' + ix.es1 + ' bars' : ''],
    ['5-minute bars', 'Yahoo Finance → Drive data lake', ok(Number(ix.spx5) > 0), ix.date ? ix.spx5 + ' / ' + ix.spy5 + ' / ' + ix.es5 + ' bars' : ''],
    ['Daily prices, VIX family, yields, DXY', 'Yahoo Finance · FRED', ok(!!ctx.d), ctx.health.time ? 'Last run ' + ctx.health.time : ''],
    ['Economic releases, Fed, auctions', 'FRED · Treasury · Fed (Catalysts)', core_fnExists_('cat_eventsForDay') ? ok(true) : { v: 'Stage 5', fc: COLOR.GRAY }, ''],
    ['Earnings & headlines', 'Alpha Vantage · Nasdaq · news feeds (Catalysts)', core_fnExists_('cat_headlinesForDay') ? ok(true) : { v: 'Stage 5', fc: COLOR.GRAY }, ''],
    ['Similar days & research', 'Hub databases (Analytics)', core_fnExists_('an_similarForDay') ? ok(true) : { v: 'Stage 6', fc: COLOR.GRAY }, '']];
  TW_(sh, r, 2, src.map(function (x) { return [{ v: x[0], bg: COLOR.LAB, fc: COLOR.LABF, b: true, h: 'left' }, x[1], x[2], { v: x[3], h: 'left' }]; }), { size: 9 });
  r += src.length + 1;
  ui_header(sh, r, 2, 5, 'TAB GUIDE  (click to jump)'); r++;
  const guide = [['Report', 'The daily report — every section of your original sheet plus the intraday summary'], ['Macro', 'That day\'s cross-asset snapshot: alerts, stress meters, Treasury curve, FX, global, commodities, crypto, sectors'], ['Yield Curve', 'Rates that day: the curve and its move, the 10-year minute by minute, auctions, spreads, real yields, stock/bond trade-off'], ['FX & Carry', 'The dollar and the yen that day, carry-trade stress, every major pair, Japan, positioning'], ['Global Markets', 'Asia and Europe into and during the session, every index, the last 10 sessions'], ['Commodities & Crypto', 'Oil, gold and Bitcoin minute by minute, EIA, sectors that day, every market and ratio'], ['Game Plan', 'Notes typed days ahead, today\'s schedule, levels, expected move, scenarios, checklist, history'],
    ['Intraday Map', 'Cross-reference SPX/SPY/ES, statistics, 30-min & overnight maps, swings, event links, charts'], ['Moves (1-min)', 'Major swings, micro-moves and bursts to the minute, with catalysts and lag'],
    ['Minute Heat Map', 'Every minute of the session as a shaded grid — price change and volume'], ['Event Reactions', 'Each event at +1/+2/+3/+5/+10/+15/+30/+60 min, peak, retrace, minute-by-minute'],
    ['Charts', '1-min & 5-min candles, cumulative %, volume, volume at price, overnight /ES'], ['Levels', 'The full level ladder with status and suggested new levels'],
    ['Events & Earnings', 'Today\'s calendar, week ahead, earnings watchlist'], ['Headlines', 'Headline candidates with minute reactions'], ['OPEX Cycle', 'Current cycle, last expiration, the day after, history'],
    ['Overnight ES', 'Asia, London, US pre sessions in 15-min bars'], ['Trades & Journal', 'Trades with context, rules, lessons, mental state'], ['Similar Days', 'Closest past days and how they unfolded'],
    ['1-Min Tape', 'Every minute: SPX, SPY, /ES, volume, VWAP, flags, swings, bursts, events'], ['5-Min Tape', 'Overnight, pre-market and regular session in 5-min bars']];
  TW_(sh, r, 2, guide.map(function (x) { return [{ v: '=HYPERLINK("#gid=' + ctx.gids[x[0]] + '","' + x[0] + '")', bg: COLOR.LAB, fc: COLOR.LINK, b: true, h: 'left' }, { v: x[1], h: 'left' }, '', '']; }), { size: 9 });
  for (let i = 0; i < guide.length; i++) sh.getRange(r + i, 3, 1, 3).merge();
}

/* =============================================================================
 * INSTRUCTIONS
 * ========================================================================== */
function df_instructions() {
  return [
    { title: 'Daily routine with day files', blocks: [
      { text: 'Each trading day has its own Google Sheet, created days in advance in your main folder (by year and month). The ▶ Today shortcut at the top of the main folder always opens the current day. You work in the day file; the hub keeps it updated and saves your inputs.' },
      { table: { head: ['When (ET)', 'Automatic', 'You'], rows: [
        ['Days before', 'Nightly: the next N trading days are created (Settings: Days ahead to build) with calendar flags, OPEX cycle, week ahead, levels, expected move and history. Existing future days get a quick refresh of just those tabs.', 'Type "What to watch" notes, scenarios, consensus/forecast, planned levels.'],
        ['7:00 AM', 'Morning prep: prior-day levels, overnight /ES (Asia, London), pre-market; ▶ Today points to today.', 'Review the Game Plan and Report.'],
        ['Hourly 4–9 AM, then every 30 min to 4:15 PM', 'Light refresh: Report, intraday tabs, events, headlines and levels (the tabs that change during the session). The full file is redrawn at the morning prep and the end of day.', 'Type intraday notes (time-stamped automatically), log trades.'],
        ['4:30 PM', 'End of day: final bars and analysis; your inputs are copied to the hub.', '—'],
        ['Evening', '—', 'Evaluation, dropdowns, discipline, journal. Then in the hub: Market Report → 🔒 Save & Lock a day.']
      ] } },
      { tip: 'Amber cells are never overwritten by a refresh. Notes you type in tables that are redrawn (moves, levels, event verdicts) are matched back to their row by time or price.' },
      { table: { head: ['Report section', 'How it sizes itself'], rows: [
        ['Key support / resistance levels', 'Starts with 5 rows; typing a price in the last visible row opens the next (up to 12). A refresh always leaves one empty row ready.'],
        ['Notable economic events', 'One row per event that day, Fed speakers included (up to 12); empty rows are hidden.'],
        ['Earnings', 'Only your ticked watchlist companies reporting that day ("TODAY · after close") or the day before ("YESTERDAY · after close → reaction today"), up to 10. The 5-day look-ahead stays on the Events & Earnings tab.'],
        ['Daily headlines', 'Every headline you kept, every high-impact one, and the ones that moved SPX / ES the most within 5–15 minutes (up to 10, in time order).']
      ] } }
    ] },
    { title: 'Day files — building, locking, rebuilding', blocks: [
      { table: { head: ['Action', 'How'], rows: [
        ['Open today', 'The ▶ Today shortcut in the main folder, the "Day Files" tab in the hub, or Market Report → 📂 Open today\'s day file.'],
        ['Build future days now', 'Market Report → Day files → Build / refresh future days now (also runs nightly).'],
        ['Lock a day', 'Market Report → 🔒 Save & Lock a day. Your inputs are saved to the hub (_DailyLog), the header shows 🔒 LOCKED and a PDF of the Report is saved next to the day file. Locked days are no longer refreshed.'],
        ['Unlock a day', 'Market Report → 🔓 Unlock a day, edit, then lock again (the PDF is replaced).'],
        ['Rebuild a day', 'Market Report → Day files → Build or rebuild a specific day — refreshes any past or future day in place; your notes stay.'],
        ['Build past days (a range)', 'Market Report → Day files → Build past days (range). Enter the first and last day; the files are built in the background in small batches (overnight on weekdays, any time on weekends) and the job stops by itself. Check with Past-days build status; stop with Cancel past-days build.'],
        ['New design', 'When an update changes the template, run Day files → Rebuild the day template. New days use it; rebuild older days one at a time if you want them in the new layout.']
      ] } },
      { table: { head: ['Carried forward to each new day', 'From'], rows: [
        ['Key support / resistance levels', 'Report (previous day file)'], ['Strategy and objectives', 'Report'], ['Forward P/E', 'Report'], ['Checklist items', 'Game Plan'], ['Rules checklist', 'Trades & Journal'], ['Cycle notes', 'OPEX Cycle']
      ] } },
      { warn: 'Don\'t rename, move between folders, or delete day files by hand — the hub finds them by ID, but a deleted file is recreated empty. Use the hub\'s Day Files tab to find any day.' }
    ] }
  ];
}
