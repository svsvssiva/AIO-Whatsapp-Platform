# GChat

**Multi-account WhatsApp Web for macOS — with native spell checking, unlimited chat pins, and no cloud services of its own.**

GChat is a native macOS app that lets you run multiple WhatsApp Web sessions side-by-side in a single window. Each account runs in its own isolated Chromium partition, so logging into one doesn't affect another. The real `web.whatsapp.com` is loaded inside each session — no protocol reverse engineering, no ban risk, full feature parity with the official WhatsApp Web (media, voice, video calls, status, reactions, polls).

On top of that:
- **Unlimited chat pins** — WhatsApp caps them at 3.
- **macOS spell checking** in the message box, which WhatsApp Web disables by default.
- **Per-account** avatars, colours, notification prefs, and a unified Dock badge.

> **No AI, no accounts, no telemetry.** GChat has no service of its own. It does not read, scrape, summarise or upload your messages, and it holds no API keys. The app talks to exactly two hosts: WhatsApp (as your browser would) and GitHub (to check for a new version). See [Privacy](#privacy--security).

---

## Install

Download the latest `.dmg` from the [Releases page](https://github.com/svsvssiva/AIO-Whatsapp-Platform/releases/latest):

| Mac type | File |
|---|---|
| Apple Silicon (M1/M2/M3/M4) | `GChat-x.y.z-arm64.dmg` |
| Intel | `GChat-x.y.z-x64.dmg` |

### First-time launch on macOS

The app is **ad-hoc signed** but not notarized (no Apple Developer ID), so Gatekeeper warns on the first launch of each version:

1. Open the `.dmg` → drag **GChat** into Applications.
2. Clear the download quarantine flag:
   ```bash
   xattr -cr /Applications/GChat.app
   ```
   Then open GChat normally.
3. **No Terminal?** Open GChat, click **Done** on the warning, then go to **System Settings → Privacy & Security** → scroll down → click **Open Anyway** next to *"GChat was blocked…"*.
4. Allow microphone + camera when WhatsApp first asks (needed for voice/video calls).

> If you ever see **"GChat is damaged and can't be opened"**, you have a build older than v0.1.4. Download the current release — that error was an unsigned-binary issue on Apple Silicon and is fixed.

---

## Features

### Multi-account
- Add unlimited accounts via the `+` button in the left rail.
- Each account is an isolated Chromium browser profile (own cookies, own IndexedDB, own service workers).
- Switch via tile click, `⌘1` / `⌘2` / `…`, or `⌘K` quick-switcher.
- Background accounts stay live and receive messages even when not visible.
- Native macOS Dock badge aggregates unread counts across all accounts.
- Per-account avatar, color, rename, and notification prefs.

### Chat pins (unlimited)
WhatsApp caps pinned chats at 3. GChat adds its own pin layer on top — hover a chat row, click the pushpin icon, and that chat sticks to the top of the list. Order persists per account.

### Spell checking

WhatsApp Web ships its composer with `spellcheck="false"`, which suppresses macOS spell checking entirely. GChat forces it back on, so you get:

- Red squiggles under misspelled words as you type.
- Right-click a squiggle for **suggestions** and **Learn Spelling**.
- Standard **Undo / Cut / Copy / Paste / Select All** in the same context menu (Electron ships no default menu, so without this right-click did nothing).

On macOS this uses the **system spell checker** (`NSSpellChecker`), so it follows the languages set in System Settings and respects words you've already taught macOS. Nothing is sent anywhere — spell checking is entirely local and works offline.

### Notifications

- Native macOS Notification Center for every WhatsApp message.
- Notifications are prefixed with the account label so you know which one buzzed.
- Click → focuses GChat + jumps to that account.
- Per-account toggles: show / hide preview / silence.

### Updates

GChat checks this repo's Releases hourly and on launch. When a newer version exists, a banner appears at the top: *"Update available — vX.Y.Z"* with a **Download** button that opens the Releases page. You can also check on demand in **Settings → About → Check for updates**.

Updates are **download-and-install-yourself**, not silent auto-install: macOS only permits background self-updates for apps signed with an Apple Developer ID, which this build doesn't have.

---

## Privacy & security

**Everything GChat sends anywhere:**

| Data | Goes where | When |
|---|---|---|
| Your WhatsApp traffic | Meta's servers | Same as using `web.whatsapp.com` in Chrome |
| A version check | This GitHub repo | On launch, then hourly |

That's the complete list. GChat has no backend, no account system, no analytics, and no AI integration — there is no code path that can upload a message. Your conversations, contacts and media never leave the machine except through WhatsApp itself.

- **Spell checking is local** — handled by macOS, no network involved.
- **WhatsApp data** lives in per-account Chromium partitions under `~/Library/Application Support/gchat/Partitions/`. Standard Chromium encryption-at-rest, same as Chrome on macOS.
- **No telemetry**, no usage analytics, no third-party SDKs.
- The build is ad-hoc signed but **not notarized**, so Gatekeeper warns once per version. Proper signing needs an Apple Developer ID ($99/year).

> **Upgrading from an older version?** v0.2.0 removed the AI reply and per-chat memory features; v0.3.0 removed the last one (Rephrase). The app no longer reads or writes any of their data. Leftovers you can safely delete:
> - `~/Library/Application Support/gchat/memory/` — old per-chat notes
> - `~/Library/Application Support/gchat/ai-key.bin` — the encrypted OpenAI key
>
> Old `ai` settings are stripped from the config automatically on first launch.

---

## Build from source

Requirements: Node 18+ and Xcode Command Line Tools.

```bash
git clone https://github.com/svsvssiva/AIO-Whatsapp-Platform.git
cd AIO-Whatsapp-Platform
npm install

# Run in dev (hot reload):
npm run dev

# Typecheck:
npm run typecheck

# Build a .dmg (output goes to ~/.gchat-build/dist/):
npm run build

# Publish a release to GitHub Releases:
GH_TOKEN=github_pat_xxx npm run release
```

**Two build notes worth knowing:**

- **Output goes to `~/.gchat-build/`, not `./dist/`.** This is deliberate. If the working copy lives in a cloud-synced folder (OneDrive, iCloud Drive, Dropbox), the sync daemon continuously writes `com.apple.FinderInfo` extended attributes into the packaged app. `codesign` rejects those as "detritus", producing an invalid signature and a *"GChat is damaged"* error on Apple Silicon. Signing outside the synced folder is the fix.
- **The GH token needs `Contents: Read and write`** (fine-grained PAT) or the `public_repo` scope (classic). A token can read the repo fine and still 403 on release creation — check the `x-accepted-github-permissions` response header if publishing fails.

`scripts/afterPack.cjs` strips extended attributes, ad-hoc signs the app, and then verifies the signature — the build fails rather than shipping a broken one.

---

## Architecture

- **Electron 33** wraps Chromium + Node into a native macOS app.
- **React 18 + TypeScript + Vite** for the shell UI.
- Each account = an Electron `<webview>` with `partition="persist:wa-<accountId>"`. Chromium isolates everything per partition: cookies, IndexedDB, localStorage, service workers, cache.
- **In-page UI** (chat pins, forced spellcheck) is injected into `web.whatsapp.com` as a main-world script from `wa-tweaks.ts`.
- **Spell check** is enabled per session in `partitions.ts`; the context menu with suggestions is built in `main/index.ts` on the webview's `context-menu` event.
- **Custom protocol** `gchat-avatar://` serves per-account avatar images without exposing the file system to the renderer.

```
src/
├── main/                  Electron main process
│   ├── notifications.ts   Native notification labeling
│   ├── partitions.ts      Per-account sessions + spell checker
│   ├── wa-tweaks.ts       Injected scripts (chat pins, spellcheck)
│   └── updater.ts         electron-updater wiring
├── preload/               contextBridge APIs
│   ├── shell.ts           Main shell window APIs
│   └── webview-wa.ts      Per-webview helpers (unread detection)
├── renderer/              React UI
│   └── components/        AccountRail, WebviewHost, SettingsPanel, UpdateBanner, …
└── shared/                Types + IPC channel constants
```

---

## Known limits

- **WhatsApp's 4-device-per-number cap** is a WhatsApp rule, not ours. One phone number can be linked to at most 4 GChat tiles at once. To have more accounts, use more phone numbers.
- **WhatsApp Web UI changes** can break the DOM integrations (unread badge detection, chat-pin overlay, the forced `spellcheck` attribute). All selectors live in `src/main/wa-tweaks.ts` and `src/preload/webview-wa.ts` for fast patching. Use **View → Inspect Active Account** in the app menu to debug live.
- **Gatekeeper prompt** on first launch of each version, because the build isn't notarized.
- **macOS only** for now. Electron can target Windows and Linux, but the build config is Mac-only and the design tokens are macOS-native.
- **WhatsApp Web's own constraints apply** — same connectivity issues, same disk-cache growth, same occasional "device logged out" prompts as using web.whatsapp.com in Chrome.

---

## Roadmap (maybe)

- Custom app icon (currently the default Electron icon)
- Apple Developer ID signing + notarization, which would enable silent auto-updates
- Anthropic / Gemini / local Ollama support behind the existing provider interface
- Windows + Linux builds

---

## License

Internal use only. No license granted for redistribution. Source is public for transparency and contributor convenience.
