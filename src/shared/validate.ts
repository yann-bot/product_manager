import type { Request, Response } from "express";
import { z } from "zod";

/**
 * Valide `req.body` contre un schéma Zod.
 * En cas d'échec, répond 400 et renvoie `null` (le handler doit s'arrêter).
 * Sinon renvoie les données parsées et typées.
 */
export function validateBody<S extends z.ZodType>(
  schema: S,
  req: Request,
  res: Response,
): z.infer<S> | null {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: "Validation failed",
      issues: result.error.issues,
    });
    return null;
  }
  return result.data;
}
