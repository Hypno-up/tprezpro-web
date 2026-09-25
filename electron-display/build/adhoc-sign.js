// afterPack hook: ad-hoc sign the macOS app ("codesign --sign -").
// Without any signature, Apple Silicon Macs report the downloaded app as "damaged".
// Ad-hoc signed, macOS instead shows "unidentified developer", which users can
// bypass from System Settings > Privacy & Security > "Open Anyway".
// Replace with a Developer ID identity + notarization to remove the warning entirely.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  // A real Developer ID certificate is provided: electron-builder signs properly instead.
  if (process.env.CSC_LINK) return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`  • ad-hoc signing ${appPath}`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' });
};
