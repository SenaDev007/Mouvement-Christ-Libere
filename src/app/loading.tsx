/**
 * Loading UI — affiché pendant le streaming server components.
 * Conforme au copywriting : "Un instant..."
 */
export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="relative">
        {/* Anneau or pulsant */}
        <div className="w-16 h-16 rounded-full border-2 border-gold/20" />
        <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-2 border-transparent border-t-gold animate-spin" />
      </div>
      <p className="mt-6 text-sm text-stone italic font-serif">
        Un instant...
      </p>
    </div>
  );
}
