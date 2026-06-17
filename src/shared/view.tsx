import type { Response } from "express";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Sidebar } from "./views/Sidebar";
import { Topbar } from "./views/Topbar";

//
// Pont React (SSR) <-> EJS.
//
// Le corps de chaque page est un composant React rendu en HTML statique
// côté serveur (pas de JS client, pas d'hydratation), puis injecté dans
// la coquille EJS partagée `shared/views/layout.ejs`. La chrome (sidebar +
// topbar) est elle aussi rendue en React ici et injectée dans le layout.
//
// Chaque module embarque ses propres composants de vue dans
// `<module>/inbound/views/` et appelle simplement renderPage().
//

/** Clé de la section de navigation active (surligne l'onglet correspondant). */
export type NavKey =
  | "dashboard"
  | "easysell-orders"
  | "products"
  | "sales"
  | "stock"
  | "reconciliation"
  | "analytics"
  | "costing"
  | "settings";

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

/** Rend une page complète : composants React -> HTML, insérés dans le layout EJS. */
export function renderPage(res: Response, opts: PageOptions): void {
  const body = renderToStaticMarkup(opts.body);
  const sidebar = renderToStaticMarkup(<Sidebar active={opts.active} />);
  const topbar = renderToStaticMarkup(
    <Topbar title={opts.title} subtitle={opts.subtitle} />,
  );
  res.render("layout", {
    title: opts.title,
    sidebar,
    topbar,
    body,
  });
}
