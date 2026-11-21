import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const v = await p.video.findFirst({ where: { title: { contains: "SANS miniature (test" } } });
console.log("URL      :", v.videoUrl);
console.log("Miniature:", v.thumbnailUrl);
console.log("Durée    :", v.duration);
const autres = await p.video.findMany({ select: { title: true, videoUrl: true, thumbnailUrl: true } });
for (const a of autres) console.log(`- ${a.title.slice(0,40)} | ${(a.thumbnailUrl || "AUCUNE").slice(0,55)}`);
await p.$disconnect();
