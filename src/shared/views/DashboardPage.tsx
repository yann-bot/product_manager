//
// Page d'accueil ("/") — tableau de bord « Inventory Management ».
// KPIs + graphiques SVG (rendus serveur, sans JS) adossés à de vraies
// données ; suivis de la configuration de la source Google Sheet
// (fonctionnalité conservée, déplacée en bas de page).
//

import type { ReactNode } from "react";
import type { DashboardData } from "../dashboard.read";
import { compact, compactMoney, percent } from "../format";
import { Donut, HBars, AreaTrend } from "./charts";

interface DashboardPageProps {
  data: DashboardData;
  sheetId: string | null;
  sheetUrl: string | null;
  serviceAccount: string | null;
  status: { kind: "ok" | "err"; message: string } | null;
}

const SOLD_COLOR = "#5b8aa6";
const STOCK_COLOR = "#9fc1cf";

export function DashboardPage({
  data,
  sheetId,
  sheetUrl,
  serviceAccount,
  status,
}: DashboardPageProps) {
  const connected = Boolean(sheetId);
  const { kpi, inventory, topProducts, monthlyRevenue } = data;

  const invTotal = inventory.soldUnits + inventory.inStockUnits;
  const soldRatio = invTotal > 0 ? inventory.soldUnits / invTotal : 0;
  const stockRatio = invTotal > 0 ? inventory.inStockUnits / invTotal : 0;

  return (
    <div className="dash">
      {status && (
        <div className={status.kind === "ok" ? "alert alert-ok" : "alert"}>
          {status.message}
        </div>
      )}

      {/* ---- Vue d'ensemble : 4 KPI réels ---- */}
      <div className="section-h">Vue d'ensemble</div>
      <div className="kpis">
        <Kpi icon="📦" tone="blue" value={compact(kpi.totalProducts)} label="Produits actifs" />
        <Kpi icon="🛒" tone="green" value={compact(kpi.ordersCount)} label="Commandes EasySell" />
        <Kpi icon="🗃️" tone="violet" value={compact(kpi.totalStock)} label="Stock total (unités)" />
        <Kpi icon="⚠️" tone="amber" value={compact(kpi.outOfStock)} label="En rupture" />
      </div>

      {/* ---- Graphiques ---- */}
      <div className="panels">
        <div className="panel">
          <div className="panel-h">Valeurs d'inventaire</div>
          {invTotal === 0 ? (
            <Empty>Aucun mouvement de stock.</Empty>
          ) : (
            <div className="donut-row">
              <Donut
                segments={[
                  { label: "Vendues", value: inventory.soldUnits, color: SOLD_COLOR },
                  { label: "En stock", value: inventory.inStockUnits, color: STOCK_COLOR },
                ]}
                centerLabel={compact(invTotal)}
                centerSub="unités"
              />
              <ul className="legend">
                <li>
                  <span className="dot" style={{ background: SOLD_COLOR }} />
                  Unités vendues
                  <b>{percent(soldRatio)}</b>
                  <span className="muted">{compact(inventory.soldUnits)}</span>
                </li>
                <li>
                  <span className="dot" style={{ background: STOCK_COLOR }} />
                  Unités en stock
                  <b>{percent(stockRatio)}</b>
                  <span className="muted">{compact(inventory.inStockUnits)}</span>
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-h">
            Top produits par CA
            <span className="panel-tag">ventes + réconciliations</span>
          </div>
          {topProducts.length === 0 ? (
            <Empty>Aucune vente enregistrée pour l'instant.</Empty>
          ) : (
            <HBars
              items={topProducts.map((p) => ({ label: p.name, value: p.revenue }))}
              format={compactMoney}
            />
          )}
        </div>

        <div className="panel panel-wide">
          <div className="panel-h">
            Chiffre d'affaires
            <span className="panel-tag">commandes livrées · 6 mois</span>
          </div>
          <AreaTrend
            width={620}
            points={monthlyRevenue.map((m) => ({ label: m.label, value: m.revenue }))}
            format={compactMoney}
          />
        </div>
      </div>

      {/* ---- Source de données (config Google Sheet, conservée) ---- */}
      <div className="section-h">Source de données</div>
      <div className="panel source-panel">
        <div className="cards" style={{ padding: 0, marginBottom: 14 }}>
          <div className="card">
            <div className="k">Source Google Sheet</div>
            <div className={connected ? "v accent" : "v"}>
              {connected ? "Connectée" : "Non configurée"}
            </div>
          </div>
          {connected && (
            <div className="card">
              <div className="k">Sheet ID</div>
              <div className="v" style={{ fontSize: 13 }}>
                <span className="ref">{sheetId}</span>
              </div>
            </div>
          )}
        </div>

        <form method="post" action="/settings/google-sheet" style={{ maxWidth: 560 }}>
          <label htmlFor="url" className="muted">
            Lien du Google Sheet EasySell
          </label>
          <input
            id="url"
            name="url"
            className="filter"
            type="url"
            defaultValue={sheetUrl ?? ""}
            placeholder="https://docs.google.com/spreadsheets/d/…/edit"
            style={{ maxWidth: "100%", marginTop: 6 }}
            required
          />
          <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>
            {connected ? "Mettre à jour la source" : "Connecter le Sheet"}
          </button>
        </form>

        {serviceAccount && (
          <p className="muted" style={{ marginTop: 14, maxWidth: 560 }}>
            Pensez à partager le Sheet (lecture) avec le compte de service{" "}
            <span className="ref">{serviceAccount}</span> avant de le connecter.
          </p>
        )}
      </div>
    </div>
  );
}

function Kpi({
  icon,
  tone,
  value,
  label,
}: {
  icon: string;
  tone: string;
  value: string;
  label: string;
}) {
  return (
    <div className="kpi">
      <span className={`kpi-ic kpi-${tone}`}>{icon}</span>
      <div>
        <div className="kpi-v">{value}</div>
        <div className="kpi-l">{label}</div>
      </div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="muted panel-empty">{children}</div>;
}
