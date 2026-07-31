# Contexto del Proyecto: Lozarcash - Gestor Financiero Personal

## 1. Descripción General
"Lozarcash" es una aplicación web de control de finanzas personales diseñada para ser utilizada por dos personas que comparten gastos. El objetivo es registrar ingresos, gastos fijos y variables, establecer presupuestos mensuales y analizar el flujo de caja mediante gráficos. 

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

4. Estructura de Datos Propuesta (Firestore)
Para optimizar las lecturas y mantener el sistema ordenado, utilizaremos las siguientes colecciones:

Colección transactions (Todos los movimientos):

id (string, autogenerado)

type (string: "ingreso" | "gasto")

amount (number)

concept (string)

category (string, ej: "Hogar", "Mascotas", "Huerto y Terraza", "Ocio y Cómics", "Formación", "Suministros", "Supermercado")

date (timestamp)

isFixed (boolean: para identificar si es una cuota mensual)

isBizum (boolean: para identificar pagos o cobros rápidos)

addedBy (string: identificador del usuario que lo añade)

Colección budgets (Límites mensuales establecidos):

monthYear (string, ej: "2026-07")

categories (map/object con el límite asignado a cada categoría)

5. Funcionalidades Core (Checklist de Desarrollo para Cursor)
[x] UI/UX Base: Crear un index.html con un layout tipo Dashboard, usando CSS Grid/Flexbox. Paleta de colores limpia (modo claro/oscuro opcional).

[x] Dashboard Principal:

Calcular y mostrar el Balance Mensual (arrastre del mes anterior + ingresos − gastos fijos recurrentes = margen; margen − variables = restante que arrastra al mes siguiente).

"Termómetro" visual del margen disponible vs gastado.

Lista de próximos gastos/ingresos fijos del mes (cuotas recurrentes desde su fecha de alta).

[x] CRUD de Transacciones (El día a día):

Modal rápido para añadir nueva transacción (Fecha por defecto: hoy).

Checkbox/Toggle rápido para marcar si es "Bizum".

Listener en tiempo real (onSnapshot) de Firestore para actualizar la vista inmediatamente cuando el otro usuario añade un dato.

[x] Sistema de Estimador / Sobres:

Interfaz para asignar el "Margen disponible" a diferentes categorías.

Barras de progreso por categoría que cambien de color (verde -> naranja -> rojo) según se acerquen al límite.

[x] Analítica e Histórico:

Vista separada o sección inferior con Chart.js.

Gráfico de tarta de gastos del mes actual por categoría.

Selector de mes para consultar el histórico.

Cálculo de Tasa de Ahorro del mes visualizado.

6. Instrucciones Especiales para el LLM (Cursor)
Escribe código modular. Separa la lógica de Firebase, la lógica de la UI y los cálculos en distintos archivos JS si es necesario, pero asegúrate de que los imports funcionen correctamente en un entorno estático (usa <script type="module"> en el HTML).

Minimiza las lecturas a Firestore (usa listeners eficientes y evita recargar toda la base de datos para pequeños cambios).

Asegúrate de que las consultas de fechas manejen correctamente los objetos Timestamp de Firebase.

Genera el código paso a paso, priorizando primero tener la conexión a Firestore y el guardado de datos funcionando, y posteriormente la visualización y gráficos.