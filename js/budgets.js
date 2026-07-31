/**
 * Colección `budgets` — sobres / límites por categoría del mes
 */
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  query,
  where,
  limit,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { monthYearKey } from "./calculations.js";
import { canonicalCategory } from "./constants.js";

const COLLECTION = "budgets";

function normalizeCategories(categories = {}) {
  const out = {};
  for (const [cat, val] of Object.entries(categories)) {
    const key = canonicalCategory(cat);
    const n = Number(val) || 0;
    if (n > 0) out[key] = (out[key] || 0) + n;
  }
  return out;
}

/**
 * Escucha el presupuesto del mes actual.
 * @param {(budget: { id?: string, monthYear: string, categories: Record<string, number> }) => void} onData
 * @param {(err: Error) => void} [onError]
 */
export function subscribeBudget(onData, onError, refDate = new Date()) {
  const key = monthYearKey(refDate);
  const q = query(
    collection(db, COLLECTION),
    where("monthYear", "==", key),
    limit(1)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onData({ monthYear: key, categories: {} });
        return;
      }
      const d = snapshot.docs[0];
      const data = d.data();
      onData({
        id: d.id,
        monthYear: data.monthYear || key,
        categories: normalizeCategories(data.categories || {}),
      });
    },
    (err) => {
      console.error("[Lozarcash] budget onSnapshot:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * Guarda/actualiza límites del mes. Usa monthYear como id de documento.
 * @param {string} monthYear
 * @param {Record<string, number>} categories
 */
export async function saveBudget(monthYear, categories) {
  const clean = normalizeCategories(categories);
  await setDoc(
    doc(db, COLLECTION, monthYear),
    { monthYear, categories: clean },
    { merge: false }
  );
}
