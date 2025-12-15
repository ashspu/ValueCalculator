import { parseNumber } from "../config/global.js";
import { buildValueModel, hoursToCost } from "./m2c-core.js";
import { registerCalculator } from "../registry.js";

const METER_READING_SCENARIOS = {
  conservative: { label: "Conservative", frequencyReduction: 0.1, costReduction: 0.15 },
  realistic: { label: "Realistic", frequencyReduction: 0.25, costReduction: 0.3 },
  optimistic: { label: "Optimistic", frequencyReduction: 0.4, costReduction: 0.45 }
};

registerCalculator({
  id: "meter_readings",
  name: "Improve Meter Readings",
  description: "Reduces estimated reads and the downstream work they trigger.",
  scenarios: METER_READING_SCENARIOS,
  inputs: [
    {
      id: "meterCount",
      label: "Meters served",
      group: "frequency",
      defaultValue: 50000,
      min: 50000,
      max: 2000000,
      step: 500
    },
    {
      id: "readsPerYear",
      label: "Reads per meter per year",
      group: "frequency",
      defaultValue: 12,
      min: 1,
      max: 24,
      step: 1
    },
    {
      id: "estimatedRate",
      label: "% of reads estimated",
      group: "frequency",
      defaultValue: 7,
      min: 0,
      max: 100,
      step: 0.5,
      help: "Portion of reads without an actual read."
    },
    {
      id: "disputeRate",
      label: "% of estimated reads disputed",
      group: "frequency",
      defaultValue: 12,
      min: 0,
      max: 100,
      step: 0.5,
      help: "Share of estimated reads that trigger agent work."
    },
    {
      id: "handlingHours",
      label: "Avg handling time (hours)",
      group: "cost",
      defaultValue: 0.4,
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
      id: "truckRollRate",
      label: "% requiring a truck roll",
      group: "cost",
      defaultValue: 12,
      min: 0,
      max: 100,
      step: 0.5,
      help: "Only for contested estimated reads."
    },
    {
      id: "truckRollCost",
      label: "Truck roll cost ($)",
      group: "cost",
      defaultValue: 225,
      min: 0,
      max: 500,
      step: 5
    }
  ],
  assumptions: [
    "Frequency counts disputed estimated reads that demand human attention.",
    "A subset of disputes triggers a truck roll; scenario multipliers reduce both disputes and per-event cost.",
    "Operational time and truck costs are fully burdened."
  ],
  calculate: ({ inputs, scenario }) => {
    const meterCount = parseNumber(inputs.meterCount);
    const readsPerYear = parseNumber(inputs.readsPerYear);
    const estimatedRate = parseNumber(inputs.estimatedRate) / 100;
    const disputeRate = parseNumber(inputs.disputeRate) / 100;

    const handlingHours = parseNumber(inputs.handlingHours);
    const hourlyCost = parseNumber(inputs.hourlyCost);
    const truckRollRate = parseNumber(inputs.truckRollRate) / 100;
    const truckRollCost = parseNumber(inputs.truckRollCost);

    const baselineFrequency = meterCount * readsPerYear * estimatedRate * disputeRate;
    const costPerEvent = hoursToCost(handlingHours, hourlyCost) + truckRollRate * truckRollCost;

    return buildValueModel({
      baselineFrequency,
      costPerEvent,
      scenarioKey: scenario,
      scenarios: METER_READING_SCENARIOS
    });
  }
});
