import { redirect } from "next/navigation";

/**
 * ⭐ V2.5 — Redirection : la modification de canal (y compris la photo)
 * se fait désormais en modal sur /admin/channels.
 */
export default function EditChannelPage() {
  redirect("/admin/channels");
}
