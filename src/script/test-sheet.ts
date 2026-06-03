// scripts/test-sheet.ts

import "dotenv/config";
import { sheets } from "../lib/google-sheet";

async function main() {
  const result =
    await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID!,
      range: "A:Z",
    });

  console.log(result.data.values);
}

main();