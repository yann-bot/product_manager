//
// ======================================================
// CONTEXTE : EASYSELL ORDER (staging)
// ======================================================
// Données brutes importées du Google Sheet EasySell.
// Lecture seule côté application (l'écriture se fait via
// la synchronisation / les scripts). On expose tous les
// champs tels quels pour les afficher sans réinterprétation.
// ======================================================
//

export interface EasySellOrder {
  id: string;
  sheetId: string;
  externalOrderId: string;
  dateHeure: Date | null;
  nomComplet: string | null;
  telephone: string | null;
  adresse: string | null;
  noteClient: string | null;
  nomProduit: string | null;
  prixUnitaire: number | null;
  quantite: number | null;
  prixTotal: number | null;
  status: string | null;
  note: string | null;
  syncedAt: Date | null;
}

export interface EasySellOrderRepository {
  findAll: () => Promise<EasySellOrder[]>;
}
