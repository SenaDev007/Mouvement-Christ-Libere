"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  BookOpen,
  Bell,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LiturgicalEvent {
  id: string;
  name: string;
  nameFr: string;
  nameHe: string | null;
  type: string;
  description: string;
  startDate: string;
  endDate: string | null;
  color: string;
  isShabbat: boolean;
}

interface CalendarViewProps {
  events: LiturgicalEvent[];
}

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const TYPE_LABELS: Record<string, string> = {
  SPRING_FEAST: "Fête de printemps",
  FALL_FEAST: "Fête d'automne",
  SHABBAT: "Shabbat",
  NEW_MOON: "Nouvelle lune",
  OTHER: "Autre fête",
};

export function CalendarView({ events }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<LiturgicalEvent | null>(null);
  const [shabbatRest, setShabbatRest] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calcul des jours du mois
  const daysInMonth = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay(); // 0 = Dimanche
    const totalDays = lastDay.getDate();

    const days: Array<{ date: Date | null; events: LiturgicalEvent[] }> = [];

    // Jours vides avant le début du mois
    for (let i = 0; i < startWeekday; i++) {
      days.push({ date: null, events: [] });
    }

    // Jours du mois
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      const dayEvents = events.filter((e) => {
        const start = new Date(e.startDate);
        const end = e.endDate ? new Date(e.endDate) : start;
        return date >= startAtMidnight(start) && date <= endAtMidnight(end);
      });
      // Vérifier si c'est un shabbat (samedi)
      const isSaturday = date.getDay() === 6;
      if (isSaturday && !dayEvents.some((e) => e.isShabbat)) {
        // Ajouter un marqueur shabbat discret
      }
      days.push({ date, events: dayEvents });
    }

    return days;
  }, [year, month, events]);

  const monthEvents = useMemo(() => {
    return events
      .filter((e) => {
        const start = new Date(e.startDate);
        return start.getMonth() === month && start.getFullYear() === year;
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [events, month, year]);

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const today = new Date();
  const isToday = (date: Date) =>
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Calendrier (2/3) */}
      <div className="lg:col-span-2">
        <div className="bg-ivory border border-stone/20 rounded-card overflow-hidden">
          {/* En-tête navigation mois */}
          <div className="flex items-center justify-between p-5 border-b border-stone/15 bg-imperial text-ivory">
            <button
              onClick={previousMonth}
              className="p-2 rounded hover:bg-imperial-light/40 transition-colors"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h2 className="font-serif text-xl font-semibold">
                {MONTHS_FR[month]} {year}
              </h2>
              <p className="text-[10px] uppercase tracking-[0.18em] text-gold-light/70 font-semibold mt-0.5">
                Calendrier liturgique
              </p>
            </div>
            <button
              onClick={nextMonth}
              className="p-2 rounded hover:bg-imperial-light/40 transition-colors"
              aria-label="Mois suivant"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Jours de la semaine */}
          <div className="grid grid-cols-7 border-b border-stone/15">
            {DAYS_FR.map((day) => (
              <div
                key={day}
                className={cn(
                  "py-2.5 text-center text-[10px] uppercase tracking-[0.18em] font-semibold",
                  day === "Sam" ? "text-imperial bg-imperial/5" : "text-stone"
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grille des jours */}
          <div className="grid grid-cols-7">
            {daysInMonth.map((day, i) => (
              <div
                key={i}
                className={cn(
                  "min-h-[80px] md:min-h-[100px] p-1.5 border-r border-b border-stone/10 last:border-r-0",
                  !day.date && "bg-stone/5",
                  day.date && day.date.getDay() === 6 && "bg-imperial/[0.03]" // shabbat
                )}
              >
                {day.date && (
                  <>
                    <div
                      className={cn(
                        "text-xs font-semibold mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full",
                        isToday(day.date)
                          ? "bg-gold text-ink"
                          : day.date.getDay() === 6
                            ? "text-imperial"
                            : "text-ink"
                      )}
                    >
                      {day.date.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {day.events.slice(0, 2).map((event, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedEvent(event)}
                          className="block w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium hover:opacity-80 transition-opacity truncate"
                          style={{
                            backgroundColor: `${event.color}20`,
                            color: event.color,
                          }}
                        >
                          {event.nameFr}
                        </button>
                      ))}
                      {day.events.length > 2 && (
                        <p className="text-[9px] text-stone px-1.5">
                          +{day.events.length - 2} autres
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Légende */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-stone">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "#C9A227" }} />
            Fête de printemps
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "#8C5FA8" }} />
            Fête d'automne
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "#5B7052" }} />
            Tabernacles
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "#B5502F" }} />
            Expiation
          </span>
        </div>
      </div>

      {/* Sidebar : événements du mois + options */}
      <div className="space-y-6">
        {/* Événements du mois */}
        <div className="bg-ivory border border-stone/20 rounded-card p-5">
          <h3 className="font-serif text-lg font-semibold text-ink mb-4 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-gold" />
            Événements de {MONTHS_FR[month]}
          </h3>
          {monthEvents.length === 0 ? (
            <p className="text-sm text-stone italic">
              Aucune fête biblique ce mois-ci.
            </p>
          ) : (
            <div className="space-y-3">
              {monthEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="block w-full text-left p-3 rounded-card border border-stone/15 hover:border-gold/40 hover:bg-gold/5 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-1 self-stretch rounded-full"
                      style={{ backgroundColor: event.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-serif text-sm font-semibold text-ink">
                        {event.nameFr}
                      </p>
                      {event.nameHe && (
                        <p className="text-xs text-stone font-serif" dir="rtl">
                          {event.nameHe}
                        </p>
                      )}
                      <p className="text-[11px] text-stone mt-1">
                        {new Date(event.startDate).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })}
                        {event.endDate && (
                          <>
                            {" — "}
                            {new Date(event.endDate).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                            })}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Option repos shabbatique */}
        <div className="bg-imperial/5 border border-gold/20 rounded-card p-5">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded bg-imperial/10 flex-shrink-0">
              {shabbatRest ? (
                <Moon className="w-5 h-5 text-imperial" />
              ) : (
                <Sun className="w-5 h-5 text-gold" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-serif text-base font-semibold text-ink mb-1">
                Repos shabbatique
              </h3>
              <p className="text-xs text-stone leading-relaxed mb-3">
                Suspendre les notifications du vendredi soir au samedi soir, pour sanctifier le shabbat.
              </p>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <button
                  onClick={() => setShabbatRest(!shabbatRest)}
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors",
                    shabbatRest ? "bg-gold" : "bg-stone/30"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-ivory transition-transform",
                      shabbatRest && "translate-x-5"
                    )}
                  />
                </button>
                <span className="text-xs font-medium text-ink">
                  {shabbatRest ? "Activé" : "Désactivé"}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Prochaine fête */}
        <UpcomingFeast events={events} />
      </div>

      {/* Modal détail événement */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-imperial-dark/60 backdrop-blur-sm"
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-ivory rounded-card max-w-lg w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* En-tête coloré */}
              <div
                className="p-6 text-ivory relative"
                style={{ backgroundColor: selectedEvent.color }}
              >
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="absolute top-4 right-4 p-1.5 rounded hover:bg-ivory/20 transition-colors"
                  aria-label="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-2 opacity-80">
                  {TYPE_LABELS[selectedEvent.type]}
                </p>
                <h2 className="font-serif text-3xl font-semibold mb-1">
                  {selectedEvent.nameFr}
                </h2>
                <div className="flex items-center gap-3">
                  <p className="text-sm opacity-90">{selectedEvent.name}</p>
                  {selectedEvent.nameHe && (
                    <p className="font-serif text-lg" dir="rtl">
                      {selectedEvent.nameHe}
                    </p>
                  )}
                </div>
              </div>

              {/* Contenu */}
              <div className="p-6 overflow-y-auto">
                <div className="flex items-center gap-2 mb-4 text-sm text-stone">
                  <CalendarIcon className="w-4 h-4 text-gold" />
                  {new Date(selectedEvent.startDate).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  {selectedEvent.endDate && (
                    <>
                      {" — "}
                      {new Date(selectedEvent.endDate).toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </>
                  )}
                </div>

                <p className="text-sm text-ink/80 leading-relaxed mb-6">
                  {selectedEvent.description}
                </p>

                <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gold text-ink text-xs font-semibold hover:bg-gold-light transition-colors">
                  <Bell className="w-3.5 h-3.5" />
                  Activer les rappels pour cette fête
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UpcomingFeast({ events }: { events: LiturgicalEvent[] }) {
  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(e.startDate) >= now)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];

  if (!upcoming) return null;

  const daysUntil = Math.ceil(
    (new Date(upcoming.startDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div
      className="rounded-card p-5 text-ivory relative overflow-hidden"
      style={{ backgroundColor: upcoming.color }}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-ivory/10 blur-2xl rounded-full pointer-events-none" />
      <div className="relative">
        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-2 opacity-80">
          Prochaine fête
        </p>
        <h3 className="font-serif text-2xl font-semibold mb-1">{upcoming.nameFr}</h3>
        <p className="text-sm opacity-90 mb-3">
          dans {daysUntil} {daysUntil === 1 ? "jour" : "jours"}
        </p>
        <p className="text-xs opacity-75">
          {new Date(upcoming.startDate).toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>
    </div>
  );
}

function startAtMidnight(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endAtMidnight(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}
