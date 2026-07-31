/**
 * Firebase init — única fuente de la conexión a Firestore
 */
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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
