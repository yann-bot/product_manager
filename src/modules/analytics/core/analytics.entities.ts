//
// ======================================================
// CONTEXTE : ANALYTICS (lecture seule sur easysell_orders)
// ======================================================
// Indicateurs commerciaux calculés À LA LECTURE par agrégation SQL,
// puis repliés par bucket de statut (voir classify-status.ts). Aucune
// table d'agrégat n'est persistée : RM-02 (recalculable) est garantie
// par construction, RM-03 (suppression sans impact) devient sans objet.
// ======================================================
//

import type { StatusBucket } from "./classify-status";

/** Filtre optionnel des indicateurs : par Sheet et/ou par période. */
export interface AnalyticsFilter {
  sheetId?: string;
  /** Borne basse incluse (sur date_heure). */
  from?: Date;
  /** Borne haute exclue (sur date_heure). */
  to?: Date;
}

/** Agrégat brut renvoyé par le repo, groupé par valeur de statut TEXTE. */
export interface StatusAggregate {
  status: string | null;
  count: number;
  /** Somme des prix_total non nuls (FCFA). */
  revenue: number;
  /** Lignes sans prix_total (donnée à corriger). */
  missingAmount: number;
}

/** Agrégat brut par jour ET par statut texte. */
export interface DayStatusAggregate {
  /** Jour au format YYYY-MM-DD (lignes sans date exclues en amont). */
  day: string;
  status: string | null;
  count: number;
  revenue: number;
}

/** Indicateurs consolidés pour le dashboard. */
export interface Indicators {
  /** CA = somme des prix_total des commandes livrées. */
  revenue: number;
  /** Toutes les commandes réelles synchronisées (tout sauf le bruit). */
  ordersCount: number;
  deliveredCount: number;
  pendingCount: number;
  unreachableCount: number;
  /** E - Rejeté : commandes annulées / refusées. */
  rejectedCount: number;
  /** Commandes sans statut (pas encore traitées). */
  unknownCount: number;
  /** livrées ÷ toutes les commandes (0..1). */
  deliveryRate: number;
  /** CA ÷ commandes livrées AVEC montant (panier moyen honnête). */
  avgBasket: number;
  /** Livrées sans prix_total : exclues du CA, à corriger dans le Sheet. */
  deliveredMissingAmount: number;
}

/** Un point de la série temporelle. */
export interface DailyPoint {
  day: string;
  revenue: number;
  ordersCount: number;
}

/** Répartition des commandes valides par bucket. */
export interface StatusBreakdownItem {
  bucket: StatusBucket;
  count: number;
}

/** Port : agrégation brute, sans aucune logique de classification. */
export interface AnalyticsRepository {
  aggregateByStatus(filter: AnalyticsFilter): Promise<StatusAggregate[]>;
  aggregateByDay(filter: AnalyticsFilter): Promise<DayStatusAggregate[]>;
}
