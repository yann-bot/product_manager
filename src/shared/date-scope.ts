import { formatDate, formatMonth } from "./format";

//
// Fenêtre temporelle partagée (filtre de dates des écrans liste).
//
// Résout, depuis la query string, une fenêtre [from, to) en heure locale
// serveur ET les chaînes de pré-remplissage des champs de la barre de
// filtre. Utilisé par plusieurs écrans (Ventes, Analytics…) : la logique
// est neutre, seul le libellé du préréglage « Tout » est paramétrable.
//

/** Préréglage calendaire : « Tout », mois en cours, semaine (lundi→), aujourd'hui. */
export type Period = "all" | "day" | "week" | "month";

/** Comment la fenêtre a été choisie : préréglage, mois précis, intervalle. */
export type DateMode = "preset" | "month" | "interval";

/**
 * Fenêtre temporelle active, déjà résolue côté controller. La vue n'en lit
 * que des chaînes (pré-remplissage + surlignage) ; le calcul des bornes Date
 * et le filtrage restent côté controller (via `range`).
 */
export interface DateScope {
  mode: DateMode;
  /** Préréglage actif quand mode === "preset". */
  period: Period;
  /** « YYYY-MM » pré-rempli du sélecteur de mois (mode "month"). */
  month: string;
  /** « YYYY-MM-DD » pré-remplis de l'intervalle (mode "interval"). */
  from: string;
  to: string;
  /** Libellé lisible de la fenêtre affichée (ex. « mars 2026 »). */
  label: string;
}

/** Bornes résolues [from, to) en heure locale. `null` = borne ouverte. */
export type DateRange = { from: Date | null; to: Date | null };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** « YYYY-MM-DD » -> Date locale à minuit ; null si invalide (ou rebouclée). */
function parseDay(s: string): Date | null {
  if (!DATE_RE.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

/** « YYYY-MM » -> 1er du mois à minuit (heure locale) ; null si invalide. */
function parseMonth(s: string): Date | null {
  if (!MONTH_RE.test(s)) return null;
  const [y, m] = s.split("-").map(Number) as [number, number];
  return m >= 1 && m <= 12 ? new Date(y, m - 1, 1) : null;
}

const asPeriod = (v: unknown): Period =>
  v === "day" || v === "week" || v === "month" ? v : "all";

/**
 * Borne basse INCLUSE d'un préréglage calendaire ; `null` pour « Tout ».
 * La semaine commence le lundi (fr-FR). Pas de borne haute : la date filtrée
 * vaut une date de création/commande, donc jamais dans le futur.
 */
function periodStart(period: Period, now: Date = new Date()): Date | null {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case "day":
      return startOfDay;
    case "week": {
      const monday = new Date(startOfDay);
      // getDay(): 0=dim..6=sam -> nombre de jours à reculer jusqu'au lundi.
      monday.setDate(monday.getDate() - ((startOfDay.getDay() + 6) % 7));
      return monday;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "all":
      return null;
  }
}

function presetLabel(period: Period, allLabel: string): string {
  switch (period) {
    case "all":
      return allLabel;
    case "day":
      return "Aujourd'hui";
    case "week":
      return "Cette semaine";
    case "month":
      return "Ce mois-ci";
  }
}

function intervalLabel(
  from: Date | null,
  to: Date | null,
  allLabel: string,
): string {
  if (from && to) return `du ${formatDate(from)} au ${formatDate(to)}`;
  if (from) return `depuis le ${formatDate(from)}`;
  if (to) return `jusqu'au ${formatDate(to)}`;
  return allLabel;
}

/**
 * Résout la fenêtre temporelle depuis la query, par précédence :
 *   1. intervalle personnalisé (?from / ?to) dès qu'une borne valide existe ;
 *   2. mois précis (?month=YYYY-MM) ;
 *   3. préréglage (?period=…), défaut « all ».
 * Retourne le `scope` (chaînes pour la vue) ET le `range` (Dates pour le filtre).
 * `allLabel` = libellé du préréglage « Tout » (ex. « Toutes les ventes »).
 */
export function resolveDateScope(
  query: unknown,
  allLabel = "Toute la période",
): { scope: DateScope; range: DateRange } {
  const q = query as Record<string, unknown>;

  const fromDay = parseDay(str(q.from));
  const toDay = parseDay(str(q.to));
  if (fromDay || toDay) {
    return {
      scope: {
        mode: "interval",
        period: "all",
        month: "",
        from: fromDay ? str(q.from) : "",
        to: toDay ? str(q.to) : "",
        label: intervalLabel(fromDay, toDay, allLabel),
      },
      // Journée `to` incluse -> borne haute exclue = son lendemain.
      range: { from: fromDay, to: toDay ? addDays(toDay, 1) : null },
    };
  }

  const monthDate = parseMonth(str(q.month));
  if (monthDate) {
    return {
      scope: {
        mode: "month",
        period: "all",
        month: str(q.month),
        from: "",
        to: "",
        label: formatMonth(monthDate),
      },
      range: {
        from: monthDate,
        to: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1),
      },
    };
  }

  const period = asPeriod(q.period);
  return {
    scope: {
      mode: "preset",
      period,
      month: "",
      from: "",
      to: "",
      label: presetLabel(period, allLabel),
    },
    range: { from: periodStart(period), to: null },
  };
}

/**
 * Query string de la fenêtre temporelle active (sans le « ? »), à reconduire
 * sur d'autres liens (onglets de statut…) pour ne pas perdre la sélection.
 * N'émet que les params du mode actif.
 */
export function dateScopeQuery(scope: DateScope): string {
  const p = new URLSearchParams();
  if (scope.mode === "month") p.set("month", scope.month);
  else if (scope.mode === "interval") {
    if (scope.from) p.set("from", scope.from);
    if (scope.to) p.set("to", scope.to);
  } else p.set("period", scope.period);
  return p.toString();
}
