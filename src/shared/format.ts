//
// Helpers de formatage pour l'affichage (vues SSR).
// Le domaine manipule des `number` ; ici on les met en forme.
//

const moneyFmt = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

/** Montant en FCFA, sans décimales. */
export const money = (n: number): string => `${moneyFmt.format(n)} FCFA`;

const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Date + heure, ou « — » si absente. */
export const formatDateTime = (d: Date | null): string =>
  d ? dateTimeFmt.format(new Date(d)) : "—";
