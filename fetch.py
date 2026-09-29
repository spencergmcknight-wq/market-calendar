"""
Economic-calendar relay for the SPX Daily Market Analysis hub.

Runs on GitHub's servers every few hours. Downloads this week's and next week's
economic calendar (every Fed speech, plus consensus and previous for each release),
keeps the U.S. events and saves them to calendar.json, which the hub reads.

Safety rules:
  * every download has a 30-second limit and 3 tries, so nothing can hang;
  * if a download fails, the events already in calendar.json are kept (never emptied);
  * "last_success" tells the hub how fresh the calendar is (its health check).
"""
import json, time, urllib.request, datetime, os, re, io

SOURCES = {
    "thisweek": "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
    "nextweek": "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
}
OUT = "calendar.json"
UA = {"User-Agent": "Mozilla/5.0 (market-calendar relay; personal use)"}
BROWSER = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
           "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9"}
PE_RE = re.compile(r"forward 12-month P/E ratio (?:for the S&(?:amp;)?P 500 )?is (\d{1,2}\.\d)", re.I)


def get(url, headers=BROWSER, binary=False):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
        return data if binary else data.decode("utf-8", "replace")


def factset_pe():
    """FactSet's weekly Earnings Insight: 'The forward 12-month P/E ratio for the S&P 500 is 22.4'."""
    tried = []
    for page in ["https://insight.factset.com/topic/earnings", "https://insight.factset.com/"]:
        html = get(page)
        m = PE_RE.search(html)
        if m:
            return float(m.group(1)), page
        links = re.findall(r'href="((?:https://insight\.factset\.com)?/[a-z0-9\-]+)"', html, re.I)
        links = ["https://insight.factset.com" + l if l.startswith("/") else l for l in links]
        links = [l for i, l in enumerate(links) if l not in links[:i] and re.search(r"s-?p-?500|earnings|forward|p-e", l, re.I)]
        for url in links[:8]:
            tried.append(url)
            try:
                m = PE_RE.search(get(url))
                if m:
                    return float(m.group(1)), url
            except Exception:
                pass
    raise RuntimeError("P/E sentence not found (checked %d articles)" % len(tried))


def spdji_eps():
    """S&P Dow Jones Indices estimates spreadsheet: the next four quarters of operating EPS."""
    from openpyxl import load_workbook
    raw = get("https://www.spglobal.com/spdji/en/documents/additional-material/sp-500-eps-est.xlsx", binary=True)
    wb = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    op_col = None
    for r in rows:
        for j, v in enumerate(r):
            t = str(v or "")
            if re.search(r"OPERATING", t, re.I) and re.search(r"EARN|EPS", t, re.I) and re.search(r"SH", t, re.I):
                op_col = j
                break
        if op_col is not None:
            break
    if op_col is None:
        raise RuntimeError("operating EPS column not found")
    today = datetime.date.today()
    q = {}
    for r in rows:
        d = r[0]
        if isinstance(d, datetime.datetime):
            d = d.date()
        elif isinstance(d, str):
            m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", d)
            d = datetime.date(int(m.group(3)), int(m.group(1)), int(m.group(2))) if m else None
        v = r[op_col] if op_col < len(r) else None
        if isinstance(d, datetime.date) and isinstance(v, (int, float)) and 0 < v < 200 and d > today and d not in q:
            q[d] = float(v)
    fut = sorted(q.items())[:4]
    if len(fut) < 4:
        raise RuntimeError("only %d future quarters found" % len(fut))
    return round(sum(v for _, v in fut), 2), [str(d) for d, _ in fut]


def fetch(url):
    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # network error, rate limit, bad JSON
            last = e
            time.sleep(10 * (attempt + 1))
    raise RuntimeError(str(last))


def main():
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    old = {}
    if os.path.exists(OUT):
        try:
            with open(OUT) as f:
                old = json.load(f)
        except Exception:
            old = {}

    events, ok, errors = [], {}, {}
    for name, url in SOURCES.items():
        try:
            data = fetch(url)
            ok[name] = True
            for e in data:
                if e.get("country") != "USD":
                    continue
                events.append({
                    "title": str(e.get("title", "")).strip(),
                    "date": e.get("date", ""),          # ISO time with its UTC offset; the hub converts to ET
                    "impact": e.get("impact", ""),
                    "forecast": str(e.get("forecast", "") or ""),
                    "previous": str(e.get("previous", "") or ""),
                })
        except Exception as e:
            ok[name] = False
            errors[name] = str(e)[:200]

    # forward P/E — FactSet (weekly) and S&P DJI (next four quarters of estimates); last good values are kept
    pe = old.get("pe", {}) if isinstance(old.get("pe"), dict) else {}
    try:
        v, src = factset_pe()
        pe["factset"] = {"value": v, "source": src, "as_of": now}
        ok["factset_pe"] = True
    except Exception as e:
        ok["factset_pe"] = False
        errors["factset_pe"] = str(e)[:200]
    try:
        eps, quarters = spdji_eps()
        pe["spdji"] = {"eps": eps, "quarters": quarters, "as_of": now}
        ok["spdji_eps"] = True
    except Exception as e:
        ok["spdji_eps"] = False
        errors["spdji_eps"] = str(e)[:200]

    got_any = ok.get("thisweek") or ok.get("nextweek")
    if not got_any:
        events = old.get("events", [])               # keep what we had — never publish an empty calendar

    out = {
        "updated_at": now,                           # changes every run, which also keeps GitHub's scheduler active
        "last_success": now if got_any else old.get("last_success", ""),
        "ok": ok,
        "errors": errors,
        "count": len(events),
        "fed_speeches": sum(1 for e in events if "Speaks" in e["title"] or "Testifies" in e["title"]),
        "pe": pe,
        "events": sorted(events, key=lambda e: e["date"]),
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=1)
    print(f"ok={ok} events={len(events)} fed_speeches={out['fed_speeches']} pe={pe} errors={errors}")


if __name__ == "__main__":
    main()
