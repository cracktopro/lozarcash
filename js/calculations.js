/**
 * Cálculos del dashboard:
 * - Fijos recurrentes desde su mes de alta
 * - Saldo arrastrado mes a mes
 * - Analítica (tasa de ahorro, gastos por categoría)
 */
import { canonicalCategory } from "./constants.js";

/** Convierte Timestamp de Firestore / Date / string / {seconds} a Date local */
export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "object" && value.seconds != null) {
    return new Date(value.seconds * 1000);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Importe robusto (number, "12.5", "12,5") */
export function toAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value.trim().replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Normaliza un doc de Firestore.
 * Si falta `type`, se asume "gasto".
 */
export function normalizeTransaction(raw) {
  const rawType = String(raw.type ?? "")
    .toLowerCase()
    .trim();
  const type = rawType === "ingreso" ? "ingreso" : "gasto";

  return {
    ...raw,
    type,
    amount: toAmount(raw.amount),
    isFixed: Boolean(raw.isFixed),
    isBizum: Boolean(raw.isBizum),
    concept: raw.concept ?? "",
    category: canonicalCategory(raw.category),
    addedBy: raw.addedBy ?? "",
  };
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function isInMonth(date, ref = new Date()) {
  return (
    date.getFullYear() === ref.getFullYear() &&
    date.getMonth() === ref.getMonth()
  );
}

export function formatMoney(amount) {
  const n = toAmount(amount);
  return (
    new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: n % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n) + " €"
  );
}

export function formatPeriod(date = new Date()) {
  return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

export function formatShortDate(date) {
  if (!date) return "—";
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function monthYearKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function shiftMonth(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1, 12, 0, 0, 0);
}

export function countByMonth(transactions) {
  const map = {};
  for (const tx of transactions) {
    const d = toDate(tx.date);
    if (!d) continue;
    const key = monthYearKey(d);
    map[key] = (map[key] || 0) + 1;
  }
  return map;
}

/** Proyecta el día de un fijo al mes de referencia (ajusta fin de mes). */
export function projectFixedDate(templateDate, refMonth) {
  const day = templateDate.getDate();
  const y = refMonth.getFullYear();
  const m = refMonth.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, lastDay), 12, 0, 0, 0);
}

/**
 * Plantillas fijas activas en el mes: alta en ese mes o en uno anterior.
 * `_projected` = true si la ocurrencia no es el documento original de ese mes.
 */
export function getActiveFixedTemplates(transactions, refDate = new Date()) {
  const refStart = startOfMonth(refDate).getTime();

  return transactions
    .filter((tx) => {
      if (!tx.isFixed) return false;
      const d = toDate(tx.date);
      if (!d) return false;
      return startOfMonth(d).getTime() <= refStart;
    })
    .map((tx) => {
      const origin = toDate(tx.date);
      const occurrence = projectFixedDate(origin, refDate);
      return {
        ...tx,
        _date: occurrence,
        _originDate: origin,
        _projected: !isInMonth(origin, refDate),
      };
    })
    .sort((a, b) => a._date - b._date);
}

function findEarliestMonth(transactions, fallback) {
  let min = null;
  for (const tx of transactions) {
    const d = toDate(tx.date);
    if (!d) continue;
    const s = startOfMonth(d);
    if (!min || s < min) min = s;
  }
  const fb = startOfMonth(fallback);
  if (!min) return fb;
  return min > fb ? fb : min;
}

/**
 * Balance de un mes concreto con arrastre opcional.
 * Fijos = cuotas recurrentes activas; variables = movimientos no fijos del mes.
 */
export function computeSingleMonth(transactions, refDate = new Date(), carryIn = 0) {
  const fixed = getActiveFixedTemplates(transactions, refDate);

  let ingresosFijos = 0;
  let gastosFijos = 0;
  for (const tx of fixed) {
    const amount = toAmount(tx.amount);
    if (tx.type === "ingreso") ingresosFijos += amount;
    else gastosFijos += amount;
  }

  let ingresosVariables = 0;
  let gastosVariables = 0;
  for (const tx of transactions) {
    if (tx.isFixed) continue;
    const d = toDate(tx.date);
    if (!d || !isInMonth(d, refDate)) continue;
    const amount = toAmount(tx.amount);
    if (tx.type === "ingreso") ingresosVariables += amount;
    else gastosVariables += amount;
  }

  const round2 = (n) => Math.round(n * 100) / 100;
  const ingresos = round2(ingresosFijos + ingresosVariables);
  const margen = round2(carryIn + ingresos - gastosFijos);
  const restante = round2(margen - gastosVariables);
  const disponible = round2(carryIn + ingresos);
  const usoPct =
    margen > 0
      ? Math.min(100, Math.round((gastosVariables / margen) * 100))
      : gastosVariables > 0
        ? 100
        : 0;

  const totalGastos = round2(gastosFijos + gastosVariables);
  const tasaAhorro =
    ingresos > 0
      ? Math.round(((ingresos - totalGastos) / ingresos) * 1000) / 10
      : 0;

  return {
    carryIn: round2(carryIn),
    ingresos,
    ingresosFijos: round2(ingresosFijos),
    ingresosVariables: round2(ingresosVariables),
    gastosFijos: round2(gastosFijos),
    gastosVariables: round2(gastosVariables),
    totalGastos,
    margen,
    restante,
    disponible,
    usoPct,
    tasaAhorro,
  };
}

/**
 * Balance del mes visualizado, arrastrando el restante de meses anteriores.
 * margen = arrastre + ingresos − gastos fijos (recurrentes)
 * restante = margen − gastos variables (queda para el mes siguiente)
 */
export function computeMonthlyBalance(transactions, refDate = new Date()) {
  const target = startOfMonth(refDate);
  let cursor = findEarliestMonth(transactions, target);
  let carry = 0;
  let result = computeSingleMonth(transactions, cursor, 0);

  while (cursor.getTime() < target.getTime()) {
    carry = result.restante;
    cursor = startOfMonth(shiftMonth(cursor, 1));
    result = computeSingleMonth(transactions, cursor, carry);
  }

  return result;
}

/** Próximos fijos del mes (recurrentes proyectados), máx. `limit`. */
export function getMonthlyFixed(transactions, refDate = new Date(), limit = 10) {
  const today = startOfDay(new Date());
  const viewingCurrent =
    refDate.getFullYear() === today.getFullYear() &&
    refDate.getMonth() === today.getMonth();

  const fixed = getActiveFixedTemplates(transactions, refDate);
  if (!viewingCurrent) {
    return fixed.slice(0, limit);
  }

  const upcoming = fixed.filter((tx) => tx._date >= today);
  return (upcoming.length > 0 ? upcoming : fixed).slice(0, limit);
}

/** Gastos variables del mes por categoría (sobres). */
export function spendByCategory(transactions, refDate = new Date()) {
  const map = {};
  for (const tx of transactions) {
    if (tx.type !== "gasto" || tx.isFixed) continue;
    const d = toDate(tx.date);
    if (!d || !isInMonth(d, refDate)) continue;
    const cat = tx.category || "Otros";
    map[cat] = (map[cat] || 0) + toAmount(tx.amount);
  }
  return map;
}

/** Todos los gastos del mes (variables + fijos proyectados) por categoría — gráfico. */
export function expensesByCategory(transactions, refDate = new Date()) {
  const map = { ...spendByCategory(transactions, refDate) };
  for (const tx of getActiveFixedTemplates(transactions, refDate)) {
    if (tx.type !== "gasto") continue;
    const cat = tx.category || "Otros";
    map[cat] = (map[cat] || 0) + toAmount(tx.amount);
  }
  return map;
}

/** Movimientos reales registrados en el mes (sin proyecciones). */
export function getMonthTransactions(transactions, refDate = new Date(), limit = 50) {
  return [...transactions]
    .map((tx) => ({ ...tx, _date: toDate(tx.date) }))
    .filter((tx) => tx._date && isInMonth(tx._date, refDate))
    .sort((a, b) => b._date - a._date)
    .slice(0, limit);
}
