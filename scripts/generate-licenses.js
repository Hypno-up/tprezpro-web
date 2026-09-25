#!/usr/bin/env node
/**
 * Generate license codes and push them to Firebase
 *
 * Usage:
 *   node scripts/generate-licenses.js --type day --count 10
 *   node scripts/generate-licenses.js --type multi --count 5
 *
 * Requires FIREBASE_DB_SECRET in the environment (the `/licenses` node is closed
 * to public reads/writes by database.rules.json):
 *   FIREBASE_DB_SECRET=xxxx node scripts/generate-licenses.js --type day --count 10
 *
 * Types:
 *   day   = 24 hours, 1 machine
 *   multi = 72 hours (3 days), 1 machine
 */

const crypto = require('crypto');

const { firebaseRequest } = require('../netlify/lib/firebase-rest');

if (!process.env.FIREBASE_DB_SECRET) {
  console.error('FIREBASE_DB_SECRET manquant (Firebase > Parametres du projet > Comptes de service > Codes secrets de la base de donnees)');
  process.exit(1);
}

const args = process.argv.slice(2);
const typeIdx = args.indexOf('--type');
const countIdx = args.indexOf('--count');

const daysIdx = args.indexOf('--days');
const type = typeIdx >= 0 ? args[typeIdx + 1] : 'day';
const count = countIdx >= 0 ? parseInt(args[countIdx + 1]) : 5;
const customDays = daysIdx >= 0 ? parseInt(args[daysIdx + 1]) : null;

const PLANS = {
  day:    { durationHours: 24,  plan: 'day',    label: '1 jour' },
  '2day': { durationHours: 48,  plan: '2day',   label: '2 jours' },
  multi:  { durationHours: 72,  plan: 'multi',  label: '3 jours' },
  master: { durationHours: 999999, plan: 'master', label: 'Illimite', unlimited: true }
};

// Allow --days N for custom duration
let plan;
if (customDays) {
  plan = { durationHours: customDays * 24, plan: `${customDays}day`, label: `${customDays} jour${customDays > 1 ? 's' : ''}` };
} else {
  plan = PLANS[type];
}

if (!plan) {
  console.error(`Type inconnu: ${type}. Utilisez: day, 2day, multi, master`);
  console.error(`Ou: --days N pour une duree personnalisee (ex: --days 2)`);
  process.exit(1);
}

function generateCode() {
  // Format: TPRO-XXXX-XXXX (easy to type)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = 'TPRO-';
  for (let i = 0; i < 4; i++) code += chars[crypto.randomInt(chars.length)];
  code += '-';
  for (let i = 0; i < 4; i++) code += chars[crypto.randomInt(chars.length)];
  return code;
}

async function main() {
  console.log(`\nGeneration de ${count} codes "${plan.label}" (${plan.durationHours}h)\n`);
  console.log('─'.repeat(50));

  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = generateCode();
    const licenseData = {
      plan: plan.plan,
      durationHours: plan.durationHours,
      createdAt: new Date().toISOString(),
      activatedAt: null,
      machineId: null,
      expired: false,
      ...(plan.unlimited ? { unlimited: true } : {})
    };

    await firebaseRequest(`/licenses/${code}`, 'PUT', licenseData);
    codes.push(code);
    console.log(`  ${code}  (${plan.label})`);
  }

  console.log('─'.repeat(50));
  console.log(`\n${codes.length} codes crees avec succes dans Firebase!\n`);
  console.log('Codes a copier:');
  console.log(codes.join('\n'));
}

main().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});
