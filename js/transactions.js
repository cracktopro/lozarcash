/**
 * Acceso a la colección `transactions` (CRUD + listener en tiempo real)
 */
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { normalizeTransaction } from "./calculations.js";

const COLLECTION = "transactions";

/**
 * @param {object} data
 * @param {string} data.type - "ingreso" | "gasto"
 * @param {number|string} data.amount
 * @param {string} data.concept
 * @param {string} data.category
 * @param {string} data.date - YYYY-MM-DD
 * @param {boolean} data.isFixed
 * @param {boolean} data.isBizum
 * @param {string} data.addedBy
 */
export async function addTransaction(data) {
  const type = data.type === "ingreso" ? "ingreso" : "gasto";
  const [y, m, d] = String(data.date).split("-").map(Number);
  const localDate = new Date(y, m - 1, d, 12, 0, 0, 0);

  const payload = {
    type,
    amount: Number(data.amount),
    concept: String(data.concept).trim(),
    category: data.category,
    date: Timestamp.fromDate(localDate),
    isFixed: Boolean(data.isFixed),
    isBizum: Boolean(data.isBizum),
    addedBy: data.addedBy,
  };

  const ref = await addDoc(collection(db, COLLECTION), payload);
  return ref.id;
}

export async function removeTransaction(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

/**
 * Listener en tiempo real. Normaliza cada documento al emitir.
 * @param {(items: Array<object>) => void} onData
 * @param {(err: Error) => void} [onError]
 */
export function subscribeTransactions(onData, onError) {
  return onSnapshot(
    collection(db, COLLECTION),
    (snapshot) => {
      const items = snapshot.docs.map((d) =>
        normalizeTransaction({ id: d.id, ...d.data() })
      );
      onData(items);
    },
    (err) => {
      console.error("[Lozarcash] onSnapshot error:", err);
      if (onError) onError(err);
    }
  );
}
