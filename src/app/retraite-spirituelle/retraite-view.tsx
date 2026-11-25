"use client";

/**
 * ⭐ V4.43 — Formulaire public de demande de retraite spirituelle.
 *
 * Design public du site (crème #FAF6EF, or, serif — même style que
 * /rendez-vous). Le demandeur renseigne :
 *   · ses informations identitaires (prénom, nom, genre, contact, pays,
 *     ville, adresse, profession, situation matrimoniale, contact d'urgence) ;
 *   · son séjour (date d'arrivée facultative, nombre de jours, attentes,
 *     déjà venu) ;
 *   · DEUX pièces jointes obligatoires : photo lisible de sa pièce
 *     d'identité + capture de la preuve du paiement des frais de dossier
 *     (15 000 FCFA) — envoyées DIRECTEMENT à R2 via /api/retreat/presign
 *     (PUT pré-signé, aucune limite Vercel), puis POST /api/retreat.
 *
 * À la validation : code de suivi « RET-XXXXXX » remis au demandeur, la
 * demande atterrit dans l'espace Secrétariat (cloche + email best-effort).
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mountain,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  Search,
  ChevronDown,
  Upload,
  CalendarDays,
  Coins,
  BedDouble,
  User,
  X,
} from "lucide-react";
import { COUNTRIES } from "@/lib/data/countries";
import { flagFromCountryCode } from "@/lib/data/flags";

/** Frais de dossier — un seul montant, affiché clairement. */
const FRAIS_DOSSIER = "15 000 FCFA";

const TAILLE_MAX_IMAGE = 8 * 1024 * 1024; // 8 Mo — garde client

const SITUATIONS_MATRIMONIALES = [
  "Non précisé",
  "Célibataire",
  "Marié(e)",
  "Veuf/Veuve",
  "Divorcé(e)",
];

const MOYENS_PAIEMENT = [
  "Orange Money",
  "Wave",
  "MTN MoMo",
  "Moov Money",
  "Autre",
];

/** État d'une pièce jointe (pièce d'identité ou preuve de paiement). */
interface PieceJointe {
  fichier: File | null;
  apercu: string | null;
  url: string | null; // URL publique R2 après téléversement
  enCours: boolean;
  erreur: string | null;
}

const PIECE_VIDE: PieceJointe = {
  fichier: null,
  apercu: null,
  url: null,
  enCours: false,
  erreur: null,
};

/**
 * Téléverse une image DIRECTEMENT vers R2 :
 *  1. POST /api/retreat/presign → { uploadUrl, publicUrl } ;
 *  2. PUT du fichier vers l'URL pré-signée (l'image ne transite jamais
 *     par le serveur — pas de limite Vercel).
 */
async function televerserPiece(
  kind: "identite" | "paiement",
  fichier: File
): Promise<string> {
  const pres = await fetch("/api/retreat/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, contentType: fichier.type || "image/jpeg" }),
  });
  const presData = await pres.json().catch(() => ({}));
  if (!pres.ok) {
    throw new Error(presData.error || "Préparation de l'upload impossible");
  }
  const put = await fetch(presData.uploadUrl as string, {
    method: "PUT",
    body: fichier,
    headers: { "Content-Type": fichier.type || "image/jpeg" },
  });
  if (!put.ok) {
    throw new Error("L'envoi de l'image a échoué — réessayez.");
  }
  return presData.publicUrl as string;
}

export function RetraiteView() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    gender: "NON_PRECISE",
    email: "",
    phone: "",
    country: "",
    city: "",
    address: "",
    profession: "",
    maritalStatus: "Non précisé",
    emergencyContact: "",
    arrivalDate: "",
    numberOfDays: "",
    expectations: "",
    hasBeenBefore: false,
    paymentMethod: "Orange Money",
    siteWeb: "", // honeypot
    certification: false,
  });

  const [pieceIdentite, setPieceIdentite] = useState<PieceJointe>(PIECE_VIDE);
  const [preuvePaiement, setPreuvePaiement] = useState<PieceJointe>(PIECE_VIDE);

  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState(false);
  const [codeSuivi, setCodeSuivi] = useState<string | null>(null);

  const inputIdentiteRef = useRef<HTMLInputElement>(null);
  const inputPaiementRef = useRef<HTMLInputElement>(null);

  // Sélecteur pays habituel (comme /rendez-vous et /register)
  const [paysRecherche, setPaysRecherche] = useState("");
  const [listePaysOuverte, setListePaysOuverte] = useState(false);

  const paysFiltres = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(paysRecherche.toLowerCase()) ||
      c.code.toLowerCase().includes(paysRecherche.toLowerCase())
  ).slice(0, 8);
  const paysSelectionne = form.country
    ? COUNTRIES.find((c) => c.name === form.country)
    : undefined;

  /* ── Sélection d'une pièce jointe : aperçu immédiat ── */
  const choisirPiece = (
    kind: "identite" | "paiement",
    fichier: File | null
  ) => {
    if (!fichier) return;
    const setter = kind === "identite" ? setPieceIdentite : setPreuvePaiement;
    if (!fichier.type.startsWith("image/")) {
      setter((p) => ({ ...p, erreur: "Choisissez une image (photo ou capture)." }));
      return;
    }
    if (fichier.size > TAILLE_MAX_IMAGE) {
      setter((p) => ({ ...p, erreur: "Image trop lourde (8 Mo maximum)." }));
      return;
    }
    setter((p) => ({
      ...p,
      fichier,
      apercu: URL.createObjectURL(fichier),
      url: null, // sera téléversée à la validation
      erreur: null,
    }));
  };

  /* ── Soumission : téléversement des 2 pièces puis POST ── */
  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.phone || !form.country || !form.city) {
      setErreur("Renseignez les champs obligatoires (marqués d'un *).");
      return;
    }
    const jours = parseInt(form.numberOfDays, 10);
    if (!Number.isInteger(jours) || jours < 1 || jours > 90) {
      setErreur("Le nombre de jours doit être compris entre 1 et 90.");
      return;
    }
    if (!pieceIdentite.fichier || !preuvePaiement.fichier) {
      setErreur(
        "Joignez la photo de votre pièce d'identité ET la capture de votre preuve de paiement."
      );
      return;
    }
    if (!form.certification) {
      setErreur("Cochez la case de certification avant d'envoyer.");
      return;
    }

    setEnvoi(true);
    setErreur("");
    try {
      // 1. Téléversement des deux pièces (direct R2)
      const urlIdentite = await televerserPiece("identite", pieceIdentite.fichier);
      setPieceIdentite((p) => ({ ...p, url: urlIdentite }));
      const urlPaiement = await televerserPiece("paiement", preuvePaiement.fichier);
      setPreuvePaiement((p) => ({ ...p, url: urlPaiement }));

      // 2. Enregistrement de la demande (JSON — arrive à la secrétaire)
      const res = await fetch("/api/retreat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          gender: form.gender,
          email: form.email,
          phone: form.phone,
          country: form.country,
          city: form.city,
          address: form.address,
          profession: form.profession,
          maritalStatus: form.maritalStatus,
          emergencyContact: form.emergencyContact,
          arrivalDate: form.arrivalDate || null,
          numberOfDays: jours,
          expectations: form.expectations,
          hasBeenBefore: form.hasBeenBefore,
          paymentMethod: form.paymentMethod,
          idDocumentUrl: urlIdentite,
          paymentProofUrl: urlPaiement,
          source: "SITE",
          siteWeb: form.siteWeb,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi");
      setCodeSuivi(data.codeSuivi || null);
      setSucces(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setEnvoi(false);
    }
  };

  const champCls =
    "w-full px-4 py-3 rounded-xl border border-[#8A8378]/25 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/30";
  const labelCls =
    "block text-xs font-bold text-[#1E0F2B] mb-1.5 uppercase tracking-wider";

  /* ── Bloc d'upload d'une pièce jointe ── */
  const blocPiece = (
    kind: "identite" | "paiement",
    piece: PieceJointe,
    titre: string,
    aide: string,
    inputRef: React.RefObject<HTMLInputElement | null>,
    onFichier: (f: File | null) => void
  ) => (
    <div className="rounded-xl border border-[#8A8378]/20 bg-[#FAF6EF]/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#1E0F2B] uppercase tracking-wider">
            {titre} <span className="text-[#B3452E]">*</span>
          </p>
          <p className="text-[11px] text-[#8A8378] mt-1 leading-relaxed">{aide}</p>
        </div>
        {!piece.apercu && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2A0E3D] text-[#FAF6EF] text-xs font-bold hover:bg-[#3D1A54] transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Choisir
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={(e) => onFichier(e.target.files?.[0] ?? null)}
      />

      {piece.erreur && (
        <p className="mt-2 text-[11px] text-[#B3452E] font-semibold">{piece.erreur}</p>
      )}

      {piece.apercu && (
        <div className="mt-3 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={piece.apercu}
            alt={`Aperçu — ${titre}`}
            className="w-20 h-20 rounded-lg object-cover border border-[#C9A227]/40"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#1E0F2B] truncate">
              {piece.fichier?.name}
            </p>
            <p className="text-[11px] text-[#8A8378]">
              {((piece.fichier?.size || 0) / 1024 / 1024).toFixed(2)} Mo
              {envoi && piece.enCours !== undefined && !piece.url
                ? " — envoi en cours…"
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              URL.revokeObjectURL(piece.apercu || "");
              onFichier(null);
              inputRef.current?.click();
            }}
            className="flex-shrink-0 p-2 rounded-lg hover:bg-[#8A8378]/10 text-[#8A8378] hover:text-[#1E0F2B] transition-colors"
            aria-label="Changer l'image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#8A8378]/25 bg-white/70 text-sm font-semibold text-[#1E0F2B]/70 hover:border-[#C9A227] hover:text-[#1E0F2B] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au site
          </Link>
        </div>

        {succes ? (
          /* ── Confirmation ── */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-[#C9A227]/25 p-8 md:p-10 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-[#5B7052]/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-[#5B7052]" />
            </div>
            <h1 className="font-serif text-2xl md:text-3xl font-semibold text-[#1E0F2B] mb-3">
              Votre demande de retraite est enregistrée
            </h1>
            <p className="text-sm text-[#8A8378] leading-relaxed max-w-md mx-auto mb-6">
              Votre dossier (identité, pièces jointes et preuve de paiement)
              a été transmis à la secrétaire du ministère. Elle l&apos;examinera
              puis vous contactera au numéro indiqué — soyez disponible sur
              WhatsApp.
            </p>

            {codeSuivi && (
              <div className="max-w-md mx-auto mb-6 px-5 py-4 rounded-xl bg-[#2A0E3D] border border-[#C9A227]/30">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#DDBE55]/80 font-semibold mb-1">
                  Votre code de suivi — conservez-le
                </p>
                <p className="font-mono text-2xl font-bold text-[#DDBE55] tracking-widest">
                  {codeSuivi}
                </p>
                <p className="text-[11px] text-[#FAF6EF]/60 mt-2 leading-relaxed">
                  Citez ce code dans tous vos échanges avec la secrétaire.
                  N&apos;entreprennez aucun voyage avant l&apos;acceptation
                  expresse de votre demande.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] text-sm font-semibold hover:bg-[#3D1A54] transition-colors"
              >
                Retour à l&apos;accueil
              </Link>
              <button
                onClick={() => {
                  setSucces(false);
                  setCodeSuivi(null);
                  setForm({
                    firstName: "",
                    lastName: "",
                    gender: "NON_PRECISE",
                    email: "",
                    phone: "",
                    country: "",
                    city: "",
                    address: "",
                    profession: "",
                    maritalStatus: "Non précisé",
                    emergencyContact: "",
                    arrivalDate: "",
                    numberOfDays: "",
                    expectations: "",
                    hasBeenBefore: false,
                    paymentMethod: "Orange Money",
                    siteWeb: "",
                    certification: false,
                  });
                  setPieceIdentite(PIECE_VIDE);
                  setPreuvePaiement(PIECE_VIDE);
                }}
                className="px-5 py-2.5 rounded-xl border border-[#8A8378]/25 text-sm font-semibold text-[#1E0F2B] hover:bg-[#FAF6EF] transition-colors"
              >
                Déposer une autre demande
              </button>
            </div>
          </motion.div>
        ) : (
          /* ── Formulaire ── */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            {/* En-tête */}
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#2A0E3D] flex items-center justify-center mx-auto mb-4">
                <Mountain className="w-7 h-7 text-[#C9A227]" />
              </div>
              <h1 className="font-serif text-3xl md:text-4xl font-semibold text-[#1E0F2B] mb-3">
                Retraite spirituelle
              </h1>
              <p className="text-sm md:text-base text-[#8A8378] leading-relaxed max-w-xl mx-auto">
                Un lieu a été aménagé en Côte d&apos;Ivoire pour accueillir
                toute personne désireuse de passer quelques jours de retraite
                spirituelle avec le Mouvement Christ Libère. Déposez d&apos;abord
                votre demande : elle est transmise à la secrétaire, qui vous
                recontacte après examen.
              </p>
            </div>

            {/* Comment ça marche */}
            <div className="bg-white rounded-2xl border border-[#8A8378]/15 p-5 md:p-6">
              <p className="text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-4">
                Comment ça marche
              </p>
              <ol className="space-y-3">
                {[
                  {
                    icone: User,
                    texte:
                      "Renseignez vos informations identitaires et la durée de séjour souhaitée.",
                  },
                  {
                    icone: Upload,
                    texte:
                      "Joignez une photo lisible de votre pièce d'identité.",
                  },
                  {
                    icone: Coins,
                    texte: `Payez les frais de dossier de ${FRAIS_DOSSIER} (Mobile Money ou autre moyen officiel du ministère), puis joignez la capture de la preuve de paiement.`,
                  },
                  {
                    icone: CalendarDays,
                    texte:
                      "Validez : votre demande arrive dans l'espace de la secrétaire, qui vous recontacte après examen. Ne voyagez qu'après acceptation.",
                  },
                ].map(({ icone: Icone, texte }, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-[#2A0E3D] flex items-center justify-center flex-shrink-0">
                      <Icone className="w-4 h-4 text-[#C9A227]" />
                    </span>
                    <p className="text-xs text-[#8A8378] leading-relaxed pt-1.5">
                      <span className="font-bold text-[#1E0F2B] mr-1">
                        {i + 1}.
                      </span>
                      {texte}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            <form
              onSubmit={soumettre}
              className="bg-white rounded-2xl border border-[#8A8378]/15 p-6 md:p-8 space-y-6"
            >
              {/* Honeypot (invisible) */}
              <input
                type="text"
                value={form.siteWeb}
                onChange={(e) => setForm({ ...form, siteWeb: e.target.value })}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              {/* Identité */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>
                    Prénom <span className="text-[#B3452E]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className={champCls}
                    placeholder="Ex. Grâce"
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Nom <span className="text-[#B3452E]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className={champCls}
                    placeholder="Ex. Adjoua Konan"
                  />
                </div>
                <div>
                  <label className={labelCls}>Genre</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className={champCls}
                  >
                    <option value="NON_PRECISE">Non précisé</option>
                    <option value="FEMME">Femme</option>
                    <option value="HOMME">Homme</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    Téléphone / WhatsApp <span className="text-[#B3452E]">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={champCls}
                    placeholder="Indicatif + numéro, ex. +225 07 …"
                  />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={champCls}
                    placeholder="Pour recevoir l'accusé de réception"
                  />
                </div>
                <div>
                  <label className={labelCls}>Profession / occupation</label>
                  <input
                    type="text"
                    value={form.profession}
                    onChange={(e) => setForm({ ...form, profession: e.target.value })}
                    className={champCls}
                    placeholder="Ex. Enseignante, commerçante…"
                  />
                </div>

                {/* Pays — LE sélecteur habituel (recherche + drapeaux) */}
                <div className="relative">
                  <label className={labelCls}>
                    Pays de résidence <span className="text-[#B3452E]">*</span>
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378] pointer-events-none" />
                    <input
                      type="text"
                      value={
                        form.country
                          ? `${flagFromCountryCode(paysSelectionne?.code || "")} ${form.country}`
                          : paysRecherche
                      }
                      onChange={(e) => {
                        setPaysRecherche(e.target.value);
                        setForm({ ...form, country: "" });
                        setListePaysOuverte(true);
                      }}
                      onFocus={() => setListePaysOuverte(true)}
                      placeholder="Rechercher un pays…"
                      autoComplete="off"
                      className="w-full pl-10 pr-10 py-3 rounded-xl border border-[#8A8378]/25 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
                    />
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378] pointer-events-none" />
                  </div>
                  {listePaysOuverte && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setListePaysOuverte(false)}
                      />
                      <div className="absolute z-30 mt-1 w-full max-h-40 overflow-y-auto bg-white rounded-xl shadow-xl border border-[#8A8378]/20 py-1">
                        {paysFiltres.length === 0 && (
                          <p className="px-4 py-2 text-sm text-[#8A8378]">
                            Aucun pays trouvé — vérifiez l&apos;orthographe puis
                            cliquez sur un pays de la liste.
                          </p>
                        )}
                        {paysFiltres.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setForm({ ...form, country: c.name });
                              setPaysRecherche("");
                              setListePaysOuverte(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-[#FAF6EF] text-[#1E0F2B]"
                          >
                            {flagFromCountryCode(c.code)} {c.name}
                            <span className="text-[#8A8378] ml-2 text-xs">{c.code}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <label className={labelCls}>
                    Ville d&apos;origine <span className="text-[#B3452E]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className={champCls}
                    placeholder="Ex. Abidjan"
                  />
                </div>
                <div>
                  <label className={labelCls}>Adresse / quartier</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className={champCls}
                    placeholder="Facultatif"
                  />
                </div>
                <div>
                  <label className={labelCls}>Situation matrimoniale</label>
                  <select
                    value={form.maritalStatus}
                    onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
                    className={champCls}
                  >
                    {SITUATIONS_MATRIMONIALES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>
                    Personne à contacter en cas d&apos;urgence
                  </label>
                  <input
                    type="text"
                    value={form.emergencyContact}
                    onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
                    className={champCls}
                    placeholder="Nom + téléphone (facultatif mais recommandé)"
                  />
                </div>
              </div>

              {/* Séjour */}
              <div className="rounded-xl border border-[#C9A227]/25 bg-[#C9A227]/5 p-4 space-y-4">
                <p className="text-xs font-bold text-[#1E0F2B] uppercase tracking-wider flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-[#C9A227]" />
                  Votre séjour souhaité
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>
                      Date d&apos;arrivée souhaitée
                    </label>
                    <input
                      type="date"
                      value={form.arrivalDate}
                      onChange={(e) => setForm({ ...form, arrivalDate: e.target.value })}
                      className={champCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Nombre de jours <span className="text-[#B3452E]">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      required
                      value={form.numberOfDays}
                      onChange={(e) => setForm({ ...form, numberOfDays: e.target.value })}
                      className={champCls}
                      placeholder="Ex. 7"
                    />
                  </div>
                </div>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.hasBeenBefore}
                    onChange={(e) => setForm({ ...form, hasBeenBefore: e.target.checked })}
                    className="mt-0.5 w-4 h-4 accent-[#C9A227]"
                  />
                  <span className="text-xs text-[#8A8378] leading-relaxed">
                    Je suis déjà venu(e) sur le lieu de retraite du ministère.
                  </span>
                </label>
                <div>
                  <label className={labelCls}>
                    Motif / attentes spirituelles
                  </label>
                  <textarea
                    rows={4}
                    value={form.expectations}
                    onChange={(e) => setForm({ ...form, expectations: e.target.value })}
                    className={`${champCls} resize-none`}
                    placeholder="Pourquoi souhaitez-vous cette retraite ? Qu'attendez-vous de ces jours de recueillement ? (facultatif)"
                  />
                </div>
              </div>

              {/* Paiement + pièces jointes */}
              <div className="space-y-4">
                <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-[#2A0E3D] border border-[#C9A227]/30">
                  <Coins className="w-5 h-5 text-[#DDBE55] flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#FAF6EF] leading-relaxed">
                      Frais de dossier : {FRAIS_DOSSIER}
                    </p>
                    <p className="text-[11px] text-[#FAF6EF]/70 leading-relaxed mt-1">
                      Effectuez le paiement via Mobile Money ou tout autre
                      moyen officiel du ministère, puis joignez ci-dessous la
                      capture du reçu. Si vous ne connaissez pas encore les
                      coordonnées de paiement, contactez d&apos;abord la
                      secrétaire du ministère.
                    </p>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Moyen de paiement utilisé</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                    className={champCls}
                  >
                    {MOYENS_PAIEMENT.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {blocPiece(
                  "identite",
                  pieceIdentite,
                  "Pièce d'identité",
                  "Photo lisible de votre CNI, passeport ou attestation d'identité (JPEG, PNG, WebP — 8 Mo max).",
                  inputIdentiteRef,
                  (f) => choisirPiece("identite", f)
                )}
                {blocPiece(
                  "paiement",
                  preuvePaiement,
                  "Preuve de paiement",
                  `Capture d'écran ou photo du reçu de paiement des ${FRAIS_DOSSIER}.`,
                  inputPaiementRef,
                  (f) => choisirPiece("paiement", f)
                )}
              </div>

              {/* Certification */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.certification}
                  onChange={(e) => setForm({ ...form, certification: e.target.checked })}
                  className="mt-0.5 w-4 h-4 accent-[#C9A227]"
                />
                <span className="text-xs text-[#8A8378] leading-relaxed">
                  Je certifie que les informations et pièces fournies sont
                  exactes, et je comprends que ma demande doit être
                  <strong className="text-[#1E0F2B]"> acceptée par la secrétaire </strong>
                  avant tout déplacement. <span className="text-[#B3452E]">*</span>
                </span>
              </label>

              {erreur && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#B3452E]/10 border border-[#B3452E]/30 text-[#B3452E] text-xs leading-relaxed">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {erreur}
                </div>
              )}

              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="flex items-center gap-1.5 text-[11px] text-[#8A8378]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#5B7052]" />
                  Transmis uniquement au secrétariat du ministère
                </p>
                <button
                  type="submit"
                  disabled={envoi}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] text-sm font-bold hover:bg-[#3D1A54] transition-colors disabled:opacity-50"
                >
                  {envoi ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {envoi ? "Envoi des pièces et enregistrement…" : "Valider ma demande"}
                </button>
              </div>
            </form>

            <p className="text-[11px] text-[#8A8378] text-center leading-relaxed max-w-lg mx-auto">
              Vos informations et pièces d&apos;identité sont transmises
              uniquement à la secrétaire du Mouvement Christ Libère — elles ne
              sont jamais publiées. Consultez notre{" "}
              <Link href="/confidentialite" className="text-[#C9A227] underline underline-offset-2">
                politique de confidentialité
              </Link>
              .
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
