// =========================================================
//  JP-LOTTERY — scripts/validate-winners.js
//  Tourne sur GitHub Actions (gratuit, zéro carte bancaire)
//
//  DÉCLENCHEURS (voir .github/workflows/validate-winners.yml):
//    - Cron toutes les heures
//    - Cron ciblé aux heures de tirage (17h-21h UTC)
//    - Manuel depuis l'onglet Actions GitHub
//    - Sur push (pour tests)
//
//  FONCTIONNEMENT:
//    1. Lit tous les résultats Firestore où processed=false
//    2. Pour chaque résultat, lit les tickets pending du même jeu
//    3. Compare les numéros selon le type de pari
//    4. Gagnants : status=win + crédit Compte Gains + transaction
//    5. Perdants : status=lose
//    6. Marque result.processed=true
//
//  Le joueur voit le résultat en temps réel via onSnapshot dans app.js
// =========================================================

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Credentials depuis GitHub Secrets (jamais en clair dans le code)
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
  console.error('❌ Variables manquantes. Ajoutez dans GitHub Secrets:');
  console.error('   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
  process.exit(1);
}

initializeApp({
  credential: cert({
    projectId:   process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  }),
});

const db = getFirestore();

// =========================================================
//  POINT D'ENTRÉE
// =========================================================
async function main() {
  const heure = new Date().toLocaleString('fr-FR', {
    timeZone: 'Africa/Lome',
    weekday: 'long', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit'
  });
  console.log('🏆 JP-Lottery — Validation des gagnants');
  console.log('📅 ' + heure + ' (heure Lomé)\n');

  // Si un resultId est passé en argument (déclenché manuellement)
  const specificId = process.env.RESULT_ID || '';

  if (specificId) {
    console.log('🎯 Vérification du résultat spécifique : ' + specificId);
    const snap = await db.collection('results').doc(specificId).get();
    if (!snap.exists) {
      console.error('❌ Résultat introuvable.');
      process.exit(1);
    }
    await processResult(snap.data(), snap.id);
  } else {
    await processAllPending();
  }

  console.log('\n✅ Validation terminée avec succès.');
  process.exit(0);
}

// =========================================================
//  TRAITER TOUS LES RÉSULTATS NON TRAITÉS
// =========================================================
async function processAllPending() {
  const snap = await db.collection('results')
    .where('processed', '==', false)
    .orderBy('drawnAt', 'desc')
    .limit(50)
    .get();

  if (snap.empty) {
    console.log('ℹ️  Aucun résultat en attente de traitement.');
    return;
  }

  console.log(`📋 ${snap.size} résultat(s) à traiter...\n`);

  let totalWins = 0;
  let totalPaid = 0;

  for (const doc of snap.docs) {
    const { wins, paid } = await processResult(doc.data(), doc.id);
    totalWins += wins;
    totalPaid += paid;
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RÉSUMÉ GLOBAL');
  console.log('   Gagnants crédités : ' + totalWins);
  console.log('   Total distribué   : ' + totalPaid.toLocaleString('fr-FR') + ' XOF');
  console.log('='.repeat(50));
}

// =========================================================
//  TRAITER UN RÉSULTAT
// =========================================================
async function processResult(result, resultId) {
  const { lotId, numbers, bonus, name, drawLabel } = result;

  console.log(`\n🎲 ${name || lotId} — ${drawLabel || resultId}`);
  console.log(`   Numéros tirés : [${(numbers||[]).join(', ')}]${bonus != null ? ' + Bonus: ' + bonus : ''}`);

  if (!lotId || !numbers?.length) {
    console.warn('   ⚠️  Données incomplètes, ignoré.');
    await db.collection('results').doc(resultId).update({
      processed: true,
      processedAt: FieldValue.serverTimestamp(),
      processNote: 'Ignoré: données incomplètes',
      ticketCount: 0, winCount: 0, totalPaid: 0,
    });
    return { wins: 0, paid: 0 };
  }

  // Tickets en attente pour ce jeu
  const ticketsSnap = await db.collection('tickets')
    .where('lotId',  '==', lotId)
    .where('status', '==', 'pending')
    .get();

  if (ticketsSnap.empty) {
    console.log('   ℹ️  Aucun ticket en attente pour ce jeu.');
    await db.collection('results').doc(resultId).update({
      processed: true,
      processedAt: FieldValue.serverTimestamp(),
      ticketCount: 0, winCount: 0, totalPaid: 0,
    });
    return { wins: 0, paid: 0 };
  }

  console.log(`   🎟  ${ticketsSnap.size} ticket(s) à vérifier...`);

  let winCount  = 0;
  let totalPaid = 0;
  const creditMap = {}; // uid → montant total à créditer

  // Traitement par lots (limite batch Firestore = 500 ops)
  const BATCH_SIZE = 400;
  const allDocs = ticketsSnap.docs;

  for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
    const chunk = allDocs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const ticketDoc of chunk) {
      const ticket = ticketDoc.data();
      const isWin  = checkWin(ticket.nums, ticket.typeKey, numbers, bonus);

      if (isWin) {
        const prize = ticket.pot || 0;
        winCount++;
        totalPaid += prize;

        batch.update(ticketDoc.ref, {
          status:       'win',
          resolvedAt:   FieldValue.serverTimestamp(),
          resultId,
          winNumbers:   numbers,
          winBonus:     bonus ?? null,
          prizeAwarded: prize,
        });

        // Transaction gain
        const transRef = db.collection('transactions').doc();
        batch.set(transRef, {
          uid:       ticket.uid,
          ty:        'win',
          ic:        '🏆',
          n:         'Gain ' + (ticket.type||'') + ' – ' + (ticket.flag||'') + ' ' + (ticket.country||''),
          amt:       prize,
          wlt:       'Compte Gains',
          ticketId:  ticketDoc.id,
          resultId,
          createdAt: FieldValue.serverTimestamp(),
        });

        creditMap[ticket.uid] = (creditMap[ticket.uid] || 0) + prize;
        console.log(`   ✅ ${ticketDoc.id.slice(-8)} → GAGNANT ${prize.toLocaleString('fr-FR')} XOF (${ticket.type})`);
      } else {
        batch.update(ticketDoc.ref, {
          status:     'lose',
          resolvedAt: FieldValue.serverTimestamp(),
          resultId,
          winNumbers: numbers,
          winBonus:   bonus ?? null,
        });
        console.log(`   ❌ ${ticketDoc.id.slice(-8)} → Perdant (${ticket.type})`);
      }
    }

    await batch.commit();
    console.log(`   💾 Lot ${Math.floor(i/BATCH_SIZE)+1} sauvegardé (${chunk.length} tickets)`);
  }

  // Créditer les Comptes Gains — fait après le batch pour éviter les conflits
  if (Object.keys(creditMap).length > 0) {
    console.log('\n   💰 Crédit des gains :');
    await Promise.all(Object.entries(creditMap).map(async ([uid, amount]) => {
      await db.doc('users/' + uid).update({ gains: FieldValue.increment(amount) });
      console.log(`      uid …${uid.slice(-8)} → +${amount.toLocaleString('fr-FR')} XOF`);
    }));
  }

  // Marquer le résultat comme traité
  await db.doc('results/' + resultId).update({
    processed:   true,
    processedAt: FieldValue.serverTimestamp(),
    ticketCount: ticketsSnap.size,
    winCount,
    totalPaid,
  });

  console.log(`\n   📊 Bilan : ${winCount}/${ticketsSnap.size} gagnant(s) — ${totalPaid.toLocaleString('fr-FR')} XOF distribués`);
  return { wins: winCount, paid: totalPaid };
}

// =========================================================
//  LOGIQUE DE VÉRIFICATION DES NUMÉROS
//  Simple (s)    : 1 numéro parmi les 5 tirés   → ×70
//  Double (d)    : 2 numéros parmi les 5 tirés   → ×700
//  Triple (t)    : 3 numéros parmi les 5 tirés   → ×5 000
//  Quadruple (q) : 4 numéros parmi les 5 tirés   → ×50 000
//  Quinte (5)    : 5 numéros exacts (même ordre)  → ×1 000 000
// =========================================================
function checkWin(playerNums, typeKey, drawnNums, bonus) {
  if (!playerNums?.length || !drawnNums?.length) return false;

  const drawnSet   = new Set(drawnNums);
  const matchCount = playerNums.filter(n => drawnSet.has(n)).length;
  const required   = { s:1, d:2, t:3, q:4, '5':5 };
  const needed     = required[typeKey];
  if (!needed) return false;

  if (typeKey === '5') {
    // Quinte : les 5 numéros exacts dans l'ordre croissant
    const sp = [...playerNums].sort((a,b) => a-b);
    const sd = [...drawnNums].sort((a,b) => a-b);
    return sp.length === sd.length && sp.every((n, i) => n === sd[i]);
  }

  return matchCount >= needed;
}

// Lancement
main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
