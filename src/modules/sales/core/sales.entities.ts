//
// ======================================================
// CONTEXTE : SALES (ventes saisies en interne)
// ======================================================
// Source de vérité des ventes enregistrées par le marchand, adossées
// au catalogue produit. Cohabite avec l'analytics EasySell (commandes
// externes) : les deux sources se complètent, Sales comble le vide des
// ventes internes.
//
// MVP mono-produit (choix assumé vs le multi-lignes du canvas) : une
// vente = un produit + une quantité, sans table SaleItem.
// ======================================================
//

export type SaleStatus = "completed" | "cancelled";

// Statut par défaut d'une vente à la création (UC-01 -> "completed").
// Source unique de vérité, réutilisée côté schéma (default colonne)
// et service.
export const DEFAULT_SALE_STATUS: SaleStatus = "completed";

export type Sale = {
  id: string;

  productId: string;
  quantity: number;
  // Prix de vente du produit figé AU MOMENT de la vente (RM-03) :
  // un snapshot, indépendant des évolutions ultérieures du catalogue.
  unitPrice: number;
  // quantity × unitPrice (RM-04/RM-05).
  totalAmount: number;

  status: SaleStatus;
  notes: string | null;

  saleDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

// Entrée inbound (UC-01) : le marchand ne saisit que le produit, la
// quantité et d'éventuelles notes. Prix et total sont calculés serveur
// (RM-03/RM-04/RM-05), jamais reçus du client.
export type CreateSaleDTO = {
  productId: string;
  quantity: number;
  notes?: string;
};

// Ce que le service remet au repo pour persistance : champs calculés
// inclus. Distinct de CreateSaleDTO (entrée) pour matérialiser que les
// totaux sont déjà résolus côté core.
export type NewSale = {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  status: SaleStatus;
  notes?: string;
  saleDate: Date;
};

export interface SalesRepository {
  findAll(): Promise<Sale[]>;
  findById(id: string): Promise<Sale | null>;
  create(sale: NewSale): Promise<Sale>;
  // UC-04 — passe la vente au statut "cancelled" sans suppression
  // (RM-06 : elle sort alors du chiffre d'affaires). Retourne la vente.
  cancel(id: string): Promise<Sale>;
}

// Port vers le stock (implémenté par le module Stock). Une vente génère
// une sortie de stock ; son annulation, une entrée compensatoire. Défini
// ici pour garder le core Sales indépendant du module Stock.
export interface StockLedger {
  recordSaleOut(input: {
    productId: string;
    quantity: number;
    saleId: string;
  }): Promise<void>;
  reverseSale(input: {
    productId: string;
    quantity: number;
    saleId: string;
  }): Promise<void>;
}
