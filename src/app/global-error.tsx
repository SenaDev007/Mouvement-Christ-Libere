"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ margin: 0, padding: 0, backgroundColor: "#000000", fontFamily: "sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ maxWidth: "400px", textAlign: "center" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              backgroundColor: "rgba(181, 80, 47, 0.2)",
              border: "2px solid rgba(181, 80, 47, 0.4)",
              marginBottom: "24px",
            }}>
              <AlertTriangle size={32} color="#B5502F" />
            </div>

            <h2 style={{ fontSize: "24px", fontWeight: 600, color: "#F0E9DE", marginBottom: "12px", fontFamily: "serif" }}>
              Une erreur est survenue
            </h2>

            <p style={{ fontSize: "14px", color: "rgba(240, 233, 222, 0.7)", lineHeight: 1.6, marginBottom: "24px" }}>
              Le site rencontre un problème technique. Vous pouvez réessayer
              ou retourner à l&apos;accueil.
            </p>

            {error.digest && (
              <p style={{ fontSize: "12px", color: "rgba(240, 233, 222, 0.4)", marginBottom: "24px", fontFamily: "monospace" }}>
                Référence : {error.digest}
              </p>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexDirection: "column" }}>
              <button
                onClick={reset}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  backgroundColor: "#C9A227",
                  color: "#000000",
                  fontWeight: 600,
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={16} />
                Réessayer
              </button>
              <a
                href="/"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "1px solid rgba(201, 162, 39, 0.4)",
                  color: "#C9A227",
                  fontWeight: 600,
                  fontSize: "14px",
                  textDecoration: "none",
                }}
              >
                <Home size={16} />
                Accueil
              </a>
            </div>

            <p style={{ marginTop: "32px", fontSize: "12px", color: "rgba(240, 233, 222, 0.4)", fontStyle: "italic", fontFamily: "serif" }}>
              « Soyez forts, ne perdez pas courage, car votre œuvre aura sa récompense. »
              <br />
              2 Chroniques 15:7
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
