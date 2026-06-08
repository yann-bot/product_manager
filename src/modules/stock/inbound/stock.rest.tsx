import { Router } from "express";
import type { Response } from "express";
import { z } from "zod";
import { StockService } from "../core/stock.service";
import { ProductService } from "../../product/core/product.service";
import {
  MOVEMENT_TYPES,
  type CreateMovementDTO,
  type StockMovementType,
} from "../core/stock.entities";
import { NotFoundError, ValidationError } from "../../../shared/errors";
import { validateBody } from "../../../shared/validate";
import { renderPage } from "../../../shared/view";
import { StockPage } from "./views/StockPage";
import { StockMovementFormPage, type StockProductOption } from "./views/StockMovementFormPage";
import { StockMovementsPage } from "./views/StockMovementsPage";
import { StockDetailPage } from "./views/StockDetailPage";

//
// Couche inbound du module Stock. HTML (écrans) + JSON (REST).
// Le stock est dérivé des mouvements (service), jamais stocké.
//

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

const movementSchema = z.object({
  productId: z.preprocess(emptyToUndefined, z.uuid({ error: "Produit invalide." })),
  type: z.preprocess(
    emptyToUndefined,
    z.enum(MOVEMENT_TYPES as [StockMovementType, ...StockMovementType[]], {
      error: "Type de mouvement invalide.",
    }),
  ),
  quantity: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "La quantité est obligatoire." })
      .int("La quantité doit être un entier."),
  ),
  note: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

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

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

export default function StockController(
  stock: StockService,
  productService: ProductService,
): Router {
  const router = Router();

  async function activeProducts(): Promise<StockProductOption[]> {
    const all = await productService.findAll();
    return all
      .filter((p) => p.status === "active")
      .map((p) => ({ id: p.id, name: p.name }));
  }

  async function productNameMap(): Promise<Record<string, string>> {
    const all = await productService.findAll();
    const map: Record<string, string> = {};
    for (const p of all) map[p.id] = p.name;
    return map;
  }

  // ------------------------- Écrans HTML -------------------------

  // Niveau de stock par produit (dérivé).
  router.get("/stock/view", async (_req, res) => {
    try {
      const stocks = await stock.stockByProduct();
      const summary = {
        trackedProducts: stocks.length,
        totalUnits: stocks.reduce((s, x) => s + x.quantity, 0),
        outOfStock: stocks.filter((x) => x.quantity <= 0).length,
      };
      renderPage(res, {
        title: "Stock",
        subtitle: "Niveau de stock par produit (dérivé des mouvements)",
        active: "stock",
        body: <StockPage stocks={stocks} summary={summary} />,
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Échec du rendu du stock.");
    }
  });

  // Formulaire de mouvement.
  router.get("/stock/movements/new", async (req, res) => {
    try {
      const products = await activeProducts();
      const defaultProductId =
        typeof req.query.productId === "string" ? req.query.productId : undefined;
      renderPage(res, {
        title: "Nouveau mouvement",
        subtitle: "Enregistrer un mouvement de stock",
        active: "stock",
        body: (
          <StockMovementFormPage
            action="/stock/movements/new"
            products={products}
            defaultProductId={defaultProductId}
          />
        ),
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Échec du rendu du formulaire.");
    }
  });

  // Soumission du formulaire.
  router.post("/stock/movements/new", async (req, res) => {
    const parsed = movementSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400);
      const products = await activeProducts();
      renderPage(res, {
        title: "Nouveau mouvement",
        active: "stock",
        body: (
          <StockMovementFormPage
            action="/stock/movements/new"
            products={products}
            values={req.body}
            error={firstIssue(parsed.error)}
          />
        ),
      });
      return;
    }
    try {
      await stock.record(parsed.data as CreateMovementDTO);
      res.redirect("/stock/view");
    } catch (err) {
      if (err instanceof ValidationError || err instanceof NotFoundError) {
        res.status(err instanceof NotFoundError ? 404 : 400);
        const products = await activeProducts();
        renderPage(res, {
          title: "Nouveau mouvement",
          active: "stock",
          body: (
            <StockMovementFormPage
              action="/stock/movements/new"
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

  // Historique global des mouvements.
  router.get("/stock/movements", async (_req, res) => {
    try {
      const [movements, productNameById] = await Promise.all([
        stock.movements(),
        productNameMap(),
      ]);
      renderPage(res, {
        title: "Mouvements de stock",
        subtitle: "Historique des mouvements",
        active: "stock",
        body: <StockMovementsPage movements={movements} productNameById={productNameById} />,
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Échec du rendu de l'historique.");
    }
  });

  // Détail du stock d'un produit + ses mouvements.
  router.get("/stock/:productId/view", async (req, res) => {
    try {
      const product = await productService.findById(req.params.productId);
      const [currentStock, movements] = await Promise.all([
        stock.currentStockOf(product.id),
        stock.movements(product.id),
      ]);
      renderPage(res, {
        title: `Stock — ${product.name}`,
        subtitle: "Détail du stock",
        active: "stock",
        body: (
          <StockDetailPage
            productId={product.id}
            productName={product.name}
            currentStock={currentStock}
            movements={movements}
          />
        ),
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).send("Produit introuvable.");
        return;
      }
      console.error(err);
      res.status(500).send("Échec du rendu du détail.");
    }
  });

  // ------------------------- API JSON -------------------------

  router.get("/stock", async (_req, res) => {
    try {
      res.json(await stock.stockByProduct());
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post("/stock/movements", async (req, res) => {
    const dto = validateBody(movementSchema, req, res);
    if (!dto) return;
    try {
      res.status(201).json(await stock.record(dto as CreateMovementDTO));
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}
