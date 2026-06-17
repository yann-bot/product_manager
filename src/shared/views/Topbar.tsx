import { FiSearch, FiBell } from "react-icons/fi";

//
// Barre supérieure (SSR, sans JS client) : titre/sous-titre de la page +
// recherche décorative (pas de recherche globale) et cloche notifications.
//

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        {subtitle ? <div className="sub">{subtitle}</div> : null}
      </div>
      <div className="topbar-actions">
        <div className="searchbox" aria-hidden="true">
          <FiSearch />
          <input type="text" placeholder="Rechercher…" disabled />
        </div>
        <span className="icon-btn" title="Notifications">
          <FiBell />
        </span>
      </div>
    </div>
  );
}
