import { redirect } from "next/navigation";

/**
 * ⭐ V2.5 — Redirection : la création de canal se fait désormais en modal
 * sur /admin/channels (plus de page plein écran, cohérent avec le module Lives).
 */
export default function NewChannelPage() {
  redirect("/admin/channels");
}
