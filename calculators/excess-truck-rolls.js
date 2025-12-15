import { parseNumber } from "../config/global.js";
import { buildValueModel, hoursToCost } from "./m2c-core.js";
import { registerCalculator } from "../registry.js";

const TRUCK_ROLL_SCENARIOS = {
  conservative: { label: "Conservative", frequencyReduction: 0.1, costReduction: 0 },
  realistic: { label: "Realistic", frequencyReduction: 0.25, costReduction: 0 },
  optimistic: { label: "Optimistic", frequencyReduction: 0.4, costReduction: 0 }
};

registerCalculator({
  id: "excess_truck_rolls",
  name: "Reduce Excess Truck Rolls",
  description: "Prevents avoidable field dispatches and lowers cost per roll.",
  scenarios: TRUCK_ROLL_SCENARIOS,
  inputs: [
    {
      id: "annualDispatches",
      label: "Annual field dispatches",
      group: "frequency",
      defaultValue: 15000,
      min: 0,
      max: 100000,
      step: 500
    },
    {
      id: "avoidableRate",
      label: "% avoidable",
      group: "frequency",
      defaultValue: 18,
      min: 0,
      max: 100,
      step: 0.5,
      help: "Portion of dispatches that could be prevented."
    },
    {
      id: "repeatRate",
      label: "% resulting in repeat visit",
      group: "frequency",
      defaultValue: 12,
      min: 0,
      max: 100,
      step: 0.5,
      help: "Captures callbacks / repeat truck rolls."
    },
    {
      id: "truckRollCost",
      label: "Truck roll cost ($)",
      group: "cost",
      defaultValue: 325,
      min: 0,
      max: 1000,
      step: 10
    },
    {
      id: "adminHours",
      label: "Back-office time per event (hours)",
      group: "cost",
      defaultValue: 0.3,
      min: 0,
      max: 4,
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
    }
  ],
  assumptions: [
    "Frequency measures avoidable dispatches plus expected repeats.",
    "Scenario multipliers reflect reduced dispatches and leaner handling per event.",
    "Truck roll cost includes vehicle, fuel, and crew time."
  ],
  calculate: ({ inputs, scenario }) => {
    const annualDispatches = parseNumber(inputs.annualDispatches);
    const avoidableRate = parseNumber(inputs.avoidableRate) / 100;
    const repeatRate = parseNumber(inputs.repeatRate) / 100;

    const truckRollCost = parseNumber(inputs.truckRollCost);
    const adminHours = parseNumber(inputs.adminHours);
    const hourlyCost = parseNumber(inputs.hourlyCost);

    const baselineFrequency = annualDispatches * avoidableRate * (1 + repeatRate);
    const costPerEvent = truckRollCost + hoursToCost(adminHours, hourlyCost);

    return buildValueModel({
      baselineFrequency,
      costPerEvent,
      scenarioKey: scenario,
      scenarios: TRUCK_ROLL_SCENARIOS
    });
  }
});
