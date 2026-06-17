# Budget Tracker — Zero-Based Budget & Wealth Tracker

A personal finance app: zero-based budget planning, cash reconciliation, wealth snapshots, and cross-device sync. Installable PWA (works offline), dark/light mode, CSV & JSON backups, PDF reporting.

## Quick Start

### 1. Test locally
```bash
npm install
npm run dev
```
Open http://localhost:5173. You should see a dark app with a "UNSPENT THIS MONTH" hero card, five nav tabs at the bottom, and a brass-gold accent color. Run through the smoke-test checklist (see below).

### 2. Deploy to Vercel
Push this folder to a GitHub repo, then in Vercel:
- **Add New → Project → Import** your repo
- Framework preset: **Vite** (auto-detected)
- **Deploy**

You'll get a URL like `https://budget-tracker-xxx.vercel.app`.

### 3. Enable cross-device sync (optional)
Sync requires a tiny key-value store. Set up Upstash Redis (free tier):
- upstash.com → **Create Database** → Redis → Create
- Copy **REST URL** and **REST TOKEN**
- In Vercel: **Settings → Environment Variables**, add:
  - `UPSTASH_REDIS_REST_URL` = the REST URL
  - `UPSTASH_REDIS_REST_TOKEN` = the REST token
- **Redeploy** (Deployments → latest → Redeploy)

### 4. Connect devices
Open the Vercel URL on laptop and phone. On each:
- Gear icon (top-right) → **Settings → Sync across devices**
- Enter the **same** private code (e.g. `mick-budget-7Q2k`)
- **Connect**

Both devices now share one dataset (last-write-wins, auto-syncs).

### 5. Install as an app
- **Laptop (Chrome/Edge):** Install icon in the address bar → opens as a windowed app
- **Phone (Android):** Chrome menu → Add to Home screen

Works offline after first load; syncs when back online.

## Features

- **Zero-based budget** (income = allocations + remainder)
- **Fixed & variable categories** with rollover (unspent carries month-to-month)
- **Cash reconciliation** (link account balances, confirm vs budget)
- **Wealth snapshots** — track held assets (savings, investments) over time
- **Budget alerts** — flag categories at 90% or over
- **50/30/20 check** — compare your Needs / Wants / Savings to the classic rule
- **Insights & charts** — income vs expenses, planned vs actual, net worth trend, recommendations
- **PDF report** — generate a one-page summary with selectable sections
- **Dark & light themes**
- **CSV export** (transaction ledger) & **JSON backup** (full restore)
- **Recurring income** — auto-apply salary each new month

## Smoke Test

Run this after `npm run dev` to confirm it works:

**Core**
- [ ] App loads dark, shows "UNSPENT THIS MONTH" hero with €0.00
- [ ] **+** button → log an expense → appears in Activity & Plan
- [ ] **+** → Income → log income → hero "in" updates
- [ ] Tap "€X in" on hero → set salary → Unspent updates
- [ ] Plan: tick a fixed bill (e.g. Rent) → row turns gold, diff = €0
- [ ] Edit a variable category → "Rollover on" → "rollover" tag appears
- [ ] "Pay all fixed" button pays all fixed bills at once

**Insights**
- [ ] Cash card: enter a balance → "Difference" updates
- [ ] Wealth card: enter balances, "Save snapshot" works
- [ ] Charts render (income vs expenses, planned vs actual, held assets)

**Settings**
- [ ] Dark/Light toggle switches theme (including charts)
- [ ] Export CSV downloads; export JSON downloads
- [ ] Import JSON (confirm prompt) restores all data

**Report**
- [ ] Insights → "Create report" → preview renders, section toggles work
- [ ] "Save as PDF" opens browser print dialog

**Sync** (after Upstash setup + redeploy)
- [ ] Two browsers/devices, same sync code → add expense on one → appears on other after refresh
- [ ] Status dot shows "Synced"

**Install**
- [ ] Laptop: Install icon visible, installs to taskbar/dock
- [ ] Phone: Works offline with airplane mode on

If anything fails: check the browser console (F12), confirm Upstash env vars are set in Vercel if testing sync.

## Tech

Vite + React, lucide-react, recharts. All state is a single JSON object in localStorage, optionally synced to Upstash Redis via `/api/sync` (last-write-wins by timestamp).

## Backups

Settings → Backup:
- **CSV** — full transaction ledger (Date, Type, Category, Amount, Note) for spreadsheets or archival
- **JSON** — complete backup (accounts, balances, snapshots, settings, all data) — restore replaces everything

## Files

- `src/App.jsx` — the entire app (1,600+ lines: logic, migrations, UI, styles)
- `src/main.jsx` — React entry point
- `src/index.css` — global resets
- `api/sync.js` — serverless sync endpoint (Vercel)
- `vite.config.js` — Vite + PWA config
- `public/` — icons and favicon
- `package.json` — dependencies

## Troubleshooting

- **"Not recognized as internal or external command"** — `npm install` hasn't run or Node.js isn't in PATH. Run `npm install` first.
- **Body tracker showing instead** — you're in the wrong folder. Confirm `ls` shows `package.json`, `vite.config.js`, `src/App.jsx`.
- **Sync error after deploy** — redeploy after adding env vars. Check Vercel Deployments: the latest must show the env vars in its logs.
- **Can't find second device after sync code** — confirm **exact same code** (case-sensitive) on both, then refresh. Status should show "Syncing" for a few seconds, then "Synced".

---

**Questions?** Check the README's troubleshooting, then check the browser console (F12) for error details.
