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

const percentFmt = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 1,
});

/** Ratio 0..1 formaté en pourcentage (ex. 0.8 -> « 80 % »). */
export const percent = (ratio: number): string => percentFmt.format(ratio);

const compactFmt = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Nombre compact pour les graphiques (ex. 874000 -> « 874 k »). */
export const compact = (n: number): string => compactFmt.format(n);

/** Montant compact en FCFA (ex. 874000 -> « 874 k FCFA »). */
export const compactMoney = (n: number): string => `${compactFmt.format(n)} FCFA`;
