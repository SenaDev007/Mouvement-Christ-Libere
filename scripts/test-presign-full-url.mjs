/**
 * Test empirique V3.35 — inspection COMPLÈTE d'une URL pré-signée R2
 * générée par le MÊME code que la production (lib/r2.ts, SDK 3.1121.0).
 * Le pré-signage est un calcul local : des credentials fake suffisent.
 * Objectif : voir TOUS les paramètres de query (checksum ? sha256 ? algo ?)
 * que le test V3.34 n'a pas imprimés (il ne lisait que SignedHeaders).
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ACCOUNT = "f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6";
const BUCKET = "mcl-bucket";
const CREDS = {
  accessKeyId: "FAKEACCESSKEYID00000000",
  secretAccessKey: "fakesecretaccesskey0000000000000000000000000000",
};

async function presign(label, commandExtra, clientExtra, expiresIn = 7200) {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT}.r2.cloudflarestorage.com`,
    credentials: CREDS,
    ...clientExtra,
  });
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: `replays/live-123456-1700000000-abc123.webm`,
    ...commandExtra,
  });
  const url = await getSignedUrl(client, cmd, { expiresIn });
  const u = new URL(url);
  const params = Object.fromEntries(u.searchParams.entries());
  console.log(`\n=== ${label} ===`);
  console.log("HOST :", u.host);
  console.log("PATH :", u.pathname);
  for (const [k, v] of Object.entries(params)) {
    const isAmz = k.toLowerCase().startsWith("x-amz");
    console.log(`  ${k} = ${isAmz && k !== "X-Amz-Algorithm" ? v : v}`);
  }
  const suspicious = Object.keys(params).filter(
    (k) => k.toLowerCase().startsWith("x-amz-checksum") || k.toLowerCase().includes("checksum") || k.toLowerCase().includes("content-sha256") && k !== "X-Amz-Content-Sha256"
  );
  console.log("PARAMÈTRES SUSPECTS (checksum etc.) :", suspicious.length ? suspicious.join(", ") : "aucun");
  return { url, params };
}

// A) Config EXACTE de production V3.34 (lib/r2.ts actuel) — avec WHEN_REQUIRED
await presign(
  "A) PRODUCTION V3.34 (WHEN_REQUIRED, ContentType présent)",
  { ContentType: "video/webm" },
  { requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" },
);

// B) Config SANS les options checksum (simule le comportement antérieur)
await presign(
  "B) SANS OPTIONS CHECKSUM (défauts SDK = WHEN_SUPPORTED)",
  { ContentType: "video/webm" },
  {},
);

// C) Variante défensive : SANS ContentType dans la commande
await presign(
  "C) SANS ContentType dans la commande",
  {},
  { requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" },
);
console.log("\n✓ Inspection terminée — comparer les 3 URLs ci-dessus.");
