import { parseNumber } from "../config/global.js";
import { buildValueModel, hoursToCost } from "./m2c-core.js";
import { registerCalculator } from "../registry.js";

const AGING_SCENARIOS = {
  conservative: { label: "Conservative Outcome", frequencyReduction: 0.1, costReduction: 0.15 },
  realistic: { label: "Realistic Outcome", frequencyReduction: 0.25, costReduction: 0.3 },
  optimistic: { label: "Optimistic Outcome", frequencyReduction: 0.4, costReduction: 0.45 }
};

registerCalculator({
  id: "reduce_aging_receivables",
  name: "Reduce Aging Receivables",
  description: "Reduces aged receivables and the manual effort required to collect them.",
  scenarios: AGING_SCENARIOS,
  inputs: [
    {
      id: "annualInvoices",
      label: "Annual invoices issued",
      group: "frequency",
      defaultValue: 250000,
      min: 10000,
      max: 2000000,
      step: 5000
    },
    {
      id: "agingRate",
      label: "% aging past due",
      group: "frequency",
      defaultValue: 8,
      min: 0,
      max: 100,
      step: 0.5,
      help: "Share of invoices that move into aging buckets (e.g., 30+ days past due)."
    },
    {
      id: "collectionRate",
      label: "% requiring collections work",
      group: "frequency",
      defaultValue: 60,
      min: 0,
      max: 100,
      step: 1,
      help: "Portion of aged invoices that require agent follow-up or escalation."
    },
    {
      id: "handlingHours",
      label: "Avg handling time per aged invoice (hours)",
      group: "cost",
      defaultValue: 0.6,
      min: 0,
      max: 8,
      step: 0.1
    },
    {
      id: "hourlyCost",
      label: "Fully loaded cost per hour ($)",
      group: "cost",
      defaultValue: 55,
      min: 0,
      max: 300,
      step: 1
    },
    {
      id: "writeoffCost",
      label: "Avg write-off / concession ($)",
      group: "cost",
      defaultValue: 15,
      min: 0,
      max: 200,
      step: 1,
      help: "Typical concession or write-off needed to close an aged invoice."
    }
  ],
  assumptions: [
    "Frequency counts aged invoices that require human collections effort.",
    "Scenario multipliers reduce how many invoices age and the handling/waiver per event.",
    "Write-offs represent concessions used to close outstanding balances."
  ],
  calculate: ({ inputs, scenario }) => {
    const annualInvoices = parseNumber(inputs.annualInvoices);
    const agingRate = parseNumber(inputs.agingRate) / 100;
    const collectionRate = parseNumber(inputs.collectionRate) / 100;

    const handlingHours = parseNumber(inputs.handlingHours);
    const hourlyCost = parseNumber(inputs.hourlyCost);
    const writeoffCost = parseNumber(inputs.writeoffCost);

    const baselineFrequency = annualInvoices * agingRate * collectionRate;
    const costPerEvent = hoursToCost(handlingHours, hourlyCost) + writeoffCost;

    return buildValueModel({
      baselineFrequency,
      costPerEvent,
      scenarioKey: scenario,
      scenarios: AGING_SCENARIOS
    });
  }
});
