import { STICKERS_V360 } from "../src/components/post-production/sticker-catalog";

const ids = ["merci-partager", "like-subscribe", "subscribe-rouge", "dis-moi", "regarde-fin", "like-blanc", "abonne-toi", "lien-bio"];
const items = ids.map((id) => STICKERS_V360.find((s) => s.id === id)).filter(Boolean);
let html = `<!DOCTYPE html><html><head><meta charset="utf8"><style>body{background:#1a1a24;padding:24px;font-family:sans-serif}
.grid{display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:center}
.cell{background:repeating-conic-gradient(#2a2a36 0 25%, #22222c 0 50%) 0 0/16px 16px;padding:10px;border-radius:10px}
.cell svg{display:block;max-width:460px;height:auto}</style></head><body>
<div class="grid">`;
for (const s of items) html += `<div class="cell">${s!.svg}</div>`;
html += `</div></body></html>`;
await Bun.write("/home/z/my-project/scripts/test-boutons.html", html);
console.log("✅ page générée :", items.length, "boutons");
