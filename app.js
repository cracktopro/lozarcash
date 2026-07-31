/**
 * Lozarcash — entry point
 * Fase 3: fix cálculos, ingresos fijos, sobres y sync budgets
 */
import { subscribeTransactions } from "./js/transactions.js";
import { subscribeBudget } from "./js/budgets.js";
import {
  initModal,
  initBudgetModal,
  initListActions,
  setTransactions,
  setBudget,
  showSyncError,
} from "./js/ui.js";

function boot() {
  initModal();
  initBudgetModal();
  initListActions();

  subscribeTransactions(
    (transactions) => {
      showSyncError("");
      setTransactions(transactions);
    },
    (err) => {
      showSyncError(`No se pudo sincronizar movimientos: ${err.message}`);
    }
  );

  subscribeBudget(
    (budget) => {
      setBudget(budget);
    },
    (err) => {
      showSyncError(`No se pudo sincronizar presupuestos: ${err.message}`);
    }
  );

  console.log("[Lozarcash] Dashboard, fijos e ingresos fijos activos.");
}

boot();
