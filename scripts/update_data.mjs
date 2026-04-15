/**
 * Alabama Stock Index (ALSI) — Data Updater
 * ==========================================
 * Fetches daily historical prices for all 9 ALSI constituents and the
 * S&P 500 benchmark via Yahoo Finance, computes the Price-Weighted Index,
 * and writes the result to data/al_index_data.json.
 *
 * Usage:
 *   node scripts/update_data.mjs
 *
 * Run automatically by GitHub Actions on weekday evenings after market close.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT_DIR   = path.resolve(__dirname, '..');
const OUTPUT     = path.join(ROOT_DIR, 'data', 'al_index_data.json');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BASE_DATE  = '2020-01-02';   // Index = 100 on this date
const BENCHMARK  = '^GSPC';        // S&P 500

/**
 * ALSI Constituents — 9 publicly traded companies headquartered in Alabama.
 * Price-Weighted Index methodology (consistent with DJIA & FGCU/RERI SWFL Index).
 */
const AL_INDEX = {
  EHC:  { name: 'Encompass Health Corp',      sector: 'Healthcare',        city: 'Birmingham' },
  RF:   { name: 'Regions Financial Corp',     sector: 'Financial Services', city: 'Birmingham' },
  VMC:  { name: 'Vulcan Materials Company',   sector: 'Materials',          city: 'Birmingham' },
  MPW:  { name: 'Medical Properties Trust',  sector: 'Real Estate',        city: 'Birmingham' },
  ADTN: { name: 'ADTRAN Holdings',            sector: 'Technology',         city: 'Huntsville' },
  ROAD: { name: 'Construction Partners Inc',  sector: 'Industrials',        city: 'Dothan'     },
  HCC:  { name: 'Warrior Met Coal Inc',       sector: 'Materials',          city: 'Brookwood'  },
  TBRG: { name: 'TruBridge Inc',             sector: 'Health Technology',   city: 'Mobile'     },
  LAKE: { name: 'Lakeland Industries Inc',    sector: 'Consumer Goods',      city: 'Huntsville' },
};

// ─── UTILITIES ───────────────────────────────────────────────────────────────
const round2     = v => Number(v.toFixed(2));
const isFinite_  = v => typeof v === 'number' && Number.isFinite(v);
const toDateKey  = v => new Date(v).toISOString().slice(0, 10);

const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });

// ─── FETCH ───────────────────────────────────────────────────────────────────
async function fetchHistory(symbol, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const rows = await yahooFinance.historical(symbol, {
        period1: BASE_DATE,
        period2: new Date(),
        interval: '1d',
      });
      const result = rows
        .map(r => ({ date: toDateKey(r.date), close: Number(r.adjClose ?? r.close) }))
        .filter(r => isFinite_(r.close))
        .sort((a, b) => a.date.localeCompare(b.date));
      console.log(`  ✓ ${symbol.padEnd(6)} — ${result.length} trading days`);
      return result;
    } catch (err) {
      const wait = 2000 * (attempt + 1);
      console.warn(`  ⚠ ${symbol} retry ${attempt + 1}/${retries}: ${err.message}`);
      if (attempt < retries - 1) await new Promise(r => setTimeout(r, wait));
    }
  }
  console.error(`  ✗ ${symbol} failed after ${retries} retries — skipping`);
  return [];
}

// ─── BUILD UNIFIED SERIES (forward-fill missing days) ────────────────────────
function buildFilledSeries(histories) {
  const symbols  = Object.keys(histories);
  const dateSet  = new Set();
  for (const rows of Object.values(histories)) rows.forEach(r => dateSet.add(r.date));
  const dates    = [...dateSet].sort();
  const maps     = Object.fromEntries(symbols.map(s => [s, new Map(histories[s].map(r => [r.date, r.close]))]));
  const lastSeen = {};
  const series   = Object.fromEntries(symbols.map(s => [s, []]));

  for (const date of dates) {
    for (const sym of symbols) {
      if (maps[sym].has(date)) lastSeen[sym] = maps[sym].get(date);
      series[sym].push({ date, value: lastSeen[sym] ?? null });
    }
  }
  return { dates, seriesBySymbol: series };
}

// ─── COMPUTE PWI INDEX ───────────────────────────────────────────────────────
/**
 * Price-Weighted Index:
 *   PWI(t) = Σ(Stock Prices at t) / Divisor
 *   Divisor = Σ(Stock Prices on BASE_DATE) / 100
 * So PWI = 100 on BASE_DATE by construction.
 */
function buildIndexSeries(filled) {
  const tickers  = Object.keys(AL_INDEX);
  const spSeries = filled.seriesBySymbol[BENCHMARK];
  const rows     = [];

  for (let i = 0; i < filled.dates.length; i++) {
    const prices   = tickers.map(t => filled.seriesBySymbol[t][i].value).filter(isFinite_);
    const spPrice  = spSeries[i].value;
    if (!prices.length || !isFinite_(spPrice)) continue;
    rows.push({ date: filled.dates[i], alSum: prices.reduce((a, b) => a + b, 0), nValid: prices.length, spRaw: spPrice });
  }

  // Find base date values
  const baseRow = rows.find(r => r.date === BASE_DATE) ?? rows[0];
  if (!baseRow) throw new Error('No data found on or after base date ' + BASE_DATE);

  const alDivisor = baseRow.alSum / 100;           // Σ(prices on base date) / 100
  const spBase    = baseRow.spRaw;                  // S&P 500 price on base date
  const nBase     = baseRow.nValid;                 // number of valid tickers on base date

  return rows.map(r => ({
    date : r.date,
    // Scale sum so missing tickers don't deflate the index
    al   : round2((r.alSum * (nBase / r.nValid)) / alDivisor),
    sp   : round2((r.spRaw / spBase) * 100),
  }));
}

// ─── ANNUAL RETURNS ──────────────────────────────────────────────────────────
function annualReturn(series, year) {
  const rows = series.filter(r => r.date.startsWith(String(year)) && isFinite_(r.value));
  if (rows.length < 2) return null;
  return round2(((rows.at(-1).value / rows[0].value) - 1) * 100);
}

function buildAnnReturns(indexSeries) {
  const alSeries = indexSeries.map(r => ({ date: r.date, value: r.al }));
  const spSeries = indexSeries.map(r => ({ date: r.date, value: r.sp }));
  const currentYear = new Date().getFullYear();
  const results = [];
  for (let y = 2020; y <= currentYear; y++) {
    const al = annualReturn(alSeries, y);
    const sp = annualReturn(spSeries, y);
    if (al !== null || sp !== null) results.push({ year: y, al, sp });
  }
  return results;
}

// ─── BETA ─────────────────────────────────────────────────────────────────────
function computeBeta(indexSeries) {
  const al = [], sp = [];
  for (let i = 1; i < indexSeries.length; i++) {
    const p = indexSeries[i - 1], c = indexSeries[i];
    if (p.al && p.sp && c.al && c.sp) {
      al.push(c.al / p.al - 1);
      sp.push(c.sp / p.sp - 1);
    }
  }
  if (al.length < 30) return null;
  const meanAL = al.reduce((a, b) => a + b, 0) / al.length;
  const meanSP = sp.reduce((a, b) => a + b, 0) / sp.length;
  let cov = 0, varSP = 0;
  for (let i = 0; i < al.length; i++) {
    cov  += (al[i] - meanAL) * (sp[i] - meanSP);
    varSP += (sp[i] - meanSP) ** 2;
  }
  return varSP === 0 ? null : round2(cov / varSP);
}

// ─── MILESTONES ───────────────────────────────────────────────────────────────
function buildMilestones(indexSeries) {
  const milestones = [];
  const currentYear = new Date().getFullYear();
  for (let y = 2020; y <= currentYear; y++) {
    const rows = indexSeries.filter(r => r.date.startsWith(String(y)));
    if (!rows.length) continue;
    milestones.push({ date: `Start ${y}`, al: rows[0].al,       sp: rows[0].sp });
    milestones.push({ date: `End ${y}`,   al: rows.at(-1).al,   sp: rows.at(-1).sp });
  }
  return milestones;
}

// ─── COMPANIES ───────────────────────────────────────────────────────────────
function buildCompanies(histories, filled) {
  const latestPrices = Object.fromEntries(
    Object.keys(AL_INDEX).map(t => {
      const series = filled.seriesBySymbol[t];
      const latest = series?.findLast(e => isFinite_(e.value))?.value ?? null;
      return [t, latest];
    })
  );
  const totalPrice = Object.values(latestPrices).filter(isFinite_).reduce((a, b) => a + b, 0);

  return Object.entries(AL_INDEX).map(([ticker, info]) => {
    const price   = latestPrices[ticker];
    const history = (histories[ticker] ?? []).map(r => ({ date: r.date, value: r.close }));
    return {
      ticker,
      name:    info.name,
      sector:  info.sector,
      city:    info.city,
      price:   isFinite_(price) ? round2(price)  : null,
      weight:  (totalPrice && isFinite_(price)) ? round2((price / totalPrice) * 100) : null,
      ret2020: annualReturn(history, 2020),
      ret2021: annualReturn(history, 2021),
      ret2022: annualReturn(history, 2022),
      ret2023: annualReturn(history, 2023),
      ret2024: annualReturn(history, 2024),
    };
  });
}

// ─── SECTORS ─────────────────────────────────────────────────────────────────
function buildSectors(companies) {
  const totals = new Map();
  for (const c of companies) {
    if (!isFinite_(c.weight)) continue;
    totals.set(c.sector, (totals.get(c.sector) ?? 0) + c.weight);
  }
  return Object.fromEntries(
    [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([s, w]) => [s, round2(w)])
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('━'.repeat(55));
  console.log(' Alabama Stock Index (ALSI) — Data Updater');
  console.log('━'.repeat(55));
  console.log(` Base date : ${BASE_DATE} = 100`);
  console.log(` Run time  : ${new Date().toISOString()}\n`);

  // 1. Fetch constituent + benchmark data
  console.log('📡 Fetching constituent prices...');
  const symbols   = [...Object.keys(AL_INDEX), BENCHMARK];
  const histories = Object.fromEntries(
    await Promise.all(symbols.map(async sym => [sym, await fetchHistory(sym)]))
  );

  // 2. Build unified price series (forward-fill gaps)
  const filled = buildFilledSeries(histories);
  console.log(`\n📅 Unified trading calendar: ${filled.dates.length} days`);
  console.log(`   ${filled.dates[0]}  →  ${filled.dates.at(-1)}`);

  // 3. Compute PWI index + S&P 500 normalized
  console.log('\n⚙️  Computing Price-Weighted Index...');
  const indexSeries = buildIndexSeries(filled);
  const currentAL = indexSeries.at(-1)?.al;
  const currentSP = indexSeries.at(-1)?.sp;
  console.log(`   ALSI current value : ${currentAL}`);
  console.log(`   S&P 500 (indexed)  : ${currentSP}`);

  // 4. Supporting analytics
  const annReturns = buildAnnReturns(indexSeries);
  const beta       = computeBeta(indexSeries);
  const milestones = buildMilestones(indexSeries);
  const companies  = buildCompanies(histories, filled);
  const sectors    = buildSectors(companies);
  console.log(`   Beta vs S&P 500    : ${beta}`);

  // 5. Assemble payload
  const payload = {
    last_updated : new Date().toISOString().replace('T', ' ').slice(0, 19),
    data_source  : 'Yahoo Finance via yahoo-finance2 (Node.js)',
    base_date    : BASE_DATE,
    dates        : indexSeries.map(r => r.date),
    al_index     : indexSeries.map(r => r.al),
    sp500        : indexSeries.map(r => r.sp),
    ann_returns  : annReturns,
    beta,
    milestones,
    companies,
    sectors,
  };

  // 6. Write output
  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  console.log(`\n✅ Saved → ${OUTPUT}`);
  console.log('━'.repeat(55));
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  console.error(err);
  process.exitCode = 1;
});
