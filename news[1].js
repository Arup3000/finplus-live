// FinPlus news aggregator: pulls public RSS feeds server-side (no API key, no CORS problems).
// Every item links back to the publisher. A feed that fails is skipped, so one outage never breaks the page.
const FEEDS = [
  // Official regulators (primary sources)
  { s: "RBI", u: "https://rbi.org.in/pressreleases_rss.xml", r: "India", c: "Regulation" },
  { s: "SEBI", u: "https://www.sebi.gov.in/sebirss.xml", r: "India", c: "Regulation" },
  // Indian business press
  { s: "The Economic Times", u: "https://economictimes.indiatimes.com/rssfeeds/1373380680.cms", r: "India", c: "Economy" },
  { s: "The Economic Times", u: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms", r: "India", c: "Markets" },
  { s: "Mint", u: "https://www.livemint.com/rss/markets", r: "India", c: "Markets" },
  { s: "BusinessLine", u: "https://www.thehindubusinessline.com/economy/feeder/default.rss", r: "India", c: "Economy" },
  { s: "Business Standard", u: "https://www.business-standard.com/rss/markets-106.rss", r: "India", c: "Markets" },
  // Global
  { s: "BBC News", u: "https://feeds.bbci.co.uk/news/business/rss.xml", r: "Global", c: "Economy" },
  { s: "CNBC", u: "https://www.cnbc.com/id/10001147/device/rss/rss.html", r: "Global", c: "Markets" },
  { s: "The Guardian", u: "https://www.theguardian.com/uk/business/rss", r: "Global", c: "Economy" }
];
const RULES = [
  ["Tax & Compliance", /\b(gst|income tax|itr|tds|tax regime|audit|ind as|ifrs|icai)\b/i],
  ["Crypto", /\b(bitcoin|crypto|ethereum|digital asset)\b/i],
  ["Commodities", /\b(gold|silver|crude|brent|oil|opec)\b/i],
  ["Currency", /\b(rupee|forex|dollar|yen|euro|currency)\b/i],
  ["Fintech", /\b(upi|fintech|payments?|neobank)\b/i],
  ["Regulation", /\b(rbi|sebi|regulator|circular|norms)\b/i]
];
const dec = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, "&").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const tag = (x, t) => { const m = x.match(new RegExp("<" + t + "[^>]*>([\\s\\S]*?)</" + t + ">", "i")); return m ? dec(m[1]) : ""; };
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return "l" + (h >>> 0).toString(36); };

async function pull(f) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 7000);
  try {
    const res = await fetch(f.u, { signal: ac.signal, headers: { "user-agent": "Mozilla/5.0 FinPlusBot/1.0", accept: "application/rss+xml, application/xml, text/xml" } });
    if (!res.ok) throw new Error(res.status);
    const xml = await res.text();
    return (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []).slice(0, 8).map(x => {
      const title = tag(x, "title"), link = tag(x, "link") || tag(x, "guid");
      let pub = Date.parse(tag(x, "pubDate") || tag(x, "dc:date")); const now = Date.now();
      if (!pub || isNaN(pub) || pub > now) pub = now;
      const cat = (RULES.find(r => r[1].test(title)) || [f.c])[0];
      return { id: hash(link || title), t: title, link, pub, r: f.r, c: cat, s: f.s, b: tag(x, "description").slice(0, 240), k: title.toLowerCase().replace(/\W+/g, " ") };
    }).filter(i => i.t && /^https?:\/\//.test(i.link));
  } finally { clearTimeout(t); }
}

exports.handler = async () => {
  const res = await Promise.allSettled(FEEDS.map(pull));
  const seen = new Set(), cutoff = Date.now() - 7 * 864e5;
  const items = res.flatMap(r => r.status === "fulfilled" ? r.value : [])
    .filter(i => i.pub > cutoff && !seen.has(i.k) && seen.add(i.k))
    .sort((a, b) => b.pub - a.pub).slice(0, 80).map(({ k, ...i }) => i);
  const body = JSON.stringify({ items, sources: [...new Set(items.map(i => i.s))], at: Date.now() });
  return { statusCode: items.length ? 200 : 502, headers: { "content-type": "application/json", "cache-control": "public, max-age=300" }, body };
};
