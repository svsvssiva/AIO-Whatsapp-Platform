// electron-builder afterPack hook.
//
// GChat ships without a Developer ID (see electron-builder.yml `identity: null`).
// On Apple Silicon a *completely unsigned* app is rejected by the kernel as
// "'GChat' is damaged and can't be opened." Applying an **ad-hoc** signature
// ("-") gives every nested binary a structurally valid (if untrusted) signature
// so the app will launch. Users still get the normal Gatekeeper "unidentified
// developer / Open Anyway" prompt — but no longer the dead-end "damaged" error.
//
// `codesign` lives at /usr/bin/codesign and is part of the base macOS install,
// so this needs no Xcode / Command Line Tools.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = context.packager.appInfo.productFilename; // "GChat"
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  console.log(`[afterPack] ad-hoc signing ${appPath}`);
  // --deep signs nested frameworks/helpers inside-out; --force overwrites any
  // stale signatures left by the Electron prebuilt binaries.
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
};
