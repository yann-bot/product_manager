import { Router } from "express";
import type { Response } from "express";
import { z } from "zod";
import { ReconciliationService } from "../core/reconciliation.service";
import { ProductService } from "../../../catalog/product/core/product.service";
import { NotFoundError, ValidationError } from "../../../../shared/errors";
import { renderPage } from "../../../../shared/view";
import { ReconciliationPage, type ProductOption } from "./views/ReconciliationPage";

//
// Couche inbound de la réconciliation EasySell. Écrans HTML seulement :
//   - GET  /reconciliation/view      : la liste des noms en attente.
//   - POST /reconciliation/reconcile : relie un nom -> produit interne.
// Le formulaire poste en urlencoded (nom de produit en hidden + select).
//

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

const reconcileSchema = z.object({
  productName: z.preprocess(
    emptyToUndefined,
    z.string({ error: "Nom de produit manquant." }).min(1, "Nom de produit manquant."),
  ),
  productId: z.preprocess(emptyToUndefined, z.uuid({ error: "Produit invalide." })),
});

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

export default function ReconciliationController(
  service: ReconciliationService,
  productService: ProductService,
): Router {
  const router = Router();

  // Produits internes proposables au mapping : actifs uniquement.
  async function activeProducts(): Promise<ProductOption[]> {
    const all = await productService.findAll();
    return all
      .filter((p) => p.status === "active")
      .map((p) => ({ id: p.id, name: p.name }));
  }

  // Rend l'écran (état courant). Réutilisé pour le GET et le ré-affichage
  // après erreur de validation.
  async function renderScreen(
    res: Response,
    opts?: { error?: string; status?: number },
  ): Promise<void> {
    const [groups, counts, products] = await Promise.all([
      service.pendingGroups(),
      service.counts(),
      activeProducts(),
    ]);
    if (opts?.status) res.status(opts.status);
    renderPage(res, {
      title: "Réconciliation",
      subtitle: "Relier les ventes EasySell au catalogue interne",
      active: "reconciliation",
      body: (
        <ReconciliationPage
          groups={groups}
          counts={counts}
          products={products}
          error={opts?.error}
        />
      ),
    });
  }

  router.get("/reconciliation/view", async (_req, res) => {
    try {
      await renderScreen(res);
    } catch (err) {
      console.error(err);
      res.status(500).send("Échec du rendu de la réconciliation.");
    }
  });

  router.post("/reconciliation/reconcile", async (req, res) => {
    const parsed = reconcileSchema.safeParse(req.body);
    if (!parsed.success) {
      await renderScreen(res, { error: firstIssue(parsed.error), status: 400 });
      return;
    }
    try {
      // Le produit cible doit exister (sécurité : le select n'expose que des
      // produits actifs, mais on revalide côté serveur).
      await productService.findById(parsed.data.productId);
      await service.reconcile(parsed.data.productName, parsed.data.productId);
      res.redirect("/reconciliation/view");
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof ValidationError) {
        await renderScreen(res, { error: err.message, status: 400 });
        return;
      }
      console.error(err);
      res.status(500).send("Échec de la réconciliation.");
    }
  });

  return router;
}
