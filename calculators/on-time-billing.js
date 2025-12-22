import { parseNumber } from "../config/global.js";
import { buildValueModel, hoursToCost } from "./m2c-core.js";
import { registerCalculator } from "../registry.js";

const ON_TIME_SCENARIOS = {
  conservative: { label: "Conservative Outcome", frequencyReduction: 0.1, costReduction: 0.15 },
  realistic: { label: "Realistic Outcome", frequencyReduction: 0.25, costReduction: 0.3 },
  optimistic: { label: "Optimistic Outcome", frequencyReduction: 0.4, costReduction: 0.45 }
};

registerCalculator({
  id: "on_time_billing",
  name: "Improve On-Time Billing",
  description: "Reduces delayed bills and the manual effort they create.",
  scenarios: ON_TIME_SCENARIOS,
  inputs: [
    {
      id: "annualBills",
      label: "Annual bills generated",
      group: "frequency",
      defaultValue: 1200000,
      min: 0,
      max: 12000000,
      step: 1000,
      help: "Total bills sent per year."
    },
    {
      id: "delayRate",
      label: "% of bills delayed",
      group: "frequency",
      defaultValue: 6,
      min: 0,
      max: 100,
      step: 0.5,
      help: "Share of bills that miss the initial cycle."
    },
    {
      id: "exceptionRate",
      label: "% needing human intervention",
      group: "frequency",
      defaultValue: 15,
      min: 0,
      max: 100,
      step: 1,
      help: "Portion of delayed bills that trigger agent work."
    },
    {
      id: "handlingHours",
      label: "Avg handling time per delayed bill (hours)",
      group: "cost",
      defaultValue: 0.5,
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
      id: "adjustmentCost",
      label: "Avg write-off / adjustment ($)",
      group: "cost",
      defaultValue: 8,
      min: 0,
      max: 100,
      step: 1,
      help: "Typical revenue leakage tied to each delayed bill."
    }
  ],
  assumptions: [
    "Frequency is the count of delayed bills requiring human work each year.",
    "Scenario multipliers represent process improvements that reduce delays and the time or leakage per event.",
    "Write-offs scale directly with the number of delayed bills."
  ],
  calculate: ({ inputs, scenario }) => {
    const annualBills = parseNumber(inputs.annualBills);
    const delayRate = parseNumber(inputs.delayRate) / 100;
    const exceptionRate = parseNumber(inputs.exceptionRate) / 100;

    const handlingHours = parseNumber(inputs.handlingHours);
    const hourlyCost = parseNumber(inputs.hourlyCost);
    const adjustmentCost = parseNumber(inputs.adjustmentCost);

    const baselineFrequency = annualBills * delayRate * exceptionRate;
    const costPerEvent = hoursToCost(handlingHours, hourlyCost) + adjustmentCost;

    return buildValueModel({
      baselineFrequency,
      costPerEvent,
      scenarioKey: scenario,
      scenarios: ON_TIME_SCENARIOS
    });
  }
});
