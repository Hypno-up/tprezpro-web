#!/usr/bin/env node
/**
 * Generate license codes and push them to Firebase
 *
 * Usage:
 *   node scripts/generate-licenses.js --type day --count 10
 *   node scripts/generate-licenses.js --type multi --count 5
 *
 * Types:
 *   day   = 24 hours, 1 machine
 *   multi = 72 hours (3 days), 1 machine
 */

const https = require('https');
const crypto = require('crypto');

const FIREBASE_DB_URL = 'https://tprezpro-web-default-rtdb.firebaseio.com';

const args = process.argv.slice(2);
const typeIdx = args.indexOf('--type');
const countIdx = args.indexOf('--count');

const type = typeIdx >= 0 ? args[typeIdx + 1] : 'day';
const count = countIdx >= 0 ? parseInt(args[countIdx + 1]) : 5;

const PLANS = {
  day:   { durationHours: 24,  plan: 'day',   label: '1 jour' },
  multi: { durationHours: 72,  plan: 'multi', label: '3 jours' }
};

const plan = PLANS[type];
if (!plan) {
  console.error(`Type inconnu: ${type}. Utilisez: day, multi`);
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

function firebasePut(path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${FIREBASE_DB_URL}${path}.json`);
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
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
      expired: false
    };

    await firebasePut(`/licenses/${code}`, licenseData);
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
