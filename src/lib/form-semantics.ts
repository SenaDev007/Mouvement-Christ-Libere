/**
 * ⭐ V3.29 — Props sémantiques pour les inputs back-office.
 *
 * Objectif : claviers mobiles corrects (arobase pour les emails, pavé
 * numérique pour les téléphones, touches URL) + attributs autoComplete
 * standards (gestionnaires de mots de passe, remplissage auto).
 *
 * Usage : <input {...semanticInputProps(field.name)} type={...} />
 * (les props retournées écrasent le type par défaut si pertinent).
 */

export interface SemanticInputProps {
  type?: "email" | "tel" | "text";
  inputMode?: "email" | "tel" | "url" | "text";
  autoComplete?: string;
}

export function semanticInputProps(fieldName: string): SemanticInputProps {
  const n = (fieldName || "").toLowerCase();

  if (n.includes("email")) {
    return { type: "email", inputMode: "email", autoComplete: "email" };
  }
  if (n.includes("phone") || n.includes("tel") || n.includes("whatsapp")) {
    return { type: "tel", inputMode: "tel", autoComplete: "tel" };
  }
  // URL : inputMode uniquement (type="url" imposerait une URL absolue,
  // or les champs du back-office acceptent aussi des chemins relatifs
  // comme "/pam.jpeg")
  if (n.includes("url") || n.endsWith("link")) {
    return { inputMode: "url", autoComplete: "url" };
  }
  return { autoComplete: "off" };
}
