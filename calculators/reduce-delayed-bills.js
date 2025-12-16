import { parseNumber } from "../config/global.js";
import { registerCalculator } from "../registry.js";

/**
 * Scenario contract expected by the platform.
 * These percentages are DISPLAY + narrative only.
 */
const SCENARIOS = {
  conservative: {
    label: "Conservative",
    frequencyReduction: 0.25,
    costReduction: 0.1
  },
  realistic: {
    label: "Realistic",
    frequencyReduction: 0.5,
    costReduction: 0.2
  },
  optimistic: {
    label: "Optimistic",
    frequencyReduction: 0.75,
    costReduction: 0.3
  }
};

/**
 * Core cost model (unchanged, solid)
 */
function toCost({
  annualBills,
  delayedPct,
  avgDaysDelayed,
  avgBillAmount,
  referenceRate,
  pctToCollections,
  collectionsMinutes,
  hourlyCost,
  writeoffPerDelayedBill
}) {
  const bills = parseNumber(annualBills);
  const delayedRate = parseNumber(delayedPct) / 100;
  const days = parseNumber(avgDaysDelayed);
  const billAmount = parseNumber(avgBillAmount);
  const rate = parseNumber(referenceRate) / 100;

  const toCollectionsRate = parseNumber(pctToCollections) / 100;
  const collMinutes = parseNumber(collectionsMinutes);
  const hourly = parseNumber(hourlyCost);
  const writeoff = parseNumber(writeoffPerDelayedBill);

  const delayedBills = bills * delayedRate;

  const cashDelayCost =
    delayedBills * billAmount * rate * (days / 365);

  const collectionsBills =
    delayedBills * toCollectionsRate;

  const collectionsLaborCost =
    collectionsBills * (collMinutes / 60) * hourly;

  const leakageCost =
    collectionsBills * writeoff;

  const total =
    cashDelayCost + collectionsLaborCost + leakageCost;

  return {
    delayedBills,
    collectionsBills,
    cashDelayCost,
    collectionsLaborCost,
    leakageCost,
    total
  };
}

registerCalculator({
  id: "reduce_delayed_bills",
  name: "Reduce Delayed Bills",
  description:
    "Quantifies working capital drag, collections effort, and revenue leakage caused by delayed billing.",

  scenarios: SCENARIOS,

  inputs: [
    { id: "annualBills", label: "Annual bills generated", group: "frequency", defaultValue: 12000000, min: 0, max: 20000000, step: 10000 },
    { id: "delayedPct", label: "% of bills delayed", group: "frequency", defaultValue: 6, min: 0, max: 100, step: 0.5 },
    { id: "avgDaysDelayed", label: "Average days of billing delay", group: "frequency", defaultValue: 12, min: 0, max: 120, step: 1 },
    { id: "avgBillAmount", label: "Average bill amount ($)", group: "cost", defaultValue: 150, min: 0, step: 1 },
    { id: "referenceRate", label: "Cost of capital / reference rate (annual %)", group: "cost", defaultValue: 3.5, min: 0, max: 20, step: 0.1 },
    { id: "pctToCollections", label: "% of delayed bills entering collections", group: "frequency", defaultValue: 12, min: 0, max: 100, step: 0.5 },
    { id: "collectionsMinutes", label: "Average collections handling time (minutes)", group: "cost", defaultValue: 5, min: 0, max: 60, step: 0.5 },
    { id: "hourlyCost", label: "Fully loaded cost per hour ($)", group: "cost", defaultValue: 60, min: 0, max: 300, step: 1 },
    { id: "writeoffPerDelayedBill", label: "Incremental write-off per collections bill ($)", group: "cost", defaultValue: 0, min: 0, step: 1 }
  ],

  calculate: ({ inputs, scenario }) => {
    const baseline = toCost(inputs);

    const scenarioCfg = SCENARIOS[scenario] || SCENARIOS.realistic;

    // 👇 THIS is the money move
    const improvementFactor =
      1 -
      (scenarioCfg.frequencyReduction * 0.7 +
       scenarioCfg.costReduction * 0.3);

    const improvedTotal =
      Math.max(baseline.total * improvementFactor, 0);

    const annualValue = baseline.total - improvedTotal;

    return {
      baselineCost: baseline.total,
      improvedCost: improvedTotal,
      annualValue,

      baseline,
      improved: {
        ...baseline,
        total: improvedTotal
      },

      breakdown: {
        cashDelay: baseline.cashDelayCost * (1 - improvementFactor),
        collections: baseline.collectionsLaborCost * (1 - improvementFactor),
        leakage: baseline.leakageCost * (1 - improvementFactor)
      }
    };
  }
});
