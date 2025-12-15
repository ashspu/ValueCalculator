export const scenarios = {
  conservative: {
    label: "Conservative",
    frequencyReduction: 0.1,
    costReduction: 0.15
  },
  realistic: {
    label: "Realistic",
    frequencyReduction: 0.25,
    costReduction: 0.3
  },
  optimistic: {
    label: "Optimistic",
    frequencyReduction: 0.4,
    costReduction: 0.45
  }
};

export const DEFAULT_SCENARIO = "realistic";

export function getQueryParam(key, fallback = "") {
  const params = new URLSearchParams(window.location.search);
  return params.get(key) || fallback;
}

export function getThemeFromQuery() {
  const theme = getQueryParam("theme", "neutral").toLowerCase();
  const allowed = ["neutral", "smartutilities", "gqc"];
  return allowed.includes(theme) ? theme : "neutral";
}

export function getCalculatorFromQuery() {
  return getQueryParam("calculator", "");
}

export function parseNumber(value, fallback = 0) {
  const cleaned = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(cleaned) ? cleaned : fallback;
}

const currencyFormatters = {
  USD: () =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }),
  EUR: () =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0
    }),
  GBP: () =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0
    })
};

let currentCurrency = "USD";
let currencyFormatter = currencyFormatters[currentCurrency]();

export const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2
});

export const currencyOptions = [
  { code: "USD", label: "USD ($)" },
  { code: "EUR", label: "EUR (€)" },
  { code: "GBP", label: "GBP (£)" }
];

export function setDisplayCurrency(code = "USD") {
  currentCurrency = currencyFormatters[code] ? code : "USD";
  currencyFormatter = currencyFormatters[currentCurrency]();
}

export function getDisplayCurrency() {
  return currentCurrency;
}

export function formatCurrency(value = 0) {
  return currencyFormatter.format(value || 0);
}

export function setTheme(theme) {
  const link = document.getElementById("theme-style");
  if (link) {
    link.setAttribute("href", `themes/${theme}.css`);
    const indicator = document.getElementById("theme-indicator");
    if (indicator) {
      indicator.setAttribute("title", `Theme: ${theme}`);
    }
  }
}
