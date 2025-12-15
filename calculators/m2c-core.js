import { DEFAULT_SCENARIO, scenarios as globalScenarios } from "../config/global.js";

export function buildValueModel({
  baselineFrequency = 0,
  costPerEvent = 0,
  scenarioKey = DEFAULT_SCENARIO,
  scenarios: scenarioOverrides = null
}) {
  const scenarioMap = scenarioOverrides && Object.keys(scenarioOverrides).length ? scenarioOverrides : globalScenarios;
  const scenario = scenarioMap[scenarioKey] || scenarioMap[DEFAULT_SCENARIO];

  const safeBaselineFreq = Math.max(0, baselineFrequency);
  const safeCostPerEvent = Math.max(0, costPerEvent);

  const reducedFrequency = safeBaselineFreq * (1 - scenario.frequencyReduction);
  const reducedCostPerEvent = safeCostPerEvent * (1 - scenario.costReduction);

  const baselineCost = safeBaselineFreq * safeCostPerEvent;
  const improvedCost = reducedFrequency * reducedCostPerEvent;

  return {
    baselineFrequency: safeBaselineFreq,
    costPerEvent: safeCostPerEvent,
    reducedFrequency,
    reducedCostPerEvent,
    baselineCost,
    improvedCost,
    annualValue: baselineCost - improvedCost
  };
}

export function hoursToCost(hours = 0, hourlyRate = 0) {
  return Math.max(0, hours) * Math.max(0, hourlyRate);
}
