import { PageHero } from "@/components/site/page-hero";
import { AuroraBackground } from "@/components/magic/aurora-background";
import { ParticleField } from "@/components/magic/particle-field";
import { QuoteBlock, SectionDivider } from "@/components/premium/section-divider";
import { Radio, Smartphone, Wifi, Shield, Network, Bell, Cpu, GitBranch } from "lucide-react";

export default function ReseauSamuelPage() {
  return (
    <div>
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1518709268805-4e9042af2176?q=80&w=1920&auto=format&fit=crop"
        kicker="Messagerie de secours — Mode mesh offline"
        title="Réseau Samuel"
        subtitle="Samuel, dans la Bible, est celui qui entend l'appel de Dieu et prête sa voix. Le réseau Samuel est un système de messagerie de secours qui fonctionne même sans Internet — via Bluetooth et Wi-Fi Direct, de téléphone à téléphone."
        primaryCta={{ label: "Architecture", href: "#architecture" }}
      />

      {/* Explication */}
      <section className="bg-[#FAF6EF] py-20 md:py-24">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-semibold mb-3">Pourquoi un réseau mesh ?</p>
            <h2 className="font-serif text-3xl md:text-4xl font-semibold text-[#1E0F2B]">
              Quand le réseau tombe, la Parole continue
            </h2>
            <p className="mt-5 text-base text-[#8A8378] leading-relaxed max-w-3xl mx-auto">
              Dans les scénarios de crise — coupure Internet, saisie de serveurs, persécution, catastrophe naturelle —
              le réseau Samuel assure un canal minimal de communication entre les membres de la communauté.
              Les messages se propagent de téléphone à téléphone, sans aucune infrastructure externe.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card icon={Wifi} title="Sans Internet" description="Communication via Bluetooth Low Energy (BLE) et Wi-Fi Direct. Aucun serveur, aucun opérateur requis." />
            <Card icon={Network} title="Topologie mesh" description="Chaque téléphone est un nœud. Les messages sautent de proche en proche jusqu'à leur destinataire ou un nœud connecté." />
            <Card icon={Shield} title="Chiffré E2E" description="Messages chiffrés de bout en bout (Signal Protocol). Même les nœuds intermédiaires ne peuvent pas lire le contenu." />
          </div>

          {/* Architecture */}
          <div id="architecture" className="card-gold-top p-8">
            <h3 className="font-serif text-xl font-semibold text-[#1E0F2B] mb-6 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#C9A227]" />
              Architecture technique
            </h3>

            <div className="space-y-6">
              <Layer
                num="1"
                title="Découverte des pairs (BLE)"
                description="L'application mobile scanne en continu les appareils à proximité via Bluetooth Low Energy. Chaque appareil diffuse un identifiant chiffré (pseudonyme). La découverte est passive — pas de révélation d'identité."
                tech="react-native-ble-plx · Android BLE API · iOS CoreBluetooth"
              />
              <Layer
                num="2"
                title="Propagation des messages (mesh)"
                description="Quand un utilisateur envoie un message, il est transmis à tous les pairs à proximité. Chaque pair le re-transmet à ses propres pairs. Pour éviter les boucles, chaque message porte un ID unique et un TTL (Time To Live) décrémenté à chaque saut."
                tech="Gossip protocol · TTL-based flooding · Message deduplication"
              />
              <Layer
                num="3"
                title="Synchronisation au retour Internet"
                description="Quand un nœud retrouve une connexion Internet, il synchronise les messages mesh avec le serveur central (Matrix). Les messages envoyés en mode mesh sont livrés à leurs destinataires distants, et les nouveaux messages sont téléchargés pour distribution locale."
                tech="Matrix SDK · Background sync · Conflict resolution (CRDT)"
              />
              <Layer
                num="4"
                title="Alertes d'urgence"
                description="Un canal d'urgence prioritaire permet d'envoyer des alertes qui contournent le TTL normal et sont propagées avec la priorité maximale. Utilisé pour : persécution en cours, arrestation, danger de mort, instruction urgente de l'équipe pastorale."
                tech="Priority queue · Push notification (local) · Vibration pattern"
              />
            </div>
          </div>

          {/* Cas d'usage */}
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            <div className="card-gold-top p-6">
              <h4 className="font-serif text-lg font-semibold text-[#1E0F2B] mb-3 flex items-center gap-2">
                <Bell className="w-4 h-4 text-state-danger" />
                Scénario 1 — Coupure Internet
              </h4>
              <p className="text-sm text-[#1E0F2B]/70 leading-relaxed">
                Le gouvernement coupe Internet dans une région. Les membres du réseau Samuel
                continuent de communiquer via mesh. Les instructions de l'équipe pastorale
                (rassemblement, lieu sûr, prière) se propagent de téléphone en téléphone.
              </p>
            </div>
            <div className="card-gold-top p-6">
              <h4 className="font-serif text-lg font-semibold text-[#1E0F2B] mb-3 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#C9A227]" />
                Scénario 2 — Saisie de serveurs
              </h4>
              <p className="text-sm text-[#1E0F2B]/70 leading-relaxed">
                Le serveur central est saisi ou censuré. Les membres continuent de recevoir
                les enseignements et témoignages déjà téléchargés (mode offline), et de
                communiquer via mesh jusqu'à ce qu'un nœud retrouve Internet et synchronise.
              </p>
            </div>
          </div>

          {/* Stack technique */}
          <div className="mt-8 p-6 bg-[#2A0E3D]/5 border border-[#C9A227]/20 rounded-2xl">
            <h4 className="font-serif text-base font-semibold text-[#1E0F2B] mb-4 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#C9A227]" />
              Stack technique recommandée
            </h4>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <TechItem name="React Native + Expo" usage="Application mobile cross-platform" />
              <TechItem name="react-native-ble-plx" usage="Bluetooth Low Energy" />
              <TechItem name="react-native-wifi-direct" usage="Wi-Fi Direct (Android)" />
              <TechItem name="libsignal" usage="Chiffrement E2E (Signal Protocol)" />
              <TechItem name="Matrix SDK" usage="Synchronisation au retour Internet" />
              <TechItem name="AsyncStorage / SQLite" usage="Stockage local des messages" />
            </div>
          </div>

          {/* Statut */}
          <div className="mt-8 p-6 bg-state-danger/5 border border-state-danger/20 rounded-2xl text-center">
            <Radio className="w-8 h-8 text-state-danger mx-auto mb-3" />
            <h4 className="font-serif text-lg font-semibold text-[#1E0F2B] mb-2">Statut : Phase de conception</h4>
            <p className="text-sm text-[#8A8378] leading-relaxed">
              Le réseau Samuel est actuellement en phase de conception architecturelle.
              L'implémentation complète nécessite une application mobile native (React Native)
              et sera développée dans la phase V4 du projet.
            </p>
          </div>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      <AuroraBackground variant="imperial" intensity="strong" className="py-24 md:py-32">
        <ParticleField count={40} color="#C9A227" size={1.5} speed="slow" />
        <div className="relative">
          <QuoteBlock
            text="L'Éternel vint et se présenta, et il appela comme les autres fois : Samuel, Samuel ! Et Samuel répondit : Parle, car ton serviteur écoute."
            reference="1 Samuel 3:10"
            variant="dark"
          />
        </div>
      </AuroraBackground>
    </div>
  );
}

function Card({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="card-gold-top p-6">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#2A0E3D]/10 mb-4">
        <Icon className="w-6 h-6 text-[#2A0E3D]" />
      </div>
      <h3 className="font-serif text-lg font-semibold text-[#1E0F2B] mb-2">{title}</h3>
      <p className="text-sm text-[#1E0F2B]/70 leading-relaxed">{description}</p>
    </div>
  );
}

function Layer({ num, title, description, tech }: { num: string; title: string; description: string; tech: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#C9A227]/15 border-2 border-[#C9A227]/30 flex-shrink-0">
        <span className="font-serif text-base font-semibold text-[#C9A227]">{num}</span>
      </div>
      <div className="flex-1">
        <h4 className="font-serif text-base font-semibold text-[#1E0F2B] mb-1">{title}</h4>
        <p className="text-sm text-[#1E0F2B]/70 leading-relaxed mb-2">{description}</p>
        <p className="text-xs text-[#8A8378] font-mono">{tech}</p>
      </div>
    </div>
  );
}

function TechItem({ name, usage }: { name: string; usage: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="px-2 py-1 rounded bg-[#2A0E3D]/10 text-[#2A0E3D] text-xs font-mono font-semibold">{name}</span>
      <span className="text-xs text-[#8A8378]">{usage}</span>
    </div>
  );
}
