import { PrismaClient } from '@prisma/client';

// ⭐ V3.2 — Nettoyage des artefacts de test (base de production) :
//  - utilisateur de test "test-upload@christ-libere.org" (créé pour valider
//    l'upload d'avatar HEIC/JPEG/PNG + les vues admin/membre),
//  - demande d'intercession de test "Marie Tèst" (créée via le formulaire
//    public pour valider la confidentialité + la page back-office).
// La demande historique "Dawes / Test" (préexistante) est conservée : elle
// est gérable depuis le nouveau back-office /admin/intercession — seul son
// statut est réinitialisé à « ouvert » (il avait été modifié pendant les
// tests de l'action PATCH).

const db = new PrismaClient();

const testUser = await db.user.findUnique({ where: { email: 'test-upload@christ-libere.org' } });
if (testUser) {
  await db.user.delete({ where: { id: testUser.id } });
  console.log('✓ utilisateur de test supprimé');
} else {
  console.log('- utilisateur de test déjà absent');
}

const marie = await db.intercessionRequest.findFirst({ where: { auteur: 'Marie Tèst' } });
if (marie) {
  await db.intercessionRequest.delete({ where: { id: marie.id } });
  console.log('✓ demande de test « Marie Tèst » supprimée');
} else {
  console.log('- demande « Marie Tèst » déjà absente');
}

const dawes = await db.intercessionRequest.findFirst({ where: { auteur: { startsWith: 'Dawes' }, sujet: 'Test' } });
if (dawes && dawes.statut !== 'ouvert') {
  await db.intercessionRequest.update({ where: { id: dawes.id }, data: { statut: 'ouvert' } });
  console.log('✓ statut de la demande préexistante « Dawes / Test » réinitialisé à ouvert');
} else {
  console.log('- demande « Dawes / Test » inchangée (déjà ouvert ou absente)');
}

await db.$disconnect();
console.log('Nettoyage V3.2 terminé.');
