/**
 * Lozarcash — entry point
 * Fase 1: init Firebase + layout + prueba de escritura en Firestore
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCKfV-0s2mMTG4oJAsxyGD1toi1Hr3x-7w",
  authDomain: "lozarcash.firebaseapp.com",
  projectId: "lozarcash",
  storageBucket: "lozarcash.firebasestorage.app",
  messagingSenderId: "1061481336434",
  appId: "1:1061481336434:web:c9ca5bb07572192c2a7ceb",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

/**
 * Guarda un registro de prueba en la colección `transactions`.
 * Útil para verificar la conexión a Firestore desde el navegador.
 */
export async function saveTestTransaction() {
  const testRecord = {
    type: "gasto",
    amount: 1.0,
    concept: "Prueba de conexión Firestore",
    category: "Ocio y Cómics",
    date: serverTimestamp(),
    isFixed: false,
    isBizum: false,
    addedBy: "setup-test",
  };

  const docRef = await addDoc(collection(db, "transactions"), testRecord);
  console.log("[Lozarcash] Transacción de prueba guardada. ID:", docRef.id);
  return docRef.id;
}

function formatCurrentPeriod(date = new Date()) {
  return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function initUI() {
  const periodEl = document.getElementById("current-period");
  if (periodEl) {
    periodEl.textContent = formatCurrentPeriod();
  }

  const fab = document.getElementById("btn-add-transaction");
  if (fab) {
    fab.addEventListener("click", async () => {
      fab.disabled = true;
      try {
        const id = await saveTestTransaction();
        alert(`Conexión OK. Documento creado: ${id}`);
      } catch (err) {
        console.error("[Lozarcash] Error al guardar en Firestore:", err);
        alert(`Error al guardar: ${err.message}`);
      } finally {
        fab.disabled = false;
      }
    });
  }

  console.log("[Lozarcash] App inicializada. Firestore listo.");
}

initUI();
