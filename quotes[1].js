// Delayed market quotes from Yahoo Finance's public chart endpoint (unofficial, no key). Order matches the page.
const SYMS = ["^BSESN", "^NSEI", "^NSEBANK", "INR=X", "^GSPC", "^IXIC", "^FTSE", "^N225", "GC=F", "BZ=F", "BTC-USD"];
async function q(sym) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 7000);
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=5m`, { signal: ac.signal, headers: { "user-agent": "Mozilla/5.0" } });
    if (!r.ok) throw new Error(r.status);
    const x = (await r.json()).chart.result[0], m = x.meta;
    const series = (x.indicators.quote[0].close || []).filter(v => v != null);
    return { price: m.regularMarketPrice, prev: m.chartPreviousClose || m.previousClose, series: series.slice(-40) };
  } catch (e) { return null; } finally { clearTimeout(t); }
}
exports.handler = async () => {
  const quotes = await Promise.all(SYMS.map(q));
  return { statusCode: 200, headers: { "content-type": "application/json", "cache-control": "public, max-age=60" }, body: JSON.stringify({ quotes, at: Date.now() }) };
};
