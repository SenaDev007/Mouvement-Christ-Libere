"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  FileText,
  Video,
  BookOpen,
  User,
  Hash,
  Calendar,
} from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { AuroraBackground } from "@/components/magic/aurora-background";
import { ParticleField } from "@/components/magic/particle-field";
import { QuoteBlock, SectionDivider } from "@/components/premium/section-divider";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

interface AncreArweave {
  contenuId: string;
  hash: string;
  hashAlgorithme: string;
  arweaveTxId: string | null;
  arweaveUrl: string | null;
  dateAncrage: string;
  taille: number;
  mode: "demo" | "production";
  verified: boolean;
}

interface ContenuAncrable {
  id: string;
  type: "temoignage" | "enseignement" | "video" | "biographie";
  titre: string;
  contenu: string;
  auteur: string;
  dateCreation: string;
}

const TYPES = [
  { value: "temoignage", label: "Témoignage", icon: FileText },
  { value: "enseignement", label: "Enseignement", icon: BookOpen },
  { value: "video", label: "Vidéo", icon: Video },
  { value: "biographie", label: "Biographie", icon: User },
];

export default function CoffreFortPage() {
  const [form, setForm] = useState({
    type: "temoignage" as ContenuAncrable["type"],
    titre: "",
    contenu: "",
    auteur: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    contenu: ContenuAncrable;
    ancre: AncreArweave;
  } | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titre || !form.contenu || !form.auteur) {
      setError("Tous les champs sont requis.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(api.url("/api/arweave/ancrer"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Échec de l'ancrage");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1565538810643-8f0f3a098f24?q=80&w=1920&auto=format&fit=crop"
        kicker="Coffre-fort numérique immuable"
        title="Ancrage Arweave"
        subtitle="Les contenus (témoignages, enseignements, vidéos) sont hachés et ancrés sur la blockchain Arweave. Même en cas de censure ou de compromission du site, les contenus restent vérifiables et accessibles éternellement."
        primaryCta={{ label: "Ancrer un contenu", href: "#ancrer" }}
      />

      {/* Explication */}
      <section className="bg-[#FAF6EF] py-16 md:py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="card-gold-top p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#2A0E3D]/10 mb-4">
                <Hash className="w-6 h-6 text-[#2A0E3D]" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-[#1E0F2B] mb-2">
                1. Hachage SHA-256
              </h3>
              <p className="text-sm text-[#1E0F2B]/70 leading-relaxed">
                Chaque contenu est haché avec SHA-256. Le hash est unique : toute modification
                du contenu, même d&apos;un seul caractère, produit un hash différent. C&apos;est la
                preuve mathématique d&apos;intégrité.
              </p>
            </div>

            <div className="card-gold-top p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#C9A227]/10 mb-4">
                <Lock className="w-6 h-6 text-[#C9A227]" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-[#1E0F2B] mb-2">
                2. Ancrage Arweave
              </h3>
              <p className="text-sm text-[#1E0F2B]/70 leading-relaxed">
                Le contenu et son hash sont uploadés sur Arweave, une blockchain de stockage
                permanent. Une fois ancré, le contenu ne peut plus être modifié ni supprimé —
                il est gravé pour l&apos;éternité dans le réseau décentralisé.
              </p>
            </div>

            <div className="card-gold-top p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-state-success/10 mb-4">
                <ShieldCheck className="w-6 h-6 text-state-success" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-[#1E0F2B] mb-2">
                3. Vérification perpétuelle
              </h3>
              <p className="text-sm text-[#1E0F2B]/70 leading-relaxed">
                N&apos;importe qui peut vérifier à tout moment qu&apos;un contenu n&apos;a pas été
                altéré, en comparant le hash actuel avec le hash ancré sur Arweave. La vérification
                fonctionne même si le site est censuré.
              </p>
            </div>
          </div>

          {/* Bandeau anti-censure */}
          <div className="mt-8 p-6 bg-[#2A0E3D] text-[#FAF6EF] rounded-2xl border border-[#C9A227]/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/10 blur-3xl rounded-full pointer-events-none" />
            <div className="relative flex items-start gap-4">
              <ShieldCheck className="w-8 h-8 text-[#C9A227] flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-serif text-xl font-semibold text-[#FAF6EF] mb-2">
                  Pourquoi un coffre-fort ?
                </h3>
                <p className="text-sm text-[#FAF6EF]/80 leading-relaxed">
                  Le cahier des charges prévoit qu&apos;en cas de censure — shadowban YouTube,
                  suppression Facebook, saisie de domaine, compromission du serveur — les
                  contenus doivent rester accessibles et vérifiables. Arweave répond à cette
                  exigence : une fois ancré, un contenu est immuable et indestructible.
                  Même si le site Christ Libère disparaît, les témoignages de Pam
                  et les enseignements du Pasteur Kongo subsistent sur la blockchain.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Formulaire d'ancrage */}
      <section id="ancrer" className="bg-[#FAF6EF] py-16 md:py-20">
        <div className="container mx-auto max-w-2xl px-4">
          <div className="text-center mb-8">
            <h2 className="font-serif text-3xl font-semibold text-[#1E0F2B] mb-3">
              Ancrer un contenu
            </h2>
            <p className="text-sm text-[#8A8378]">
              Le contenu sera haché (SHA-256) et ancré sur Arweave. En mode démo (sans clé
              Arweave configurée), seul le hash est généré — preuve d&apos;existence.
            </p>
          </div>

          {result ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card-gold-top p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-state-success/15 border-2 border-state-success/40">
                  <CheckCircle2 className="w-6 h-6 text-state-success" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-semibold text-[#1E0F2B]">
                    Contenu ancré
                  </h3>
                  <p className="text-xs text-[#8A8378]">
                    {result.ancre.mode === "production"
                      ? "Ancrage Arweave réussi"
                      : "Mode démo — hash SHA-256 généré"}
                  </p>
                </div>
              </div>

              {/* Détails de l'ancre */}
              <div className="space-y-3 mb-6">
                <DetailRow
                  icon={FileText}
                  label="Titre"
                  value={result.contenu.titre}
                />
                <DetailRow
                  icon={User}
                  label="Auteur"
                  value={result.contenu.auteur}
                />
                <DetailRow
                  icon={Hash}
                  label="Hash SHA-256"
                  value={result.ancre.hash}
                  mono
                />
                <DetailRow
                  icon={Calendar}
                  label="Date d'ancrage"
                  value={new Date(result.ancre.dateAncrage).toLocaleString("fr-FR")}
                />
                {result.ancre.arweaveTxId && (
                  <DetailRow
                    icon={ExternalLink}
                    label="Transaction Arweave"
                    value={result.ancre.arweaveTxId}
                    mono
                    link={result.ancre.arweaveUrl || undefined}
                  />
                )}
                <DetailRow
                  icon={ShieldCheck}
                  label="Mode"
                  value={result.ancre.mode === "production" ? "Production (Arweave)" : "Démo (SHA-256)"}
                />
              </div>

              {/* Hash en grand pour copie */}
              <div className="p-4 bg-[#2A0E3D]/5 border border-[#C9A227]/20 rounded-full mb-6">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-2">
                  Preuve d&apos;intégrité (hash)
                </p>
                <code className="text-xs font-mono text-[#2A0E3D] break-all">
                  {result.ancre.hash}
                </code>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setResult(null);
                    setForm({ type: "temoignage", titre: "", contenu: "", auteur: "" });
                  }}
                  className="px-5 py-2.5 rounded-full border border-[#2A0E3D]/30 text-[#2A0E3D] hover:bg-[#2A0E3D]/5 transition-colors text-sm font-semibold"
                >
                  Ancrer un autre contenu
                </button>
                {result.ancre.arweaveUrl && (
                  <a
                    href={result.ancre.arweaveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#C9A227] text-[#1E0F2B] text-sm font-semibold hover:bg-[#DDBE55] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Voir sur Arweave
                  </a>
                )}
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="card-gold-top p-8 space-y-5">
              {/* Type */}
              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-2 block">
                  Type de contenu
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {TYPES.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm({ ...form, type: t.value as ContenuAncrable["type"] })}
                        className={cn(
                          "p-3 rounded-full border text-center transition-all",
                          form.type === t.value
                            ? "border-[#C9A227] bg-[#C9A227]/10"
                            : "border-[#8A8378]/30 hover:border-[#C9A227]/50"
                        )}
                      >
                        <Icon className={cn(
                          "w-5 h-5 mx-auto mb-1",
                          form.type === t.value ? "text-[#C9A227]" : "text-[#8A8378]"
                        )} />
                        <span className={cn(
                          "text-[10px] font-semibold",
                          form.type === t.value ? "text-[#1E0F2B]" : "text-[#8A8378]"
                        )}>
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-2 block">
                  Titre *
                </label>
                <input
                  type="text"
                  value={form.titre}
                  onChange={(e) => setForm({ ...form, titre: e.target.value })}
                  required
                  placeholder="Titre du contenu"
                  className="w-full px-4 py-3 rounded-full border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-2 block">
                  Auteur *
                </label>
                <input
                  type="text"
                  value={form.auteur}
                  onChange={(e) => setForm({ ...form, auteur: e.target.value })}
                  required
                  placeholder="PAM, Pasteur Kongo, ou autre"
                  className="w-full px-4 py-3 rounded-full border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-2 block">
                  Contenu *
                </label>
                <textarea
                  value={form.contenu}
                  onChange={(e) => setForm({ ...form, contenu: e.target.value })}
                  required
                  rows={8}
                  placeholder="Le texte intégral du contenu à ancrer..."
                  className="w-full px-4 py-3 rounded-full border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 resize-y font-serif"
                />
                <p className="text-xs text-[#8A8378] mt-1">
                  {form.contenu.length} caractères · ~{Math.ceil(form.contenu.length / 1024)} KB
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-state-danger text-sm p-3 rounded-full bg-state-danger/5 border border-state-danger/20">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-4 rounded-full bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm hover:bg-[#DDBE55] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Ancrage en cours...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Ancrer sur Arweave
                  </>
                )}
              </button>

              <p className="text-xs text-[#8A8378] text-center">
                Une fois ancré, le contenu ne peut plus être modifié ni supprimé.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Citation */}
      <AuroraBackground variant="imperial" intensity="strong" className="py-24 md:py-32">
        <ParticleField count={40} color="#C9A227" size={1.5} speed="slow" />
        <div className="relative">
          <QuoteBlock
            text="Le ciel et la terre passeront, mais mes paroles ne passeront point."
            reference="Matthieu 24:35"
            variant="dark"
          />
        </div>
      </AuroraBackground>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
  link,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
  link?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[#8A8378]/10">
      <Icon className="w-4 h-4 text-[#8A8378] flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-0.5">
          {label}
        </p>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "text-sm text-[#2A0E3D] hover:text-[#C9A227] transition-colors break-all inline-flex items-center gap-1",
              mono && "font-mono"
            )}
          >
            {value}
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        ) : (
          <p className={cn("text-sm text-[#1E0F2B] break-all", mono && "font-mono")}>
            {value}
          </p>
        )}
      </div>
    </div>
  );
}
