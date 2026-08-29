/**
 * Loading UI pour l'admin — affiché pendant le chargement des Server Components.
 */
export default function AdminLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-2 border-[#C9A227]/20 mx-auto mb-3" />
        <div className="w-12 h-12 rounded-full border-2 border-transparent border-t-[#C9A227] animate-spin -mt-12 mx-auto" />
        <p className="mt-6 text-sm text-[#8A8378] italic">Chargement...</p>
      </div>
    </div>
  );
}
