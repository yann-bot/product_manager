import type { DateScope, Period } from "../date-scope";

//
// Barre de filtre par dates partagée (SSR, sans JS client) :
//   - préréglages (Tout / Ce mois-ci / Cette semaine / Aujourd'hui) ;
//   - sélecteur de mois précis (?month=YYYY-MM) ;
//   - intervalle personnalisé (?from / ?to) ;
//   - libellé « Fenêtre affichée ».
// `action` = base de l'écran (ex. "/sales/view"). `hidden` = champs à
// reconduire (ex. { status } pour Ventes) afin que le filtre de dates
// ne réinitialise pas les autres sélections de la page.
//

const PERIODS: { key: Period; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "month", label: "Ce mois-ci" },
  { key: "week", label: "Cette semaine" },
  { key: "day", label: "Aujourd'hui" },
];

interface DateFilterBarProps {
  scope: DateScope;
  /** Base de l'écran cible des formulaires/liens (ex. "/analytics/view"). */
  action: string;
  /** Paramètres conservés sur les liens/formulaires (ex. { status: "all" }). */
  hidden?: Record<string, string>;
}

export function DateFilterBar({ scope, action, hidden = {} }: DateFilterBarProps) {
  const isPreset = scope.mode === "preset";
  const hiddenEntries = Object.entries(hidden);

  // Lien d'un préréglage : conserve les champs `hidden`, repasse en "preset".
  const presetHref = (per: Period) => {
    const p = new URLSearchParams(hidden);
    p.set("period", per);
    return `${action}?${p.toString()}`;
  };

  return (
    <>
      <div className="datebar">
        <div className="nav">
          {PERIODS.map((p) => (
            <a
              key={p.key}
              href={presetHref(p.key)}
              className={isPreset && scope.period === p.key ? "active" : ""}
            >
              {p.label}
            </a>
          ))}
        </div>

        {/* Mois précis : ?month=YYYY-MM. */}
        <form className="datefilter" method="get" action={action}>
          {hiddenEntries.map(([k, v]) => (
            <input key={k} type="hidden" name={k} defaultValue={v} />
          ))}
          <label>
            Mois
            <input type="month" name="month" defaultValue={scope.month} />
          </label>
          <button className="btn" type="submit">Voir</button>
        </form>

        {/* Intervalle personnalisé : ?from=YYYY-MM-DD&to=YYYY-MM-DD. */}
        <form className="datefilter" method="get" action={action}>
          {hiddenEntries.map(([k, v]) => (
            <input key={k} type="hidden" name={k} defaultValue={v} />
          ))}
          <label>
            Du
            <input type="date" name="from" defaultValue={scope.from} />
          </label>
          <label>
            au
            <input type="date" name="to" defaultValue={scope.to} />
          </label>
          <button className="btn" type="submit">Appliquer</button>
        </form>
      </div>

      <div className="datebar-label muted">
        Fenêtre affichée : <strong>{scope.label}</strong>
      </div>
    </>
  );
}
