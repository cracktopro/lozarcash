/**
 * Lozarcash — entry point
 * Fase 2: dashboard en vivo, modal CRUD y cálculos de margen
 */
import { subscribeTransactions } from "./js/transactions.js";
import {
  initModal,
  initRecentListActions,
  renderDashboard,
  showSyncError,
} from "./js/ui.js";

function boot() {
  initModal();
  initRecentListActions();

  subscribeTransactions(
    (transactions) => {
      showSyncError("");
      renderDashboard(transactions);
    },
    (err) => {
      showSyncError(`No se pudo sincronizar: ${err.message}`);
    }
  );

  console.log("[Lozarcash] Dashboard + listener activos.");
}

boot();
