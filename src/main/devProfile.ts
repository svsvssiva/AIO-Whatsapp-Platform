import { app } from 'electron';

// Imported first from index.ts so it runs before electron-store resolves the
// userData path. Lets a dev copy run against a scratch profile instead of the
// WhatsApp sessions of the installed app — there is no single-instance lock,
// and two copies on the same partitions would log each other out.
const dir = process.env.GCHAT_USER_DATA;
if (dir) {
  app.setPath('userData', dir);
  app.setPath('sessionData', dir);
}
