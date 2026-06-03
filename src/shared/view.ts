import type { Response } from "express";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

//
// Pont React (SSR) <-> EJS.
//
// Le corps de chaque page est un composant React rendu en HTML statique
// côté serveur (pas de JS client, pas d'hydratation), puis injecté dans
// la coquille EJS partagée `shared/views/layout.ejs`.
//
// Chaque module embarque ses propres composants de vue dans
// `<module>/inbound/views/` et appelle simplement renderPage().
//

/** Clé de la section de navigation active (surligne l'onglet correspondant). */
export type NavKey = "easysell-orders";

export interface PageOptions {
  /** Titre de la page (<title> + <h1>). */
  title: string;
  /** Sous-titre optionnel affiché sous le titre. */
  subtitle?: string;
  /** Onglet de nav à surligner (aucun si omis). */
  active?: NavKey;
  /** Corps de la page (composant React). */
  body: ReactElement;
}

/** Rend une page complète : composant React -> HTML, inséré dans le layout EJS. */
export function renderPage(res: Response, opts: PageOptions): void {
  const body = renderToStaticMarkup(opts.body);
  res.render("layout", {
    title: opts.title,
    subtitle: opts.subtitle ?? "",
    active: opts.active ?? "",
    body,
  });
}
