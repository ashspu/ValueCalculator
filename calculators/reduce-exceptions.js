import { parseNumber } from "../config/global.js";
import { buildValueModel, hoursToCost } from "./m2c-core.js";
import { registerCalculator } from "../registry.js";

const REDUCE_EXCEPTIONS_SCENARIOS = {
  conservative: { label: "Conservative Outcome", frequencyReduction: 0.1, costReduction: 0.15 },
  realistic: { label: "Realistic Outcome", frequencyReduction: 0.25, costReduction: 0.3 },
  optimistic: { label: "Optimistic Outcome", frequencyReduction: 0.4, costReduction: 0.45 }
};

registerCalculator({
  id: "reduce_exceptions",
  name: "Reduce Exceptions",
  description: "Cuts exception volume and handling effort across meter-to-cash.",
  scenarios: REDUCE_EXCEPTIONS_SCENARIOS,
  inputs: [
    {
      id: "annualVolume",
      label: "Annual transactions",
      group: "frequency",
      defaultValue: 1200000,
      min: 10000,
      max: 10000000,
      step: 10000
    },
    {
      id: "exceptionRate",
      label: "% generating exceptions",
      group: "frequency",
      defaultValue: 4,
      min: 0,
      max: 100,
      step: 0.5,
      help: "Share of transactions that create an exception."
    },
    {
      id: "disputeRate",
      label: "% disputed / escalated",
      group: "frequency",
      defaultValue: 35,
      min: 0,
      max: 100,
      step: 0.5,
      help: "Portion of exceptions that require agent involvement."
    },
    {
      id: "handlingHours",
      label: "Avg handling time (hours)",
      group: "cost",
      defaultValue: 0.45,
      min: 0,
      max: 8,
      step: 0.05
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
      id: "truckRollRate",
      label: "% requiring field work",
      group: "cost",
      defaultValue: 10,
      min: 0,
      max: 100,
      step: 0.5,
      help: "Subset of escalations that trigger a truck roll."
    },
    {
      id: "truckRollCost",
      label: "Cost per truck roll ($)",
      group: "cost",
      defaultValue: 275,
      min: 0,
      max: 1000,
      step: 5
    }
  ],
  assumptions: [
    "Exceptions represent cases requiring manual intervention.",
    "Scenario multipliers reduce both frequency and handling cost.",
    "Operational and field costs are fully burdened."
  ],
  calculate: ({ inputs, scenario }) => {
    const annualVolume = parseNumber(inputs.annualVolume);
    const exceptionRate = parseNumber(inputs.exceptionRate) / 100;
    const disputeRate = parseNumber(inputs.disputeRate) / 100;

    const handlingHours = parseNumber(inputs.handlingHours);
    const hourlyCost = parseNumber(inputs.hourlyCost);
    const truckRollRate = parseNumber(inputs.truckRollRate) / 100;
    const truckRollCost = parseNumber(inputs.truckRollCost);

    const baselineFrequency = annualVolume * exceptionRate * disputeRate;
    const costPerEvent = hoursToCost(handlingHours, hourlyCost) + truckRollRate * truckRollCost;

    return buildValueModel({
      baselineFrequency,
      costPerEvent,
      scenarioKey: scenario,
      scenarios: REDUCE_EXCEPTIONS_SCENARIOS
    });
  }
});
