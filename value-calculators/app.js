import {
  DEFAULT_SCENARIO,
  getCalculatorFromQuery,
  getThemeFromQuery,
  parseNumber,
  scenarios,
  numberFormatter,
  setTheme,
  currencyOptions,
  setDisplayCurrency,
  formatCurrency,
  getDisplayCurrency
} from "./config/global.js";
import { renderValueChart } from "./charts.js";
import { calculatorRegistry, getCalculator } from "./registry.js";

import "./calculators/on-time-billing.js";
import "./calculators/meter-readings.js";
import "./calculators/excess-truck-rolls.js";
import "./calculators/reduce-exceptions.js";
import "./calculators/reduce-aging-receivables.js";

const SCENARIOS =
  scenarios && Object.keys(scenarios).length
    ? scenarios
    : {
        conservative: { label: "Conservative", frequencyReduction: 0.1, costReduction: 0.15 },
        realistic: { label: "Realistic", frequencyReduction: 0.25, costReduction: 0.3 },
        optimistic: { label: "Optimistic", frequencyReduction: 0.4, costReduction: 0.45 }
      };
const DEFAULT_SCENARIOS = SCENARIOS;

const TUTORIAL_KEYS = {
  seen: "vc_tutorial_seen",
  dismissed: "vc_tutorial_dismissed",
  step: "vc_tutorial_step"
};

const tutorialSteps = [
  {
    id: "annual-value-impact",
    selector: "#annual-value-impact",
    title: "Annual Value Impact",
    body: [
      "This is the headline number: what delayed billing costs today vs after improvement.",
      "Everything below explains how we calculate it."
    ] 
  },
  {
    id: "value-cart",
    selector: "#usecase-container",
    title: "Value cart",
    body: [
      "Add Meter-to-Cash use cases to build a combined value estimate.",
      "Each use case keeps its own inputs and ROI Expected."
    ]
  },
  {
    id: "add-usecase",
    selector: "#add-use-case-btn",
    title: "Add use case",
    body: [
      "Open the catalog to add a use case once.",
      "Each addition initializes defaults and updates totals."
    ]
  },
  {
    id: "rationalization",
    selector: "#rationalization",
    title: "How this value is calculated",
    body: [
      "We reduce the number of delayed bills requiring work and the cost per event.",
      "Baseline annual cost vs improved annual cost.",
      "The difference is annual cost avoided.",
      "This excludes customer satisfaction, regulatory exposure, and cash-flow timing benefits."
    ]
  },
  {
    id: "currency-switcher",
    selector: "#currency-switcher",
    title: "Currency display",
    body: [
      "Switch USD / EUR / GBP for display.",
      "Formatting only. Calculations don’t change.",
      "Display currency only. Calculations are unchanged."
    ]
  }
];

const state = {
  currency: "USD",
  tutorialVisible: false,
  tutorialStep: 0,
  activeUseCases: {},
  guidanceActive: false,
  valuePopped: false,
  lastAnnualValue: 0,
  lastAddedId: null
};

document.addEventListener("DOMContentLoaded", () => {
  const theme = getThemeFromQuery();
  setTheme(theme);
  setDisplayCurrency(state.currency);
  init();
  setupWizard();
  autoLaunchTutorialIfNeeded();
});

function init() {
  if (!calculatorRegistry.length) {
    console.warn("No calculators registered");
    return;
  }

  renderCurrencySwitcher();
  renderCatalog();
  renderUseCases();
  renderAggregates();
  setupAddModal();
}

function renderCurrencySwitcher() {
  const select = document.getElementById("currency-select");
  const note = document.getElementById("currency-note");
  if (!select) return;

  select.innerHTML = "";
  currencyOptions.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option.code;
    opt.textContent = option.label;
    if (option.code === state.currency) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener("change", (event) => {
    state.currency = event.target.value;
    setDisplayCurrency(state.currency);
    renderAggregates();
  });

  if (note) {
    note.textContent = "Display currency only. Calculations are unchanged.";
  }
}

function renderScenarioToggle() {
  const container = document.getElementById("scenario-toggle");
  if (!container) return;
  container.innerHTML = "";

  Object.entries(scenarios).forEach(([key, data]) => {
    const button = document.createElement("button");
    const pct = `<span class="scenario-detail">-${Math.round(data.frequencyReduction * 100)}% freq, -${Math.round(
      data.costReduction * 100
    )}% cost</span>`;
    let labelText = data.label;
    if (key === "conservative") labelText = "Conservative – Minor process improvements";
    if (key === "realistic") labelText = "Realistic – Typical improvement with focused execution";
    if (key === "optimistic") labelText = "Optimistic – Strong execution with automation and discipline";
    button.innerHTML = `${labelText} ${pct}`;
    button.className = state.scenario === key ? "active" : "";
    button.addEventListener("click", () => {
      state.scenario = key;
      renderScenarioToggle();
      runCalculation(getCalculator(state.selectedCalculatorId));
    });
    container.appendChild(button);
  });
}

function renderCalculator(calculatorId) {
  const calculator = getCalculator(calculatorId);
  if (!calculator) return;

  const title = document.getElementById("calculator-title");
  const description = document.getElementById("calculator-description");
  if (title) title.textContent = calculator.name;
  if (description) description.textContent = calculator.description;

  state.inputs = buildInitialInputs(calculator);

  renderInputGroups(calculator);
  renderAssumptions(calculator);
  runCalculation(calculator);
}

function buildInitialInputs(calculator) {
  const inputs = {};
  state.inputModes = {};
  (calculator.inputs || []).forEach((input) => {
    inputs[input.id] = input.defaultValue ?? 0;
    state.inputModes[input.id] = "slider";
  });
  return inputs;
}

function renderInputGroups(calculator) {
  const frequencyContainer = document.getElementById("frequency-inputs");
  const costContainer = document.getElementById("cost-inputs");
  if (frequencyContainer) frequencyContainer.innerHTML = "";
  if (costContainer) costContainer.innerHTML = "";

  (calculator.inputs || []).forEach((input) => {
    const field = document.createElement("div");
    field.className = "field";

    const header = document.createElement("div");
    header.className = "field-header";

    const label = document.createElement("label");
    label.setAttribute("for", input.id);
    label.textContent = input.label;

    const valuePill = document.createElement("div");
    valuePill.className = "value-pill";
    valuePill.dataset.for = input.id;
    valuePill.textContent = formatDisplayValue(state.inputs[input.id]);

    header.append(label, valuePill);
    field.appendChild(header);

    const bounds = getBounds(input);
    const mode = ensureMode(input, bounds);

    const control = mode === "slider" ? buildSliderControl(input, bounds, calculator) : buildManualControl(input, calculator);
    field.appendChild(control);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "mode-toggle";
    toggle.textContent = mode === "slider" ? "Manual entry" : "Use slider";
    toggle.addEventListener("click", () => {
      toggleMode(input, bounds);
      renderInputGroups(calculator);
    });
    field.appendChild(toggle);

    if (input.help) {
      const help = document.createElement("small");
      help.textContent = input.help;
      field.appendChild(help);
    }

    if (input.group === "cost") {
      costContainer?.appendChild(field);
    } else {
      frequencyContainer?.appendChild(field);
    }
  });
}

function formatDisplayValue(value) {
  return numberFormatter.format(parseNumber(value, 0));
}

function getUseCaseIcon(id) {
  const base = `width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"`;
  const icons = {
    on_time_billing: `<svg ${base}><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2 2"/></svg>`,
    meter_readings: `<svg ${base}><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12h8M8 9h5m-5 6h3"/></svg>`,
    excess_truck_rolls: `<svg ${base}><rect x="3" y="9" width="13" height="6" rx="1"/><path d="M16 10h2.5L20 12v2h-4z"/><circle cx="7" cy="16" r="1.4"/><circle cx="17" cy="16" r="1.4"/></svg>`,
    reduce_exceptions: `<svg ${base}><path d="M12 3 5 20l7-5 7 5-7-17Z"/></svg>`,
    reduce_aging_receivables: `<svg ${base}><path d="M5 10c0-3 2-5 7-5 3 0 5 1 5 3 0 2-2 3-5 3h-2"/><path d="M10 21c-3 0-5-1-5-3 0-2 2-3 5-3h2c3 0 5-1 5-3 0-2-2-3-5-3h-2"/></svg>`
  };
  return icons[id] || `<svg ${base}><circle cx="12" cy="12" r="9"/></svg>`;
}

function getUseCaseDetail(id, useCaseState) {
  const calc = getCalculator(id);
  const inputs = (useCaseState && useCaseState.inputs) || {};
  const scenarioMap =
    calc && calc.scenarios && Object.keys(calc.scenarios).length ? calc.scenarios : DEFAULT_SCENARIOS;
  const scenarioData = scenarioMap[useCaseState?.scenario] || scenarioMap[DEFAULT_SCENARIO];
  const freqCut = scenarioData ? Math.round((scenarioData.frequencyReduction || 0) * 100) : 0;
  const costCut = scenarioData ? Math.round((scenarioData.costReduction || 0) * 100) : 0;
  const formatNum = (n) => numberFormatter.format(Math.max(0, Math.round(n)));
  const pct = (v) => `${Math.round(parseNumber(v, 0))}%`;

  switch (id) {
    case "on_time_billing":
      return {
        changed: `Events requiring work = annual bills generated × % delayed × % needing intervention ≈ ${formatNum(
          parseNumber(inputs.annualBills) *
            (parseNumber(inputs.delayRate) / 100 || 0) *
            (parseNumber(inputs.exceptionRate) / 100 || 0)
        )} per year. Improvement Expectations apply -${freqCut}% to frequency and -${costCut}% to handling/adjustment cost per event.`,
        measured: [
          "Baseline annual cost of delayed bills",
          "Improved annual cost after applying ROI Expected",
          "Annual cost avoided"
        ],
        represents: "Operational savings from reduced bill rework, agent time, and leakage."
      };
    case "meter_readings":
      return {
        changed: `Disputed estimated reads = meters served × reads/year × % estimated × % disputed ≈ ${formatNum(
          parseNumber(inputs.meterCount) *
            parseNumber(inputs.readsPerYear) *
            (parseNumber(inputs.estimatedRate) / 100 || 0) *
            (parseNumber(inputs.disputeRate) / 100 || 0)
        )} per year. Improvement Expectations reduce frequency by -${freqCut}% and cost per event by -${costCut}%.`,
        measured: [
          "Baseline annual cost of estimated reads that require attention",
          "Improved annual cost after applying ROI Expected",
          "Annual cost avoided"
        ],
        represents: "Operational savings from fewer disputes, less truck time, and reduced leakage."
      };
    case "excess_truck_rolls":
      return {
        changed: `Avoidable dispatches = annual dispatches × % avoidable × (1 + % repeat) ≈ ${formatNum(
          parseNumber(inputs.annualDispatches) *
            (parseNumber(inputs.avoidableRate) / 100 || 0) *
            (1 + (parseNumber(inputs.repeatRate) / 100 || 0))
        )} per year. Improvement Expectations reduce frequency by -${freqCut}% (cost per roll remains ${costCut ? `-${costCut}%` : "unchanged"}).`,
        measured: [
          "Baseline annual cost of avoidable truck rolls",
          "Improved annual cost after applying ROI Expected",
          "Annual cost avoided"
        ],
        represents: "Operational savings from fewer field dispatches and leaner handling."
      };
    case "reduce_exceptions":
      return {
        changed: `Exceptions requiring work = annual transactions × % generating exceptions × % disputed ≈ ${formatNum(
          parseNumber(inputs.annualVolume) *
            (parseNumber(inputs.exceptionRate) / 100 || 0) *
            (parseNumber(inputs.disputeRate) / 100 || 0)
        )} per year. Improvement Expectations reduce exception frequency by -${freqCut}% and handling/field cost per event by -${costCut}%.`,
        measured: [
          "Baseline annual cost of exceptions requiring work",
          "Improved annual cost after applying ROI Expected",
          "Annual cost avoided"
        ],
        represents: "Operational savings from fewer escalations and lower handling effort."
      };
    case "reduce_aging_receivables":
      return {
        changed: `Aged invoices requiring collections = annual invoices × % aging past due × % requiring work ≈ ${formatNum(
          parseNumber(inputs.annualInvoices) *
            (parseNumber(inputs.agingRate) / 100 || 0) *
            (parseNumber(inputs.collectionRate) / 100 || 0)
        )} per year. Improvement Expectations reduce aging frequency by -${freqCut}% and handling/concession cost per event by -${costCut}%.`,
        measured: [
          "Baseline annual cost of aged receivables requiring work",
          "Improved annual cost after applying Improvement Expectations",
          "Annual cost avoided"
        ],
        represents: "Operational savings from reduced collections effort and lower concessions/write-offs."
      };
    default:
      return {
        changed: "Fewer events require human work; each is cheaper to resolve under Improvement Expectations.",
        measured: [
          "Baseline annual cost",
          "Improved annual cost after applying ROI Expected",
          "Annual cost avoided"
        ],
        represents: "Operational savings from reduced frequency and lower cost per event."
      };
  }
}

// Value cart logic
function renderCatalog() {
  const catalog = document.getElementById("usecase-catalog");
  if (!catalog) return;
  catalog.innerHTML = "";

  calculatorRegistry.forEach((calc) => {
    const row = document.createElement("div");
    row.className = "catalog-row";

    const icon = document.createElement("div");
    icon.className = "catalog-icon";
    icon.innerHTML = getUseCaseIcon(calc.id);

    const text = document.createElement("div");
    text.className = "catalog-copy";
    const title = document.createElement("div");
    title.className = "catalog-title";
    title.textContent = calc.name;
    const desc = document.createElement("div");
    desc.className = "catalog-desc";
    desc.textContent = calc.description || "";
    text.append(title, desc);

    const btn = document.createElement("button");
    btn.className = "text-button";
    const isAdded = Boolean(state.activeUseCases[calc.id]);
    btn.textContent = isAdded ? "Added" : "Add";
    btn.disabled = isAdded;
    btn.addEventListener("click", () => {
      addUseCase(calc.id);
    });

    row.append(icon, text, btn);
    catalog.appendChild(row);
  });
}

function setupAddModal() {
  const modal = document.getElementById("add-modal");
  const openBtn = document.getElementById("add-use-case-btn");
  const closeBtn = document.getElementById("add-modal-close");
  const backdrop = modal?.querySelector(".modal-backdrop");
  if (!modal || !openBtn || !closeBtn || !backdrop) return;

  function close() {
    modal.classList.add("hidden");
  }

  openBtn.addEventListener("click", () => {
    renderCatalog();
    modal.classList.remove("hidden");
  });
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);
}

function addUseCase(id) {
  if (state.activeUseCases[id]) return;
  Object.values(state.activeUseCases).forEach((uc) => {
    uc.collapsed = true;
  });
  const calc = getCalculator(id);
  if (!calc) return;
  const inputs = {};
  (calc.inputs || []).forEach((input) => {
    inputs[input.id] = input.defaultValue ?? 0;
  });
  state.activeUseCases[id] = {
    scenario: DEFAULT_SCENARIO,
    inputs,
    collapsed: false
  };
  state.lastAddedId = id;
  // Precompute initial result for value pills and totals
  const result = calc.calculate({ inputs, scenario: DEFAULT_SCENARIO });
  state.activeUseCases[id].result = result;

  // Close modal on add
  const modal = document.getElementById("add-modal");
  modal?.classList.add("hidden");

  renderUseCases();
  renderAggregates();
  renderCatalog();
}

function removeUseCase(id) {
  delete state.activeUseCases[id];
  renderUseCases();
  renderAggregates();
  renderCatalog();
}

function renderUseCases() {
  const container = document.getElementById("usecase-container");
  const addBtn = document.getElementById("add-use-case-btn");
  if (!container) return;
  container.innerHTML = "";

  const entries = Object.entries(state.activeUseCases);
  if (!entries.length) {
    const emptyWrap = document.createElement("div");
    emptyWrap.className = "empty-state";

    const primary = document.createElement("p");
    primary.textContent = "No use cases added yet";
    const support = document.createElement("div");
    support.className = "muted";
    support.textContent = "Start by adding a Meter-to-Cash use case to see how value builds across the process.";

    emptyWrap.append(primary, support);
    container.appendChild(emptyWrap);

    if (addBtn) {
      addBtn.classList.add("cta-pulse", "cta-halo");
      addBtn.dataset.pulsed = "true";
    }
    return;
  }

  addBtn?.classList.remove("cta-pulse", "cta-halo");
  const ordered = entries.sort((a, b) => {
    if (a[0] === state.lastAddedId) return -1;
    if (b[0] === state.lastAddedId) return 1;
    return 0;
  });

  ordered.forEach(([id, useCaseState]) => {
    const calc = getCalculator(id);
    if (!calc) return;
    const card = renderUseCaseCard(calc, useCaseState);
    if (id === state.lastAddedId) {
      card.classList.add("slide-in");
      container.prepend(card);
    } else {
      container.appendChild(card);
    }
    renderScenarioToggleForUseCase(id, useCaseState);
  });
}

function renderUseCaseCard(calc, useCaseState) {
  const card = document.createElement("div");
  card.className = "usecase-card";

  const header = document.createElement("div");
  header.className = "usecase-header";

  const left = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = calc.name;
  const desc = document.createElement("p");
  desc.className = "muted";
  desc.textContent = calc.description || "";
  left.append(title, desc);

  const actions = document.createElement("div");
  actions.className = "usecase-actions";
  const valuePill = document.createElement("div");
  valuePill.className = "value-pill";
  valuePill.id = `value-pill-${calc.id}`;
  valuePill.textContent = formatCurrency((useCaseState.result || {}).annualValue || 0);
  const collapseBtn = document.createElement("button");
  collapseBtn.className = "collapse-btn";
  collapseBtn.textContent = "Collapse";
  collapseBtn.addEventListener("click", () => toggleUseCaseBody(calc.id));
  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-btn";
  removeBtn.textContent = "×";
  removeBtn.title = "Remove use case";
  removeBtn.addEventListener("click", () => removeUseCase(calc.id));
  actions.append(valuePill, collapseBtn, removeBtn);

  header.append(left, actions);

  const body = document.createElement("div");
  body.className = "usecase-body";
  body.id = `body-${calc.id}`;

  const inputSection = document.createElement("div");
  inputSection.className = "input-group full";
  const inputHeader = document.createElement("div");
  inputHeader.className = "panel-header compact";
  inputHeader.innerHTML = `<h3>Inputs (frequency & cost)</h3>`;
  const inputGrid = document.createElement("div");
  inputGrid.className = "input-grid";
  inputGrid.id = `inputs-${calc.id}`;

  (calc.inputs || []).forEach((input) => {
    const field = buildUseCaseField(calc.id, input, useCaseState);
    inputGrid.appendChild(field);
  });

  inputSection.append(inputHeader, inputGrid);

  const scenarioSection = document.createElement("div");
  scenarioSection.className = "roi-section";
  const scenarioHeader = document.createElement("div");
  scenarioHeader.className = "roi-header";
  scenarioHeader.textContent = "Improvement Expectations";
  scenarioHeader.setAttribute("aria-label", "Improvement Expectations");
  const scenarioBody = document.createElement("div");
  scenarioBody.className = "roi-options scenario-toggle";
  scenarioBody.id = `scenario-${calc.id}`;
  scenarioSection.append(scenarioHeader, scenarioBody);

  body.append(inputSection, scenarioSection);

  card.append(header, body);
  if (useCaseState.collapsed) {
    body.classList.add("collapsed");
    collapseBtn.textContent = "Expand";
  }
  updateUseCaseValue(calc.id);
  return card;
}

function buildUseCaseField(useCaseId, input, useCaseState) {
  const field = document.createElement("div");
  field.className = "field";

  const header = document.createElement("div");
  header.className = "field-header";

  const label = document.createElement("label");
  label.setAttribute("for", `${useCaseId}-${input.id}`);
  label.textContent = input.label;

  const valuePill = document.createElement("div");
  valuePill.className = "value-pill";
  valuePill.dataset.for = `${useCaseId}-${input.id}`;
  valuePill.textContent = formatDisplayValue(useCaseState.inputs[input.id]);

  header.append(label, valuePill);
  field.appendChild(header);

  const bounds = getBounds(input);
  const slider = document.createElement("input");
  slider.type = "range";
  slider.id = `slider-${useCaseId}-${input.id}`;
  slider.min = bounds.min;
  slider.max = bounds.max;
  slider.step = bounds.step;
  slider.value = clampValue(useCaseState.inputs[input.id], bounds);
  slider.addEventListener("input", (e) => {
    const value = clampValue(parseNumber(e.target.value, bounds.min), bounds);
    handleUseCaseInputChange(useCaseId, input, value);
    const manualInput = document.getElementById(`manual-${useCaseId}-${input.id}`);
    if (manualInput) manualInput.value = value;
  });

  const scale = document.createElement("div");
  scale.className = "slider-scale";
  scale.innerHTML = `<span>${numberFormatter.format(bounds.min)}</span><span>${numberFormatter.format(bounds.max)}</span>`;

  const wrapper = document.createElement("div");
  wrapper.className = "slider-wrapper";
  wrapper.append(slider, scale);
  wrapper.id = `wrapper-${useCaseId}-${input.id}`;

  const sliderRow = document.createElement("div");
  sliderRow.className = "slider-row";
  sliderRow.append(wrapper);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "toggle-icon";
  toggle.textContent = "✎";
  toggle.addEventListener("click", () => {
    const isShowingManual = !manual.classList.contains("collapsed");
    if (isShowingManual) {
      manual.classList.add("collapsed");
      wrapper.classList.remove("collapsed");
      toggle.textContent = "✎";
    } else {
      manual.classList.remove("collapsed");
      wrapper.classList.add("collapsed");
      toggle.textContent = "↺";
    }
  });
  sliderRow.append(toggle);

  const manual = document.createElement("input");
  manual.type = "number";
  manual.className = "manual-entry collapsed";
  manual.id = `manual-${useCaseId}-${input.id}`;
  manual.value = useCaseState.inputs[input.id];
  manual.classList.add("collapsed");
  manual.addEventListener("input", (e) => {
    const value = clampValue(parseNumber(e.target.value, useCaseState.inputs[input.id]), bounds);
    handleUseCaseInputChange(useCaseId, input, value);
    const sliderInput = document.getElementById(`slider-${useCaseId}-${input.id}`);
    if (sliderInput) sliderInput.value = value;
    updatePill(`${useCaseId}-${input.id}`, value);
  });

  field.append(sliderRow, manual);

  if (input.help) {
    const help = document.createElement("small");
    help.textContent = input.help;
    field.appendChild(help);
  }

  return field;
}

function handleUseCaseInputChange(useCaseId, input, value) {
  const useCase = state.activeUseCases[useCaseId];
  if (!useCase) return;
  const bounds = getBounds(input);
  const clamped = clampValue(value, bounds);
  useCase.inputs[input.id] = clamped;
  updatePill(`${useCaseId}-${input.id}`, clamped);
  updateUseCaseValue(useCaseId);
}

function updatePill(id, value) {
  document.querySelectorAll(`.value-pill[data-for="${id}"]`).forEach((pill) => {
    pill.textContent = formatDisplayValue(value);
  });
}

function renderScenarioToggleForUseCase(useCaseId, useCaseState) {
  const container = document.getElementById(`scenario-${useCaseId}`);
  if (!container) {
    console.error("Scenario container not found for", useCaseId);
    return;
  }

  const calc = getCalculator(useCaseId);
  const scenarioMap =
    calc && calc.scenarios && Object.keys(calc.scenarios).length ? calc.scenarios : DEFAULT_SCENARIOS;

  container.classList.add("show-percentages");
  container.style.display = "flex";
  container.style.flexWrap = "wrap";
  container.style.gap = "8px";
  container.innerHTML = "";

  const requiredKeys = ["conservative", "realistic", "optimistic"];
  requiredKeys.forEach((key) => {
    const data = scenarioMap[key];
    const freq =
      data && typeof data.frequencyReduction === "number" ? Math.round(data.frequencyReduction * 100) : null;
    const cost = data && typeof data.costReduction === "number" ? Math.round(data.costReduction * 100) : null;
    const pct = `<span class="scenario-detail">-${freq ?? "--"}% freq, -${cost ?? "--"}% cost</span>`;
    const label = (data && data.label) || key.charAt(0).toUpperCase() + key.slice(1);
    const button = document.createElement("button");
    button.innerHTML = `${label} ${pct}`;
    button.className = useCaseState.scenario === key ? "active" : "";
    button.addEventListener("click", () => {
      useCaseState.scenario = key;
      useCaseState.scenarios = scenarioMap;
      renderScenarioToggleForUseCase(useCaseId, useCaseState);
      updateUseCaseValue(useCaseId);
    });
    container.appendChild(button);
  });
}

function updateUseCaseValue(useCaseId) {
  const useCase = state.activeUseCases[useCaseId];
  const calc = getCalculator(useCaseId);
  if (!useCase || !calc) return;
  const result = calc.calculate({ inputs: useCase.inputs, scenario: useCase.scenario });
  useCase.result = result;
  const pill = document.getElementById(`value-pill-${useCaseId}`);
  if (pill) pill.textContent = formatCurrency(result.annualValue || 0);
  renderAggregates();
}

function getBounds(input) {
  const min = Number.isFinite(input.min) ? input.min : 0;
  const max = Number.isFinite(input.max) ? input.max : Math.max(input.defaultValue ? input.defaultValue * 2 : 100, min + 1);
  const step = Number.isFinite(input.step) ? input.step : (max - min) / 100;
  return { min, max, step };
}

function clampValue(value, bounds) {
  return Math.min(Math.max(value, bounds.min), bounds.max);
}

function animateValueNumber(el, start, end) {
  if (!el) return;
  const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduce || start === end) {
    el.textContent = formatCurrency(end);
    return;
  }
  const duration = 800;
  const startTime = performance.now();

  function frame(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    const value = start + (end - start) * eased;
    el.textContent = formatCurrency(value);
    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

function toggleUseCaseBody(useCaseId) {
  const body = document.getElementById(`body-${useCaseId}`);
  const btn = document.querySelector(`#value-pill-${useCaseId} ~ .collapse-btn`);
  if (!body || !btn) return;
  const isCollapsed = body.classList.toggle("collapsed");
  btn.textContent = isCollapsed ? "Expand" : "Collapse";
}

function renderAggregates() {
  let totalBaseline = 0;
  let totalImproved = 0;
  const hasUseCases = Object.keys(state.activeUseCases).length > 0;

  Object.entries(state.activeUseCases).forEach(([id, useCaseState]) => {
    const calc = getCalculator(id);
    if (!calc) return;
    const result = calc.calculate({ inputs: useCaseState.inputs, scenario: useCaseState.scenario });
    totalBaseline += result.baselineCost || 0;
    totalImproved += result.improvedCost || 0;
    state.activeUseCases[id].result = result;
  });

  const annualValue = totalBaseline - totalImproved;

  const baselineCostEl = document.getElementById("baseline-cost");
  const improvedCostEl = document.getElementById("improved-cost");
  const valueEl = document.getElementById("value-realized");
  const valueCard = valueEl ? valueEl.closest(".primary-result") : null;

  if (baselineCostEl) baselineCostEl.textContent = formatCurrency(totalBaseline);
  if (improvedCostEl) improvedCostEl.textContent = formatCurrency(totalImproved);
  if (valueEl) animateValueNumber(valueEl, state.lastAnnualValue || 0, annualValue);
  triggerValueFlash(valueCard, annualValue, state.lastAnnualValue);
  state.lastAnnualValue = annualValue;

  renderValueChart(document.getElementById("chart-container"), {
    baselineCost: totalBaseline,
    improvedCost: totalImproved,
    annualValue
  });

  renderItemizedList();

  const detailsBody = document.getElementById("value-details");
  const detailsTrigger = document.querySelector('[data-collapse-target="value-details"]');
  const valueContent = document.getElementById("value-details-content");
  const valueGuidance = document.getElementById("value-guidance");
  const impactHeading = document.getElementById("impact-heading");
  if (impactHeading) {
    if (!hasUseCases) {
      impactHeading.innerHTML = `<button type="button" id="impact-link" class="link-button inline">Add a use case to get started</button>`;
    } else {
      impactHeading.textContent = "ROI view at a glance";
    }
  }
  const impactLink = document.getElementById("impact-link");
  if (impactLink) {
    impactLink.addEventListener("click", () => document.getElementById("add-use-case-btn")?.click(), { once: true });
  }

  if (detailsBody && detailsTrigger) {
    if (!hasUseCases) {
      detailsBody.classList.add("collapsed");
      detailsTrigger.classList.add("disabled");
      detailsTrigger.classList.add("hidden");
      const icon = detailsTrigger.querySelector(".collapse-icon");
      if (icon) icon.textContent = "+";
      valueContent?.classList.add("hidden");
      valueGuidance?.classList.remove("hidden");
    } else {
      detailsTrigger.classList.remove("disabled");
      detailsTrigger.classList.remove("hidden");
      valueContent?.classList.remove("hidden");
      valueGuidance?.classList.add("hidden");
    }
  }
}

function triggerValueFlash(cardEl, newValue, oldValue) {
  if (!cardEl || oldValue === undefined || oldValue === null) return;
  const up = newValue > oldValue;
  const down = newValue < oldValue;
  if (!up && !down) return;
  cardEl.classList.remove("flash-up", "flash-down");
  void cardEl.offsetWidth; // force reflow
  cardEl.classList.add(up ? "flash-up" : "flash-down");
  setTimeout(() => {
    cardEl.classList.remove("flash-up", "flash-down");
  }, 300);
}

function renderItemizedList() {
  const list = document.getElementById("itemized-list");
  if (!list) return;
  list.innerHTML = "";

  const entries = Object.entries(state.activeUseCases);
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "Add one or more Meter-to-Cash use cases to estimate total value.";
    list.appendChild(empty);
    return;
  }

  entries.forEach(([id, useCaseState]) => {
    const calc = getCalculator(id);
    if (!calc || !useCaseState.result) return;
    const detailContent = getUseCaseDetail(id, useCaseState);
    const wrapper = document.createElement("div");
    wrapper.className = "item-row-wrapper";

    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <div class="name">${calc.name}</div>
      <div class="value">${formatCurrency(useCaseState.result.baselineCost || 0)}</div>
      <div class="value">${formatCurrency(useCaseState.result.improvedCost || 0)}</div>
      <div class="value positive">${formatCurrency(useCaseState.result.annualValue || 0)}</div>
      <button class="item-toggle" aria-label="Toggle details">+</button>
    `;

    const detail = document.createElement("div");
    detail.className = "item-detail collapsed";
    detail.innerHTML = `
      <p class="r-label">What changed</p>
      <p class="muted small-text">${detailContent.changed}</p>
      <p class="r-label">What was measured</p>
      <ul class="muted small-text">
        ${detailContent.measured.map((m) => `<li>${m}</li>`).join("")}
      </ul>
      <p class="r-label">What this value represents</p>
      <p class="muted small-text">${detailContent.represents}</p>
    `;

    const toggle = row.querySelector(".item-toggle");
    toggle.addEventListener("click", () => {
      const isCollapsed = detail.classList.toggle("collapsed");
      toggle.textContent = isCollapsed ? "+" : "−";
    });

    wrapper.append(row, detail);
    list.appendChild(wrapper);
  });

  const totalsRow = document.createElement("div");
  totalsRow.className = "item-row total";
  totalsRow.innerHTML = `
    <div class="name">Total</div>
    <div class="value">${formatCurrency(Object.values(state.activeUseCases).reduce((sum, uc) => sum + ((uc.result?.baselineCost) || 0), 0))}</div>
    <div class="value">${formatCurrency(Object.values(state.activeUseCases).reduce((sum, uc) => sum + ((uc.result?.improvedCost) || 0), 0))}</div>
    <div class="value positive">${formatCurrency(Object.values(state.activeUseCases).reduce((sum, uc) => sum + ((uc.result?.annualValue) || 0), 0))}</div>
    <div></div>
  `;
  list.appendChild(totalsRow);
}

// Wizard tutorial logic
function setupWizard() {
  const launch = document.getElementById("tutorial-launch");
  const skip = document.getElementById("tutorial-skip");
  const next = document.getElementById("tutorial-next");
  const back = document.getElementById("tutorial-back");
  const closeBtn = document.getElementById("tutorial-close");

  launch?.addEventListener("click", () => openTutorial(0, false));
  skip?.addEventListener("click", () => dismissTutorial(true));
  closeBtn?.addEventListener("click", () => dismissTutorial(true));
  next?.addEventListener("click", () => advanceStep(1));
  back?.addEventListener("click", () => advanceStep(-1));

  document.addEventListener("keydown", (e) => {
    if (!state.tutorialVisible) return;
    if (e.key === "Escape") {
      dismissTutorial(true);
    } else if (e.key === "Tab") {
      trapFocus(e);
    }
  });

  window.addEventListener("resize", () => {
    if (state.tutorialVisible) renderStepWithScroll();
  });
}

function autoLaunchTutorialIfNeeded() {
  const seen = localStorage.getItem(TUTORIAL_KEYS.seen) === "true";
  const dismissed = localStorage.getItem(TUTORIAL_KEYS.dismissed) === "true";
  if (!seen && !dismissed) {
    const savedStep = Number(localStorage.getItem(TUTORIAL_KEYS.step));
    const startStep = Number.isFinite(savedStep) ? savedStep : 0;
    openTutorial(startStep, true);
  }

  if (!Object.keys(state.activeUseCases).length) {
    enableGuidance();
  }
}

function openTutorial(stepIndex = 0, auto = false) {
  disableGuidance();
  state.tutorialVisible = true;
  state.tutorialStep = Math.min(Math.max(stepIndex, 0), tutorialSteps.length - 1);
  document.body.classList.add("tutorial-active");
  const overlay = document.getElementById("tutorial-overlay");
  overlay?.classList.remove("hidden");
  renderStepWithScroll();
  if (!auto) {
    localStorage.setItem(TUTORIAL_KEYS.dismissed, "false");
  }
}

function dismissTutorial(markDismissed = false) {
  state.tutorialVisible = false;
  const overlay = document.getElementById("tutorial-overlay");
  overlay?.classList.add("hidden");
  document.body.classList.remove("tutorial-active");
  clearHighlight();
  if (markDismissed) {
    localStorage.setItem(TUTORIAL_KEYS.dismissed, "true");
  }
  localStorage.setItem(TUTORIAL_KEYS.seen, "true");
}

function advanceStep(delta) {
  const nextIndex = state.tutorialStep + delta;
  if (nextIndex >= tutorialSteps.length) {
    dismissTutorial(false);
    localStorage.setItem(TUTORIAL_KEYS.seen, "true");
    return;
  }
  state.tutorialStep = Math.min(Math.max(nextIndex, 0), tutorialSteps.length - 1);
  localStorage.setItem(TUTORIAL_KEYS.step, String(state.tutorialStep));
  renderStepWithScroll();
}

function renderTutorialCard() {
  const step = tutorialSteps[state.tutorialStep];
  const titleEl = document.getElementById("tutorial-title");
  const bodyEl = document.getElementById("tutorial-body");
  const stepLabel = document.getElementById("tutorial-step-label");
  const nextBtn = document.getElementById("tutorial-next");
  const backBtn = document.getElementById("tutorial-back");

  if (!step || !titleEl || !bodyEl || !stepLabel || !nextBtn || !backBtn) return;

  titleEl.textContent = step.title;
  stepLabel.textContent = `Step ${state.tutorialStep + 1} of ${tutorialSteps.length}`;

  bodyEl.innerHTML = "";
  const bulletList = document.createElement("ul");
  (step.body || []).forEach((line) => {
    const li = document.createElement("li");
    li.textContent = line;
    bulletList.appendChild(li);
  });
  bodyEl.appendChild(bulletList);

  if (step.whatToEnter && step.whatToEnter.length) {
    const label = document.createElement("p");
    label.textContent = "What to enter:";
    bodyEl.appendChild(label);
    const list = document.createElement("ul");
    step.whatToEnter.forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      list.appendChild(li);
    });
    bodyEl.appendChild(list);
  }

  if (step.guardrail) {
    const guard = document.createElement("p");
    guard.className = "guardrail";
    guard.textContent = step.guardrail;
    bodyEl.appendChild(guard);
  }

  backBtn.disabled = state.tutorialStep === 0;
  nextBtn.textContent = state.tutorialStep === tutorialSteps.length - 1 ? "Done" : "Next";
}

function clearHighlight() {
  const spotlight = document.getElementById("wizard-spotlight");
  if (spotlight) {
    spotlight.style.width = "0px";
    spotlight.style.height = "0px";
    spotlight.style.opacity = "0";
  }
}

function focusFirstButton() {
  const card = document.getElementById("tutorial-card");
  if (!card) return;
  const focusable = card.querySelector("button");
  focusable?.focus();
}

function trapFocus(event) {
  const card = document.getElementById("tutorial-card");
  if (!card) return;
  const focusable = card.querySelectorAll("button, [href], select, textarea, input, [tabindex]:not([tabindex='-1'])");
  const focusArray = Array.from(focusable);
  if (!focusArray.length) return;
  const first = focusArray[0];
  const last = focusArray[focusArray.length - 1];
  if (event.shiftKey) {
    if (document.activeElement === first) {
      last.focus();
      event.preventDefault();
    }
  } else {
    if (document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  }
}

function positionAddUseCaseArrow() {
  const btn = document.getElementById("add-use-case-btn");
  const arrow = document.getElementById("add-use-case-arrow");
  if (!btn || !arrow) return;

  const rect = btn.getBoundingClientRect();
  const arrowWidth = arrow.offsetWidth || 40;
  const arrowHeight = arrow.offsetHeight || 24;

  let arrowX = rect.left + rect.width / 2 - arrowWidth / 2;
  let arrowY = rect.top - arrowHeight - 10;

  // If not enough space above, place below pointing up toward the button
  if (arrowY < 8) {
    arrowY = rect.bottom + 10;
  }

  arrow.style.left = `${arrowX}px`;
  arrow.style.top = `${arrowY}px`;
  arrow.classList.remove("hidden");
}

// Guidance mode
function enableGuidance() {
  // Guidance visuals disabled per latest UX; keep states calm.
  state.guidanceActive = false;
}

function disableGuidance() {
  state.guidanceActive = false;
  const connector = document.getElementById("guidance-connector");
  const arrow = document.getElementById("add-use-case-arrow");
  const cartPanel = document.getElementById("value-cart-panel");
  connector?.classList.add("hidden");
  arrow?.classList.add("hidden");
  cartPanel?.classList.remove("guidance-focus");
}

function highlightValueCart() {
  const cartPanel = document.getElementById("value-cart-panel");
  cartPanel?.classList.add("guidance-focus");
}

function animateValue() {
  if (state.valuePopped) return;
  const valueEl = document.getElementById("value-realized");
  if (valueEl) {
    valueEl.classList.add("value-pop");
    setTimeout(() => valueEl.classList.remove("value-pop"), 1000);
    state.valuePopped = true;
  }
}

function positionGuidance() {
  if (!state.guidanceActive) return;
  const connector = document.getElementById("guidance-connector");
  const impact = document.getElementById("annual-value-impact");
  const cartHeader = document.querySelector("#value-cart-panel .usecase-header-row");
  if (!connector || !impact || !cartHeader) return;

  const impactRect = impact.getBoundingClientRect();
  const cartRect = cartHeader.getBoundingClientRect();
  const bodyRect = document.body.getBoundingClientRect();

  const fromY = impactRect.bottom - bodyRect.top;
  const toY = cartRect.top - bodyRect.top;
  const x = cartRect.left + cartRect.width / 2 - bodyRect.left;

  connector.style.left = `${x}px`;
  connector.style.top = `${fromY}px`;
  connector.style.height = `${toY - fromY}px`;
  connector.classList.remove("hidden");

  positionAddUseCaseArrow();
}

window.addEventListener("resize", () => {
  if (state.guidanceActive) positionGuidance();
});

window.addEventListener("scroll", () => {
  if (state.guidanceActive) positionGuidance();
});

function renderStepWithScroll() {
  const step = tutorialSteps[state.tutorialStep];
  const target = step ? document.querySelector(step.selector) : null;
  if (!step || !target) return;

  disableNav(true);
  console.debug("[Wizard] Scrolling to step target:", step.selector);
  scrollToTarget(target, () => {
    renderTutorialCard();
    moveSpotlight(target);
    positionTooltip(target);
    focusFirstButton();
    disableNav(false);
  });
}

function disableNav(disabled) {
  ["tutorial-next", "tutorial-back", "tutorial-skip", "tutorial-close"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = disabled;
  });
}

function getScrollParent(el) {
  let parent = el.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    const overflowY = style.overflowY;
    if (overflowY === "auto" || overflowY === "scroll") {
      return parent;
    }
    parent = parent.parentElement;
  }
  return window;
}

function animateScroll(container, from, to, done) {
  const duration = 450;
  const start = performance.now();
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = easeInOut(progress);
    const value = from + (to - from) * eased;
    if (container === window) {
      window.scrollTo(0, value);
    } else {
      container.scrollTop = value;
    }
    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      done();
    }
  }
  requestAnimationFrame(frame);
}

function scrollToTarget(target, callback) {
  const scrollParent = getScrollParent(target);
  console.debug("[Wizard] Scroll parent:", scrollParent);
  console.debug("[Wizard] Target rect:", target.getBoundingClientRect());

  if (scrollParent === window) {
    const startScroll = window.scrollY;
    const targetRect = target.getBoundingClientRect();
    const targetScroll = startScroll + targetRect.top - window.innerHeight / 2 + targetRect.height / 2;
    animateScroll(window, startScroll, targetScroll, callback);
  } else {
    const parentRect = scrollParent.getBoundingClientRect();
    const startScroll = scrollParent.scrollTop;
    const targetRect = target.getBoundingClientRect();
    const targetScroll =
      startScroll + (targetRect.top - parentRect.top) - scrollParent.clientHeight / 2 + targetRect.height / 2;
    animateScroll(scrollParent, startScroll, targetScroll, callback);
  }
}

function moveSpotlight(target) {
  const spotlight = document.getElementById("wizard-spotlight");
  if (!spotlight || !target) return;
  const rect = target.getBoundingClientRect();
  const padding = 8;
  spotlight.style.opacity = "1";
  spotlight.style.top = `${rect.top - padding}px`;
  spotlight.style.left = `${rect.left - padding}px`;
  spotlight.style.width = `${rect.width + padding * 2}px`;
  spotlight.style.height = `${rect.height + padding * 2}px`;
}

function positionTooltip(target) {
  const card = document.getElementById("tutorial-card");
  if (!card || !target) return;
  const rect = target.getBoundingClientRect();
  const cardOffset = 16;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const cardWidth = card.offsetWidth;
  const cardHeight = card.offsetHeight;

  let top = rect.bottom + cardOffset;
  let left = rect.left;

  const bottomSpace = viewportHeight - rect.bottom;
  if (bottomSpace < cardHeight + cardOffset) {
    top = rect.top - cardHeight - cardOffset;
  }

  if (left + cardWidth > viewportWidth - 16) {
    left = viewportWidth - cardWidth - 16;
  }
  if (left < 16) left = 16;
  if (top < 16) top = 16;

  card.style.top = `${top}px`;
  card.style.left = `${left}px`;
}

// Rationalization collapse
document.addEventListener("click", (e) => {
  const target = e.target;
  if (target && (target.matches("[data-collapse-target]") || target.closest("[data-collapse-target]"))) {
    const trigger = target.closest("[data-collapse-target]");
    const id = trigger.getAttribute("data-collapse-target");
    const body = document.getElementById(id);
    if (!body) return;
    const isCollapsed = body.classList.toggle("collapsed");
    const icon = trigger.querySelector(".collapse-icon");
    if (icon) icon.textContent = isCollapsed ? "+" : "−";
  }
});
