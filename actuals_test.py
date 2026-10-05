"""
Test run (started by hand from GitHub -> Actions -> "Test actual-result sources").

Question it answers: which free sources can give the hub the ACTUAL results of the
releases that are not on FRED (ISM, S&P Global PMIs, Chicago PMI, Conference Board,
ADP, EIA crude) - and which of them also show NEXT week's calendar.

It only reads public pages and writes actuals_test.json. Nothing in the hub changes.
Every request has a time limit (30 s plain, 60 s in the browser), so nothing can hang,
and one source failing never stops the others.
"""
import json, re, time, html, datetime, urllib.request, urllib.error

OUT = "actuals_test.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
HEAD = {"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/json,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"}
BOT = re.compile(r"just a moment|cf-chl|challenge-platform|captcha|verify you are human|access denied|are you a robot|datadome|px-captcha|request unsuccessful", re.I)
T_START = time.time()
BUDGET = 14 * 60                                    # stop starting new tests after 14 minutes (the job allows 20)

# the releases the hub types by hand today, and how each source names them
TARGETS = [
    ("ISM Services PMI", r"ISM (Services|Non-?Manufacturing)"),
    ("ISM Manufacturing PMI", r"ISM Manufacturing"),
    ("S&P Global Services PMI (final)", r"^(?!.*ISM).*(Final )?Services PMI|S&P Global (US )?Services PMI"),
    ("S&P Global Composite PMI (final)", r"^(?!.*ISM).*Composite PMI"),
    ("S&P Global Manufacturing PMI (final)", r"^(?!.*ISM)(?!.*Chicago).*(Final )?Manufacturing PMI|S&P Global (US )?Manufacturing PMI"),
    ("Chicago PMI", r"Chicago PMI|Chicago Business Barometer"),
    ("Conference Board consumer confidence", r"CB Consumer Confidence|Conference Board|^Consumer Confidence"),
    ("ADP employment (monthly)", r"ADP (Non-?Farm|National|Employment Change)"),
    ("ADP employment (weekly)", r"ADP Weekly"),
    ("EIA crude inventories", r"Crude Oil (Inventories|Stocks)|EIA Crude"),
]


def now_utc():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get(url, timeout=30):
    """Plain download: (HTTP status, text, seconds). Never raises for an HTTP error status."""
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers=HEAD)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace"), round(time.time() - t0, 1)
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8", "replace")
        except Exception:
            body = ""
        return e.code, body, round(time.time() - t0, 1)


def plain_text(h):
    h = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", h or "")
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h))).strip()


def title_of(h):
    m = re.search(r"(?is)<title[^>]*>(.*?)</title>", h or "")
    return re.sub(r"\s+", " ", html.unescape(m.group(1))).strip()[:90] if m else ""


def snippets(text, pattern, n=4, width=150):
    out = []
    for m in re.finditer(pattern, text, re.I):
        a, b = max(0, m.start() - 40), min(len(text), m.end() + width)
        out.append(text[a:b])
        if len(out) >= n:
            break
    return out


class Browser:
    """One headless Chromium for every browser test; if it cannot start, browser tests report that and plain tests still run."""
    def __init__(self):
        self.ok, self.err, self.pw, self.b = False, "", None, None

    def __enter__(self):
        try:
            from playwright.sync_api import sync_playwright
            self.pw = sync_playwright().start()
            self.b = self.pw.chromium.launch(args=["--disable-blink-features=AutomationControlled"])
            self.ok = True
        except Exception as e:
            self.err = "browser did not start: " + str(e)[:150]
        return self

    def get(self, url, wait=None):
        if not self.ok:
            raise RuntimeError(self.err)
        t0 = time.time()
        ctx = self.b.new_context(user_agent=UA, locale="en-US", timezone_id="America/New_York", viewport={"width": 1366, "height": 900})
        try:
            page = ctx.new_page()
            resp = page.goto(url, timeout=60000, wait_until="domcontentloaded")
            status = resp.status if resp else 0
            if wait:
                try:
                    page.wait_for_selector(wait, timeout=25000)
                except Exception:
                    pass
            else:
                page.wait_for_timeout(5000)
            return status, page.content(), round(time.time() - t0, 1)
        finally:
            ctx.close()

    def __exit__(self, *a):
        try:
            if self.b:
                self.b.close()
            if self.pw:
                self.pw.stop()
        except Exception:
            pass


# ---------------------------------------------------------------- calendar pages (rows with actual / previous / forecast)
def parse_ff(h):
    """ForexFactory calendar page -> U.S. rows."""
    from bs4 import BeautifulSoup
    soup, rows, day, tm = BeautifulSoup(h, "html.parser"), [], "", ""
    for tr in soup.select("tr.calendar__row"):
        g = lambda c: (tr.select_one(c).get_text(" ", strip=True) if tr.select_one(c) else "")
        d, t = g(".calendar__date"), g(".calendar__time")
        day, tm = (d or day), (t or tm)
        cur, ev = g(".calendar__currency"), (g(".calendar__event-title") or g(".calendar__event"))
        if cur == "USD" and ev:
            rows.append({"day": day, "time": tm, "event": ev, "actual": g(".calendar__actual"),
                         "forecast": g(".calendar__forecast"), "previous": g(".calendar__previous")})
    return rows


def parse_te(h):
    """Trading Economics calendar page -> rows (the U.S. page lists only U.S. events)."""
    from bs4 import BeautifulSoup
    soup, rows, day = BeautifulSoup(h, "html.parser"), [], ""
    table = soup.select_one("#calendar") or soup
    for el in table.find_all(["thead", "tr"]):
        if el.name == "thead":
            th = el.find("th")
            if th:
                day = th.get_text(" ", strip=True)
            continue
        if el.find_parent("thead"):
            continue
        ev_el = el.select_one(".calendar-event")
        name = (el.get("data-event") or (ev_el.get_text(" ", strip=True) if ev_el else "")).strip()
        if not name:
            continue
        g = lambda sel: (el.select_one(sel).get_text(" ", strip=True) if el.select_one(sel) else "")
        tds = el.find_all("td")
        rows.append({"day": day, "time": tds[0].get_text(" ", strip=True) if tds else "", "event": name,
                     "country": el.get("data-country", ""), "actual": g("#actual"), "previous": g("#previous"),
                     "consensus": g("#consensus"), "forecast": g("#forecast")})
    us = [r for r in rows if not r["country"] or "united states" in r["country"].lower()]
    return us


# ---------------------------------------------------------------- the tests
def record(results, name, url, mode, status, h, secs, extra=None):
    r = {"url": url, "mode": mode, "status": status, "seconds": secs, "kb": round(len(h or "") / 1024, 1),
         "bot_check": bool(BOT.search((h or "")[:20000])) and status != 200 or bool(BOT.search(title_of(h))), "title": title_of(h)}
    r.update(extra or {})
    results[name] = r
    return r


def test_calendar_page(results, br, name, url, parser, wait):
    rows = []
    try:
        st, h, s = get(url)
        rows = parser(h) if st == 200 else []
        record(results, name + " (plain)", url, "plain", st, h, s, {"rows": len(rows), "with_actual": sum(1 for r in rows if r.get("actual"))})
    except Exception as e:
        results[name + " (plain)"] = {"url": url, "mode": "plain", "error": str(e)[:200]}
    if not rows:
        try:
            st, h, s = br.get(url, wait)
            rows = parser(h)
            record(results, name + " (browser)", url, "browser", st, h, s, {"rows": len(rows), "with_actual": sum(1 for r in rows if r.get("actual"))})
        except Exception as e:
            results[name + " (browser)"] = {"url": url, "mode": "browser", "error": str(e)[:200]}
    return rows


def test_page(results, br, name, url, pattern):
    """A release page: does it answer, and does the release sentence (with its number) appear?"""
    found = []
    try:
        st, h, s = get(url)
        found = snippets(plain_text(h), pattern) if st == 200 else []
        r = record(results, name + " (plain)", url, "plain", st, h, s, {"found": found})
    except Exception as e:
        r = results[name + " (plain)"] = {"url": url, "mode": "plain", "error": str(e)[:200]}
    if not found:
        try:
            st, h, s = br.get(url)
            found = snippets(plain_text(h), pattern)
            record(results, name + " (browser)", url, "browser", st, h, s, {"found": found})
        except Exception as e:
            results[name + " (browser)"] = {"url": url, "mode": "browser", "error": str(e)[:200]}
    return found


def test_fred_csv(results, name, series):
    url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=" + series
    try:
        st, h, s = get(url)
        lines = [l for l in (h or "").splitlines() if re.match(r"\d{4}-\d{2}-\d{2},", l)]
        results[name] = {"url": url, "mode": "plain", "status": st, "seconds": s, "last": lines[-4:]}
    except Exception as e:
        results[name] = {"url": url, "mode": "plain", "error": str(e)[:200]}


def test_feeds(results):
    for name, url in [("FF feed this week (JSON)", "https://nfs.faireconomy.media/ff_calendar_thisweek.json"),
                      ("FF feed this week (XML)", "https://nfs.faireconomy.media/ff_calendar_thisweek.xml"),
                      ("FF feed next week (JSON)", "https://nfs.faireconomy.media/ff_calendar_nextweek.json"),
                      ("FF feed next week (XML)", "https://nfs.faireconomy.media/ff_calendar_nextweek.xml")]:
        try:
            st, h, s = get(url)
            r = {"url": url, "status": st, "seconds": s, "kb": round(len(h) / 1024, 1)}
            if st == 200 and url.endswith(".json"):
                us = [e for e in json.loads(h) if e.get("country") == "USD"]
                r["fields"] = sorted(us[0].keys()) if us else []
                r["has_actual"] = any(str(e.get("actual", "")).strip() for e in us)
            if st == 200 and url.endswith(".xml"):
                r["actual_tags"] = len(re.findall(r"<actual>\s*<!\[CDATA\[\s*[^\]\s]", h)) + len(re.findall(r"<actual>\s*[^<\s]", h))
            results[name] = r
        except Exception as e:
            results[name] = {"url": url, "error": str(e)[:200]}


def by_release(cal):
    """For each hand-typed release: every row any calendar source returned for it."""
    out = {}
    for label, pat in TARGETS:
        rx, hits = re.compile(pat, re.I), []
        for src, rows in cal.items():
            for r in rows:
                if rx.search(r.get("event", "")):
                    hits.append(dict(r, source=src))
        out[label] = hits[:12]
    return out


def main():
    results, cal = {}, {}
    test_feeds(results)
    with Browser() as br:
        results["browser"] = {"started": br.ok, "error": br.err}
        tests = [
            ("cal", "ForexFactory this week", "https://www.forexfactory.com/calendar?week=this", parse_ff, "tr.calendar__row"),
            ("cal", "ForexFactory next week", "https://www.forexfactory.com/calendar?week=next", parse_ff, "tr.calendar__row"),
            ("cal", "Trading Economics (U.S.)", "https://tradingeconomics.com/united-states/calendar", parse_te, "#calendar"),
            ("page", "ISM services page", "https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/services/", r"Services PMI|PMI®"),
            ("page", "ISM manufacturing page", "https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/pmi/", r"Manufacturing PMI|PMI®"),
            ("page", "ISM releases on PR Newswire", "https://www.prnewswire.com/news/institute-for-supply-management/", r"(Services|Manufacturing) PMI"),
            ("page", "S&P Global PMI releases", "https://www.pmi.spglobal.com/Public/Release/PressReleases", r"US (Services|Manufacturing|Composite) PMI"),
            ("page", "Conference Board confidence", "https://www.conference-board.org/topics/consumer-confidence", r"Consumer Confidence Index"),
            ("page", "Chicago PMI (ISM-Chicago)", "https://www.ism-chicago.org/", r"Business Barometer|Chicago PMI"),
            ("page", "ADP report page", "https://adpemploymentreport.com/", r"(added|shed|lost)\s+[\d,]+\s+jobs|private (sector )?employment"),
            ("page", "EIA weekly petroleum page", "https://www.eia.gov/petroleum/supply/weekly/", r"commercial crude oil inventories"),
        ]
        for t in tests:
            if time.time() - T_START > BUDGET:
                results[t[1]] = {"skipped": "time budget reached"}
                continue
            if t[0] == "cal":
                cal[t[1]] = test_calendar_page(results, br, t[1], t[2], t[3], t[4])
            else:
                test_page(results, br, t[1], t[2], t[3])
    test_fred_csv(results, "ADP monthly on FRED (ADPMNUSNERSA)", "ADPMNUSNERSA")
    test_fred_csv(results, "ADP weekly on FRED (ADPWNUSNERSA)", "ADPWNUSNERSA")
    out = {"run_at": now_utc(), "seconds": round(time.time() - T_START), "sources": results,
           "calendar_days_seen": {k: sorted(set(r.get("day", "") for r in v if r.get("day"))) for k, v in cal.items()},
           "by_release": by_release(cal),
           "calendar_rows": {k: v[:90] for k, v in cal.items()}}
    with open(OUT, "w") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    print(json.dumps({k: (v.get("status"), v.get("rows", v.get("found", v.get("last", v.get("error"))))) if isinstance(v, dict) else v
                      for k, v in results.items()}, indent=1, ensure_ascii=False)[:6000])


if __name__ == "__main__":
    main()
