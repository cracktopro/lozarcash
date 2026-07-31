/** Categorías y usuarios compartidos */

export const CATEGORIES = [
  "Hogar",
  "Mascotas",
  "Huerto y Terraza",
  "Ocio y Cómics",
  "Formación",
  "Gasolina",
  "Supermercado",
  "Nómina",
  "Pensión",
  "Salario",
  "Otros",
];

/** Categorías sugeridas al marcar un ingreso */
export const INCOME_CATEGORIES = ["Nómina", "Pensión", "Salario", "Otros"];

/** Alias legacy → nombre actual */
export const CATEGORY_ALIASES = {
  Suministros: "Gasolina",
};

export function canonicalCategory(name) {
  const raw = name || "Otros";
  return CATEGORY_ALIASES[raw] || raw;
}

export const USERS = ["Usuario 1", "Usuario 2"];

export const USER_STORAGE_KEY = "lozarcash_user";
