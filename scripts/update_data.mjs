import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YahooFinance from "yahoo-finance2";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT_DIR, "data", "al_index_data.json");
const BASE_DATE = "2020-01-02";
const BENCHMARK = "^GSPC";
const yahooFinance = new YahooFinance({ suppressNotices: ["ripHistorical"] });

const AL_INDEX = {
  RF: { name: "Regions Financial Corporation", sector: "Financial Services", city: "Birmingham" },
  VMC: { name: "Vulcan Materials Company", sector: "Materials", city: "Birmingham" },
  EHC: { name: "Encompass Health Corporation", sector: "Healthcare", city: "Birmingham" },
  HCC: { name: "Warrior Met Coal, Inc.", sector: "Energy", city: "Brookwood" },
  PRA: { name: "ProAssurance Corporation", sector: "Financial Services", city: "Birmingham" },
  ADTN: { name: "ADTRAN Holdings, Inc.", sector: "Technology", city: "Huntsville" },
  SFBS: { name: "ServisFirst Bancshares, Inc.", sector: "Financial Services", city: "Birmingham" }
};

const round2 = (value) => Number(value.toFixed(2));
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const toDateKey = (value) => new Date(value).toISOString().slice(0, 10);

async function fetchHistory(symbol) {
  const rows = await yahooFinance.historical(symbol, {
    period1: BASE_DATE,
    period2: new Date(),
    interval: "1d"
  });

  return rows
    .map((row) => ({
      date: toDateKey(row.date),
      close: Number(row.adjClose ?? row.close)
    }))
    .filter((row) => isFiniteNumber(row.close))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function annualReturn(series, year) {
  const yearPrefix = String(year);
  const values = series
    .filter((entry) => entry.date.startsWith(yearPrefix) && isFiniteNumber(entry.value))
    .map((entry) => entry.value);

  if (values.length < 2) {
    return null;
  }

  return round2(((values.at(-1) / values[0]) - 1) * 100);
}

function geometricMeanReturn(values) {
  const valid = values.filter((value) => isFiniteNumber(value));
  if (!valid.length) {
    return null;
  }

  const product = valid.reduce((accumulator, value) => accumulator * (1 + value / 100), 1);
  return round2((product ** (1 / valid.length) - 1) * 100);
}

function mean(values) {
  return values.reduce((accumulator, value) => accumulator + value, 0) / values.length;
}

function variance(values) {
  if (values.length < 2) {
    return null;
  }

  const average = mean(values);
  const total = values.reduce((accumulator, value) => accumulator + ((value - average) ** 2), 0);
  return total / (values.length - 1);
}

function covariance(left, right) {
  if (left.length !== right.length || left.length < 2) {
    return null;
  }

  const leftMean = mean(left);
  const rightMean = mean(right);
  const total = left.reduce((accumulator, value, index) => {
    return accumulator + ((value - leftMean) * (right[index] - rightMean));
  }, 0);

  return total / (left.length - 1);
}

function buildFilledSeries(histories) {
  const symbols = Object.keys(histories);
  const dateSet = new Set();

  for (const rows of Object.values(histories)) {
    for (const row of rows) {
      dateSet.add(row.date);
    }
  }

  const dates = Array.from(dateSet).sort();
  const historyMaps = Object.fromEntries(
    symbols.map((symbol) => [symbol, new Map(histories[symbol].map((row) => [row.date, row.close]))])
  );
  const lastSeen = {};
  const seriesBySymbol = Object.fromEntries(symbols.map((symbol) => [symbol, []]));

  for (const date of dates) {
    for (const symbol of symbols) {
      if (historyMaps[symbol].has(date)) {
        lastSeen[symbol] = historyMaps[symbol].get(date);
      }

      seriesBySymbol[symbol].push({
        date,
        value: lastSeen[symbol] ?? null
      });
    }
  }

  return { dates, seriesBySymbol };
}

function buildIndexSeries(filledSeries) {
  const tickerSymbols = Object.keys(AL_INDEX);
  const benchmarkSeries = filledSeries.seriesBySymbol[BENCHMARK];
  const rows = [];

  for (let index = 0; index < filledSeries.dates.length; index += 1) {
    const alValues = tickerSymbols
      .map((ticker) => filledSeries.seriesBySymbol[ticker][index].value)
      .filter(isFiniteNumber);
    const benchmarkValue = benchmarkSeries[index].value;

    if (!alValues.length || !isFiniteNumber(benchmarkValue)) {
      continue;
    }

    rows.push({
      date: filledSeries.dates[index],
      alRaw: mean(alValues),
      spRaw: benchmarkValue
    });
  }

  const alBase = rows[0]?.alRaw;
  const spBase = rows[0]?.spRaw;

  return rows.map((row) => ({
    date: row.date,
    al: (row.alRaw / alBase) * 100,
    sp: (row.spRaw / spBase) * 100
  }));
}

function buildReturns(indexSeries) {
  const marketReturns = [];
  const alReturns = [];

  for (let index = 1; index < indexSeries.length; index += 1) {
    const previous = indexSeries[index - 1];
    const current = indexSeries[index];

    if (!previous.al || !previous.sp) {
      continue;
    }

    alReturns.push((current.al / previous.al) - 1);
    marketReturns.push((current.sp / previous.sp) - 1);
  }

  return { alReturns, marketReturns };
}

function buildMilestones(indexSeries) {
  const currentYear = new Date().getFullYear();
  const milestones = [];

  for (let year = 2020; year <= currentYear; year += 1) {
    const rows = indexSeries.filter((row) => row.date.startsWith(String(year)));
    if (!rows.length) {
      continue;
    }

    milestones.push({
      date: `Start ${year}`,
      al: round2(rows[0].al),
      sp: round2(rows[0].sp)
    });
    milestones.push({
      date: `End ${year}`,
      al: round2(rows.at(-1).al),
      sp: round2(rows.at(-1).sp)
    });
  }

  return milestones;
}

function buildCompanies(histories, filledSeries) {
  const latestPrices = Object.fromEntries(
    Object.keys(AL_INDEX).map((ticker) => {
      const series = filledSeries.seriesBySymbol[ticker];
      const latestValue = series.findLast((entry) => isFiniteNumber(entry.value))?.value ?? null;
      return [ticker, latestValue];
    })
  );

  const totalPrice = Object.values(latestPrices)
    .filter(isFiniteNumber)
    .reduce((accumulator, value) => accumulator + value, 0);

  return Object.entries(AL_INDEX).map(([ticker, info]) => {
    const price = latestPrices[ticker];
    const history = histories[ticker].map((row) => ({ date: row.date, value: row.close }));

    return {
      ticker,
      name: info.name,
      sector: info.sector,
      city: info.city,
      price: isFiniteNumber(price) ? round2(price) : null,
      weight: totalPrice && isFiniteNumber(price) ? round2((price / totalPrice) * 100) : null,
      ret2020: annualReturn(history, 2020),
      ret2021: annualReturn(history, 2021),
      ret2022: annualReturn(history, 2022)
    };
  });
}

function buildSectors(companies) {
  const totals = new Map();

  for (const company of companies) {
    if (!isFiniteNumber(company.weight)) {
      continue;
    }

    totals.set(company.sector, (totals.get(company.sector) ?? 0) + company.weight);
  }

  return Object.fromEntries(
    Array.from(totals.entries())
      .sort((left, right) => right[1] - left[1])
      .map(([sector, weight]) => [sector, round2(weight)])
  );
}

async function main() {
  console.log(`[${new Date().toISOString()}] Fetching Yahoo Finance data...`);

  const symbols = [...Object.keys(AL_INDEX), BENCHMARK];
  const histories = Object.fromEntries(
    await Promise.all(
      symbols.map(async (symbol) => [symbol, await fetchHistory(symbol)])
    )
  );

  const filledSeries = buildFilledSeries(histories);
  const indexSeries = buildIndexSeries(filledSeries);
  const { alReturns, marketReturns } = buildReturns(indexSeries);
  const annReturns = [];
  const currentYear = new Date().getFullYear();

  for (let year = 2020; year <= currentYear; year += 1) {
    const al = annualReturn(indexSeries.map((row) => ({ date: row.date, value: row.al })), year);
    const sp = annualReturn(indexSeries.map((row) => ({ date: row.date, value: row.sp })), year);
    if (al !== null || sp !== null) {
      annReturns.push({ year, al, sp });
    }
  }

  const marketVariance = variance(marketReturns);
  const beta = marketVariance ? round2(covariance(alReturns, marketReturns) / marketVariance) : null;
  const companies = buildCompanies(histories, filledSeries);
  const sectors = buildSectors(companies);
  const payload = {
    dates: indexSeries.map((row) => row.date),
    al_index: indexSeries.map((row) => round2(row.al)),
    sp500: indexSeries.map((row) => round2(row.sp)),
    ann_returns: annReturns,
    geo_mean: {
      al: geometricMeanReturn(annReturns.filter((row) => row.year <= 2022).map((row) => row.al)),
      sp: geometricMeanReturn(annReturns.filter((row) => row.year <= 2022).map((row) => row.sp))
    },
    beta,
    milestones: buildMilestones(indexSeries),
    companies,
    sectors,
    last_updated: new Date().toISOString().replace("T", " ").slice(0, 19),
    data_source: "Yahoo Finance (Snapshot via Node.js)"
  };

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Saved ${OUTPUT}`);
  console.log(`AL Index current: ${payload.al_index.at(-1)}`);
  console.log(`S&P 500 current: ${payload.sp500.at(-1)}`);
  console.log(`Beta: ${payload.beta}`);
}

main().catch((error) => {
  console.error("Failed to build data snapshot.");
  console.error(error);
  process.exitCode = 1;
});