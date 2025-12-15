export const calculatorRegistry = [];

export function registerCalculator(config) {
  if (!config || !config.id) return;
  if (calculatorRegistry.find((c) => c.id === config.id)) return;
  calculatorRegistry.push({
    assumptions: [],
    ...config
  });
}

export function getCalculator(id) {
  return calculatorRegistry.find((calc) => calc.id === id) || calculatorRegistry[0];
}
