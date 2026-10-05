/*******************************************************************************
 * Core.gs  v4.0
 * SPX Daily Market Analysis — HUB foundation file
 *
 * Owns:  Settings tab, Instructions tab (hidden), custom menu, design system
 *        (colors / fonts / cell styles), NYSE market calendar & calendar flags,
 *        API key storage, Drive folders, database helpers (db_*), automatic
 *        triggers, onEdit router, test tools.
 * Every other file (MarketData, Intraday, DayFile, OPEX, Catalysts, Analytics)
 * uses the helpers in this file. Replace this whole file when an update is issued.
 ******************************************************************************/

const CORE_VERSION = '4.0';
const TZ = 'America/New_York';

// ---- Change the font for the ENTIRE system here (one line) -----------------
const FONT = 'Helvetica Neue';   // fallback if it doesn't render: 'Arial'

// ---- Design system (matches the approved mockups) -------------------------
const COLOR = {
  NAVY: '#1F2A44', SUB: '#34425E', LAB: '#EEF1F5', LABF: '#3A4250',
  WHITE: '#FFFFFF', TEXT: '#1F2328', BORDER: '#D5DAE1', GRAY: '#8A8F98',
  INP: '#FFF3D6', INPF: '#7A4B00',          // your input (amber)
  HIS: '#E3EEFB', HISF: '#0C447C',          // pulled from history (blue)
  PUR: '#ECEAFD', PURF: '#3C3489',          // calendar flag / event (purple)
  GRN: '#1B7F3B', RED: '#B42318', LINK: '#185FA5', GOLD: '#BA7517',
  OKBG: '#E7F5EC', ERRBG: '#FDECEC',
  TAB_MAIN: '#1F2A44', TAB_TOOL: '#0F6E56', TAB_CAT: '#534AB7', TAB_JOUR: '#BA7517',
  TAB_RAW: '#888780', TAB_SET: '#5F5E5A', TAB_HIDDEN: '#B4B2A9'
};

const FMT = {
  PRICE: '#,##0.00',
  PTS: '+#,##0.00;-#,##0.00;0.00',
  PTS1: '+0.0;-0.0;0.0',
  PCT: '+0.00%;-0.00%;0.00%',
  PCT0: '0%',
  NUM2: '0.00',
  MULT: '0.0"x"',
  TEXT: '@'
};

/* =============================================================================
 * MENU
 * ========================================================================== */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Market Report')
    .addItem('📂  Open today\'s day file', 'menu_openToday')
    .addItem('⟳  Refresh today\'s day file now', 'menu_refreshToday')
    .addItem('🔒  Save & Lock a day', 'menu_lockDay')
    .addItem('🔓  Unlock a day', 'menu_unlockDay')
    .addSeparator()
    .addSubMenu(ui.createMenu('Day files')
      .addItem('Build / refresh future days now', 'menu_buildFuture')
      .addItem('Build or rebuild a specific day', 'menu_rebuildDay')
      .addSeparator()
      .addItem('Build or rebuild past days (range)…', 'menu_rangeBuild')
      .addItem('Past-days build status', 'menu_rangeStatus')
      .addItem('Cancel past-days build', 'menu_rangeCancel')
      .addSeparator()
      .addItem('Rebuild the day template', 'menu_rebuildTemplate'))
    .addSubMenu(ui.createMenu('Catalysts')
      .addItem('Refresh catalysts now', 'menu_catRefresh')
      .addItem('Refresh event schedule (quick)', 'menu_catSchedule')
      .addItem('Open Fed Speakers list', 'menu_fedList')
      .addItem('Paste calendar (Trading Economics)', 'menu_pasteCal')
      .addItem('Import pasted calendar', 'menu_importCal')
      .addItem('Backfill catalysts (all captured days)', 'menu_catBackfill')
      .addItem('Load 2 years of event history', 'menu_catHistory')
      .addSeparator()
      .addItem('Open Event Lookup', 'menu_eventLookup')
      .addItem('Open Event Master (choose events)', 'menu_eventMaster')
      .addItem('Open Earnings Watchlist', 'menu_earnings')
      .addItem('Open Policy Posts', 'menu_posts'))
    .addSubMenu(ui.createMenu('Analytics')
      .addItem('Open Research', 'menu_anResearch')
      .addItem('Open Calendar Ledger', 'menu_anLedger')
      .addItem('Open Weekly Recap', 'menu_anRecap')
      .addItem('Refresh analytics now', 'menu_anRefresh'))
    .addSubMenu(ui.createMenu('Aftermath')
      .addItem('Backfill aftermath history', 'menu_afBackfill')
      .addSeparator()
      .addItem('Open Aftermath Tracker', 'menu_afTracker')
      .addItem('Open OPEX Tracker', 'menu_afOpex'))
    .addSubMenu(ui.createMenu('Macro')
      .addItem('Update macro now', 'menu_mcUpdate')
      .addItem('Backfill macro history (2 years)', 'menu_mcBackfill')
      .addItem('Backfill cross-asset minute bars', 'menu_mcXBackfill')
      .addSeparator()
      .addItem('Open Macro Radar', 'menu_mcRadar')
      .addItem('Open Yield Curve', 'menu_mcCurve')
      .addItem('Open FX & Carry', 'menu_mcFx')
      .addItem('Open Global Markets', 'menu_mcGlobal')
      .addItem('Open Commodities & Crypto', 'menu_mcCommod'))
    .addSubMenu(ui.createMenu('Market data')
      .addItem('Update market data now', 'menu_updateMarketData')
      .addItem('Backfill history', 'menu_backfill')
      .addItem('Show market data for a date', 'menu_showMarketDay')
      .addItem('Intraday capture status', 'menu_captureStatus')
      .addItem('Analyze intraday (all captured days)', 'menu_analyzeIntraday'))
    .addSeparator()
    .addSubMenu(ui.createMenu('Setup')
      .addItem('Build / rebuild ALL hub tabs', 'core_buildAll')
      .addItem('Build / rebuild Settings tab', 'core_buildSettings')
      .addItem('Set API keys', 'core_setApiKeys')
      .addItem('Check time zone, font & folders', 'core_checkEnvironment')
      .addItem('Install / refresh automatic triggers', 'core_installTriggers'))
    .addSubMenu(ui.createMenu('Tools')
      .addItem('Test Calendar (any date)', 'core_testCalendarPrompt')
      .addItem('Show next 12 OPEX cycles', 'core_showOpexCycles')
      .addItem('Show market holidays (any year)', 'core_showHolidaysPrompt'))
    .addSubMenu(ui.createMenu('Help')
      .addItem('📖  Open Instructions', 'core_openInstructions')
      .addItem('Hide Instructions', 'core_hideInstructions')
      .addItem('Rebuild Instructions', 'core_buildInstructions')
      .addItem('Recent run times', 'core_showRunTimes')
      .addItem('Test outside data sources', 'menu_catTest')
      .addItem('Test Fed bank pages', 'menu_fedBanks'))
    .addToUi();
}

// Menu routers: they call functions that other files define.
function menu_openToday()        { core_call_('df_openToday',        'Open today\'s day file'); }
function menu_refreshToday()     { core_call_('df_refreshTodayNow',  'Refresh today\'s day file'); }
function menu_lockDay()          { core_call_('df_lockDayPrompt',    'Save & Lock a day'); }
function menu_unlockDay()        { core_call_('df_unlockDayPrompt',  'Unlock a day'); }
function menu_buildFuture()      { core_call_('df_buildFutureDays',  'Build future days'); }
function menu_rebuildDay()       { core_call_('df_rebuildDayPrompt', 'Build or rebuild a day'); }
function menu_rangeBuild()        { core_call_('df_rangePrompt',      'Build past days'); }
function menu_rangeStatus()       { core_call_('df_rangeStatus',      'Past-days build status'); }
function menu_rangeCancel()       { core_call_('df_rangeCancel',      'Cancel past-days build'); }
function menu_rebuildTemplate()  { core_call_('df_rebuildTemplate',  'Rebuild the day template'); }
function menu_updateMarketData() { core_call_('md_updateAll',        'Update market data'); }
function menu_backfill()         { core_call_('md_backfill',         'Backfill history'); }
function menu_showMarketDay()    { core_call_('md_showDayPrompt',    'Show market data for a date'); }
function menu_captureStatus()    { core_call_('md_captureStatus',    'Intraday capture status'); }
function menu_analyzeIntraday()  { core_call_('in_backfill',         'Analyze intraday'); }
function menu_mcUpdate()         { core_call_('mc_updateAll',        'Update macro'); }
function menu_mcBackfill()       { core_call_('mc_backfill',         'Backfill macro history'); }
function menu_mcXBackfill()      { core_call_('mc_backfillIntraday', 'Backfill cross-asset minute bars'); }
function menu_mcRadar()          { core_call_('mc_openRadar',        'Macro Radar'); }
function menu_mcCurve()          { core_call_('mc_openCurve',        'Yield Curve'); }
function menu_mcFx()             { core_call_('mc_openFx',           'FX & Carry'); }
function menu_mcGlobal()         { core_call_('mc_openGlobal',       'Global Markets'); }
function menu_mcCommod()         { core_call_('mc_openCommod',       'Commodities & Crypto'); }
function menu_anResearch()       { core_call_('an_openResearch',     'Research'); }
function menu_anLedger()         { core_call_('an_openLedger',       'Calendar Ledger'); }
function menu_anRecap()          { core_call_('an_openRecap',        'Weekly Recap'); }
function menu_anRefresh()        { core_call_('an_refresh',          'Refresh analytics'); }
function menu_posts()            { core_call_('cat_openPosts',       'Policy Posts'); }
function menu_afBackfill()       { core_call_('af_backfill',         'Backfill aftermath'); }
function menu_afTracker()        { core_call_('af_openTracker',      'Aftermath Tracker'); }
function menu_afOpex()           { core_call_('af_openOpex',         'OPEX Tracker'); }
function menu_catSchedule()      { core_call_('cat_refreshSchedule', 'Refresh event schedule'); }
function menu_pasteCal()         { core_call_('cat_openPaste',       'Paste calendar'); }
function menu_importCal()        { core_call_('cat_importPaste',     'Import pasted calendar'); }
function menu_fedList()          { const ss = SpreadsheetApp.getActive(); let sh = ss.getSheetByName('Fed Speakers'); if (!sh && core_fnExists_('cat_fedListSpec_')) { db_ensure(cat_fedListSpec_()); sh = ss.getSheetByName('Fed Speakers'); } if (sh) ss.setActiveSheet(sh); }
function menu_fedBanks()         { core_call_('cat_testFedBanks',    'Test Fed bank pages'); }
function menu_catTest()          { core_call_('cat_testSources',     'Test event sources'); }
function menu_catRefresh()       { core_call_('cat_refreshAll',      'Refresh catalysts'); }
function menu_catHistory()        { core_call_('cat_historyBackfill', 'Load 2 years of event history'); }
function menu_catBackfill()      { core_call_('cat_backfill',        'Backfill catalysts'); }
function menu_eventLookup()      { core_call_('cat_openLookup',      'Event Lookup'); }
function menu_eventMaster()      { core_call_('cat_openMaster',      'Event Master'); }
function menu_earnings()         { core_call_('cat_openEarnings',    'Earnings Watchlist'); }

function core_call_(fnName, label) {
  if (core_fnExists_(fnName)) return globalThis[fnName]();
  SpreadsheetApp.getUi().alert(label + ' will be available in a later build stage.');
}
function core_fnExists_(n) { try { return typeof globalThis[n] === 'function'; } catch (e) { return false; } }

/** Builds every hub tab whose file has been installed. Safe to run any time. */
/**
 * Builds every hub tab whose file is installed. Tabs that already exist are only
 * checked (their data is redrawn by their own menu items and the schedule), and
 * if Google's 6-minute limit is near, the next run continues where this one stopped.
 */
function core_buildAll() {
  const t0 = Date.now(), p = PropertiesService.getScriptProperties();
  const steps = [['Folders', function () { core_rootFolder(); core_moveHubToRoot_(); }], ['Settings', core_buildSettings]]
    .concat(['md_buildTabs', 'in_buildTabs', 'df_buildTabs', 'opex_buildTabs', 'cat_buildTabs', 'mc_buildTabs', 'cv_buildTabs', 'af_buildTabs', 'an_buildTabs']
      .filter(core_fnExists_).map(function (n) { return [n, function () { globalThis[n](); }]; }))
    .concat([['Instructions', core_buildInstructions], ['Tidy', core_removeDefaultSheet_]]);
  let start = Number(p.getProperty('BUILD_NEXT') || 0);
  if (Number(p.getProperty('BUILD_AT') || 0) < Date.now() - 3600000) start = 0;        // a stale half-run older than an hour starts over
  for (let i = start; i < steps.length; i++) {
    if (i > start && Date.now() - t0 > 240000) {
      p.setProperty('BUILD_NEXT', String(i)); p.setProperty('BUILD_AT', String(Date.now()));
      core_alert('Build continues', 'Built ' + (i - start) + ' of ' + (steps.length - start) + ' parts before Google\'s time limit.\nRun Setup → Build / rebuild ALL hub tabs again to finish (it continues from "' + steps[i][0] + '").');
      return;
    }
    p.setProperty('BUILD_NEXT', String(i)); p.setProperty('BUILD_AT', String(Date.now()));
    try { steps[i][1](); } catch (e) { core_logError_('build ' + steps[i][0], e); }
  }
  p.deleteProperty('BUILD_NEXT'); p.deleteProperty('BUILD_AT');
  SpreadsheetApp.getActive().setActiveSheet(SpreadsheetApp.getActive().getSheetByName(SETTINGS_SHEET));
  core_toast('All installed hub tabs built.');
}

/* =============================================================================
 * DRIVE FOLDERS — everything lives under one main folder
 *   Daily Market Analysis /            (the hub spreadsheet lives here)
 *     2026 / 09-September /            (day files + PDFs)
 *     _Data / 2026 / 09 /              (raw intraday bars, one file per day)
 *     _Template /                      (the day-file template)
 * The folder is remembered by ID, so you can rename or move it freely.
 * ========================================================================== */
function core_rootFolder() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ROOT_FOLDER_ID');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* recreate */ } }
  const name = core_getSetting('Main folder', 'Daily Market Analysis');
  const it = DriveApp.getRootFolder().getFoldersByName(name);
  const f = it.hasNext() ? it.next() : DriveApp.getRootFolder().createFolder(name);
  props.setProperty('ROOT_FOLDER_ID', f.getId());
  return f;
}
/** Returns (creating if needed) a nested folder, e.g. core_subFolder(['_Data','2026','09']). */
function core_subFolder(path, parent) {
  let f = parent || core_rootFolder();
  path.filter(function (p) { return p !== '' && p !== null && p !== undefined; }).forEach(function (name) {
    name = String(name).trim();
    const it = f.getFoldersByName(name);
    f = it.hasNext() ? it.next() : f.createFolder(name);
  });
  return f;
}
function core_moveHubToRoot_() {
  try {
    const file = DriveApp.getFileById(SpreadsheetApp.getActive().getId());
    const root = core_rootFolder();
    const parents = file.getParents();
    while (parents.hasNext()) if (parents.next().getId() === root.getId()) return;
    file.moveTo(root);
    core_toast('Hub moved into the "' + root.getName() + '" folder.');
  } catch (e) { Logger.log('move hub: ' + e.message); }
}
/** Fills {YYYY}, {MM}, {Month}, {MM-Month}, {YYYY-MM-DD} in a pattern. */
function core_pattern(p, k) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const mm = k.slice(5, 7);
  return String(p).replace(/\{YYYY-MM-DD\}/g, k).replace(/\{YYYY\}/g, k.slice(0, 4))
    .replace(/\{MM-Month\}/g, mm + '-' + months[Number(mm) - 1]).replace(/\{MM\}/g, mm).replace(/\{Month\}/g, months[Number(mm) - 1]);
}


/* =============================================================================
 * DESIGN SYSTEM — cell style helpers used by every file
 * ========================================================================== */

/** Creates (or clears and reuses) a sheet, applies base styling. */
function ui_sheet(name, tabColor, hidden) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const all = sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns());
  all.breakApart();
  all.clear();
  all.clearDataValidations();
  sh.setRowHeights(1, sh.getMaxRows(), 21);
  sh.setHiddenGridlines(true);
  sh.setTabColor(tabColor || COLOR.TAB_MAIN);
  all.setFontFamily(FONT).setFontSize(10).setFontColor(COLOR.TEXT);
  sh.setColumnWidth(1, 16);
  if (hidden) sh.hideSheet(); else sh.showSheet();
  return sh;
}

/** Column width in "Excel characters" → pixels (matches mockup widths). */
function ui_width(sh, col, chars) { sh.setColumnWidth(col, Math.round(chars * 7 + 5)); }

/** Core styled block. Merges r1:c1 → r2:c2, applies style, writes value. */
function ui_box(sh, r1, c1, r2, c2, value, o) {
  o = o || {};
  const rg = sh.getRange(r1, c1, r2 - r1 + 1, c2 - c1 + 1);
  if (r2 > r1 || c2 > c1) rg.merge();
  rg.setBackground(o.bg || COLOR.WHITE)
    .setFontFamily(FONT)
    .setFontColor(o.fc || COLOR.TEXT)
    .setFontSize(o.size || 10)
    .setFontWeight(o.bold ? 'bold' : 'normal')
    .setFontStyle(o.italic ? 'italic' : 'normal')
    .setHorizontalAlignment(o.h || 'center')
    .setVerticalAlignment(o.v || 'middle')
    .setWrap(!!o.wrap)
    .setBorder(true, true, true, true, true, true, COLOR.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  if (o.fmt) rg.setNumberFormat(o.fmt);
  if (value !== undefined && value !== null) rg.getCell(1, 1).setValue(value);
  return rg;
}

/** Navy section header. */
function ui_header(sh, r, c1, c2, text) {
  return ui_box(sh, r, c1, r, c2, text, { bg: COLOR.NAVY, fc: COLOR.WHITE, bold: true, size: 11, h: 'left' });
}
/** Big title bar. */
function ui_title(sh, r, c1, c2, text, rows) {
  const rg = ui_box(sh, r, c1, r + (rows || 1) - 1, c2, text,
    { bg: COLOR.NAVY, fc: COLOR.WHITE, bold: true, size: 14, h: 'left' });
  sh.setRowHeight(r, 30);
  return rg;
}
/** Dark column sub-headers. cols = [[c1, c2, 'Text'], ...] */
function ui_sub(sh, r, cols) {
  cols.forEach(function (c) {
    ui_box(sh, r, c[0], r, c[1], c[2], { bg: COLOR.SUB, fc: COLOR.WHITE, bold: true, size: 9, wrap: true });
  });
}
/** Gray label cell. */
function ui_label(sh, r, c1, c2, text) {
  return ui_box(sh, r, c1, r, c2, text, { bg: COLOR.LAB, fc: COLOR.LABF, bold: true, size: 9, h: 'left' });
}
/** Automated value (white). */
function ui_auto(sh, r, c1, c2, value, o) {
  o = o || {};
  return ui_box(sh, r, c1, o.r2 || r, c2, value,
    { fmt: o.fmt, fc: o.color || COLOR.TEXT, bold: o.bold, h: o.h, wrap: o.wrap, italic: o.italic, size: o.size });
}
/** Your input (amber). */
function ui_input(sh, r, c1, c2, value, o) {
  o = o || {};
  return ui_box(sh, r, c1, o.r2 || r, c2, value,
    { bg: COLOR.INP, fc: COLOR.INPF, fmt: o.fmt, h: o.h, wrap: o.wrap || !!o.r2, v: o.r2 ? 'top' : 'middle' });
}
/** Pulled from history (blue). */
function ui_hist(sh, r, c1, c2, value, o) {
  o = o || {};
  return ui_box(sh, r, c1, o.r2 || r, c2, value,
    { bg: COLOR.HIS, fc: COLOR.HISF, fmt: o.fmt, h: o.h, bold: o.bold, wrap: o.wrap, size: o.size });
}
/** Calendar flag pill (purple). */
function ui_flag(sh, r, c1, c2, text) {
  return ui_box(sh, r, c1, r, c2, text, { bg: COLOR.PUR, fc: COLOR.PURF, bold: true, size: 9 });
}
/** Turns a range into checkboxes WITHOUT clearing the ticks already there (insertCheckboxes() resets them). */
function ui_checkbox(range) {
  range.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  return range;
}
/** Green / red for a signed number. */
function ui_pn(v) { return (Number(v) || 0) >= 0 ? COLOR.GRN : COLOR.RED; }

function core_toast(msg) { try { SpreadsheetApp.getActive().toast(msg, 'Market Report', 5); } catch (e) { /* no UI (trigger) */ } }
/** Alert when a user is present; silently skipped inside automatic triggers. */
function core_alert(title, msg) { try { SpreadsheetApp.getUi().alert(title, msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { Logger.log(title + ': ' + msg); } }

// tabs that earlier versions or one-off checks left behind; Build ALL removes them so the hub stays uncluttered
const CORE_OBSOLETE_TABS = ['Source Test', 'Calendar Paste', 'OPEX Tracker (old)', '_Scratch'];
function core_removeDefaultSheet_() {
  const ss = SpreadsheetApp.getActive();
  const s1 = ss.getSheetByName('Sheet1');
  if (s1 && ss.getSheets().length > 1 && s1.getLastRow() === 0) ss.deleteSheet(s1);
  CORE_OBSOLETE_TABS.forEach(function (n) { const sh = ss.getSheetByName(n); if (sh && ss.getSheets().length > 1) ss.deleteSheet(sh); });
}


/* =============================================================================
 * SETTINGS TAB
 * ========================================================================== */

const SETTINGS_SHEET = 'Settings';

const SETTINGS_SECTIONS = [
  ['AUTOMATION SCHEDULE (ET, weekdays)', [
    ['Morning prep', '7:00 AM'],
    ['Intraday refresh (minutes)', '30'],
    ['End-of-day run', '4:30 PM'],
    ['Nightly future-day build', '7:00 PM'],
    ['Weekly earnings refresh', 'Sunday 6:00 PM']]],
  ['DAY FILES & DRIVE', [
    ['Main folder', 'Daily Market Analysis'],
    ['Day file folders', '{YYYY} / {MM-Month}'],
    ['Day file name', '{YYYY-MM-DD} SPX Daily'],
    ['PDF file name', '{YYYY-MM-DD} SPX Daily.pdf'],
    ['Days ahead to build', '5']]],
  ['FORWARD P/E (BACKUP)', [
    ['Fwd P/E — FactSet (manual, weekly)', '']]],
  ['FED SPEAKERS & CALENDAR', [
    ['Calendar relay (GitHub raw URL)', 'https://raw.githubusercontent.com/spencergmcknight-wq/market-calendar/refs/heads/main/calendar.json'],
    ['P/E relay (GitHub raw URL)', 'https://raw.githubusercontent.com/spencergmcknight-wq/market-calendar/refs/heads/main/pe.json'],
    ['Fed Chair', 'Warsh'],
    ['FOMC voters this year', 'Jefferson, Barr, Bowman, Cook, Waller, Miran, Williams, Hammack, Paulson, Logan, Kashkari']]],
  ['INTRADAY ANALYSIS', [
    ['Major swing (SPX pts)', 'Auto'],
    ['Micro-move (SPX pts)', 'Auto'],
    ['Burst size (SPX pts)', 'Auto'],
    ['Burst window (minutes)', '5'],
    ['Catalyst match window (minutes)', '10']]],
  ['ARCHIVE & DISPLAY', [
    ['History rows shown per event', '3'],
    ['Similar days shown', '5'],
    ["Level 'test' tolerance (pts)", '3.0'],
    ['Suggested-level lookback (days)', '60']]]
];
const SPECIAL_CLOSURES_DEFAULT = [
  ['2025-01-09', 'National Day of Mourning — President Carter']
];
function core_settingLabels_() {
  const out = [];
  SETTINGS_SECTIONS.forEach(function (s) { s[1].forEach(function (x) { out.push(x[0]); }); });
  return out;
}

function core_buildSettings() {
  const saved = core_readSettingsInputs_();                    // keep what you typed
  // v2.2: the old fixed defaults become "Auto" (volatility-scaled); numbers you changed are kept
  [['Major swing (SPX pts)', '6'], ['Micro-move (SPX pts)', '3'], ['Burst size (SPX pts)', '4']].forEach(function (x) { if (saved[x[0]] === x[1]) saved[x[0]] = 'Auto'; });
  _CAL.special = {}; _CAL.fomc = null;
  SPECIAL_CLOSURES_DEFAULT.concat(saved.__specials || []).forEach(function (s) {
    const k = cal_key(s[0]); if (k) _CAL.special[k] = s[1] || 'Special closure';
  });

  const sh = ui_sheet(SETTINGS_SHEET, COLOR.TAB_SET, false);
  ui_width(sh, 2, 32); ui_width(sh, 3, 36); ui_width(sh, 4, 3); ui_width(sh, 5, 30); ui_width(sh, 6, 36);
  ui_title(sh, 2, 2, 6, 'SETTINGS');
  ui_box(sh, 3, 2, 3, 6,
    'Core.gs v' + CORE_VERSION + '  ·  Font: ' + FONT + '  ·  Time zone: ' + TZ +
    '  ·  Built ' + Utilities.formatDate(new Date(), TZ, 'MMM d, yyyy h:mm a'),
    { bg: COLOR.LAB, fc: COLOR.LABF, size: 9, h: 'left', italic: true });

  // ---- Data connections
  let r = 5;
  ui_header(sh, r, 2, 3, 'DATA CONNECTIONS (all free)');
  let folderLine = 'Not created yet — Setup → Build ALL';
  try { const id = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID'); if (id) folderLine = DriveApp.getFolderById(id).getName() + '  ✓'; } catch (e) { /* none */ }
  const conns = [
    ['Main Drive folder', folderLine],
    ['Yahoo Finance (prices, 1-min & 5-min bars)', 'No key needed  ✓'],
    ['FRED public data (2-yr yield)', 'No key needed  ✓'],
    ['FRED API key (economic releases)', core_keyStatus_('FRED_KEY')],
    ['Alpha Vantage API key (earnings)', core_keyStatus_('AV_KEY')],
    ['Treasury · Fed · news feeds', 'No key needed  ✓']
  ];
  conns.forEach(function (c, i) {
    ui_label(sh, r + 1 + i, 2, 2, c[0]);
    ui_auto(sh, r + 1 + i, 3, 3, c[1], { h: 'left', color: String(c[1]).indexOf('✓') > -1 ? COLOR.GRN : COLOR.RED });
  });
  ui_box(sh, r + 7, 2, r + 7, 3, 'Keys are stored privately in the script — Setup → Set API keys (needed from the Catalysts stage)',
    { fc: COLOR.GRAY, size: 9, italic: true, h: 'left', wrap: true });
  r += 9;

  // ---- Editable sections
  SETTINGS_SECTIONS.forEach(function (sec) {
    ui_header(sh, r, 2, 3, sec[0]);
    sec[1].forEach(function (s, i) {
      ui_label(sh, r + 1 + i, 2, 2, s[0]);
      ui_input(sh, r + 1 + i, 3, 3, null, { fmt: FMT.TEXT, h: 'left' }).setValue(saved[s[0]] !== undefined && saved[s[0]] !== '' ? saved[s[0]] : s[1]);
    });
    r += sec[1].length + 2;
  });

  // ---- FOMC decision dates (you add each year)
  ui_header(sh, r, 2, 3, 'FOMC DECISION DATES  (you add each year, YYYY-MM-DD)');
  ui_sub(sh, r + 1, [[2, 2, 'Decision date (day 2)'], [3, 3, 'Note']]);
  const thisYear = Number(Utilities.formatDate(new Date(), TZ, 'yyyy'));
  const yStart = thisYear + '-01-01';
  const fomcAll = {};
  FOMC_DEFAULT.forEach(function (d) { fomcAll[d] = ''; });
  (saved.__fomc || []).forEach(function (x) { const k = cal_key(x[0]); if (k) fomcAll[k] = x[1] || fomcAll[k] || ''; });
  const fomcMap = {}, fomcHist = {};
  Object.keys(fomcAll).forEach(function (k) { if (k >= yStart) fomcMap[k] = fomcAll[k]; else fomcHist[k] = fomcAll[k]; });
  const fomcKeys = Object.keys(fomcMap).sort();
  const fomcRows = fomcKeys.length + 3;                         // always 3 empty rows
  for (let i = 0; i < fomcRows; i++) {
    const k = fomcKeys[i];
    ui_input(sh, r + 2 + i, 2, 2, null, { fmt: FMT.TEXT }).setValue(k || '');
    ui_input(sh, r + 2 + i, 3, 3, null, { fmt: FMT.TEXT, h: 'left' })
      .setValue(k ? (fomcMap[k] || (DOW_NAMES[cal_dow(k)] + ' · statement 2:00 PM · presser 2:30 PM')) : '');
  }
  const lastFomc = fomcKeys[fomcKeys.length - 1];
  const ok = lastFomc && lastFomc > cal_add(cal_today(), 180);
  ui_box(sh, r + 2 + fomcRows, 2, r + 2 + fomcRows, 3,
    ok ? 'Scheduled through ' + cal_pretty(lastFomc) + '  ✓'
       : '⚠ FOMC dates run out ' + (lastFomc ? cal_pretty(lastFomc) : '(none)') + ' — add next year from federalreserve.gov',
    { bg: ok ? COLOR.OKBG : COLOR.ERRBG, fc: ok ? COLOR.GRN : COLOR.RED, bold: true, size: 9, h: 'left' });

  // ---- Right column: holidays (current + next year), special closures, FOMC history
  r = 5;
  [thisYear, thisYear + 1].forEach(function (yr) {
    ui_header(sh, r, 5, 6, 'MARKET HOLIDAYS & EARLY CLOSES ' + yr + '  (calculated)');
    const list = cal_yearClosures_(yr);
    list.forEach(function (h, i) {
      ui_label(sh, r + 1 + i, 5, 5, h.name);
      ui_auto(sh, r + 1 + i, 6, 6, cal_pretty(h.date), { color: h.early ? COLOR.INPF : COLOR.TEXT });
    });
    r = r + list.length + 2;
  });
  ui_header(sh, r, 5, 6, 'SPECIAL CLOSURES  (unscheduled — you add, YYYY-MM-DD)');
  ui_sub(sh, r + 1, [[5, 5, 'Date'], [6, 6, 'Reason']]);
  const specials = saved.__specials && saved.__specials.length ? saved.__specials : SPECIAL_CLOSURES_DEFAULT;
  for (let i = 0; i < 8; i++) {
    const row = specials[i] || ['', ''];
    ui_input(sh, r + 2 + i, 5, 5, null, { fmt: FMT.TEXT }).setValue(row[0]);
    ui_input(sh, r + 2 + i, 6, 6, null, { fmt: FMT.TEXT, h: 'left' }).setValue(row[1]);
  }
  r = r + 11;
  const histKeys = Object.keys(fomcHist).sort().reverse();
  ui_header(sh, r, 5, 6, 'FOMC HISTORY  (past meetings — kept permanently)');
  ui_sub(sh, r + 1, [[5, 5, 'Decision date'], [6, 6, 'Note']]);
  histKeys.forEach(function (k, i) {
    ui_hist(sh, r + 2 + i, 5, 5, null, { fmt: FMT.TEXT }).setValue(k);
    ui_hist(sh, r + 2 + i, 6, 6, null, { fmt: FMT.TEXT, h: 'left' }).setValue(fomcHist[k] || (DOW_NAMES[cal_dow(k)] + ' · statement 2:00 PM'));
  });

  _CAL.special = null; _CAL.fomc = null; _CAL.holidays = {}; _CAL.settings = null;
  core_removeDefaultSheet_();
  core_toast('Settings tab built.');
}

/** Reads a setting by its label (column B). Cached per run. */
/** Instructions: what runs by itself, what you maintain, and how often. */
function core_maintenanceInstructions() {
  return [{ title: 'Your regular maintenance (and what runs by itself)', blocks: [
    { text: 'Almost everything is automatic. This is the complete list of what, if anything, needs you — and the alerts that tell you when to look.' },
    { table: { head: ['What', 'How often', 'How'], rows: [
      ['Your notes and lock each day', 'Each trading day', 'Fill the amber cells (strategy, trades, notes, evaluation), then lock the day. Your entries are never overwritten and are saved to the hub and a PDF.'],
      ['Update Apps Script files when I send a new version', 'When there is an update', 'Replace the file(s), save, reload the hub, then Setup → Build / rebuild ALL hub tabs (it also removes leftover tabs).'],
      ['React to a red or yellow health alert', 'Only when one appears', 'Alerts show in "What matters today" (Game Plan, Report). Calendar relay not updated → open GitHub → your market-calendar repository → Actions and send a screenshot. Forward P/E stale → same, "Update forward P/E" run.'],
      ['Glance at run times', 'Occasionally (optional)', 'Help → Recent run times. Anything flagged ⚠ (over 4 minutes) should be sent to me before it becomes a timeout.'],
      ['FOMC Chair and voters', 'Nothing to do', 'Read every night from the Fed Board and written to Settings automatically; a notice appears when membership changes. You can still edit the two Settings lines by hand.'],
      ['Fed speakers and consensus', 'Nothing to do', 'Your GitHub relay refreshes the calendar every 3 hours. The Trading Economics paste (Catalysts → Paste calendar) stays as an emergency backup only.'],
      ['Forward P/E', 'Nothing to do', 'FactSet\'s weekly report, read by your GitHub relay every weekday evening. The Settings backup cell is for emergencies only.'],
      ['GitHub notices (e.g. "Node.js deprecated", "ubuntu-latest will migrate")', 'Rarely', 'Informational — the relay keeps running. Send them to me when convenient and I will update the relay files.']
    ] } },
    { table: { head: ['Runs by itself', 'When (ET)'], rows: [
      ['Morning prep', '7:00 AM trading days'], ['Intraday refresh', 'Every 30 minutes during the session'], ['End of day (3 parts)', '4:30, 4:40 and 4:50 PM'],
      ['Nightly: catalysts, macro, FOMC membership, future day files, analytics', '7:00 PM'], ['Calendar relay (GitHub)', 'Every 3 hours'], ['Forward P/E relay (GitHub)', 'Weekdays ~5:40 PM'],
      ['Past-days build / repair (when you start one)', 'Overnight and weekends, never during the session']
    ] } },
    { tip: 'Help → Test outside data sources and Help → Test Fed bank pages are diagnostic tools; they create a Source Test tab that the next Build ALL removes.' }
  ] }];
}
/** Writes one Settings value (used by the automatic FOMC-membership update). */
function core_setSetting(label, value) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SETTINGS_SHEET); if (!sh || sh.getLastRow() < 2) return false;
  const labels = sh.getRange(1, 2, sh.getLastRow(), 1).getDisplayValues();
  for (let i = 0; i < labels.length; i++) if (labels[i][0] === label) { sh.getRange(i + 1, 3).setValue(value); _CAL.settings = null; return true; }
  return false;
}
/** Nightly: the current FOMC (Chair and voting members) from federalreserve.gov/monetarypolicy/fomc.htm. */
function core_fomcMembers() {
  const res = UrlFetchApp.fetch('https://www.federalreserve.gov/monetarypolicy/fomc.htm', { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (res.getResponseCode() !== 200) return 'FOMC members: Fed Board page HTTP ' + res.getResponseCode() + ' (Settings left as they are)';
  const lines = res.getContentText().replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, '\n').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&')
    .split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(String);
  const a = lines.findIndex(function (l) { return /^(\d{4} )?(FOMC )?Members$/i.test(l); }); if (a < 0) return 'FOMC members: list not found on the page (Settings left as they are)';
  const names = [], chairs = [];
  for (let i = a + 1; i < lines.length && !/Alternate Members/i.test(lines[i]); i++) {
    const m = lines[i].match(/^([A-Z][A-Za-z.\- ]+?),\s*(Board of Governors|[A-Z][A-Za-z. ]+)(?:,\s*(.+))?$/); if (!m) continue;
    const last = m[1].trim().split(' ').pop().replace(/[.,]/g, ''); names.push(last);
    if (m[3] && /^Chair/i.test(m[3].trim()) && !/Vice/i.test(m[3])) chairs.push(last);
  }
  if (names.length < 9 || names.length > 13) return 'FOMC members: found ' + names.length + ' names — not updated (Settings left as they are)';
  const chair = chairs[0] || core_getSetting('Fed Chair', ''), voters = names.filter(function (n) { return n !== chair; }).join(', ');
  const oldC = core_getSetting('Fed Chair', ''), oldV = core_getSetting('FOMC voters this year', ''), changed = oldC !== chair || oldV !== voters;
  if (changed) {
    core_setSetting('Fed Chair', chair); core_setSetting('FOMC voters this year', voters);
    PropertiesService.getScriptProperties().setProperty('FOMC_CHANGE', JSON.stringify({ at: cal_today(), text: 'FOMC membership updated from the Fed Board: Chair ' + chair + ' · voters ' + voters }));
  }
  return '✓ FOMC members: Chair ' + chair + ' · ' + names.length + ' voters' + (changed ? ' (Settings updated)' : ' (unchanged)');
}
function core_getSetting(label, fallback) {
  if (!_CAL.settings) {
    _CAL.settings = {};
    const sh = SpreadsheetApp.getActive().getSheetByName(SETTINGS_SHEET);
    if (sh && sh.getLastRow() > 1) {
      sh.getRange(1, 2, sh.getLastRow(), 2).getDisplayValues().forEach(function (v) { if (v[0]) _CAL.settings[v[0]] = v[1]; });
    }
  }
  const v = _CAL.settings[label];
  return v === undefined || v === '' ? fallback : v;
}
function core_getSettingNum(label, fallback) { const n = Number(core_getSetting(label, fallback)); return isFinite(n) ? n : fallback; }

function core_readSettingsInputs_() {
  const out = { __specials: [], __fomc: [] };
  const sh = SpreadsheetApp.getActive().getSheetByName(SETTINGS_SHEET);
  if (!sh || sh.getLastRow() < 2) return out;
  const vals = sh.getRange(1, 1, sh.getLastRow(), 6).getDisplayValues();
  const labels = core_settingLabels_();
  let inSpecial = false, inFomc = false, inHist = false;
  vals.forEach(function (row) {
    if (String(row[1]).indexOf('FOMC DECISION DATES') === 0) { inFomc = true; return; }
    if (inFomc && row[1] && row[1] !== 'Decision date (day 2)' && cal_key(row[1])) out.__fomc.push([row[1], row[2]]);
    if (labels.indexOf(row[1]) > -1) out[row[1]] = row[2];
    const e = String(row[4]);
    if (e.indexOf('FOMC HISTORY') === 0) { inSpecial = false; inHist = true; return; }
    if (e.indexOf('SPECIAL CLOSURES') === 0) { inSpecial = true; inHist = false; return; }
    if (inHist && cal_key(row[4])) out.__fomc.push([row[4], row[5]]);
    if (inSpecial && row[4] && row[4] !== 'Date') out.__specials.push([row[4], row[5]]);
  });
  return out;
}


/* =============================================================================
 * API KEYS (stored in Script Properties — never in a cell)
 * ========================================================================== */

function core_setApiKeys() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  [['FRED_KEY', 'FRED API key'], ['AV_KEY', 'Alpha Vantage API key']].forEach(function (k) {
    const res = ui.prompt('Set ' + k[1],
      'Paste your ' + k[1] + '. Leave blank to keep the current one.\nCurrent: ' + core_keyStatus_(k[0]),
      ui.ButtonSet.OK_CANCEL);
    if (res.getSelectedButton() === ui.Button.OK && res.getResponseText().trim()) {
      props.setProperty(k[0], res.getResponseText().trim());
    }
  });
  core_buildSettings();
}

function core_getKey(name) { return PropertiesService.getScriptProperties().getProperty(name) || ''; }

function core_keyStatus_(name) {
  const k = core_getKey(name);
  return k ? '••••••••••••' + k.slice(-4) + '  ✓ stored securely' : 'Not set — Setup → Set API keys';
}

/* =============================================================================
 * ENVIRONMENT CHECK
 * ========================================================================== */

function core_checkEnvironment() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);
  const scriptTz = Session.getScriptTimeZone();
  let folder = '(not created yet — run Setup → Build / rebuild ALL hub tabs)';
  try { const id = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID'); if (id) folder = DriveApp.getFolderById(id).getName() + '  ✓'; } catch (e) { /* none */ }
  const msg = [
    'Spreadsheet time zone: ' + ss.getSpreadsheetTimeZone() + '  ✓ (set automatically)',
    'Script time zone: ' + scriptTz + (scriptTz === TZ ? '  ✓' :
      '  ✗  → In the Apps Script editor: Project Settings (gear) → Time zone → (GMT-05:00) Eastern Time'),
    'Main Drive folder: ' + folder,
    '',
    'Font in use: ' + FONT,
    'If the Settings tab text looks like Helvetica Neue, you are set. If it looks generic,',
    'change the FONT line at the top of Core.gs to \'Arial\'.'
  ].join('\n');
  SpreadsheetApp.getUi().alert('Environment check', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

/* =============================================================================
 * MARKET CALENDAR ENGINE
 * All dates are handled as 'YYYY-MM-DD' keys in UTC math, so time zones and
 * daylight-saving changes can never shift a date.
 * ========================================================================== */

const _CAL = { holidays: {}, early: {}, special: null, fomc: null, settings: null };

// FOMC decision dates (day 2 of each meeting). Source: federalreserve.gov
// These are the built-in defaults. You add future years on the Settings tab.
const FOMC_DEFAULT = [
  '2024-01-31', '2024-03-20', '2024-05-01', '2024-06-12', '2024-07-31', '2024-09-18', '2024-11-07', '2024-12-18',
  '2025-01-29', '2025-03-19', '2025-05-07', '2025-06-18', '2025-07-30', '2025-09-17', '2025-10-29', '2025-12-10',
  '2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17', '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-09',
  '2027-01-27', '2027-03-17', '2027-04-28', '2027-06-09', '2027-07-28', '2027-09-15', '2027-10-27', '2027-12-08',
  '2028-01-26'
];
// Minutes normally release 21 days after the decision; exceptions listed here.
const FOMC_MINUTES_OVERRIDE = { '2025-12-10': '2025-12-30' };

/** All FOMC decision dates: built-in defaults + anything on the Settings tab. */
function cal_fomcDecisions() {
  if (_CAL.fomc) return _CAL.fomc;
  const set = {};
  FOMC_DEFAULT.forEach(function (d) { set[d] = true; });
  try {
    (core_readSettingsInputs_().__fomc || []).forEach(function (r) { const k = cal_key(r[0]); if (k) set[k] = true; });
  } catch (e) { /* Settings not built yet */ }
  _CAL.fomc = Object.keys(set).sort();
  return _CAL.fomc;
}

// ---- Date primitives
function cal_ymd(y, m, d) { return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10); }
function cal_parse(k) { const p = String(k).split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
function cal_dow(k) { return cal_parse(k).getUTCDay(); }               // 0 Sun … 6 Sat
function cal_add(k, n) { const d = cal_parse(k); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function cal_y(k) { return Number(k.slice(0, 4)); }
function cal_m(k) { return Number(k.slice(5, 7)); }
function cal_d(k) { return Number(k.slice(8, 10)); }
function cal_today() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
/** Converts a Date object or 'MM/DD/YYYY' or 'YYYY-MM-DD' to a key. */
function cal_key(x) {
  if (x instanceof Date) return Utilities.formatDate(x, TZ, 'yyyy-MM-dd');
  const s = String(x).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return cal_ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return cal_ymd(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
  return null;
}
const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 'Mon, Sep 21, 2026' */
function cal_pretty(k) { return DOW_NAMES[cal_dow(k)] + ', ' + MON_NAMES[cal_m(k) - 1] + ' ' + cal_d(k) + ', ' + cal_y(k); }
/** 'Sep 21' */
function cal_short(k) { return MON_NAMES[cal_m(k) - 1] + ' ' + cal_d(k); }

function cal_nthWeekday(y, m, dow, n) {
  const first = cal_ymd(y, m, 1);
  return cal_add(first, ((dow - cal_dow(first) + 7) % 7) + (n - 1) * 7);
}
function cal_lastWeekday(y, m, dow) {
  const last = cal_ymd(y, m + 1, 0);
  return cal_add(last, -((cal_dow(last) - dow + 7) % 7));
}
function cal_easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
    f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return cal_ymd(y, Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1);
}
function cal_observed_(k) { const w = cal_dow(k); return w === 6 ? cal_add(k, -1) : (w === 0 ? cal_add(k, 1) : k); }

// ---- Holidays & early closes
function cal_holidays(y) {
  if (_CAL.holidays[y]) return _CAL.holidays[y];
  const h = {};
  const ny = cal_ymd(y, 1, 1);
  if (cal_dow(ny) === 0) h[cal_add(ny, 1)] = "New Year's Day (obs.)";
  else if (cal_dow(ny) !== 6) h[ny] = "New Year's Day";          // Saturday: NYSE does not observe
  h[cal_nthWeekday(y, 1, 1, 3)] = 'Martin Luther King Jr. Day';
  h[cal_nthWeekday(y, 2, 1, 3)] = "Presidents' Day";
  h[cal_add(cal_easter(y), -2)] = 'Good Friday';
  h[cal_lastWeekday(y, 5, 1)] = 'Memorial Day';
  if (y >= 2022) { const j = cal_ymd(y, 6, 19); h[cal_observed_(j)] = 'Juneteenth' + (cal_observed_(j) !== j ? ' (obs.)' : ''); }
  const i4 = cal_ymd(y, 7, 4); h[cal_observed_(i4)] = 'Independence Day' + (cal_observed_(i4) !== i4 ? ' (obs.)' : '');
  h[cal_nthWeekday(y, 9, 1, 1)] = 'Labor Day';
  h[cal_nthWeekday(y, 11, 4, 4)] = 'Thanksgiving Day';
  const x = cal_ymd(y, 12, 25); h[cal_observed_(x)] = 'Christmas Day' + (cal_observed_(x) !== x ? ' (obs.)' : '');
  _CAL.holidays[y] = h;
  return h;
}
function cal_specialClosures() {
  if (_CAL.special) return _CAL.special;
  const out = {};
  SPECIAL_CLOSURES_DEFAULT.forEach(function (s) { out[s[0]] = s[1]; });
  try {
    const saved = core_readSettingsInputs_();
    (saved.__specials || []).forEach(function (s) { const k = cal_key(s[0]); if (k) out[k] = s[1] || 'Special closure'; });
  } catch (e) { /* Settings not built yet */ }
  _CAL.special = out;
  return out;
}
function cal_earlyCloses(y) {
  if (_CAL.early[y]) return _CAL.early[y];
  const e = {};
  const j3 = cal_ymd(y, 7, 3);
  if (cal_dow(j3) >= 1 && cal_dow(j3) <= 4) e[j3] = 'Early close 1:00 PM (Independence Day eve)';
  e[cal_add(cal_nthWeekday(y, 11, 4, 4), 1)] = 'Early close 1:00 PM (day after Thanksgiving)';
  const c24 = cal_ymd(y, 12, 24);
  if (cal_dow(c24) >= 1 && cal_dow(c24) <= 4) e[c24] = 'Early close 1:00 PM (Christmas Eve)';
  _CAL.early[y] = e;
  return e;
}
/** Returns the reason a date is closed, or '' if it's a trading day. */
function cal_closedReason(k) {
  const w = cal_dow(k);
  if (w === 0 || w === 6) return 'Weekend';
  const h = cal_holidays(cal_y(k))[k]; if (h) return h;
  const s = cal_specialClosures()[k]; if (s) return s;
  return '';
}
function cal_isTradingDay(k) { return cal_closedReason(k) === ''; }
function cal_nextTradingDay(k) { let d = cal_add(k, 1); while (!cal_isTradingDay(d)) d = cal_add(d, 1); return d; }
function cal_prevTradingDay(k) { let d = cal_add(k, -1); while (!cal_isTradingDay(d)) d = cal_add(d, -1); return d; }
function cal_firstTradingDayOfMonth(y, m) { let d = cal_ymd(y, m, 1); while (!cal_isTradingDay(d)) d = cal_add(d, 1); return d; }
function cal_lastTradingDayOfMonth(y, m) { let d = cal_ymd(y, m + 1, 0); while (!cal_isTradingDay(d)) d = cal_add(d, -1); return d; }
/** List of trading days between two keys, inclusive. */
function cal_tradingDays(fromK, toK) {
  const out = []; let d = fromK;
  while (d <= toK) { if (cal_isTradingDay(d)) out.push(d); d = cal_add(d, 1); }
  return out;
}

/** Holidays + early closes for a year, sorted, for display. */
function cal_yearClosures_(y) {
  const h = cal_holidays(y), e = cal_earlyCloses(y), out = [];
  Object.keys(h).forEach(function (k) { if (cal_y(k) === y) out.push({ date: k, name: h[k], early: false }); });
  Object.keys(e).forEach(function (k) { out.push({ date: k, name: e[k].replace(/ \(.*\)/, '') + ' — ' + (e[k].match(/\((.*)\)/) || ['', ''])[1], early: true }); });
  const s = cal_specialClosures();
  Object.keys(s).forEach(function (k) { if (cal_y(k) === y) out.push({ date: k, name: s[k], early: false }); });
  return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
}

// ---- Options expiration
/** Monthly OPEX for a month: 3rd Friday, or the prior trading day if a holiday. */
function cal_opex(y, m) {
  const std = cal_nthWeekday(y, m, 5, 3);
  const date = cal_isTradingDay(std) ? std : cal_prevTradingDay(std);
  const quarterly = m % 3 === 0;
  return {
    date: date, standard: std, shifted: date !== std, quarterly: quarterly,
    type: quarterly ? 'Quarterly (quad witching)' : 'Monthly',
    nextDay: cal_nextTradingDay(date),
    thursdayBefore: cal_prevTradingDay(date)
  };
}
/** The OPEX on or after date k. */
function cal_nextOpex(k) {
  let o = cal_opex(cal_y(k), cal_m(k));
  if (o.date < k) { const n = cal_ymd(cal_y(k), cal_m(k) + 1, 1); o = cal_opex(cal_y(n), cal_m(n)); }
  return o;
}
/** The most recent OPEX strictly before date k. */
function cal_prevOpex(k) {
  let o = cal_opex(cal_y(k), cal_m(k));
  if (o.date >= k) { const p = cal_ymd(cal_y(k), cal_m(k), 0); o = cal_opex(cal_y(p), cal_m(p)); }
  return o;
}
/** VIX expiration in month m: Wednesday 30 days before the next month's 3rd Friday. */
function cal_vixExp(y, m) {
  const n = cal_ymd(y, m + 1, 1);
  let f = cal_nthWeekday(cal_y(n), cal_m(n), 5, 3);
  if (!cal_isTradingDay(f)) f = cal_prevTradingDay(f);
  let v = cal_add(f, -30);
  if (!cal_isTradingDay(v)) v = cal_prevTradingDay(v);
  return v;
}

// ---- FOMC
function cal_fomcInfo_(k) {
  const list = cal_fomcDecisions(), res = [], seen = {};
  const push = function (a) { if (!seen[a[0]]) { seen[a[0]] = true; res.push(a); } };
  for (let i = 0; i < list.length; i++) {
    const dec = list[i];
    const gap = (cal_parse(dec) - cal_parse(k)) / 86400000;
    if (gap > 30 || gap < -30) continue;                    // only nearby meetings matter
    const day1 = cal_add(dec, -1);
    const minutes = FOMC_MINUTES_OVERRIDE[dec] || cal_add(dec, 21);
    const sat = cal_add(day1, -((cal_dow(day1) + 1) % 7 || 7)); // Saturday before day 1
    const blackoutStart = cal_add(sat, -7), blackoutEnd = cal_add(dec, 1);
    const weekMon = cal_add(dec, -((cal_dow(dec) + 6) % 7)), weekFri = cal_add(weekMon, 4);
    if (k === dec) push(['FOMC_DECISION', 'FOMC DECISION · 2:00 PM · Presser 2:30 PM', 'Fed']);
    if (k === day1) push(['FOMC_DAY1', 'FOMC MEETING DAY 1', 'Fed']);
    if (k === cal_nextTradingDay(dec)) push(['FOMC_DAY_AFTER', 'DAY AFTER FOMC', 'Fed']);
    if (k === minutes) push(['FOMC_MINUTES', 'FOMC MINUTES · 2:00 PM', 'Fed']);
    if (k >= weekMon && k <= weekFri && k !== dec) push(['FOMC_WEEK', 'FOMC WEEK · Wed 2:00 PM', 'Fed']);
    if (k >= blackoutStart && k <= blackoutEnd) push(['FED_BLACKOUT', 'FED BLACKOUT PERIOD', 'Fed']);
  }
  return res;
}
function cal_nextFomc(k) {
  const list = cal_fomcDecisions();
  for (let i = 0; i < list.length; i++) if (list[i] >= k) return list[i];
  return null;
}

/* =============================================================================
 * CALENDAR FLAGS — the single function every other file calls
 * Returns { date, isTradingDay, closedReason, flags:[{code,label,category}], meta:{...} }
 * ========================================================================== */
function cal_getFlags(k) {
  k = cal_key(k);
  const y = cal_y(k), m = cal_m(k);
  const out = { date: k, pretty: cal_pretty(k), isTradingDay: cal_isTradingDay(k), closedReason: cal_closedReason(k), flags: [], meta: {} };
  const add = function (code, label, cat) { out.flags.push({ code: code, label: label, category: cat }); };

  // Early close
  const ec = cal_earlyCloses(y)[k];
  if (ec) add('EARLY_CLOSE', ec.toUpperCase(), 'Holiday');

  if (out.isTradingDay) {
    // OPEX
    const op = cal_opex(y, m);
    if (k === op.date) add(op.quarterly ? 'QUAD_WITCHING' : 'MONTHLY_OPEX',
      (op.quarterly ? 'QUAD WITCHING (QUARTERLY OPEX)' : 'MONTHLY OPEX') + (op.shifted ? ' · THURSDAY (HOLIDAY SHIFT)' : ''), 'Expiration');
    if (k === op.thursdayBefore) add('DAY_BEFORE_OPEX', 'DAY BEFORE OPEX', 'Expiration');
    const po = cal_prevOpex(k);
    if (k === po.nextDay) add(po.quarterly ? 'DAY_AFTER_QUAD' : 'DAY_AFTER_OPEX',
      (DOW_NAMES[cal_dow(k)] === 'Mon' ? 'MON' : DOW_NAMES[cal_dow(k)].toUpperCase()) + ' AFTER ' + (po.quarterly ? 'QUAD WITCHING' : 'OPEX'), 'Expiration');
    const opMon = cal_add(op.standard, -4);
    if (k >= opMon && k <= op.date && k !== op.date) add('OPEX_WEEK', 'OPEX WEEK', 'Expiration');
    if (k === op.date && op.quarterly) add('SP_REBALANCE', 'S&P REBALANCE (AFTER CLOSE)', 'Index');
    if (k === cal_vixExp(y, m)) add('VIX_EXP', 'VIX EXPIRATION · AM SETTLE', 'Expiration');

    // Month / quarter / year boundaries
    const ftd = cal_firstTradingDayOfMonth(y, m), ltd = cal_lastTradingDayOfMonth(y, m);
    if (k === ftd) {
      if (m === 1) add('FIRST_DAY_YEAR', 'FIRST TRADING DAY OF YEAR', 'Calendar');
      else if ((m - 1) % 3 === 0) add('FIRST_DAY_QTR', 'FIRST TRADING DAY OF Q' + ((m - 1) / 3 + 1), 'Calendar');
      else add('FIRST_DAY_MONTH', 'FIRST TRADING DAY OF MONTH', 'Calendar');
    }
    if (k === ltd) {
      if (m === 12) add('LAST_DAY_YEAR', 'LAST TRADING DAY OF YEAR', 'Calendar');
      else if (m % 3 === 0) add('LAST_DAY_QTR', 'LAST TRADING DAY OF Q' + (m / 3), 'Calendar');
      else add('LAST_DAY_MONTH', 'LAST TRADING DAY OF MONTH', 'Calendar');
    }
    const monthDays = cal_tradingDays(cal_ymd(y, m, 1), cal_ymd(y, m + 1, 0));
    const idx = monthDays.indexOf(k);
    if (idx < 3 || idx >= monthDays.length - 3) add('TURN_OF_MONTH', 'TURN-OF-MONTH WINDOW', 'Calendar');

    // Holiday adjacency
    const nxt = cal_nextTradingDay(k), prv = cal_prevTradingDay(k);
    for (let d = cal_add(k, 1); d < nxt; d = cal_add(d, 1)) {
      const r = cal_closedReason(d); if (r && r !== 'Weekend') { add('PRE_HOLIDAY', 'DAY BEFORE ' + r.toUpperCase(), 'Holiday'); break; }
    }
    for (let d = cal_add(prv, 1); d < k; d = cal_add(d, 1)) {
      const r = cal_closedReason(d); if (r && r !== 'Weekend') { add('POST_HOLIDAY', 'DAY AFTER ' + r.toUpperCase(), 'Holiday'); break; }
    }

    // FOMC
    cal_fomcInfo_(k).forEach(function (f) { add(f[0], f[1], f[2]); });

    // Meta
    const yearDays = cal_tradingDays(cal_ymd(y, 1, 1), cal_ymd(y, 12, 31));
    out.meta.tradingDayOfYear = yearDays.indexOf(k) + 1;
    out.meta.tradingDaysInYear = yearDays.length;
    out.meta.tradingDayOfMonth = idx + 1;
    out.meta.tradingDaysInMonth = monthDays.length;
  }

  const no = cal_nextOpex(out.isTradingDay ? cal_add(k, 1) : k);
  out.meta.nextOpex = no.date;
  out.meta.nextOpexType = no.type;
  out.meta.calendarDaysToOpex = Math.round((cal_parse(no.date) - cal_parse(k)) / 86400000);
  out.meta.tradingDaysToOpex = cal_tradingDays(cal_add(k, 1), no.date).length;
  out.meta.prevOpex = cal_prevOpex(out.isTradingDay ? k : cal_add(k, 1)).date;
  out.meta.nextFomc = cal_nextFomc(k);
  out.meta.weekOfMonth = Math.ceil(cal_d(k) / 7);
  return out;
}

/* =============================================================================
 * TEST TOOLS
 * ========================================================================== */

function core_testCalendarPrompt() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Test Calendar', 'Enter a date (MM/DD/YYYY):', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const k = cal_key(res.getResponseText());
  if (!k) { ui.alert('Could not read that date. Use MM/DD/YYYY.'); return; }
  const f = cal_getFlags(k);
  const lines = [f.pretty, ''];
  if (!f.isTradingDay) lines.push('MARKET CLOSED — ' + f.closedReason, '');
  else {
    lines.push('Trading day ' + f.meta.tradingDayOfYear + ' of ' + f.meta.tradingDaysInYear +
      '  ·  Day ' + f.meta.tradingDayOfMonth + ' of ' + f.meta.tradingDaysInMonth + ' this month', '');
    lines.push('FLAGS:');
    if (!f.flags.length) lines.push('  (none)');
    f.flags.forEach(function (x) { lines.push('  • ' + x.label + '   [' + x.category + ']'); });
    lines.push('');
  }
  lines.push('Next OPEX: ' + cal_pretty(f.meta.nextOpex) + '  (' + f.meta.nextOpexType + ')  ·  ' +
    f.meta.calendarDaysToOpex + ' calendar / ' + f.meta.tradingDaysToOpex + ' trading days');
  lines.push('Previous OPEX: ' + cal_pretty(f.meta.prevOpex));
  if (f.meta.nextFomc) lines.push('Next FOMC decision: ' + cal_pretty(f.meta.nextFomc));
  ui.alert('Calendar test', lines.join('\n'), ui.ButtonSet.OK);
}

function core_showOpexCycles() {
  const t = cal_today();
  let y = cal_y(t), m = cal_m(t);
  const lines = [];
  for (let i = 0; i < 12; i++) {
    const o = cal_opex(y, m);
    lines.push(cal_pretty(o.date) + '  —  ' + o.type + (o.shifted ? '  (holiday shift)' : '') +
      '\n      Day before: ' + cal_short(o.thursdayBefore) + '   ·   Next trading day: ' + cal_pretty(o.nextDay) +
      '   ·   VIX exp: ' + cal_short(cal_vixExp(y, m)));
    m++; if (m > 12) { m = 1; y++; }
  }
  SpreadsheetApp.getUi().alert('Next 12 OPEX cycles', lines.join('\n\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

function core_showHolidaysPrompt() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Market holidays', 'Enter a year (e.g. 2027):', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const y = Number(res.getResponseText().trim());
  if (!(y > 1990 && y < 2100)) { ui.alert('Enter a 4-digit year.'); return; }
  const lines = cal_yearClosures_(y).map(function (h) { return cal_pretty(h.date) + '   ' + h.name; });
  ui.alert('NYSE closures & early closes ' + y, lines.join('\n'), ui.ButtonSet.OK);
}


/* =============================================================================
 * INSTRUCTIONS TAB (hidden)
 * Core writes the sections below. Each other file adds its own sections by
 * defining: md_instructions, in_instructions, df_instructions,
 * opex_instructions, cat_instructions, an_instructions.
 * Section format: { title: 'X', blocks: [ {text:'...'}, {steps:['..','..']},
 *                   {table:{head:['A','B'], rows:[['..','..']]}}, {tip:'..'}, {warn:'..'} ] }
 * ========================================================================== */

const INSTRUCTIONS_SHEET = 'Instructions';

const BUILD_FILES = [
  ['Core.gs',       'Stage 1', 'core_buildSettings', 'Settings, Instructions, menu, calendar, Drive folders, triggers'],
  ['MarketData.gs', 'Stage 1', 'md_buildTabs',       'Daily prices & indicators; 1-min and 5-min bars for SPX, SPY, /ES'],
  ['Intraday.gs',   'Stage 2', 'in_buildTabs',       'Swings, bursts, maps, statistics, cross-reference'],
  ['DayFile.gs',    'Stage 3', 'df_buildTabs',       'Day template, daily files, future days, locking, PDFs'],
  ['Aftermath.gs',  'Stage 4', 'af_buildTabs',       'Day 0 / Day +1 for every catalyst, Aftermath Tracker, OPEX Tracker'],
  ['Catalysts.gs',  'Stage 5', 'cat_buildTabs',      'Economic events, earnings, headlines, Event Lookup'],
  ['Macro.gs',      'Stage 5b', 'mc_buildTabs',      'Rates, yield curve, FX & carry, global, commodities, crypto, stress meters'],
  ['Curve.gs',      'Stage 5c', 'cv_buildTabs',      'Yield-curve health: recession-risk gauge, inversion tracker, cycle clock, alerts'],
  ['Analytics.gs',  'Stage 6', 'an_buildTabs',       'Research, similar days, archive index, recaps']
];


function core_openInstructions() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(INSTRUCTIONS_SHEET);
  if (!sh) { core_buildInstructions(); sh = ss.getSheetByName(INSTRUCTIONS_SHEET); }
  sh.showSheet();
  ss.setActiveSheet(sh);
}

function core_hideInstructions() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(INSTRUCTIONS_SHEET);
  if (!sh) return;
  const other = ss.getSheets().filter(function (s) { return s.getName() !== INSTRUCTIONS_SHEET && !s.isSheetHidden(); })[0];
  if (other) ss.setActiveSheet(other);
  sh.hideSheet();
}

function core_buildInstructions() {
  const ss = SpreadsheetApp.getActive();
  const wasOpen = ss.getSheetByName(INSTRUCTIONS_SHEET) && !ss.getSheetByName(INSTRUCTIONS_SHEET).isSheetHidden();
  const sh = ui_sheet(INSTRUCTIONS_SHEET, COLOR.TAB_HIDDEN, false);
  ui_width(sh, 2, 16); for (let c = 3; c <= 8; c++) ui_width(sh, c, 17);

  let sections = core_instructionSections_();
  ['md_instructions', 'in_instructions', 'df_instructions', 'opex_instructions', 'core_maintenanceInstructions', 'cat_instructions', 'mc_instructions', 'cv_instructions', 'af_instructions', 'an_instructions'].forEach(function (n) {
    if (core_fnExists_(n)) { try { sections = sections.concat(globalThis[n]()); } catch (e) { /* skip */ } }
  });
  sections = sections.concat(core_instructionTail_());

  ui_title(sh, 2, 2, 8, 'INSTRUCTIONS  —  how every part of this workbook works');
  ui_box(sh, 3, 2, 3, 8, 'Updated ' + Utilities.formatDate(new Date(), TZ, 'MMM d, yyyy h:mm a') +
    '  ·  Open / hide from Market Report → Help  ·  Click a section below to jump to it',
    { bg: COLOR.LAB, fc: COLOR.LABF, size: 9, italic: true, h: 'left' });

  // Table of contents (links filled in after we know row numbers)
  ui_header(sh, 5, 2, 8, 'CONTENTS');
  const tocStart = 6;
  let r = tocStart + sections.length + 1;
  const gid = sh.getSheetId();
  const anchors = [];

  sections.forEach(function (sec, si) {
    r++;
    anchors.push(r);
    ui_header(sh, r, 2, 8, (si + 1) + '.  ' + sec.title.toUpperCase());
    r++;
    (sec.blocks || []).forEach(function (b) {
      if (b.text) { r = core_instrText_(sh, r, b.text, {}); }
      if (b.tip)  { r = core_instrText_(sh, r, '💡  ' + b.tip,  { bg: COLOR.HIS, fc: COLOR.HISF }); }
      if (b.warn) { r = core_instrText_(sh, r, '⚠  ' + b.warn, { bg: COLOR.INP, fc: COLOR.INPF }); }
      if (b.steps) {
        b.steps.forEach(function (s, i) {
          ui_label(sh, r, 2, 2, 'Step ' + (i + 1));
          ui_auto(sh, r, 3, 8, s, { h: 'left', wrap: true });
          sh.setRowHeight(r, core_rowH_(s, 100));
          r++;
        });
      }
      if (b.table) {
        const cols = b.table.head.length;
        const spans = cols === 2 ? [[2, 3], [4, 8]] : cols === 3 ? [[2, 3], [4, 5], [6, 8]] : [[2, 2], [3, 4], [5, 6], [7, 8]];
        ui_sub(sh, r, spans.map(function (s, i) { return [s[0], s[1], b.table.head[i]]; }));
        r++;
        b.table.rows.forEach(function (row) {
          let maxH = 21;
          row.forEach(function (v, i) {
            const sp = spans[i];
            if (i === 0) ui_label(sh, r, sp[0], sp[1], v).setWrap(true);
            else ui_auto(sh, r, sp[0], sp[1], v, { h: 'left', wrap: true, color: String(v).indexOf('✗') > -1 ? COLOR.RED : (String(v).indexOf('✓') > -1 ? COLOR.GRN : COLOR.TEXT) });
            maxH = Math.max(maxH, core_rowH_(String(v), (sp[1] - sp[0] + 1) * 17));
          });
          sh.setRowHeight(r, maxH);
          r++;
        });
      }
    });
  });

  // Fill in the table of contents with jump links
  sections.forEach(function (sec, i) {
    const cell = ui_box(sh, tocStart + i, 2, tocStart + i, 8, null, { h: 'left', fc: COLOR.LINK });
    cell.setFormula('=HYPERLINK("#gid=' + gid + '&range=B' + anchors[i] + '","' + (i + 1) + '.  ' + sec.title.replace(/"/g, "'") + '")');
  });

  sh.setFrozenRows(3);
  if (!wasOpen) core_hideInstructions();
  core_toast('Instructions updated.');
}

function core_rowH_(text, widthChars) {
  const lines = String(text).split('\n').reduce(function (n, ln) { return n + Math.max(1, Math.ceil(ln.length / (widthChars * 0.95))); }, 0);
  return Math.max(21, lines * 15 + 8);
}
function core_instrText_(sh, r, text, o) {
  ui_box(sh, r, 2, r, 8, text, { bg: o.bg || COLOR.WHITE, fc: o.fc || COLOR.TEXT, h: 'left', wrap: true, v: 'top' });
  sh.setRowHeight(r, core_rowH_(text, 115));
  return r + 1;
}


/* ---------- Core's own sections ---------- */
function core_instructionSections_() {
  const status = BUILD_FILES.map(function (f) {
    return [f[0], f[1] + ' — ' + f[3], core_fnExists_(f[2]) ? 'Installed ✓' : 'Not installed yet'];
  });
  return [
    { title: 'How the system is organized', blocks: [
      { text: 'The system has three parts, all inside one Google Drive folder (Daily Market Analysis by default). The HUB is this spreadsheet: settings, instructions, the research databases, and the automation. DAY FILES are one Google Sheet per trading day — your daily workspace — created automatically days in advance. The DATA LAKE (_Data folder) holds the raw 1-minute and 5-minute bars, one small file per day, so the hub and day files stay fast for years.' },
      { table: { head: ['Part', 'What it is', 'You use it for'], rows: [
        ['Hub (this file)', 'Settings, Instructions, databases (hidden tabs), research tabs as they are added', 'Setup, research across many days, locking days'],
        ['Day files', 'One Google Sheet per trading day with every tab from the approved mockup', 'Planning ahead, taking notes during the day, reviewing any day'],
        ['▶ Today shortcut', 'A shortcut at the top of the main folder that always points to the current day file', 'Opening today in one click'],
        ['_Data folder', 'Raw bars for SPX, SPY and /ES — one file per day', 'Nothing — the scripts read it for you'],
        ['_Template folder', 'The master day-file template', 'Nothing — rebuilt by the script']
      ] } },
      { table: { head: ['Cell color', 'Meaning'], rows: [
        ['White', 'Automated — filled by the script. Don\'t type here; it will be overwritten.'],
        ['Amber', 'Your input — the script never overwrites these.'],
        ['Blue', 'Pulled from history (past releases, similar days, your old notes).'],
        ['Purple', 'Calendar flag, event, or headline.'],
        ['Navy / dark gray', 'Section headers and column headers.']
      ] } }
    ] },
    { title: 'Build status (detected automatically)', blocks: [
      { table: { head: ['File', 'Contents', 'Status'], rows: status } },
      { tip: 'Refreshes whenever the Instructions tab is rebuilt (Market Report → Help → Rebuild Instructions).' }
    ] },
    { title: 'Installing or updating a script file', blocks: [
      { text: 'There is one script file per area, so a change to one area never requires re-pasting the others. When an update is issued, replace only that one file — always the entire file.' },
      { steps: [
        'In the hub spreadsheet, open Extensions → Apps Script.',
        'New file: click the + next to "Files" → Script, and type the exact name without ".gs" (for example: MarketData). Updating a file: click the existing file in the list.',
        'Click inside the editor, press Ctrl+A (Cmd+A on Mac) to select everything, and delete it.',
        'Paste the full new file contents.',
        'Click Save (or Ctrl+S / Cmd+S). Wait for "Saved" — no red error bar should appear.',
        'Return to the spreadsheet tab and reload the browser page so the menu refreshes.',
        'Run Market Report → Setup → Build / rebuild ALL hub tabs. Safe any time: your amber inputs and all databases are preserved.',
        'Run Market Report → Setup → Install / refresh automatic triggers so any new automation starts.',
        'If Google asks for authorization: Continue → your account → Advanced → Go to project (unsafe) → Allow. "Unsafe" only means the script is yours and not reviewed by Google.'
      ] },
      { tip: 'Each file shows its version on line 2 (e.g. "Core.gs v2.0"). The Settings subtitle also shows the Core version.' },
      { warn: 'Never rename or delete a script file unless instructed — other files call functions inside it.' }
    ] },
    { title: 'The Market Report menu', blocks: [
      { table: { head: ['Menu item', 'What it does', 'Available'], rows: [
        ['📂 Open today\'s day file', 'Opens the current trading day\'s file (creates it if needed).', 'Stage 3'],
        ['⟳ Refresh today\'s day file now', 'Pulls the latest data into today\'s file without waiting for the schedule.', 'Stage 3'],
        ['🔒 Save & Lock a day / 🔓 Unlock', 'Collects your inputs into the hub, finalizes the day file, saves a PDF.', 'Stage 3'],
        ['Day files → Build / refresh future days', 'Makes sure the next N trading days exist (Settings: Days ahead).', 'Stage 3'],
        ['Day files → Build or rebuild a specific day', 'Creates any past or future day, or rebuilds one in the latest design (your notes are kept).', 'Stage 3'],
        ['Macro → Update macro now / Backfill macro history', 'Cross-asset data, stress meters and the five macro tabs (backfill loads 2 years).', 'Stage 5b'],
        ['Macro → Open …', 'Macro Radar, Yield Curve, FX & Carry, Global Markets, Commodities & Crypto.', 'Stage 5b'],
        ['Catalysts → Refresh catalysts now', 'Schedule 45 days ahead, new actuals, headlines, earnings.', 'Stage 5'],
        ['Catalysts → Load 2 years of event history', 'Release dates, actuals and previous values back two years for every tracked FRED release (run again until it says done). Fills Event Lookup and every day file\'s Last 3 releases.', 'Stage 5'],
        ['Catalysts → Backfill catalysts', 'Schedule, actuals, earnings history and minute reactions for every captured day.', 'Stage 5'],
        ['Catalysts → Event Lookup / Event Master / Earnings Watchlist / Policy Posts', 'Opens those hub tabs.', 'Stage 5'],
        ['Analytics → Research / Calendar Ledger / Weekly Recap', 'Opens those hub tabs (Similar Days is in every day file).', 'Stage 6'],
        ['Setup → Build / rebuild ALL hub tabs (large systems)', 'If it reports "Build continues", run it once more — it picks up where it stopped.', 'Now'],
        ['Aftermath → Backfill aftermath history', 'Measures Day 0 and Day +1 for every FOMC, CPI, PCE, jobs report, earnings, OPEX, VIX spike, 10Y breakout and big post (10 years).', 'Stage 4'],
        ['Aftermath → Open Aftermath Tracker / OPEX Tracker', 'Opens those hub tabs.', 'Stage 4'],
        ['Market data → Update market data now', 'Daily prices, indicators and the latest intraday bars.', 'Stage 1'],
        ['Market data → Backfill history', '10 years of daily prices, ~60 days of 5-min bars, ~4 weeks of 1-min bars.', 'Stage 1'],
        ['Market data → Show market data for a date', 'Every stored price and indicator for a date, plus intraday capture counts.', 'Stage 1'],
        ['Market data → Intraday capture status', 'Which days have 1-min / 5-min bars saved for SPX, SPY and /ES.', 'Stage 1'],
        ['Market data → Analyze intraday (all captured days)', 'Runs the swing / burst / map analysis on every captured day (after installing or changing swing sizes).', 'Stage 2'],
        ['Setup → Build / rebuild ALL hub tabs', 'Builds every installed tab, creates the Drive folders, moves the hub into the main folder.', 'Now'],
        ['Setup → Set API keys', 'Stores FRED and Alpha Vantage keys privately.', 'Now'],
        ['Setup → Check time zone, font & folders', 'Confirms Eastern time and shows the main folder.', 'Now'],
        ['Setup → Install / refresh automatic triggers', 'Schedules the automatic runs. Re-run after installing each new file.', 'Now'],
        ['Tools → Test Calendar / OPEX cycles / holidays', 'Calendar checks for any date or year.', 'Now'],
        ['Help → Open / Hide / Rebuild Instructions', 'This tab.', 'Now']
      ] } },
      { tip: 'Custom menus don\'t appear in the Google Sheets phone app. Day files are designed so you can read and type in them on the phone; the scheduled runs keep them updated.' }
    ] },
    { title: 'Settings tab', blocks: [
      { table: { head: ['Section', 'What you can do'], rows: [
        ['Data connections', 'Shows the main folder and whether each free source is ready. Keys are set from the menu.'],
        ['Automation schedule', 'Times for the automatic runs (Eastern time). After changing, run Setup → Install / refresh automatic triggers.'],
        ['Day files & Drive', 'Main folder name, sub-folder and file-name patterns ({YYYY}, {MM-Month}, {YYYY-MM-DD}), and how many trading days ahead to build.'],
        ['Intraday analysis', 'Swing, micro-move and burst sizes ("Auto" scales them to volatility; or type a number), and how close in time an event must be to be matched to a move.'],
        ['Archive & display', 'How many history rows and similar days to show, level test tolerance, suggested-level lookback.'],
        ['FOMC decision dates', 'The Fed\'s schedule. The list always keeps 3 empty rows; past years move to FOMC HISTORY and are kept permanently.'],
        ['Holidays & early closes', 'Calculated for this year and next — nothing to enter.'],
        ['Special closures', 'Any unscheduled market closure (YYYY-MM-DD + reason).']
      ] } },
      { tip: 'All times in the system are Eastern (ET) — the zone every market time is published in. In Boise (Mountain), subtract 2 hours.' }
    ] },
    { title: 'API keys — when and how', blocks: [
      { text: 'Two free keys are used from the Catalysts stage onward. Neither requires a credit card. Stages 1–3 need no keys.' },
      { table: { head: ['Key', 'Used for', 'Needed from'], rows: [
        ['FRED (St. Louis Fed)', 'Release dates and actual values for CPI, PPI, jobs, claims, housing, GDP, PCE, Michigan sentiment and more', 'Catalysts stage'],
        ['Alpha Vantage', 'Earnings dates, EPS estimates and results for your top-10 list', 'Catalysts stage']
      ] } },
      { text: 'FRED key:' },
      { steps: ['Go to fred.stlouisfed.org → My Account (top right) → Create New Account; confirm your email.', 'Signed in, open My Account → API Keys → Request API Key. Describe the use ("Personal market research spreadsheet"), accept, submit.', 'Copy the 32-character key.'] },
      { text: 'Alpha Vantage key:' },
      { steps: ['Go to alphavantage.co → "Get free API key".', 'Fill in the short form and submit.', 'Copy the key shown.'] },
      { text: 'Entering the keys:' },
      { steps: ['Market Report → Setup → Set API keys.', 'Paste the FRED key → OK, then the Alpha Vantage key → OK (blank keeps an existing key).', 'Settings shows each key as "••••1234 ✓ stored securely".'] }
    ] },
    { title: 'Market calendar & calendar flags', blocks: [
      { text: 'The calendar is calculated from rules, so it works for any year automatically. Every day is tagged with these flags; they appear as purple pills and are searchable.' },
      { table: { head: ['Flag', 'Rule'], rows: [
        ['Monthly OPEX', '3rd Friday; if a market holiday, the prior trading day.'],
        ['Quad witching', 'The OPEX in March, June, September, December (+ S&P quarterly rebalance after the close).'],
        ['Day before / day after OPEX', 'Trading day before expiration; next trading day after (Tuesday when Monday is a holiday).'],
        ['OPEX week', 'Monday through expiration day.'],
        ['VIX expiration', 'Wednesday 30 days before the next month\'s 3rd Friday (holiday-adjusted), AM-settled.'],
        ['First / last trading day', 'Of the month, quarter and year.'],
        ['Turn-of-month window', 'Last 3 and first 3 trading days of each month.'],
        ['Day before / after holiday', 'Trading days either side of a weekday market holiday.'],
        ['Early close 1:00 PM', 'July 3 (Mon–Thu), day after Thanksgiving, Christmas Eve (Mon–Thu).'],
        ['FOMC day 1 / decision / day after / week / minutes / blackout', 'From the FOMC dates on Settings.']
      ] } },
      { tip: 'Day files show only the flags that matter on the day: first / last trading day of the month, quarter and year, OPEX / quad witching and the first trading day after, FOMC decision / day after / minutes, VIX expiration and early closes. Turn-of-month window, OPEX week, day before OPEX, FOMC week, Fed blackout and the days around holidays are hidden there but still used by Research and the Calendar Ledger.' }
    ] },
    { title: 'Automatic triggers (the schedule that runs by itself)', blocks: [
      { text: 'Triggers run even when nothing is open. Each run checks the market calendar first and skips weekends and holidays (except the nightly build, which keeps future days ready).' },
      { table: { head: ['Trigger', 'When (ET)', 'What it does'], rows: [
        ['End of day (3 parts)', 'End-of-day run time (default 4:30 PM), then +10 and +20 minutes', 'Part 1: final prices, bars and macro. Part 2: final actuals, reactions for events and headlines, intraday analysis, aftermath. Part 3: finalizes today\'s day file and saves your inputs to the hub. Help → Recent run times shows how long each step took.'],
        ['Morning prep', 'Morning prep time (default 7:00 AM)', 'Prepares today\'s day file with overnight /ES and pre-market (Stage 3).'],
        ['Intraday refresh', 'Hourly 4:00–9:00 AM, then every 30 minutes to 4:15 PM', 'Bars, new actuals, headlines, reactions, analysis, and a light refresh of today\'s day file (the tabs that change during the session).'],
        ['Nightly build', 'Nightly future-day build time (default 7:00 PM)', 'Event schedule 45 days ahead, earnings calendar (weekly), then creates / refreshes the next N trading days.']
      ] } },
      { steps: ['Run Market Report → Setup → Install / refresh automatic triggers.', 'Approve any authorization prompt.', 'The message lists what is installed. Re-run after every new file or schedule change.', 'To see them: Extensions → Apps Script → clock icon (Triggers).'] }
    ] },
    { title: 'New year checklist', blocks: [
      { table: { head: ['Item', 'Automatic?', 'What you do'], rows: [
        ['Holidays & early closes', 'Yes ✓', 'Nothing.'],
        ['OPEX, VIX expiration, month/quarter/year flags', 'Yes ✓', 'Nothing.'],
        ['FOMC meeting dates', 'No ✗', 'Add next year\'s 8 decision dates on Settings when the Fed publishes them (usually by late summer).'],
        ['Special closures', 'No ✗', 'Only if an unscheduled closure is announced.'],
        ['Earnings watchlist', 'No ✗', 'Each quarter, check your top-10 tickers (Catalysts stage).']
      ] } },
      { warn: 'If the FOMC list runs within 6 months of its last date, its status line on Settings turns red.' }
    ] },
    { title: 'Test tools', blocks: [
      { table: { head: ['Good test date', 'You should see'], rows: [
        ['06/18/2026', 'Quad witching moved to Thursday (Juneteenth), S&P rebalance, day after FOMC'],
        ['01/19/2027', 'TUE after OPEX (MLK Day on Monday)'],
        ['04/17/2025', 'OPEX moved to Thursday (Good Friday)'],
        ['11/28/2025', 'Early close, last trading day of month']
      ] } }
    ] }
  ];
}

function core_instructionTail_() {
  return [
    { title: 'Troubleshooting', blocks: [
      { table: { head: ['Problem', 'Fix'], rows: [
        ['The Market Report menu is missing', 'Reload the browser tab and wait 5–10 seconds. If still missing, open Extensions → Apps Script and confirm every file saved without errors.'],
        ['"Authorization required"', 'Run any menu item: Continue → your account → Advanced → Go to project → Allow. Needed again when a new file adds new permissions.'],
        ['"… will be available in a later build stage"', 'That file isn\'t installed yet — see Build status.'],
        ['Dates look off by a day', 'Market Report → Setup → Check time zone, font & folders.'],
        ['Font looks generic', 'Change the FONT line near the top of Core.gs to \'Arial\', save, then Build / rebuild ALL hub tabs.'],
        ['Red error bar in the Apps Script editor', 'The paste was incomplete. Select all, delete, paste the entire file again, save.'],
        ['A tab looks broken after an update', 'Market Report → Setup → Build / rebuild ALL hub tabs.']
      ] } }
    ] }
  ];
}


/* =============================================================================
 * onEdit ROUTER — Google allows only one onEdit function per project.
 * Core handles Settings; other files may add md_onEdit, df_onEdit, etc.
 * ========================================================================== */
function onEdit(e) {
  try { core_onEditSettings_(e); } catch (err) { /* ignore */ }
  ['md_onEdit', 'in_onEdit', 'df_onEdit', 'opex_onEdit', 'cat_onEdit', 'mc_onEdit', 'af_onEdit', 'an_onEdit'].forEach(function (n) {
    if (core_fnExists_(n)) { try { globalThis[n](e); } catch (err) { /* ignore */ } }
  });
}

/** Keeps 3 empty rows in the FOMC list and refreshes its status line as you type. */
function core_onEditSettings_(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() !== SETTINGS_SHEET) return;
  const col = e.range.getColumn();
  if (col < 2 || col > 3) return;
  const vals = sh.getRange(1, 2, sh.getLastRow(), 1).getDisplayValues().map(function (r) { return r[0]; });
  const h = vals.findIndex(function (v) { return v.indexOf('FOMC DECISION DATES') === 0; });
  if (h < 0) return;
  const first = h + 3;                                       // 1-based first data row
  let status = -1;
  for (let i = h + 2; i < vals.length; i++) if (/^(Scheduled through|⚠ FOMC)/.test(vals[i])) { status = i + 1; break; }
  if (status < 0) return;
  const r = e.range.getRow();
  if (r < first || r >= status) return;

  // Fill the note automatically when you type a valid date
  if (col === 2) {
    const k = cal_key(e.range.getDisplayValue());
    const note = sh.getRange(r, 3);
    if (k && !note.getDisplayValue()) note.setValue(DOW_NAMES[cal_dow(k)] + ' · statement 2:00 PM · presser 2:30 PM');
  }

  // Keep 3 empty rows
  const dates = sh.getRange(first, 2, status - first, 1).getDisplayValues().map(function (x) { return x[0]; });
  const empty = dates.filter(function (v) { return !v; }).length;
  if (empty < 3) {
    const add = 3 - empty;
    sh.getRange(status, 2, add, 2).insertCells(SpreadsheetApp.Dimension.ROWS);
    for (let i = 0; i < add; i++) {
      ui_input(sh, status + i, 2, 2, null, { fmt: FMT.TEXT });
      ui_input(sh, status + i, 3, 3, null, { fmt: FMT.TEXT, h: 'left' });
    }
    status += add;
  }

  // Refresh the status line
  const keys = sh.getRange(first, 2, status - first, 1).getDisplayValues()
    .map(function (x) { return cal_key(x[0]); }).filter(function (k) { return k; }).sort();
  const last = keys[keys.length - 1];
  const ok = last && last > cal_add(cal_today(), 180);
  ui_box(sh, status, 2, status, 3,
    ok ? 'Scheduled through ' + cal_pretty(last) + '  ✓'
       : '⚠ FOMC dates run out ' + (last ? cal_pretty(last) : '(none)') + ' — add next year from federalreserve.gov',
    { bg: ok ? COLOR.OKBG : COLOR.ERRBG, fc: ok ? COLOR.GRN : COLOR.RED, bold: true, size: 9, h: 'left' });
}

/* =============================================================================
 * DATABASE HELPERS — used by every hidden database tab
 * Layout: title row 2, subtitle row 3, machine keys row 4 (hidden),
 *         column headers row 5, data from row 6, first column B.
 * A spec looks like:
 *   { name: '_Prices', title: '...', subtitle: '...', hidden: true,
 *     cols: [ ['date','Date',12,'@','auto'], ['spx_c','SPX close',11,'#,##0.00','auto'], ... ] }
 * kind: 'auto' (white) | 'input' (amber) | 'hist' (blue)
 * If a later update adds or reorders columns, existing data is moved to match.
 * ========================================================================== */
const DB = { KEY_ROW: 4, HEAD_ROW: 5, DATA_ROW: 6, COL: 2 };

function db_sheet_(spec) { return SpreadsheetApp.getActive().getSheetByName(spec.name); }

function db_keys_(sh) {
  if (!sh || sh.getLastRow() < DB.KEY_ROW) return [];
  const n = Math.max(1, sh.getLastColumn() - DB.COL + 1);
  return sh.getRange(DB.KEY_ROW, DB.COL, 1, n).getValues()[0].filter(function (k) { return k !== ''; });
}

/** Creates or updates a database tab. Never loses data. */
function db_ensure(spec) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(spec.name);
  const keys = spec.cols.map(function (c) { return c[0]; });
  let migrate = null;
  if (sh) {
    const old = db_keys_(sh);
    if (old.length && old.join('|') !== keys.join('|') && sh.getLastRow() >= DB.DATA_ROW) migrate = db_readAll(spec, old);
  } else {
    sh = ss.insertSheet(spec.name);
  }
  const need = DB.COL + keys.length;
  if (sh.getMaxColumns() < need) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());

  // Header area
  sh.setFrozenColumns(0);
  const head = sh.getRange(1, 1, DB.HEAD_ROW, sh.getMaxColumns());
  head.breakApart(); head.clear();
  sh.setHiddenGridlines(true);
  sh.setTabColor(spec.tab || COLOR.TAB_HIDDEN);
  sh.setColumnWidth(1, 16);
  const lastCol = DB.COL + keys.length - 1;
  const sub = spec.subtitle + (spec.hidden ? '   ·   Hidden tab — managed by the script' : '');
  if (spec.freezeCols) {
    // Frozen columns can't cut through merged cells, so draw the title bands without merging
    sh.getRange(2, DB.COL, 1, keys.length).setBackground(COLOR.NAVY);
    sh.getRange(2, DB.COL).setValue(spec.title).setFontFamily(FONT).setFontSize(14).setFontWeight('bold')
      .setFontColor(COLOR.WHITE).setHorizontalAlignment('left').setVerticalAlignment('middle').setWrap(false);
    sh.setRowHeight(2, 30);
    sh.getRange(3, DB.COL, 1, keys.length).setBackground(COLOR.LAB);
    sh.getRange(3, DB.COL).setValue(sub).setFontFamily(FONT).setFontSize(9).setFontStyle('italic')
      .setFontColor(COLOR.LABF).setHorizontalAlignment('left').setWrap(false);
  } else {
    ui_title(sh, 2, DB.COL, lastCol, spec.title);
    ui_box(sh, 3, DB.COL, 3, lastCol, sub, { bg: COLOR.LAB, fc: COLOR.LABF, size: 9, italic: true, h: 'left' });
  }
  sh.getRange(DB.KEY_ROW, DB.COL, 1, keys.length).setValues([keys]).setFontSize(8).setFontColor(COLOR.GRAY);
  spec.cols.forEach(function (c, i) {
    ui_box(sh, DB.HEAD_ROW, DB.COL + i, DB.HEAD_ROW, DB.COL + i, c[1], { bg: COLOR.SUB, fc: COLOR.WHITE, bold: true, size: 9, wrap: true });
    ui_width(sh, DB.COL + i, c[2] || 11);
  });
  sh.setRowHeight(DB.HEAD_ROW, 32);
  sh.hideRows(DB.KEY_ROW);
  sh.setFrozenRows(DB.HEAD_ROW);
  if (spec.freezeCols) sh.setFrozenColumns(DB.COL - 1 + spec.freezeCols);

  if (migrate) {
    const lr = sh.getLastRow();
    if (lr >= DB.DATA_ROW) sh.getRange(DB.DATA_ROW, 1, lr - DB.DATA_ROW + 1, sh.getMaxColumns()).clear();
    db_writeAll(spec, migrate.rows);
  }
  if (spec.hidden) { try { sh.hideSheet(); } catch (e) { /* only visible sheet */ } } else sh.showSheet();
  return sh;
}

/** Reads every data row as objects keyed by column key. */
function db_readAll(spec, keysOverride) {
  const sh = db_sheet_(spec);
  if (!sh) return { keys: [], rows: [] };
  const keys = keysOverride || db_keys_(sh);
  const lr = sh.getLastRow();
  if (lr < DB.DATA_ROW || !keys.length) return { keys: keys, rows: [] };
  const vals = sh.getRange(DB.DATA_ROW, DB.COL, lr - DB.DATA_ROW + 1, keys.length).getValues();
  const rows = [];
  vals.forEach(function (v) {
    if (v.every(function (x) { return x === ''; })) return;
    const o = {};
    keys.forEach(function (k, i) { o[k] = v[i]; });
    rows.push(o);
  });
  return { keys: keys, rows: rows };
}

/** Replaces all data rows. */
function db_writeAll(spec, rows) {
  const sh = db_sheet_(spec) || db_ensure(spec);
  const lr = sh.getLastRow();
  if (lr >= DB.DATA_ROW) sh.getRange(DB.DATA_ROW, DB.COL, lr - DB.DATA_ROW + 1, spec.cols.length).clearContent();
  db_writeRows_(sh, spec, DB.DATA_ROW, rows);
}

/** Appends rows after the last data row. */
function db_append(spec, rows) {
  const sh = db_sheet_(spec) || db_ensure(spec);
  db_writeRows_(sh, spec, Math.max(sh.getLastRow() + 1, DB.DATA_ROW), rows);
}

/** Deletes every data row from sheet row `fromRow` to the end. */
function db_deleteFrom(spec, fromRow) {
  const sh = db_sheet_(spec);
  const lr = sh.getLastRow();
  if (fromRow < DB.DATA_ROW || fromRow > lr) return;
  sh.getRange(fromRow, DB.COL, lr - fromRow + 1, spec.cols.length).clearContent();
}

function db_writeRows_(sh, spec, start, rows) {
  if (!rows.length) return;
  const n = rows.length, w = spec.cols.length;
  const needRows = start + n - 1;
  if (sh.getMaxRows() < needRows) sh.insertRowsAfter(sh.getMaxRows(), needRows - sh.getMaxRows() + 50);
  // Formats first, so dates and times stay as text
  spec.cols.forEach(function (c, i) {
    const rg = sh.getRange(start, DB.COL + i, n, 1);
    rg.setNumberFormat(c[3] || 'General');
    if (c[4] === 'input') rg.setBackground(COLOR.INP).setFontColor(COLOR.INPF);
    else if (c[4] === 'hist') rg.setBackground(COLOR.HIS).setFontColor(COLOR.HISF);
    else rg.setBackground(COLOR.WHITE).setFontColor(COLOR.TEXT);
  });
  const data = rows.map(function (o) {
    return spec.cols.map(function (c) { const v = o[c[0]]; return (v === undefined || v === null || (typeof v === 'number' && !isFinite(v))) ? '' : v; });
  });
  const rg = sh.getRange(start, DB.COL, n, w);
  rg.setValues(data)
    .setFontFamily(FONT).setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, COLOR.BORDER, SpreadsheetApp.BorderStyle.SOLID);
}


/* =============================================================================
 * AUTOMATIC TRIGGERS
 * Each trigger calls whatever installed files provide; missing stages are skipped.
 * ========================================================================== */
const TRIGGER_HANDLERS = ['trig_endOfDay', 'trig_eodAnalysis', 'trig_eodFinalize', 'trig_morning', 'trig_intraday', 'trig_nightly'];

function core_installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (TRIGGER_HANDLERS.indexOf(t.getHandlerFunction()) > -1) ScriptApp.deleteTrigger(t);
  });
  _CAL.settings = null;
  const done = [];
  const eodS = core_getSetting('End-of-day run', '4:30 PM'), eod = core_parseTime_(eodS, 16, 30);
  // the end of day runs in three parts, 10 minutes apart, so each stays well inside Google's 6-minute limit
  const plus = function (t, m) { const x = t.h * 60 + t.m + m; return { h: Math.floor(x / 60) % 24, m: x % 60 }; }, e2 = plus(eod, 10), e3 = plus(eod, 20);
  ScriptApp.newTrigger('trig_endOfDay').timeBased().everyDays(1).atHour(eod.h).nearMinute(eod.m).inTimezone(TZ).create();
  ScriptApp.newTrigger('trig_eodAnalysis').timeBased().everyDays(1).atHour(e2.h).nearMinute(e2.m).inTimezone(TZ).create();
  ScriptApp.newTrigger('trig_eodFinalize').timeBased().everyDays(1).atHour(e3.h).nearMinute(e3.m).inTimezone(TZ).create();
  done.push('End of day — three runs around ' + eodS + ' (prices & macro), +10 min (catalysts, analysis, reactions, aftermath) and +20 min (finalize the day file, save your inputs); weekends & holidays skipped');
  if (core_fnExists_('df_morningPrep')) {
    const s = core_getSetting('Morning prep', '7:00 AM'), t = core_parseTime_(s, 7, 0);
    ScriptApp.newTrigger('trig_morning').timeBased().everyDays(1).atHour(t.h).nearMinute(t.m).inTimezone(TZ).create();
    done.push('Morning prep — daily around ' + s + ' ET');
  }
  if (core_fnExists_('df_intradayRefresh') || core_fnExists_('md_refreshToday')) {
    const every = core_getSettingNum('Intraday refresh (minutes)', 30);
    const n = [5, 10, 15, 30].indexOf(every) > -1 ? every : 30;
    ScriptApp.newTrigger('trig_intraday').timeBased().everyMinutes(n).create();
    done.push('Intraday refresh — every ' + n + ' minutes, 4:00 AM – 4:15 PM ET on trading days');
  }
  if (core_fnExists_('df_buildFutureDays')) {
    const s = core_getSetting('Nightly future-day build', '7:00 PM'), t = core_parseTime_(s, 19, 0);
    ScriptApp.newTrigger('trig_nightly').timeBased().everyDays(1).atHour(t.h).nearMinute(t.m).inTimezone(TZ).create();
    done.push('Nightly build — daily around ' + s + ' ET (keeps future day files ready)');
  }
  core_alert('Automatic triggers installed', done.map(function (d) { return '✓ ' + d; }).join('\n') +
    '\n\nRe-run this after installing each new file or changing times on Settings.');
}

function core_parseTime_(s, dh, dm) {
  const m = String(s || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return { h: dh, m: dm };
  let h = Number(m[1]); const min = Number(m[2]);
  if (m[3] && m[3].toUpperCase() === 'PM' && h < 12) h += 12;
  if (m[3] && m[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return { h: h, m: min };
}

function core_run_(name, arg) {
  if (!core_fnExists_(name)) return;
  const t0 = Date.now();
  try { globalThis[name](arg); } catch (e) { Logger.log(name + ' failed: ' + e.message); core_logError_(name, e); }
  try {                                                                       // run times, so a step creeping toward the limit is visible
    const p = PropertiesService.getScriptProperties(), list = JSON.parse(p.getProperty('RUNTIMES') || '[]');
    list.unshift([Utilities.formatDate(new Date(), TZ, 'MM-dd HH:mm'), name, Math.round((Date.now() - t0) / 1000)]);
    p.setProperty('RUNTIMES', JSON.stringify(list.slice(0, 40)));
  } catch (x) { /* ignore */ }
}
function core_logError_(where, e) {
  try {
    const p = PropertiesService.getScriptProperties();
    const list = JSON.parse(p.getProperty('ERRORS') || '[]');
    list.unshift({ t: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), where: where, msg: String(e && e.message || e) });
    p.setProperty('ERRORS', JSON.stringify(list.slice(0, 20)));
  } catch (x) { /* ignore */ }
}

function trig_endOfDay() {                                                    // part 1: prices and macro
  const k = cal_today();
  if (!cal_isTradingDay(k)) return;
  core_run_('md_updateAll', true);
  core_run_('mc_updateAll', true);
}
function trig_eodAnalysis() {                                                 // part 2: catalysts, analysis, reactions, aftermath
  const k = cal_today();
  if (!cal_isTradingDay(k)) return;
  core_run_('mc_captureIntraday', true);
  core_run_('cat_refreshToday', k);
  core_run_('in_processDay', k);
  core_run_('cat_updateReactions', k);
  core_run_('af_endOfDay', k);
}
function trig_eodFinalize() {                                                 // part 3: finalize the day file, save your inputs
  const k = cal_today();
  if (!cal_isTradingDay(k)) return;
  core_run_('df_endOfDay', k);
}
/** Help → Recent run times: how long each automatic step took (Google stops any run at 6 minutes). */
function core_showRunTimes() {
  const list = JSON.parse(PropertiesService.getScriptProperties().getProperty('RUNTIMES') || '[]');
  core_alert('Recent run times', list.length ? list.map(function (x) { return x[0] + '   ' + x[1] + '   ' + x[2] + ' s' + (x[2] > 240 ? '   ⚠ close to the limit' : ''); }).join('\n') : 'No automatic runs recorded yet.');
}
function trig_morning() {
  const k = cal_today();
  if (!cal_isTradingDay(k)) return;
  core_run_('md_refreshToday', true);
  core_run_('mc_updateAll', true);
  core_run_('cat_refreshToday', k);
  core_run_('df_morningPrep', k);
}
function trig_intraday() {
  const k = cal_today();
  if (!cal_isTradingDay(k)) return;
  const t = Utilities.formatDate(new Date(), TZ, 'HH:mm');
  if (t < '04:00' || t > '16:15') return;
  if (t < '09:00' && Number(t.slice(3)) >= 30) return;             // hourly before 9:00, every 30 min after
  core_run_('md_refreshToday', true);
  core_run_('cat_refreshToday', k);
  if (t >= '09:30') core_run_('mc_captureIntraday', true);
  core_run_('in_processDay', k);
  if (t >= '09:35') core_run_('cat_updateReactions', k);
  core_run_('df_intradayRefresh', k);
}
function trig_nightly() {
  core_run_('cat_nightly', true);
  core_run_('mc_nightly', true);
  core_run_('core_fomcMembers', true);
  core_run_('df_buildFutureDays', true);
  core_run_('an_nightly', true);
}
