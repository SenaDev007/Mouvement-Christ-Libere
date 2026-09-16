"use client";

/**
 * ⭐ V3.89 — MCL CREATIVE STUDIO (Secrétariat).
 *
 * Le MÊME générateur de miniatures et d'affiches que le back-office
 * (directive : « le back-office, le super admin ainsi que le secrétariat
 * vont partager ce même composant Studio Design ») — composant partagé
 * StudioShell, service et tables identiques, rôles de l'espace.
 */

import { StudioShell } from "@/components/studio/studio-shell";

export default function SecretariatStudioPage() {
  return <StudioShell apiBase="/secretariat/api/studio" espace="secretariat" />;
}
