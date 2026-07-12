# Build-a-Colony

**Unit 1 · 8th Grade U.S. History · TEKS 8.2B, 8.10B, 8.11A, 8.12A, 8.31B**

It's 1620 and your ship has just dropped anchor. Draw a region card — **New
England**, **Middle**, or **Southern** — and steer a brand-new colony through
ten years and six rounds of real colonial choices: where to build, what to
plant, how to treat your Native neighbors, who to recruit, how to govern, and
what to ship home. **Every region faces the same twelve prompts.** The right
answer changes with the land — that difference is the whole lesson of the
three regions.

Built on the shared Texas/U.S. History Socket.IO engine (server-authoritative,
solo mode) with one small extension: a choice may carry `crisis`, a client-only
flag that plays a dramatic, **ungraded** interstitial (the "Starving Time")
without ever touching the score.

## Run it

```bash
npm install        # installs server/ and client/ via postinstall
npm test           # server test suite (triple-key content + engine)
npm run build      # builds the React client into client/dist
npm start           # serves game + Teacher Command Center on :4000
```

- Student game: `http://localhost:4000`
- Teacher Command Center: `http://localhost:4000/#teacher`

## What's specific to this game

- **Adapter:** `server/src/games/usBuildAColony.js` — one shared list of twelve
  prompts (six rounds × two decisions), compiled three ways (`newengland`,
  `middle`, `southern`) into full step lists with region-specific verdicts,
  effects, and feedback. Meters: Food 🌾 · Unity 🤝 · Coin 💰, start at 50.
- **No branch** — the region is chosen once, at the draw, and never changes
  mid-game (unlike Surviving the Dust Bowl's stay/go split).
- **All-right per region = 100%,** independently: New England 270/300, Middle
  270/300, Southern 265/300 — all clear the Royal Charter tier (≥230). A
  New England–perfect run scored under the Southern key drops to roughly
  half credit, proving the three answer keys are genuinely different, not
  swapped copies.
- **The crisis interstitial:** Round 2's "trust the weather" choice can raise
  `crisis: 'starving_time'` for New England and the Middle Colonies (not the
  mild South). The client shows a crimson-trimmed navy interstitial; the
  server still grades the choice purely on its verdict — the crisis never
  changes the score.
- **Endings:** Royal Charter (≥230) / The Colony Holds On (130–229) / Ghost
  Colony (<130, Roanoke-flavored). Every ending shows a region debrief naming
  the real colony you resembled — Massachusetts/Plymouth, Pennsylvania, or
  Virginia/Carolina — and nudges a replay in a different region.
- **Dashboard:** class accuracy grouped by region; PDF includes both the
  roster and the region breakdown.
- **Sensitivity (spec §11):** Native nations appear only as traders, teachers,
  and treaty-makers; the wrong paths in Round 3 name the real wars (Pequot,
  King Philip's) as catastrophes, never as adventure. Slavery is never a game
  mechanic — no choice ever offers buying or holding enslaved people. Where
  the real Southern economy turned to enslaved labor, the feedback and the
  Southern debrief say so plainly, and say the game deliberately does not let
  you "play" it.

Session data lives in server memory only; the teacher's PDF is the only
record that survives. Deploy shape: one Render web service (see
`render.yaml`), embedded in Wix — same workflow as the companion U.S.
History games.

*Companion to Jamestown 1607: Survive the Starving Time, Colony Sort: Region
Rush, Mutiny on the Mayflower, and the Unit 1 apps.*
