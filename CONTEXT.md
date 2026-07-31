# Contexto del Proyecto: Lozarcash - Gestor Financiero Personal

## 1. Descripción General
"Lozarcash" es una aplicación web de control de finanzas personales diseñada para ser utilizada por dos personas que comparten gastos. El objetivo es registrar ingresos, gastos fijos y variables, establecer presupuestos por ciclo, consultar un calendario de pagos fijos y analizar el flujo de caja mediante gráficos.

La aplicación debe ser rápida, responsiva (adaptada a móviles) y funcionar en tiempo real para que ambos usuarios vean los datos actualizados al instante.

## 2. Stack Tecnológico y Entorno
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+).
- **Backend/Base de Datos:** Firebase Firestore (Web SDK v10+).
- **Gráficos:** Chart.js (importado vía CDN).
- **Hosting:** GitHub Pages.
- **Arquitectura:** Al estar alojado en GitHub Pages (hosting estático), no hay servidor backend (Node.js/PHP). Toda la lógica reside en el cliente (JS) y las llamadas a la base de datos se hacen directamente a Firestore usando ES Modules.

## 3. Configuración de Firebase (Ya inicializada)
El proyecto utiliza la siguiente configuración de Firebase. Los scripts de la aplicación deben utilizar esta inicialización para conectar con Firestore:

```javascript
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCKfV-0s2mMTG4oJAsxyGD1toi1Hr3x-7w",
  authDomain: "lozarcash.firebaseapp.com",
  projectId: "lozarcash",
  storageBucket: "lozarcash.firebasestorage.app",
  messagingSenderId: "1061481336434",
  appId: "1:1061481336434:web:c9ca5bb07572192c2a7ceb"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

## 4. Estructura de Datos Propuesta (Firestore)
Para optimizar las lecturas y mantener el sistema ordenado, utilizaremos las siguientes colecciones:

**Colección `transactions` (Todos los movimientos):**

- id (string, autogenerado)
- type (string: "ingreso" | "gasto")
- amount (number)
- concept (string)
- category (string, ej: "Hogar", "Mascotas", "Huerto y Terraza", "Ocio y Cómics", "Formación", "Gasolina", "Supermercado")
- date (timestamp)
- isFixed (boolean: cuota/ingreso recurrente mensual)
- isBizum (boolean)
- addedBy (string)

**Colección `budgets` (Límites por ciclo económico):**

- monthYear (string, ej: "2026-07" = ciclo que empieza el 24/07)
- categories (map/object con el límite asignado a cada categoría)

## 4.1 Mes económico (regla de negocio)
El ciclo no es el mes civil (1–30/31), sino:

- **Inicio:** día **24** de un mes
- **Fin:** día **23** del mes siguiente (el siguiente ciclo empieza el 24)

Así se alinean los cobros fijos (p. ej. días 24 y 26) con el periodo de gasto. Navegación ‹ › cambia de ciclo; los fijos se proyectan dentro del ciclo según su día del mes.

## 5. Funcionalidades Core (Checklist)
[x] UI/UX Base: layout tipo dashboard, paleta limpia, móvil primero.

[x] Dashboard Principal:
- Balance del ciclo (arrastre + ingresos − fijos recurrentes = margen; margen − variables = restante).
- Termómetro del presupuesto variable.
- Lista de cuotas fijas del ciclo.

[x] CRUD de Transacciones:
- Modal rápido (fecha por defecto hoy / día del ciclo).
- Toggle Bizum y «se repite cada mes».
- Listener en tiempo real (`onSnapshot`).
- Eliminar movimientos y cuotas (la edición in-place queda como mejora opcional).

[x] Sistema de Sobres:
- Asignar el **disponible en caja** (restante real) a categorías.
- Barras verde → naranja → rojo solo si hay límite.

[x] Calendario de pagos:
- Vista del ciclo con días marcados (ingresos/pagos fijos).
- Lista de próximos pagos fijos con importe.

[x] Analítica e Histórico:
- Chart.js (tarta de gastos del ciclo).
- Selector de ciclo económico.
- Tasa de ahorro del ciclo visualizado.

## 6. Instrucciones Especiales para el LLM (Cursor)
Escribe código modular. Separa Firebase, UI y cálculos en distintos archivos JS; imports con `<script type="module">`.

Minimiza lecturas a Firestore (listeners eficientes).

Maneja correctamente Timestamp de Firebase y fechas en zona local (evitar claves UTC).

Prioriza conexión y guardado, luego visualización, ciclos económicos y gráficos.
