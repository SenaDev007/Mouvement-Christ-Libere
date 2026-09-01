"use client";

/**
 * ⭐ V3.11 — CARTE DES DISPERSÉS : PLUS D'INSCRIPTION ANONYME.
 * ============================================================================
 * - Le bouton « Ajouter ma position » est remplacé par « Créer un compte »
 *   → /register : on ne figure plus sur la carte sans être membre de la
 *   communauté. Dès la création du compte, le nouveau membre apparaît
 *   automatiquement sur la carte (voir /api/auth/register).
 * - Le répertoire nominatif (cartes des membres) et le panneau « Derniers
 *   inscrits » sont désormais réservés aux ADMINISTRATEURS PRINCIPAUX
 *   (SUPER_ADMIN). Les membres et visiteurs ne voient que la carte et le
 *   panneau « Rassemblement en cours ».
 * ============================================================================
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Globe, Loader2, Users, UserPlus, ShieldCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import { CarteDisperses, type MembreDisperse } from "@/components/disperses/carte-disperses";
import { COUNTRIES } from "@/lib/data/countries";
import { flagFromCountryCode } from "@/lib/data/flags";
import { api } from "@/lib/api-client";

export default function DispersesPage() {
  const { data: session, status } = useSession();
  const [membres, setMembres] = useState<MembreDisperse[]>([]);
  const [loading, setLoading] = useState(true);

  // ⭐ V3.11 — Répertoire nominatif + « Derniers inscrits » : SUPER_ADMIN
  // uniquement. Les membres et visiteurs voient la carte et le panneau
  // « Rassemblement en cours », rien d'autre.
  // (cast local : l'augmentation next-auth.d.ts n'est pas visible de tous
  // les programmes TS — cf. MessagingView pour l'usage identique.)
  const roleUtilisateur = (session?.user as { role?: string } | undefined)?.role;
  const estSuperAdmin = roleUtilisateur === "SUPER_ADMIN";

  const loadMembers = () => {
    fetch(api.url("/api/disperses"))
      .then(r => r.json())
      .then(data => { setMembres(data.membres || data.members || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadMembers(); }, []);

  return (
    <div className="min-h-screen">
      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[50vh] flex items-center justify-center pt-24 pb-12 overflow-hidden bg-[#2A0E3D] text-white">
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920&auto=format&fit=crop"
            alt="Monde"
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-15"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2A0E3D]/80 via-[#2A0E3D]/90 to-[#1A0826]" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Globe className="w-5 h-5 text-[#C9A227]" />
            <span className="text-xs uppercase tracking-[0.25em] font-semibold text-[#C9A227]">Rassemblement des dispersés</span>
          </div>
          <h1 className="font-serif text-3xl md:text-5xl font-bold text-[#FAF6EF] mb-4 drop-shadow-lg">
            Carte des <span className="text-[#C9A227]">dispersés</span> d&apos;Israël
          </h1>
          <p className="text-base md:text-lg text-[#FAF6EF]/70 leading-relaxed max-w-2xl mx-auto mb-8">
            « Il lèvera une bannière pour les nations lointaines, et il assemblera les exilés d&apos;Israël. » — Ésaïe 11:12
          </p>

          {/* ⭐ V3.11 — « Ajouter ma position » → « Créer un compte » :
              seule la création d'un compte de membre place un point sur la
              carte (le formulaire anonyme a été retiré). */}
          {status !== "authenticated" && status !== "loading" && (
            <div>
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-[#C9A227] hover:bg-[#DDBE55] text-[#1E0F2B] font-sans font-bold text-base shadow-lg transition-all duration-300"
              >
                <UserPlus className="w-5 h-5 mr-2" />
                Créer un compte
              </Link>
              <p className="mt-4 text-xs md:text-sm text-[#FAF6EF]/60 max-w-md mx-auto leading-relaxed">
                Inscrivez-vous pour rejoindre la communauté — votre pseudonyme apparaîtra aussitôt sur la carte.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ═══ MAP ═══ */}
      <section id="carte" className="py-12 md:py-16 bg-[#FAF6EF]">
        <div className="max-w-7xl mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#C9A227]" />
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <CarteDisperses membres={membres} afficherDerniersInscrits={estSuperAdmin} />
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[#8A8378]">
                <Users className="w-4 h-4" />
                <span>{membres.length} dispersé{membres.length > 1 ? "s" : ""} recensé{membres.length > 1 ? "s" : ""} sur la carte</span>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ═══ LIST — ⭐ V3.11 : répertoire nominatif réservé aux SUPER_ADMIN ═══ */}
      {estSuperAdmin && (
        <section className="py-12 md:py-16 bg-[#FAF6EF]">
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex items-center justify-center gap-2 mb-8 text-center">
              <ShieldCheck className="w-4 h-4 text-[#C9A227]" />
              <p className="text-xs uppercase tracking-[0.18em] font-semibold text-[#C9A227]">
                Répertoire nominatif — réservé aux administrateurs principaux
              </p>
            </div>
            {membres.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-[#8A8378]/30 mx-auto mb-4" />
                <p className="text-[#8A8378]">Aucun dispersé enregistré pour l&apos;instant.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {membres.map((member, i) => {
                  const country = COUNTRIES.find(c => c.code === member.pays);
                  return (
                    <motion.div key={member.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.05 }}
                      className="bg-white rounded-2xl shadow-sm border border-[#8A8378]/10 border-t-[3px] border-t-[#C9A227] p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#2A0E3D]">
                          <span className="text-sm font-bold text-[#C9A227]">{member.pseudonyme.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#1E0F2B]">{member.pseudonyme}</p>
                          <p className="text-xs text-[#8A8378]">{flagFromCountryCode(member.pays)} {country?.name || member.pays}{member.ville ? ` · ${member.ville}` : ""}</p>
                        </div>
                      </div>
                      {member.message && <p className="text-xs text-[#1E0F2B]/60 italic leading-relaxed">« {member.message} »</p>}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#8A8378]/10">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#8C5FA8]/10 text-[#8C5FA8]">{member.langue}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#C9A227]/10 text-[#C9A227] capitalize">{member.niveau}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══ CITA ═══ */}
      <section className="py-20 bg-[#2A0E3D] relative overflow-hidden">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="font-serif text-lg md:text-xl italic text-[#FAF6EF]/80 leading-relaxed">
            « Ne crains pas, car je suis avec toi ; je rassemblerai ta postérité de l&apos;orient, et je te recueillerai de l&apos;occident. »
          </p>
          <p className="text-sm text-[#C9A227] font-semibold mt-4">Ésaïe 43:5</p>
        </div>
      </section>
    </div>
  );
}
