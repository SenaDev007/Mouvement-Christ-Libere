import ExcelJS from "exceljs";
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(await Bun.file("/home/z/my-project/download/journal-tresorerie-exemple-v381.xlsx").arrayBuffer());
const ws = wb.worksheets.find(w => w.name === "Synthèse")!;
let trouve = false;
ws.eachRow((row, num) => {
  const a = String(row.getCell(1).value || "");
  if (a.includes("TOTAL CONSOLIDÉ")) {
    trouve = true;
    // attendu : recettes XOF 212500 + 50€ (32797,85) + 120$ (73200) ≈ 318 497,85
    // dépenses XOF 104000,5 + 30€ (19678,71) ≈ 123 679,21
    console.log(`L${num} : ${a}`);
    console.log(`  Recettes: ${row.getCell(2).value} (fmt ${row.getCell(2).numFmt})`);
    console.log(`  Dépenses: ${row.getCell(3).value}`);
    console.log(`  Solde:    ${row.getCell(4).value}`);
  }
});
console.log(trouve ? "Ligne TOTAL CONSOLIDÉ présente ✓" : "ABSENT ✗");
process.exit(trouve ? 0 : 1);
