/**
 * Erreurs de domaine, indépendantes de la couche de persistance.
 * Les adaptateurs outbound traduisent les erreurs techniques
 * (ex: violation de contrainte SQL) en ces erreurs, que la couche
 * inbound mappe ensuite vers des codes HTTP.
 */

/** Opération impossible car elle violerait une règle d'intégrité (-> HTTP 409). */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

/** Ressource demandée inexistante (-> HTTP 404). */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Donnée d'entrée invalide vis-à-vis d'une règle métier (-> HTTP 400). */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Code SQLSTATE Postgres d'une violation de clé étrangère. */
const FK_VIOLATION = "23503";

/** Détecte une violation de FK, qu'elle soit brute ou encapsulée par Drizzle. */
export function isForeignKeyViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === FK_VIOLATION || e?.cause?.code === FK_VIOLATION;
}
