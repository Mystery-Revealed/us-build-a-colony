// _stepGame.js — a factory that turns linear lists of "steps" into a game
// adapter GameManager can drive. It powers SOLO choice/strategy games.
//
// THREE SHAPES it supports, from one code path:
//   • single-role solo (Hold the Line): everyone plays one commander.
//   • variant solo (President of the Republic): the student PICKS a variant
//     (Houston or Lamar). Same prompts, a DIFFERENT answer key per variant.
//   • BRANCHING variant solo (Surviving the Dust Bowl): the student picks a base
//     family (tenant / owner / town), and MID-GAME a choice can carry
//     `setVariant` to swap the running step list — the stay/go branch. The two
//     branches share an identical first half, so the cursor flows straight
//     through the swap. Grouping/roster still key on the BASE family; the chosen
//     PATH rides along on the side-state (ss.path) for the dashboard.
//
// ONE MORE FIELD (Build-a-Colony): a choice may carry `crisis` (a string, e.g.
// 'starving_time'). It is forwarded verbatim in the resolution so the CLIENT can
// play a dramatic, UNGRADED interstitial. It never touches scoring — accuracy is
// verdict-only — and never changes state; it is pure theatre owned by the client.
//
// A game is a list of PHASES. Each phase has an event card (cinematic image + a
// few sentences) and two graded STEPS. A step offers 3 choices (one right, one
// partial, one wrong — a BRANCH step may offer two rights, both correct). A
// 'map' step's right choice carries a board position; a 'decision' step is plain.
//
// THE ANSWER KEY LIVES HERE, ON THE SERVER. currentPrompt() ships labels only;
// the client submits { kind, choiceIndex } and the server grades it.
//
// Content is keyed by a VARIANT KEY (e.g. 'tenant_stay'). For non-branching games
// the variant key IS the base side. For branching games, several variant keys map
// to one base (tenant_stay + tenant_go -> tenant), the side-state starts on the
// base's default key, and `setVariant` moves it to a sibling key at the branch.

import { accuracyPercent } from '../scoring.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const pointsFor = (verdict) => (verdict === 'right' ? 1 : verdict === 'partial' ? 0.5 : 0);

export function createStepGame({
  id,
  title,
  sides,                  // BASE sides — the pick + class grouping (e.g. ['tenant','owner','town'])
  variants,               // ALL content keys (e.g. ['tenant_stay','tenant_go',...]); defaults to `sides`
  startKeyFor,            // (base) => starting variant key; defaults to identity (base === key)
  baseOf,                 // (variantKey) => base side; defaults to identity
  pathOf,                 // (variantKey) => path label ('stay'|'go'|null); defaults to null
  modes = ['solo'],
  soloRival = false,      // false = no AI opponent in solo (single-role / variant games)
  startMeters,            // () => ({ meterKey: number })
  phasesFor,              // (variantKey) => [{ title, date, image, event, eventEffects?, steps: [step, step] }]
  meta,                   // { meters, positions?, markers? } — display info shipped to clients
  scoreMeters,            // (meters) => number
  endingFor,              // (score, accuracy, meters) => { key, title, text }
  debriefFor,             // (variantKey) => string  (per-path debrief)
}) {
  // Defaults make branching optional: a plain game keys content by its base side.
  const VARIANTS = variants && variants.length ? variants : [...sides];
  const startKey = startKeyFor || ((base) => base);
  const keyBase = baseOf || ((key) => key);
  const keyPath = pathOf || (() => null);

  // Per-variant content. Prompts are shared where variants overlap; only the
  // answer key (verdicts/effects/feedback) differs — structure must match across
  // all variants so the cursor, shuffles, and totals line up.
  const PHASES_BY_KEY = Object.fromEntries(VARIANTS.map((k) => [k, phasesFor(k)]));
  const STEPS_BY_KEY = Object.fromEntries(
    VARIANTS.map((k) => [k, PHASES_BY_KEY[k].flatMap((p) => p.steps)])
  );
  const FIRST = VARIANTS[0];
  const TOTAL = STEPS_BY_KEY[FIRST].length;
  const CHAPTER_COUNT = PHASES_BY_KEY[FIRST].length;
  const POSITION_KEYS = Object.keys(meta.positions || {});

  const stepsOfKey = (key) => STEPS_BY_KEY[key];
  const phasesOfKey = (key) => PHASES_BY_KEY[key];
  const chapterOf = (cursor) => Math.floor(cursor / 2);

  const chapterMeta = (key, idx) => {
    const p = phasesOfKey(key)[idx];
    return { index: idx, count: CHAPTER_COUNT, title: p.title, date: p.date, image: p.image };
  };

  function makeSideState(base, isAI = false) {
    const key = startKey(base);
    const steps = stepsOfKey(key);
    return {
      key,                       // current variant key (moves at the branch)
      base,                      // stable base side — grouping/roster key
      // 'stay' | 'go' | null — shown on the dashboard. Starts null even though
      // `key` already defaults to a running list (e.g. tenant_stay), because the
      // PLAYER hasn't chosen anything yet; it only becomes non-null the moment a
      // choice actually carries setVariant (the branch).
      path: null,
      isAI,
      cursor: 0,                 // 0..TOTAL-1
      meters: { ...startMeters() },
      actions: [],               // [{ stepIndex, kind, verdict, points }]
      eventApplied: -1,          // last phase whose eventEffects were applied
      // Per-match shuffle of each step's choices, so "the first answer" is never a
      // tell. Every step across every variant has the same choice count (3), so a
      // shuffle built from the start key stays valid after a branch swap.
      shuffles: steps.map((step) => shuffle([...step.choices.keys()])),
    };
  }

  function applyEffects(ss, effects = {}) {
    for (const [k, v] of Object.entries(effects)) {
      ss.meters[k] = clamp((ss.meters[k] ?? 0) + v, 0, 100);
    }
  }

  const emptyBoard = () =>
    ({ positions: Object.fromEntries(POSITION_KEYS.map((k) => [k, { markers: [] }])) });

  return {
    id,
    title,
    modes,
    sides,
    soloRival,
    totalActions: TOTAL,
    chapterCount: CHAPTER_COUNT,
    meta,

    // Solo: create only the chosen base side. Versus (unused by these games):
    // create every base side. One human side, no AI rival unless soloRival.
    initMatch({ mode = 'solo', soloSide } = {}) {
      const chosen = mode === 'versus'
        ? [...sides]
        : [sides.includes(soloSide) ? soloSide : sides[0]];
      return {
        mode: mode === 'versus' ? 'versus' : 'solo',
        map: emptyBoard(),
        sides: Object.fromEntries(chosen.map((s) => [s, makeSideState(s)])),
        whoseTurn: chosen[0],
        chapterIndex: 0,
        status: 'active',
        winner: null,
      };
    },

    // The phase event card, applying its one-time meter toll. Null if already shown.
    chapterEvent(state, side) {
      const ss = state.sides[side];
      const idx = chapterOf(ss.cursor);
      if (idx >= CHAPTER_COUNT || ss.eventApplied >= idx) return null;
      const p = phasesOfKey(ss.key)[idx];
      ss.eventApplied = idx;
      if (p.eventEffects) applyEffects(ss, p.eventEffects);
      return {
        chapter: chapterMeta(ss.key, idx),
        text: p.event,
        eventEffects: p.eventEffects || null,
        meters: { ...ss.meters },
      };
    },

    // Non-mutating version, for re-pushing state after a reconnect.
    eventSnapshot(state, side) {
      const ss = state.sides[side];
      const idx = Math.min(chapterOf(ss.cursor), CHAPTER_COUNT - 1);
      const p = phasesOfKey(ss.key)[idx];
      return {
        chapter: chapterMeta(ss.key, idx),
        text: p.event,
        eventEffects: p.eventEffects || null,
        meters: { ...ss.meters },
      };
    },

    // What the player sees now. NO verdicts/effects/feedback leak out.
    currentPrompt(state, side) {
      const ss = state.sides[side];
      if (ss.cursor >= TOTAL) return null;
      const idx = chapterOf(ss.cursor);
      const step = stepsOfKey(ss.key)[ss.cursor];
      const order = ss.shuffles[ss.cursor];
      const base = {
        stepIndex: ss.cursor,
        kind: step.kind,
        chapter: chapterMeta(ss.key, idx),
        meters: { ...ss.meters },
        prompt: step.prompt,
        hint: step.hint || null,
      };
      if (step.kind === 'map') {
        return {
          ...base,
          choices: order.map((i) => ({
            label: step.choices[i].label,
            position: step.choices[i].position || null,
            marker: step.choices[i].marker || null,
          })),
        };
      }
      return { ...base, choices: order.map((i) => step.choices[i].label) };
    },

    // Apply a submitted move. move = { kind, choiceIndex } (choiceIndex is the
    // presented, shuffled index — mapped back to the real choice here).
    resolve(state, side, move) {
      const ss = state.sides[side];
      if (ss.cursor >= TOTAL) return { error: 'side_done' };
      const step = stepsOfKey(ss.key)[ss.cursor];
      if (!move || move.kind !== step.kind) return { error: 'wrong_step_kind' };
      const order = ss.shuffles[ss.cursor];
      const realIndex = order[move.choiceIndex];
      const choice = step.choices[realIndex];
      if (!choice) return { error: 'bad_choice' };

      const effects = choice.effects || {};
      let placed = null;
      if (step.kind === 'map' && choice.position) {
        const marker = choice.marker || 'defenders';
        state.map.positions[choice.position]?.markers.push({ side, marker });
        placed = { position: choice.position, marker };
      }
      applyEffects(ss, effects);

      // THE BRANCH (2-line extension, spec §6): a choice can swap the running step
      // list. Both branch lists share an identical first half, so the cursor —
      // already advanced to the split point — flows straight into the new half.
      if (choice.setVariant && STEPS_BY_KEY[choice.setVariant]) {
        ss.key = choice.setVariant;
        ss.path = keyPath(ss.key);
      }

      ss.actions.push({ stepIndex: ss.cursor, kind: step.kind, verdict: choice.verdict, points: pointsFor(choice.verdict) });
      ss.cursor += 1;

      return {
        side,
        kind: step.kind,
        verdict: choice.verdict,
        feedback: choice.feedback,
        effects,
        placed,
        branchTo: choice.setVariant ? ss.path : null,
        // Ungraded client-only drama (spec §3.2). null unless the choice flags it.
        crisis: choice.crisis || null,
        stepIndex: ss.cursor - 1,
        meters: { ...ss.meters },
        chapterDone: ss.cursor % 2 === 0,
        sideDone: ss.cursor >= TOTAL,
      };
    },

    // The historically right move for `side` right now (used by content/balance
    // tests and the disconnect backfill; not an in-game opponent in solo). At a
    // branch step with two rights, this picks the first — a stable default path.
    aiMove(state, side) {
      const ss = state.sides[side];
      const step = stepsOfKey(ss.key)[ss.cursor];
      const rightIdx = step.choices.findIndex((c) => c.verdict === 'right');
      const shuffledIdx = ss.shuffles[ss.cursor].indexOf(rightIdx);
      return { kind: step.kind, choiceIndex: shuffledIdx };
    },

    isComplete(state) {
      return Object.values(state.sides).every((ss) => ss.cursor >= TOTAL);
    },

    // Final report — one entry per side present in the match. No winner/rival in
    // solo: the value is the score + accuracy + the path's debrief. The perSide
    // key is the BASE side (grouping); `path` and `variantKey` ride along.
    report(state) {
      const perSide = {};
      for (const side of Object.keys(state.sides)) {
        const ss = state.sides[side];
        const score = Math.round(scoreMeters(ss.meters));
        const accuracy = accuracyPercent(ss.actions, TOTAL);
        perSide[side] = {
          isAI: !!ss.isAI,
          base: ss.base,
          path: ss.path,
          variantKey: ss.key,
          score,
          meters: { ...ss.meters },
          accuracy,
          ending: endingFor(score, accuracy, ss.meters),
          debrief: debriefFor(ss.key),
        };
      }
      return { winner: null, owners: null, perSide };
    },
  };
}
