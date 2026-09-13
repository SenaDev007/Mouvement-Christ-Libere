"use client";

// ⭐ V3.49 — PLUGIN OBS MULTI-RTMP (sorayuki) INTÉGRÉ AU MODULE LIVE
// Guide professionnel embarqué dans le back-office :
//  • présentation du plugin (multidiffusion simultanée depuis OBS Studio)
//  • téléchargement officiel (liens GitHub vérifiés)
//  • installation Windows pas à pas (installateur + version portable)
//  • configuration des sorties (une par plateforme)
//  • URL + clé d'ingress du studio copiables en un clic (contextuel au live)
//  • conseils CPU / bande passante / anti double-diffusion
//
// Intégré à TROIS endroits du module Live :
//  1. /admin/lives — en-tête : bouton « Guide Multi-RTMP »
//  2. Studio (mode « Encodeur externe (OBS) ») — bouton inline qui transmet
//     l'URL et la clé d'ingress DU LIVE EN COURS au guide
//  3. Configuration RTMP (serviteurs) — bannière : les clés enregistrées se
//     copient telles quelles dans le plugin.

import { useState, ReactNode, ComponentType } from "react";
import Link from "next/link";
import {
  Layers, Gauge, ShieldCheck, Wrench, Download, ExternalLink,
  Copy, CheckCircle2, AlertTriangle, Cpu, Radio, Server, Info,
  Youtube, Facebook, Music2, Instagram,
} from "lucide-react";
import { AdminModal } from "@/components/admin/admin-modal";

// Liens officiels vérifiés le 09/09/2026 (HTTP 200).
// Tag de release : 0.7.4.3 — les binaires Windows sont nommés 0.7.4.0.
const PLUGIN = {
  name: "obs-multi-rtmp",
  version: "0.7.4.3",
  releasesUrl: "https://github.com/sorayuki/obs-multi-rtmp/releases",
  homepageUrl: "https://sorayuki.github.io/obs-multi-rtmp/",
  windowsInstallerUrl:
    "https://github.com/sorayuki/obs-multi-rtmp/releases/download/0.7.4.3/obs-multi-rtmp-0.7.4.0-windows-x64-Installer.exe",
  windowsZipUrl:
    "https://github.com/sorayuki/obs-multi-rtmp/releases/download/0.7.4.3/obs-multi-rtmp-0.7.4.0-windows-x64.zip",
};

// ─── Petits briques de mise en page (pas d'emoji — icônes Lucide) ───

function SectionTitle({ icon: Icon, children }: { icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-[#C9A227] flex-shrink-0" />
      <h3 className="text-xs font-bold text-[#1E0F2B] uppercase tracking-wider">{children}</h3>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children?: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="w-5 h-5 rounded-full bg-[#C9A227] text-[#1E0F2B] text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
        {n}
      </span>
      <p className="text-xs text-[#1E0F2B]/70 leading-relaxed min-w-0">
        <span className="font-bold text-[#1E0F2B]">{title}</span>{" "}
        {children}
      </p>
    </li>
  );
}

function BenefitCard({ icon: Icon, title, children }: { icon: ComponentType<{ className?: string }>; title: string; children: ReactNode }) {
  return (
    <div className="p-3 rounded-xl bg-[#FAF6EF] border border-[#8A8378]/15">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-lg bg-[#C9A227]/15 flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5 text-[#A3821C]" />
        </div>
        <p className="text-xs font-bold text-[#1E0F2B]">{title}</p>
      </div>
      <p className="text-[11px] text-[#1E0F2B]/60 leading-relaxed">{children}</p>
    </div>
  );
}

// Champ copiable (URL / clé de stream) — même ergonomie que le studio.
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Repli (contextes non sécurisés / vieux navigateurs)
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* silencieux */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <label className="block text-[10px] text-[#1E0F2B]/50 uppercase mb-1 font-semibold">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-white text-[11px] text-[#1E0F2B] font-mono border border-[#8A8378]/15 truncate"
          aria-label={label}
        />
        <button
          type="button"
          onClick={copy}
          className="p-1.5 rounded-lg bg-[#C9A227]/15 text-[#A3821C] hover:bg-[#C9A227]/30 transition-colors flex-shrink-0"
          aria-label={`Copier ${label}`}
          title={`Copier ${label}`}
        >
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── Le modal guide (réutilisable seul) ───

interface ObsMultiRtmpGuideModalProps {
  open: boolean;
  onClose: () => void;
  accentColor?: string;
  // ⭐ Studio : URL + clé d&apos;ingress du live en cours → carte dédiée copiable.
  ingressUrl?: string | null;
  ingressKey?: string | null;
}

export function ObsMultiRtmpGuideModal({
  open,
  onClose,
  accentColor = "#C9A227",
  ingressUrl,
  ingressKey,
}: ObsMultiRtmpGuideModalProps) {
  const platforms = [
    { label: "YouTube", icon: Youtube, color: "#FF0000" },
    { label: "Facebook", icon: Facebook, color: "#1877F2" },
    { label: "TikTok", icon: Music2, color: "#000000" },
    { label: "Instagram", icon: Instagram, color: "#FA326E" },
  ];

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="Plugin OBS Multi-RTMP"
      subtitle="Diffusez le même direct sur toutes vos plateformes en même temps, directement depuis OBS Studio"
      size="xl"
      accentColor={accentColor}
    >
      <div className="space-y-6">
        {/* ① Pourquoi ce plugin */}
        <section>
          <SectionTitle icon={Layers}>Pourquoi ce plugin</SectionTitle>
          <p className="text-xs text-[#1E0F2B]/70 leading-relaxed mb-3">
            Le plugin <span className="font-bold text-[#1E0F2B]">obs-multi-rtmp</span> ajoute à OBS Studio la
            capacité de pousser le même direct vers plusieurs serveurs RTMP <span className="font-bold">en même
            temps</span>. Le studio du site et vos plateformes sociales reçoivent chacun leur flux, sans relais
            intermédiaire.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <BenefitCard icon={Layers} title="Multidiffusion simultanée">
              Un seul direct OBS, envoyé en parallèle vers autant de destinations que vous voulez : le studio du
              site, YouTube, Facebook, TikTok, Instagram.
            </BenefitCard>
            <BenefitCard icon={Gauge} title="Réglages par destination">
              Chaque sortie possède sa propre URL, sa clé et — si besoin — son propre encodeur : 1080p pour
              YouTube, 720p léger pour les réseaux, sans toucher à votre scène.
            </BenefitCard>
            <BenefitCard icon={ShieldCheck} title="Direct depuis votre PC">
              Les flux partent de votre ordinateur droit vers les plateformes : la diffusion ne consomme plus les
              minutes de relais du site et ne dépend d&apos;aucun intermédiaire.
            </BenefitCard>
            <BenefitCard icon={Wrench} title="Gratuit et open source">
              Plugin officiel publié sur GitHub par sorayuki. Il est gratuit — ne l&apos;achetez jamais auprès
              d&apos;un revendeur.
            </BenefitCard>
          </div>
        </section>

        {/* ② Téléchargement */}
        <section>
          <SectionTitle icon={Download}>Téléchargement</SectionTitle>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#C9A227]/15 text-[#A3821C] text-[11px] font-bold">
              <Radio className="w-3 h-3" />
              Version {PLUGIN.version} · Windows 64 bits
            </span>
            <span className="text-[10px] text-[#8A8378]">Liens officiels GitHub, vérifiés le 09/09/2026</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href={PLUGIN.windowsInstallerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-[#1E0F2B] hover:opacity-90 transition-opacity"
              style={{ backgroundColor: accentColor }}
            >
              <Download className="w-4 h-4" />
              Installateur Windows (.exe)
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1E0F2B]/10">recommandé</span>
            </a>
            <a
              href={PLUGIN.windowsZipUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] font-bold text-sm text-[#1E0F2B] hover:border-[#C9A227] transition-colors"
            >
              <Download className="w-4 h-4" />
              Archive portable (.zip)
            </a>
          </div>
          <a
            href={PLUGIN.releasesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-[#A3821C] hover:underline"
          >
            Toutes les versions sur GitHub (Linux .deb inclus)
            <ExternalLink className="w-3 h-3" />
          </a>
          <div className="flex items-start gap-2 mt-3 p-2.5 rounded-lg bg-[#FAF6EF] border border-[#8A8378]/15">
            <Info className="w-3.5 h-3.5 text-[#A3821C] flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#1E0F2B]/60 leading-relaxed">
              Prérequis : OBS Studio installé sur votre ordinateur (Windows 64 bits). Fermez OBS Studio avant
              l&apos;installation.
            </p>
          </div>
        </section>

        {/* ③ Installation */}
        <section>
          <SectionTitle icon={Wrench}>Installation (Windows)</SectionTitle>
          <ol className="space-y-2.5">
            <Step n={1} title="Fermez OBS Studio.">L&apos;installation se fait toujours OBS fermé.</Step>
            <Step n={2} title="Lancez l&apos;installateur .exe téléchargé.">
              Il détecte automatiquement votre installation d&apos;OBS Studio — ne modifiez pas le dossier
              d&apos;installation proposé.
            </Step>
            <Step n={3} title="Version portable :">
              extrayez plutôt l&apos;archive .zip dans le dossier d&apos;OBS Studio
              (<span className="font-mono text-[10px]">C:\Program Files\obs-studio</span>).
            </Step>
            <Step n={4} title="Relancez OBS Studio.">
              Un nouveau menu <span className="font-bold">« Multiple RTMP Outputs »</span> (multidiffusion) est
              apparu dans la barre de menus.
            </Step>
          </ol>
        </section>

        {/* ④ Configuration */}
        <section>
          <SectionTitle icon={Server}>Configurer vos sorties (une par destination)</SectionTitle>
          <ol className="space-y-2.5 mb-3">
            <Step n={1} title="Dans OBS Studio,">
              ouvrez le menu « Multiple RTMP Outputs » puis « Add new output ».
            </Step>
            <Step n={2} title="Choisissez le mode d&apos;encodage :">
              « Use current streaming settings » (réutilise les réglages et l&apos;encodeur de votre flux principal
              — économique en CPU) ou un encodeur dédié pour des réglages propres à cette sortie.
            </Step>
            <Step n={3} title="Renseignez l&apos;URL RTMP et la clé de stream">
              de la destination (à copier depuis les cartes ci-dessous).
            </Step>
            <Step n={4} title="Répétez pour chaque plateforme,">
              puis démarrez les sorties (« Start all ») — le direct part partout en même temps.
            </Step>
          </ol>

          <div className="space-y-2">
            {/* Sortie studio (contextuelle au live ouvert dans le studio) */}
            {ingressUrl && ingressKey && (
              <div className="p-3.5 rounded-xl border border-[#C9A227]/30 bg-[#C9A227]/5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-[#C9A227]/15 flex items-center justify-center flex-shrink-0">
                    <Server className="w-3.5 h-3.5 text-[#A3821C]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1E0F2B]">Destination 1 — Le studio du site (ce direct)</p>
                    <p className="text-[10px] text-[#8A8378]">
                      Ajoutez cette sortie pour que le direct s&apos;affiche sur le site : viewer, chat, réactions
                      et enregistrement du replay.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CopyField label="URL RTMP du studio" value={ingressUrl} />
                  <CopyField label="Clé de stream du studio" value={ingressKey} />
                </div>
              </div>
            )}

            {/* Plateformes sociales */}
            <div className="p-3.5 rounded-xl border border-[#8A8378]/15 bg-[#FAF6EF]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-[#2A0E3D]/5 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-3.5 h-3.5 text-[#2A0E3D]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#1E0F2B]">Destinations 2+ — Vos plateformes sociales</p>
                  <p className="text-[10px] text-[#8A8378]">
                    Les clés enregistrées par serviteur dans le back-office se copient telles quelles dans le
                    plugin.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {platforms.map((p) => {
                  const Icon = p.icon;
                  return (
                    <span
                      key={p.label}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-[#8A8378]/15 text-[10px] font-bold text-[#1E0F2B]"
                    >
                      <Icon className="w-3 h-3" style={{ color: p.color }} />
                      {p.label}
                    </span>
                  );
                })}
              </div>
              <Link
                href="/admin/servants"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A3821C] hover:underline"
              >
                Ouvrir « Serviteurs → Configuration RTMP »
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            {/* Anti double-diffusion */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-[#C9A227]/40 bg-[#C9A227]/10">
              <AlertTriangle className="w-4 h-4 text-[#A3821C] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#1E0F2B]/75 leading-relaxed">
                <span className="font-bold text-[#1E0F2B]">Évitez la double diffusion :</span> une même clé ne
                doit être alimentée que par une seule source à la fois. Si une plateforme est poussée par le
                plugin, décochez-la dans le formulaire « Programmer un live » — le site continuera
                d&apos;afficher le direct grâce à la sortie studio.
              </p>
            </div>
          </div>
        </section>

        {/* ⑤ Bon à savoir */}
        <section>
          <SectionTitle icon={Cpu}>Bon à savoir</SectionTitle>
          <ul className="space-y-2">
            <li className="flex items-start gap-2.5">
              <Cpu className="w-3.5 h-3.5 text-[#A3821C] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#1E0F2B]/65 leading-relaxed">
                <span className="font-bold text-[#1E0F2B]">Encodeur partagé :</span> « Use current streaming
                settings » n&apos;encode qu&apos;une fois pour toutes les sorties — CPU quasi inchangé. Encodeurs
                dédiés : qualité et résolution différentes par plateforme, mais CPU plus sollicité.
              </p>
            </li>
            <li className="flex items-start gap-2.5">
              <Gauge className="w-3.5 h-3.5 text-[#A3821C] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#1E0F2B]/65 leading-relaxed">
                <span className="font-bold text-[#1E0F2B]">Bande passante :</span> chaque sortie consomme son
                propre débit — deux sorties à 4,5 Mbps exigent environ 9 Mbps en montée. Vérifiez votre connexion
                avant d&apos;activer de nombreuses destinations.
              </p>
            </li>
            <li className="flex items-start gap-2.5">
              <Radio className="w-3.5 h-3.5 text-[#A3821C] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#1E0F2B]/65 leading-relaxed">
                <span className="font-bold text-[#1E0F2B]">Pendant le direct :</span> chaque sortie se démarre et
                s&apos;arrête individuellement — une plateforme peut être ajoutée en cours de route.
              </p>
            </li>
            <li className="flex items-start gap-2.5">
              <Wrench className="w-3.5 h-3.5 text-[#A3821C] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#1E0F2B]/65 leading-relaxed">
                <span className="font-bold text-[#1E0F2B]">Désinstallation :</span> via l&apos;installateur, ou en
                supprimant le dossier{" "}
                <span className="font-mono text-[10px]">C:\ProgramData\obs-studio\plugins\obs-multi-rtmp</span>.
              </p>
            </li>
          </ul>
        </section>

        {/* Pied — source officielle */}
        <div className="pt-3 border-t border-[#8A8378]/10 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[10px] text-[#8A8378]">
            Plugin communautaire obs-multi-rtmp — sorayuki · Gratuit, sans engagement.
          </p>
          <a
            href={PLUGIN.homepageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#A3821C] hover:underline"
          >
            Documentation officielle
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    </AdminModal>
  );
}

// ─── Bouton déclencheur + modal (3 variantes d&apos;intégration) ───

interface ObsMultiRtmpGuideProps {
  variant?: "header" | "inline" | "banner";
  accentColor?: string;
  buttonLabel?: string;
  ingressUrl?: string | null;
  ingressKey?: string | null;
}

export function ObsMultiRtmpGuide({
  variant = "header",
  accentColor = "#C9A227",
  buttonLabel,
  ingressUrl,
  ingressKey,
}: ObsMultiRtmpGuideProps) {
  const [open, setOpen] = useState(false);

  const openModal = () => setOpen(true);
  const closeModal = () => setOpen(false);

  if (variant === "inline") {
    return (
      <>
        <button
          type="button"
          onClick={openModal}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#C9A227]/40 text-[#A3821C] text-xs font-bold hover:bg-[#C9A227]/10 transition-colors"
        >
          <Layers className="w-3.5 h-3.5" />
          {buttonLabel || "Diffuser sur plusieurs plateformes — plugin Multi-RTMP"}
        </button>
        <ObsMultiRtmpGuideModal
          open={open}
          onClose={closeModal}
          accentColor={accentColor}
          ingressUrl={ingressUrl}
          ingressKey={ingressKey}
        />
      </>
    );
  }

  if (variant === "banner") {
    return (
      <>
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-[#C9A227]/30 bg-[#C9A227]/5">
          <div className="w-9 h-9 rounded-xl bg-[#C9A227]/15 flex items-center justify-center flex-shrink-0">
            <Layers className="w-4 h-4 text-[#A3821C]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#1E0F2B]">Plugin OBS Multi-RTMP — diffusez partout en même temps</p>
            <p className="text-xs text-[#8A8378] mt-0.5 leading-relaxed">
              Les clés configurées ci-dessous se copient telles quelles dans le plugin obs-multi-rtmp d&apos;OBS
              Studio, pour pousser le direct simultanément vers plusieurs plateformes depuis votre ordinateur.
            </p>
          </div>
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-[#1E0F2B] hover:opacity-90 transition-opacity flex-shrink-0"
            style={{ backgroundColor: accentColor }}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Voir le guide</span>
            <span className="sm:hidden">Guide</span>
          </button>
        </div>
        <ObsMultiRtmpGuideModal
          open={open}
          onClose={closeModal}
          accentColor={accentColor}
          ingressUrl={ingressUrl}
          ingressKey={ingressKey}
        />
      </>
    );
  }

  // variante « header » — en-tête de page du module Lives
  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border-2 border-[#C9A227]/40 text-[#A3821C] text-sm font-bold hover:border-[#C9A227] hover:bg-[#C9A227]/5 transition-colors shadow-sm"
        title="Guide du plugin OBS Multi-RTMP (multidiffusion)"
      >
        <Layers className="w-4 h-4" />
        {buttonLabel || "Guide Multi-RTMP"}
      </button>
      <ObsMultiRtmpGuideModal
        open={open}
        onClose={closeModal}
        accentColor={accentColor}
        ingressUrl={ingressUrl}
        ingressKey={ingressKey}
      />
    </>
  );
}
