// afterSign hook: send the signed app to Apple for notarization, then staple the ticket.
// Runs only when the Apple credentials are present (GitHub Actions secrets):
//   APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
// Without them (local builds, or secrets not configured yet) it is skipped and the
// app keeps the ad-hoc signature from adhoc-sign.js.
const path = require('path');
const { notarize } = require('@electron/notarize');

exports.default = async function notarizeApp(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID, CSC_LINK } = process.env;
  if (!CSC_LINK || !APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log('  • notarization skipped (Apple credentials not set)');
    return;
  }
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`  • notarizing ${appPath} (this can take a few minutes)`);
  await notarize({
    tool: 'notarytool',
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID
  });
  console.log('  • notarization successful, ticket stapled');
};
