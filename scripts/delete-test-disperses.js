require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Coordonnées précises des capitales (extrait de countries.ts)
const COUNTRY_COORDS = {
  BJ: { lat: 6.4969, lng: 2.6289 },
  FR: { lat: 48.8566, lng: 2.3522 },
  CI: { lat: 5.3599, lng: -4.0083 },
  // Ajouter d'autres si besoin
};

async function main() {
  // Récupérer tous les dispersés
  const all = await prisma.disperseMember.findMany();
  console.log('Total dispersés:', all.length);
  all.forEach(m => console.log(`  - ${m.pseudonyme} (${m.pays}, ${m.ville || 'sans ville'}) lat=${m.latitude} lng=${m.longitude}`));

  // Supprimer les tests
  const deleted = await prisma.disperseMember.deleteMany({
    where: {
      OR: [
        { pseudonyme: { startsWith: 'Test' } },
        { pseudonyme: 'TestUser' },
        { pseudonyme: 'TestBrowser' },
      ]
    }
  });
  console.log(`\nSupprimés: ${deleted.count} enregistrements de test`);

  // Mettre à jour les coordonnées des enregistrements restants avec les nouvelles coordonnées précises
  const remaining = await prisma.disperseMember.findMany();
  console.log('\nDispersés restants:', remaining.length);

  for (const m of remaining) {
    const coords = COUNTRY_COORDS[m.pays];
    if (coords) {
      // Arrondir à 0.1° pour anonymat (comme dans l'API)
      const latArrondie = Math.round(coords.lat * 10) / 10;
      const lonArrondie = Math.round(coords.lng * 10) / 10;
      await prisma.disperseMember.update({
        where: { id: m.id },
        data: { latitude: latArrondie, longitude: lonArrondie }
      });
      console.log(`  → Mis à jour: ${m.pseudonyme} (${m.pays}) → lat=${latArrondie}, lng=${lonArrondie}`);
    }
  }

  console.log('\nTerminé !');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
