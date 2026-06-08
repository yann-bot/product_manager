import { Router } from "express";
import type { Response } from "express";
import { z } from "zod";
import { SalesService } from "../core/sales.service";
import { ProductService } from "../../product/core/product.service";
import type { CreateSaleDTO } from "../core/sales.entities";
import { NotFoundError, ValidationError } from "../../../shared/errors";
import { validateBody } from "../../../shared/validate";
import { renderPage } from "../../../shared/view";
import { SalesPage, type SaleStatusFilter } from "./views/SalesPage";
import { SalesFormPage, type SellableProduct } from "./views/SalesFormPage";
import { SaleDetailPage } from "./views/SaleDetailPage";

//
// Couche inbound du module Sales. Deux familles de routes sur le même
// service :
//   - API JSON    : /sales (REST, cf. canvas).
//   - Écrans HTML : /sales/view, /sales/new, /sales/:id/view…
// Les écrans HTML postent en `application/x-www-form-urlencoded` ; les
// nombres arrivent donc en chaînes -> z.coerce/preprocess les normalise.
// Le ProductService sert à : (a) peupler le <select> du formulaire avec
// les produits vendables, (b) afficher le nom du produit dans les vues.
//

// "" (champ vide d'un form) -> undefined, pour ne pas le confondre avec 0.
const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

const createSchema = z.object({
  productId: z.preprocess(
    emptyToUndefined,
    z.uuid({ error: "Le produit est obligatoire." }),
  ),
  quantity: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "La quantité est obligatoire." })
      .int("La quantité doit être un entier.")
      .positive("La quantité doit être supérieure à zéro."),
  ),
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

const asFilter = (v: unknown): SaleStatusFilter =>
  v === "completed" || v === "cancelled" ? v : "all";

/** Mappe une erreur de domaine vers un code HTTP pour les réponses JSON. */
function sendError(res: Response, err: unknown): void {
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Erreur interne." });
}

/** Message lisible (1re erreur) à afficher dans un écran HTML. */
function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

export default function SalesController(
  service: SalesService,
  productService: ProductService,
): Router {
  const router = Router();

  // Produits proposables à la vente : actifs ET avec un prix de vente > 0
  // (RM-03 : sans prix, la vente est impossible).
  async function sellableProducts(): Promise<SellableProduct[]> {
    const all = await productService.findAll();
    return all
      .filter((p) => p.status === "active" && p.sellingPrice !== null && p.sellingPrice > 0)
      .map((p) => ({ id: p.id, name: p.name, sellingPrice: p.sellingPrice as number }));
  }

  // Nom du produit vendu (la vente ne stocke que productId). "—" si le
  // produit est introuvable (ne devrait pas arriver : FK + jamais supprimé).
  async function productNameOf(id: string): Promise<string> {
    try {
      return (await productService.findById(id)).name;
    } catch {
      return "—";
    }
  }

  // ----------------------------------------------------------------
  // Écrans HTML (déclarés avant les routes JSON paramétrées pour que
  // /sales/view et /sales/new ne soient pas captés par /:id).
  // ----------------------------------------------------------------

  // UC-02 — Liste (CA + filtre statut + recherche + pagination).
  router.get("/sales/view", async (req, res) => {
    try {
      const filter = asFilter(req.query.status);
      const all = await service.findAll();
      const counts = {
        all: all.length,
        completed: all.filter((s) => s.status === "completed").length,
        cancelled: all.filter((s) => s.status === "cancelled").length,
      };
      // CA = somme des montants des ventes complétées (RM-06).
      const revenue = all
        .filter((s) => s.status === "completed")
        .reduce((sum, s) => sum + s.totalAmount, 0);
      const sales = filter === "all" ? all : all.filter((s) => s.status === filter);

      // Map productId -> nom (une seule requête catalogue).
      const products = await productService.findAll();
      const productNameById: Record<string, string> = {};
      for (const p of products) productNameById[p.id] = p.name;

      renderPage(res, {
        title: "Ventes",
        subtitle: "Ventes internes — source de vérité des revenus saisis",
        active: "sales",
        body: (
          <SalesPage
            sales={sales}
            filter={filter}
            counts={counts}
            revenue={revenue}
            productNameById={productNameById}
          />
        ),
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Échec du rendu des ventes.");
    }
  });

  // UC-01 — Formulaire de création.
  router.get("/sales/new", async (_req, res) => {
    try {
      const products = await sellableProducts();
      renderPage(res, {
        title: "Nouvelle vente",
        subtitle: "Enregistrer une vente",
        active: "sales",
        body: <SalesFormPage action="/sales/new" products={products} />,
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Échec du rendu du formulaire.");
    }
  });

  // UC-01 — Soumission du formulaire de création.
  router.post("/sales/new", async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400);
      const products = await sellableProducts();
      renderPage(res, {
        title: "Nouvelle vente",
        active: "sales",
        body: (
          <SalesFormPage
            action="/sales/new"
            products={products}
            values={req.body}
            error={firstIssue(parsed.error)}
          />
        ),
      });
      return;
    }
    try {
      const sale = await service.create(parsed.data as CreateSaleDTO);
      res.redirect(`/sales/${sale.id}/view`);
    } catch (err) {
      // Erreur métier (produit absent / sans prix) : on ré-affiche le form.
      if (err instanceof ValidationError || err instanceof NotFoundError) {
        res.status(err instanceof NotFoundError ? 404 : 400);
        const products = await sellableProducts();
        renderPage(res, {
          title: "Nouvelle vente",
          active: "sales",
          body: (
            <SalesFormPage
              action="/sales/new"
              products={products}
              values={req.body}
              error={err.message}
            />
          ),
        });
        return;
      }
      console.error(err);
      res.status(500).send("Erreur interne.");
    }
  });

  // UC-03 — Détail.
  router.get("/sales/:id/view", async (req, res) => {
    try {
      const sale = await service.findById(req.params.id);
      const productName = await productNameOf(sale.productId);
      renderPage(res, {
        title: "Détail de la vente",
        subtitle: "Vente enregistrée",
        active: "sales",
        body: <SaleDetailPage sale={sale} productName={productName} />,
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).send("Vente introuvable.");
        return;
      }
      console.error(err);
      res.status(500).send("Échec du rendu de la vente.");
    }
  });

  // UC-04 — Annulation (depuis le bouton de la page détail).
  router.post("/sales/:id/cancel", async (req, res) => {
    try {
      await service.cancel(req.params.id);
      res.redirect(`/sales/${req.params.id}/view`);
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).send("Vente introuvable.");
        return;
      }
      // Déjà annulée (ValidationError) : on renvoie simplement au détail.
      if (err instanceof ValidationError) {
        res.redirect(`/sales/${req.params.id}/view`);
        return;
      }
      console.error(err);
      res.status(500).send("Échec de l'annulation.");
    }
  });

  // ----------------------------------------------------------------
  // API JSON (REST).
  // ----------------------------------------------------------------

  router.get("/sales", async (_req, res) => {
    try {
      res.json(await service.findAll());
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post("/sales", async (req, res) => {
    const dto = validateBody(createSchema, req, res);
    if (!dto) return;
    try {
      res.status(201).json(await service.create(dto as CreateSaleDTO));
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get("/sales/:id", async (req, res) => {
    try {
      res.json(await service.findById(req.params.id));
    } catch (err) {
      sendError(res, err);
    }
  });

  // UC-04 — Annulation (REST). PATCH /sales/:id/cancel (cf. canvas).
  router.patch("/sales/:id/cancel", async (req, res) => {
    try {
      res.json(await service.cancel(req.params.id));
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}
