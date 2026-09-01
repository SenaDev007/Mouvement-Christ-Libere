/**
 * Son du shofar — VRAI média + repli synthétisé.
 *
 * ⭐ V3.9 : la sonnerie utilise désormais les 30 PREMIÈRES SECONDES du
 * fichier réel fourni par le pasteur (`public/sounds/…LE SON DU SHOFAR
 * (TROMPETTE).mp3`, 2 min 06 — copie URL-safe tronquée à 30 s dans
 * `public/sounds/shofar.mp3`). Ce son retentit :
 *   · au chargement du landing page (intro de 30 s — LandingIntro) ;
 *   · à chaque entrée du Shabbat / de chaque solennité, au coucher du
 *     soleil (ShofarNotifier → jouerAnnonceShofar).
 *
 * Repli : si le média est indisponible, la synthèse Web Audio d'origine
 * (oscillateurs dents-de-scie + quinte, vibrato de cuivre, filtre formant,
 * souffle d'attaque, saturation douce) prend le relais.
 *
 * Séquences traditionnelles (repli) :
 * - Tekiah        : une note tenue, franche
 * - Shevarim      : trois sons brisés (moyens)
 * - Teruah        : neuf sons très brefs (alarme)
 * - Tekiah Gedolah: la grande tekiah, tenue, crescendo
 *   Annonce complète : Tekiah — Shevarim — Teruah — Tekiah Gedolah (~15 s)
 *
 * ⚠️ Contexte audio : les navigateurs exigent un geste utilisateur avant
 * toute émission. `armerAudioShofar()` doit être appelé sur le premier
 * pointerdown (ShofarNotifier s'en charge) — il précharge aussi le média.
 */

// ═══ Son RÉEL : les 30 premières secondes du fichier du pasteur ═════════

const FICHIER_SHOFAR = "/sounds/shofar.mp3";
const DUREE_LECTURE = 30; // secondes — le média fait exactement 30 s
const VOLUME_SHOFAR = 0.9;
const FONDU_FINAL = 1.2; // secondes de fondu de fermeture gracieux

let instanceAudio: HTMLAudioElement | null = null;
let minuteurArret: ReturnType<typeof setTimeout> | null = null;
let intervalFondu: ReturnType<typeof setInterval> | null = null;

/** Crée (une fois) et retourne l'élément audio du shofar réel. */
function obtenirInstanceAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  try {
    if (!instanceAudio) {
      instanceAudio = new Audio(FICHIER_SHOFAR);
      instanceAudio.preload = "auto";
    }
    return instanceAudio;
  } catch {
    return null;
  }
}

/** Stoppe la lecture du fichier + nettoie les minuteurs de fondu. */
function arreterLectureFichier(): void {
  if (minuteurArret) {
    clearTimeout(minuteurArret);
    minuteurArret = null;
  }
  if (intervalFondu) {
    clearInterval(intervalFondu);
    intervalFondu = null;
  }
  const a = instanceAudio;
  if (a) {
    a.onended = null;
    a.pause();
    a.volume = VOLUME_SHOFAR;
  }
}

/** Plafonne la lecture à 30 s avec un fondu final gracieux. */
function fonduFinalEtArret(a: HTMLAudioElement): void {
  a.onended = () => arreterLectureFichier();
  minuteurArret = setTimeout(
    () => {
      intervalFondu = setInterval(() => {
        const restant = DUREE_LECTURE - a.currentTime;
        if (restant <= 0) {
          arreterLectureFichier();
          return;
        }
        a.volume = Math.max(0, Math.min(1, restant / FONDU_FINAL)) * VOLUME_SHOFAR;
      }, 100);
    },
    Math.max(0, (DUREE_LECTURE - FONDU_FINAL - 0.1) * 1000),
  );
}

// ═══ Synthèse Web Audio (repli si le média échoue) ═════════════════════

let contexte: AudioContext | null = null;
let sortieMaitre: GainNode | null = null;

interface AudioContextCtor {
  new (options?: { latencyHint?: string }): AudioContext;
}

function obtenirContexte(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    if (!contexte) {
      contexte = new Ctor({ latencyHint: "playback" });
      sortieMaitre = contexte.createGain();
      sortieMaitre.gain.value = 0.55; // volume raisonnable
      sortieMaitre.connect(contexte.destination);
    }
    if (contexte.state === "suspended") {
      void contexte.resume().catch(() => {
        /* pas de geste utilisateur : la sonnerie suivante retentera */
      });
    }
    return contexte;
  } catch {
    return null;
  }
}

/**
 * À appeler sur le premier geste utilisateur : précharge le média réel
 * et déverrouille l'audio (lecture-then-pause muette, dans le geste).
 */
export function armerAudioShofar(): void {
  obtenirContexte(); // pour le repli synthèse
  const a = obtenirInstanceAudio();
  if (!a) return;
  const volumeInitial = a.volume;
  a.volume = 0; // déverrouillage inaudible
  a.play()
    .then(() => {
      a.pause();
      try {
        a.currentTime = 0;
      } catch {
        /* média en cours de chargement */
      }
      a.volume = volumeInitial;
    })
    .catch(() => {
      a.volume = volumeInitial; // bloqué : la sonnerie retentera
    });
}

/** État binaire : contexte créé et actif ? */
export function audioShofarArme(): boolean {
  return contexte !== null && contexte.state === "running";
}

/** Courbe de saturation douce (caractère cuivre, sans casse numérique). */
function courbeSaturation(): Float32Array<ArrayBuffer> {
  const n = 1024;
  const courbe = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1; // -1 … 1
    courbe[i] = Math.tanh(x * 1.8) * 0.9;
  }
  return courbe;
}

/** Buffer de bruit blanc réutilisable (souffle d'attaque). */
let bufferBruit: AudioBuffer | null = null;
function obtenirBruit(ctx: AudioContext): AudioBuffer {
  if (bufferBruit && bufferBruit.sampleRate === ctx.sampleRate) return bufferBruit;
  const duree = 0.25;
  bufferBruit = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duree), ctx.sampleRate);
  const donnees = bufferBruit.getChannelData(0);
  for (let i = 0; i < donnees.length; i++) donnees[i] = Math.random() * 2 - 1;
  return bufferBruit;
}

/**
 * Une note de shofar.
 *
 * @param depart    instant de départ (secondes, horloge du contexte)
 * @param duree     durée tenue (secondes)
 * @param freqBase  fréquence fondamentale (Hz) — registre d'un shofar
 * @param volume    0 … 1.2
 */
function noteShofar(depart: number, duree: number, freqBase: number, volume: number): void {
  const ctx = contexte;
  const maitre = sortieMaitre;
  if (!ctx || !maitre) return;

  const instantFin = depart + duree;

  // ── Enveloppe globale (gain) ──────────────────────────────────────────
  const enveloppe = ctx.createGain();
  enveloppe.connect(maitre);
  const penteAttaque = 0.07;
  const penteFin = Math.min(0.28, duree * 0.25);
  enveloppe.gain.setValueAtTime(0.0001, depart);
  enveloppe.gain.exponentialRampToValueAtTime(Math.max(volume, 0.001), depart + penteAttaque);
  enveloppe.gain.setValueAtTime(Math.max(volume, 0.001), instantFin - penteFin);
  enveloppe.gain.exponentialRampToValueAtTime(0.0001, instantFin);

  // ── Saturation cuivre ────────────────────────────────────────────────
  const saturateur = ctx.createWaveShaper();
  saturateur.curve = courbeSaturation();
  saturateur.oversample = "2x";
  saturateur.connect(enveloppe);

  // ── Filtre formant (la colonne d'air de la corne s'ouvre puis se ferme) ─
  const formant = ctx.createBiquadFilter();
  formant.type = "lowpass";
  formant.Q.value = 5.5;
  const ouverture = depart + duree * 0.18;
  formant.frequency.setValueAtTime(freqBase * 3.4, depart);
  formant.frequency.linearRampToValueAtTime(freqBase * 8.2, ouverture);
  formant.frequency.linearRampToValueAtTime(freqBase * 4.0, instantFin);
  formant.connect(saturateur);

  // ── Vibrato de cuivre (oscillation de l'embouchure) ──────────────────
  const vibrato = ctx.createOscillator();
  vibrato.type = "sine";
  vibrato.frequency.value = 5.4;
  const profondeurVibrato = ctx.createGain();
  profondeurVibrato.gain.value = freqBase * 0.02; // ~ ±2 % de la fondamentale
  vibrato.connect(profondeurVibrato);

  // ── Oscillateurs (fondamental + quinte + octave faible) ──────────────
  const gainOsc = ctx.createGain();
  gainOsc.gain.value = 0.85;
  gainOsc.connect(formant);

  const fondamental = ctx.createOscillator();
  fondamental.type = "sawtooth";
  fondamental.frequency.value = freqBase;
  profondeurVibrato.connect(fondamental.frequency);
  fondamental.connect(gainOsc);

  const quinte = ctx.createOscillator();
  quinte.type = "sawtooth";
  quinte.frequency.value = freqBase * 1.5;
  quinte.detune.value = 6;
  profondeurVibrato.connect(quinte.frequency);
  const gainQuinte = ctx.createGain();
  gainQuinte.gain.value = 0.22;
  quinte.connect(gainQuinte);
  gainQuinte.connect(formant);

  const octSuperieur = ctx.createOscillator();
  octSuperieur.type = "triangle";
  octSuperieur.frequency.value = freqBase * 2;
  const gainOct = ctx.createGain();
  gainOct.gain.value = 0.12;
  octSuperieur.connect(gainOct);
  gainOct.connect(formant);

  // ── Souffle d'attaque (bruit band-pass bref) ─────────────────────────
  const souffle = ctx.createBufferSource();
  souffle.buffer = obtenirBruit(ctx);
  const filtreSouffle = ctx.createBiquadFilter();
  filtreSouffle.type = "bandpass";
  filtreSouffle.frequency.value = freqBase * 5;
  filtreSouffle.Q.value = 1.4;
  const gainSouffle = ctx.createGain();
  gainSouffle.gain.setValueAtTime(0.16 * volume, depart);
  gainSouffle.gain.exponentialRampToValueAtTime(0.0005, depart + 0.16);
  souffle.connect(filtreSouffle);
  filtreSouffle.connect(gainSouffle);
  gainSouffle.connect(enveloppe);

  // ── Départs / arrêts ─────────────────────────────────────────────────
  fondamental.start(depart);
  quinte.start(depart);
  octSuperieur.start(depart);
  vibrato.start(depart);
  souffle.start(depart);
  fondamental.stop(instantFin + 0.05);
  quinte.stop(instantFin + 0.05);
  octSuperieur.stop(instantFin + 0.05);
  vibrato.stop(instantFin + 0.05);
  souffle.stop(depart + 0.3);
}

/**
 * Joue l'ANNONCE — ce qui retentit au coucher du soleil à l'entrée du
 * Shabbat et de chaque solennité (et pendant l'intro du landing page) :
 * les 30 premières secondes du VRAI shofar (fichier du pasteur), avec
 * fondu de fermeture ; repli sur la synthèse Web Audio si le média est
 * indisponible ou bloqué.
 *
 * @returns true si l'audio a pu être émis, sinon false.
 */
export function jouerAnnonceShofar(): boolean {
  const a = obtenirInstanceAudio();
  if (a && !a.error) {
    arreterLectureFichier();
    try {
      a.currentTime = 0;
    } catch {
      /* média pas encore chargé */
    }
    a.volume = VOLUME_SHOFAR;
    const tentative = a.play();
    tentative
      .then(() => fonduFinalEtArret(a))
      .catch(() => {
        // lecture bloquée (pas de geste) → repli synthèse (muet lui aussi
        // sans geste, mais la bannière/systeme notification reste active)
        void jouerAnnonceSynthese();
      });
    return true;
  }
  return jouerAnnonceSynthese();
}

/**
 * Repli synthétisé — l'annonce complète d'origine :
 * Tekiah, Shevarim (×3 sons), Teruah (×9 sons), Tekiah Gedolah.
 */
function jouerAnnonceSynthese(): boolean {
  const ctx = obtenirContexte();
  if (!ctx) return false;

  const FREQ = 214; // Si bémol 3 — registre médian d'un shofar de bélier
  let t = ctx.currentTime + 0.08;

  // Tekiah — note franche
  noteShofar(t, 2.4, FREQ, 0.95);
  t += 2.4 + 0.5;

  // Shevarim — trois sons brisés
  for (let i = 0; i < 3; i++) {
    noteShofar(t, 0.95, FREQ * 0.985, 0.8);
    t += 0.95 + 0.32;
  }
  t += 0.35;

  // Teruah — neuf appels brefs
  for (let i = 0; i < 9; i++) {
    noteShofar(t, 0.26, FREQ * 1.02, 0.85);
    t += 0.26 + 0.13;
  }
  t += 0.45;

  // Tekiah Gedolah — la grande tenue, crescendo
  noteShofar(t, 4.2, FREQ, 1.05);

  return true;
}

/**
 * Tekiah simple (~2,4 s) — pour un test rapide.
 */
export function testerTekiah(): boolean {
  const ctx = obtenirContexte();
  if (!ctx) return false;
  noteShofar(ctx.currentTime + 0.05, 2.2, 214, 0.95);
  return true;
}
