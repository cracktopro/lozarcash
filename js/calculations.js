/**
 * Cálculos del dashboard (margen, termómetro, próximos fijos)
 */

/** Convierte Timestamp de Firestore / Date / string a Date local */
export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
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
  const n = Number(amount) || 0;
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
  });
}

/**
 * Balance del mes:
 * ingresos − gastos fijos = margen disponible
 * termómetro = % del margen consumido por gastos variables
 */
export function computeMonthlyBalance(transactions, refDate = new Date()) {
  let ingresos = 0;
  let gastosFijos = 0;
  let gastosVariables = 0;

  for (const tx of transactions) {
    const d = toDate(tx.date);
    if (!d || !isInMonth(d, refDate)) continue;

    const amount = Number(tx.amount) || 0;
    if (tx.type === "ingreso") {
      ingresos += amount;
    } else if (tx.type === "gasto") {
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
    gastosFijos,
    gastosVariables,
    margen,
    restante,
    usoPct,
  };
}

/**
 * Próximos gastos fijos del mes (fecha >= hoy), máx. 5.
 * Si no quedan, muestra los fijos del mes ordenados por día.
 */
export function getUpcomingFixed(transactions, refDate = new Date(), limit = 5) {
  const today = startOfDay(refDate);

  const fixedThisMonth = transactions
    .filter((tx) => {
      if (tx.type !== "gasto" || !tx.isFixed) return false;
      const d = toDate(tx.date);
      return d && isInMonth(d, refDate);
    })
    .map((tx) => ({ ...tx, _date: toDate(tx.date) }))
    .sort((a, b) => a._date - b._date);

  const upcoming = fixedThisMonth.filter((tx) => tx._date >= today);
  const list = (upcoming.length > 0 ? upcoming : fixedThisMonth).slice(0, limit);
  return list;
}

/** Últimos movimientos (cualquier mes), más recientes primero */
export function getRecentTransactions(transactions, limit = 8) {
  return [...transactions]
    .map((tx) => ({ ...tx, _date: toDate(tx.date) }))
    .filter((tx) => tx._date)
    .sort((a, b) => b._date - a._date)
    .slice(0, limit);
}
