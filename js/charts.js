/**
 * Gráfico de tarta (Chart.js) — gastos del mes por categoría
 */
import {
  Chart,
  ArcElement,
  Tooltip,
  Legend,
  DoughnutController,
} from "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/+esm";

Chart.register(ArcElement, Tooltip, Legend, DoughnutController);

const PALETTE = [
  "#3dba8a",
  "#e89b6d",
  "#5ec8d4",
  "#e8a54b",
  "#7dd3a8",
  "#c4b5fd",
  "#6aa8ff",
  "#f07167",
  "#a3e635",
  "#94a3b8",
];

let chartInstance = null;

/**
 * @param {HTMLCanvasElement|null} canvas
 * @param {Record<string, number>} byCategory
 */
export function renderExpenseChart(canvas, byCategory) {
  if (!canvas) return;

  const labels = Object.keys(byCategory).sort((a, b) =>
    a.localeCompare(b, "es")
  );
  const values = labels.map((k) => byCategory[k]);
  const empty = values.length === 0 || values.every((v) => v <= 0);

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const emptyEl = document.getElementById("chart-empty");
  if (emptyEl) emptyEl.hidden = !empty;
  canvas.hidden = empty;
  if (empty) return;

  chartInstance = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 12,
            padding: 12,
            font: { family: "'Sora', sans-serif", size: 12 },
            color: "#e7f0eb",
          },
        },
        tooltip: {
          backgroundColor: "#121a18",
          titleColor: "#e7f0eb",
          bodyColor: "#8b9e94",
          borderColor: "#27332e",
          borderWidth: 1,
          callbacks: {
            label(ctx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const v = ctx.parsed;
              const pct = total ? Math.round((v / total) * 100) : 0;
              const formatted = new Intl.NumberFormat("es-ES", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              }).format(v);
              return ` ${formatted} € (${pct}%)`;
            },
          },
        },
      },
    },
  });
}
