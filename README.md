# Alabama Stock Market Index

Static website for tracking a price-weighted Alabama stock index against the S&P 500.

## What this project is now

- A static website you can host on GitHub Pages
- A JavaScript data updater that creates `data/al_index_data.json`
- No server-side runtime required for hosting

## Files that matter

- `index.html` opens the site
- `templates/index.html` contains the dashboard layout and browser code
- `data/al_index_data.json` contains the stock data used by the site
- `scripts/update_data.mjs` refreshes the data snapshot

## Local use

Install dependencies:

```bash
npm install
```

Refresh the stock data:

```bash
npm run update-data
```

Preview the website locally:

```bash
npm run preview
```

## GitHub Pages

Follow the step-by-step instructions in `GITHUB-PAGES-GUIDE.md`.

## Updating the company list

Open `scripts/update_data.mjs` and edit the `AL_INDEX` object.

After making changes, run:

```bash
npm run update-data
```

## Deploying elsewhere

This folder can also be uploaded to Netlify, Cloudflare Pages, Vercel static hosting, Amazon S3, or any plain static file host.

## Data source

- Yahoo Finance via `yahoo-finance2`
- SEC EDGAR and public company investor relations pages for company verification

## Disclaimer

This project is for research and informational use only and is not investment advice.
