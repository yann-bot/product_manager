//
// Port vers le module SALES (défini côté consommateur). Une réconciliation
// EasySell réussie ne touche PAS le stock directement : elle matérialise une
// VENTE INTERNE, et c'est la vente qui génère la sortie de stock (via son
// propre port StockLedger). `SalesService` satisfait ce port structurellement.
//
export interface SalesWriter {
  createFromEasySell(input: {
    productId: string;
    quantity: number;
    easysellSaleId: string;
    /** Montants réels EasySell (numeric → number) ; null si source incomplète. */
    unitPrice: number | null;
    totalPrice: number | null;
    /** Date commerciale EasySell ; null si absente. */
    saleDate: Date | null;
  }): Promise<void>;
}
