"use client";

/**
 * ⭐ V3.69 — Courrier du secrétariat aux serviteurs de Dieu.
 *
 * Directive : « envoyer des mails au pasteur depuis le secrétariat ».
 * La secrétaire rédige un message à destination de Pasteur Kongo ou de
 * Sœur Pam ; le courriel part de noreply@mouvementchristlibere.com avec
 * l'email de la secrétaire en Reply-To — la réponse lui revient
 * directement. Chaque envoi est journalisé (OutgoingEmail + audit) et
 * l'historique des 30 derniers courriers est visible en bas de page.
 *
 * ⭐ V3.74 — bouton « Paramétrage » : les adresses des serviteurs
 * (factices par défaut) sont configurables ici par la secrétaire — les
 * courriers ET les transmissions de demandes partent ensuite à ces
 * adresses réelles (StaffSetting, prioritaire sur tout le reste).
 *
 * Données : /secretariat/api/courrier (rôles SECRETARY / SUPER_ADMIN).
 */

import { useCallback, useEffect, useState } from "react";
import {
  Mail,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  History,
  FlaskConical,
  ShieldCheck,
  User,
  Settings2,
} from "lucide-react";

interface Destinataire {
  id: string;
  nom: string;
  email: string;
}

interface CourrierHistorique {
  id: string;
  toEmail: string;
  toName: string | null;
  subject: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export default function SecretariatCourrierPage() {
  const [destinataires, setDestinataires] = useState<Destinataire[]>([]);
  const [historique, setHistorique] = useState<CourrierHistorique[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const [toUserId, setToUserId] = useState("");
  const [sujet, setSujet] = useState("");
  const [message, setMessage] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [retourEnvoi, setRetourEnvoi] = useState<{
    type: "succes" | "erreur";
    texte: string;
  } | null>(null);

  const [testEnCours, setTestEnCours] = useState(false);
  const [retourTest, setRetourTest] = useState<{
    type: "succes" | "erreur";
    texte: string;
  } | null>(null);

  // ⭐ V3.74 — Paramétrage des adresses email des serviteurs.
  const [parametres, setParametres] = useState<{
    emailKongo: string | null;
    emailPam: string | null;
  } | null>(null);
  const [paramModalOuvert, setParamModalOuvert] = useState(false);
  const [formParam, setFormParam] = useState({ emailKongo: "", emailPam: "" });
  const [paramEnCours, setParamEnCours] = useState(false);
  const [retourParam, setRetourParam] = useState<{
    type: "succes" | "erreur";
    texte: string;
  } | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const res = await fetch("/secretariat/api/courrier", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de chargement");
      setDestinataires(data.destinataires || []);
      setHistorique(data.historique || []);
      setParametres(data.parametres || null);
      // Destinataire par défaut : Pasteur Kongo s'il est présent.
      if (!toUserId && (data.destinataires || []).length > 0) {
        const kongo = data.destinataires.find(
          (d: Destinataire) => d.nom.toLowerCase().includes("kongo")
        );
        setToUserId((kongo || data.destinataires[0]).id);
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setChargement(false);
    }
    // toUserId volontairement exclu : valeur initiale choisie une seule fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (envoiEnCours) return;
    setEnvoiEnCours(true);
    setRetourEnvoi(null);
    try {
      const res = await fetch("/secretariat/api/courrier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId, sujet, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi");
      setRetourEnvoi({ type: "succes", texte: data.message || "Courrier envoyé." });
      setSujet("");
      setMessage("");
      charger();
    } catch (err) {
      setRetourEnvoi({
        type: "erreur",
        texte: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const envoyerTest = async () => {
    if (testEnCours) return;
    setTestEnCours(true);
    setRetourTest(null);
    try {
      const res = await fetch("/secretariat/api/courrier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors du test");
      setRetourTest({ type: "succes", texte: data.message || "Email de test envoyé." });
    } catch (err) {
      setRetourTest({
        type: "erreur",
        texte: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setTestEnCours(false);
    }
  };

  const envoyerParametrage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paramEnCours) return;
    setParamEnCours(true);
    setRetourParam(null);
    try {
      const res = await fetch("/secretariat/api/courrier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "parametrer",
          emailKongo: formParam.emailKongo.trim(),
          emailPam: formParam.emailPam.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'enregistrement");
      setRetourParam({
        type: "succes",
        texte: data.message || "Paramétrage enregistré.",
      });
      // Rafraîchit destinataires + paramètres effectifs.
      await charger();
      setTimeout(() => setParamModalOuvert(false), 1200);
    } catch (err) {
      setRetourParam({
        type: "erreur",
        texte: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setParamEnCours(false);
    }
  };

  const formaterDate = (iso: string) =>
    new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24 text-[#8A857C]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* En-tête */}
      <div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h1 className="font-serif text-3xl font-semibold text-[#000000] mb-1 flex items-center gap-3">
            <Mail className="w-7 h-7 text-[#C9A227]" />
            Courrier au serviteur
          </h1>
          {/* ⭐ V3.74 — bouton Paramétrage : configurer les VRAIES adresses. */}
          <button
            type="button"
            onClick={() => {
              // Pré-remplissage : paramétrage existant, sinon adresses
              // actuellement résolues (affichées dans la liste).
              const kongoResolu = destinataires.find(
                (d) => d.id === "serviteur:kongo"
              )?.email;
              const pamResolue = destinataires.find(
                (d) => d.id === "serviteur:pam"
              )?.email;
              setFormParam({
                emailKongo: parametres?.emailKongo || kongoResolu || "",
                emailPam: parametres?.emailPam || pamResolue || "",
              });
              setRetourParam(null);
              setParamModalOuvert(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#C9A227]/40 bg-[#C9A227]/10 text-sm font-semibold text-[#A3821C] hover:bg-[#C9A227]/20 transition-colors"
            title="Configurer les adresses email des serviteurs"
          >
            <Settings2 className="w-4 h-4" />
            Paramétrage
          </button>
        </div>
        <p className="text-sm text-[#8A857C]">
          Écrire directement à Pasteur Kongo ou à Sœur Pam — le message part
          de noreply@mouvementchristlibere.com et le serviteur peut vous
          répondre par email.
        </p>
      </div>

      {erreur && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#B3452E]/10 border border-[#B3452E]/30 text-[#B3452E] text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {erreur}
        </div>
      )}

      {/* Formulaire de courrier */}
      <form
        onSubmit={envoyer}
        className="bg-white rounded-2xl border border-[#8A857C]/15 p-6 space-y-5"
      >
        <div>
          <h2 className="font-semibold text-[#000000] mb-1">Nouveau courrier</h2>
          <p className="text-xs text-[#8A857C]">
            Le destinataire reçoit le message dans sa boîte mail personnelle,
            avec votre email en adresse de réponse.
          </p>
        </div>

        {/* Destinataire */}
        <div>
          <label className="block text-xs font-semibold text-[#000000] mb-1.5">
            Destinataire <span className="text-[#B3452E]">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A857C] pointer-events-none" />
            <select
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              required
              disabled={envoiEnCours || destinataires.length === 0}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm text-[#000000] focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/30"
            >
              {destinataires.length === 0 && (
                <option value="">Aucun serviteur disponible</option>
              )}
              {destinataires.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom} — {d.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sujet */}
        <div>
          <label className="block text-xs font-semibold text-[#000000] mb-1.5">
            Sujet <span className="text-[#B3452E]">*</span>
          </label>
          <input
            type="text"
            value={sujet}
            onChange={(e) => setSujet(e.target.value)}
            placeholder="Ex. Programme de la semaine — point à valider"
            required
            minLength={3}
            maxLength={150}
            disabled={envoiEnCours}
            className="w-full px-3.5 py-2.5 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm text-[#000000] focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/30"
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-xs font-semibold text-[#000000] mb-1.5">
            Message <span className="text-[#B3452E]">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Rédigez votre message au serviteur de Dieu…"
            required
            minLength={10}
            maxLength={5000}
            rows={8}
            disabled={envoiEnCours}
            className="w-full px-3.5 py-2.5 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm text-[#000000] leading-relaxed focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/30 resize-y"
          />
          <p className="text-[10px] text-[#8A857C] mt-1">
            {message.trim().length}/5000 caractères
          </p>
        </div>

        {retourEnvoi && (
          <div
            className={`flex items-start gap-2 px-4 py-3 rounded-lg text-xs leading-relaxed ${
              retourEnvoi.type === "succes"
                ? "bg-[#5B7052]/10 text-[#3F5039] border border-[#5B7052]/30"
                : "bg-[#B3452E]/10 text-[#B3452E] border border-[#B3452E]/30"
            }`}
          >
            {retourEnvoi.type === "succes" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            )}
            {retourEnvoi.texte}
          </div>
        )}

        <button
          type="submit"
          disabled={envoiEnCours || !toUserId || !sujet.trim() || !message.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] text-[#000000] text-sm font-bold hover:bg-[#FF7A1A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {envoiEnCours ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {envoiEnCours ? "Envoi en cours…" : "Envoyer le courrier"}
        </button>
      </form>

      {/* Vérification de la configuration */}
      <div className="flex items-start gap-3 px-4 py-4 rounded-2xl bg-[#C9A227]/10 border border-[#C9A227]/30">
        <FlaskConical className="w-5 h-5 text-[#A3821C] flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs text-[#000000] leading-relaxed mb-3">
            <strong>Première utilisation ?</strong> Vérifiez que l&apos;envoi
            des emails est bien configuré : un email de test sera envoyé à
            votre propre adresse de connexion.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={envoyerTest}
              disabled={testEnCours}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#000000] text-[#F0E9DE] text-xs font-semibold hover:bg-[#161513] transition-colors disabled:opacity-50"
            >
              {testEnCours ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FlaskConical className="w-3.5 h-3.5" />
              )}
              {testEnCours ? "Test en cours…" : "Envoyer un email de test"}
            </button>
            {retourTest && (
              <span
                className={`text-xs leading-relaxed ${
                  retourTest.type === "succes"
                    ? "text-[#3F5039]"
                    : "text-[#B3452E]"
                }`}
              >
                {retourTest.texte}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Historique */}
      <div className="bg-white rounded-2xl border border-[#8A857C]/15 p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-[#A3821C]" />
          <h2 className="font-semibold text-[#000000]">
            Historique des courriers
          </h2>
          <span className="text-[10px] text-[#8A857C]">
            (30 derniers — également tracés dans le journal d&apos;audit)
          </span>
        </div>

        {historique.length === 0 ? (
          <p className="text-xs text-[#8A857C] py-4 text-center">
            Aucun courrier envoyé pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-[#8A857C]/10">
            {historique.map((c) => (
              <li key={c.id} className="py-3 flex items-start gap-3">
                {c.status === "ENVOYE" ? (
                  <CheckCircle2 className="w-4 h-4 text-[#5B7052] flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-[#B3452E] flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#000000] truncate">
                    {c.subject}
                  </p>
                  <p className="text-xs text-[#8A857C]">
                    À {c.toName || c.toEmail} · {formaterDate(c.createdAt)}
                    {c.status === "ECHOUE" && (
                      <span className="text-[#B3452E]">
                        {" "}
                        — échec : {c.errorMessage || "raison inconnue"}
                      </span>
                    )}
                  </p>
                </div>
                <ShieldCheck
                  className="w-3.5 h-3.5 text-[#8A857C]/40 flex-shrink-0 mt-1"
                  aria-hidden
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* ── ⭐ V3.74 Modal : Paramétrage des adresses email des serviteurs ── */}
      {paramModalOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/60 overflow-y-auto">
          <form
            onSubmit={envoyerParametrage}
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 my-8"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#000000] flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-[#A3821C]" />
                  Paramétrage des adresses
                </h2>
                <p className="text-xs text-[#8A857C] mt-1 leading-relaxed">
                  Les adresses par défaut des serviteurs sont des adresses
                  internes. Indiquez ici les <strong>vraies adresses email</strong> :
                  les courriers ET les demandes transmises partiront à ces
                  adresses (prioritaire sur tout le reste).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setParamModalOuvert(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A857C] hover:bg-[#F0E9DE]"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#000000] mb-1.5">
                  Email de Pasteur Kongo
                </label>
                <input
                  type="email"
                  value={formParam.emailKongo}
                  onChange={(e) =>
                    setFormParam({ ...formParam, emailKongo: e.target.value })
                  }
                  placeholder="exemple@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm text-[#000000] focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/30"
                />
                {parametres?.emailKongo && (
                  <p className="text-[10px] text-[#5B7052] mt-1">
                    ✓ Adresse paramétrée : {parametres.emailKongo}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#000000] mb-1.5">
                  Email de Sœur Pam
                </label>
                <input
                  type="email"
                  value={formParam.emailPam}
                  onChange={(e) =>
                    setFormParam({ ...formParam, emailPam: e.target.value })
                  }
                  placeholder="exemple@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm text-[#000000] focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/30"
                />
                {parametres?.emailPam && (
                  <p className="text-[10px] text-[#5B7052] mt-1">
                    ✓ Adresse paramétrée : {parametres.emailPam}
                  </p>
                )}
              </div>
            </div>

            <p className="text-[10px] text-[#8A857C] leading-relaxed px-3 py-2 rounded-lg bg-[#F0E9DE] border border-[#8A857C]/10">
              Laisser un champ vide et enregistrer réinitialise ce serviteur
              sur l&apos;adresse de son compte / de la configuration serveur.
              ⚠️ Vérifiez bien la saisie : un courrier envoyé à une adresse
              erronée ne revient pas vers vous.
            </p>

            {retourParam && (
              <div
                className={`flex items-start gap-2 px-4 py-3 rounded-lg text-xs leading-relaxed ${
                  retourParam.type === "succes"
                    ? "bg-[#5B7052]/10 text-[#3F5039] border border-[#5B7052]/30"
                    : "bg-[#B3452E]/10 text-[#B3452E] border border-[#B3452E]/30"
                }`}
              >
                {retourParam.type === "succes" ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                {retourParam.texte}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setParamModalOuvert(false)}
                className="px-4 py-2 rounded-lg text-sm text-[#8A857C] hover:text-[#000000]"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={paramEnCours}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#000000] text-[#F0E9DE] text-sm font-semibold hover:bg-[#161513] transition-colors disabled:opacity-50"
              >
                {paramEnCours && <Loader2 className="w-4 h-4 animate-spin" />}
                Enregistrer le paramétrage
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
