import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync, writeFileSync } from "fs";

const doc = await PDFDocument.create();
doc.registerFontkit(fontkit);
const sans = await doc.embedFont(readFileSync("/tmp/fonts-sub/DejaVuSans-sub.ttf"));
const serif = await doc.embedFont(readFileSync("/tmp/fonts-sub/DejaVuSerif-Bold-sub.ttf"));
const page = doc.addPage([595, 842]);
page.drawRectangle({ x: 0, y: 742, width: 595, height: 100, color: rgb(0.165, 0.055, 0.239) });
page.drawText("Calendrier Biblique 2026-2027", { x: 40, y: 800, font: serif, size: 24, color: rgb(0.98, 0.965, 0.937) });
page.drawText("Mouvement Christ Libère · Aviv 1 · Yom Revi'i", { x: 40, y: 770, font: sans, size: 11, color: rgb(0.788, 0.635, 0.153) });
// Hébreu INVERSÉ (pas de bidi dans les PDF bruts)
const hebreu = "יום ראשון".split("").reverse().join("");
page.drawText(hebreu, { x: 40, y: 730, font: sans, size: 16, color: rgb(0.12, 0.12, 0.12) });
page.drawText("Pessah פסח — " + "פֶּסַח".replace(/[\u0591-\u05C7]/g, "").split("").reverse().join(""), { x: 40, y: 700, font: sans, size: 12 });
const bytes = await doc.save();
writeFileSync("/tmp/test.pdf", bytes);
console.log("PDF généré:", bytes.length, "octets");
