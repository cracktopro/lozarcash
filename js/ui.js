/**
 * Renderizado del dashboard, modal y sobres/presupuestos
 */
import {
  CATEGORIES,
  INCOME_CATEGORIES,
  USERS,
  USER_STORAGE_KEY,
} from "./constants.js";
import {
  computeMonthlyBalance,
  countByMonth,
  expensesByCategory,
  formatMoney,
  formatPeriod,
  formatShortDate,
  getMonthTransactions,
  getMonthlyFixed,
  monthYearKey,
  shiftMonth,
  spendByCategory,
  startOfMonth,
} from "./calculations.js";
import { addTransaction, removeTransaction } from "./transactions.js";
import { saveBudget } from "./budgets.js";
import { renderExpenseChart } from "./charts.js";

let currentTransactions = [];
let currentBudget = { monthYear: monthYearKey(), categories: {} };
/** Mes que se está visualizando (día 1 a mediodía) */
let viewMonth = startOfMonth(new Date());
/** Callback para que app.js re-suscriba el presupuesto del mes */
let monthChangeHandler = null;

function todayInputValue(ref = new Date()) {
  const d = ref;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Día sugerido al crear tx: hoy si el mes visto es el actual; si no, día 1 de ese mes */
function defaultDateForView() {
  const now = new Date();
  if (
    viewMonth.getFullYear() === now.getFullYear() &&
    viewMonth.getMonth() === now.getMonth()
  ) {
    return todayInputValue(now);
  }
  return todayInputValue(viewMonth);
}

function getStoredUser() {
  return localStorage.getItem(USER_STORAGE_KEY) || USERS[0];
}

function setStoredUser(name) {
  localStorage.setItem(USER_STORAGE_KEY, name);
}

function termometroColor(pct) {
  if (pct >= 90) return "var(--color-danger)";
  if (pct >= 70) return "var(--color-warning)";
  return "var(--color-accent)";
}

function envelopeColor(pct) {
  if (pct >= 100) return "var(--color-danger)";
  if (pct >= 80) return "var(--color-warning)";
  return "var(--color-accent)";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function onViewMonthChange(fn) {
  monthChangeHandler = fn;
}

export function getViewMonth() {
  return viewMonth;
}

export function setViewMonth(date) {
  viewMonth = startOfMonth(date);
  if (monthChangeHandler) monthChangeHandler(viewMonth);
  renderDashboard();
}

export function setTransactions(transactions) {
  currentTransactions = transactions;
  renderDashboard();
}

export function setBudget(budget) {
  currentBudget = budget || {
    monthYear: monthYearKey(viewMonth),
    categories: {},
  };
  renderDashboard();
}

export function renderDashboard() {
  const transactions = currentTransactions;
  const balance = computeMonthlyBalance(transactions, viewMonth);
  const periodEl = document.getElementById("current-period");
  const disponibleEl = document.getElementById("disponible-ahora");
  const ingresosEl = document.getElementById("ingresos-mes");
  const fijosEl = document.getElementById("gastos-fijos-mes");
  const carryEl = document.getElementById("carry-in");
  const fillEl = document.getElementById("termometro-fill");
  const meterLabel = document.getElementById("hero-meter-label");
  const footnote = document.getElementById("hero-footnote");
  const savingsEl = document.getElementById("savings-rate");
  const budgetLead = document.getElementById("budget-lead");

  if (periodEl) periodEl.textContent = formatPeriod(viewMonth);
  if (disponibleEl) {
    disponibleEl.textContent = formatMoney(balance.restante);
    disponibleEl.classList.toggle("is-negative", balance.restante < 0);
  }
  if (ingresosEl) ingresosEl.textContent = formatMoney(balance.ingresos);
  if (fijosEl) fijosEl.textContent = formatMoney(balance.gastosFijos);
  if (carryEl) carryEl.textContent = formatMoney(balance.carryIn);
  if (fillEl) {
    fillEl.style.width = `${balance.usoPct}%`;
    fillEl.style.background = termometroColor(balance.usoPct);
  }
  if (meterLabel) {
    meterLabel.textContent =
      balance.margen > 0
        ? `Habéis gastado ${formatMoney(balance.gastosVariables)} de ${formatMoney(balance.margen)} para el día a día`
        : "Aún no hay margen para gastos variables este mes";
  }
  if (footnote) {
    footnote.textContent = `Presupuesto variable ${formatMoney(balance.margen)} · cuotas ${formatMoney(balance.gastosFijos)} · arrastre ${formatMoney(balance.carryIn)}`;
  }
  if (savingsEl) {
    const rate = balance.tasaAhorro;
    savingsEl.textContent = `${rate} %`;
    savingsEl.classList.toggle("is-negative", rate < 0);
  }
  if (budgetLead) {
    budgetLead.textContent = `Ahora mismo os quedan ${formatMoney(balance.restante)} en caja. Asignad límites a las categorías que uséis; el resto queda sin repartir.`;
  }

  renderMonthHint(transactions);
  renderFixedList(getMonthlyFixed(transactions, viewMonth));
  renderRecent(getMonthTransactions(transactions, viewMonth));
  renderEnvelopes(balance);
  renderExpenseChart(
    document.getElementById("expense-chart"),
    expensesByCategory(transactions, viewMonth)
  );
}

function renderMonthHint(transactions) {
  const el = document.getElementById("month-hint");
  if (!el) return;

  const counts = countByMonth(transactions);
  const currentKey = monthYearKey(viewMonth);
  const currentCount = counts[currentKey] || 0;

  let bestKey = null;
  let bestCount = 0;
  for (const [key, n] of Object.entries(counts)) {
    if (key === currentKey) continue;
    if (n > bestCount) {
      bestCount = n;
      bestKey = key;
    }
  }

  if (currentCount === 0 && bestKey && bestCount > 0) {
    const [y, m] = bestKey.split("-").map(Number);
    const label = formatPeriod(new Date(y, m - 1, 1));
    el.hidden = false;
    el.innerHTML = `No hay movimientos registrados en este mes. Hay <strong>${bestCount}</strong> en <strong>${escapeHtml(label)}</strong>. Los fijos se repiten solos; el saldo restante arrastra. <button type="button" class="btn-link" data-goto-month="${bestKey}">Ver ese mes</button>`;
  } else {
    el.hidden = true;
    el.innerHTML = "";
  }
}

function renderFixedList(items) {
  const list = document.getElementById("fixed-list");
  const empty = document.getElementById("fixed-empty");
  if (!list || !empty) return;

  list.innerHTML = "";
  if (items.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const tx of items) {
    const li = document.createElement("li");
    li.className = "tx-item";
    const isIngreso = tx.type === "ingreso";
    const signClass = isIngreso
      ? "tx-item__amount--ingreso"
      : "tx-item__amount--gasto";
    const kind = isIngreso ? "Ingreso fijo" : "Gasto fijo";
    const recur = tx._projected
      ? '<span class="badge">Recurrente</span>'
      : "";

    li.innerHTML = `
      <div class="tx-item__main">
        <span class="tx-item__concept">${escapeHtml(tx.concept)} <span class="badge badge--muted">${kind}</span> ${recur}</span>
        <span class="tx-item__meta">Día ${tx._date.getDate()} · ${escapeHtml(tx.category)}</span>
      </div>
      <div class="tx-item__aside">
        <span class="tx-item__amount ${signClass}">${isIngreso ? "+" : "−"}${formatMoney(tx.amount)}</span>
        <button type="button" class="tx-item__delete" data-id="${escapeHtml(tx.id)}" data-fixed="1" aria-label="Eliminar cuota">×</button>
      </div>
    `;
    list.appendChild(li);
  }
}

function renderRecent(items) {
  const list = document.getElementById("recent-list");
  const empty = document.getElementById("recent-empty");
  if (!list || !empty) return;

  list.innerHTML = "";
  if (items.length === 0) {
    empty.hidden = false;
    empty.textContent = `No hay movimientos en ${formatPeriod(viewMonth)}.`;
    return;
  }
  empty.hidden = true;

  for (const tx of items) {
    const li = document.createElement("li");
    li.className = "tx-item";
    const isIngreso = tx.type === "ingreso";
    const signClass = isIngreso
      ? "tx-item__amount--ingreso"
      : "tx-item__amount--gasto";
    const badges = [
      tx.isBizum ? '<span class="badge">Bizum</span>' : "",
      tx.isFixed ? '<span class="badge badge--muted">Fijo</span>' : "",
    ].join("");

    li.innerHTML = `
      <div class="tx-item__main">
        <span class="tx-item__concept">${escapeHtml(tx.concept)} ${badges}</span>
        <span class="tx-item__meta">${formatShortDate(tx._date)} · ${escapeHtml(tx.category)} · ${escapeHtml(tx.addedBy || "")}</span>
      </div>
      <div class="tx-item__aside">
        <span class="tx-item__amount ${signClass}">${isIngreso ? "+" : "−"}${formatMoney(tx.amount)}</span>
        <button type="button" class="tx-item__delete" data-id="${escapeHtml(tx.id)}" aria-label="Eliminar">×</button>
      </div>
    `;
    list.appendChild(li);
  }
}

function renderEnvelopes(balance) {
  const list = document.getElementById("envelope-list");
  const empty = document.getElementById("envelope-empty");
  const summary = document.getElementById("envelope-summary");
  if (!list || !empty) return;

  const limits = currentBudget.categories || {};
  const spent = spendByCategory(currentTransactions, viewMonth);

  // Prioriza sobres con límite; los gastos sin sobre van al final
  const withLimit = Object.keys(limits)
    .filter((c) => Number(limits[c]) > 0)
    .sort((a, b) => a.localeCompare(b, "es"));
  const withoutLimit = Object.keys(spent)
    .filter((c) => !(Number(limits[c]) > 0))
    .sort((a, b) => a.localeCompare(b, "es"));
  const cats = [...withLimit, ...withoutLimit];

  list.innerHTML = "";

  if (cats.length === 0) {
    empty.hidden = false;
    if (summary) {
      summary.hidden = true;
      summary.innerHTML = "";
    }
    return;
  }
  empty.hidden = true;

  let assigned = 0;
  for (const cat of withLimit) {
    assigned += Number(limits[cat]) || 0;
  }

  // Libre = dinero real en caja menos lo repartido en sobres
  const disponible = balance.restante;
  const sinRepartir = Math.round((disponible - assigned) * 100) / 100;

  for (const cat of cats) {
    const limit = Number(limits[cat]) || 0;
    const used = Number(spent[cat]) || 0;
    const hasLimit = limit > 0;
    const pct = hasLimit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    const remaining = hasLimit ? Math.round((limit - used) * 100) / 100 : null;

    const li = document.createElement("li");
    li.className = hasLimit ? "envelope" : "envelope envelope--open";

    const figures = hasLimit
      ? `${formatMoney(used)} de ${formatMoney(limit)}`
      : `${formatMoney(used)} · sin límite`;
    const status =
      hasLimit && remaining != null
        ? remaining >= 0
          ? `<span class="envelope__left">quedan ${formatMoney(remaining)}</span>`
          : `<span class="envelope__left envelope__left--over">pasáis ${formatMoney(Math.abs(remaining))}</span>`
        : `<span class="envelope__left">sin sobre asignado</span>`;

    const barHtml = hasLimit
      ? `<div class="envelope__bar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
           <div class="envelope__fill" style="width:${pct}%;background:${envelopeColor(pct)}"></div>
         </div>`
      : `<div class="envelope__bar envelope__bar--muted" aria-hidden="true">
           <div class="envelope__fill" style="width:${used > 0 ? 28 : 0}%;background:var(--color-ink-faint)"></div>
         </div>`;

    li.innerHTML = `
      <div class="envelope__head">
        <span class="envelope__name">${escapeHtml(cat)}</span>
        <span class="envelope__figures">${figures}</span>
      </div>
      ${barHtml}
      ${status}
    `;
    list.appendChild(li);
  }

  if (summary) {
    summary.hidden = false;
    const overClass = sinRepartir < 0 ? " pill--warn" : "";
    summary.innerHTML = `
      <span class="pill">En caja <strong>${formatMoney(disponible)}</strong></span>
      <span class="pill">En sobres <strong>${formatMoney(assigned)}</strong></span>
      <span class="pill${overClass}">Sin repartir <strong>${formatMoney(sinRepartir)}</strong></span>
    `;
  }
}

function fillCategorySelect(select, preferred) {
  select.innerHTML = "";
  for (const cat of CATEGORIES) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  }
  if (preferred && CATEGORIES.includes(preferred)) {
    select.value = preferred;
  }
}

function updateFixedToggleLabel(form) {
  const label = document.getElementById("tx-fixed-label");
  if (!label || !form) return;
  const isIngreso =
    form.querySelector('input[name="txType"]:checked')?.value === "ingreso";
  label.textContent = "Se repite cada mes";
}

export function initMonthNav() {
  const prev = document.getElementById("btn-month-prev");
  const next = document.getElementById("btn-month-next");
  prev?.addEventListener("click", () => setViewMonth(shiftMonth(viewMonth, -1)));
  next?.addEventListener("click", () => setViewMonth(shiftMonth(viewMonth, 1)));

  document.getElementById("month-hint")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-goto-month]");
    if (!btn) return;
    const [y, m] = btn.dataset.gotoMonth.split("-").map(Number);
    setViewMonth(new Date(y, m - 1, 1));
  });
}

export function initModal() {
  const dialog = document.getElementById("modal-transaction");
  const form = document.getElementById("form-transaction");
  const fab = document.getElementById("btn-add-transaction");
  const btnClose = document.getElementById("btn-close-modal");
  const btnCancel = document.getElementById("btn-cancel-modal");
  const categorySelect = document.getElementById("tx-category");
  const userSelect = document.getElementById("tx-user");
  const typeInputs = form?.querySelectorAll('input[name="txType"]');
  const statusEl = document.getElementById("form-status");

  if (!dialog || !form || !fab) return;

  fillCategorySelect(categorySelect);

  for (const user of USERS) {
    const opt = document.createElement("option");
    opt.value = user;
    opt.textContent = user;
    userSelect.appendChild(opt);
  }
  userSelect.value = getStoredUser();

  function openModal() {
    form.reset();
    document.getElementById("tx-date").value = defaultDateForView();
    document.getElementById("tx-type-gasto").checked = true;
    fillCategorySelect(categorySelect, "Supermercado");
    userSelect.value = getStoredUser();
    updateFixedToggleLabel(form);
    statusEl.textContent = "";
    statusEl.hidden = true;
    dialog.showModal();
    document.getElementById("tx-amount")?.focus();
  }

  function closeModal() {
    dialog.close();
  }

  fab.addEventListener("click", openModal);
  btnClose?.addEventListener("click", closeModal);
  btnCancel?.addEventListener("click", closeModal);

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) closeModal();
  });

  typeInputs?.forEach((input) => {
    input.addEventListener("change", () => {
      updateFixedToggleLabel(form);
      const isIngreso =
        form.querySelector('input[name="txType"]:checked')?.value === "ingreso";
      if (isIngreso) {
        fillCategorySelect(categorySelect, INCOME_CATEGORIES[0]);
        document.getElementById("tx-fixed").checked = true;
      } else {
        fillCategorySelect(categorySelect, "Supermercado");
      }
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('[type="submit"]');
    const type =
      form.querySelector('input[name="txType"]:checked')?.value === "ingreso"
        ? "ingreso"
        : "gasto";

    const payload = {
      type,
      amount: document.getElementById("tx-amount").value,
      concept: document.getElementById("tx-concept").value,
      category: document.getElementById("tx-category").value,
      date: document.getElementById("tx-date").value,
      isFixed: document.getElementById("tx-fixed").checked,
      isBizum: document.getElementById("tx-bizum").checked,
      addedBy: document.getElementById("tx-user").value,
    };

    if (!payload.concept?.trim() || !(Number(payload.amount) > 0)) {
      statusEl.hidden = false;
      statusEl.textContent = "Revisa el importe y el concepto.";
      return;
    }

    submitBtn.disabled = true;
    statusEl.hidden = false;
    statusEl.textContent = "Guardando…";

    try {
      setStoredUser(payload.addedBy);
      await addTransaction(payload);
      // Si guarda en otro mes, saltar a ese mes para ver el efecto
      const [y, m] = payload.date.split("-").map(Number);
      const txMonth = new Date(y, m - 1, 1);
      if (
        txMonth.getFullYear() !== viewMonth.getFullYear() ||
        txMonth.getMonth() !== viewMonth.getMonth()
      ) {
        setViewMonth(txMonth);
      }
      closeModal();
    } catch (err) {
      console.error(err);
      statusEl.textContent = `Error: ${err.message}`;
    } finally {
      submitBtn.disabled = false;
    }
  });
}

export function initBudgetModal() {
  const dialog = document.getElementById("modal-budget");
  const form = document.getElementById("form-budget");
  const openBtn = document.getElementById("btn-edit-budgets");
  const btnClose = document.getElementById("btn-close-budget");
  const btnCancel = document.getElementById("btn-cancel-budget");
  const fields = document.getElementById("budget-fields");
  const statusEl = document.getElementById("budget-status");

  if (!dialog || !form || !openBtn || !fields) return;

  const expenseCats = CATEGORIES.filter(
    (c) => !INCOME_CATEGORIES.includes(c) || c === "Otros"
  );

  function openModal() {
    fields.innerHTML = "";
    const limits = currentBudget.categories || {};
    for (const cat of expenseCats) {
      const label = document.createElement("label");
      label.className = "field";
      label.innerHTML = `
        <span class="field__label">${escapeHtml(cat)}</span>
        <input class="field__input" type="number" name="${escapeHtml(cat)}" min="0" step="1" inputmode="decimal" value="${limits[cat] ?? ""}" placeholder="0" />
      `;
      fields.appendChild(label);
    }
    statusEl.textContent = "";
    statusEl.hidden = true;
    dialog.showModal();
  }

  openBtn.addEventListener("click", openModal);
  btnClose?.addEventListener("click", () => dialog.close());
  btnCancel?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('[type="submit"]');
    const categories = {};
    for (const input of fields.querySelectorAll("input")) {
      const n = Number(input.value);
      if (n > 0) categories[input.name] = n;
    }

    submitBtn.disabled = true;
    statusEl.hidden = false;
    statusEl.textContent = "Guardando…";

    try {
      await saveBudget(monthYearKey(viewMonth), categories);
      dialog.close();
    } catch (err) {
      console.error(err);
      statusEl.textContent = `Error: ${err.message}`;
    } finally {
      submitBtn.disabled = false;
    }
  });
}

export function initListActions() {
  const root = document.querySelector(".app");
  if (!root) return;

  root.addEventListener("click", async (e) => {
    const btn = e.target.closest(".tx-item__delete");
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    const isFixed = btn.dataset.fixed === "1";
    const msg = isFixed
      ? "¿Eliminar esta cuota fija? Dejará de aplicarse en todos los meses."
      : "¿Eliminar este movimiento?";
    if (!confirm(msg)) return;
    btn.disabled = true;
    try {
      await removeTransaction(id);
    } catch (err) {
      alert(`No se pudo eliminar: ${err.message}`);
      btn.disabled = false;
    }
  });
}

export function showSyncError(message) {
  const el = document.getElementById("sync-error");
  if (!el) return;
  el.hidden = !message;
  el.textContent = message || "";
}
