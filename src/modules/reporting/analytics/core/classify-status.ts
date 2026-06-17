//
// ======================================================
// CONTEXTE : ANALYTICS — classification du statut
// ======================================================
// Le statut EasySell est du VARCHAR texte libre, souvent préfixé d'une
// lettre de workflow ("A - Livré", "B - Programmé"…), et parfois bruité
// par des noms de produits qui fuitent dans la colonne (décalage Sheet).
//
// Cette fonction PURE mappe ce texte vers un bucket canonique. C'est la
// pièce maîtresse du module : la justesse de TOUS les indicateurs en
// dépend, d'où sa couverture de tests (classify-status.test.ts).
// ======================================================
//

export type StatusBucket =
  | "DELIVERED" // A - Livré
  | "PENDING" // B - Programmé, C - Je vous rappelle (commande encore travaillable)
  | "UNREACHABLE" // D - Injoignable
  | "REJECTED" // E - Rejeté (commande annulée / refusée — vente échouée)
  | "NOISE" // texte hors-statut (nom de produit qui a fui dans la colonne)
  | "UNKNOWN"; // null / vide (commande pas encore traitée)

// Minuscule + accents retirés, pour matcher "Livré" comme "livre".
function normalize(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function classifyStatus(raw: string | null): StatusBucket {
  if (raw === null || raw.trim() === "") return "UNKNOWN";

  const norm = normalize(raw);

  // On retire le préfixe de workflow éventuel ("a - ", "b – "…) pour ne
  // garder que le libellé. Le préfixe seul n'est PAS un signal fiable :
  // le bruit aussi en porte un ("x - retrouvez votre puissance…").
  const prefixed = norm.match(/^[a-z]\s*[-–]\s*(.*)$/);
  const label = (prefixed?.[1] ?? norm).trim();

  if (label.includes("injoignable")) return "UNREACHABLE";
  if (label.includes("rejet")) return "REJECTED"; // "rejeté"
  if (label.includes("annul")) return "REJECTED"; // "annulé" (variante éventuelle)
  if (label.includes("rappel")) return "PENDING"; // "je vous rappelle"
  if (label.includes("programme")) return "PENDING";
  if (label.startsWith("livr")) return "DELIVERED"; // livré / livrée / livrés

  // Tout le reste (libellés produits, valeurs exotiques) n'est pas un
  // statut commercial exploitable.
  return "NOISE";
}
