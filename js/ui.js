/**
 * Renderizado del dashboard y modal de nueva transacción
 */
import { CATEGORIES, USERS, USER_STORAGE_KEY } from "./constants.js";
import {
  computeMonthlyBalance,
  formatMoney,
  formatPeriod,
  formatShortDate,
  getRecentTransactions,
  getUpcomingFixed,
} from "./calculations.js";
import { addTransaction, removeTransaction } from "./transactions.js";

function todayInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

export function renderDashboard(transactions) {
  const balance = computeMonthlyBalance(transactions);
  const periodEl = document.getElementById("current-period");
  const margenEl = document.getElementById("margen-disponible");
  const ingresosEl = document.getElementById("ingresos-mes");
  const fijosEl = document.getElementById("gastos-fijos-mes");
  const fillEl = document.getElementById("termometro-fill");
  const meterEl = fillEl?.closest(".termometro");
  const hintEl = document.querySelector(".caja-fuerte__hint");

  if (periodEl) periodEl.textContent = formatPeriod();
  if (margenEl) {
    margenEl.textContent = formatMoney(balance.restante);
    margenEl.classList.toggle("is-negative", balance.restante < 0);
  }
  if (ingresosEl) ingresosEl.textContent = formatMoney(balance.ingresos);
  if (fijosEl) fijosEl.textContent = formatMoney(balance.gastosFijos);
  if (hintEl) {
    hintEl.textContent =
      balance.margen > 0
        ? `Margen ${formatMoney(balance.margen)} · gastado ${formatMoney(balance.gastosVariables)}`
        : "Margen mensual disponible";
  }
  if (fillEl) {
    fillEl.style.width = `${balance.usoPct}%`;
    fillEl.style.background = termometroColor(balance.usoPct);
  }
  if (meterEl) {
    meterEl.setAttribute("aria-valuenow", String(balance.usoPct));
  }

  renderUpcomingFixed(getUpcomingFixed(transactions));
  renderRecent(getRecentTransactions(transactions));
}

function renderUpcomingFixed(items) {
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
    li.innerHTML = `
      <div class="tx-item__main">
        <span class="tx-item__concept">${escapeHtml(tx.concept)}</span>
        <span class="tx-item__meta">${formatShortDate(tx._date)} · ${escapeHtml(tx.category)}</span>
      </div>
      <span class="tx-item__amount tx-item__amount--gasto">${formatMoney(tx.amount)}</span>
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
    return;
  }
  empty.hidden = true;

  for (const tx of items) {
    const li = document.createElement("li");
    li.className = "tx-item";
    const signClass =
      tx.type === "ingreso" ? "tx-item__amount--ingreso" : "tx-item__amount--gasto";
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
        <span class="tx-item__amount ${signClass}">${tx.type === "ingreso" ? "+" : "−"}${formatMoney(tx.amount)}</span>
        <button type="button" class="tx-item__delete" data-id="${escapeHtml(tx.id)}" aria-label="Eliminar">×</button>
      </div>
    `;
    list.appendChild(li);
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function initModal() {
  const dialog = document.getElementById("modal-transaction");
  const form = document.getElementById("form-transaction");
  const fab = document.getElementById("btn-add-transaction");
  const btnClose = document.getElementById("btn-close-modal");
  const btnCancel = document.getElementById("btn-cancel-modal");
  const categorySelect = document.getElementById("tx-category");
  const userSelect = document.getElementById("tx-user");
  const typeInputs = form?.querySelectorAll('input[name="type"]');
  const statusEl = document.getElementById("form-status");

  if (!dialog || !form || !fab) return;

  for (const cat of CATEGORIES) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  }

  for (const user of USERS) {
    const opt = document.createElement("option");
    opt.value = user;
    opt.textContent = user;
    userSelect.appendChild(opt);
  }
  userSelect.value = getStoredUser();

  function openModal() {
    form.reset();
    document.getElementById("tx-date").value = todayInputValue();
    document.getElementById("tx-type-gasto").checked = true;
    userSelect.value = getStoredUser();
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
      const isIngreso = form.type.value === "ingreso";
      if (isIngreso && categorySelect.value === "Supermercado") {
        categorySelect.value = "Salario";
      }
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('[type="submit"]');
    const fd = new FormData(form);

    const payload = {
      type: fd.get("type"),
      amount: fd.get("amount"),
      concept: fd.get("concept"),
      category: fd.get("category"),
      date: fd.get("date"),
      isFixed: fd.get("isFixed") === "on",
      isBizum: fd.get("isBizum") === "on",
      addedBy: fd.get("addedBy"),
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
      closeModal();
    } catch (err) {
      console.error(err);
      statusEl.textContent = `Error: ${err.message}`;
    } finally {
      submitBtn.disabled = false;
    }
  });
}

export function initRecentListActions() {
  const list = document.getElementById("recent-list");
  if (!list) return;

  list.addEventListener("click", async (e) => {
    const btn = e.target.closest(".tx-item__delete");
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    if (!confirm("¿Eliminar este movimiento?")) return;
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
