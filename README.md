# Alabama Stock Index (ALSI) Dashboard

A comprehensive interactive regional economic dashboard tracking the **Alabama Stock Market Index (ALSI)** against national benchmarks (DJIA, S&P 500 Equally Weighted). Built as a leading economic indicator for the State of Alabama, consistent with the [FGCU/RERI Southwest Florida Stock Index](https://www.fgcu.edu/cob/reri/dashboard/swfl-stock-index) methodology.

**Live Demo:** `https://<your-username>.github.io/<repo-name>/`

---

## 📊 What's Included

### ALSI Stock Index Tab
- **Price-Weighted Index (PWI)** of 9 Alabama-headquartered public companies
- Benchmarked vs **DJIA** and **S&P 500 Equally Weighted (RSP)**
- FGCU-style sidebar: dual-range date slider + click-to-change line colors + visibility toggles
- Daily granularity area chart (base = 100, Jan 2 2020)
- Component breakdown table, sector allocation, beta analysis, annual returns

### Economic Indicator Tabs (Live FRED + BLS Data)
| Tab | Source |
|-----|--------|
| Airport Passenger Activity | BTS T-100 Data |
| Tourist Tax Revenues | Alabama Dept. of Revenue |
| Taxable Sales | Alabama Dept. of Revenue |
| Labor Force & Employment | FRED — ALUR, ALNA, UNRATE |
| Employment by Industry | FRED — Alabama SAE series |
| Single-Family Building Permits | FRED — ALBPPRIVSA |
| Existing Home Sales | FRED — EXPHOUS, HOSMEDUSM052N |
| Residential Active Listings | Realtor.com / Alabama REALTORS® |
| Consumer Price Index | FRED — CUUSA316SA0, CPIAUCSL |
| Housing Affordability Index | FRED — FIXHAI, MORTGAGE30US |

---

## 🏗️ ALSI Constituents

| Ticker | Company | Sector | HQ |
|--------|---------|--------|-----|
| EHC | Encompass Health Corp | Healthcare | Birmingham |
| RF | Regions Financial Corp | Financial Services | Birmingham |
| VMC | Vulcan Materials Company | Materials | Birmingham |
| MPW | Medical Properties Trust | Real Estate | Birmingham |
| ADTN | ADTRAN Holdings | Technology | Huntsville |
| ROAD | Construction Partners Inc | Industrials | Dothan |
| HCC | Warrior Met Coal Inc | Materials | Brookwood |
| TBRG | TruBridge Inc | Health Technology | Mobile |
| LAKE | Lakeland Industries Inc | Consumer Goods | Huntsville |

---

## 🚀 GitHub Pages Deployment (Step-by-Step)

### 1. Create & Push the Repository

```bash
# Create a new GitHub repository at github.com, then:
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>

# Copy all files from this zip into the repo directory
# Then:
git add .
git commit -m "Initial commit: Alabama Stock Index Dashboard"
git push origin main
```

### 2. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under **Source**, select **Deploy from a branch**
4. Choose **Branch: main** and **Folder: / (root)**
5. Click **Save**
6. Your site will be live at `https://<username>.github.io/<repo-name>/` within ~2 minutes

### 3. Generate the Lock File (One-Time Setup)

```bash
npm install          # Installs yahoo-finance2 and generates package-lock.json
git add package-lock.json
git commit -m "chore: add package-lock.json"
git push
```

### 4. Enable Automatic Data Updates

The included GitHub Actions workflow (`.github/workflows/update-market-data.yml`) automatically:
- Runs **Monday–Friday at 5:30 PM ET** (after market close)
- Fetches latest prices for all 9 ALSI constituents + S&P 500 via Yahoo Finance
- Recomputes the PWI index
- Commits `data/al_index_data.json` back to the repo
- GitHub Pages auto-deploys the updated data

**The workflow requires no configuration** — it uses the built-in `GITHUB_TOKEN`.

You can also trigger it manually:  
**GitHub → Actions → Update Market Data → Run workflow**

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Start local server (http://localhost:8080)
npm run dev

# Or manually update data
npm run update-data
```

> ⚠️ Open via `http://localhost:8080` — not `file://`. The dashboard fetches `data/al_index_data.json` via HTTP; opening as a local file will trigger the embedded fallback data.

---

## 📐 Index Methodology

**Price-Weighted Index (PWI):**
```
ALSI(t) = [ Σ Stock Prices(t) × (N_base / N_valid(t)) ] ÷ Divisor
```

Where:
- `Divisor = Σ(Constituent Prices on Jan 2, 2020) / 100`
- `N_base` = number of tickers with valid prices on base date
- `N_valid(t)` = number of tickers with valid prices on date t
- Scaling by `N_base/N_valid` prevents deflation when a ticker has no data

This methodology is consistent with:
- The Dow Jones Industrial Average (DJIA)
- The FGCU/RERI Southwest Florida Stock Index (IBS: 2023-08)

**Base Value:** 100 on January 2, 2020  
**Benchmarks:** DJIA · S&P 500 Equally Weighted (RSP ETF)  
**Data Source:** Yahoo Finance via `yahoo-finance2` Node.js package

---

## 📁 Repository Structure

```
alabama-index/
├── .github/
│   └── workflows/
│       └── update-market-data.yml   # Auto-update GitHub Action
├── data/
│   └── al_index_data.json           # Pre-populated index data (auto-updated)
├── scripts/
│   └── update_data.mjs              # Node.js data fetching script
├── .gitignore
├── .nojekyll                        # Prevents GitHub Pages Jekyll processing
├── index.html                       # Complete dashboard (single-file)
├── package.json
└── README.md
```

---

## ⚖️ Disclaimer

This dashboard is for informational and research purposes only. It does not constitute investment advice. Past performance is not indicative of future results. Stock data may be delayed.

Data sources: Yahoo Finance · Federal Reserve (FRED) · Bureau of Labor Statistics · Census Bureau · Bureau of Transportation Statistics · Alabama Department of Revenue.
