# "Build-a-Colony" — Build Specification
### Unit 1 Game · 8th Grade U.S. History · Colonization

**Purpose:** A build-ready spec to paste into Claude (Fable, Opus, Sonnet): build the game, deploy on Render via GitHub, embed in Wix. Shared Socket.IO engine, Teacher Command Center, standard workflow — this spec covers what's unique.

> **Reading-level rule (everything the student sees):** 8th grade content at a **5th grade reading level**. Short sentences, common words, define hard terms on first use. Does not apply to this spec itself.

> **Data method:** the **shared Socket.IO engine, solo mode** (server-authoritative, in-memory sessions, no database). One new adapter: `usBuildAColony.js`.

> **The design's engine:** the student draws a **region card** — rocky New England coast, fertile Middle river valley, or warm Southern lowland — and steers a new colony for ten years from 1620. The **same twelve prompts** face every player; the answer key differs by region — different regions force different winning strategies, **which IS the lesson of the three regions.**

---

## 1. Game at a Glance

| Field | Value |
|---|---|
| **Title** | Build-a-Colony |
| **Unit** | 1 — Colonization |
| **TEKS** | 8.2B (reasons for founding), 8.10B/8.11A (geography → settlement and economy), 8.12A (regional economies), 8.31B (decision-making) |
| **Pick** | **Region — New England / Middle / Southern** (dashboard groups accuracy by region) |
| **Type** | Solo simulation/strategy game — 6 rounds × 2 decisions = **12 graded actions** |
| **Playtime** | 8–12 minutes; replay in a new region |
| **Platform / tracking** | Shared engine solo mode; Command Center, per-region accuracy; session-only data |
| **Art style** | Semi-realistic / cinematic, cool light |

**One-sentence pitch:** Draw a region, land your settlers in 1620, and make ten years of real colonial choices — planting, recruiting, Native relations, religious freedom — where the right answer depends entirely on your geography.

**Winning vs. accuracy.** Meters are drama; **accuracy measures whether you played your region as real geography and history rewarded.** The debrief names the real colony you resembled.

---

## 2. Historical Content Bank

### 2.1 The three regions (the answer key's spine)
| | **New England** | **Middle** | **Southern** |
|---|---|---|---|
| **Land & climate** | Rocky soil, forests, harbors; long winters, short season | Fertile soil, mild; Hudson and Delaware as trade highways | Rich soil, warm long season; swampy lowlands breed disease |
| **Economy** | The sea: cod, whaling, shipbuilding, trade | "Breadbasket": wheat, corn, rye; artisans, ports | Cash crops: tobacco (VA/MD), rice, indigo (SC/GA); plantations |
| **Government & faith** | Town meetings; strict Puritans (banished Williams, Hutchinson) | Assemblies; most diverse: Quakers, Lutherans, Catholics, Jews | Planter-run; Burgesses (1619) first assembly; Anglican; enslaved people held at the bottom |

### 2.2 Anecdotes for feedback
Jamestown's gold-hunting gentlemen starved — "He that will not work, shall not eat" (Smith). The Wampanoag taught Plymouth to plant. Penn bought Lenape land in fair treaties; tolerant Philadelphia boomed. Land hunger lit the Pequot War and King Philip's War. Massachusetts taxed towns for schools; plantation distances left most Southern children unschooled. Roanoke's 115 colonists vanished (1587) — the Ghost Colony ending's namesake.

### 2.3 Vocabulary (define on first use)
**Charter** — the king's permission for a colony. **Cash crop** — grown to sell, not eat. **Town meeting** — everyone votes directly. **Representative assembly** — you elect lawmakers. **Toleration** — letting others worship differently.

---

## 3. Core Mechanics

### 3.1 Meters (0–100, start 50)
**Food** 🌾 · **Unity** 🤝 · **Coin** 💰.

### 3.2 Structure — 6 rounds × 2 decisions = 12 graded actions
Six rounds spanning 1620–1630 (titles in §4), two decisions each. Flow: year card (Fable-written, one scene image) → decision → feedback ×2. Right = 1, partial = 0.5, wrong = 0, server-side; accuracy = points ÷ 12 × 100. **Default effects:** ✅ +10 lead meter, ⚠️ 0 to −5, ❌ −10 (exceptions noted). A flagged ❌ triggers a **"Starving Time" crisis interstitial** — drama only, never graded.

### 3.3 Endings
Meter sum → **"Royal Charter"** / **"The Colony Holds On"** / **"Ghost Colony"** (your settlement fades like Roanoke — an empty palisade, one carved word). Every tier ends with a region debrief naming the real colony you resembled (Massachusetts / Pennsylvania / Virginia–Carolina) and a replay nudge: *"Draw a different region."*

---

## 4. Reference Content — the Twelve Decisions (triple answer key)

Prompts are shared. Each choice's verdicts read **NE·M·S in that order**. Effects follow §3.2 defaults unless noted. Sample feedback sets the voice; Fable writes region variants wherever verdicts differ.

### Round 1 — The Landing (1620)
*Event:* Your ship anchors. One hundred settlers, one region card, ten years to earn a charter.

**D1 — Choose your town site.**
- **A) Right on the water, where ships can anchor.** ✅·⚠️·❌ — *S: "Low coastal ground means bad water and fever — Jamestown learned the hard way."*
- **B) Beside the big river that runs inland.** ⚠️·✅·⚠️ — *M: "The Hudson and Delaware were watery highways to market."*
- **C) On high ground, away from the wet lowlands.** ⚠️·⚠️·✅ — *S: "Dry ground and clean springs — you dodged the fevers that emptied early Jamestown."*

**D2 — What fills most of your fields in year one?**
- **A) Corn and beans — food first.** ✅·⚠️·⚠️ — *NE: "Rocky soil and a short season leave no room for gambling."*
- **B) Tobacco to sell.** ❌·❌·✅ (S: Coin +10, Food −5) — *NE: "In rocky, frosty ground? Dead by October." S: "King Tobacco — keep corn rows too."*
- **C) Wheat, acres of it.** ❌·✅·⚠️ — *M: "The Breadbasket begins."*

### Round 2 — First Winter (1621–22)
*Event:* The first hard season is coming. Old hands say prepare; new hands say relax.

**D1 — Your winter orders?**
- **A) Dry fish, smoke meat, stack firewood to the roof.** ✅·✅·⚠️ (Food +10) — *NE: "Killing winters are the rule here — Plymouth lost half its people to one."*
- **B) Keep everyone building the meetinghouse instead.** ⚠️ all (Unity +5, Food −5) — *"Faith warms the heart, not the storehouse."*
- **C) Trust the weather — it's been gentle.** ❌·❌·⚠️ (NE: Food −15, crisis: **Starving Time**) — *NE: "The snow came in November and stayed till April. This is how colonies die."*

**D2 — Sickness spreads through the settlement.**
- **A) Move the sick to dry shelter; boil the drinking water.** ✅ all — *S: "Bad swamp water was the South's quiet killer. Clean water is medicine."*
- **B) Pray harder and keep working.** ⚠️ all — *"Colonists did pray — the wise ones also watched the water."*
- **C) Blame witchcraft and hold a trial.** ❌ all (Unity −15) — *"Fear on trial. Salem showed where this ends — nineteen hanged, a colony ashamed."*

### Round 3 — Neighbors (1623–24)
*Event:* A nearby Native nation sends traders to your gate. They know this land; you don't.

**D1 — Your policy toward the nation?**
- **A) Trade fairly, keep your word, learn from them.** ✅ all (Unity +10, Food +5) — *NE: "The Wampanoag taught Plymouth to plant this land."*
- **B) Take what you need — you have muskets.** ❌ all (Unity −15) — *"Land hunger really lit the Pequot War and later King Philip's War — both peoples' worlds burned."*
- **C) Build a wall; refuse all contact.** ⚠️ all (Food −5) — *"No war — and no corn, no guides, no trade."*

**D2 — Your settlers plow into the nation's planting grounds without asking.**
- **A) Pull them back and pay for the damage.** ✅ all (Unity +10) — *"Justice kept the peace Penn's way."*
- **B) Back your settlers — land is why you came.** ❌ all (Unity −15) — *"Every stolen field bought a generation of war."*
- **C) Look away and hope.** ⚠️ all (Unity −5) — *"It never settles itself."*

### Round 4 — New Arrivals (1625–26)
*Event:* Ships from England. You may send for one kind of newcomer.

**D1 — Who do you recruit?**
- **A) Fishermen and ship's carpenters.** ✅·⚠️·⚠️ (NE: Coin +10) — *NE: "Cod, ships, and whale oil — a fortune pulled from the icy Atlantic."*
- **B) Farm families with plows and seed.** ⚠️·✅·✅ (Food +10) — *S: "Real Southern planters turned instead to indentured servants — then to enslaved Africans. Your colony chose free families; the debrief tells the harder truth."*
- **C) Gentlemen adventurers hunting gold.** ❌ all (Food −10) — *"Jamestown tried this. No gold, no farming. 'He that will not work, shall not eat.'"*

**D2 — A ship of religious dissenters — a different church than yours — asks to land.**
- **A) Welcome them. More hands, more faiths.** ✅ all (Unity +10, Coin +5) — *M: "Tolerance was the Middle Colonies' superpower."*
- **B) Turn them away — one town, one church.** ❌ all (Unity −10) — *"Massachusetts' actual policy — it cost them every settler who followed Williams to Rhode Island."*
- **C) Let them land, but ban their worship.** ⚠️ all (Unity −5) — *"Half a welcome breeds whole resentments."*

### Round 5 — Laws & Faith (1627–28)
*Event:* One hundred settlers are now four hundred. Somebody must make the rules.

**D1 — How are your laws made?**
- **A) Town meeting — every free man votes directly.** ✅·⚠️·❌ (NE: Unity +10) — *NE: "Compact towns made the town meeting New England's signature." S: "Plantations sit miles apart — nobody rides half a day to vote on fences."*
- **B) The governor decides alone.** ❌ all (Unity −10) — *"Colonists crossed an ocean to escape unchecked rulers, not to grow one."*
- **C) Elect representatives to an assembly.** ⚠️·✅·✅ — *S: "Virginia's House of Burgesses (1619) — the first representative assembly — was built for this spread-out world."*

**D2 — Your colony needs schooling.**
- **A) Tax every town to open a public school.** ✅·⚠️·❌ — *NE: "So every child could read the Bible, Massachusetts built the first public schools — and Harvard."*
- **B) Let each church run its own school.** ⚠️·✅·⚠️ — *M: "A patchwork of faiths ran a patchwork of schools — it fit."*
- **C) The rich hire tutors; the rest learn at home.** ❌·⚠️·✅ — *S: "Accurate to the plantation South — most poor children got no school. The point rewards knowing it; the unfairness is part of the record."*

### Round 6 — The Charter Test (1629–30)
*Event:* Ten years in. The king's inspector arrives — show him your colony's worth.

**D1 — What do you ship to England as proof?**
- **A) Salted cod, whale oil, ship timber.** ✅·⚠️·❌ (NE: Coin +10) — *NE: "The sea paid where the soil couldn't."*
- **B) Barrels of flour and grain.** ❌·✅·⚠️ (M: Coin +10) — *M: "The Breadbasket, delivered."*
- **C) Tobacco and rice bales.** ❌·❌·✅ (S: Coin +10) — *S: "Cash crops filled the king's customs house."*

**D2 — Choose the trade route your colony will live on.**
- **A) The Atlantic triangle — fish and rum to far ports.** ✅·⚠️·❌ — *NE: "New England sailed the triangular trade — a fortune, and a hard truth: parts of that triangle traded in human beings. The debrief names it."*
- **B) Feed the other colonies — coastwise grain trade.** ⚠️·✅·⚠️ — *M: "Everyone eats. The Breadbasket banks it."*
- **C) Straight to England — cash crops out, manufactured goods back.** ❌·⚠️·✅ — *S: "The mercantile bargain: tobacco out, England's cloth and tools back."*

---

## 5. Screens & UI Flow
1. **Title** — navy gradient (`#1B2A4A → #10203C`), colony-scape art; era flavor from typography, never tan washes.
2. **Region draw** — three face-down region cards; tap to draw, or "choose instead." Sets the engine variant.
3. **Round loop** — year banner → scene card → three navy choice buttons → verdict flash (green `#2F7D4F` / gold `#C9A227` / crimson `#B23A48`) + feedback → meters animate (icons + numbers). Crisis interstitials in crimson-trimmed navy, ungraded.
4. **Ending** — tier art + region debrief + accuracy % + replay nudge.

## 6. Engine Integration
- **Adapter:** `server/src/games/usBuildAColony.js` via `createStepGame`; **`gameId: 'us-build-a-colony'`**; mode **solo**; **variants: `newengland` | `middle` | `southern`** (sent at match start); `totalActions: 12`; meters `{ food, unity, coin }` start 50.
- One PROMPTS list + three overlays, or three full step lists (simpler; matches the factory). Register in `games/index.js`; codes, approval, scoring, roster, PDF, delete-on-end standard.
- **Client:** region-draw screen, decision loop, meter bar, ending card — no map component. **Repo:** `us-build-a-colony` → Render.

## 7. Visual & Audio Assets (Higgsfield MCP)
**Art direction (top of every prompt):** *Semi-realistic cinematic historical illustration, 1620s English colonies. Cool light, painterly, dignified, era-accurate. No text, no logos. 16:9.*

| # | Asset | Prompt sketch |
|---|---|---|
| 1 | Title / hero | "Palisaded settlement at dawn, wild coastline, ship at anchor." |
| 2 | Region card — NE | "Rocky forested coast, natural harbor, cold bright light." |
| 3 | Region card — Middle | "Wide fertile river valley, golden-green fields." |
| 4 | Region card — Southern | "Warm coastal lowland, slow river, tall pines, haze graded cool." |
| 5 | Round 2 — winter | "Snowed-in settlement at dusk, one lit window." |
| 6 | Round 3 — neighbors | "Dignified trade meeting, Native leaders and colonists, forest edge — mutual respect, no weapons raised." |
| 7 | Round 5 — meeting | "Colonists voting by raised hands in a plain meetinghouse." |
| 8 | Ending — ghost | "Empty palisade gate at dusk, tall grass, one carved post — melancholy, no violence." |
| 9 | *(Optional)* ambience | Wind, surf, axe-fall loop; muted by default. |

Rounds 4 and 6 reuse the region-card and hero art.

## 8. Model Workflow
Standard order. **Fable-heavy:** 12 prompts × 3 choices × region variants ≈ 100 strings at reading level. **Opus:** the triple-key adapter; crisis interstitials stay client-only. Sonnet screens; Higgsfield per §7.

## 9. Teacher Command Center
Standard. Grouping: **accuracy by region** — "New England — 9 students — 82% · Middle — 77% · Southern — 71%." PDF: Students (Name · Region · Status · Accuracy %) + region accuracy. Footer: **"Made for 8th Grade U.S. History · TEKS 8.2B, 8.10B, 8.11A, 8.12A, 8.31B."**

## 10. Build Checklist & Test Plan (delta)
- [ ] All three 12-action keys filled; same prompts, different verdicts (1.D2, 5.D2, 6.D1 split three ways)
- [ ] All-right per region = 100%; a NE-perfect run replayed as Southern scores low (keys not swapped)
- [ ] Crisis interstitials never touch scoring
- [ ] Region draw sets the variant; dashboard groups by region; PDF renders
- [ ] Ghost Colony ending reachable, Roanoke-flavored, not punitive
- [ ] Feedback names real history (Wampanoag, Penn, Burgesses, the wars) per §4
- [ ] Palette check: zero tan/parchment surfaces

## 11. Teacher / Sensitivity Notes
- **Native nations are sovereign actors** — traders, teachers, treaty-makers. Round 3's ❌ paths name the real wars as catastrophes colonists' choices produced, never as adventure; Asset 6 shows diplomacy, not conflict.
- **Slavery is not a game mechanic.** No choice ever offers buying or holding enslaved people. Where the real Southern economy turned to enslaved labor (4.D1, 6.D2), feedback and the Southern debrief say so plainly — and say that this game deliberately does not let you "play" that.
- **Accuracy ≠ endorsement** (5.D2): the point rewards knowing the plantation South's unequal schooling; the feedback names the unfairness. Say it aloud: the game grades knowing history, including its injustices.

---
*Companion to Jamestown 1607: Survive the Starving Time, Colony Sort: Region Rush, Mutiny on the Mayflower, and the Unit 1 apps. Shared engine (solo mode), Union Blue palette, same GitHub → Render → Wix workflow.*
