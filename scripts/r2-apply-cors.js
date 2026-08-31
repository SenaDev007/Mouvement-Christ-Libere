#!/usr/bin/env node
/**
 * scripts/r2-apply-cors.js
 * Configure CORS sur le bucket R2 pour autoriser les uploads presigned PUT.
 */
const { S3Client, PutBucketCorsCommand } = require("@aws-sdk/client-s3");

const cfg = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET_NAME,
};

if (!cfg.accountId || !cfg.accessKeyId || !cfg.secretAccessKey || !cfg.bucket) {
  console.error("❌ Variables R2 manquantes. Chargez .env d'abord:");
  console.error("   source .env && node scripts/r2-apply-cors.js");
  process.exit(1);
}

console.log("Bucket:", cfg.bucket);
console.log("Account:", cfg.accountId?.substring(0, 8) + "...");

const client = new S3Client({
  region: "auto",
  endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
  },
});

client
  .send(
    new PutBucketCorsCommand({
      Bucket: cfg.bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ["*"],
            AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag", "x-amz-request-id"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  )
  .then(() => {
    console.log("✅ CORS configuration applied to R2 bucket:", cfg.bucket);
  })
  .catch((e) => {
    console.error("❌ Error:", e.message);
    process.exit(1);
  });
