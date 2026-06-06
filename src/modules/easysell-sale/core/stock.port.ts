//
// Port vers le stock, côté contexte EasySell-sale. Une réconciliation
// réussie (manuelle ou auto à l'import) sort le produit du stock. Défini
// ici pour garder le core easysell-sale indépendant du module Stock ;
// `StockService` le satisfait structurellement (recordEasySellOut).
//
export interface StockOut {
  recordEasySellOut(input: {
    productId: string;
    quantity: number;
    easysellSaleId: string;
  }): Promise<void>;
}
