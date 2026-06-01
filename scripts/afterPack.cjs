// electron-builder afterPack hook.
//
// GChat ships without a Developer ID (see electron-builder.yml `identity: null`).
// On Apple Silicon a *completely unsigned* app is rejected by the kernel as
// "'GChat' is damaged and can't be opened." Applying an **ad-hoc** signature
// ("-") gives every nested binary a structurally valid (if untrusted) signature
// so the app launches — users still get the normal "unidentified developer /
// Open Anyway" Gatekeeper prompt, but no longer the dead-end "damaged" error.
//
// IMPORTANT: codesign rejects `com.apple.FinderInfo` / resource-fork xattrs as
// "detritus" and the signature comes out invalid (→ "damaged"). OneDrive and
// Finder inject those attributes, so we strip them with `xattr -cr` right before
// signing. This only sticks if the build output is OUTSIDE a cloud-synced folder
// (the project lives in OneDrive) — the npm `build`/`release` scripts redirect
// `directories.output` to ~/.gchat-build for exactly this reason. `xattr` and
// `codesign` both live in /usr/bin and need no Xcode.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = context.packager.appInfo.productFilename; // "GChat"
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  console.log(`[afterPack] stripping xattrs + ad-hoc signing ${appPath}`);
  execFileSync('xattr', ['-cr', appPath], { stdio: 'inherit' });
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  // Fail loudly if the signature didn't take (e.g. xattrs came back) so a broken
  // build never ships silently.
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' });
};
