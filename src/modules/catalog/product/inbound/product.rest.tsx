import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { ProductService } from "../core/product.service";
import type { CreateProductDTO, UpdateProductDTO } from "../core/product.entities";
import { NotFoundError, ValidationError } from "../../../../shared/errors";
import { validateBody } from "../../../../shared/validate";
import { renderPage } from "../../../../shared/view";
import { ProductsPage } from "./views/ProductsPage";
import { ProductFormPage } from "./views/ProductFormPage";
import { ProductDetailPage } from "./views/ProductDetailPage";

//
// Couche inbound du module Produit. Deux familles de routes sur le
// même service :
//   - API JSON     : /products (REST, cf. canvas).
//   - Écrans HTML  : /products/view, /products/new, /products/:id/view…
// Les écrans HTML postent en `application/x-www-form-urlencoded` ; les
// nombres arrivent donc en chaînes -> z.coerce/preprocess les normalise.
//

// "" (champ vide d'un form) -> undefined, pour ne pas le confondre avec 0.
const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const statusEnum = z.enum(["active", "archived"]);

const createSchema = z.object({
  name: z.preprocess(
    emptyToUndefined,
    z.string({ error: "Le nom du produit est obligatoire." }).trim().min(1, "Le nom du produit est obligatoire."),
  ),
  description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  sellingPrice: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "Le prix de vente est obligatoire." })
      .positive("Le prix de vente doit être supérieur à zéro."),
  ),
  defaultCostPrice: z.preprocess(
    emptyToUndefined,
    z.coerce.number().nonnegative("Le prix de revient par défaut ne peut pas être négatif.").optional(),
  ),
  status: z.preprocess(emptyToUndefined, statusEnum.optional()),
});

const updateSchema = z.object({
  name: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  sellingPrice: z.preprocess(emptyToUndefined, z.coerce.number().positive().optional()),
  defaultCostPrice: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
  status: z.preprocess(emptyToUndefined, statusEnum.optional()),
});

type StatusFilter = "all" | "active" | "archived";
const asFilter = (v: unknown): StatusFilter =>
  v === "active" || v === "archived" ? v : "all";

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

export default function ProductController(service: ProductService): Router {
  const router = Router();

  // ----------------------------------------------------------------
  // Écrans HTML (déclarés avant les routes JSON paramétrées pour que
  // /products/view et /products/new ne soient pas captés par /:id).
  // ----------------------------------------------------------------

  // UC-02 — Liste (filtre statut + recherche + pagination).
  router.get("/products/view", async (req, res) => {
    try {
      const filter = asFilter(req.query.status);
      const all = await service.findAll();
      const counts = {
        all: all.length,
        active: all.filter((p) => p.status === "active").length,
        archived: all.filter((p) => p.status === "archived").length,
      };
      const products = filter === "all" ? all : all.filter((p) => p.status === filter);
      renderPage(res, {
        title: "Produits",
        subtitle: "Catalogue produit — source de vérité du système",
        active: "products",
        body: <ProductsPage products={products} filter={filter} counts={counts} />,
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Échec du rendu du catalogue produit.");
    }
  });

  // UC-01 — Formulaire de création.
  router.get("/products/new", (_req, res) => {
    renderPage(res, {
      title: "Nouveau produit",
      subtitle: "Ajouter un produit au catalogue",
      active: "products",
      body: <ProductFormPage mode="create" action="/products/new" />,
    });
  });

  // UC-01 — Soumission du formulaire de création.
  router.post("/products/new", async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400);
      renderPage(res, {
        title: "Nouveau produit",
        active: "products",
        body: (
          <ProductFormPage
            mode="create"
            action="/products/new"
            values={req.body}
            error={firstIssue(parsed.error)}
          />
        ),
      });
      return;
    }
    try {
      const product = await service.create(parsed.data as CreateProductDTO);
      res.redirect(`/products/${product.id}/view`);
    } catch (err) {
      renderFormError(res, "create", "/products/new", req, err, "Nouveau produit");
    }
  });

  // UC-03 — Détail.
  router.get("/products/:id/view", async (req, res) => {
    try {
      const product = await service.findById(req.params.id);
      renderPage(res, {
        title: product.name,
        subtitle: "Détail du produit",
        active: "products",
        body: <ProductDetailPage product={product} />,
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).send("Produit introuvable.");
        return;
      }
      console.error(err);
      res.status(500).send("Échec du rendu du produit.");
    }
  });

  // UC-04 — Formulaire d'édition.
  router.get("/products/:id/edit", async (req, res) => {
    try {
      const product = await service.findById(req.params.id);
      renderPage(res, {
        title: `Modifier — ${product.name}`,
        active: "products",
        body: (
          <ProductFormPage
            mode="edit"
            action={`/products/${product.id}/edit`}
            values={product}
          />
        ),
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).send("Produit introuvable.");
        return;
      }
      console.error(err);
      res.status(500).send("Échec du rendu du formulaire.");
    }
  });

  // UC-04 — Soumission de l'édition.
  router.post("/products/:id/edit", async (req, res) => {
    const id = req.params.id;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400);
      renderPage(res, {
        title: "Modifier le produit",
        active: "products",
        body: (
          <ProductFormPage
            mode="edit"
            action={`/products/${id}/edit`}
            values={{ ...req.body }}
            error={firstIssue(parsed.error)}
          />
        ),
      });
      return;
    }
    try {
      await service.update(id, parsed.data as UpdateProductDTO);
      res.redirect(`/products/${id}/view`);
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).send("Produit introuvable.");
        return;
      }
      renderFormError(res, "edit", `/products/${id}/edit`, req, err, "Modifier le produit");
    }
  });

  // UC-05 — Archivage (depuis le bouton de la page détail).
  router.post("/products/:id/archive", async (req, res) => {
    try {
      await service.archive(req.params.id);
      res.redirect(`/products/${req.params.id}/view`);
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).send("Produit introuvable.");
        return;
      }
      console.error(err);
      res.status(500).send("Échec de l'archivage.");
    }
  });

  // ----------------------------------------------------------------
  // API JSON (REST).
  // ----------------------------------------------------------------

  router.get("/products", async (_req, res) => {
    try {
      res.json(await service.findAll());
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post("/products", async (req, res) => {
    const dto = validateBody(createSchema, req, res);
    if (!dto) return;
    try {
      res.status(201).json(await service.create(dto as CreateProductDTO));
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get("/products/:id", async (req, res) => {
    try {
      res.json(await service.findById(req.params.id));
    } catch (err) {
      sendError(res, err);
    }
  });

  router.patch("/products/:id", async (req, res) => {
    const dto = validateBody(updateSchema, req, res);
    if (!dto) return;
    try {
      res.json(await service.update(req.params.id, dto as UpdateProductDTO));
    } catch (err) {
      sendError(res, err);
    }
  });

  // DELETE = archivage (jamais de suppression dure — RM-04).
  router.delete("/products/:id", async (req, res) => {
    try {
      res.json(await service.archive(req.params.id));
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

/** Ré-affiche un formulaire avec une erreur de domaine (ValidationError). */
function renderFormError(
  res: Response,
  mode: "create" | "edit",
  action: string,
  req: Request,
  err: unknown,
  title: string,
): void {
  if (err instanceof ValidationError) {
    res.status(400);
    renderPage(res, {
      title,
      active: "products",
      body: (
        <ProductFormPage mode={mode} action={action} values={{ ...req.body }} error={err.message} />
      ),
    });
    return;
  }
  console.error(err);
  res.status(500).send("Erreur interne.");
}
