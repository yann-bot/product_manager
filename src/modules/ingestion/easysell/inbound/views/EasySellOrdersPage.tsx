import type { EasySellOrder } from "../../core/entities";
import { money, formatDateTime } from "../../../../../shared/format";
import { shortSheetId } from "../../../../../shared/settings";
import type { DateScope } from "../../../../../shared/date-scope";
import { DateFilterBar } from "../../../../../shared/views/DateFilterBar";

interface EasySellOrdersPageProps {
  orders: EasySellOrder[];
  /** sheetId -> titre lisible (Sheets déjà configurés). */
  sheetNames: Record<string, string>;
  /** Sheet actuellement synchronisé (mis en évidence). */
  activeSheetId: string | null;
  /** Fenêtre temporelle active (filtre par date_heure). */
  scope: DateScope;
}

const dash = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : v;

/** Commandes EasySell brutes, affichées telles qu'importées du Sheet. */
export function EasySellOrdersPage({
  orders,
  sheetNames,
  activeSheetId,
  scope,
}: EasySellOrdersPageProps) {
  const totalQty = orders.reduce((s, o) => s + (o.quantite ?? 0), 0);
  const statuses = new Set(orders.map((o) => o.status ?? "—")).size;
  const sources = new Set(orders.map((o) => o.sheetId)).size;

  // Titre lisible d'un Sheet, sinon ID raccourci.
  const label = (sheetId: string) => sheetNames[sheetId] ?? shortSheetId(sheetId);

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
        <DateFilterBar scope={scope} action="/easysell-orders/view" />

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
                    {o.sheetId === activeSheetId ? (
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
