# GChat

**Multi-account WhatsApp Web for macOS — with built-in AI replies, per-chat memory, credential redaction, and auto-update.**

GChat is a native macOS app that lets you run multiple WhatsApp Web sessions side-by-side in a single window. Each account runs in its own isolated Chromium partition, so logging into one doesn't affect another. The real `web.whatsapp.com` is loaded inside each session — no protocol reverse engineering, no ban risk, full feature parity with the official WhatsApp Web (media, voice, video calls, status, reactions, polls).

Optional add-ons:
- **AI reply** — generate context-aware drafts using your own OpenAI API key. Reads the conversation, your global "About Me" profile, and per-chat memory before drafting.
- **Per-chat memory** — markdown notes file per `(account, chat)` that the AI uses as ground truth. Editable in any text editor.
- **Credential redaction** — common API keys, OTPs, tokens, and passwords are stripped before anything is sent to OpenAI.
- **Preview before send** — every AI generation shows the exact text being sent, with redactions highlighted, before it leaves your Mac.
- **Per-chat AI lockout** — toggle a shield icon to disable AI for sensitive chats entirely.
- **Auto-update** — new versions install automatically from this repo's Releases.

---

## Install

Download the latest `.dmg` from the [Releases page](https://github.com/svsvssiva/AIO-Whatsapp-Platform/releases/latest):

| Mac type | File |
|---|---|
| Apple Silicon (M1/M2/M3/M4) | `GChat-x.y.z-arm64.dmg` |
| Intel | `GChat-x.y.z-x64.dmg` |

### First-time launch on macOS

The app is **unsigned** (we don't pay for an Apple Developer ID), so Gatekeeper will warn on the first launch only:

1. Open the `.dmg` → drag **GChat** into Applications.
2. Open Applications → GChat. macOS will say *"GChat cannot be opened because it is from an unidentified developer."* Click **Cancel**.
3. **System Settings → Privacy & Security** → scroll down → next to *"GChat was blocked …"* click **Open Anyway**.
   *Or* in Finder, right-click GChat → **Open** → **Open** in the confirmation dialog.
4. Allow microphone + camera when WhatsApp first asks (needed for voice/video calls).

After the first launch, GChat opens normally. Updates install themselves — no need to repeat this dance every time.

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

### AI reply (BYOK — bring your own OpenAI key)

Set up once in **Settings → AI**:
- Paste your OpenAI API key (encrypted via macOS Keychain via Electron's `safeStorage`).
- Fill in **About Me** — a global profile the AI uses in every chat ("I'm Alex, Account Manager at Acme Corp. I sign off as 'Cheers, Alex'.").
- Pick model (`gpt-4o-mini` default — cheap), tone (8 presets + custom), length, language.

Then in any chat:
- Click the floating **sparkle pill** at the bottom-right (or press `⌘⇧R`).
- A **preview panel** appears showing the exact text being sent to OpenAI, with auto-redacted credentials highlighted in amber.
- Review, edit, tick the confirmation checkbox, click **Send to OpenAI**.
- Reply appears in 1–3 seconds. Click **Insert** to type it into WhatsApp's compose box (you press Enter yourself to actually send).

### Per-chat memory

Click the notebook icon in WhatsApp's chat header → memory drawer opens for that chat.
- Free-form markdown file per chat at `~/Library/Application Support/gchat/memory/<accountId>/<chatTitle>.md`.
- AI reads it as ground truth before every reply ("Sarah is the Project Director. The agreed deadline was 30 May.").
- **AI Sync** button runs a separate OpenAI call that summarizes new durable facts from the conversation and appends them to the notes.
- Editable inside GChat (Cmd-S to save) or in any external editor.
- **Settings → Memory** lists every memory across all accounts; search, edit, reveal in Finder.

### Credential redaction

Every message scraped from WhatsApp is run through a pattern filter before being sent to OpenAI. Default-on categories:

- API keys (`sk-…`, `AKIA…`, `ghp_…`, JWT, etc.)
- Tokens & passwords (`password:`, `Bearer …`, `token:`)
- OTP / verification codes
- Credit cards (Luhn-checked)
- Bank IBANs

Default-off but available: emails, phone numbers, any 10+ digit number. Plus a custom-regex list for things like internal project codenames.

If a message slips through the auto-redactor (e.g. you wrote *"alex, asdf@1231"* with no keyword), the **preview panel** still shows you the message before send — click Edit, redact manually, then confirm.

### Per-chat AI lockout

A shield icon in WhatsApp's chat header toggles AI for that specific chat. When locked, the sparkle pill returns an error instead of generating. Useful for chats with banks, IT support, family, or anywhere credentials are routinely shared.

### Notifications

- Native macOS Notification Center for every WhatsApp message.
- Notifications are prefixed with the account label so you know which one buzzed.
- Click → focuses GChat + jumps to that account.
- Per-account toggles: show / hide preview / silence.

### Auto-update

GChat polls this repo's Releases page hourly. When a new version is published, the app downloads it in the background and shows a green banner at the top: *"Update vX.Y.Z ready — Restart & Install."* If you ignore it, the update installs on next quit.

---

## Privacy & security

- **API key** is stored encrypted via Electron's `safeStorage` (macOS Keychain). Never reaches the renderer or webview. All OpenAI calls happen in the main process.
- **WhatsApp data** lives in per-account Chromium partitions under `~/Library/Application Support/gchat/Partitions/`. Standard Chromium encryption-at-rest, same as Chrome on macOS.
- **Memory files** are plaintext markdown so you can edit externally. If sensitive, rely on macOS FileVault (system-level disk encryption).
- **Nothing leaves your Mac** except:
  - The OpenAI API call when you tap the sparkle pill (after preview confirmation).
  - The WhatsApp Web connection to Meta's servers (same as using `web.whatsapp.com` in Chrome).
  - The update manifest poll to this GitHub repo.
- **No telemetry**, no usage analytics, no third-party SDKs.
- The .dmg is unsigned. Gatekeeper warns once per version. If you want signed builds, you'd need an Apple Developer ID ($99/year) and we'd add it to the build config.

---

## Build from source

Requirements: Node 18+ and Xcode Command Line Tools (for native modules).

```bash
git clone https://github.com/svsvssiva/AIO-Whatsapp-Platform.git
cd AIO-Whatsapp-Platform
npm install

# Run in dev (hot reload):
npm run dev

# Build unsigned .dmg into ./dist/ :
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build

# Publish a new release to GitHub Releases (requires GH_TOKEN with repo scope):
export GH_TOKEN=ghp_xxx
CSC_IDENTITY_AUTO_DISCOVERY=false npm run release
```

---

## Architecture

- **Electron 33** wraps Chromium + Node into a native macOS app.
- **React 18 + TypeScript + Vite** for the shell UI.
- Each account = an Electron `<webview>` with `partition="persist:wa-<accountId>"`. Chromium isolates everything per partition: cookies, IndexedDB, localStorage, service workers, cache.
- **AI flow:** scrape current chat via `executeJavaScript` in the active webview → redact → assemble OpenAI message array → call API in main process → return text to renderer for preview/insert.
- **Custom protocol** `gchat-avatar://` for serving per-account avatar images without exposing the file system to the renderer.
- **Memory files** are plain `.md` written to `userData/memory/<accountId>/<safe-filename>.md`.

```
src/
├── main/                  Electron main process
│   ├── ai/                OpenAI provider, prompts, sync, redact, prepare
│   ├── memory/            Per-chat markdown file CRUD
│   ├── notifications.ts   Native notification labeling
│   ├── wa-tweaks.ts       Injected scripts into web.whatsapp.com (chat pins, header icons)
│   └── updater.ts         electron-updater wiring
├── preload/               contextBridge APIs
│   ├── shell.ts           Main shell window APIs
│   └── webview-wa.ts      Per-webview helpers (unread detection, notification click bridge)
├── renderer/              React UI
│   └── components/        AccountRail, WebviewHost, AiReply, MemoryDrawer, SettingsPanel, …
└── shared/                Types + IPC channel constants
```

---

## Known limits

- **WhatsApp's 4-device-per-number cap** is a WhatsApp rule, not ours. One phone number can be linked to at most 4 GChat tiles at once. To have more accounts, use more phone numbers.
- **WhatsApp Web UI changes** can break our DOM scrapers (unread badge detection, chat-pin overlay, conversation scrape). Selectors live in one file (`src/main/wa-tweaks.ts` + the `SCRAPE_SCRIPT` constant in `src/main/index.ts`) for fast patching. Use **View → Inspect Active Account** in the app menu to debug live.
- **Unsigned builds** require macOS "Open Anyway" the first time after each install. Sign + notarize requires a $99/year Apple Developer ID — currently out of scope.
- **macOS only** for now. Electron can target Windows and Linux, but the build config is Mac-only and the design tokens are macOS-native.
- **WhatsApp Web's own constraints apply** — same connectivity issues, same disk-cache growth, same occasional "device logged out" prompts as using web.whatsapp.com in Chrome.

---

## Roadmap (maybe)

- Cross-chat AI search ("find that link Sarah sent about pricing")
- Voice-note transcription with Whisper
- Per-account About-Me override
- Memory search across all chats as part of the AI prompt (RAG)
- Streaming AI replies (token-by-token)
- Anthropic / Gemini / local Ollama support behind the existing provider interface
- Windows + Linux builds

---

## License

Internal use only. No license granted for redistribution. Source is public for transparency and contributor convenience.
