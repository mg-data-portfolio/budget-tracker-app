import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error("App crash:", e, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "monospace", fontSize: 13, background: "#14161A", color: "#E05C5C", minHeight: "100vh" }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>App crashed — copy this and send to support:</div>
          <div style={{ background: "#1C1F26", padding: 16, borderRadius: 10, wordBreak: "break-all", whiteSpace: "pre-wrap" }}>
            {this.state.error.toString()}{"\n\n"}{this.state.error.stack}
          </div>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ marginTop: 20, padding: "12px 20px", background: "#C9A24A", color: "#000", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14 }}>
            Clear data &amp; reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import {
  Plus, ChevronLeft, ChevronRight, X, Trash2, SlidersHorizontal,
  LayoutGrid, Receipt, Check, PencilLine, BarChart3,
  Settings, Sun, Moon, Download, Upload, FileText, Layers, Lock, Unlock, ChevronUp, ChevronDown,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

/* ------------------------------------------------------------------ *
 *  ZERO-BASED BUDGET TRACKER
 *  Modelled on the "Budget" sheet: income − (Needs + Wants + Savings)
 *  should resolve to €0. Each category carries a planned amount; logged
 *  expenses accumulate the actual; the difference (planned − actual) is
 *  the heartbeat — green when under, red when over.
 * ------------------------------------------------------------------ */

const STORAGE_KEY = "budget-tracker-state-v1";

const GROUPS = [
  { id: "needs", label: "Needs", color: "#6E8AC4" },
  { id: "wants", label: "Wants", color: "#C9A24A" },
  { id: "savings", label: "Savings & Debt", color: "#9B8AC4" },
];
const GROUP = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

const uid = () =>
  (crypto?.randomUUID?.() ?? "id-" + Math.random().toString(36).slice(2));

/* --- seed: the exact plan from the sheet --- */
const SEED = {
  version: 1,
  theme: "dark",
  plan: { income: { salary: 3245, other: 0 } },
  accounts: [
    { id: "acc-boi", name: "Bank of Ireland", kind: "asset", liquid: true },
    { id: "acc-cash", name: "Cash", kind: "asset", liquid: true },
    { id: "acc-rev-main", name: "Revolut Main", kind: "asset", liquid: true },
    { id: "acc-rev-exp", name: "Revolut Expenses", kind: "asset", liquid: true },
    { id: "acc-rev-credit", name: "Revolut Credit", kind: "owed", liquid: true },
    { id: "acc-owed", name: "Amount owed", kind: "owed", liquid: true },
    { id: "acc-holiday", name: "Holiday Fund", kind: "asset", liquid: false },
    { id: "acc-emergency", name: "Emergency Fund", kind: "asset", liquid: false },
    { id: "acc-boi-sav", name: "BOI Savings Account", kind: "asset", liquid: false },
    { id: "acc-boi-dep", name: "BOI Deposit Account", kind: "asset", liquid: false },
    { id: "acc-irishlife", name: "Irish Life Savings", kind: "asset", liquid: false },
    { id: "acc-n26", name: "N26 Investment", kind: "asset", liquid: false },
    { id: "acc-car-loan", name: "Car Loan", kind: "loan", liquid: false, loanMeta: { originalAmount: 23250, interestRate: 6.31, term: 60, disbursalDate: "2024-11-08", repaymentDay: 1, linkedCategories: ["Car Loan Repayment", "Car Loan (savings)"], monthlyPayment: 452.82 } },
  ],
  categories: [
    { id: uid(), group: "needs", name: "Rent", planned: 200, fixed: true },
    { id: uid(), group: "needs", name: "Joint Costs (Heat, Groceries, Vet, Taxis, Misc)", planned: 500, fixed: false },
    { id: uid(), group: "needs", name: "Holiday Fund", planned: 600, fixed: true },
    { id: uid(), group: "needs", name: "Miscellaneous expenses fund", planned: 437, fixed: true },
    { id: uid(), group: "needs", name: "Donations", planned: 21, fixed: true },
    { id: uid(), group: "needs", name: "Coffee", planned: 30, fixed: false },
    { id: uid(), group: "needs", name: "Petrol", planned: 60, fixed: false },
    { id: uid(), group: "needs", name: "Supplements", planned: 75, fixed: false },
    { id: uid(), group: "needs", name: "Bank Fees", planned: 6, fixed: true },
    { id: uid(), group: "needs", name: "Haircut", planned: 40, fixed: false },
    { id: uid(), group: "needs", name: "Phone bill", planned: 15, fixed: true },
    { id: uid(), group: "wants", name: "Car Loan Repayment", planned: 200, fixed: true },
    { id: uid(), group: "wants", name: "Niceties Fund (Clothes, Amazon, etc.)", planned: 100, fixed: false },
    { id: uid(), group: "wants", name: "Date Nights", planned: 100, fixed: false },
    { id: uid(), group: "wants", name: "Socializing", planned: 80, fixed: false },
    { id: uid(), group: "wants", name: "Subscriptions", planned: 60, fixed: true },
    { id: uid(), group: "savings", name: "CC Repayment / Emergency fund", planned: 100, fixed: true },
    { id: uid(), group: "savings", name: "Savings account contributions", planned: 123, fixed: true },
    { id: uid(), group: "savings", name: "N26 Investment", planned: 45, fixed: true },
    { id: uid(), group: "savings", name: "General Savings", planned: 200, fixed: true },
    { id: uid(), group: "savings", name: "Car Loan (savings)", planned: 253, fixed: true },
  ],
  months: {
    "2026-07": {
      id: "2026-07", label: "July 2026", payday: "",
      income: { salary: 0, other: 0, prior: 0 }, txns: [], incomeTxns: [],
      balances: {}, locked: false,
    },
  },
  current: "2026-07",
  wealthSnapshots: [],
};

/* ------------------------------- storage ------------------------------- */
async function loadState() {
  try {
    if (typeof window !== "undefined" && localStorage) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (_) { /* key not set yet */ }
  return null;
}
async function saveState(state) {
  try {
    if (typeof window !== "undefined" && localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch (e) { console.error("save failed", e); }
}
const SYNC_CODE_KEY = "budget-sync-code";
const UPDATED_AT_KEY = STORAGE_KEY + "-updated-at";
function getSyncCode() { try { return localStorage.getItem(SYNC_CODE_KEY) || ""; } catch (_) { return ""; } }
function setSyncCodeLS(code) { try { code ? localStorage.setItem(SYNC_CODE_KEY, code) : localStorage.removeItem(SYNC_CODE_KEY); } catch (_) {} }
function getLocalUpdatedAt() { try { return parseInt(localStorage.getItem(UPDATED_AT_KEY) || "0", 10) || 0; } catch (_) { return 0; } }
function setLocalUpdatedAt(t) { try { localStorage.setItem(UPDATED_AT_KEY, String(t)); } catch (_) {} }
async function pullRemote(code) {
  const r = await fetch(`/api/sync?code=${encodeURIComponent(code)}`);
  if (!r.ok) throw new Error("pull failed");
  const j = await r.json();
  return j.payload || null; // { data, updatedAt } | null
}
async function pushRemote(code, data, updatedAt) {
  const r = await fetch(`/api/sync?code=${encodeURIComponent(code)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, updatedAt }),
  });
  if (!r.ok) throw new Error("push failed");
}

/* ------------------------------- helpers ------------------------------- */
const eur = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
const fmt = (n) => eur.format(n || 0);
const fmtSigned = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + eur.format(Math.abs(n || 0));

function monthMeta(id) {
  const [y, m] = id.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return {
    label: d.toLocaleString("en-IE", { month: "long", year: "numeric" }),
    y, m,
  };
}
function nextMonthId(id) {
  const { y, m } = monthMeta(id);
  const d = new Date(y, m, 1); // m is 1-based → next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function lastFridayOnOrBefore(year, monthIndex0, day) {
  const d = new Date(year, monthIndex0, day);
  while (d.getDay() !== 5) d.setDate(d.getDate() - 1);
  return d;
}
// Payday for a budget month = last Friday of the previous calendar month,
// except for January, where pay typically lands before Christmas, not New Year's Eve.
function computePaydayDate(monthId) {
  const { y, m } = monthMeta(monthId); // m is 1-based
  let py = y, pm = m - 1;
  if (pm === 0) { pm = 12; py = y - 1; }
  if (pm === 12) {
    return lastFridayOnOrBefore(py, 11, 25); // last Friday on/before 25 Dec
  }
  return lastFridayOnOrBefore(py, pm, 0); // day 0 of month `pm` (1-based) = last day of that month
}
function todayMonthId() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Planned amount for a category in a given month. Locked months use the amounts
// saved when they were locked (so later plan changes don't rewrite history);
// unlocked months use the live amount.
function plannedFor(state, monthId, cat) {
  const m = state.months[monthId];
  const snap = m && m.locked ? m.plannedSnapshot : null;
  return snap && snap[cat.id] != null ? snap[cat.id] : cat.planned;
}
// A category is archived from a month onward (field set by the future "archive" feature;
// a missing field means the category is active).
function isArchivedIn(cat, monthId) {
  return !!cat.archivedFrom && monthId >= cat.archivedFrom;
}

// Budget suggestions — one shared implementation for the Insights tab and the PDF report.
// - Only variable categories, only complete months (next month's payday has passed).
// - A category's history starts at its first month with spend; it needs 2+ months in that
//   window with spend above €0 before anything is suggested.
// - Each month's spend is compared with that month's planned amount (locked-month snapshot).
// - Categories archived as of the viewed month are skipped.
// - A suggestion dismissed this calendar month stays hidden until next month.
function computeSuggestions(state, viewMonthId) {
  const today = new Date();
  const isComplete = (id) => computePaydayDate(nextMonthId(id)) <= today;
  const varSpend = (id, catId) =>
    (state.months[id].txns || []).filter((t) => t.cat === catId && !t.fixed).reduce((a, t) => a + t.amount, 0);
  const activeIds = Object.keys(state.months).sort()
    .filter((id) => isComplete(id) && (state.months[id].txns || []).some((t) => !t.fixed));
  const dismissed = state.suggestionDismissals || {};
  const thisMonth = todayMonthId();

  return state.categories
    .filter((c) => !c.fixed && !isArchivedIn(c, viewMonthId) && dismissed[c.id] !== thisMonth)
    .map((c) => {
      const rows = activeIds.map((id) => ({ spent: varSpend(id, c.id), planned: plannedFor(state, id, c) }));
      const first = rows.findIndex((r) => r.spent > 0);
      if (first === -1) return null;
      const win = rows.slice(first);
      const n = win.length;
      if (n < 2 || win.filter((r) => r.spent > 0).length < 2) return null;
      const avg = win.reduce((a, r) => a + r.spent, 0) / n;
      const avgPlanned = win.reduce((a, r) => a + r.planned, 0) / n;
      return { c, n, avg, avgPlanned, suggested: Math.round(avg), dev: avg - avgPlanned };
    })
    .filter((x) => x && Math.abs(x.dev) > 5 && Math.abs(x.dev) / Math.max(x.avgPlanned, 1) > 0.15)
    .sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev));
}

// Per-month metrics across the whole history, with prior-balance chained.
function buildSeries(state) {
  const ids = Object.keys(state.months).sort();
  let carry = null;
  return ids.map((id) => {
    const m = state.months[id];
    const income =
      (m.income.salary || 0) + (m.income.other || 0) +
      (m.incomeTxns || []).reduce((s, t) => s + t.amount, 0);
    const start = carry === null ? (m.income.prior || 0) : carry;
    const expenses = (m.txns || []).reduce((s, t) => s + t.amount, 0);
    const endBalance = Math.round((start + income - expenses) * 100) / 100;
    carry = endBalance;
    const b = m.balances || {};
    const hasBal = Object.keys(b).length > 0;
    const assets = state.accounts.filter((a) => a.kind === "asset").reduce((s, a) => s + (b[a.id] || 0), 0);
    const owed = state.accounts.filter((a) => a.kind === "owed").reduce((s, a) => s + (b[a.id] || 0), 0);
    const meta = monthMeta(id);
    return {
      id, label: meta.label.slice(0, 3), full: meta.label,
      income, expenses, net: income - expenses, endBalance,
      hasBal, assets, owed, netWorth: assets - owed,
    };
  });
}

/* ------------------------------- CSV I/O ------------------------------- */
function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCSV(state) {
  const rows = [["Date", "Month", "Type", "Group", "Category", "Amount", "Note"]];
  const catById = Object.fromEntries(state.categories.map((c) => [c.id, c]));
  Object.keys(state.months).sort().forEach((id) => {
    const label = monthMeta(id).label;
    const mm = state.months[id];
    (mm.txns || []).forEach((t) => {
      const c = catById[t.cat];
      rows.push([t.date || "", label, t.fixed ? "fixed" : "expense",
        c ? GROUP[c.group].label : "", c ? c.name : "", t.amount, t.note || ""]);
    });
    (mm.incomeTxns || []).forEach((t) => {
      rows.push([t.date || "", label, "income", "Income", t.source || "", t.amount, ""]);
    });
  });
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function parseCSV(text) {
  const rows = []; let row = []; let cur = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (ch !== "\r") cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ""));
}
function importCSV(state, text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { next: state, imported: 0, skipped: 0 };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const di = header.indexOf("date"), ti = header.indexOf("type"),
    ci = header.indexOf("category"), ai = header.indexOf("amount"), ni = header.indexOf("note");
  const catByName = {};
  state.categories.forEach((c) => { catByName[c.name.toLowerCase()] = c; });
  const months = { ...state.months };
  let imported = 0, skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const date = (row[di] || "").trim();
    const type = (row[ti] || "expense").trim().toLowerCase();
    const amount = parseFloat(row[ai]);
    if (!amount || !/^\d{4}-\d{2}/.test(date)) { skipped++; continue; }
    const monthId = date.slice(0, 7);
    if (!months[monthId]) {
      months[monthId] = { id: monthId, label: monthMeta(monthId).label, payday: "", income: { salary: 0, other: 0, prior: 0 }, txns: [], incomeTxns: [], balances: {} };
    } else {
      months[monthId] = { ...months[monthId], txns: [...(months[monthId].txns || [])], incomeTxns: [...(months[monthId].incomeTxns || [])] };
    }
    if (type === "income") {
      months[monthId].incomeTxns.push({ id: uid(), amount, source: (row[ci] || "Income").trim() || "Income", date });
      imported++;
    } else {
      const cat = catByName[(row[ci] || "").trim().toLowerCase()];
      if (!cat) { skipped++; continue; }
      const t = { id: uid(), cat: cat.id, amount, note: (row[ni] || "").trim(), date };
      if (type === "fixed") t.fixed = true;
      months[monthId].txns.push(t);
      imported++;
    }
  }
  return { next: { ...state, months }, imported, skipped };
}

function migrate(state) {
  if (!state) return state;
  let s = state;

  // (re)apply `fixed` flags from the seed by category name (once). Safe: only
  // touches categories whose name matches a seeded one; user-added stay as-is.
  if (!s.migratedFixedV3) {
    const fixedByName = {};
    for (const c of SEED.categories) fixedByName[c.name] = c.fixed;
    s = {
      ...s,
      categories: (s.categories || []).map((c) =>
        c.name in fixedByName ? { ...c, fixed: fixedByName[c.name] } : { ...c, fixed: "fixed" in c ? c.fixed : false }),
      migratedFixedV3: true,
    };
  }

  // accounts: backfill `liquid` and add asset holdings (run once)
  if (!s.migratedAssetsV4) {
    let accounts = (s.accounts || []).map((a) => ("liquid" in a ? a : { ...a, liquid: true }));
    const have = new Set(accounts.map((a) => a.name));
    for (const seed of SEED.accounts) {
      if (!have.has(seed.name)) accounts = [...accounts, { ...seed, id: uid() }];
    }
    s = { ...s, accounts, migratedAssetsV4: true };
  }

  // align asset accounts to the sheet's Asset Total tab + prefill balances (run once)
  if (!s.migratedAssetsV5) {
    const targets = [
      { name: "Holiday Fund", bal: 1105.12 }, { name: "Emergency Fund", bal: 280.81 },
      { name: "BOI Savings Account", bal: 2000.58 }, { name: "BOI Deposit Account", bal: 3626.15 },
      { name: "Irish Life Savings", bal: 7981.60 }, { name: "N26 Investment", bal: 970.70 },
    ];
    const balSomewhere = (id) => Object.values(s.months).some((mm) => (mm.balances || {})[id]);
    // drop my earlier auto-added placeholders that have no balance and aren't real targets
    const placeholders = new Set(["General Savings", "Emergency fund"]);
    let accounts = (s.accounts || []).filter((a) => !(placeholders.has(a.name) && !balSomewhere(a.id)));
    // canonicalise names that case-insensitively match a target
    const tnames = targets.map((t) => t.name);
    accounts = accounts.map((a) => {
      const hit = tnames.find((n) => n.toLowerCase() === a.name.toLowerCase());
      return hit ? { ...a, name: hit, kind: "asset", liquid: false } : a;
    });
    // add any missing target accounts
    const lower = new Set(accounts.map((a) => a.name.toLowerCase()));
    for (const t of targets) {
      if (!lower.has(t.name.toLowerCase())) accounts.push({ id: uid(), name: t.name, kind: "asset", liquid: false });
    }
    // prefill the latest month's balances for held assets that are still empty
    const ids = Object.keys(s.months).sort();
    const latest = ids[ids.length - 1];
    const months = { ...s.months };
    if (latest) {
      const m = months[latest];
      const b = { ...(m.balances || {}) };
      for (const t of targets) {
        const acc = accounts.find((a) => a.name === t.name);
        if (acc && b[acc.id] == null) b[acc.id] = t.bal;
      }
      months[latest] = { ...m, balances: b };
    }
    s = { ...s, accounts, months, migratedAssetsV5: true };
  }

  // wealth snapshots: ensure the log exists and seed one from current held balances (run once)
  if (!s.migratedWealthV6) {
    let snaps = s.wealthSnapshots || [];
    if (snaps.length === 0) {
      const ids = Object.keys(s.months).sort();
      const latest = ids[ids.length - 1];
      const b = (latest && s.months[latest].balances) || {};
      const held = (s.accounts || []).filter((a) => !a.liquid);
      const total = held.filter((a) => a.kind === "asset").reduce((t, a) => t + (b[a.id] || 0), 0)
        - held.filter((a) => a.kind === "owed").reduce((t, a) => t + (b[a.id] || 0), 0);
      const balances = {};
      held.forEach((a) => { balances[a.id] = b[a.id] || 0; });
      const today = new Date().toISOString().slice(0, 10);
      if (total !== 0) snaps = [{ id: uid(), date: today, total: Math.round(total * 100) / 100, balances }];
    }
    s = { ...s, wealthSnapshots: snaps, migratedWealthV6: true };
  }

  // zero the old pre-filled salary on untouched months (run once)
  if (!s.migratedSalaryV2) {    const planSalary = s.plan?.income?.salary || 0;
    const months = { ...s.months };
    for (const id in months) {
      const m = months[id];
      const noActivity = (m.txns?.length || 0) === 0 && (m.incomeTxns?.length || 0) === 0;
      if (noActivity && m.income && m.income.salary === planSalary) {
        months[id] = { ...m, income: { ...m.income, salary: 0 } };
      }
    }
    s = { ...s, months, migratedSalaryV2: true };
  }

  if (!s.migratedBreakdownV7) {
    const months = { ...s.months };
    for (const id in months) {
      months[id] = { ...months[id], balanceItems: months[id].balanceItems || {} };
    }
    s = { ...s, months, migratedBreakdownV7: true };
  }

  if (!s.migratedLoansV9) {
    let accounts = (s.accounts || []).map(a => ({
      ...a,
      excludeFromNetWorth: a.excludeFromNetWorth !== undefined ? a.excludeFromNetWorth : false,
      loanMeta: a.loanMeta || null, // {originalAmount, interestRate, term, disbursalDate, repaymentDay, linkedCategories, monthlyPayment}
    }));
    const hasCarLoan = accounts.some(a => a.id === "acc-car-loan" || a.kind === "loan");
    let months = s.months;
    if (!hasCarLoan) {
      accounts = [...accounts, {
        id: "acc-car-loan", name: "Car Loan", kind: "loan", liquid: false, excludeFromNetWorth: false,
        loanMeta: { originalAmount: 23250, interestRate: 6.31, term: 60, disbursalDate: "2024-11-08", repaymentDay: 1, linkedCategories: ["Car Loan Repayment", "Car Loan Savings"], monthlyPayment: 452.82 },
      }];
      months = { ...s.months };
      if (months[s.current]) {
        months[s.current] = { ...months[s.current], balances: { ...months[s.current].balances, "acc-car-loan": 16707.70 } };
      }
    }
    s = { ...s, accounts, months, migratedLoansV9: true };
  }

  // patch the real contractual monthly payment onto the car loan (overrides the calculated estimate)
  if (!s.migratedLoansV10) {
    const accounts = (s.accounts || []).map(a =>
      a.id === "acc-car-loan" && a.loanMeta
        ? { ...a, loanMeta: { ...a.loanMeta, monthlyPayment: 452.82 } }
        : a
    );
    s = { ...s, accounts, migratedLoansV10: true };
  }

  // add May 2026 as a navigable (empty, zero-based) month before the existing earliest month.
  // The previously-earliest month's "Starting balance" (income.prior) only had meaning because
  // it WAS the earliest month; once May precedes it, that role passes to May, so we copy the
  // value across to keep the existing month's calculations unchanged.
  if (!s.migratedMay2026V11) {
    let months = s.months;
    if (!months["2026-05"]) {
      const existingIds = Object.keys(months).sort();
      const oldEarliestId = existingIds[0];
      const preservedPrior = oldEarliestId ? (months[oldEarliestId].income.prior || 0) : 0;
      months = {
        ...months,
        "2026-05": { id: "2026-05", label: monthMeta("2026-05").label, payday: "", income: { salary: 0, other: 0, prior: preservedPrior }, txns: [], incomeTxns: [], balances: {} },
      };
    }
    s = { ...s, months, migratedMay2026V11: true };
  }

  // V12: reset to July 2026 — remove May/June (which had issues), create a fresh July,
  // and add a `locked` boolean to every month for the new lock-month feature.
  if (!s.migratedJulyResetV12) {
    let months = { ...s.months };
    delete months["2026-05"];
    delete months["2026-06"];
    if (!months["2026-07"]) {
      months["2026-07"] = {
        id: "2026-07", label: monthMeta("2026-07").label, payday: "",
        income: { salary: 0, other: 0, prior: 0 }, txns: [], incomeTxns: [], balances: {}, locked: false,
      };
    }
    // add locked field to all remaining months
    for (const id in months) {
      months[id] = { ...months[id], locked: months[id].locked ?? false };
    }
    const current = ["2026-05", "2026-06"].includes(s.current) ? "2026-07" : s.current;
    s = { ...s, months, current, migratedJulyResetV12: true };
  }

  // V13: fix linkedCategories name — "Car Loan Savings" → "Car Loan (savings)" to match real category name
  if (!s.migratedLinkedCatsV13) {
    const accounts = (s.accounts || []).map(a =>
      a.id === "acc-car-loan" && a.loanMeta
        ? { ...a, loanMeta: { ...a.loanMeta, linkedCategories: ["Car Loan Repayment", "Car Loan (savings)"] } }
        : a
    );
    s = { ...s, accounts, migratedLinkedCatsV13: true };
  }

  // V14: budget-suggestion support (additive).
  //  - plannedSnapshot on every already-locked month = today's planned amounts, so later plan
  //    changes don't distort suggestions for those months (also saved on every future lock).
  //  - suggestionDismissals: { [categoryId]: "YYYY-MM" } calendar month a suggestion was dismissed.
  if (!s.migratedSuggestionsV14) {
    const months = { ...s.months };
    for (const id in months) {
      if (months[id].locked && !months[id].plannedSnapshot) {
        months[id] = {
          ...months[id],
          plannedSnapshot: Object.fromEntries((s.categories || []).map((c) => [c.id, c.planned])),
        };
      }
    }
    s = { ...s, months, suggestionDismissals: s.suggestionDismissals || {}, migratedSuggestionsV14: true };
  }

  return s;
}

function useBudget() {
  const [state, setState] = useState(null);
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState({ code: getSyncCode(), status: "idle" }); // idle|syncing|ok|error
  const updatedAtRef = useRef(0);
  const stateRef = useRef(null);
  const pushTimer = useRef(null);
  // true when localStorage had NO saved state (fresh install / cleared storage).
  // In this case we must ALWAYS pull from remote, never push — the SEED data has
  // preset account balances which would fool a simple isEmpty() check into thinking
  // there's real local data worth pushing up.
  const freshInstallRef = useRef(false);

  // isEmpty: state with no logged transactions and no user-entered balances.
  // Note: this alone is insufficient for SEED data detection — use freshInstallRef instead.
  const isEmpty = (s) => {
    if (!s || !s.months) return true;
    return Object.values(s.months).every((m) =>
      (!m.txns || m.txns.length === 0) &&
      (!m.incomeTxns || m.incomeTxns.length === 0) &&
      (!m.balances || Object.values(m.balances).every((v) => !v || v === 0))
    );
  };

  // initial load: local first, then reconcile with remote if a code is set.
  // On fresh install, remote ALWAYS wins — we never push SEED data up.
  useEffect(() => {
    (async () => {
      const loaded = await loadState();
      const isFresh = !loaded; // true when localStorage was empty / cleared
      freshInstallRef.current = isFresh;
      let data = migrate(loaded ?? SEED);
      // On fresh install, use timestamp 0 so any real remote data is always "newer"
      updatedAtRef.current = isFresh ? 0 : (getLocalUpdatedAt() || Date.now());
      const code = getSyncCode();
      if (code) {
        setSync((s) => ({ ...s, status: "syncing" }));
        try {
          const remote = await pullRemote(code);
          if (remote) {
            const remoteIsNewer = (remote.updatedAt || 0) > updatedAtRef.current;
            if (isFresh || remoteIsNewer) {
              data = migrate(remote.data);
              updatedAtRef.current = remote.updatedAt;
              await saveState(data);
              setLocalUpdatedAt(updatedAtRef.current);
              freshInstallRef.current = false;
            } else if (!isFresh) {
              await pushRemote(code, data, updatedAtRef.current);
            }
          }
          setSync({ code, status: "ok" });
        } catch (_) { setSync({ code, status: "error" }); }
      }
      stateRef.current = data;
      setState(data);
      setReady(true);
    })();
  }, []);

  // persist locally + debounced push to cloud whenever state changes.
  // Never push on a fresh install (until remote has been successfully pulled first).
  useEffect(() => {
    if (!ready || !state) return;
    stateRef.current = state;
    updatedAtRef.current = Date.now();
    saveState(state);
    setLocalUpdatedAt(updatedAtRef.current);
    const code = getSyncCode();
    if (!code) return;
    if (freshInstallRef.current) return; // still fresh — don't push until we've pulled
    if (isEmpty(state)) return; // never overwrite cloud with blank slate
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      setSync((s) => ({ ...s, status: "syncing" }));
      try {
        await pushRemote(code, stateRef.current, updatedAtRef.current);
        setSync({ code, status: "ok" });
      } catch (_) { setSync({ code, status: "error" }); }
    }, 1000);
  }, [state, ready]);

  const update = useCallback((fn) => {
    setState((prev) => (typeof fn === "function" ? fn(prev) : fn));
  }, []);

  // connect: on fresh install, always pull. Otherwise use timestamp to decide.
  const connectSync = useCallback(async (rawCode) => {
    const code = (rawCode || "").trim();
    if (code.length < 6) return { ok: false, error: "Code must be at least 6 characters" };
    setSync({ code, status: "syncing" });
    try {
      const remote = await pullRemote(code);
      if (remote) {
        const isFresh = freshInstallRef.current;
        const remoteIsNewer = (remote.updatedAt || 0) > updatedAtRef.current;
        if (isFresh || remoteIsNewer) {
          const data = migrate(remote.data);
          updatedAtRef.current = remote.updatedAt;
          await saveState(data);
          setLocalUpdatedAt(updatedAtRef.current);
          stateRef.current = data;
          setState(data);
          freshInstallRef.current = false;
        } else if (!isFresh && !isEmpty(stateRef.current)) {
          updatedAtRef.current = Date.now();
          await pushRemote(code, stateRef.current, updatedAtRef.current);
          setLocalUpdatedAt(updatedAtRef.current);
        }
      } else if (!freshInstallRef.current && !isEmpty(stateRef.current)) {
        // Nothing in cloud yet — only push if we have real local data
        updatedAtRef.current = Date.now();
        await pushRemote(code, stateRef.current, updatedAtRef.current);
        setLocalUpdatedAt(updatedAtRef.current);
      }
      setSyncCodeLS(code);
      setSync({ code, status: "ok" });
      return { ok: true };
    } catch (e) {
      setSync({ code, status: "error" });
      return { ok: false, error: "Could not reach the sync server" };
    }
  }, []);

  const disconnectSync = useCallback(() => {
    setSyncCodeLS("");
    setSync({ code: "", status: "idle" });
  }, []);

  return { state, ready, update, sync, connectSync, disconnectSync };
}

/* --------------------------- derived numbers --------------------------- */
function useMonthCalc(state) {
  return useMemo(() => {
    if (!state) return null;
    const month = state.months[state.current];
    const actualByCat = {};
    for (const t of month.txns)
      actualByCat[t.cat] = (actualByCat[t.cat] || 0) + t.amount;

    const monthIdsSorted = Object.keys(state.months).sort();
    const priorIds = monthIdsSorted.slice(0, monthIdsSorted.indexOf(state.current));

    const cats = state.categories.map((c) => {
      const actual = actualByCat[c.id] || 0;
      const paid = month.txns.some((t) => t.cat === c.id && t.fixed);
      let carried = 0;
      if (c.rollover) {
        for (const id of priorIds) {
          const spent = (state.months[id].txns || []).filter((t) => t.cat === c.id).reduce((a, t) => a + t.amount, 0);
          carried += c.planned - spent;
        }
        carried = Math.round(carried * 100) / 100;
      }
      const available = c.planned + carried;
      const diff = available - actual; // +ve = under budget (incl. rolled-over balance)
      // alert level for variable categories: ok | near (>=90%) | over
      const ratio = available > 0 ? actual / available : 0;
      const level = !c.fixed && available > 0 ? (diff < 0 ? "over" : ratio >= 0.9 ? "near" : "ok") : "ok";
      return { ...c, actual, paid, carried, available, diff, level };
    });

    const groups = GROUPS.map((g) => {
      const list = cats.filter((c) => c.group === g.id);
      const planned = list.reduce((s, c) => s + c.planned, 0);
      const actual = list.reduce((s, c) => s + c.actual, 0);
      return { ...g, list, planned, actual, diff: planned - actual };
    });

    const loggedIncome = (month.incomeTxns || []).reduce((s, t) => s + t.amount, 0);

    // Live carry: each month's prior balance = previous month's actual leftover.
    // The earliest month uses its manually entered starting balance (income.prior).
    const ids = Object.keys(state.months).sort();
    let carry = null;
    let prior = month.income.prior || 0;
    for (const id of ids) {
      const mm = state.months[id];
      const base = (mm.income.salary || 0) + (mm.income.other || 0) +
        (mm.incomeTxns || []).reduce((s, t) => s + t.amount, 0);
      const start = carry === null ? (mm.income.prior || 0) : carry;
      const spent = mm.txns.reduce((s, t) => s + t.amount, 0);
      if (id === state.current) { prior = Math.round(start * 100) / 100; break; }
      carry = Math.round((base + start - spent) * 100) / 100;
    }
    const isEarliest = ids[0] === state.current;

    const incomeActual =
      (month.income.salary || 0) + (month.income.other || 0) + prior + loggedIncome;
    const incomePlan =
      (state.plan.income.salary || 0) + (state.plan.income.other || 0) + prior;
    const spentActual = groups.reduce((s, g) => s + g.actual, 0);
    const spentPlan = groups.reduce((s, g) => s + g.planned, 0);

    const base = (state.plan.income.salary || 0) + (state.plan.income.other || 0);
    const ideal = { needs: incomeActual * 0.5, wants: incomeActual * 0.3, savings: incomeActual * 0.2 };

    const fixedCats = cats.filter((c) => c.fixed);
    const alerts = cats.filter((c) => c.level === "near" || c.level === "over");
    const fixed = {
      count: fixedCats.length,
      paidCount: fixedCats.filter((c) => c.paid).length,
      planned: fixedCats.reduce((s, c) => s + c.planned, 0),
      remaining: fixedCats.filter((c) => !c.paid).reduce((s, c) => s + c.planned, 0),
    };

    return {
      month, cats, groups, prior, isEarliest, fixed, alerts,
      incomeActual, incomePlan, spentActual, spentPlan, loggedIncome,
      remainingActual: incomeActual - spentActual,
      remainingPlan: incomePlan - spentPlan,
      base, ideal,
    };
  }, [state]);
}

/* =============================== UI =============================== */
export default function App() { return <ErrorBoundary><AppInner /></ErrorBoundary>; }
function AppInner() {
  const { state, ready, update, sync, connectSync, disconnectSync } = useBudget();
  const calc = useMonthCalc(state);
  const [tab, setTab] = useState("overview"); // overview | activity | plan
  const [groupView, setGroupView] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editIncome, setEditIncome] = useState(false);
  const [editSettings, setEditSettings] = useState(false);
  const [loansInNetWorth, setLoansInNetWorth] = useState(true); // include loans in net worth calculation
  const theme = state?.theme === "light" ? "light" : "dark";
  const rootClass = "bt-root" + (theme === "light" ? " light" : "");

  useEffect(() => {
    document.body.style.background = theme === "light" ? "#F4F5F7" : "#14161A";
  }, [theme]);

  if (!ready || !state || !calc) {
    return (
      <div className={rootClass + " bt-center"}>
        <Style />
        <div className="bt-muted bt-mono">Loading budget…</div>
      </div>
    );
  }

  const monthIds = Object.keys(state.months).sort();
  const idx = monthIds.indexOf(state.current);

  const switchMonth = (dir) => {
    const ni = idx + dir;
    if (ni >= 0 && ni < monthIds.length) update((s) => ({ ...s, current: monthIds[ni] }));
    else if (dir > 0) {
      // create next month, carrying the plan
      const nid = nextMonthId(state.current);
      update((s) => {
        return {
          ...s,
          current: nid,
          months: {
            ...s.months,
            [nid]: {
              id: nid, label: monthMeta(nid).label, payday: "",
              income: { salary: s.recurringIncome ? (s.plan.income.salary || 0) : 0, other: s.plan.income.other, prior: 0 },
              txns: [],
              incomeTxns: [],
              balances: { ...s.months[s.current].balances },
            },
          },
        };
      });
    }
  };

  const isLocked = !!(state.months[state.current]?.locked);
  // Locking also saves the planned amounts as they stand, so later plan changes
  // don't distort budget suggestions for this month.
  const toggleLock = () => update((s) => {
    const cur = s.months[s.current];
    const nowLocked = !cur.locked;
    const next = { ...cur, locked: nowLocked };
    if (nowLocked) next.plannedSnapshot = Object.fromEntries(s.categories.map((c) => [c.id, c.planned]));
    return { ...s, months: { ...s.months, [s.current]: next } };
  });

  const thisMonthId = todayMonthId();
  const isCurrentMonth = state.current === thisMonthId;
  const goToCurrentMonth = () => {
    const target = state.months[thisMonthId] ? thisMonthId : monthIds[monthIds.length - 1];
    update((s) => ({ ...s, current: target }));
  };
  const paydayDate = computePaydayDate(state.current);
  const paydayLabel = paydayDate.toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const paydayMidnight = new Date(paydayDate);
  paydayMidnight.setHours(0, 0, 0, 0);
  const daysUntilPayday = Math.round((paydayMidnight - todayMidnight) / 86400000);
  const isPaid = daysUntilPayday <= 0;
  const countdownLabel = daysUntilPayday === 0 ? "today" : daysUntilPayday === 1 ? "in 1 day" : `in ${daysUntilPayday} days`;

  return (
    <div className={rootClass}>
      <Style />

      <header className="bt-header">
        <button className="bt-iconbtn" onClick={() => switchMonth(-1)} disabled={idx <= 0} aria-label="Previous month">
          <ChevronLeft size={20} />
        </button>
        <div className="bt-month">
          <div className="bt-month-name">
            {isLocked && <Lock size={12} style={{ display: "inline", marginRight: 5, opacity: 0.5, verticalAlign: "middle" }} />}
            {monthMeta(state.current).label}
          </div>
          <div className="bt-month-sub bt-mono">
            {isPaid ? `Paid: ${paydayLabel}` : `Payday: ${paydayLabel} · ${countdownLabel}`}
          </div>
        </div>
        <div className="bt-hdr-right">
          {!isCurrentMonth && (
            <button className="bt-todaybtn" onClick={goToCurrentMonth}>Current Month</button>
          )}
          <button className="bt-iconbtn" onClick={() => switchMonth(1)} aria-label="Next month">
            <ChevronRight size={20} />
          </button>
          <button className={"bt-iconbtn" + (isLocked ? " lock-on" : "")} onClick={toggleLock} title={isLocked ? "Unlock month" : "Lock month"} aria-label="Toggle lock">
            {isLocked ? <Lock size={17} /> : <Unlock size={17} />}
          </button>
          <button className="bt-iconbtn" onClick={() => setEditSettings(true)} aria-label="Settings">
            <Settings size={19} />
          </button>
        </div>
      </header>

      {isLocked && (
        <div className="bt-lock-banner">
          <Lock size={13} /> This month is locked — unlock to make changes
        </div>
      )}

      <main className="bt-main">
        {tab === "overview" && (
          <Overview calc={calc} onOpenGroup={(g) => { setGroupView(g); setTab("plan"); }} onEditIncome={() => { if (!isLocked) setEditIncome(true); }} isLocked={isLocked} />
        )}
        {tab === "activity" && (
          <Activity state={state} calc={calc} update={update} isLocked={isLocked} />
        )}
        {tab === "plan" && (
          <Plan state={state} calc={calc} update={update} groupView={groupView} setGroupView={setGroupView} isLocked={isLocked} />
        )}
        {tab === "insights" && (
          <Insights state={state} calc={calc} update={update} theme={theme} loansInNetWorth={loansInNetWorth} setLoansInNetWorth={setLoansInNetWorth} isLocked={isLocked} />
        )}
      </main>

      <nav className="bt-nav">
        <NavBtn active={tab === "overview"} icon={<LayoutGrid size={20} />} label="Overview" onClick={() => setTab("overview")} />
        <NavBtn active={tab === "activity"} icon={<Receipt size={20} />} label="Activity" onClick={() => setTab("activity")} />
        <button className={"bt-fab" + (isLocked ? " disabled" : "")} onClick={() => { if (!isLocked) setAdding(true); }} aria-label="Add expense" title={isLocked ? "Month is locked" : "Add expense"}><Plus size={24} /></button>
        <NavBtn active={tab === "plan"} icon={<SlidersHorizontal size={20} />} label="Plan" onClick={() => { setGroupView(null); setTab("plan"); }} />
        <NavBtn active={tab === "insights"} icon={<BarChart3 size={20} />} label="Insights" onClick={() => setTab("insights")} />
      </nav>

      {adding && <AddEntry state={state} update={update} onClose={() => setAdding(false)} />}
      {editIncome && <IncomeSheet state={state} calc={calc} update={update} onClose={() => setEditIncome(false)} />}
      {editSettings && <SettingsSheet state={state} update={update} theme={theme} sync={sync} connectSync={connectSync} disconnectSync={disconnectSync} onClose={() => setEditSettings(false)} />}
    </div>
  );
}

function NavBtn({ active, icon, label, onClick }) {
  return (
    <button className={"bt-navbtn" + (active ? " is-active" : "")} onClick={onClick}>
      {icon}<span>{label}</span>
    </button>
  );
}

/* ------------------------------ OVERVIEW ------------------------------ */
function Overview({ calc, onOpenGroup, onEditIncome, isLocked }) {
  const { incomeActual, spentActual, remainingActual, groups } = calc;
  const over = remainingActual < 0;
  const pctSpent = incomeActual > 0 ? Math.min(spentActual / incomeActual, 1) : 0;

  return (
    <div className="bt-stack">
      {/* HERO — the zero line */}
      <section className="bt-hero">
        <div className="bt-hero-label bt-mono">{over ? "OVER BUDGET" : "UNSPENT THIS MONTH"}</div>
        <div className={"bt-hero-amount bt-mono" + (over ? " is-over" : " is-under")}>
          {over ? fmt(Math.abs(remainingActual)) : fmt(remainingActual)}
        </div>
        <div className="bt-hero-row bt-mono">
          <button className="bt-link" onClick={onEditIncome}>{fmt(incomeActual)} in</button>
          <span>·</span>
          <span>{fmt(spentActual)} allocated</span>
        </div>

        {/* segmented allocation bar */}
        <div className="bt-bar" role="img" aria-label="Allocation by group">
          {groups.map((g) => {
            const w = incomeActual > 0 ? (g.actual / incomeActual) * 100 : 0;
            return <div key={g.id} className="bt-bar-seg" style={{ width: `${w}%`, background: g.color }} title={`${g.label}: ${fmt(g.actual)}`} />;
          })}
          <div className="bt-bar-rest" style={{ width: `${Math.max(0, (1 - pctSpent) * 100)}%` }} />
        </div>
        <div className="bt-legend bt-mono">
          {groups.map((g) => (
            <span key={g.id}><i style={{ background: g.color }} />{g.label}</span>
          ))}
        </div>
      </section>

      {calc.alerts.length > 0 && (
        <button type="button" className="bt-alertbar" onClick={() => onOpenGroup(null)}>
          {calc.alerts.length} {calc.alerts.length === 1 ? "category" : "categories"} near or over budget
          <span className="bt-mono">{calc.alerts.map((c) => c.name).slice(0, 4).join(", ")}{calc.alerts.length > 4 ? "…" : ""}</span>
        </button>
      )}

      {/* group cards */}
      {groups.map((g) => {
        const ratio = g.planned > 0 ? Math.min(g.actual / g.planned, 1.4) : 0;
        const overG = g.diff < 0;
        return (
          <button key={g.id} className="bt-card bt-group" onClick={() => onOpenGroup(g.id)}>
            <div className="bt-group-top">
              <span className="bt-group-name"><i style={{ background: g.color }} />{g.label}</span>
              <span className={"bt-diff bt-mono" + (overG ? " is-over" : " is-under")}>{fmtSigned(g.diff)}</span>
            </div>
            <div className="bt-group-nums bt-mono">
              <strong>{fmt(g.actual)}</strong> <span className="bt-muted">of {fmt(g.planned)}</span>
            </div>
            <div className="bt-track">
              <div className="bt-track-fill" style={{ width: `${ratio * 71}%`, background: overG ? "var(--over)" : g.color }} />
              <div className="bt-track-mark" style={{ left: "71%" }} />
            </div>
          </button>
        );
      })}

      {calc.fixed.count > 0 && (
        <button className="bt-card bt-fixedcard" onClick={() => onOpenGroup(null)}>
          <div className="bt-group-top">
            <span className="bt-group-name"><Check size={15} style={{ color: "var(--accent)" }} />Fixed costs</span>
            <span className="bt-mono bt-muted">{calc.fixed.paidCount}/{calc.fixed.count} paid</span>
          </div>
          <div className="bt-group-nums bt-mono">
            {calc.fixed.remaining > 0
              ? <><strong>{fmt(calc.fixed.remaining)}</strong> <span className="bt-muted">of {fmt(calc.fixed.planned)} still to pay</span></>
              : <span className="is-under">All predictable bills paid</span>}
          </div>
          <div className="bt-track">
            <div className="bt-track-fill" style={{
              width: `${calc.fixed.planned > 0 ? ((calc.fixed.planned - calc.fixed.remaining) / calc.fixed.planned) * 100 : 0}%`,
              background: "var(--accent)",
            }} />
          </div>
        </button>
      )}

      <Ratio503020 calc={calc} />
    </div>
  );
}

function Ratio503020({ calc }) {
  const { ideal, groups, incomeActual } = calc;
  if (incomeActual <= 0) return null;
  const rows = [
    { label: "Needs", got: groups[0].planned, want: ideal.needs, lowerIsBetter: true },
    { label: "Wants", got: groups[1].planned, want: ideal.wants, lowerIsBetter: true },
    { label: "Savings & Debt", got: groups[2].planned, want: ideal.savings, lowerIsBetter: false },
  ];
  return (
    <section className="bt-card">
      <div className="bt-card-h">50 / 30 / 20 check<span className="bt-muted bt-mono"> on {fmt(incomeActual)}</span></div>
      <div className="bt-ratio-grid bt-mono">
        <div className="bt-ratio-header">
          <span></span>
          <span className="bt-muted">Actual</span>
          <span className="bt-muted">Planned</span>
          <span className="bt-muted">Diff</span>
        </div>
        {rows.map((r) => {
          const diff = r.got - r.want;
          const good = r.lowerIsBetter ? diff <= 0 : diff >= 0;
          return (
            <div key={r.label} className="bt-ratio-row">
              <span>{r.label}</span>
              <span>{fmt(r.got)}</span>
              <span className="bt-muted">{fmt(r.want)}</span>
              <span className={good ? "is-under" : "is-over"}>{fmtSigned(diff)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------- PLAN -------------------------------- */
function EditCategoriesSheet({ group, state, update, onClose }) {
  const [confirmId, setConfirmId] = useState(null);
  const [newName, setNewName] = useState("");
  const cats = state.categories.filter((c) => c.group === group.id);

  const addCat = () => {
    const name = newName.trim() || "New category";
    update((s) => ({ ...s, categories: [...s.categories, { id: uid(), group: group.id, name, planned: 0, fixed: false }] }));
    setNewName("");
  };
  const delCat = (id) => {
    update((s) => ({
      ...s,
      categories: s.categories.filter((c) => c.id !== id),
      months: Object.fromEntries(Object.entries(s.months).map(([k, m]) =>
        [k, { ...m, txns: (m.locked ? m.txns : m.txns.filter((t) => t.cat !== id)) }])),
    }));
    setConfirmId(null);
  };
  const movecat = (id, dir) => {
    update((s) => {
      const all = [...s.categories];
      const idx = all.findIndex((c) => c.id === id);
      const target = idx + dir;
      if (target < 0 || target >= all.length) return s;
      // only swap within same group
      if (all[target].group !== group.id) return s;
      [all[idx], all[target]] = [all[target], all[idx]];
      return { ...s, categories: all };
    });
  };

  return (
    <Sheet title={`Edit ${group.label} categories`} onClose={onClose}>
      <div className="bt-editcats">
        {cats.map((c, i) => (
          <div key={c.id} className="bt-editcat-row">
            <div className="bt-editcat-arrows">
              <button type="button" className="bt-iconbtn sm" onClick={() => movecat(c.id, -1)} disabled={i === 0} aria-label="Move up"><ChevronUp size={14} /></button>
              <button type="button" className="bt-iconbtn sm" onClick={() => movecat(c.id, 1)} disabled={i === cats.length - 1} aria-label="Move down"><ChevronDown size={14} /></button>
            </div>
            <span className="bt-editcat-name">{c.name}{c.fixed && <span className="bt-tag" style={{ marginLeft: 6 }}>fixed</span>}</span>
            {confirmId === c.id ? (
              <div className="bt-editcat-confirm">
                <span className="bt-muted" style={{ fontSize: 12 }}>Delete?</span>
                <button type="button" className="bt-del sm" onClick={() => delCat(c.id)}>Yes</button>
                <button type="button" className="bt-done" onClick={() => setConfirmId(null)}>No</button>
              </div>
            ) : (
              <button type="button" className="bt-del" onClick={() => setConfirmId(c.id)} aria-label="Delete category"><Trash2 size={14} /></button>
            )}
          </div>
        ))}
      </div>
      <div className="bt-editcat-add">
        <input
          className="bt-input"
          placeholder="New category name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCat()}
        />
        <button type="button" className="bt-savebtn" onClick={addCat}><Plus size={15} /> Add</button>
      </div>
    </Sheet>
  );
}

function Plan({ state, calc, update, groupView, setGroupView, isLocked }) {
  const [editing, setEditing] = useState(null); // category id
  const [editGroup, setEditGroup] = useState(null); // group id for EditCategoriesSheet
  const shown = groupView ? GROUPS.filter((g) => g.id === groupView) : GROUPS;

  const setCat = (id, patch) =>
    update((s) => ({ ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const togglePaid = (c) =>
    update((s) => {
      const m = s.months[s.current];
      const has = m.txns.some((t) => t.cat === c.id && t.fixed);
      const txns = has
        ? m.txns.filter((t) => !(t.cat === c.id && t.fixed))
        : [...m.txns, { id: uid(), cat: c.id, amount: c.planned, date: new Date().toISOString().slice(0, 10), fixed: true, note: "Fixed cost" }];
      return { ...s, months: { ...s.months, [s.current]: { ...m, txns } } };
    });
  const allFixedPaid = calc.fixed.count > 0 && calc.fixed.paidCount === calc.fixed.count;
  const toggleAllFixed = () =>
    update((s) => {
      const m = s.months[s.current];
      const today = new Date().toISOString().slice(0, 10);
      let txns;
      if (allFixedPaid) {
        txns = m.txns.filter((t) => !t.fixed);
      } else {
        const paidIds = new Set(m.txns.filter((t) => t.fixed).map((t) => t.cat));
        const add = s.categories.filter((c) => c.fixed && !paidIds.has(c.id))
          .map((c) => ({ id: uid(), cat: c.id, amount: c.planned, date: today, fixed: true, note: "Fixed cost" }));
        txns = [...m.txns, ...add];
      }
      return { ...s, months: { ...s.months, [s.current]: { ...m, txns } } };
    });

  const editGroupObj = editGroup ? GROUPS.find((g) => g.id === editGroup) : null;

  return (
    <div className="bt-stack">
      {groupView && (
        <button className="bt-back" onClick={() => setGroupView(null)}><ChevronLeft size={16} /> All groups</button>
      )}
      {calc.fixed.count > 0 && (
        <button type="button" className={"bt-payall" + (allFixedPaid ? " on" : "")} onClick={toggleAllFixed}>
          <span><Check size={15} strokeWidth={3} /> {allFixedPaid ? "All fixed bills paid" : `Pay all fixed bills (${calc.fixed.count - calc.fixed.paidCount} left · ${fmt(calc.fixed.remaining)})`}</span>
          <span className="bt-mono bt-muted">{allFixedPaid ? "tap to clear" : "tap to pay"}</span>
        </button>
      )}
      {shown.map((g) => {
        const gc = calc.groups.find((x) => x.id === g.id);
        return (
          <section key={g.id} className="bt-card">
            <div className="bt-card-h">
              <span><i style={{ background: g.color }} className="bt-dot" />{g.label}</span>
              <span className="bt-mono bt-muted">{fmt(gc.actual)} / {fmt(gc.planned)}</span>
            </div>
            {gc.list.map((c) => (
              <div key={c.id} className="bt-line">
                {editing === c.id ? (
                  <div className="bt-edit">
                    <input className="bt-input" defaultValue={c.name} onBlur={(e) => setCat(c.id, { name: e.target.value })} />
                    <div className="bt-edit-row">
                      <span className="bt-mono bt-muted">plan €</span>
                      <input className="bt-input bt-input-num bt-mono" type="number" inputMode="decimal" defaultValue={c.planned}
                        onFocus={(e) => e.target.select()}
                        onBlur={(e) => setCat(c.id, { planned: parseFloat(e.target.value) || 0 })} />
                      <button type="button" className="bt-done" onClick={() => setEditing(null)}>Done</button>
                    </div>
                    <button type="button" className={"bt-fixed-toggle" + (c.fixed ? " on" : "")} onClick={() => setCat(c.id, { fixed: !c.fixed })}>
                      {c.fixed ? "Fixed bill — tick to pay" : "Variable — log as you spend"}
                    </button>
                    {c.fixed && (
                      <button type="button" className={"bt-paybtn" + (c.paid ? " on" : "")} onClick={() => togglePaid(c)}>
                        {c.paid ? <><Check size={15} strokeWidth={3} /> Paid {fmt(c.planned)} — tap to undo</> : `Mark as paid (${fmt(c.planned)})`}
                      </button>
                    )}
                    {!c.fixed && (
                      <button type="button" className={"bt-fixed-toggle" + (c.rollover ? " on" : "")} onClick={() => setCat(c.id, { rollover: !c.rollover })}>
                        {c.rollover ? "Rollover on — unspent carries to next month" : "Rollover off — resets each month"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="bt-line-row">
                    {c.fixed && (
                      <button type="button" className={"bt-tick" + (c.paid ? " on" : "")} onClick={() => togglePaid(c)}
                        aria-label={c.paid ? "Mark unpaid" : "Mark paid"} aria-pressed={c.paid}>
                        <Check size={15} strokeWidth={3} />
                      </button>
                    )}
                    <button type="button" className="bt-line-main" onClick={() => { if (!isLocked) setEditing(c.id); }}>
                      <div className={"bt-line-name" + (c.paid ? " paid" : "")}>
                        {c.name}
                        {c.fixed && <span className="bt-tag">{c.paid ? "paid" : "fixed"}</span>}
                        {c.rollover && <span className="bt-tag">rollover</span>}
                        {c.level === "near" && <span className="bt-tag near">near</span>}
                        {c.level === "over" && <span className="bt-tag over">over</span>}
                        <PencilLine size={12} className="bt-pencil" />
                      </div>
                      <div className="bt-line-nums bt-mono">
                        <span><strong>{fmt(c.actual)}</strong> <span className="bt-muted">/ {fmt(c.available)}{c.rollover && c.carried !== 0 ? ` · carry ${fmtSigned(c.carried)}` : ""}</span></span>
                        <span className={"bt-diff" + (c.diff < 0 ? " is-over" : " is-under")}>{fmtSigned(c.diff)}</span>
                      </div>
                      <div className="bt-track sm">
                        <div className="bt-track-fill" style={{
                          width: `${c.available > 0 ? Math.min(c.actual / c.available, 1.4) * 71 : 0}%`,
                          background: (c.level === "over" || c.diff < 0) ? "var(--over)" : c.level === "near" ? "var(--accent)" : g.color,
                        }} />
                        <div className="bt-track-mark" style={{ left: "71%" }} />
                      </div>
                    </button>
                  </div>
                )}
              </div>
            ))}
            {!isLocked && (
              <button className="bt-add-cat" onClick={() => setEditGroup(g.id)}>
                <SlidersHorizontal size={14} /> Edit categories
              </button>
            )}
          </section>
        );
      })}
      {editGroupObj && (
        <EditCategoriesSheet group={editGroupObj} state={state} update={update} onClose={() => setEditGroup(null)} />
      )}
    </div>
  );
}

/* ------------------------------ ACTIVITY ------------------------------ */
function Activity({ state, calc, update, isLocked }) {
  const month = state.months[state.current];
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const catName = (id) => state.categories.find((c) => c.id === id)?.name ?? "—";
  const catGroup = (id) => state.categories.find((c) => c.id === id)?.group;

  const allItems = [
    ...month.txns.map((t) => ({ ...t, kind: "expense" })),
    ...(month.incomeTxns || []).map((t) => ({ ...t, kind: "income" })),
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const del = (item) =>
    update((s) => {
      const m = s.months[s.current];
      const patch = item.kind === "income"
        ? { incomeTxns: (m.incomeTxns || []).filter((t) => t.id !== item.id) }
        : { txns: m.txns.filter((t) => t.id !== item.id) };
      return { ...s, months: { ...s.months, [s.current]: { ...m, ...patch } } };
    });

  if (allItems.length === 0)
    return (
      <div className="bt-stack">
        <div className="bt-empty">
          <div className="bt-empty-h">Nothing logged yet</div>
          <div className="bt-muted">Tap <Plus size={14} className="bt-inl" /> to log an expense or income for {monthMeta(state.current).label}.</div>
        </div>
      </div>
    );

  const ql = q.trim().toLowerCase();
  const items = allItems.filter((t) => {
    if (filter === "income" && t.kind !== "income") return false;
    if (filter !== "all" && filter !== "income" && t.cat !== filter) return false;
    if (!ql) return true;
    const hay = (t.kind === "income" ? t.source || "" : `${catName(t.cat)} ${t.note || ""}`).toLowerCase();
    return hay.includes(ql);
  });

  const sub = {};
  items.filter((t) => t.kind !== "income").forEach((t) => { sub[t.cat] = (sub[t.cat] || 0) + t.amount; });
  const subtotals = Object.entries(sub).map(([id, amt]) => ({ name: catName(id), amt })).sort((a, b) => b.amt - a.amt);
  const shownOut = items.filter((t) => t.kind !== "income").reduce((a, t) => a + t.amount, 0);
  const shownIn = items.filter((t) => t.kind === "income").reduce((a, t) => a + t.amount, 0);

  return (
    <div className="bt-stack">
      <div className="bt-actfilter">
        <input className="bt-input" placeholder="Search notes & categories…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="bt-input bt-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="income">Income only</option>
          {GROUPS.map((g) => (
            <optgroup key={g.id} label={g.label}>
              {state.categories.filter((c) => c.group === g.id).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="bt-card-h bt-pad bt-mono">{fmt(shownOut)} out · {fmt(shownIn)} in</div>
      {subtotals.length > 1 && (
        <details className="bt-card bt-subs">
          <summary>Subtotals by category</summary>
          {subtotals.map((s) => (
            <div key={s.name} className="bt-sub-row bt-mono"><span className="bt-muted">{s.name}</span><span>{fmt(s.amt)}</span></div>
          ))}
        </details>
      )}
      {items.length === 0 ? (
        <div className="bt-empty"><div className="bt-muted">No matching entries.</div></div>
      ) : items.map((t) => {
        if (t.kind === "income") {
          return (
            <div key={t.id} className="bt-txn">
              <i className="bt-dot" style={{ background: "var(--under)" }} />
              <div className="bt-txn-mid">
                <div className="bt-txn-name">{t.source}</div>
                <div className="bt-txn-sub bt-mono">{t.date} · income</div>
              </div>
              <div className="bt-txn-amt bt-mono is-under">{fmtSigned(t.amount)}</div>
              {!isLocked && <button type="button" className="bt-del" onClick={() => del(t)} aria-label="Delete"><Trash2 size={15} /></button>}
            </div>
          );
        }
        const g = GROUP[catGroup(t.cat)] || {};
        return (
          <div key={t.id} className="bt-txn">
            <i className="bt-dot" style={{ background: g.color || "var(--line)" }} />
            <div className="bt-txn-mid">
              <div className="bt-txn-name">{catName(t.cat)}{t.fixed ? " · fixed" : ""}</div>
              <div className="bt-txn-sub bt-mono">{t.date}{t.note ? ` · ${t.note}` : ""}</div>
            </div>
            <div className="bt-txn-amt bt-mono">{fmt(t.amount)}</div>
            {!isLocked && <button type="button" className="bt-del" onClick={() => del(t)} aria-label="Delete"><Trash2 size={15} /></button>}
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------- ADD ENTRY ----------------------------- */
function AddEntry({ state, update, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState("expense");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState(state.categories[0]?.id);
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today);

  const amt = parseFloat(amount);
  const valid = amt > 0 && (mode === "income" || !!cat);

  const save = () => {
    if (!valid) return;
    update((s) => {
      const m = s.months[s.current];
      if (mode === "expense") {
        return { ...s, months: { ...s.months, [s.current]: { ...m, txns: [...m.txns, { id: uid(), cat, amount: amt, note: note.trim(), date }] } } };
      }
      const incomeTxns = m.incomeTxns || [];
      return { ...s, months: { ...s.months, [s.current]: { ...m, incomeTxns: [...incomeTxns, { id: uid(), amount: amt, source: source.trim() || "Income", date }] } } };
    });
    onClose();
  };

  return (
    <Sheet title="Add entry" onClose={onClose}>
      <div className="bt-seg">
        <button className={mode === "expense" ? "is-on" : ""} onClick={() => setMode("expense")}>Expense</button>
        <button className={"income " + (mode === "income" ? "is-on" : "")} onClick={() => setMode("income")}>Income</button>
      </div>

      <label className="bt-field-l bt-mono">Amount</label>
      <div className="bt-amount-in">
        <span>€</span>
        <input className="bt-input bt-amount bt-mono" type="number" inputMode="decimal" autoFocus
          placeholder="0.00" value={amount} onFocus={(e) => e.target.select()} onChange={(e) => setAmount(e.target.value)} />
      </div>

      {mode === "expense" ? (
        <>
          <label className="bt-field-l bt-mono">Category</label>
          <select className="bt-input bt-select" value={cat} onChange={(e) => setCat(e.target.value)}>
            {GROUPS.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {state.categories.filter((c) => c.group === g.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="bt-two">
            <div>
              <label className="bt-field-l bt-mono">Date</label>
              <input className="bt-input bt-mono" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="bt-field-l bt-mono">Note</label>
              <input className="bt-input" placeholder="optional" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        </>
      ) : (
        <div className="bt-two">
          <div>
            <label className="bt-field-l bt-mono">Source</label>
            <input className="bt-input" placeholder="e.g. refund, bonus" value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          <div>
            <label className="bt-field-l bt-mono">Date</label>
            <input className="bt-input bt-mono" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      )}

      <button className={"bt-primary" + (mode === "income" ? " income" : "")} onClick={save} disabled={!valid}>
        Save {mode}
      </button>
    </Sheet>
  );
}

/* ----------------------------- INCOME SHEET ----------------------------- */
function IncomeRow({ label, val, set, hint }) {
  return (
    <div className="bt-inc-row">
      <div><div className="bt-inc-l">{label}</div>{hint && <div className="bt-muted bt-tiny">{hint}</div>}</div>
      <div className="bt-amount-in sm"><span>€</span>
        <input className="bt-input bt-mono" type="number" inputMode="decimal" value={val}
          onFocus={(e) => e.target.select()} onChange={(e) => set(e.target.value)} />
      </div>
    </div>
  );
}

function IncomeSheet({ state, calc, update, onClose }) {
  const m = state.months[state.current];
  const [salary, setSalary] = useState(m.income.salary);
  const [other, setOther] = useState(m.income.other);
  const [prior, setPrior] = useState(m.income.prior);

  const save = () => {
    update((s) => ({
      ...s,
      months: { ...s.months, [s.current]: { ...m, income: {
        salary: +salary || 0, other: +other || 0,
        prior: calc.isEarliest ? (+prior || 0) : (m.income.prior || 0),
      } } },
    }));
    onClose();
  };

  const effectivePrior = calc.isEarliest ? (+prior || 0) : calc.prior;

  return (
    <Sheet title={`Income · ${monthMeta(state.current).label}`} onClose={onClose}>
      <IncomeRow label="After-tax salary" val={salary} set={setSalary} hint={`plan ${fmt(state.plan.income.salary)}`} />
      <IncomeRow label="Other income" val={other} set={setOther} />
      {calc.isEarliest ? (
        <IncomeRow label="Starting balance" val={prior} set={setPrior} hint="money on hand before this month" />
      ) : (
        <div className="bt-inc-row">
          <div><div className="bt-inc-l">Prior month-end balance</div><div className="bt-muted bt-tiny">carried live from the previous month</div></div>
          <div className={"bt-mono " + (calc.prior < 0 ? "is-over" : "")} style={{ fontSize: 15 }}>{fmt(calc.prior)}</div>
        </div>
      )}
      <div className="bt-inc-row">
        <div><div className="bt-inc-l">Logged income</div><div className="bt-muted bt-tiny">added via the + button</div></div>
        <div className="bt-mono is-under" style={{ fontSize: 15 }}>{fmt(calc.loggedIncome)}</div>
      </div>
      <div className="bt-inc-total bt-mono">
        <span>Available</span>
        <strong>{fmt((+salary || 0) + (+other || 0) + effectivePrior + calc.loggedIncome)}</strong>
      </div>
      <button className="bt-primary" onClick={save}>Save income</button>
    </Sheet>
  );
}

/* ------------------------------ INSIGHTS ------------------------------ */
function Insights({ state, calc, update, theme, loansInNetWorth, setLoansInNetWorth, isLocked }) {
  const m = state.months[state.current];
  const [snapDate, setSnapDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showReport, setShowReport] = useState(false);
  const [loanEdit, setLoanEdit] = useState(null); // { loanId, value } when editing a loan balance
  const [confirmDismiss, setConfirmDismiss] = useState(null); // category id awaiting dismiss confirmation

  const saveSnapshot = () =>
    update((s) => {
      const mb = s.months[s.current].balances || {};
      const held = s.accounts.filter((a) => !a.liquid);
      const total = held.filter((a) => a.kind === "asset").reduce((t, a) => t + (mb[a.id] || 0), 0)
        - held.filter((a) => a.kind === "owed").reduce((t, a) => t + (mb[a.id] || 0), 0);
      const balances = {};
      held.forEach((a) => { balances[a.id] = mb[a.id] || 0; });
      const others = (s.wealthSnapshots || []).filter((x) => x.date !== snapDate);
      const snaps = [...others, { id: uid(), date: snapDate, total: Math.round(total * 100) / 100, balances }]
        .sort((a, b) => a.date.localeCompare(b.date));
      return { ...s, wealthSnapshots: snaps };
    });
  const delSnapshot = (sid) =>
    update((s) => ({ ...s, wealthSnapshots: (s.wealthSnapshots || []).filter((x) => x.id !== sid) }));

  const setBalance = (accId, v) =>
    update((s) => ({
      ...s,
      months: { ...s.months, [s.current]: { ...m, balances: { ...m.balances, [accId]: parseFloat(v) || 0 } } },
    }));
  const toggleBreakdown = (accId) =>
    update((s) => ({ ...s, accounts: s.accounts.map((a) => (a.id === accId ? { ...a, breakdown: !a.breakdown } : a)) }));
  const itemsFor = (accId) => m.balanceItems?.[accId] || [];
  const recomputeFromItems = (mm, accId, items) => {
    const total = items.reduce((t, it) => t + (parseFloat(it.amount) || 0), 0);
    return { ...mm, balanceItems: { ...mm.balanceItems, [accId]: items }, balances: { ...mm.balances, [accId]: total } };
  };
  const addBalanceItem = (accId) =>
    update((s) => {
      const mm = s.months[s.current];
      const items = [...(mm.balanceItems?.[accId] || []), { id: uid(), label: "", amount: 0 }];
      return { ...s, months: { ...s.months, [s.current]: recomputeFromItems(mm, accId, items) } };
    });
  const removeBalanceItem = (accId, itemId) =>
    update((s) => {
      const mm = s.months[s.current];
      const items = (mm.balanceItems?.[accId] || []).filter((it) => it.id !== itemId);
      return { ...s, months: { ...s.months, [s.current]: recomputeFromItems(mm, accId, items) } };
    });
  const setBalanceItem = (accId, itemId, field, value) =>
    update((s) => {
      const mm = s.months[s.current];
      const items = (mm.balanceItems?.[accId] || []).map((it) => (it.id === itemId ? { ...it, [field]: value } : it));
      return { ...s, months: { ...s.months, [s.current]: recomputeFromItems(mm, accId, items) } };
    });
  const toggleKind = (accId) =>
    update((s) => ({
      ...s,
      accounts: s.accounts.map((a) => (a.id === accId ? { ...a, kind: a.kind === "asset" ? "owed" : "asset" } : a)),
    }));
  const renameAcc = (accId, name) =>
    update((s) => ({ ...s, accounts: s.accounts.map((a) => (a.id === accId ? { ...a, name } : a)) }));
  const addAcc = () =>
    update((s) => ({ ...s, accounts: [...s.accounts, { id: uid(), name: "New account", kind: "asset", liquid: true }] }));
  const delAcc = (accId) =>
    update((s) => ({
      ...s,
      accounts: s.accounts.filter((a) => a.id !== accId),
      months: Object.fromEntries(Object.entries(s.months).map(([k, mm]) => {
        const b = { ...mm.balances }; delete b[accId]; return [k, { ...mm, balances: b }];
      })),
    }));
  const toggleLiquid = (accId) =>
    update((s) => ({ ...s, accounts: s.accounts.map((a) => (a.id === accId ? { ...a, liquid: !a.liquid } : a)) }));
  // Hide a budget suggestion for the rest of this calendar month; it is reassessed next month.
  const dismissSuggestion = (catId) => {
    update((s) => ({ ...s, suggestionDismissals: { ...(s.suggestionDismissals || {}), [catId]: todayMonthId() } }));
    setConfirmDismiss(null);
  };

  const bal = (a) => m.balances[a.id] || 0;

  // Compute loan balance dynamically from linked category transactions across all months,
  // starting from the initial stored balance (first month where the loan has a non-zero value).
  const computedLoanBal = (loan) => {
    if (!loan.loanMeta?.linkedCategories) return bal(loan);
    const linkedCatIds = new Set(
      state.categories.filter((c) =>
        loan.loanMeta.linkedCategories.some((n) =>
          c.name.toLowerCase() === n.toLowerCase() ||
          c.name.toLowerCase().includes(n.toLowerCase()) ||
          n.toLowerCase().includes(c.name.toLowerCase())
        )
      ).map((c) => c.id)
    );
    const totalPaid = Object.values(state.months)
      .flatMap((mo) => mo.txns || [])
      .filter((t) => linkedCatIds.has(t.cat))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const sortedIds = Object.keys(state.months).sort();
    let initialBalance = loan.loanMeta.originalAmount;
    for (const id of sortedIds) {
      const b = state.months[id].balances?.[loan.id];
      if (b > 0) { initialBalance = b; break; }
    }
    return Math.max(0, initialBalance - totalPaid);
  };

  const totalAssets = state.accounts.filter((a) => a.kind === "asset").reduce((s, a) => s + bal(a), 0);
  const totalOwed = state.accounts.filter((a) => a.kind === "owed").reduce((s, a) => s + bal(a), 0);
  const totalLoans = loansInNetWorth ? state.accounts.filter((a) => a.kind === "loan").reduce((s, a) => s + computedLoanBal(a), 0) : 0;
  const netWorth = totalAssets - totalOwed - totalLoans;
  const liquidAssets = state.accounts.filter((a) => a.kind === "asset" && a.liquid).reduce((s, a) => s + bal(a), 0);
  const liquidOwed = state.accounts.filter((a) => a.kind === "owed" && a.liquid).reduce((s, a) => s + bal(a), 0);
  const netCash = liquidAssets - liquidOwed;
  const expected = calc.remainingActual;
  const diff = netCash - expected;
  const reconciled = Math.abs(diff) < 0.01;
  const anyBal = Object.keys(m.balances || {}).length > 0;

  const liquidAccts = state.accounts.filter((a) => a.liquid);
  const heldAccts = state.accounts.filter((a) => !a.liquid);
  const heldAssets = heldAccts.filter((a) => a.kind === "asset").reduce((s, a) => s + bal(a), 0);
  const heldOwed = heldAccts.filter((a) => a.kind === "owed").reduce((s, a) => s + bal(a), 0);
  const heldTotal = heldAssets - heldOwed;
  const anyCashBal = liquidAccts.some((a) => m.balances[a.id] != null);
  const addHeld = () =>
    update((s) => ({ ...s, accounts: [...s.accounts, { id: uid(), name: "New holding", kind: "asset", liquid: false }] }));
  const accRow = (a) => {
    const items = itemsFor(a.id);
    return (
      <div key={a.id} className="bt-acc-wrap">
        <div className="bt-acc">
          <button type="button" className={"bt-kind " + a.kind} onClick={() => toggleKind(a.id)} title="Asset / owed / loan">
            {a.kind === "asset" ? "＋" : a.kind === "owed" ? "−" : "📋"}
          </button>
          <input className="bt-acc-name" defaultValue={a.name} onBlur={(e) => renameAcc(a.id, e.target.value)} />
          {a.kind !== "loan" && (
            <button type="button" className={"bt-liq" + (a.liquid ? " on" : "")} onClick={() => toggleLiquid(a.id)} title="Move between cash and held">
              {a.liquid ? "cash" : "held"}
            </button>
          )}
          {a.kind !== "loan" && (
            <button type="button" className={"bt-split" + (a.breakdown ? " on" : "")} onClick={() => toggleBreakdown(a.id)} title="Split into multiple amounts">
              <Layers size={13} />
            </button>
          )}
          <div className="bt-amount-in xs">
            <span>€</span>
            {a.breakdown ? (
              <input className="bt-input bt-mono is-computed" type="number" value={m.balances[a.id] ?? 0} readOnly tabIndex={-1} title="Total of the amounts below" />
            ) : (
              <input className="bt-input bt-mono" type="number" inputMode="decimal" value={m.balances[a.id] ?? ""}
                placeholder="0" onFocus={(e) => e.target.select()} onChange={(e) => { if (!isLocked) setBalance(a.id, e.target.value); }} readOnly={isLocked} />
            )}
          </div>
          <button type="button" className="bt-del" onClick={() => delAcc(a.id)} aria-label="Remove account"><Trash2 size={14} /></button>
        </div>
        {a.breakdown && (
          <div className="bt-breakdown">
            {items.map((it) => (
              <div key={it.id} className="bt-breakdown-row">
                <input className="bt-input bt-breakdown-label" placeholder="e.g. Sarah" defaultValue={it.label}
                  onBlur={(e) => setBalanceItem(a.id, it.id, "label", e.target.value)} />
                <div className="bt-amount-in xs">
                  <span>€</span>
                  <input className="bt-input bt-mono" type="number" inputMode="decimal" value={it.amount ?? ""}
                    placeholder="0" onFocus={(e) => e.target.select()}
                    onChange={(e) => setBalanceItem(a.id, it.id, "amount", e.target.value)} />
                </div>
                <button type="button" className="bt-del sm" onClick={() => removeBalanceItem(a.id, it.id)} aria-label="Remove amount"><Trash2 size={12} /></button>
              </div>
            ))}
            <button type="button" className="bt-add-cat sm" onClick={() => addBalanceItem(a.id)}><Plus size={12} /> Add amount</button>
          </div>
        )}
      </div>
    );
  };

  const series = buildSeries(state);
  const snaps = (state.wealthSnapshots || []).slice().sort((a, b) => a.date.localeCompare(b.date))
    .map((x) => ({ ...x, label: new Date(x.date).toLocaleDateString("en-IE", { day: "2-digit", month: "short" }) }));
  const lastSnap = snaps.length ? snaps[snaps.length - 1] : null;
  const snapStale = lastSnap ? (Date.now() - new Date(lastSnap.date).getTime()) > 28 * 864e5 : !lastSnap;
  const groupData = calc.groups.map((g) => ({ name: g.label.split(" ")[0], Planned: g.planned, Actual: g.actual }));

  // a month is "complete" once the *next* month's payday has actually arrived —
  // that's the point its budget cycle is truly closed out, not just data-present.
  const today = new Date();
  const isMonthComplete = (id) => computePaydayDate(nextMonthId(id)) <= today;
  const completeSeries = series.filter((x) => isMonthComplete(x.id));

  // budget suggestions: shared logic (see computeSuggestions) — own-history window,
  // per-month planned amounts, archive-aware, dismissals respected.
  const suggestions = computeSuggestions(state, state.current);

  // longer-term rollups
  const sumRange = (arr) => arr.reduce((o, x) => ({ income: o.income + x.income, expenses: o.expenses + x.expenses }), { income: 0, expenses: 0 });
  const rollup = (n) => {
    const window = completeSeries.slice(-n);
    const r = sumRange(window);
    const saved = r.income - r.expenses;
    return { ...r, saved, rate: r.income > 0 ? (saved / r.income) * 100 : 0, months: window.length };
  };
  const qr = rollup(3);
  const yr = rollup(12);

  const dark = theme !== "light";
  const cGrid = dark ? "#242833" : "#E6E8EC";
  const cAxisLine = dark ? "#2E333F" : "#D8DCE2";
  const axis = { stroke: dark ? "#3A4150" : "#CBD0D8", tick: { fill: dark ? "#8A909C" : "#6B7280", fontSize: 11 } };
  const tip = { contentStyle: { background: dark ? "#1C1F26" : "#FFFFFF", border: `1px solid ${dark ? "#2E333F" : "#E2E5EA"}`, borderRadius: 10, fontSize: 12, color: dark ? "#E8EAED" : "#1B1E24" }, labelStyle: { color: dark ? "#8A909C" : "#6B7280" }, formatter: (v) => fmt(v) };

  return (
    <div className="bt-stack">
      <div className="bt-insrow">
        <button type="button" className="bt-reportbtn" onClick={() => setShowReport(true)}>
          <span><FileText size={16} /> Create report (PDF)</span>
          <ChevronRight size={16} />
        </button>
      </div>
      {showReport && <ReportSheet state={state} onClose={() => setShowReport(false)} />}

      <div className="bt-insrow">
        {/* CASH — reconciliation vs the budget */}
        <section className="bt-card">
          <div className="bt-card-h">Cash<span className="bt-muted bt-mono"> · {monthMeta(state.current).label}</span></div>
          <div className="bt-muted bt-tiny" style={{ marginBottom: 10 }}>
            Spendable balances, reconciled against what the budget says is left this month. Assets add, owed subtracts.
          </div>
          {liquidAccts.map(accRow)}
          {!isLocked && <button type="button" className="bt-add-cat" onClick={addAcc}><Plus size={14} /> Add cash account</button>}
          <div className="bt-recon bt-mono">
            <div><span className="bt-muted">Net cash</span><strong>{fmt(netCash)}</strong></div>
            <div><span className="bt-muted">Budget says</span><strong>{fmt(expected)}</strong></div>
            <div className={reconciled ? "is-under" : "is-over"}><span className="bt-muted">Difference</span><strong>{fmtSigned(diff)}</strong></div>
          </div>
          <div className={"bt-recon-flag " + (!anyCashBal ? "warn" : reconciled ? "ok" : "warn")}>
            {!anyCashBal ? "Enter your cash balances to reconcile against the budget." : reconciled ? "Reconciled — cash matches the budget." : "Off by " + fmt(Math.abs(diff)) + " — a logged amount or balance is out."}
          </div>
        </section>

        {/* WEALTH — high-level held assets summary */}
        <section className="bt-card">
          <div className="bt-card-h">Wealth<span className="bt-muted bt-mono"> · {monthMeta(state.current).label}</span></div>
          <div className="bt-muted bt-tiny" style={{ marginBottom: 10 }}>
            Savings and investments — your longer-term wealth. Update the balances each month to track growth.
          </div>
          {heldAccts.filter((a) => a.kind !== "loan").map(accRow)}
          {!isLocked && <button type="button" className="bt-add-cat" onClick={addHeld}><Plus size={14} /> Add holding</button>}
          <div className="bt-recon bt-mono">
            <div><span className="bt-muted">Held assets</span><strong>{fmt(heldTotal)}</strong></div>
            <div><span className="bt-muted">Net worth</span><strong className={netWorth < 0 ? "is-over" : ""}>{fmt(netWorth)}</strong></div>
          </div>
          <div className="bt-muted bt-tiny" style={{ marginTop: 8 }}>Net worth combines cash, held assets and anything owed.</div>
          {state.accounts.some((a) => a.kind === "loan") && (
            <label className="bt-loan-toggle" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
              <input type="checkbox" checked={loansInNetWorth} onChange={(e) => setLoansInNetWorth(e.target.checked)} style={{ cursor: "pointer" }} />
              <span>Include loan in net worth calculation</span>
            </label>
          )}
          {snapStale && (
            <div className="bt-recon-flag warn" style={{ marginTop: 10 }}>
              {lastSnap ? `Last snapshot was ${new Date(lastSnap.date).toLocaleDateString("en-IE", { day: "2-digit", month: "short" })} — update your balances and save a fresh one.` : "Save your first snapshot to start tracking wealth over time."}
            </div>
          )}
          <div className="bt-snap-save">
            <div className="bt-amount-in sm" style={{ width: "auto", flex: 1 }}>
              <input className="bt-input bt-mono" type="date" value={snapDate} onChange={(e) => setSnapDate(e.target.value)} />
            </div>
            <button type="button" className="bt-savebtn" onClick={saveSnapshot}>Save snapshot</button>
          </div>
          <div className="bt-muted bt-tiny" style={{ marginTop: 6 }}>Records {fmt(heldTotal)} held assets as a dated point on the trend below.</div>
        </section>
      </div>

      {state.accounts.filter((a) => a.kind === "loan").length > 0 && (
        <div className="bt-insrow">
          {/* LOANS */}
          <section className="bt-card">
            <div className="bt-card-h">Loans</div>
            {state.accounts.filter((a) => a.kind === "loan").map((loan) => {
              const meta = loan.loanMeta;
              if (!meta) return null;

              // Find linked category IDs
              const linkedCatIds = new Set(
                state.categories.filter((c) =>
                  meta.linkedCategories.some((n) =>
                    c.name.toLowerCase() === n.toLowerCase() ||
                    c.name.toLowerCase().includes(n.toLowerCase()) ||
                    n.toLowerCase().includes(c.name.toLowerCase())
                  )
                ).map((c) => c.id)
              );

              // Sum all payments across every month
              const totalPaid = Object.values(state.months)
                .flatMap((mo) => mo.txns || [])
                .filter((t) => linkedCatIds.has(t.cat))
                .reduce((sum, t) => sum + (t.amount || 0), 0);

              // Initial balance = first month where this loan has a non-zero stored balance
              const sortedIds = Object.keys(state.months).sort();
              let initialBalance = meta.originalAmount;
              let initialMonthId = null;
              for (const id of sortedIds) {
                const b = state.months[id].balances?.[loan.id];
                if (b > 0) { initialBalance = b; initialMonthId = id; break; }
              }

              // Computed remaining balance
              const curr = Math.max(0, initialBalance - totalPaid);
              const paidOff = meta.originalAmount - curr;
              const pct = meta.originalAmount > 0 ? Math.round((paidOff / meta.originalAmount) * 100) : 0;
              const disbDate = new Date(meta.disbursalDate);
              const endDate = new Date(disbDate.getFullYear(), disbDate.getMonth() + meta.term, disbDate.getDate());

              // Amortization
              const monthlyRate = meta.interestRate / 100 / 12;
              const estimatedPayment = monthlyRate > 0
                ? (meta.originalAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -meta.term))
                : meta.originalAmount / meta.term;
              const monthlyPayment = meta.monthlyPayment || estimatedPayment;
              let remainingInterest = 0;
              if (monthlyRate > 0 && curr > 0 && monthlyPayment > curr * monthlyRate) {
                const remainingMonths = -Math.log(1 - (curr * monthlyRate) / monthlyPayment) / Math.log(1 + monthlyRate);
                remainingInterest = Math.max(0, monthlyPayment * remainingMonths - curr);
              }

              const isEditing = loanEdit?.loanId === loan.id;

              // Confirm: back-calculate a new initialBalance so the computed value equals what the user typed
              const confirmEdit = () => {
                const confirmed = parseFloat(loanEdit.value);
                if (isNaN(confirmed) || confirmed < 0) { setLoanEdit(null); return; }
                const newInitial = confirmed + totalPaid;
                const targetMonthId = initialMonthId || sortedIds[0];
                if (!targetMonthId) { setLoanEdit(null); return; }
                update((s) => ({
                  ...s,
                  months: {
                    ...s.months,
                    [targetMonthId]: {
                      ...s.months[targetMonthId],
                      balances: { ...s.months[targetMonthId].balances, [loan.id]: newInitial },
                    },
                  },
                }));
                setLoanEdit(null);
              };

              return (
                <div key={loan.id} className="bt-loan-card bt-mono bt-tiny">
                  <div className="bt-loan-header">
                    <span className="bt-text">{loan.name}</span>
                    {isEditing ? (
                      <div className="bt-loan-edit">
                        <span className="bt-muted" style={{ fontSize: 11 }}>€</span>
                        <input
                          className="bt-input bt-mono bt-loan-edit-input"
                          type="number"
                          inputMode="decimal"
                          value={loanEdit.value}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setLoanEdit({ ...loanEdit, value: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setLoanEdit(null); }}
                          autoFocus
                        />
                        <button type="button" className="bt-savebtn sm" onClick={confirmEdit}>Confirm</button>
                        <button type="button" className="bt-done" onClick={() => setLoanEdit(null)}>✕</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="bt-loan-bal-btn"
                        onClick={() => setLoanEdit({ loanId: loan.id, value: curr.toFixed(2) })}
                        title="Tap to correct balance"
                      >
                        {fmt(curr)} <PencilLine size={11} style={{ opacity: 0.5, marginLeft: 3 }} />
                      </button>
                    )}
                  </div>
                  <div className="bt-loan-bar" style={{ height: "6px", background: "var(--surface2)", borderRadius: "3px", overflow: "hidden", marginTop: "6px" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "#7FB3A6" }} />
                  </div>
                  <div className="bt-loan-stats">
                    <div><span className="bt-muted">Paid off:</span> <span>{fmt(paidOff)} ({pct}%)</span></div>
                    <div><span className="bt-muted">Original:</span> <span>{fmt(meta.originalAmount)}</span></div>
                    <div><span className="bt-muted">Rate:</span> <span>{meta.interestRate}%</span></div>
                    <div><span className="bt-muted">Monthly payment:</span> <span>{fmt(monthlyPayment)}</span></div>
                    <div><span className="bt-muted">Interest left to pay:</span> <span>{fmt(remainingInterest)}</span></div>
                    <div><span className="bt-muted">Payoff date:</span> <span>{endDate.toLocaleDateString("en-IE", { month: "short", year: "2-digit" })}</span></div>
                  </div>
                  {linkedCatIds.size > 0 && (
                    <div className="bt-muted bt-tiny" style={{ marginTop: 8 }}>
                      Auto-tracked from {[...linkedCatIds].map((id) => state.categories.find((c) => c.id === id)?.name).filter(Boolean).join(" + ")}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </div>
      )}

      <div className="bt-insrow">
        {/* HELD ASSETS OVER TIME */}
        <section className="bt-card">
          <div className="bt-card-h">Held assets over time</div>
          {snaps.length < 2 ? (
            <div className="bt-muted bt-tiny">
              {snaps.length === 0
                ? "Save a snapshot above to start tracking your wealth over time."
                : "1 snapshot saved — save another on a later date to see the trend."}
            </div>
          ) : (
            <div className="bt-chart">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={snaps}>
                  <CartesianGrid strokeDasharray="3 3" stroke={cGrid} vertical={false} />
                  <XAxis dataKey="label" {...axis} axisLine={{ stroke: cAxisLine }} tickLine={false} />
                  <YAxis {...axis} axisLine={false} tickLine={false} width={46} tickFormatter={(v) => "€" + (v / 1000).toFixed(0) + "k"} />
                  <Tooltip {...tip} cursor={{ stroke: cAxisLine }} labelFormatter={(l) => l} />
                  <Line type="monotone" dataKey="total" name="Held assets" stroke="#7FB3A6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {snaps.length > 0 && (
            <div className="bt-snaplist">
              {snaps.slice().reverse().map((sn) => (
                <div key={sn.id} className="bt-snaprow bt-mono">
                  <span className="bt-muted">{new Date(sn.date).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  <strong>{fmt(sn.total)}</strong>
                  <button type="button" className="bt-del" onClick={() => delSnapshot(sn.id)} aria-label="Delete snapshot"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="bt-insrow">
        {/* INCOME VS EXPENSES */}
        <section className="bt-card">
          <div className="bt-card-h">Income vs expenses</div>
          <div className="bt-chart">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={series} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke={cGrid} vertical={false} />
                <XAxis dataKey="label" {...axis} axisLine={{ stroke: cAxisLine }} tickLine={false} />
                <YAxis {...axis} axisLine={false} tickLine={false} width={38} tickFormatter={(v) => "€" + v} />
                <Tooltip {...tip} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#8A909C" }} />
                <Bar dataKey="income" name="Income" fill="#5DA9E9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#C9A24A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* PLANNED VS ACTUAL */}
        <section className="bt-card">
          <div className="bt-card-h">Planned vs actual <span className="bt-muted bt-mono"> · {monthMeta(state.current).label}</span></div>
          <div className="bt-chart">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={groupData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke={cGrid} vertical={false} />
                <XAxis dataKey="name" {...axis} axisLine={{ stroke: cAxisLine }} tickLine={false} />
                <YAxis {...axis} axisLine={false} tickLine={false} width={38} tickFormatter={(v) => "€" + v} />
                <Tooltip {...tip} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#8A909C" }} />
                <Bar dataKey="Planned" fill="#404756" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Actual" fill="#6E8AC4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* LEFT AT MONTH-END */}
      <div className="bt-insrow">
        <section className="bt-card">
          <div className="bt-card-h">Left at month-end</div>
          {completeSeries.length < 2 ? (
            <div className="bt-muted bt-tiny">
              {completeSeries.length === 0
                ? "This will start tracking once a full budget month has passed (your current month's cycle isn't closed out yet)."
                : "1 complete month so far — check back after next payday to see the trend."}
            </div>
          ) : (
            <div className="bt-chart">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={completeSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke={cGrid} vertical={false} />
                  <XAxis dataKey="label" {...axis} axisLine={{ stroke: cAxisLine }} tickLine={false} />
                  <YAxis {...axis} axisLine={false} tickLine={false} width={38} tickFormatter={(v) => "€" + v} />
                  <Tooltip {...tip} cursor={{ stroke: cAxisLine }} />
                  <Line type="monotone" dataKey="endBalance" name="Left" stroke="#4FB477" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <div className="bt-insrow">
        {/* BUDGET SUGGESTIONS */}
        <section className="bt-card">
          <div className="bt-card-h">Budget suggestions</div>
          {suggestions.length === 0 ? (
            <div className="bt-muted bt-tiny">No changes suggested right now. A variable category needs at least 2 complete months of spend (above €0) that's consistently off its plan before a tweak appears here.</div>
          ) : suggestions.map(({ c, n, avg, avgPlanned, dev }) => {
            const isOver = dev > 0;
            const confirming = confirmDismiss === c.id;
            return (
              <div key={c.id} className="bt-sugg">
                <div className="bt-sugg-mid">
                  <div className="bt-sugg-name">{c.name}</div>
                  <div className="bt-muted bt-tiny bt-mono">
                    avg {fmt(avg)} / {n} mo · planned {fmt(avgPlanned)}
                  </div>
                  <div className="bt-sugg-hint bt-tiny" style={isOver ? undefined : { color: "var(--under)" }}>
                    {isOver
                      ? `Reduce spending by ${fmt(Math.abs(dev))} to stay on plan`
                      : `${fmt(Math.abs(dev))} consistently unspent — consider lowering the plan and reallocating to savings`}
                  </div>
                  {confirming && (
                    <div className="bt-sugg-confirm">
                      <span className="bt-muted bt-tiny">Hide until next month?</span>
                      <button type="button" className="bt-sugg-yes" onClick={() => dismissSuggestion(c.id)}>Yes</button>
                      <button type="button" className="bt-sugg-no" onClick={() => setConfirmDismiss(null)}>No</button>
                    </div>
                  )}
                </div>
                <span className={"bt-sugg-flag " + (isOver ? "is-over" : "is-under")}>
                  {isOver ? "▲" : "▼"} {fmt(avg)}
                </span>
                {!isLocked && (
                  <button type="button" className="bt-sugg-x" style={confirming ? { visibility: "hidden" } : undefined} disabled={confirming}
                    onClick={() => setConfirmDismiss(c.id)} aria-label="Dismiss suggestion" title="Dismiss for this month">
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </section>

        {/* LONGER TERM */}
        <section className="bt-card">
          <div className="bt-card-h">Longer term</div>
          <div className="bt-lt">
            {[{ t: "Last " + qr.months + " mo", r: qr }, { t: "Last " + yr.months + " mo", r: yr }].map(({ t, r }) => (
              <div key={t} className="bt-lt-col">
                <div className="bt-lt-h">{t}</div>
                <div className="bt-lt-row bt-mono"><span className="bt-muted">In</span><span>{fmt(r.income)}</span></div>
                <div className="bt-lt-row bt-mono"><span className="bt-muted">Out</span><span>{fmt(r.expenses)}</span></div>
                <div className="bt-lt-row bt-mono"><span className="bt-muted">Saved</span><span className={r.saved >= 0 ? "is-under" : "is-over"}>{fmt(r.saved)}</span></div>
                <div className="bt-lt-row bt-mono"><span className="bt-muted">Rate</span><span>{r.rate.toFixed(0)}%</span></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------ SETTINGS ------------------------------ */
function SettingsSheet({ state, update, theme, sync, connectSync, disconnectSync, onClose }) {
  const csvRef = useRef(null);
  const jsonRef = useRef(null);
  const [msg, setMsg] = useState("");
  const [inputCode, setInputCode] = useState("");

  const setTheme = (t) => update((s) => ({ ...s, theme: t }));
  const toggleRecurring = () => update((s) => ({ ...s, recurringIncome: !s.recurringIncome }));

  const handleConnect = async () => {
    setMsg("Connecting…");
    const res = await connectSync(inputCode);
    if (res.ok) { setInputCode(""); setMsg("Sync connected!"); }
    else setMsg(res.error || "Sync failed");
  };

  const handleDisconnect = () => {
    disconnectSync();
    setMsg("");
  };

  const exportCSV = () => downloadText(`budget-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(state), "text/csv;charset=utf-8");
  const exportJSON = () => downloadText(`budget-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), "application/json");

  const onCSV = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { next, imported, skipped } = importCSV(state, String(reader.result));
        update(() => next);
        setMsg(`Imported ${imported} ${imported === 1 ? "entry" : "entries"}${skipped ? `, skipped ${skipped}` : ""}.`);
      } catch (_) { setMsg("Couldn't read that file as CSV."); }
    };
    reader.readAsText(file); e.target.value = "";
  };
  const onJSON = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!window.confirm("Restore from backup? This replaces all current data.")) { e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !parsed.months || !parsed.categories) throw new Error("bad");
        update(() => parsed);
        setMsg("Backup restored.");
      } catch (_) { setMsg("That doesn't look like a valid backup file."); }
    };
    reader.readAsText(file); e.target.value = "";
  };

  return (
    <Sheet title="Settings" onClose={onClose}>
      <label className="bt-field-l bt-mono">Sync across devices</label>
      <div className="bt-muted bt-tiny" style={{ marginBottom: 8 }}>
        Enter the same secret code on each device (laptop &amp; phone) to share one dataset.
      </div>
      {sync?.code ? (
        <>
          <div className="bt-synced">
            <span className={"bt-syncdot " + sync.status} />
            <span className="bt-mono">
              {sync.status === "syncing" ? "Syncing…" : sync.status === "error" ? "Sync error — will retry" : "Synced"}
            </span>
            <span className="bt-muted bt-mono bt-tiny" style={{ marginLeft: "auto" }}>code: {sync.code}</span>
          </div>
          <button type="button" className="bt-setbtn" onClick={handleDisconnect}>Disconnect</button>
        </>
      ) : (
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <input
            type="text"
            className="bt-input bt-mono"
            placeholder="e.g. mick-budget-7Q2k"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="button" className="bt-savebtn" onClick={handleConnect}>Connect</button>
        </div>
      )}
      {msg && <div className="bt-muted bt-tiny" style={{ marginBottom: "12px", color: sync?.status === "error" ? "#E0695C" : "#4FB477" }}>{msg}</div>}


      <label className="bt-field-l bt-mono" style={{ marginTop: 18 }}>Appearance</label>
      <div className="bt-seg">
        <button type="button" className={theme === "dark" ? "is-on" : ""} onClick={() => setTheme("dark")}><Moon size={14} /> Dark</button>
        <button type="button" className={theme === "light" ? "is-on" : ""} onClick={() => setTheme("light")}><Sun size={14} /> Light</button>
      </div>

      <label className="bt-field-l bt-mono" style={{ marginTop: 18 }}>Income</label>
      <button type="button" className={"bt-toggle-row" + (state.recurringIncome ? " on" : "")} onClick={toggleRecurring}>
        <div>
          <div className="bt-inc-l">Auto-apply salary</div>
          <div className="bt-muted bt-tiny">New months start with your planned salary already received</div>
        </div>
        <span className={"bt-switch" + (state.recurringIncome ? " on" : "")} />
      </button>

      <label className="bt-field-l bt-mono" style={{ marginTop: 18 }}>Backup</label>
      <div className="bt-muted bt-tiny" style={{ marginBottom: 8 }}>
        CSV is your transaction ledger (for spreadsheets). JSON is a full backup — accounts, balances, snapshots and settings — for moving or restoring everything.
      </div>
      <div className="bt-two">
        <button type="button" className="bt-setbtn" onClick={exportCSV}><Download size={15} /> CSV</button>
        <button type="button" className="bt-setbtn" onClick={() => csvRef.current?.click()}><Upload size={15} /> CSV</button>
      </div>
      <div className="bt-two" style={{ marginTop: 8 }}>
        <button type="button" className="bt-setbtn" onClick={exportJSON}><Download size={15} /> JSON</button>
        <button type="button" className="bt-setbtn" onClick={() => jsonRef.current?.click()}><Upload size={15} /> JSON</button>
      </div>
      <input ref={csvRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={onCSV} />
      <input ref={jsonRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={onJSON} />
      {msg && <div className="bt-recon-flag ok" style={{ marginTop: 10 }}>{msg}</div>}
    </Sheet>
  );
}

/* ------------------------------- REPORT ------------------------------- */
function reportData(state, monthId) {
  const month = state.months[monthId] || { txns: [], incomeTxns: [], income: {}, balances: {} };
  const actualByCat = {};
  (month.txns || []).forEach((t) => { actualByCat[t.cat] = (actualByCat[t.cat] || 0) + t.amount; });
  const cats = state.categories.map((c) => ({ ...c, actual: actualByCat[c.id] || 0, diff: c.planned - (actualByCat[c.id] || 0) }));
  const groups = GROUPS.map((g) => {
    const list = cats.filter((c) => c.group === g.id);
    const planned = list.reduce((s, c) => s + c.planned, 0);
    const actual = list.reduce((s, c) => s + c.actual, 0);
    return { ...g, list, planned, actual, diff: planned - actual };
  });
  const loggedIncome = (month.incomeTxns || []).reduce((s, t) => s + t.amount, 0);
  const income = (month.income?.salary || 0) + (month.income?.other || 0) + loggedIncome;
  const spent = groups.reduce((s, g) => s + g.actual, 0);
  const base = (state.plan.income.salary || 0) + (state.plan.income.other || 0);
  const ideal = { needs: income * 0.5, wants: income * 0.3, savings: income * 0.2 };
  const fixedCats = cats.filter((c) => c.fixed);
  const fixedPaid = fixedCats.filter((c) => (month.txns || []).some((t) => t.cat === c.id && t.fixed)).length;

  const snaps = (state.wealthSnapshots || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const snap = [...snaps].reverse().find((s) => s.date <= monthId + "-31") || snaps[snaps.length - 1] || null;
  const heldList = snap ? state.accounts.filter((a) => !a.liquid && (snap.balances?.[a.id] ?? 0) !== 0)
    .map((a) => ({ name: a.name, amt: snap.balances[a.id] || 0 })).sort((x, y) => y.amt - x.amt) : [];

  // Recommendations use the same shared logic as the Insights tab.
  const suggestions = computeSuggestions(state, monthId).slice(0, 5);

  return { groups, income, spent, remaining: income - spent, base, ideal, fixedCount: fixedCats.length, fixedPaid, snap, heldList, suggestions, snaps };
}

function ReportSheet({ state, onClose }) {
  const ids = Object.keys(state.months).sort();
  const [monthId, setMonthId] = useState(state.current);
  const [sec, setSec] = useState({ summary: true, groups: true, ratio: true, fixed: true, wealth: true, recommend: true });
  const toggle = (k) => setSec((s) => ({ ...s, [k]: !s[k] }));
  const d = reportData(state, monthId);
  const meta = monthMeta(monthId);
  const now = new Date().toLocaleDateString("en-IE", { day: "2-digit", month: "long", year: "numeric" });
  const over = d.remaining < 0;

  const spk = d.snaps.slice(-8);
  const vals = spk.map((s) => s.total);
  const mn = Math.min(...vals), mx = Math.max(...vals), W = 240, H = 46;
  const pts = spk.map((s, i) => {
    const x = spk.length > 1 ? (i / (spk.length - 1)) * W : W / 2;
    const y = mx > mn ? H - ((s.total - mn) / (mx - mn)) * (H - 6) - 3 : H / 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const Bar = ({ label, actual, planned, color }) => {
    const ratio = planned > 0 ? Math.min(actual / planned, 1.2) : 0;
    const ov = actual > planned;
    return (
      <div className="bt-rep-barrow">
        <div className="bt-rep-barlab"><span>{label}</span><span>{fmt(actual)} <i>/ {fmt(planned)}</i></span></div>
        <div className="bt-rep-bar"><div className="bt-rep-bar-fill" style={{ width: `${ratio * 100}%`, background: ov ? "#D1503F" : color }} /></div>
      </div>
    );
  };
  const sections = [
    ["summary", "Summary"], ["groups", "Spend by group"], ["ratio", "50/30/20"],
    ["fixed", "Fixed bills"], ["wealth", "Wealth"], ["recommend", "Recommendations"],
  ];

  return (
    <div className="bt-overlay bt-report-ov" onClick={onClose}>
      <div className="bt-report-wrap" onClick={(e) => e.stopPropagation()}>
        <div className="bt-report-toolbar bt-noprint">
          <select className="bt-input bt-select bt-mono" value={monthId} onChange={(e) => setMonthId(e.target.value)}>
            {ids.map((id) => <option key={id} value={id}>{monthMeta(id).label}</option>)}
          </select>
          <button type="button" className="bt-savebtn" onClick={() => window.print()}>Save as PDF</button>
          <button type="button" className="bt-iconbtn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="bt-report-secsel bt-noprint">
          {sections.map(([k, lbl]) => (
            <button key={k} type="button" className={"bt-chip" + (sec[k] ? " on" : "")} onClick={() => toggle(k)}>{lbl}</button>
          ))}
        </div>

        <div className="bt-report">
          <div className="bt-rep-head">
            <div><div className="bt-rep-title">Budget report</div><div className="bt-rep-sub">{meta.label}</div></div>
            <div className="bt-rep-gen">Generated<br />{now}</div>
          </div>

          {sec.summary && (
            <div className="bt-rep-summary">
              <div><span>Income in</span><strong>{fmt(d.income)}</strong></div>
              <div><span>Allocated out</span><strong>{fmt(d.spent)}</strong></div>
              <div><span>{over ? "Over by" : "Left"}</span><strong style={{ color: over ? "#D1503F" : "#3E9D63" }}>{fmt(Math.abs(d.remaining))}</strong></div>
            </div>
          )}

          {sec.groups && (
            <div className="bt-rep-sec">
              <div className="bt-rep-sec-h">Spend by group</div>
              {d.groups.map((g) => <Bar key={g.id} label={g.label} actual={g.actual} planned={g.planned} color={g.color} />)}
            </div>
          )}

          {sec.ratio && d.income > 0 && (
            <div className="bt-rep-sec">
              <div className="bt-rep-sec-h">50 / 30 / 20 vs actual <span>on {fmt(d.income)}</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "8px 10px", fontSize: "12.5px", fontFamily: "'IBM Plex Mono',monospace" }}>
                <div style={{ display: "contents", fontSize: "11px" }}>
                  <span style={{ paddingBottom: "4px", borderBottom: "1px solid #E2E5EA", color: "#8A909C" }}></span>
                  <span style={{ paddingBottom: "4px", borderBottom: "1px solid #E2E5EA", color: "#8A909C" }}>Actual</span>
                  <span style={{ paddingBottom: "4px", borderBottom: "1px solid #E2E5EA", color: "#8A909C" }}>Planned</span>
                  <span style={{ paddingBottom: "4px", borderBottom: "1px solid #E2E5EA", color: "#8A909C" }}>Diff</span>
                </div>
                {[["Needs", d.groups[0].planned, d.ideal.needs, true], ["Wants", d.groups[1].planned, d.ideal.wants, true], ["Savings & Debt", d.groups[2].planned, d.ideal.savings, false]].map(([l, got, want, lowerIsBetter]) => {
                  const diff = got - want;
                  const good = lowerIsBetter ? diff <= 0 : diff >= 0;
                  return (
                    <div key={l} style={{ display: "contents" }}>
                      <span style={{ paddingTop: "4px", paddingBottom: "4px" }}>{l}</span>
                      <span style={{ paddingTop: "4px", paddingBottom: "4px" }}>{fmt(got)}</span>
                      <span style={{ paddingTop: "4px", paddingBottom: "4px", color: "#8A909C" }}>{fmt(want)}</span>
                      <span style={{ paddingTop: "4px", paddingBottom: "4px", color: good ? "#3E9D63" : "#D1503F" }}>{diff >= 0 ? "+" : "−"}{fmt(Math.abs(diff))}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {sec.fixed && d.fixedCount > 0 && (
            <div className="bt-rep-sec">
              <div className="bt-rep-sec-h">Fixed bills</div>
              <div className="bt-rep-line"><span>{d.fixedPaid} of {d.fixedCount} predictable bills paid</span><span /></div>
            </div>
          )}

          {sec.wealth && (
            <div className="bt-rep-sec">
              <div className="bt-rep-sec-h">Wealth <span>{d.snap ? `as of ${new Date(d.snap.date).toLocaleDateString("en-IE", { day: "2-digit", month: "short" })}` : ""}</span></div>
              {d.snap ? (
                <>
                  <div className="bt-rep-line"><span><strong>Held assets</strong></span><span><strong>{fmt(d.snap.total)}</strong></span></div>
                  {spk.length > 1 && <svg className="bt-rep-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"><polyline points={pts} fill="none" stroke="#5C9A8B" strokeWidth="2" /></svg>}
                  {d.heldList.slice(0, 6).map((h) => <div key={h.name} className="bt-rep-line sm"><span>{h.name}</span><span>{fmt(h.amt)}</span></div>)}
                </>
              ) : <div className="bt-rep-line"><span>No wealth snapshots yet.</span><span /></div>}
            </div>
          )}

          {sec.recommend && (
            <div className="bt-rep-sec">
              <div className="bt-rep-sec-h">Recommendations</div>
              {d.suggestions.length === 0 ? (
                <div className="bt-rep-line"><span>No recommendations right now — a category needs 2+ months of spend first.</span><span /></div>
              ) : d.suggestions.map(({ c, suggested, dev }) => (
                <div key={c.id} className="bt-rep-line"><span>{c.name}</span><span>{dev > 0 ? "raise to" : "lower to"} {fmt(suggested)}</span></div>
              ))}
            </div>
          )}

          <div className="bt-rep-foot">Budget Tracker · zero-based budget &amp; wealth</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- SHEET -------------------------------- */
function Sheet({ title, children, onClose }) {
  return (
    <div className="bt-overlay" onClick={onClose}>
      <div className="bt-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bt-sheet-h">
          <span>{title}</span>
          <button className="bt-iconbtn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="bt-sheet-body">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------- STYLES ------------------------------- */
function Style() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      .bt-root{--bg:#14161A;--surface:#1C1F26;--surface2:#242833;--line:#2E333F;
        --text:#E8EAED;--muted:#8A909C;--under:#4FB477;--over:#E0695C;--accent:#C9A24A;
        --hero:linear-gradient(160deg,#1F232C,#181B21);--header-bg:rgba(20,22,26,.85);--nav-bg:rgba(20,22,26,.92);
        --shadow:0 1px 2px rgba(0,0,0,.28);--ring:rgba(201,162,74,.5);
        font-family:'IBM Plex Sans',system-ui,sans-serif;background:var(--bg);color:var(--text);
        min-height:100vh;max-width:520px;margin:0 auto;padding-bottom:88px;position:relative;
        transition:background .2s ease,color .2s ease;}
      .bt-root.light{--bg:#F4F5F7;--surface:#FFFFFF;--surface2:#EEF0F3;--line:#E2E5EA;
        --text:#1B1E24;--muted:#6B7280;--under:#3E9D63;--over:#D1503F;--accent:#B58A2E;
        --hero:linear-gradient(160deg,#FFFFFF,#EEF1F5);--header-bg:rgba(244,245,247,.85);--nav-bg:rgba(244,245,247,.92);
        --shadow:0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.05);--ring:rgba(181,138,46,.45);}
      .bt-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;}
      .bt-muted{color:var(--muted);}
      .bt-tiny{font-size:11px;}
      .is-under{color:var(--under);} .is-over{color:var(--over);}
      *{box-sizing:border-box;} button{font-family:inherit;cursor:pointer;}
      .bt-center{display:flex;align-items:center;justify-content:center;min-height:60vh;}

      .bt-header{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;
        gap:8px;padding:14px 16px;background:var(--header-bg);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);}
      .bt-hdr-right{display:flex;align-items:center;gap:8px;}
      .bt-month{text-align:center;flex:1;min-width:0;} .bt-month-name{font-weight:600;font-size:17px;letter-spacing:.2px;}
      .bt-month-sub{font-size:11px;color:var(--muted);margin-top:2px;}
      .bt-iconbtn{background:var(--surface);border:1px solid var(--line);color:var(--text);
        width:38px;height:38px;border-radius:11px;display:grid;place-items:center;flex:0 0 auto;}
      .bt-iconbtn:disabled{opacity:.35;}
      .bt-todaybtn{background:var(--surface);border:1px solid var(--line);color:var(--accent);
        font:inherit;font-size:12px;font-weight:600;border-radius:11px;padding:0 12px;height:38px;flex:0 0 auto;}
      .bt-iconbtn.lock-on{color:var(--accent);border-color:rgba(201,162,74,.4);background:rgba(201,162,74,.1);}
      .bt-lock-banner{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--accent);
        background:rgba(201,162,74,.08);border-bottom:1px solid rgba(201,162,74,.2);padding:8px 16px;font-weight:500;}
      .bt-fab.disabled{opacity:.4;cursor:default;}

      .bt-main{padding:16px;} .bt-stack{display:flex;flex-direction:column;gap:12px;}
      .bt-insrow{display:flex;flex-direction:column;gap:12px;}

      .bt-hero{background:var(--hero);border:1px solid var(--line);
        border-radius:18px;padding:22px 20px;}
      .bt-hero-label{font-size:11px;letter-spacing:1.5px;color:var(--muted);}
      .bt-hero-amount{font-size:44px;font-weight:600;line-height:1.1;margin:6px 0 4px;letter-spacing:-.5px;}
      .bt-hero-row{display:flex;gap:8px;font-size:13px;color:var(--muted);align-items:center;}
      .bt-link{background:none;border:none;color:var(--text);padding:0;font:inherit;border-bottom:1px dashed var(--muted);cursor:pointer;}
      .bt-link:hover{border-bottom-color:var(--text);color:var(--accent);}
      .bt-bar{display:flex;height:12px;border-radius:7px;overflow:hidden;background:var(--surface2);margin-top:18px;}
      .bt-bar-seg{height:100%;} .bt-bar-rest{flex:1;}
      .bt-legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:var(--muted);}
      .bt-legend span{display:flex;align-items:center;gap:5px;}
      .bt-legend i{width:9px;height:9px;border-radius:3px;display:inline-block;}

      .bt-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:var(--shadow);}
      .bt-card-h{display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:14px;margin-bottom:6px;}
      .bt-pad{padding:0 4px;}
      .bt-dot{width:9px;height:9px;border-radius:3px;display:inline-block;margin-right:8px;vertical-align:middle;}

      .bt-group{text-align:left;width:100%;color:var(--text);display:block;}
      .bt-group-top{display:flex;justify-content:space-between;align-items:center;}
      .bt-group-name{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;}
      .bt-group-name i{width:10px;height:10px;border-radius:3px;}
      .bt-group-nums{font-size:15px;margin:8px 0 10px;}
      .bt-diff{font-size:13px;font-weight:600;}
      .bt-track{position:relative;height:8px;background:var(--surface2);border-radius:5px;overflow:hidden;}
      .bt-track.sm{height:6px;}
      .bt-track-fill{height:100%;border-radius:5px;transition:width .3s ease;}
      .bt-track-mark{position:absolute;top:-1px;width:2px;height:10px;background:var(--text);opacity:.5;}

      .bt-ratio-grid{display:grid;grid-template-columns:1fr auto auto auto;gap:8px 10px;font-size:13px;}
      .bt-ratio-header{display:contents;font-size:11px;}
      .bt-ratio-header span{padding:8px 0 4px;border-bottom:1px solid var(--line);}
      .bt-ratio-header span:first-child{border-bottom:none;}
      .bt-ratio-row{display:contents;padding:6px 0;align-items:center;}
      .bt-ratio-row span{padding:6px 0;}
      .bt-ratio-row .bt-muted{font-size:12px;}

      .bt-back{background:none;border:none;color:var(--muted);display:flex;align-items:center;gap:4px;font-size:13px;padding:2px 0;}
      .bt-line{border-top:1px solid var(--line);padding:12px 0;}
      .bt-line:first-of-type{border-top:none;}
      .bt-line-main{background:none;border:none;text-align:left;width:100%;color:var(--text);padding:0;display:block;}
      .bt-line-name{font-size:13.5px;display:flex;align-items:center;gap:6px;}
      .bt-line-name.paid{color:var(--muted);}
      .bt-line-row{display:flex;align-items:flex-start;gap:11px;}
      .bt-line-row .bt-line-main{flex:1;min-width:0;}
      .bt-tick{flex:0 0 auto;width:30px;height:30px;margin-top:1px;border-radius:8px;border:1.5px solid var(--line);
        background:var(--surface2);color:var(--muted);display:grid;place-items:center;cursor:pointer;}
      .bt-tick svg{opacity:.25;}
      .bt-tick.on{background:var(--accent);border-color:var(--accent);color:#171717;}
      .bt-tick.on svg{opacity:1;}
      .bt-tag{font-size:9px;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);
        border:1px solid var(--line);border-radius:5px;padding:1px 5px;}
      .bt-line-name.paid .bt-tag{color:var(--accent);border-color:rgba(201,162,74,.4);}
      .bt-tag.near{color:var(--accent);border-color:rgba(201,162,74,.45);}
      .bt-tag.over{color:var(--over);border-color:rgba(224,105,92,.45);}
      .bt-alertbar{display:flex;flex-direction:column;gap:3px;align-items:flex-start;width:100%;text-align:left;
        background:rgba(201,162,74,.1);border:1px solid rgba(201,162,74,.4);color:var(--accent);
        border-radius:13px;padding:12px 15px;font-size:13px;font-weight:600;}
      .bt-alertbar span{font-size:11px;font-weight:400;opacity:.8;white-space:normal;word-break:break-word;line-height:1.5;}
      .bt-fixed-toggle{background:var(--surface2);border:1px solid var(--line);color:var(--muted);
        border-radius:9px;padding:9px;font:inherit;font-size:12px;width:100%;text-align:center;}
      .bt-fixed-toggle.on{color:var(--accent);border-color:rgba(201,162,74,.4);}
      .bt-fixedcard{text-align:left;width:100%;color:var(--text);display:block;}
      .bt-fixedcard .bt-track{margin-top:10px;}
      .bt-pencil{color:var(--muted);opacity:.6;}
      .bt-line-nums{display:flex;justify-content:space-between;align-items:center;margin:6px 0 8px;font-size:13px;}
      .bt-add-cat{background:none;border:1px dashed var(--line);color:var(--muted);width:100%;
        padding:9px;border-radius:10px;font-size:12.5px;display:flex;align-items:center;justify-content:center;gap:6px;margin-top:10px;}
      .bt-editcats{display:flex;flex-direction:column;gap:0;}
      .bt-editcat-row{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--line);}
      .bt-editcat-row:last-child{border-bottom:none;}
      .bt-editcat-arrows{display:flex;flex-direction:column;gap:2px;flex:0 0 auto;}
      .bt-editcat-name{flex:1;font-size:13.5px;min-width:0;}
      .bt-editcat-confirm{display:flex;align-items:center;gap:6px;flex:0 0 auto;}
      .bt-editcat-add{display:flex;gap:8px;margin-top:14px;align-items:center;}
      .bt-editcat-add .bt-input{flex:1;}
      .bt-iconbtn.sm{width:28px;height:28px;border-radius:8px;}
      .bt-del.sm{width:28px;height:28px;font-size:12px;font-weight:600;border-radius:8px;}

      .bt-edit{display:flex;flex-direction:column;gap:8px;}
      .bt-edit-row{display:flex;align-items:center;gap:8px;}
      .bt-input{background:var(--surface2);border:1px solid var(--line);color:var(--text);
        border-radius:10px;padding:10px 12px;font:inherit;font-size:14px;width:100%;outline:none;}
      .bt-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--ring);}
      .bt-input-num{width:110px;text-align:right;}
      .bt-del{background:none;border:1px solid var(--line);color:var(--over);border-radius:9px;padding:8px;display:grid;place-items:center;}
      .bt-done{background:var(--surface2);border:1px solid var(--line);color:var(--text);border-radius:9px;padding:8px 14px;font:inherit;font-size:13px;font-weight:600;}
      .bt-paybtn{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;border-radius:10px;padding:11px;
        font:inherit;font-size:13px;font-weight:600;border:1px solid var(--accent);background:rgba(201,162,74,.12);color:var(--accent);}
      .bt-paybtn.on{background:var(--accent);border-color:var(--accent);color:#171717;}

      .bt-txn{display:flex;align-items:center;gap:11px;background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:12px 14px;box-shadow:var(--shadow);}
      .bt-actfilter{display:flex;gap:8px;}
      .bt-actfilter .bt-input{flex:1;min-width:0;}
      .bt-actfilter .bt-select{flex:0 0 auto;width:auto;max-width:44%;}
      .bt-subs summary{cursor:pointer;font-size:13px;font-weight:600;list-style:none;}
      .bt-subs summary::-webkit-details-marker{display:none;}
      .bt-sub-row{display:flex;justify-content:space-between;font-size:12.5px;padding:6px 0;border-top:1px solid var(--line);margin-top:6px;}
      .bt-txn-mid{flex:1;min-width:0;} .bt-txn-name{font-size:14px;font-weight:500;}
      .bt-txn-sub{font-size:11px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .bt-txn-amt{font-size:15px;font-weight:600;}
      .bt-inl{vertical-align:middle;}

      .bt-empty{text-align:center;padding:48px 20px;color:var(--muted);}
      .bt-empty-h{font-size:16px;color:var(--text);font-weight:600;margin-bottom:6px;}

      .bt-nav{position:fixed;bottom:0;left:0;right:0;max-width:520px;margin:0 auto;display:flex;align-items:center;
        justify-content:space-around;background:var(--nav-bg);backdrop-filter:blur(12px);
        border-top:1px solid var(--line);padding:8px 8px calc(8px + env(safe-area-inset-bottom));z-index:5;}
      .bt-navbtn{background:none;border:none;color:var(--muted);display:flex;flex-direction:column;align-items:center;
        gap:3px;font-size:10px;padding:6px 10px;border-radius:10px;flex:1;}
      .bt-navbtn.is-active{color:var(--accent);}
      .bt-fab{background:var(--accent);color:#171717;border:none;width:54px;height:54px;border-radius:17px;
        display:grid;place-items:center;box-shadow:0 6px 18px rgba(201,162,74,.35);margin-top:-22px;flex:0 0 auto;}

      .bt-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:20;display:flex;align-items:flex-end;justify-content:center;}
      .bt-sheet{background:var(--surface);width:100%;max-width:520px;border-radius:20px 20px 0 0;border-top:1px solid var(--line);
        max-height:90vh;overflow:auto;animation:btUp .22s ease;}
      @keyframes btUp{from{transform:translateY(40px);opacity:.4;}to{transform:none;opacity:1;}}
      .bt-sheet-h{display:flex;justify-content:space-between;align-items:center;padding:18px 18px 8px;font-weight:600;font-size:16px;}
      .bt-sheet-body{padding:8px 18px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:6px;}
      .bt-field-l{font-size:11px;letter-spacing:.5px;color:var(--muted);margin:12px 0 5px;text-transform:uppercase;}
      .bt-amount-in{display:flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:4px 14px;}
      .bt-amount-in.sm{padding:2px 10px;width:150px;}
      .bt-amount-in span{color:var(--muted);font-size:20px;}
      .bt-amount-in .bt-input{background:none;border:none;padding:12px 0;}
      .bt-amount{font-size:24px;font-weight:600;}
      .bt-select{appearance:none;}
      .bt-two{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
      .bt-primary{background:var(--accent);color:#171717;border:none;border-radius:13px;padding:15px;font-size:15px;font-weight:600;margin-top:20px;width:100%;}
      .bt-primary:disabled{opacity:.4;}
      .bt-primary.income{background:var(--under);}
      .bt-seg{display:flex;gap:6px;background:var(--surface2);padding:4px;border-radius:12px;margin-bottom:4px;}
      .bt-seg button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;background:none;border:none;color:var(--muted);padding:10px;border-radius:9px;font:inherit;font-size:13px;font-weight:600;}
      .bt-setbtn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;background:var(--surface2);
        border:1px solid var(--line);color:var(--text);border-radius:12px;padding:13px;font:inherit;font-size:14px;font-weight:600;margin-top:8px;}
      .bt-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;text-align:left;
        background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:12px 14px;color:var(--text);}
      .bt-switch{flex:0 0 auto;width:40px;height:23px;border-radius:12px;background:var(--line);position:relative;transition:background .2s;}
      .bt-switch::after{content:"";position:absolute;top:2px;left:2px;width:19px;height:19px;border-radius:50%;background:#fff;transition:left .2s;}
      .bt-switch.on{background:var(--accent);}
      .bt-switch.on::after{left:19px;}
      .bt-seg button.is-on{background:var(--accent);color:#171717;}
      .bt-seg button.income.is-on{background:var(--under);color:#0e1a13;}
      .bt-inc-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--line);}
      .bt-inc-l{font-size:14px;font-weight:500;}
      .bt-inc-total{display:flex;justify-content:space-between;align-items:center;padding:16px 0 4px;font-size:16px;}
      .bt-inc-total strong{font-size:18px;}
      .bt-acc-wrap{border-top:1px solid var(--line);padding:0;}
      .bt-acc-wrap:first-of-type{border-top:none;}
      .bt-acc{display:flex;align-items:center;gap:8px;padding:7px 0;}
      .bt-kind{width:30px;height:30px;border-radius:9px;border:1px solid var(--line);background:var(--surface2);
        font-size:16px;font-weight:600;line-height:1;flex:0 0 auto;}
      .bt-kind.asset{color:var(--under);border-color:rgba(79,180,119,.4);}
      .bt-kind.owed{color:var(--over);border-color:rgba(224,105,92,.4);}
      .bt-loan-card{padding:10px;background:var(--surface2);border-radius:10px;margin-bottom:10px;}
      .bt-loan-header{display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:4px;}
      .bt-loan-bal-btn{background:none;border:none;color:var(--text);font:inherit;font-size:13px;font-family:'IBM Plex Mono',monospace;display:flex;align-items:center;gap:3px;cursor:pointer;padding:0;}
      .bt-loan-bal-btn:hover{color:var(--accent);}
      .bt-loan-edit{display:flex;align-items:center;gap:6px;flex:1;justify-content:flex-end;}
      .bt-loan-edit-input{width:110px;padding:5px 8px;font-size:13px;text-align:right;}
      .bt-savebtn.sm{padding:6px 10px;font-size:12px;}
      .bt-loan-stats{display:flex;flex-direction:column;gap:3px;margin-top:8px;font-size:11px;}
      .bt-loan-stats div{display:flex;justify-content:space-between;}
      .bt-loan-stats .bt-muted{color:var(--muted);}
      .bt-acc-name{flex:1;min-width:0;background:none;border:none;color:var(--text);font:inherit;font-size:13.5px;padding:4px 2px;border-bottom:1px solid transparent;}
      .bt-acc-name:focus{outline:none;border-bottom-color:var(--accent);}
      .bt-split{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--surface2);color:var(--muted);flex:0 0 auto;display:flex;align-items:center;justify-content:center;}
      .bt-split.on{color:var(--accent);border-color:rgba(201,162,74,.4);background:rgba(201,162,74,.1);}
      .bt-input.is-computed{color:var(--muted);}
      .bt-breakdown{padding:2px 0 10px 38px;display:flex;flex-direction:column;gap:6px;}
      .bt-breakdown-row{display:flex;align-items:center;gap:8px;}
      .bt-breakdown-label{flex:1;min-width:0;background:var(--surface2);border:1px solid var(--line);border-radius:8px;color:var(--text);font:inherit;font-size:13px;padding:6px 9px;}
      .bt-breakdown-label:focus{outline:none;border-color:var(--accent);}
      .bt-del.sm{width:24px;height:24px;}
      .bt-add-cat.sm{padding:7px;font-size:12px;}
      .bt-amount-in.xs{padding:1px 9px;width:120px;flex:0 0 auto;}
      .bt-amount-in.xs span{font-size:14px;}
      .bt-amount-in.xs .bt-input{padding:7px 0;font-size:14px;text-align:right;}
      .bt-recon{display:flex;justify-content:space-between;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line);}
      .bt-recon div{display:flex;flex-direction:column;gap:3px;}
      .bt-recon .bt-muted{font-size:10px;letter-spacing:.5px;text-transform:uppercase;}
      .bt-recon strong{font-size:16px;}
      .bt-recon-flag{margin-top:12px;font-size:12px;padding:9px 11px;border-radius:10px;}
      .bt-recon-flag.ok{background:rgba(79,180,119,.12);color:var(--under);}
      .bt-recon-flag.warn{background:rgba(224,105,92,.12);color:var(--over);}
      .bt-chart{margin:6px -6px 0 -10px;}
      .bt-liq{flex:0 0 auto;font-size:10px;letter-spacing:.3px;border:1px solid var(--line);background:var(--surface2);
        color:var(--muted);border-radius:6px;padding:4px 7px;}
      .bt-liq.on{color:var(--text);border-color:var(--line);}
      .bt-payall{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;
        border:1px solid var(--accent);background:rgba(201,162,74,.12);color:var(--accent);
        border-radius:13px;padding:13px 15px;font:inherit;font-size:13px;font-weight:600;}
      .bt-payall span:first-child{display:flex;align-items:center;gap:8px;}
      .bt-payall.on{background:rgba(79,180,119,.12);border-color:rgba(79,180,119,.4);color:var(--under);}
      .bt-sugg{display:flex;align-items:center;gap:10px;padding:11px 0;border-top:1px solid var(--line);}
      .bt-sugg:first-of-type{border-top:none;}
      .bt-sugg-mid{flex:1;min-width:0;}
      .bt-sugg-name{font-size:13.5px;font-weight:500;}
      .bt-sugg-hint{color:var(--over);margin-top:3px;}
      .bt-sugg-flag{flex:0 0 auto;font-size:12px;font-weight:600;font-family:'IBM Plex Mono',monospace;padding:7px 10px;border-radius:10px;}
      .bt-sugg-flag.is-over{background:rgba(224,105,92,.1);border:1px solid rgba(224,105,92,.3);}
      .bt-sugg-flag.is-under{background:rgba(79,180,119,.1);border:1px solid rgba(79,180,119,.3);}
      .bt-sugg-x{flex:0 0 auto;width:32px;height:32px;padding:0;display:grid;place-items:center;line-height:0;
        background:var(--surface2);border:1px solid var(--line);color:var(--muted);border-radius:9px;}
      .bt-sugg-x:hover{color:var(--over);border-color:rgba(224,105,92,.45);}
      .bt-sugg-confirm{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:10px;}
      .bt-sugg-yes,.bt-sugg-no{height:34px;min-width:58px;padding:0 16px;border-radius:9px;font:inherit;font-size:13px;font-weight:600;
        display:inline-flex;align-items:center;justify-content:center;line-height:1;}
      .bt-sugg-yes{background:rgba(224,105,92,.12);border:1px solid rgba(224,105,92,.45);color:var(--over);}
      .bt-sugg-no{background:var(--surface2);border:1px solid var(--line);color:var(--text);}
      .bt-sugg-apply{flex:0 0 auto;background:var(--surface2);border:1px solid var(--line);border-radius:10px;
        padding:9px 12px;font:inherit;font-size:12.5px;font-weight:600;color:var(--text);}
      .bt-lt{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
      .bt-lt-col{background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:12px;}
      .bt-lt-h{font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;}
      .bt-lt-row{display:flex;justify-content:space-between;font-size:13px;padding:3px 0;}
      .bt-snap-save{display:flex;gap:8px;align-items:center;margin-top:14px;}
      .bt-savebtn{flex:0 0 auto;background:var(--accent);color:#171717;border:none;border-radius:11px;
        padding:11px 16px;font:inherit;font-size:13px;font-weight:600;}
      .bt-snaplist{margin-top:12px;border-top:1px solid var(--line);padding-top:6px;}
      .bt-snaprow{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px;}
      .bt-snaprow:last-child{border-bottom:none;}
      .bt-snaprow .bt-muted{flex:1;}
      .bt-reportbtn{display:flex;align-items:center;justify-content:space-between;width:100%;background:var(--surface);
        border:1px solid var(--line);border-radius:14px;padding:14px 16px;color:var(--text);font:inherit;font-size:14px;font-weight:600;box-shadow:var(--shadow);}
      .bt-reportbtn span{display:flex;align-items:center;gap:8px;color:var(--accent);}
      .bt-report-ov{align-items:flex-start;overflow:auto;padding:0;}
      .bt-report-wrap{background:var(--bg);width:100%;max-width:780px;margin:0 auto;min-height:100%;padding:14px;}
      .bt-report-toolbar{display:flex;gap:8px;align-items:center;position:sticky;top:0;padding:8px 0 10px;background:var(--bg);z-index:2;}
      .bt-report-toolbar .bt-select{flex:1;}
      .bt-report-secsel{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}
      .bt-chip{font-size:12px;border:1px solid var(--line);background:var(--surface2);color:var(--muted);border-radius:20px;padding:6px 11px;font-weight:600;}
      .bt-chip.on{background:var(--accent);border-color:var(--accent);color:#171717;}
      .bt-report{background:#fff;color:#16181d;border-radius:8px;padding:26px 28px;box-shadow:0 4px 24px rgba(0,0,0,.3);}
      .bt-rep-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #16181d;padding-bottom:12px;margin-bottom:16px;}
      .bt-rep-title{font-size:22px;font-weight:700;letter-spacing:-.3px;}
      .bt-rep-sub{font-size:14px;color:#5b616b;margin-top:2px;}
      .bt-rep-gen{font-size:10px;color:#8a909c;text-align:right;text-transform:uppercase;letter-spacing:.5px;line-height:1.5;}
      .bt-rep-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;}
      .bt-rep-summary div{background:#f4f5f7;border-radius:8px;padding:12px 14px;}
      .bt-rep-summary span{display:block;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;}
      .bt-rep-summary strong{font-size:20px;font-family:'IBM Plex Mono',monospace;}
      .bt-rep-sec{margin-bottom:16px;}
      .bt-rep-sec-h{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#16181d;border-bottom:1px solid #e2e5ea;padding-bottom:5px;margin-bottom:9px;}
      .bt-rep-sec-h span{float:right;font-weight:400;text-transform:none;letter-spacing:0;color:#8a909c;font-size:11px;}
      .bt-rep-barrow{margin-bottom:9px;}
      .bt-rep-barlab{display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px;font-family:'IBM Plex Mono',monospace;}
      .bt-rep-barlab i{color:#8a909c;font-style:normal;}
      .bt-rep-bar{height:8px;background:#eef0f3;border-radius:5px;overflow:hidden;}
      .bt-rep-bar-fill{height:100%;border-radius:5px;}
      .bt-rep-line{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;padding:4px 0;font-family:'IBM Plex Mono',monospace;}
      .bt-rep-line i{color:#8a909c;font-style:normal;}
      .bt-rep-line.sm{font-size:11.5px;color:#5b616b;padding:2px 0;}
      .bt-rep-spark{width:100%;height:46px;display:block;margin:6px 0;}
      .bt-rep-foot{margin-top:18px;padding-top:10px;border-top:1px solid #e2e5ea;font-size:10px;color:#8a909c;text-align:center;text-transform:uppercase;letter-spacing:.5px;}
      @media print{
        @page{size:A4 portrait;margin:14mm;}
        body *{visibility:hidden;}
        .bt-report,.bt-report *{visibility:visible;}
        .bt-report{position:absolute;left:0;top:0;width:100%;box-shadow:none;border-radius:0;padding:0;}
        .bt-noprint{display:none !important;visibility:hidden !important;height:0 !important;margin:0 !important;padding:0 !important;overflow:hidden !important;}
        .bt-report-toolbar{display:none !important;visibility:hidden !important;height:0 !important;margin:0 !important;padding:0 !important;overflow:hidden !important;position:absolute;left:-9999px;}
        .bt-report-secsel{display:none !important;visibility:hidden !important;height:0 !important;margin:0 !important;padding:0 !important;overflow:hidden !important;position:absolute;left:-9999px;}
      }
      @media (min-width:900px){
        .bt-root{max-width:1140px;padding:0 28px 28px;display:grid;
          grid-template-columns:212px minmax(0,1fr);grid-template-rows:auto 1fr;column-gap:28px;}
        .bt-header{grid-column:1 / -1;grid-row:1;position:static;background:transparent;backdrop-filter:none;
          padding:22px 4px 16px;margin-bottom:6px;}
        .bt-main{grid-column:2;grid-row:2;padding:6px 0 0;}
        .bt-nav{grid-column:1;grid-row:2;position:sticky;top:20px;align-self:start;height:max-content;
          flex-direction:column;gap:4px;max-width:none;width:auto;margin:0;padding:6px 0;
          background:transparent;backdrop-filter:none;border-top:none;justify-content:flex-start;}
        .bt-navbtn{flex-direction:row;justify-content:flex-start;gap:12px;width:100%;padding:11px 14px;border-radius:11px;}
        .bt-navbtn span{font-size:14px;}
        .bt-navbtn.is-active{background:var(--surface);}
        .bt-fab{order:-1;width:100%;height:auto;border-radius:12px;margin:0 0 8px;padding:13px;box-shadow:none;}
        .bt-main .bt-stack{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start;}
        .bt-main .bt-stack > .bt-hero,
        .bt-main .bt-stack > .bt-alertbar,
        .bt-main .bt-stack > .bt-actfilter,
        .bt-main .bt-stack > .bt-payall,
        .bt-main .bt-stack > .bt-back,
        .bt-main .bt-stack > .bt-empty,
        .bt-main .bt-stack > .bt-txn,
        .bt-main .bt-stack > .bt-subs,
        .bt-main .bt-stack > .bt-card-h{grid-column:1 / -1;}
        .bt-hero-amount{font-size:40px;}
        .bt-overlay{align-items:center;}
        .bt-sheet{max-width:460px;border-radius:18px;animation:none;}
        .bt-main .bt-stack > .bt-txn,
        .bt-main .bt-stack > .bt-subs,
        .bt-main .bt-stack > .bt-actfilter{max-width:640px;}
        .bt-txn{padding:10px 14px;}
        .bt-main .bt-stack > .bt-insrow{grid-column:1 / -1;display:flex;flex-direction:row;gap:14px;align-items:start;}
        .bt-insrow > *{flex:1 1 0;min-width:0;}
      }
      @media (prefers-reduced-motion:reduce){.bt-sheet{animation:none;}.bt-track-fill{transition:none;}}
    `}</style>
  );
}
