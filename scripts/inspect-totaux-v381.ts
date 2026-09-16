import ExcelJS from "exceljs";
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(await Bun.file("/home/z/my-project/download/journal-tresorerie-exemple-v381.xlsx").arrayBuffer());
const ws = wb.worksheets.find(w => w.name === "Recettes")!;
for (let l = 10; l <= 17; l++) {
  const r = ws.getRow(l);
  const vals = [1, 8, 9, 10].map(c => JSON.stringify(r.getCell(c).value)).join(" | ");
  console.log(`L${l}: ${vals}`);
}
