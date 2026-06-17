import type { IconType } from "react-icons";
import {
  FiGrid,
  FiPackage,
  FiBox,
  FiLayers,
  FiShoppingBag,
  FiShoppingCart,
  FiInbox,
  FiGitMerge,
  FiPieChart,
  FiBarChart2,
  FiDollarSign,
  FiSettings,
  FiChevronRight,
} from "react-icons/fi";
import type { NavKey } from "../view";

//
// Barre latérale (SSR React -> HTML statique, aucun JS client). Items ->
// modules réels ; sections proches regroupées sous un parent repliable
// (<details>) ouvert quand il contient la page active. Icônes react-icons
// (Feather) pour un rendu cohérent et net.
//

interface Leaf {
  key: NavKey;
  href: string;
  icon: IconType;
  label: string;
  /** Épinglé en bas de la nav (ex. Paramètres). */
  pin?: boolean;
}

type NavItem =
  | ({ type: "link" } & Leaf)
  | { type: "group"; icon: IconType; label: string; children: Leaf[] };

const NAV_ITEMS: NavItem[] = [
  { type: "link", key: "dashboard", href: "/", icon: FiGrid, label: "Tableau de bord" },
  {
    type: "group",
    icon: FiPackage,
    label: "Produits & Stock",
    children: [
      { key: "products", href: "/products/view", icon: FiBox, label: "Produits" },
      { key: "stock", href: "/stock/view", icon: FiLayers, label: "Stock" },
    ],
  },
  {
    type: "group",
    icon: FiShoppingBag,
    label: "Ventes",
    children: [
      { key: "sales", href: "/sales/view", icon: FiShoppingCart, label: "Ventes" },
      { key: "easysell-orders", href: "/easysell-orders/view", icon: FiInbox, label: "Commandes EasySell" },
      { key: "reconciliation", href: "/reconciliation/view", icon: FiGitMerge, label: "Réconciliation" },
    ],
  },
  {
    type: "group",
    icon: FiPieChart,
    label: "Reporting",
    children: [
      { key: "analytics", href: "/analytics/view", icon: FiBarChart2, label: "Analytics" },
      { key: "costing", href: "/costing/view", icon: FiDollarSign, label: "Audit COGS" },
    ],
  },
  { type: "link", key: "settings", href: "/settings/view", icon: FiSettings, label: "Paramètres", pin: true },
];

const ICON_SIZE = 17;

function NavLink({ leaf, active }: { leaf: Leaf; active?: NavKey }) {
  const Icon = leaf.icon;
  const cls = [active === leaf.key ? "active" : "", leaf.pin ? "nav-pin" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <a href={leaf.href} className={cls || undefined}>
      <span className="ic">
        <Icon size={ICON_SIZE} />
      </span>
      <span>{leaf.label}</span>
    </a>
  );
}

export function Sidebar({ active }: { active?: NavKey }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="logo">
          <FiBox size={20} />
        </span>
        <div>
          <div className="bt">OS Commerce</div>
          <div className="bs">Inventory Management</div>
        </div>
      </div>

      <nav className="side-nav">
        {NAV_ITEMS.map((it) => {
          if (it.type === "link") return <NavLink key={it.key} leaf={it} active={active} />;
          const GroupIcon = it.icon;
          const open = it.children.some((c) => c.key === active);
          return (
            <details key={it.label} className="group" open={open}>
              <summary>
                <span className="ic">
                  <GroupIcon size={ICON_SIZE} />
                </span>
                <span>{it.label}</span>
                <FiChevronRight className="chev" size={14} />
              </summary>
              <div className="sub">
                {it.children.map((c) => (
                  <NavLink key={c.key} leaf={c} active={active} />
                ))}
              </div>
            </details>
          );
        })}
      </nav>

      <div className="side-foot">v1 · ingestion + ventes + stock</div>
    </aside>
  );
}
