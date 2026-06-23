import type { EasySellOrder } from "../../core/entities";
import { money, formatDateTime } from "../../../../../shared/format";
import { shortSheetId } from "../../../../../shared/settings";
import { dateScopeQuery, type DateScope } from "../../../../../shared/date-scope";
import { DateFilterBar } from "../../../../../shared/views/DateFilterBar";

/** Un onglet = une source Google Sheet. */
export interface SheetTab {
  id: string;
  label: string;
  /** Sheet activé (synchronisé) ou désactivé (lecture seule). */
  enabled: boolean;
  /** Nombre de commandes de ce Sheet dans la fenêtre temporelle. */
  count: number;
}

interface EasySellOrdersPageProps {
  orders: EasySellOrder[];
  /** sheetId -> titre lisible (Sheets déjà configurés). */
  sheetNames: Record<string, string>;
  /** Sheets actuellement synchronisés (activés) — mis en évidence. */
  enabledSheetIds: string[];
  /** Onglets : un par Sheet (configurés + orphelins présents dans les données). */
  tabs: SheetTab[];
  /** Onglet sélectionné, ou null pour « Toutes les sources ». */
  selectedSheetId: string | null;
  /** Total de commandes toutes sources confondues (onglet « Toutes les sources »). */
  totalCount: number;
  /** Fenêtre temporelle active (filtre par date_heure). */
  scope: DateScope;
}

const dash = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : v;

/** Commandes EasySell brutes, affichées telles qu'importées du Sheet. */
export function EasySellOrdersPage({
  orders,
  sheetNames,
  enabledSheetIds,
  tabs,
  selectedSheetId,
  totalCount,
  scope,
}: EasySellOrdersPageProps) {
  const totalQty = orders.reduce((s, o) => s + (o.quantite ?? 0), 0);
  const statuses = new Set(orders.map((o) => o.status ?? "—")).size;
  const sources = new Set(orders.map((o) => o.sheetId)).size;
  const enabled = new Set(enabledSheetIds);

  // Titre lisible d'un Sheet, sinon ID raccourci.
  const label = (sheetId: string) => sheetNames[sheetId] ?? shortSheetId(sheetId);

  // Liens d'onglets : conservent la fenêtre temporelle courante (orthogonale
  // au choix de la source).
  const q = dateScopeQuery(scope);
  const allHref = q ? `/easysell-orders/view?${q}` : "/easysell-orders/view";
  const tabHref = (id: string) =>
    `/easysell-orders/view?sheetId=${encodeURIComponent(id)}${q ? `&${q}` : ""}`;

  // Sheet sélectionné mais désactivé : données consultables en lecture seule.
  const selectedTab = tabs.find((t) => t.id === selectedSheetId) ?? null;
  const viewingDisabled = selectedTab !== null && !selectedTab.enabled;

  return (
    <>
      <div className="cards">
        <div className="card">
          <div className="k">Commandes</div>
          <div className="v">{orders.length}</div>
        </div>
        <div className="card">
          <div className="k">Quantité totale</div>
          <div className="v">{totalQty}</div>
        </div>
        <div className="card">
          <div className="k">Statuts distincts</div>
          <div className="v">{statuses}</div>
        </div>
        <div className="card">
          <div className="k">Sources (Sheets)</div>
          <div className="v">{sources}</div>
        </div>
      </div>

      <div className="wrap">
        {/* Onglets : un par Sheet (+ « Toutes les sources »). Les Sheets
            désactivés restent consultables (lecture seule). */}
        <div className="nav" role="tablist">
          <a href={allHref} className={selectedSheetId === null ? "active" : ""}>
            Toutes les sources <span className="muted">({totalCount})</span>
          </a>
          {tabs.map((t) => (
            <a
              key={t.id}
              href={tabHref(t.id)}
              className={t.id === selectedSheetId ? "active" : ""}
              title={t.enabled ? "Sheet synchronisé" : "Sheet désactivé (lecture seule)"}
            >
              {t.enabled ? null : <span className="muted">○ </span>}
              {t.label} <span className="muted">({t.count})</span>
            </a>
          ))}
        </div>

        {viewingDisabled && selectedTab && (
          <div className="alert alert-note">
            Le Sheet « {selectedTab.label} » est <strong>désactivé</strong> : ses
            commandes sont affichées en lecture seule et ne sont plus
            synchronisées. Réactivez-le depuis les{" "}
            <a href="/settings/view">Paramètres</a>.
          </div>
        )}

        <DateFilterBar
          scope={scope}
          action="/easysell-orders/view"
          hidden={selectedSheetId ? { sheetId: selectedSheetId } : {}}
        />

        <input
          className="filter"
          type="search"
          data-filter="#easysell-orders-table"
          placeholder="Filtrer (client, produit, statut, téléphone…)"
          autoComplete="off"
        />
        <table id="easysell-orders-table" data-page-size="5">
          <thead>
            <tr>
              <th>Source</th>
              <th>Réf.</th>
              <th>Date</th>
              <th>Client</th>
              <th>Téléphone</th>
              <th>Adresse</th>
              <th>Note client</th>
              <th>Produit</th>
              <th className="num">PU</th>
              <th className="num">Qté</th>
              <th className="num">Total</th>
              <th>Statut</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {orders.length > 0 ? (
              orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <span className="tag">{label(o.sheetId)}</span>
                    {enabled.has(o.sheetId) ? (
                      <span className="tag tag-active" title="Sheet synchronisé actuellement">
                        actif
                      </span>
                    ) : null}
                  </td>
                  <td className="ref">{dash(o.externalOrderId)}</td>
                  <td>{o.dateHeure ? formatDateTime(o.dateHeure) : "—"}</td>
                  <td>{dash(o.nomComplet)}</td>
                  <td className="muted">{dash(o.telephone)}</td>
                  <td className="muted">{dash(o.adresse)}</td>
                  <td className="muted">{dash(o.noteClient)}</td>
                  <td>{dash(o.nomProduit)}</td>
                  <td className="num">
                    {o.prixUnitaire !== null ? money(o.prixUnitaire) : "—"}
                  </td>
                  <td className="num">{dash(o.quantite)}</td>
                  <td className="num strong">
                    {o.prixTotal !== null ? money(o.prixTotal) : "—"}
                  </td>
                  <td>{dash(o.status)}</td>
                  <td className="muted">{dash(o.note)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={13} className="empty">
                  Aucune commande importée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
