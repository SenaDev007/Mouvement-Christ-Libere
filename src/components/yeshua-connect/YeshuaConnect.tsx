"use client";

/**
 * ============================================================================
 * YESHUA CONNECT — Module de communication (Mouvement Christ Libère)
 * ============================================================================
 *
 * ⭐ V2: Plus de header dupliqué, plus de tab bar purple.
 *    La navbar principale (TubelightNav) du layout est la SEULE navigation.
 *    Cette page rend DIRECTEMENT le chat WhatsApp-style (MessagingView).
 *
 *    Les autres vues (annonces, appels, bible) sont accessibles via:
 *    - /communaute (page Communauté dédiée dans la navbar)
 *    - /bible (page Bible dédiée dans la navbar)
 *    - Des liens dans la sidebar du chat
 *
 *    Pas de footer (conditionnellement masqué dans le layout).
 * ============================================================================
 */

import { MessagingView } from "./MessagingView";

export function YeshuaConnect() {
  return <MessagingView />;
}
