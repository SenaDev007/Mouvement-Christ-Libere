/**
 * ⭐ V3.69 — Templates HTML des emails transactionnels (Resend).
 *
 * Palette V3.68 (logo) : noir #000000 / or #C9A227 / feu #FF7A1A / ivoire
 * #F0E9DE / gris chaud #8A857C. Mise en page « email-safe » : tableaux,
 * styles en ligne, polices système (Arial) — pas de CSS externe ni de
 * média queries, pour un rendu identique dans Gmail, Outlook, Yahoo…
 */

const OR = "#C9A227";
const OR_BOUTON = "#C9A227";
const FEU = "#FF7A1A";
const NOIR = "#000000";
const IVOIRE = "#F0E9DE";
const GRIS = "#8A857C";

/** Échappe les caractères HTML d'un texte utilisateur. */
export function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Convertit les retours à la ligne en <br> (textes saisis dans les formulaires). */
function nl2br(htmlEchappe: string): string {
  return htmlEchappe.replace(/\r?\n/g, "<br />");
}

/**
 * Enveloppe commune : bandeau noir « CHRIST LIBÈRE » (or), corps ivoire,
 * pied de page discret. `contenu` doit déjà être du HTML échappé.
 */
function enveloppe(titre: string, contenu: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${echapperHtml(titre)}</title>
</head>
<body style="margin:0; padding:0; background-color:${IVOIRE}; font-family:Arial, Helvetica, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${IVOIRE};">
<tr><td align="center" style="padding:24px 12px;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background-color:#ffffff; border-radius:12px; overflow:hidden; border:1px solid rgba(0,0,0,0.08);">

  <!-- Bandeau noir + or -->
  <tr>
    <td style="background-color:${NOIR}; padding:26px 32px; text-align:center;">
      <div style="font-size:22px; font-weight:bold; color:${OR}; letter-spacing:1px; font-family:Georgia, 'Times New Roman', serif;">CHRIST LIB&Egrave;RE</div>
      <div style="font-size:10px; color:${IVOIRE}; letter-spacing:3px; text-transform:uppercase; margin-top:6px;">Mouvement Christ Lib&eacute;r&eacute;</div>
    </td>
  </tr>

  <!-- Titre -->
  <tr>
    <td style="padding:28px 32px 0 32px;">
      <h1 style="margin:0; font-size:19px; color:${NOIR}; font-family:Georgia, 'Times New Roman', serif;">${echapperHtml(titre)}</h1>
    </td>
  </tr>

  <!-- Contenu -->
  <tr>
    <td style="padding:18px 32px 8px 32px; font-size:14px; line-height:22px; color:#2c2c2c;">
      ${contenu}
    </td>
  </tr>

  <!-- Pied de page -->
  <tr>
    <td style="padding:22px 32px 28px 32px;">
      <div style="height:2px; background:linear-gradient(90deg, ${OR}, ${FEU}); border-radius:2px; margin-bottom:16px; font-size:0; line-height:0;">&nbsp;</div>
      <p style="margin:0; font-size:11px; line-height:17px; color:${GRIS};">
        Mouvement Christ Lib&eacute;r&eacute; &mdash; <a href="https://mouvementchristlibere.com" style="color:${OR}; text-decoration:none;">mouvementchristlibere.com</a><br />
        Cet email automatique est envoy&eacute; depuis noreply@mouvementchristlibere.com &mdash; merci d&apos;utiliser les formulaires du site pour toute r&eacute;ponse.
      </p>
    </td>
  </tr>

</table>

</td></tr>
</table>
</body>
</html>`;
}

/** Bloc d'information clé/valeur (tableau email-safe). */
function blocInfo(lignes: Array<{ libelle: string; valeur: string }>): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0; border:1px solid rgba(0,0,0,0.10); border-radius:8px;">
    ${lignes
      .map(
        (l) => `
    <tr>
      <td style="padding:9px 14px; font-size:12px; color:${GRIS}; width:150px; border-bottom:1px solid rgba(0,0,0,0.06);">${echapperHtml(l.libelle)}</td>
      <td style="padding:9px 14px; font-size:13px; color:${NOIR}; font-weight:bold; border-bottom:1px solid rgba(0,0,0,0.06);">${echapperHtml(l.valeur)}</td>
    </tr>`
      )
      .join("")}
  </table>`;
}

// ═══════════════════════════════════════════════════════════════════════
// ① OTP — réinitialisation du mot de passe
// ═══════════════════════════════════════════════════════════════════════

export interface OptionsOtp {
  /** Prénom/nom du destinataire si connu (sinon salutation neutre). */
  nom?: string | null;
  /** Code à 6 chiffres. */
  code: string;
  /** Validité en minutes (10 par défaut). */
  minutesValidite?: number;
}

export function sujetEmailOtp(): string {
  return "Votre code de réinitialisation — Christ Libère";
}

export function templateOtp(options: OptionsOtp): { html: string; text: string } {
  const minutes = options.minutesValidite ?? 10;
  const salutation = options.nom
    ? `Shalom ${echapperHtml(options.nom)},`
    : "Shalom,";

  const html = enveloppe(
    "Réinitialisation de votre mot de passe",
    `
    <p style="margin:0 0 6px 0;">${salutation}</p>
    <p style="margin:0 0 18px 0;">Vous avez demand&eacute; la r&eacute;initialisation du mot de passe de votre compte sur la plateforme du Mouvement Christ Lib&egrave;re. Utilisez le code ci-dessous pour finaliser cette op&eacute;ration&nbsp;:</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;">
      <tr>
        <td align="center" style="background-color:${NOIR}; border:1px solid ${OR}; border-radius:10px; padding:22px 16px;">
          <div style="font-size:13px; color:${IVOIRE}; letter-spacing:2px; text-transform:uppercase; margin-bottom:10px;">Code de v&eacute;rification</div>
          <div style="font-size:34px; font-weight:bold; letter-spacing:10px; color:${OR}; font-family:'Courier New', Courier, monospace;">${echapperHtml(options.code)}</div>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px 0;">Ce code est valable <strong>${minutes} minutes</strong> et ne peut &ecirc;tre utilis&eacute; qu&apos;une seule fois. Si vous n&apos;&ecirc;tes pas &agrave; l&apos;origine de cette demande, ignorez simplement cet email&nbsp;: votre mot de passe actuel reste inchang&eacute;.</p>
    <p style="margin:0;">Pour votre s&eacute;curit&eacute;, ne partagez jamais ce code, m&ecirc;me avec une personne se pr&eacute;sentant comme responsable du site.</p>
    `
  );

  const text = `Shalom${options.nom ? " " + options.nom : ""},

Vous avez demandé la réinitialisation du mot de passe de votre compte sur la plateforme du Mouvement Christ Libéré.

Code de vérification : ${options.code}

Ce code est valable ${minutes} minutes et ne peut être utilisé qu'une seule fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.

— Mouvement Christ Libéré (mouvementchristlibere.com)`;

  return { html, text };
}

// ═══════════════════════════════════════════════════════════════════════
// ② Courrier du secrétariat au serviteur (Pasteur Kongo / Sœur Pam)
// ═══════════════════════════════════════════════════════════════════════

export interface OptionsCourrier {
  /** Nom du destinataire (ex. « Pasteur Kongo »). */
  destinataire: string;
  /** Nom de l'expéditrice (secrétaire) tel qu'affiché. */
  expeditrice: string;
  sujet: string;
  message: string;
}

export function sujetCourrier(sujet: string): string {
  return `[Secrétariat] ${sujet}`;
}

export function templateCourrier(options: OptionsCourrier): { html: string; text: string } {
  const html = enveloppe(
    `Courrier du secrétariat — ${options.sujet}`,
    `
    <p style="margin:0 0 6px 0;">Shalom ${echapperHtml(options.destinataire)},</p>
    <p style="margin:0 0 14px 0;">Un message vous a &eacute;t&eacute; adress&eacute; depuis l&apos;espace Secr&eacute;tariat du Mouvement Christ Lib&egrave;re par <strong>${echapperHtml(options.expeditrice)}</strong>&nbsp;:</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
      <tr>
        <td style="background-color:${IVOIRE}; border-left:4px solid ${OR}; border-radius:6px; padding:18px 20px; font-size:14px; line-height:23px; color:#2c2c2c;">
          ${nl2br(echapperHtml(options.message))}
        </td>
      </tr>
    </table>

    <p style="margin:0; font-size:13px; color:${GRIS};">Vous pouvez r&eacute;pondre directement par email&nbsp;: votre r&eacute;ponse ira &agrave; l&apos;exp&eacute;ditrice.</p>
    `
  );

  const text = `Shalom ${options.destinataire},

Un message vous a été adressé depuis l'espace Secrétariat par ${options.expeditrice} :

Sujet : ${options.sujet}

${options.message}

— Mouvement Christ Libéré (mouvementchristlibere.com)`;

  return { html, text };
}

// ═══════════════════════════════════════════════════════════════════════
// ③ Transmission automatique d'une demande de rencontre
// ═══════════════════════════════════════════════════════════════════════

export interface OptionsDemandeTransmise {
  destinataire: string;
  serviteurLibelle: string;
  secretaire: string;
  demande: {
    requesterName: string;
    contact: string;
    subject: string;
    message: string;
    urgency: string;
    country?: string | null;
    city?: string | null;
    trackingCode?: string | null;
  };
  noteTransmission?: string | null;
}

export function sujetDemandeTransmise(nomDemandeur: string): string {
  return `Nouvelle demande transmise — ${nomDemandeur}`;
}

export function templateDemandeTransmise(
  options: OptionsDemandeTransmise
): { html: string; text: string } {
  const urgence = options.demande.urgency;
  const urgenceStyle =
    urgence === "urgente"
      ? `background-color:${FEU}; color:${NOIR};`
      : urgence === "elevee"
        ? `background-color:${OR}; color:${NOIR};`
        : `background-color:${IVOIRE}; color:#2c2c2c;`;

  const html = enveloppe(
    `Demande transmise — ${options.demande.requesterName}`,
    `
    <p style="margin:0 0 6px 0;">Shalom ${echapperHtml(options.destinataire)},</p>
    <p style="margin:0 0 8px 0;">Une demande de rencontre qui vous est destin&eacute;e vous a &eacute;t&eacute; transmise par le secr&eacute;tariat (${echapperHtml(options.secretaire)}). Elle vous attend dans l&apos;espace Secr&eacute;tariat pour suivi.</p>

    <span style="display:inline-block; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:bold; text-transform:uppercase; letter-spacing:1px; ${urgenceStyle}">
      Urgence : ${echapperHtml(urgence)}
    </span>

    ${blocInfo([
      { libelle: "Demandeur", valeur: options.demande.requesterName },
      { libelle: "Contact", valeur: options.demande.contact },
      { libelle: "Objet", valeur: options.demande.subject },
      ...(options.demande.country || options.demande.city
        ? [
            {
              libelle: "Localisation",
              valeur: [options.demande.city, options.demande.country]
                .filter(Boolean)
                .join(", "),
            },
          ]
        : []),
      ...(options.demande.trackingCode
        ? [{ libelle: "Code de suivi", valeur: options.demande.trackingCode }]
        : []),
    ])}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
      <tr>
        <td style="background-color:${IVOIRE}; border-left:4px solid ${OR}; border-radius:6px; padding:16px 18px; font-size:13px; line-height:21px; color:#2c2c2c;">
          ${nl2br(echapperHtml(options.demande.message))}
        </td>
      </tr>
    </table>

    ${
      options.noteTransmission
        ? `<p style="margin:0 0 18px 0; font-size:13px;"><strong style="color:${OR};">Note de la secr&eacute;taire :</strong> ${nl2br(echapperHtml(options.noteTransmission))}</p>`
        : ""
    }

    <p style="margin:0; font-size:13px; color:${GRIS};">Connectez-vous &agrave; l&apos;espace Secr&eacute;tariat pour suivre et traiter cette demande.</p>
    `
  );

  const text = `Shalom ${options.destinataire},

Une demande de rencontre vous a été transmise par le secrétariat (${options.secretaire}).

Demandeur : ${options.demande.requesterName}
Contact : ${options.demande.contact}
Objet : ${options.demande.subject}
Urgence : ${urgence}
${options.demande.trackingCode ? "Code de suivi : " + options.demande.trackingCode + "\n" : ""}
Message :
${options.demande.message}

${options.noteTransmission ? "Note de la secrétaire : " + options.noteTransmission + "\n" : ""}
— Mouvement Christ Libéré (mouvementchristlibere.com)`;

  return { html, text };
}

// ═══════════════════════════════════════════════════════════════════════
// ④ Email de test (vérification de la configuration Resend)
// ═══════════════════════════════════════════════════════════════════════

export function templateTest(): { html: string; text: string } {
  const html = enveloppe(
    "Email de test — configuration validée",
    `
    <p style="margin:0 0 10px 0;">Cet email confirme que l&apos;envoi automatique des messages depuis <strong style="color:${OR};">noreply@mouvementchristlibere.com</strong> fonctionne correctement.</p>
    <p style="margin:0;">Les codes de r&eacute;initialisation de mot de passe et les courriers du secr&eacute;tariat arriveront d&eacute;sormais &agrave; cette adresse.</p>
    `
  );
  return {
    html,
    text: `Email de test — l'envoi depuis noreply@mouvementchristlibere.com fonctionne. — Mouvement Christ Libéré`,
  };
}
