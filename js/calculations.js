/**
 * Cálculos del dashboard (margen, termómetro, fijos del mes)
 */

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
 * Normaliza un doc de Firestore para que cálculos y UI sean consistentes.
 * Si falta `type`, se asume "gasto" (caso habitual de datos incompletos).
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
    category: raw.category ?? "Otros",
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

/** Primer día del mes desplazado N meses */
export function shiftMonth(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1, 12, 0, 0, 0);
}

/** Cuenta movimientos por monthYear (yyyy-mm), útil para avisos */
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

/**
 * Balance del mes (CONTEXT):
 * ingresos totales − gastos fijos = margen
 * termómetro = % del margen consumido por gastos variables
 */
export function computeMonthlyBalance(transactions, refDate = new Date()) {
  let ingresos = 0;
  let ingresosFijos = 0;
  let gastosFijos = 0;
  let gastosVariables = 0;

  for (const tx of transactions) {
    const d = toDate(tx.date);
    if (!d || !isInMonth(d, refDate)) continue;

    const amount = toAmount(tx.amount);
    if (tx.type === "ingreso") {
      ingresos += amount;
      if (tx.isFixed) ingresosFijos += amount;
    } else {
      if (tx.isFixed) gastosFijos += amount;
      else gastosVariables += amount;
    }
  }

  const margen = ingresos - gastosFijos;
  const restante = margen - gastosVariables;
  const usoPct =
    margen > 0
      ? Math.min(100, Math.round((gastosVariables / margen) * 100))
      : gastosVariables > 0
        ? 100
        : 0;

  return {
    ingresos,
    ingresosFijos,
    gastosFijos,
    gastosVariables,
    margen,
    restante,
    usoPct,
  };
}

/**
 * Movimientos fijos del mes (ingresos y gastos), próximos primero.
 * Si ya pasaron todos, muestra los del mes ordenados por día.
 */
export function getMonthlyFixed(transactions, refDate = new Date(), limit = 10) {
  const today = startOfDay(refDate);

  const fixedThisMonth = transactions
    .filter((tx) => {
      if (!tx.isFixed) return false;
      const d = toDate(tx.date);
      return d && isInMonth(d, refDate);
    })
    .map((tx) => ({ ...tx, _date: toDate(tx.date) }))
    .sort((a, b) => a._date - b._date);

  const upcoming = fixedThisMonth.filter((tx) => tx._date >= today);
  return (upcoming.length > 0 ? upcoming : fixedThisMonth).slice(0, limit);
}

/** Gasto variable del mes agrupado por categoría (para sobres) */
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

/** Movimientos del mes de referencia, más recientes primero */
export function getMonthTransactions(transactions, refDate = new Date(), limit = 50) {
  return [...transactions]
    .map((tx) => ({ ...tx, _date: toDate(tx.date) }))
    .filter((tx) => tx._date && isInMonth(tx._date, refDate))
    .sort((a, b) => b._date - a._date)
    .slice(0, limit);
}
