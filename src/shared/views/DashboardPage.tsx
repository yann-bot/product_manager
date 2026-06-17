//
// Page d'accueil ("/") — « Vue d'ensemble » restylée d'après la maquette
// Coinview (sidebar sombre + carte portfolio + cartes pastel + table marché
// + carte sombre). Seul le VISUEL est repris : les libellés et les chiffres
// restent ceux du domaine réel (CA en FCFA, KPIs produits/stock/commandes,
// top produits). Tout est rendu serveur en SVG, sans JS client.
//

import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { FiBox, FiInbox, FiLayers } from "react-icons/fi";
import type { DashboardData } from "../dashboard.read";
import { compact, compactMoney, money, percent } from "../format";
import { AreaTrend } from "./charts";

interface DashboardPageProps {
  data: DashboardData;
}

// Pastilles de plage temporelle (décoratives) : la série couvre 6 mois.
const RANGES = ["1M", "3M", "6M", "1A", "Max"];
const ACTIVE_RANGE = "6M";

export function DashboardPage({ data }: DashboardPageProps) {
  const { kpi, topProducts, monthlyRevenue } = data;

  const totalRevenue = monthlyRevenue.reduce((s, m) => s + m.revenue, 0);

  // « Change » du portfolio = variation du dernier mois vs le précédent.
  const last = monthlyRevenue.at(-1)?.revenue ?? 0;
  const prev = monthlyRevenue.at(-2)?.revenue ?? 0;
  const delta = prev > 0 ? (last - prev) / prev : null;

  // Part de chaque top produit dans le CA cumulé du top (colonne « change »).
  const topTotal = topProducts.reduce((s, p) => s + p.revenue, 0);

  return (
    <div className="dash">
      <h2 className="ov-title">Vue d'ensemble</h2>

      {/* ---- Portfolio (CA) + cartes KPI pastel ---- */}
      <div className="ov-top">
        <section className="portfolio">
          <div className="pf-h">Chiffre d'affaires</div>
          <div className="pf-bal">
            {money(totalRevenue)}
            {delta !== null && (
              <span
                className="pf-pill"
                style={delta < 0 ? { background: "#fdecec", color: "#c0504f" } : undefined}
              >
                {delta >= 0 ? "+" : ""}
                {percent(delta)}
              </span>
            )}
          </div>
          <div className="pf-sub">Commandes livrées · 6 derniers mois</div>
          <div className="pf-chart">
            <AreaTrend
              width={560}
              height={180}
              color="#5c7cfa"
              points={monthlyRevenue.map((m) => ({ label: m.label, value: m.revenue }))}
              format={compactMoney}
            />
          </div>
          <div className="pf-range">
            {RANGES.map((r) => (
              <span key={r} className={r === ACTIVE_RANGE ? "on" : ""}>
                {r}
              </span>
            ))}
          </div>
        </section>

        <div className="assets">
          <Asset
            tone="lav"
            value={compact(kpi.totalProducts)}
            label="Produits au catalogue"
            icon={FiBox}
            delta="actifs"
            deltaTone="muted"
          />
          <Asset
            tone="mint"
            value={compact(kpi.ordersCount)}
            label="Commandes EasySell"
            icon={FiInbox}
            delta="synchronisées"
            deltaTone="muted"
          />
          <Asset
            tone="cream"
            value={`${compact(kpi.totalStock)} u.`}
            label="Stock total"
            icon={FiLayers}
            delta={
              kpi.outOfStock > 0 ? `${compact(kpi.outOfStock)} en rupture` : "0 rupture"
            }
            deltaTone={kpi.outOfStock > 0 ? "amber" : "pos"}
          />
        </div>
      </div>

      {/* ---- Table « marché » (top produits), pleine largeur ---- */}
      <section className="market">
        <div className="mk-h">Top produits par chiffre d'affaires</div>
        {topProducts.length === 0 ? (
          <Empty>Aucune vente enregistrée pour l'instant.</Empty>
        ) : (
          <table className="mk-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th className="num">Chiffre d'affaires</th>
                <th className="num">Part</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p) => {
                const share = topTotal > 0 ? p.revenue / topTotal : 0;
                return (
                  <tr key={p.name}>
                    <td>
                      <div className="mk-name">
                        <span className="mk-badge">{initials(p.name)}</span>
                        <span>
                          <b>{p.name}</b>
                        </span>
                      </div>
                    </td>
                    <td className="num">{compactMoney(p.revenue)}</td>
                    <td className="num mk-pos">{percent(share)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Asset({
  tone,
  value,
  label,
  icon: Icon,
  delta,
  deltaTone,
}: {
  tone: "lav" | "mint" | "cream";
  value: string;
  label: string;
  icon: IconType;
  delta: string;
  deltaTone: "pos" | "amber" | "muted";
}) {
  return (
    <div className={`asset ${tone}`}>
      <div className="asset-v">{value}</div>
      <div className="asset-l">{label}</div>
      <div className="asset-foot">
        <span className="asset-ic">
          <Icon size={16} />
        </span>
        <span className={`asset-delta ${deltaTone}`}>{delta}</span>
      </div>
    </div>
  );
}

/** Monogramme (1-2 lettres) pour la pastille produit de la table marché. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="muted panel-empty">{children}</div>;
}
