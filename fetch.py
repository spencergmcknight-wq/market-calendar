"""
Economic-calendar relay for the SPX Daily Market Analysis hub.

Runs on GitHub's servers every 3 hours. Downloads this week's economic calendar
(every Fed speech, plus consensus and previous for each release), keeps the U.S.
events and saves them to calendar.json, which the hub reads.

Safety rules:
  * every download has a 30-second limit and 3 tries, so nothing can hang;
  * if a download fails, the events already in calendar.json are kept (never emptied);
  * "last_success" tells the hub how fresh the calendar is (its health check).

The forward P/E lives in pe.py / pe.json. The feed's "next week" file was removed:
it has returned "404 Not Found" on every run, so it only added an error.
"""
import json, time, urllib.request, datetime, os

SOURCES = {
    "thisweek": "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
}
OUT = "calendar.json"
UA = {"User-Agent": "Mozilla/5.0 (market-calendar relay; personal use)"}


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

    got_any = any(ok.values())
    if not got_any:
        events = old.get("events", [])               # keep what we had — never publish an empty calendar

    out = {
        "updated_at": now,                           # changes every run, which also keeps GitHub's scheduler active
        "last_success": now if got_any else old.get("last_success", ""),
        "ok": ok,
        "errors": errors,
        "count": len(events),
        "fed_speeches": sum(1 for e in events if "Speaks" in e["title"] or "Testifies" in e["title"]),
        "events": sorted(events, key=lambda e: e["date"]),
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=1)
    print(f"ok={ok} events={len(events)} fed_speeches={out['fed_speeches']} errors={errors}")


if __name__ == "__main__":
    main()
