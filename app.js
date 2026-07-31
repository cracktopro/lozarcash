/**
 * Lozarcash — entry point
 */
import { subscribeTransactions } from "./js/transactions.js";
import { subscribeBudget } from "./js/budgets.js";
import {
  initModal,
  initBudgetModal,
  initListActions,
  initMonthNav,
  onViewMonthChange,
  getViewMonth,
  setTransactions,
  setBudget,
  showSyncError,
} from "./js/ui.js";

function boot() {
  initMonthNav();
  initModal();
  initBudgetModal();
  initListActions();

  let unsubBudget = null;

  function watchBudget(monthDate) {
    if (unsubBudget) unsubBudget();
    unsubBudget = subscribeBudget(
      (budget) => setBudget(budget),
      (err) => {
        showSyncError(`No se pudo sincronizar presupuestos: ${err.message}`);
      },
      monthDate
    );
  }

  onViewMonthChange(watchBudget);
  watchBudget(getViewMonth());

  subscribeTransactions(
    (transactions) => {
      showSyncError("");
      setTransactions(transactions);
    },
    (err) => {
      showSyncError(`No se pudo sincronizar movimientos: ${err.message}`);
    }
  );

  console.log("[Lozarcash] Listo: fijos recurrentes, arrastre de saldo y analítica.");
}

boot();
