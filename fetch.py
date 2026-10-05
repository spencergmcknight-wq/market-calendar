"""
Economic-calendar relay for the SPX Daily Market Analysis hub  (version 2)

Runs on GitHub's servers every 3 hours, and every 15 minutes on weekday mornings while
releases come out. Saves calendar.json, which the hub reads:
  * this week's U.S. events from the calendar feed (times, consensus, previous);
  * the ACTUAL result of every release once it is out, from the ForexFactory calendar
    page, with Trading Economics as the backup (ISM, S&P Global PMIs, Chicago PMI,
    Conference Board, ADP and EIA have no free source the hub can read directly);
  * next week's U.S. events from the ForexFactory calendar page (the feed only has this week).

Safety rules:
  * every download has a 30-second limit, so nothing can hang;
  * each source is independent: one failing never stops the others;
  * an actual result, once found, is never lost; if everything fails, the events
    already in calendar.json are kept (the file is never emptied);
  * "last_success" tells the hub how fresh the calendar is (its health check).
"""
import json, os, re, time, datetime, urllib.request, urllib.error
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
FEED = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
FF_PAGES = {"this": "https://www.forexfactory.com/calendar?week=this", "next": "https://www.forexfactory.com/calendar?week=next"}
TE_PAGE = "https://tradingeconomics.com/united-states/calendar"
OUT = "calendar.json"
FEED_HEAD = {"User-Agent": "Mozilla/5.0 (market-calendar relay; personal use)"}
PAGE_HEAD = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
             "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9"}
MONTHS = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
# Trading Economics' names -> the calendar's titles, for the releases the backup is used for
TE_NAMES = {
    "ism services pmi": "ISM Services PMI", "ism manufacturing pmi": "ISM Manufacturing PMI",
    "s&p global services pmi final": "Final Services PMI", "s&p global manufacturing pmi final": "Final Manufacturing PMI",
    "s&p global services pmi flash": "Flash Services PMI", "s&p global manufacturing pmi flash": "Flash Manufacturing PMI",
    "chicago pmi": "Chicago PMI", "cb consumer confidence": "CB Consumer Confidence",
    "adp employment change": "ADP Non-Farm Employment Change", "adp employment change weekly": "ADP Weekly Employment Change",
    "eia crude oil stocks change": "Crude Oil Inventories",
}


def get(url, headers, timeout=30, tries=2):
    """(HTTP status, text). Never hangs: 30 s per try."""
    last = None
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=timeout) as r:
                return r.status, r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return e.code, ""
        except Exception as e:                      # network error or time-out: one more try
            last = e
            time.sleep(5)
    raise RuntimeError(str(last))


# ---------------------------------------------------------------- reading the pages
def parse_ff(h):
    """ForexFactory calendar page -> U.S. rows (times on the page are Eastern)."""
    from bs4 import BeautifulSoup
    soup, rows, day, tm = BeautifulSoup(h, "html.parser"), [], "", ""
    for tr in soup.select("tr.calendar__row"):
        g = lambda c: (tr.select_one(c).get_text(" ", strip=True) if tr.select_one(c) else "")
        d, t = g(".calendar__date"), g(".calendar__time")
        day, tm = (d or day), (t or tm)
        cur, ev = g(".calendar__currency"), (g(".calendar__event-title") or g(".calendar__event"))
        if cur != "USD" or not ev:
            continue
        imp = tr.select_one(".calendar__impact span")
        cls = " ".join(imp.get("class", [])) if imp else ""
        impact = "High" if "red" in cls else ("Medium" if "ora" in cls else ("Low" if "yel" in cls else ("Holiday" if "gra" in cls else "")))
        rows.append({"day": day, "time": tm, "event": ev, "actual": g(".calendar__actual"),
                     "forecast": g(".calendar__forecast"), "previous": g(".calendar__previous"), "impact": impact})
    return rows


def parse_te(h):
    """Trading Economics U.S. calendar page -> rows (times on the page are UTC)."""
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
        name = (el.get("data-event") or (ev_el.get_text(" ", strip=True) if ev_el else "")).strip().lower()
        if not name:
            continue
        g = lambda sel: (el.select_one(sel).get_text(" ", strip=True) if el.select_one(sel) else "")
        tds = el.find_all("td")
        if el.get("data-country") and "united states" not in el.get("data-country", "").lower():
            continue
        rows.append({"day": day, "time": tds[0].get_text(" ", strip=True) if tds else "", "event": name,
                     "actual": g("#actual"), "previous": g("#previous")})
    return rows


def page_date(text, today):
    """'Mon Oct 5' or 'Monday October 05 2026' -> a date (the year is the one closest to today)."""
    m = re.search(r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?", text or "", re.I)
    if not m:
        return None
    mon, d = MONTHS[m.group(1).lower()], int(m.group(2))
    if m.group(3):
        return datetime.date(int(m.group(3)), mon, d)
    best = None
    for y in (today.year - 1, today.year, today.year + 1):
        try:
            c = datetime.date(y, mon, d)
        except ValueError:
            continue
        if best is None or abs((c - today).days) < abs((best - today).days):
            best = c
    return best


def page_clock(text):
    """'8:30am' / '01:45 PM' -> (hour, minute); 'All Day', 'Tentative', 'Sep 19th' -> None."""
    m = re.match(r"^\s*(\d{1,2}):(\d{2})\s*([ap])\.?m\.?\s*$", text or "", re.I)
    if not m:
        return None
    h = int(m.group(1)) % 12 + (12 if m.group(3).lower() == "p" else 0)
    return h, int(m.group(2))


def when(rows, today, zone):
    """Adds an Eastern date ('d') and Eastern datetime ('et', or None when there is no clock time) to page rows."""
    out = []
    for r in rows:
        d = page_date(r["day"], today)
        if not d:
            continue
        c = page_clock(r["time"])
        if c:
            et = datetime.datetime(d.year, d.month, d.day, c[0], c[1], tzinfo=zone).astimezone(ET)
            out.append(dict(r, d=et.date(), et=et))
        else:
            out.append(dict(r, d=d, et=None))
    return out


def feed_events():
    data = None
    for attempt in range(3):
        try:
            st, txt = get(FEED, FEED_HEAD, tries=1)
            if st != 200:
                raise RuntimeError("HTTP %d" % st)
            data = json.loads(txt)
            break
        except Exception as e:
            last = e
            time.sleep(10 * (attempt + 1))
    if data is None:
        raise RuntimeError(str(last))
    return [{"title": str(e.get("title", "")).strip(), "date": e.get("date", ""), "impact": e.get("impact", ""),
             "forecast": str(e.get("forecast", "") or ""), "previous": str(e.get("previous", "") or "")}
            for e in data if e.get("country") == "USD"]


def ev_key(title, d):
    return (str(title).strip().lower(), str(d))


def ev_date(e):
    try:
        return datetime.datetime.fromisoformat(e["date"]).astimezone(ET).date()
    except Exception:
        return None


def to_event(r):
    """A page row as a calendar event (ISO time with its offset, like the feed)."""
    dt = r["et"] or datetime.datetime(r["d"].year, r["d"].month, r["d"].day, 0, 0, tzinfo=ET)
    e = {"title": r["event"], "date": dt.isoformat(), "impact": r.get("impact", ""), "forecast": r.get("forecast", ""), "previous": r.get("previous", "")}
    if r.get("actual"):
        e["actual"], e["actual_source"] = r["actual"], "ForexFactory"
    return e


# ---------------------------------------------------------------- the run
def main():
    now = datetime.datetime.now(datetime.timezone.utc)
    stamp, today = now.strftime("%Y-%m-%dT%H:%M:%SZ"), now.astimezone(ET).date()
    old = {}
    if os.path.exists(OUT):
        try:
            with open(OUT) as f:
                old = json.load(f)
        except Exception:
            old = {}
    ok, errors = {}, {}

    # 1. this week's schedule from the feed
    events = []
    try:
        events = feed_events()
        ok["feed"] = True
    except Exception as e:
        ok["feed"], errors["feed"] = False, str(e)[:200]

    # 2. the ForexFactory page, this week and next (actual results, next week's events)
    pages = {}
    for wk, url in FF_PAGES.items():
        try:
            st, h = get(url, PAGE_HEAD)
            if st != 200:
                raise RuntimeError("HTTP %d" % st)
            rows = parse_ff(h)
            if not rows:
                raise RuntimeError("no U.S. rows found (page layout changed or blocked)")
            pages[wk] = when(rows, today, ET)
            ok["ff_" + wk] = True
        except Exception as e:
            ok["ff_" + wk], errors["ff_" + wk] = False, str(e)[:200]

    # without the feed, this week comes from the page, or else from the last good file
    if not ok["feed"]:
        if pages.get("this"):
            events = [to_event(r) for r in pages["this"]]
        else:
            week_start = today - datetime.timedelta(days=(today.weekday() + 1) % 7)       # Sunday
            events = [e for e in old.get("events", []) if (ev_date(e) or today) >= week_start]

    # actual results (and the latest previous) from this week's page
    idx = {}
    for r in pages.get("this", []):
        idx.setdefault(ev_key(r["event"], r["d"]), []).append(r)
    used = {}
    for e in events:
        k = ev_key(e["title"], ev_date(e))
        rows = idx.get(k, [])
        n = used.get(k, 0)
        if n < len(rows):                               # same title twice on one day (e.g. ADP weekly): matched in order
            r = rows[n]
            used[k] = n + 1
            if r.get("actual"):
                e["actual"], e["actual_source"] = r["actual"], "ForexFactory"
            if r.get("previous"):
                e["previous"] = r["previous"]

    # next week's events (only those not already listed)
    have = {ev_key(e["title"], ev_date(e)) for e in events}
    added = 0
    for r in pages.get("next", []):
        if ev_key(r["event"], r["d"]) not in have:
            events.append(to_event(r))
            have.add(ev_key(r["event"], r["d"]))
            added += 1

    # 3. backup: Trading Economics, for released events still without an actual
    wanted = set(TE_NAMES.values())
    missing = [e for e in events if e["title"] in wanted and not e.get("actual") and
               (lambda d: d is not None and d <= now)(datetime.datetime.fromisoformat(e["date"]) if e.get("date") else None)]
    if missing:
        try:
            st, h = get(TE_PAGE, PAGE_HEAD)
            if st != 200:
                raise RuntimeError("HTTP %d" % st)
            te = when(parse_te(h), today, datetime.timezone.utc)
            tidx = {}
            for r in te:
                if r["event"] in TE_NAMES and r.get("actual"):
                    tidx.setdefault(ev_key(TE_NAMES[r["event"]], r["d"]), []).append(r)
            for e in missing:
                rows = tidx.get(ev_key(e["title"], ev_date(e)))
                if rows:
                    e["actual"], e["actual_source"] = rows[0]["actual"], "Trading Economics"
            ok["te"] = True
        except Exception as e:
            ok["te"], errors["te"] = False, str(e)[:200]

    # 4. never lose an actual already found on an earlier run
    prev_act = {}
    for e in old.get("events", []):
        if e.get("actual"):
            prev_act[(ev_key(e["title"], ev_date(e)), e.get("date"))] = (e["actual"], e.get("actual_source", ""))
    for e in events:
        if not e.get("actual"):
            a = prev_act.get((ev_key(e["title"], ev_date(e)), e.get("date")))
            if a:
                e["actual"], e["actual_source"] = a

    got_any = ok.get("feed") or ok.get("ff_this") or ok.get("ff_next")
    if not events:
        events = old.get("events", [])                  # never publish an empty calendar
    events.sort(key=lambda e: e.get("date", ""))
    out = {
        "updated_at": stamp,                            # changes every run, which also keeps GitHub's scheduler active
        "last_success": stamp if got_any else old.get("last_success", ""),
        "ok": ok,
        "errors": errors,
        "count": len(events),
        "fed_speeches": sum(1 for e in events if "Speaks" in e["title"] or "Testifies" in e["title"]),
        "actuals": sum(1 for e in events if e.get("actual")),
        "next_week_added": added,
        "events": events,
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=1)
    print(f"ok={ok} events={len(events)} actuals={out['actuals']} next_week_added={added} errors={errors}")


if __name__ == "__main__":
    main()
