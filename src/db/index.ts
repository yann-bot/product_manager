import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { easysellOrders } from "./schema";

const db = drizzle(process.env.DATABASE_URL!);

// Sheet de démo (spreadsheetId fictif) pour rattacher les lignes à une source.
const DEMO_SHEET_ID = "demo-sheet-0000";

async function main() {
  console.log("🌱 Seeding database...");

  // RESET : on ne gère plus qu'une table en V1. Ré-exécutable.
  await db.delete(easysellOrders);

  //
  // EASYSELL ORDERS (données brutes Google Sheet, affichées telles quelles).
  // On inclut volontairement une ligne incomplète pour valider l'affichage.
  //
  await db.insert(easysellOrders).values([
    {
      sheetId: DEMO_SHEET_ID,
      externalOrderId: "GS-1001",
      dateHeure: new Date("2026-03-24T18:07:23"),
      nomComplet: "Awa Diop",
      telephone: "+221770000000",
      adresse: "Dakar, Plateau",
      noteClient: "Livrer le matin",
      nomProduit: "Tome 1 - L'Aventure",
      prixUnitaire: "5500",
      quantite: 2,
      prixTotal: "11000",
      status: "A - Livré",
      syncedAt: new Date(),
    },
    {
      sheetId: DEMO_SHEET_ID,
      externalOrderId: "GS-1002",
      dateHeure: new Date("2026-03-25T09:12:00"),
      nomComplet: "Mamadou Sow",
      telephone: "+221770000001",
      adresse: "Thiès",
      noteClient: null,
      nomProduit: "Power max",
      prixUnitaire: "18000",
      quantite: 1,
      prixTotal: "18000",
      status: "B - En cours",
      syncedAt: new Date(),
    },
    {
      // Ligne volontairement incomplète (format non contrôlé) :
      // pas de téléphone, pas de prix unitaire, statut absent.
      sheetId: DEMO_SHEET_ID,
      externalOrderId: "GS-1003",
      dateHeure: null,
      nomComplet: "Fatou",
      telephone: null,
      adresse: null,
      noteClient: "à rappeler",
      nomProduit: "Thé au Ginseng",
      prixUnitaire: null,
      quantite: null,
      prixTotal: null,
      status: null,
      syncedAt: new Date(),
    },
  ]);

  console.log("✅ Seed completed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
