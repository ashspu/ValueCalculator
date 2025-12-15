import { formatCurrency } from "./config/global.js";

export function renderValueChart(container, data) {
  if (!container) return;
  const { baselineCost = 0, improvedCost = 0, annualValue = 0 } = data;
  const max = Math.max(baselineCost, improvedCost, 1);

  container.innerHTML = "";

  const chart = document.createElement("div");
  chart.className = "bar-chart";

  const rows = [
    { label: "Baseline cost", value: baselineCost, className: "baseline" },
    { label: "Improved cost", value: improvedCost, className: "improved" }
  ];

  rows.forEach((row) => {
    const wrapper = document.createElement("div");
    wrapper.className = "bar-row";

    const label = document.createElement("div");
    label.className = "bar-label";
    label.textContent = row.label;

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");
    fill.className = `bar-fill ${row.className === "improved" ? "improved" : ""}`;
    fill.style.width = `${Math.min(100, (row.value / max) * 100)}%`;

    track.appendChild(fill);

    const value = document.createElement("div");
    value.textContent = formatCurrency(row.value);

    wrapper.append(label, track, value);
    chart.appendChild(wrapper);
  });

  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML = `
    <div class="legend-item">
      <span class="legend-swatch" style="background: linear-gradient(90deg, var(--accent), #4fa3ff);"></span>
      Baseline cost
    </div>
    <div class="legend-item">
      <span class="legend-swatch" style="background: linear-gradient(90deg, #1ca37a, #4ad598);"></span>
      Improved cost
    </div>
    <div class="legend-item">
      <span class="legend-swatch" style="background: var(--positive);"></span>
      Value: ${formatCurrency(annualValue)}
    </div>
  `;

  container.append(chart, legend);
}
