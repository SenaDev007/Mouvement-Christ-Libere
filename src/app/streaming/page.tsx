import { PageHero } from "@/components/site/page-hero";
import { AuroraBackground } from "@/components/magic/aurora-background";
import { ParticleField } from "@/components/magic/particle-field";
import { QuoteBlock, SectionDivider } from "@/components/premium/section-divider";
import { Radio, Youtube, Facebook, Video, Server, Cloud, RefreshCw, ShieldCheck, ArrowRight } from "lucide-react";

export default function StreamingPage() {
  return (
    <div>
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1598488035139-bdbb35331026?q=80&w=1920&auto=format&fit=crop"
        kicker="Streaming multiplateforme automatisé"
        title="Streaming RTMP"
        subtitle="Un live lancé depuis le site est diffusé simultanément sur YouTube, Facebook, TikTok et Odysee. Le site reste la source de référence — même si les plateformes suppriment."
        primaryCta={{ label: "Architecture", href: "#architecture" }}
        secondaryCta={{ label: "Déploiement", href: "#deploiement" }}
      />

      {/* Schéma de flux */}
      <section className="bg-ivory py-20 md:py-24">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.3em] text-gold font-semibold mb-3">Le schéma</p>
            <h2 className="font-serif text-3xl md:text-4xl font-semibold text-ink">
              Un stream entrant, cinq sorties
            </h2>
          </div>

          {/* Diagramme de flux */}
          <div className="card-gold-top p-8 mb-8">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
              {/* Source */}
              <div className="text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-imperial text-ivory mb-2">
                  <Radio className="w-7 h-7" />
                </div>
                <p className="text-xs font-semibold text-ink">Pam / Pasteur Kongo</p>
                <p className="text-[10px] text-stone">OBS / Streamlabs</p>
              </div>

              <ArrowRight className="w-6 h-6 text-gold rotate-90 lg:rotate-0" />

              {/* Serveur RTMP central */}
              <div className="text-center">
                <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gold/15 border-2 border-gold">
                  <Server className="w-8 h-8 text-gold" />
                </div>
                <p className="text-xs font-semibold text-ink mt-2">Ant Media Server</p>
                <p className="text-[10px] text-stone">RTMP → HLS/DASH</p>
              </div>

              <ArrowRight className="w-6 h-6 text-gold rotate-90 lg:rotate-0" />

              {/* Sorties */}
              <div className="flex flex-col gap-2">
                <Platform icon={Video} label="Site (HLS)" color="text-imperial" />
                <Platform icon={Youtube} label="YouTube" color="text-state-danger" />
                <Platform icon={Facebook} label="Facebook" color="text-lavender" />
                <Platform icon={Radio} label="TikTok" color="text-stone" />
                <Platform icon={Cloud} label="Odysee" color="text-state-success" />
              </div>
            </div>
          </div>

          {/* Avantages */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card icon={RefreshCw} title="Automatisé" description="Un seul stream entrant. Le serveur Ant Media gère la retransmission vers toutes les plateformes simultanément." />
            <Card icon={ShieldCheck} title="Résistant" description="Si une plateforme supprime le live, il continue sur le site et les autres plateformes. Archive automatique locale." />
            <Card icon={Cloud} title="ABR + CDN" description="Adaptive Bitrate Streaming (1080p/720p/480p/240p). Cloudflare CDN pour la scalabilité mondiale." />
          </div>

          {/* Architecture */}
          <div id="architecture" className="card-gold-top p-8 mb-8">
            <h3 className="font-serif text-xl font-semibold text-ink mb-6">Architecture détaillée</h3>
            <div className="space-y-4">
              <Step num="1" title="Source — Encodeur" description="Pam ou le Pasteur Kongo ouvre un live depuis OBS Studio, Streamlabs, ou un encodeur matériel. Le flux RTMP est envoyé vers le serveur Ant Media." />
              <Step num="2" title="Serveur — Ant Media Server" description="Reçoit le flux RTMP, le transcode en plusieurs qualités (ABR : 1080p, 720p, 480p, 240p), et le redistribue en HLS/DASH." />
              <Step num="3" title="Site web — Lecteur HLS" description="Le flux HLS est servi au lecteur vidéo intégré du site, via Cloudflare CDN pour la mise en cache et la scalabilité." />
              <Step num="4" title="Restreamer — Multi-destination" description="Un module restreamer (FFmpeg) envoie une copie du flux RTMP vers YouTube, Facebook, TikTok et Odysee simultanément." />
              <Step num="5" title="Archivage — automatique" description="À la fin du live, la vidéo est automatiquement archivée sur le site (haute qualité) + une copie chiffrée sur stockage secondaire (Backblaze B2)." />
              <Step num="6" title="Redondance — serveur secondaire" description="Un second serveur Ant Media, dans une autre juridiction, peut prendre le relais en cas de panne. Basculement automatique via DNS." />
            </div>
          </div>

          {/* Déploiement */}
          <div id="deploiement" className="card-gold-top p-8 mb-8">
            <h3 className="font-serif text-xl font-semibold text-ink mb-6">Déploiement Ant Media Server</h3>
            <div className="space-y-4 text-sm">
              <DeployStep title="1. Préparer le VPS" code="Ubuntu 22.04 LTS, 4 vCPU, 8GB RAM minimum&#10;Ports ouverts : 1935 (RTMP), 5080 (HTTP), 5443 (HTTPS)" />
              <DeployStep title="2. Installer Ant Media Server" code="wget https://raw.githubusercontent.com/ant-media/Scripts/master/install_ant-media-server.sh&#10;sudo bash install_ant-media-server.sh -i latest" />
              <DeployStep title="3. Configurer le resteaming" code="# Dans Ant Media → Applications → LiveApp → Restreaming&#10;# Ajouter les destinations :&#10;# YouTube : rtmp://a.rtmp.youtube.com/live2/YOUR_KEY&#10;# Facebook : rtmps://live-api-s.facebook.com:443/rtmp/YOUR_KEY&#10;# TikTok : rtmp://push.tiktokcdn.com/live/YOUR_KEY&#10;# Odysee : rtmp://live.odysee.com/live/YOUR_KEY" />
              <DeployStep title="4. Configurer les variables Vercel" code="ANT_MEDIA_SERVER_URL=https://ams.mouvementchristlibere.org&#10;LIVEKIT_API_KEY=...&#10;LIVEKIT_API_SECRET=..." />
            </div>
          </div>

          {/* Coûts */}
          <div className="p-6 bg-imperial/5 border border-gold/20 rounded-card">
            <h4 className="font-serif text-base font-semibold text-ink mb-4">Coûts estimés</h4>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <CostItem item="VPS Hetzner CX42 (4 vCPU, 8GB)" cost="15 €/mois" />
              <CostItem item="Bande passante streaming (100h/mois)" cost="20-80 €/mois" />
              <CostItem item="Cloudflare CDN (gratuit jusqu'à usage élevé)" cost="0 €" />
              <CostItem item="Stockage archives (Backblaze B2)" cost="5-15 €/mois" />
              <CostItem item="Domaine + DNS" cost="1 €/mois" />
              <div className="col-span-2 border-t border-stone/15 pt-3 mt-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">Total estimé</span>
                  <span className="font-serif text-lg font-semibold text-gold-dark">~40-110 €/mois</span>
                </div>
              </div>
            </div>
          </div>

          {/* Statut */}
          <div className="mt-8 p-6 bg-state-danger/5 border border-state-danger/20 rounded-card text-center">
            <Server className="w-8 h-8 text-state-danger mx-auto mb-3" />
            <h4 className="font-serif text-lg font-semibold text-ink mb-2">Statut : Architecture spécifiée</h4>
            <p className="text-sm text-stone leading-relaxed">
              L&apos;architecture est complète et documentée. L&apos;implémentation nécessite l&apos;achat
              d&apos;un VPS et l&apos;installation d&apos;Ant Media Server. La page vidéos du site est déjà
              compatible avec l&apos;affichage des streams HLS.
            </p>
          </div>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      <AuroraBackground variant="imperial" intensity="strong" className="py-24 md:py-32">
        <ParticleField count={40} color="#C9A227" size={1.5} speed="slow" />
        <div className="relative">
          <QuoteBlock
            text="Ce qui est reçu du ciel doit être transmis avant que la nuit ne tombe."
            reference="Pam — Mouvement Christ Libère"
            variant="dark"
          />
        </div>
      </AuroraBackground>
    </div>
  );
}

function Platform({ icon: Icon, label, color }: { icon: React.ComponentType<{ className?: string }>; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-ivory border border-stone/20">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className="text-xs font-semibold text-ink">{label}</span>
    </div>
  );
}

function Card({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="card-gold-top p-6">
      <div className="flex items-center justify-center w-12 h-12 rounded-md bg-imperial/10 mb-4">
        <Icon className="w-6 h-6 text-imperial" />
      </div>
      <h3 className="font-serif text-lg font-semibold text-ink mb-2">{title}</h3>
      <p className="text-sm text-ink/70 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ num, title, description }: { num: string; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gold/15 border border-gold/30 flex-shrink-0">
        <span className="text-xs font-semibold text-gold">{num}</span>
      </div>
      <div>
        <h4 className="font-serif text-sm font-semibold text-ink mb-1">{title}</h4>
        <p className="text-sm text-ink/70 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function DeployStep({ title, code }: { title: string; code: string }) {
  return (
    <div>
      <p className="font-semibold text-ink mb-1">{title}</p>
      <pre className="p-3 rounded-md bg-imperial-dark/90 text-ivory text-xs font-mono overflow-x-auto whitespace-pre-wrap">{code}</pre>
    </div>
  );
}

function CostItem({ item, cost }: { item: string; cost: string }) {
  return (
    <div className="flex items-center justify-between border-b border-stone/10 pb-2">
      <span className="text-stone">{item}</span>
      <span className="font-semibold text-ink">{cost}</span>
    </div>
  );
}
