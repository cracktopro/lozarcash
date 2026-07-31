/**
 * Cálculos Lozarcash
 * - Mes económico: del día 24 al 24 siguiente
 * - Fijos recurrentes + arrastre de saldo
 * - Calendario de pagos y analítica
 */
import { canonicalCategory } from "./constants.js";

/** Día de inicio del ciclo económico (cobro / cierre) */
export const CYCLE_START_DAY = 24;

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

export function toAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value.trim().replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

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

export function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

/** Clave local yyyy-mm-dd (evita desfases UTC de toISOString) */
export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Inicio del ciclo económico que contiene `date`.
 * Ej: 10 ago → 24 jul; 24 jul → 24 jul; 26 jul → 24 jul.
 */
export function getEconomicPeriodStart(date = new Date()) {
  const d = startOfDay(date);
  if (d.getDate() >= CYCLE_START_DAY) {
    return new Date(d.getFullYear(), d.getMonth(), CYCLE_START_DAY, 0, 0, 0, 0);
  }
  return new Date(d.getFullYear(), d.getMonth() - 1, CYCLE_START_DAY, 0, 0, 0, 0);
}

/** Fin exclusivo del ciclo (= 24 del mes siguiente) */
export function getEconomicPeriodEnd(periodStart) {
  return new Date(
    periodStart.getFullYear(),
    periodStart.getMonth() + 1,
    CYCLE_START_DAY,
    0,
    0,
    0,
    0
  );
}

export function shiftEconomicPeriod(periodStart, delta) {
  return new Date(
    periodStart.getFullYear(),
    periodStart.getMonth() + delta,
    CYCLE_START_DAY,
    0,
    0,
    0,
    0
  );
}

export function isInEconomicPeriod(date, periodStart) {
  const t = date.getTime();
  return t >= periodStart.getTime() && t < getEconomicPeriodEnd(periodStart).getTime();
}

/** @deprecated alias — la app usa ciclos económicos, no meses civiles */
export function startOfMonth(date = new Date()) {
  return getEconomicPeriodStart(date);
}

export function shiftMonth(date, delta) {
  return shiftEconomicPeriod(getEconomicPeriodStart(date), delta);
}

export function isInMonth(date, ref = new Date()) {
  const period = getEconomicPeriodStart(ref);
  return isInEconomicPeriod(date, period);
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

/** Etiqueta del ciclo: "24 jul – 23 ago 2026" */
export function formatPeriod(periodStart = getEconomicPeriodStart()) {
  const start = getEconomicPeriodStart(periodStart);
  const lastDay = new Date(getEconomicPeriodEnd(start).getTime() - 1);
  const a = start.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  const b = lastDay.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${a} – ${b}`;
}

/** Etiqueta corta para la barra: "Ciclo 24 jul" */
export function formatPeriodNav(periodStart = getEconomicPeriodStart()) {
  const start = getEconomicPeriodStart(periodStart);
  const label = start.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
  return `Ciclo ${label}`;
}

export function formatShortDate(date) {
  if (!date) return "—";
  return date.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Clave de presupuesto / ciclo: yyyy-mm del 24 de inicio */
export function monthYearKey(date = new Date()) {
  const start = getEconomicPeriodStart(date);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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

/**
 * Proyecta el día de un fijo dentro del ciclo económico.
 * Día ≥ 24 → mes del inicio del ciclo; día < 24 → mes del cierre.
 */
export function projectFixedIntoPeriod(templateDate, periodStart) {
  const day = templateDate.getDate();
  const start = getEconomicPeriodStart(periodStart);
  const end = getEconomicPeriodEnd(start);

  let year;
  let month;
  if (day >= CYCLE_START_DAY) {
    year = start.getFullYear();
    month = start.getMonth();
  } else {
    const next = end; // day 24 next month — use that calendar month for days 1–23
    year = next.getFullYear();
    month = next.getMonth();
  }

  const lastDay = new Date(year, month + 1, 0).getDate();
  const occurrence = new Date(year, month, Math.min(day, lastDay), 12, 0, 0, 0);

  // Seguridad: si por rareza cae fuera, clamp al ciclo
  if (occurrence < start) return new Date(start.getTime() + 12 * 3600000);
  if (occurrence >= end) return new Date(end.getTime() - 12 * 3600000);
  return occurrence;
}

export function getActiveFixedTemplates(transactions, periodStart = getEconomicPeriodStart()) {
  const start = getEconomicPeriodStart(periodStart);
  const startTs = start.getTime();

  return transactions
    .filter((tx) => {
      if (!tx.isFixed) return false;
      const d = toDate(tx.date);
      if (!d) return false;
      return getEconomicPeriodStart(d).getTime() <= startTs;
    })
    .map((tx) => {
      const origin = toDate(tx.date);
      const occurrence = projectFixedIntoPeriod(origin, start);
      return {
        ...tx,
        _date: occurrence,
        _originDate: origin,
        _projected: !isInEconomicPeriod(origin, start),
      };
    })
    .sort((a, b) => a._date - b._date);
}

function findEarliestPeriod(transactions, fallbackStart) {
  let min = null;
  for (const tx of transactions) {
    const d = toDate(tx.date);
    if (!d) continue;
    const s = getEconomicPeriodStart(d);
    if (!min || s < min) min = s;
  }
  const fb = getEconomicPeriodStart(fallbackStart);
  if (!min) return fb;
  return min > fb ? fb : min;
}

export function computeSingleMonth(transactions, periodStart = getEconomicPeriodStart(), carryIn = 0) {
  const start = getEconomicPeriodStart(periodStart);
  const fixed = getActiveFixedTemplates(transactions, start);

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
    if (!d || !isInEconomicPeriod(d, start)) continue;
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
    periodStart: start,
    periodEnd: getEconomicPeriodEnd(start),
  };
}

export function computeMonthlyBalance(transactions, periodStart = getEconomicPeriodStart()) {
  const target = getEconomicPeriodStart(periodStart);
  let cursor = findEarliestPeriod(transactions, target);
  let result = computeSingleMonth(transactions, cursor, 0);

  while (cursor.getTime() < target.getTime()) {
    const carry = result.restante;
    cursor = shiftEconomicPeriod(cursor, 1);
    result = computeSingleMonth(transactions, cursor, carry);
  }

  return result;
}

export function getMonthlyFixed(transactions, periodStart = getEconomicPeriodStart(), limit = 12) {
  const start = getEconomicPeriodStart(periodStart);
  const today = startOfDay(new Date());
  const currentStart = getEconomicPeriodStart(today);
  const fixed = getActiveFixedTemplates(transactions, start);

  if (start.getTime() !== currentStart.getTime()) {
    return fixed.slice(0, limit);
  }

  const upcoming = fixed.filter((tx) => tx._date >= today);
  return (upcoming.length > 0 ? upcoming : fixed).slice(0, limit);
}

/**
 * Eventos de calendario: cuotas del ciclo actual (+ siguientes si se pide).
 * @returns {Array<{ date: Date, items: Array }>}
 */
export function getCalendarDays(periodStart = getEconomicPeriodStart()) {
  const start = getEconomicPeriodStart(periodStart);
  const end = getEconomicPeriodEnd(start);
  const days = [];
  for (let t = start.getTime(); t < end.getTime(); t += 24 * 3600 * 1000) {
    days.push(new Date(t));
  }
  return days;
}

/**
 * Próximos pagos/cobros fijos desde hoy (horizonte en días).
 */
export function getUpcomingFixedEvents(transactions, fromDate = new Date(), horizonDays = 60) {
  const from = startOfDay(fromDate);
  const until = new Date(from.getTime() + horizonDays * 24 * 3600 * 1000);
  const periods = [
    getEconomicPeriodStart(from),
    shiftEconomicPeriod(getEconomicPeriodStart(from), 1),
  ];

  const seen = new Set();
  const events = [];

  for (const period of periods) {
    for (const tx of getActiveFixedTemplates(transactions, period)) {
      if (tx._date < from || tx._date >= until) continue;
      const key = `${tx.id}-${dateKey(tx._date)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push(tx);
    }
  }

  return events.sort((a, b) => a._date - b._date);
}

/** Agrupa eventos fijos del ciclo por día (yyyy-mm-dd local) */
export function groupFixedByDay(transactions, periodStart = getEconomicPeriodStart()) {
  const map = {};
  for (const tx of getActiveFixedTemplates(transactions, periodStart)) {
    const key = dateKey(tx._date);
    if (!map[key]) map[key] = [];
    map[key].push(tx);
  }
  return map;
}

export function spendByCategory(transactions, periodStart = getEconomicPeriodStart()) {
  const start = getEconomicPeriodStart(periodStart);
  const map = {};
  for (const tx of transactions) {
    if (tx.type !== "gasto" || tx.isFixed) continue;
    const d = toDate(tx.date);
    if (!d || !isInEconomicPeriod(d, start)) continue;
    const cat = tx.category || "Otros";
    map[cat] = (map[cat] || 0) + toAmount(tx.amount);
  }
  return map;
}

export function expensesByCategory(transactions, periodStart = getEconomicPeriodStart()) {
  const start = getEconomicPeriodStart(periodStart);
  const map = { ...spendByCategory(transactions, start) };
  for (const tx of getActiveFixedTemplates(transactions, start)) {
    if (tx.type !== "gasto") continue;
    const cat = tx.category || "Otros";
    map[cat] = (map[cat] || 0) + toAmount(tx.amount);
  }
  return map;
}

export function getMonthTransactions(transactions, periodStart = getEconomicPeriodStart(), limit = 50) {
  const start = getEconomicPeriodStart(periodStart);
  return [...transactions]
    .map((tx) => ({ ...tx, _date: toDate(tx.date) }))
    .filter((tx) => tx._date && isInEconomicPeriod(tx._date, start))
    .sort((a, b) => b._date - a._date)
    .slice(0, limit);
}
