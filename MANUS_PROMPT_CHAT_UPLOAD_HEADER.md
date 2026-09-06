# Manus task — fix support-chat photo upload, attach tray, emoji animation, header

Apply the attached zip over the working tree (full project; leave `node_modules`,
`.git` and `.env*` alone), then commit and push to `main`.

## Bugs being fixed

1. **Sending a photo always failed.** Sealed photos were stored with a `.enc`
   file name, but the media bucket only accepts
   `jpg/jpeg/png/webp/svg/mp4/webm`, so object storage rejected every encrypted
   upload before it was written. The visitor only saw
   "មិនអាចផ្ញើរូបភាពនេះបានទេ" because the client swallowed the real error.
2. **The attach tray looked broken.** The three gooey buttons rendered in normal
   flow, so they stacked over the composer footer, and the goo filter region
   (±45% of a 42px box) clipped them while they travelled.
3. **No emoji ever animated.** The animated-emoji (Noto) CDN URL was built with
   stray `{{ }}` placeholder braces, so every fetch 404ed and every emoji fell
   back to the static glyph.
4. **Replies advertised their transport** ("ឆ្លើយតបពី Telegram").
5. **The header was cramped** — the title collided with the phone status bar and
   the 16-digit safety number wrapped onto a second line.

## Changes

### Server
- `server/uploads.ts` — sealed support-chat photos keep an allowed extension
  (`jpg`) instead of `.enc`. Content type stays `application/octet-stream`, so
  validation still knows the bytes are ciphertext.
- `server/storage.ts` — buckets created from now on also allow `bin` and `enc`.
  (Existing buckets keep their old rules, which is why fix #1 is the extension.)

### Client
- `client/src/components/AnimatedEmoji.tsx` — animation URL rebuilt without the
  placeholder braces; quick tray grown to 44 emoji.
- `client/src/pages/SupportChatPage.tsx`
  - image upload failures log the real reason to the console and show calm copy;
  - `closeTrays` + Escape handling, and a `zcp-scrim` backdrop behind an open
    tray;
  - attach tray rebuilt: all three buttons share one 42px anchor, ghosts are
    `pointer-events: none` until open, and they fan straight up (54px, 108px);
  - trigger is now a `Plus` that rotates 135° into a close icon;
  - the transport chip is gone;
  - header rebuilt: back button, headset avatar, name + reference chip, status
    line with topic chip, shield badge, and the safety number on its own strip.
- `client/src/styles/zurs-chat-page.css` — appended a "v3" section: safe-area
  padding (`env(safe-area-inset-*)`), the new header classes, the scrim, the
  attach-tray geometry (stage grows to 192px while open so the goo is not
  clipped), a wider scrollable emoji grid, plus mobile and reduced-motion rules.

## Do not
- Do not `npm install liquid-gooey` or `thinking-orbs` — both are vendored in
  `client/src/components/`.
- Do not change `tsconfig.json`.
- No migration is needed for this patch.

## Verify

```bash
pnpm install && pnpm test && pnpm build
```

Known pre-existing failure, unrelated to this patch — leave it alone:

```
error TS2688: Cannot find type definition file for 'node'.
error TS2688: Cannot find type definition file for 'vite/client'.
tsconfig.json(16,5): error TS5102: Option 'baseUrl' has been removed.
```

## Manual QA after deploy
1. Open `/chat` on a phone — the header no longer sits under the OS clock, and
   the safety number stays on one line.
2. Tap the `+` button: two buttons rise above it with the gooey merge, nothing
   overlaps the footer, tapping the dimmed background or pressing Escape closes
   it. The `+` rotates into a close icon.
3. Send a photo from the gallery and from the camera — both deliver and render.
   If one fails, the browser console holds the real reason.
4. Send only emoji (for example three of them) — they render large and animated,
   not as static glyphs.
5. Reply from Telegram — the visitor sees the reply with no "from Telegram" note.

## Commit

```bash
git checkout main
git add -A
git commit -m "fix(support): deliver sealed photos, fix attach tray and animated emoji, tidy chat header"
git push origin main
```

If `main` is protected, push `fix/support-chat-upload-header` and open a PR.
