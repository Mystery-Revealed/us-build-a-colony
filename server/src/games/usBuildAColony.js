// usBuildAColony.js — Unit 1 U.S. History adapter: "Build-a-Colony" (SOLO,
// variant pick — NO branch). The student draws a REGION card — New England,
// Middle, or Southern — and steers a brand-new 1620 colony through ten years,
// six rounds, twelve graded decisions, toward a royal charter.
//
// THE ENGINE OF THE DESIGN: the SAME twelve prompts face every player. The
// ANSWER KEY DIFFERS BY REGION — the choice that wins New England can sink the
// South. That difference IS the lesson of the three regions (geography drove
// settlement, economy, government, and faith). So this is a variant-solo game:
// three full step lists, one per region, sharing prompts and choice labels but
// carrying region-specific verdicts, effects, and feedback.
//
// Meters food/unity/coin start at 50. Six rounds x 2 decisions = 12 graded
// actions. Right = 1, partial = 0.5, wrong = 0 (server-side, verdict-only). A
// flagged wrong at Round 2 can raise a "Starving Time" crisis interstitial —
// pure client drama, NEVER graded (see `crisis` passthrough in _stepGame.js).
//
// Reading level: everything a student sees is 8th-grade content written at a
// 5th-grade reading level (short sentences, common words, hard terms defined on
// first use). TEKS 8.2B, 8.10B, 8.11A, 8.12A, 8.31B.
//
// SENSITIVITY (spec §11, Common Standards §10): Native nations are sovereign
// actors — traders, teachers, treaty-makers; Round 3's wrong paths name the real
// wars as catastrophes colonists' choices produced. Slavery is NEVER a mechanic:
// no choice ever offers buying or holding enslaved people. Where the real economy
// turned to enslaved labor (4.D1, 6.D2) the feedback and the Southern debrief say
// so plainly — and say that this game deliberately does not let you "play" it.

import { createStepGame } from './_stepGame.js';

// ---------------------------------------------------------------------------
// Regions + meters (shipped to clients at match:begin — display info only)
// ---------------------------------------------------------------------------

export const REGION_KEYS = ['newengland', 'middle', 'southern'];

export const METERS = {
  food:  { name: 'Food',  icon: 'food',  blurb: 'Full barns and fed settlers. Empty barns end colonies.' },
  unity: { name: 'Unity', icon: 'unity', blurb: 'Peace at home and with your neighbors — trust, fairness, and faith.' },
  coin:  { name: 'Coin',  icon: 'coin',  blurb: 'Money and trade — the proof a colony pays that earns a charter.' },
};

export const START_METERS = { food: 50, unity: 50, coin: 50 };

export const REGIONS = {
  newengland: {
    key: 'newengland', name: 'New England', image: 'card_newengland.jpg',
    tag: 'Rocky coast · long winters · the sea',
    blurb: 'Rocky soil, deep forests, and fine harbors, but long winters and a short growing season. Your fortune is not in the ground — it is in the sea: cod, whaling, shipbuilding, and trade.',
  },
  middle: {
    key: 'middle', name: 'Middle Colonies', image: 'card_middle.jpg',
    tag: 'Rich soil · wide rivers · the Breadbasket',
    blurb: 'Fertile soil and a mild climate, with the Hudson and Delaware rivers as watery highways to market. This is the Breadbasket — wheat, corn, and rye — and the most mixed, tolerant place in the colonies.',
  },
  southern: {
    key: 'southern', name: 'Southern Colonies', image: 'card_southern.jpg',
    tag: 'Warm & long season · cash crops · plantations',
    blurb: 'Rich soil and a long, warm season — perfect for cash crops like tobacco and rice grown on big plantations. But the swampy lowlands breed disease, and settlements spread far apart.',
  },
};

export const REGION_LABEL = { newengland: 'New England', middle: 'Middle', southern: 'Southern' };

// ---------------------------------------------------------------------------
// The triple answer key, written ONCE. Each decision names a `lead` meter; the
// default effect is +10 lead (right), -5 lead (partial), -10 lead (wrong). A
// choice's `fx[region]` OVERRIDES that default with an explicit effect object,
// which is how the spec's noted exceptions (tobacco, the winter stores, the
// Native-trade bonus, the tolerance bonus, the crisis) are encoded.
//
// verdict per region: v = { ne, m, s }   (right | partial | wrong)
// feedback:           fb = string | { ne, m, s }
// crisis:             cr = { ne?, m?, s? } -> a crisis id when that region picks it
// ---------------------------------------------------------------------------

const V = { R: 'right', P: 'partial', W: 'wrong' };

const DEFAULT_FX = {
  right:   (lead) => ({ [lead]: 10 }),
  partial: (lead) => ({ [lead]: -5 }),
  wrong:   (lead) => ({ [lead]: -10 }),
};

// The raw answer key is keyed by short region tags (ne/m/s); the engine's region
// keys are the long forms. This maps one to the other.
const RK = { newengland: 'ne', middle: 'm', southern: 's' };

// Compile one region's view of a raw decision into an engine step.
function compileStep(raw, region) {
  const k = RK[region];
  return {
    kind: 'decision',
    prompt: raw.prompt,
    choices: raw.choices.map((c) => {
      const verdict = c.v[k];
      const effects = (c.fx && c.fx[k]) ? c.fx[k] : DEFAULT_FX[verdict](raw.lead);
      const feedback = typeof c.fb === 'string' ? c.fb : c.fb[k];
      const crisis = c.cr && c.cr[k] ? c.cr[k] : undefined;
      const step = { label: c.label, verdict, effects, feedback };
      if (crisis) step.crisis = crisis;
      return step;
    }),
  };
}

const round = (title, date, image, event, d1, d2) => ({ title, date, image, event, d1, d2 });

// Round 1 (the ship anchoring) and Rounds 4 & 6 reuse the single hero image
// (spec §7: "Rounds 4 and 6 reuse the region-card and hero art") — this keeps
// the art budget at 8 assets total (§7's table) since round metadata here is
// shared across all three regions, not region-specific.
const IMG = {
  landing: 'title_hero.jpg',
  winter: 'event_winter.jpg',
  neighbors: 'event_neighbors.jpg',
  arrivals: 'title_hero.jpg',
  meeting: 'event_meeting.jpg',
  charter: 'title_hero.jpg',
};

// ===========================================================================
// THE SIX ROUNDS — shared prompts + labels, region-split answer key.
// ===========================================================================

const ROUNDS = [
  // ---- Round 1 — The Landing (1620) -------------------------------------
  round(
    'The Landing', '1620', IMG.landing,
    'Your ship drops anchor at last. One hundred settlers step onto the shore, holding one region and ten years to earn a royal charter — the king’s paper that makes a colony real.',
    {
      prompt: 'Where do you build your town?',
      lead: 'food',
      choices: [
        { label: 'Right on the water, where ships can drop anchor.',
          v: { ne: V.R, m: V.P, s: V.W },
          fb: {
            ne: 'A safe harbor is New England’s whole fortune. Ships, cod, and trade all begin at the water’s edge.',
            m: 'A port helps, but your real road to market is the big river a little inland.',
            s: 'Low, wet coastal ground means bad water and fever. Jamestown learned this the hard way — many died their first summer.' } },
        { label: 'Beside the big river that runs inland.',
          v: { ne: V.P, m: V.R, s: V.P },
          fb: {
            ne: 'A river helps, but New England’s gold is the sea and its harbors, not the inland water.',
            m: 'Smart. The Hudson and Delaware were watery highways that carried your crops to market.',
            s: 'A river is useful, but the higher, drier ground is what keeps the fever away down here.' } },
        { label: 'On high ground, away from the wet lowlands.',
          v: { ne: V.P, m: V.P, s: V.R },
          fb: {
            ne: 'Dry ground is healthy, but you have stepped back from the harbor that would make you rich.',
            m: 'Healthy — but a little far from the river roads that move your grain.',
            s: 'Dry ground and clean springs. You dodged the fevers that emptied early Jamestown. Wise.' } },
      ],
    },
    {
      prompt: 'What fills most of your fields in the first year?',
      lead: 'food',
      choices: [
        { label: 'Corn and beans — food first.',
          v: { ne: V.R, m: V.P, s: V.P },
          fb: {
            ne: 'Rocky soil and a short season leave no room to gamble. Fill the barns first.',
            m: 'Food is never wrong, but your rich soil could grow a cash crop too.',
            s: 'Corn keeps everyone fed, but your long, warm season is begging for a cash crop.' } },
        { label: 'Tobacco to sell. (A cash crop is grown to sell, not to eat.)',
          v: { ne: V.W, m: V.W, s: V.R },
          fx: { s: { coin: 10, food: -5 } },
          fb: {
            ne: 'Tobacco in rocky, frosty ground? Dead by October. This is not that land.',
            m: 'Tobacco will not ripen well here — and you cannot eat it if winter comes hungry.',
            s: 'King Tobacco — the South’s money crop. Keep some corn rows too, so no one starves.' } },
        { label: 'Wheat, acres of it.',
          v: { ne: V.W, m: V.R, s: V.P },
          fb: {
            ne: 'Wheat needs deep, kind soil and a long season. New England has neither.',
            m: 'The Breadbasket begins. Middle Colony wheat fed cities up and down the coast.',
            s: 'Wheat grows, but tobacco and rice pay far better in this warm, wet land.' } },
      ],
    },
  ),

  // ---- Round 2 — First Winter (1621-22) ---------------------------------
  round(
    'First Winter', '1621–22', IMG.winter,
    'The first hard season is coming. The old hands say get ready. The new hands say the weather has been kind — relax.',
    {
      prompt: 'What are your winter orders?',
      lead: 'food',
      choices: [
        // NOTE (spec reconciliation): §4 marks Southern here as all-partial, which
        // would make a Southern 100% run impossible and break §10's "all-right per
        // region = 100%." Winter prep is never the WRONG call — just less dramatic
        // in a mild climate — so Southern's right answer here is to prepare.
        { label: 'Dry fish, smoke meat, and stack firewood to the roof.',
          v: { ne: V.R, m: V.R, s: V.R },
          fx: { ne: { food: 10 }, m: { food: 10 }, s: { food: 10 } },
          fb: {
            ne: 'Killing winters are the rule here — Plymouth lost half its people to one. Stored food saved the rest.',
            m: 'A wise habit. Even mild winters punish a colony with empty barns.',
            s: 'Good sense. Your winters are gentle, but full barns are never wasted — the best of the three.' } },
        { label: 'Keep everyone building the meetinghouse instead.',
          v: { ne: V.P, m: V.P, s: V.P },
          fx: { ne: { unity: 5, food: -5 }, m: { unity: 5, food: -5 }, s: { unity: 5, food: -5 } },
          fb: 'Faith warms the heart, not the storehouse. A church is good — but not before the winter food.' },
        { label: 'Trust the weather — it has been gentle.',
          v: { ne: V.W, m: V.W, s: V.P },
          fx: { ne: { food: -15 }, m: { food: -10 }, s: { food: -5 } },
          cr: { ne: 'starving_time', m: 'starving_time' },
          fb: {
            ne: 'The snow came in November and stayed till April. This is how colonies die.',
            m: 'The cold caught you short. Hungry weeks followed — a hard, needless lesson.',
            s: 'Your mild winter forgave you this time. Farther north it would not have.' } },
      ],
    },
    {
      prompt: 'Sickness spreads through the settlement.',
      lead: 'unity',
      choices: [
        { label: 'Move the sick to dry shelter and boil the drinking water.',
          v: { ne: V.R, m: V.R, s: V.R },
          fb: {
            ne: 'Clean water and dry beds pulled most of the sick through. Simple care, real lives saved.',
            m: 'Clean water and dry beds pulled most of the sick through. Simple care, real lives saved.',
            s: 'Bad swamp water was the South’s quiet killer. Clean water is medicine.' } },
        { label: 'Pray harder and keep working.',
          v: { ne: V.P, m: V.P, s: V.P },
          fb: 'Colonists did pray — and the wise ones also watched the water and rested the sick.' },
        { label: 'Blame witchcraft and hold a trial.',
          v: { ne: V.W, m: V.W, s: V.W },
          fx: { ne: { unity: -15 }, m: { unity: -15 }, s: { unity: -15 } },
          fb: 'Fear on trial. Salem showed where this ends — nineteen people hanged, and a colony left ashamed.' },
      ],
    },
  ),

  // ---- Round 3 — Neighbors (1623-24) ------------------------------------
  round(
    'Neighbors', '1623–24', IMG.neighbors,
    'A nearby Native nation sends traders to your gate. This is their homeland. They know this land; you do not.',
    {
      prompt: 'What is your policy toward the nation?',
      lead: 'unity',
      choices: [
        { label: 'Trade fairly, keep your word, and learn from them.',
          v: { ne: V.R, m: V.R, s: V.R },
          fx: { ne: { unity: 10, food: 5 }, m: { unity: 10, food: 5 }, s: { unity: 10, food: 5 } },
          fb: {
            ne: 'The Wampanoag taught Plymouth how to plant this land. Fair trade kept the peace for years.',
            m: 'Fair trade and kept promises built the Middle Colonies’ good name with their neighbors.',
            s: 'Fair trade won food, guides, and years of peace. Keeping your word was the whole secret.' } },
        { label: 'Take what you need — you have muskets.',
          v: { ne: V.W, m: V.W, s: V.W },
          fx: { ne: { unity: -15 }, m: { unity: -15 }, s: { unity: -15 } },
          fb: 'Land hunger really did light the Pequot War and, later, King Philip’s War. Both peoples’ worlds burned.' },
        { label: 'Build a wall and refuse all contact.',
          v: { ne: V.P, m: V.P, s: V.P },
          fx: { ne: { food: -5 }, m: { food: -5 }, s: { food: -5 } },
          fb: 'No war — but also no corn, no guides, and no trade. A colony cannot wall itself into plenty.' },
      ],
    },
    {
      prompt: 'Your settlers plow into the nation’s planting grounds without asking.',
      lead: 'unity',
      choices: [
        { label: 'Pull them back and pay for the damage.',
          v: { ne: V.R, m: V.R, s: V.R },
          fx: { ne: { unity: 10 }, m: { unity: 10 }, s: { unity: 10 } },
          fb: 'Justice kept the peace — the way William Penn bought Lenape land in fair treaties, and Philadelphia boomed.' },
        { label: 'Back your settlers — land is why you came.',
          v: { ne: V.W, m: V.W, s: V.W },
          fx: { ne: { unity: -15 }, m: { unity: -15 }, s: { unity: -15 } },
          fb: 'Every stolen field bought a season of anger and, in time, a generation of war.' },
        { label: 'Look away and hope it settles itself.',
          v: { ne: V.P, m: V.P, s: V.P },
          fb: 'It never settles itself. Trouble left alone only grows.' },
      ],
    },
  ),

  // ---- Round 4 — New Arrivals (1625-26) ---------------------------------
  round(
    'New Arrivals', '1625–26', IMG.arrivals,
    'Ships from England are coming. You may send word for one kind of newcomer to fill them.',
    {
      prompt: 'Who do you recruit?',
      lead: 'coin',
      choices: [
        { label: 'Fishermen and ship’s carpenters.',
          v: { ne: V.R, m: V.P, s: V.P },
          fx: { ne: { coin: 10 } },
          fb: {
            ne: 'Cod, ships, and whale oil — a fortune pulled from the icy Atlantic. Perfect for this coast.',
            m: 'Useful hands, but your wealth grows in fields, not fishing boats.',
            s: 'Fishermen are fine, but your warm fields want farmers far more than sailors.' } },
        { label: 'Farm families with plows and seed.',
          v: { ne: V.P, m: V.R, s: V.R },
          fx: { ne: { food: 5 }, m: { food: 10 }, s: { food: 10 } },
          fb: {
            ne: 'Extra hands help, but this rocky ground will never be a breadbasket.',
            m: 'Farm families were the Breadbasket’s backbone. Exactly who you need.',
            s: 'Real Southern planters turned instead to indentured servants, then to enslaved Africans. Your colony chose free families — the debrief tells that harder truth.' } },
        { label: 'Gentlemen adventurers hunting for gold.',
          v: { ne: V.W, m: V.W, s: V.W },
          fx: { ne: { food: -10 }, m: { food: -10 }, s: { food: -10 } },
          fb: 'Jamestown tried this. No gold, and no one willing to farm. As John Smith warned, “He that will not work, shall not eat.”' },
      ],
    },
    {
      prompt: 'A ship of religious dissenters — a different church than yours — asks to land. (Toleration means letting others worship differently.)',
      lead: 'unity',
      choices: [
        { label: 'Welcome them. More hands, more faiths.',
          v: { ne: V.R, m: V.R, s: V.R },
          fx: { ne: { unity: 10, coin: 5 }, m: { unity: 10, coin: 5 }, s: { unity: 10, coin: 5 } },
          fb: {
            ne: 'A generous choice — though Massachusetts itself too often turned such families away.',
            m: 'Tolerance was the Middle Colonies’ superpower: Quakers, Lutherans, Catholics, and Jews all built there.',
            s: 'Open doors brought willing workers and kept the peace. A wise welcome.' } },
        { label: 'Turn them away — one town, one church.',
          v: { ne: V.W, m: V.W, s: V.W },
          fx: { ne: { unity: -10 }, m: { unity: -10 }, s: { unity: -10 } },
          fb: 'This was Massachusetts’ real policy — and it cost them every settler who followed Roger Williams to Rhode Island.' },
        { label: 'Let them land, but ban their worship.',
          v: { ne: V.P, m: V.P, s: V.P },
          fb: 'Half a welcome breeds whole resentments. People remember who let them pray.' },
      ],
    },
  ),

  // ---- Round 5 — Laws & Faith (1627-28) ---------------------------------
  round(
    'Laws & Faith', '1627–28', IMG.meeting,
    'Your one hundred settlers are now four hundred. Somebody has to make the rules.',
    {
      prompt: 'How are your laws made?',
      lead: 'unity',
      choices: [
        { label: 'Town meeting — every free man votes directly. (A town meeting: everyone votes for themselves.)',
          v: { ne: V.R, m: V.P, s: V.W },
          fx: { ne: { unity: 10 } },
          fb: {
            ne: 'Compact towns made the town meeting New England’s signature. Neighbors ruled themselves face to face.',
            m: 'Town meetings work in tight villages, but your spread-out counties need something wider.',
            s: 'Plantations sit miles apart. Nobody rides half a day to vote on a fence. This will not hold here.' } },
        { label: 'The governor decides alone.',
          v: { ne: V.W, m: V.W, s: V.W },
          fx: { ne: { unity: -10 }, m: { unity: -10 }, s: { unity: -10 } },
          fb: 'Colonists crossed an ocean to escape rulers with no check on them — not to grow a new one.' },
        { label: 'Elect representatives to an assembly. (A representative assembly: you elect lawmakers to speak for you.)',
          v: { ne: V.P, m: V.R, s: V.R },
          fx: { m: { unity: 10 }, s: { unity: 10 } },
          fb: {
            ne: 'A fair system, though tight New England towns leaned on the direct town meeting instead.',
            m: 'Elected assemblies fit the Middle Colonies’ many towns and many faiths.',
            s: 'Virginia’s House of Burgesses (1619) — the first elected assembly in the colonies — was built for this spread-out world.' } },
      ],
    },
    {
      prompt: 'Your growing colony needs schooling.',
      lead: 'unity',
      choices: [
        { label: 'Tax every town to open a public school.',
          v: { ne: V.R, m: V.P, s: V.W },
          fx: { ne: { unity: 10 } },
          fb: {
            ne: 'So every child could read the Bible, Massachusetts built the first public schools — and Harvard.',
            m: 'A fine idea, though your many churches each wanted a say in the lessons.',
            s: 'Grand plantations, spread far apart, made town-funded schools nearly impossible here.' } },
        { label: 'Let each church run its own school.',
          v: { ne: V.P, m: V.R, s: V.P },
          fx: { m: { unity: 10 } },
          fb: {
            ne: 'A patchwork works, but a town-funded school reached more children here.',
            m: 'A patchwork of faiths ran a patchwork of schools — and it fit the Middle Colonies well.',
            s: 'Church schools helped a little, but most children were still too far to reach one.' } },
        { label: 'The rich hire tutors; the rest learn at home.',
          v: { ne: V.W, m: V.P, s: V.R },
          fx: { s: { unity: 10 } },
          fb: {
            ne: 'Leaving learning to the wealthy left New England’s towns behind. Not the path here.',
            m: 'Some families hired tutors, but your towns wanted schools open to more than the rich.',
            s: 'This matches the plantation South: rich sons got tutors, most poor children got no school. Knowing that unfair truth is the point — the debrief names it.' } },
      ],
    },
  ),

  // ---- Round 6 — The Charter Test (1629-30) -----------------------------
  round(
    'The Charter Test', '1629–30', IMG.charter,
    'Ten years in. The king’s inspector arrives to judge your colony’s worth. Show him.',
    {
      prompt: 'What do you ship to England as proof your colony pays?',
      lead: 'coin',
      choices: [
        { label: 'Salted cod, whale oil, and ship timber.',
          v: { ne: V.R, m: V.P, s: V.W },
          fx: { ne: { coin: 10 } },
          fb: {
            ne: 'The sea paid where the soil could not. Cod and whale oil made New England’s fortune.',
            m: 'The sea helps a little, but your true wealth is grain, not fish.',
            s: 'You have no great fishing fleet down here. This will not impress the king.' } },
        { label: 'Barrels of flour and grain.',
          v: { ne: V.W, m: V.R, s: V.P },
          fx: { m: { coin: 10 } },
          fb: {
            ne: 'Your thin, rocky soil cannot fill enough barrels to matter.',
            m: 'The Breadbasket, delivered. Middle Colony grain fed the whole coast.',
            s: 'You grow some grain, but tobacco and rice are what fill the king’s customs house.' } },
        { label: 'Tobacco and rice bales.',
          v: { ne: V.W, m: V.W, s: V.R },
          fx: { s: { coin: 10 } },
          fb: {
            ne: 'Tobacco will not grow in a New England frost. You have none to send.',
            m: 'Your climate is wrong for tobacco and rice — send what you actually grow.',
            s: 'Cash crops filled the king’s customs house. This is exactly what he wants to see.' } },
      ],
    },
    {
      prompt: 'Choose the trade route your colony will live on.',
      lead: 'coin',
      choices: [
        { label: 'The Atlantic triangle — fish and rum to far ports.',
          v: { ne: V.R, m: V.P, s: V.W },
          fx: { ne: { coin: 10 } },
          fb: {
            ne: 'New England sailed the triangular trade — a fortune, and a hard truth: parts of that triangle bought and sold enslaved human beings. The debrief names it.',
            m: 'Some of your ships joined it, but feeding the colonies pays you better.',
            s: 'This northern trade route is not yours to run — your goods flow straight to England.' } },
        { label: 'Feed the other colonies — coastwise grain trade.',
          v: { ne: V.P, m: V.R, s: V.P },
          fx: { m: { coin: 10 } },
          fb: {
            ne: 'A steady trade, but the open Atlantic paid New England far more.',
            m: 'Everyone eats, and the Breadbasket banks it. A perfect fit.',
            s: 'Selling food up the coast helps, but your cash crops belong on ships to England.' } },
        { label: 'Straight to England — cash crops out, manufactured goods back.',
          v: { ne: V.W, m: V.P, s: V.R },
          fx: { s: { coin: 10 } },
          fb: {
            ne: 'You have little a London market wants from a rocky northern coast.',
            m: 'You could, but your grain sells better and closer, right here in the colonies.',
            s: 'The mercantile bargain: tobacco and rice out, England’s cloth and tools back in.' } },
      ],
    },
  ),
];

// ---------------------------------------------------------------------------
// Assembly. phasesFor(region) compiles the shared ROUNDS into that region's
// step list. Structure is identical across regions (6 phases x 2 steps), so the
// cursor, shuffles, and totals line up — only the answer key differs.
// ---------------------------------------------------------------------------

export function phasesFor(region) {
  return ROUNDS.map((r) => ({
    title: r.title,
    date: r.date,
    image: r.image,
    event: r.event,
    steps: [compileStep(r.d1, region), compileStep(r.d2, region)],
  }));
}

// ---------------------------------------------------------------------------
// Colony Score = food + unity + coin (max 300). Tiers (spec §3.3). An all-right
// run lands ~265-270 (Royal Charter); worst play floors well under 130 (Ghost).
// ---------------------------------------------------------------------------

export const ROYAL_MIN = 230;
export const HOLDS_MIN = 130;

export const ENDINGS = {
  royal: { key: 'royal', title: 'Royal Charter',
    text: 'The king signs your charter. Your colony is real now — named on England’s maps and free to govern itself. Ten hard years built something meant to outlast you.' },
  holds: { key: 'holds', title: 'The Colony Holds On',
    text: 'No royal charter yet, but your colony survives. The fields are planted, the peace is mostly kept, and next spring will come. You are still here — and that is no small thing.' },
  ghost: { key: 'ghost', title: 'Ghost Colony',
    text: 'One winter too many, one broken promise too many, one empty barn too many. Your settlers drift away, or do not wake. Years later a ship finds only an empty palisade and a single word carved into a post — the way Roanoke’s 115 colonists vanished in 1587. Your colony becomes a ghost story.' },
};

export function colonyScore(meters) {
  return (meters.food || 0) + (meters.unity || 0) + (meters.coin || 0);
}

export function endingFor(score) {
  if (score >= ROYAL_MIN) return ENDINGS.royal;
  if (score >= HOLDS_MIN) return ENDINGS.holds;
  return ENDINGS.ghost;
}

// ---------------------------------------------------------------------------
// Region debriefs (spec §3.3, §11). Each names the real colony the player
// resembled, tells the honest history, and — where the real economy turned to
// enslaved labor — says plainly that this game will not let you "play" that.
// ---------------------------------------------------------------------------

export const DEBRIEFS = {
  newengland:
    'You played New England — and you played it the way Massachusetts and Plymouth truly rose. There was no gold and no cash crop in that rocky, frozen ground, so New England turned to the sea: cod, whaling, shipbuilding, and trade made the fortune the soil never could. Tight little towns governed themselves in town meetings, taxed themselves to build the first public schools so every child could read the Bible, and founded Harvard. The Puritans who ran them could be harsh — they banished Roger Williams and Anne Hutchinson for believing differently. And the Atlantic trade that made New England rich had a dark side this game does not hide: parts of the triangular trade bought and sold enslaved human beings. This game never lets you "play" that — but the history names it plainly. Draw a different region and the whole answer key changes.',
  middle:
    'You played the Middle Colonies — the Breadbasket — and you played them the way Pennsylvania and New York really grew. Deep soil and gentle rivers like the Hudson and Delaware grew so much wheat, corn, and rye that Middle farms fed the whole coast. But the real superpower here was toleration: William Penn bought Lenape land in fair treaties and welcomed Quakers, Lutherans, Catholics, and Jews, and busy, mixed Philadelphia boomed because of it. Elected assemblies and church-run schools fit a place of many peoples and many faiths. Draw a different region and the whole answer key changes.',
  southern:
    'You played the South — and you built the land of cash crops the way Virginia and the Carolinas really formed. Warm, long seasons grew tobacco, rice, and indigo for huge profit, so planters spread out across big plantations, met in the House of Burgesses (America’s first elected assembly, 1619), and left most poor children with no school at all. But the game has told you the hardest truth all along: the real plantation economy did not run on the free farm families you recruited. It came to depend on the forced labor of enslaved Africans, held at the very bottom of Southern society. This game will never make buying or holding human beings a "move" you play — but it names, out loud, that this is where the real history went. Draw a different region and the whole answer key changes.',
};

export function debriefFor(region) {
  return DEBRIEFS[region] || '';
}

// ---------------------------------------------------------------------------

export default createStepGame({
  id: 'us-build-a-colony',
  title: 'Build-a-Colony',
  sides: REGION_KEYS,            // the pick + the class grouping (dashboard by region)
  // variants default to `sides`; no branch, so startKeyFor/baseOf/pathOf are identity.
  modes: ['solo'],
  soloRival: false,             // you steer one colony alone — no AI rival
  startMeters: () => ({ ...START_METERS }),
  phasesFor,
  meta: { meters: METERS },     // no map layer
  scoreMeters: colonyScore,
  endingFor,
  debriefFor,
});
