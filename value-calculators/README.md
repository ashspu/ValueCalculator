# Modular Utilities Value Calculator

Vanilla JS host for value calculators built around two levers: reducing frequency and reducing cost to resolve.

## How it works
- `index.html` renders the shell (selector, inputs grouped by frequency/cost, scenario toggle, results, chart, assumptions).
- `registry.js` holds the calculator registry + `registerCalculator`.
- `app.js` holds router/state and wires the UI.
- `config/global.js` defines shared scenarios and helpers (formatting, query params, theming).
- `calculators/*.js` register themselves via `registerCalculator` and return the universal value model.
- `charts.js` renders a simple baseline vs improved bar chart.
- `themes/*.css` are swapped via `?theme=neutral|smartutilities|gqc`.

## Run locally
Open `index.html` in a browser (no build step). Pick a calculator, adjust inputs, and toggle scenarios to see baseline cost, improved cost, and annual value.

## Embed contract
```html
<iframe
  src=".../value-calculators/index.html?calculator=on_time_billing&theme=neutral"
  style="width:100%; height:900px; border:none;"
></iframe>
```

## Adding a calculator
```js
registerCalculator({
  id: "my_calc",
  name: "My Calculator",
  description: "What it measures",
  inputs: [
    { id: "volume", label: "Annual volume", group: "frequency", defaultValue: 1000 },
    { id: "costPer", label: "Cost per event ($)", group: "cost", defaultValue: 50 }
  ],
  assumptions: ["State your assumptions"],
  calculate: ({ inputs, scenario }) => {
    return buildValueModel({
      baselineFrequency: inputs.volume,
      costPerEvent: inputs.costPer,
      scenarioKey: scenario
    });
  }
});
```

## Universal value model
- Baseline cost = frequency × cost to resolve
- Improved cost = reduced frequency × reduced cost to resolve
- Annual value = baseline − improved
- Scenarios apply consistent multipliers:
  - Conservative: -10% frequency, -15% cost
  - Realistic: -25% frequency, -30% cost
  - Optimistic: -40% frequency, -45% cost
