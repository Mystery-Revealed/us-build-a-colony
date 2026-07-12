// content.test.js — structure, triple-answer-key, and historical-balance checks
// on the Build-a-Colony content. The core idea of this game: three regions, the
// SAME twelve prompts, and a DIFFERENT answer key per region. These tests guard
// that (a) every region has exactly one right answer per step so "all-right per
// region = 100%" holds, (b) the keys genuinely differ (a New England-perfect run
// scored under the Southern key is NOT 100%), and (c) the crisis interstitial is
// pure drama that never touches the grade (spec §10).
import test from 'node:test';
import assert from 'node:assert/strict';
import game, {
  METERS, START_METERS, REGIONS, REGION_KEYS,
  phasesFor, colonyScore, endingFor, debriefFor, ENDINGS, ROYAL_MIN, HOLDS_MIN,
} from '../src/games/usBuildAColony.js';

const stepsOf = (region) => phasesFor(region).flatMap((p) => p.steps);
const rightIdx = (region, c) => stepsOf(region)[c].choices.findIndex((ch) => ch.verdict === 'right');
const pointsFor = (v) => (v === 'right' ? 1 : v === 'partial' ? 0.5 : 0);

test('three regions, no branch (variant keys == base sides)', () => {
  assert.deepEqual(game.sides, ['newengland', 'middle', 'southern']);
  assert.deepEqual(REGION_KEYS, ['newengland', 'middle', 'southern']);
  assert.equal(game.soloRival, false, 'you steer one colony alone');
  assert.deepEqual(Object.keys(METERS), ['food', 'unity', 'coin']);
  assert.deepEqual(START_METERS, { food: 50, unity: 50, coin: 50 });
  assert.equal(game.meta.positions, undefined, 'no map layer');
  for (const r of REGION_KEYS) assert.ok(REGIONS[r]?.name, `region ${r} has display info`);
});

test('every region: 6 rounds, 12 decision steps, 3 choices each, all fields present', () => {
  for (const region of REGION_KEYS) {
    const phases = phasesFor(region);
    assert.equal(phases.length, 6, `${region}: six rounds`);
    for (const [i, p] of phases.entries()) {
      assert.ok(p.title && p.date && p.event && p.image, `${region} round ${i} metadata`);
      assert.equal(p.steps.length, 2, `${region} round ${i}: two decisions`);
    }
    const steps = stepsOf(region);
    assert.equal(steps.length, 12, `${region}: 12 graded actions`);
    for (const [c, s] of steps.entries()) {
      assert.equal(s.kind, 'decision', `${region} step ${c} is a decision`);
      assert.equal(s.choices.length, 3, `${region} step ${c}: three choices`);
      for (const ch of s.choices) {
        assert.ok(ch.label?.length > 5, `${region} step ${c} label`);
        assert.ok(['right', 'partial', 'wrong'].includes(ch.verdict), `${region} step ${c} verdict`);
        assert.ok(ch.feedback?.length > 10, `${region} step ${c} feedback`);
        assert.equal(typeof ch.effects, 'object', `${region} step ${c} effects object`);
      }
    }
  }
  assert.equal(game.totalActions, 12);
  assert.equal(game.chapterCount, 6);
});

test('the prompts and choice labels are IDENTICAL across regions — only the key differs', () => {
  for (let c = 0; c < 12; c++) {
    const prompts = REGION_KEYS.map((r) => stepsOf(r)[c].prompt);
    assert.ok(prompts.every((p) => p === prompts[0]), `step ${c}: shared prompt`);
    const labelSets = REGION_KEYS.map((r) => stepsOf(r)[c].choices.map((ch) => ch.label).join(' || '));
    assert.ok(labelSets.every((l) => l === labelSets[0]), `step ${c}: shared choice labels`);
  }
});

test('exactly one right answer per step, per region (this is what makes 100% reachable)', () => {
  for (const region of REGION_KEYS) {
    for (const [c, s] of stepsOf(region).entries()) {
      const rights = s.choices.filter((ch) => ch.verdict === 'right').length;
      assert.equal(rights, 1, `${region} step ${c}: exactly one right`);
    }
  }
});

test('the answer key genuinely differs by region — the three-way splits (1.D1, 1.D2, 5.D2, 6.D1, 6.D2)', () => {
  // step indices: R1D1=0, R1D2=1, R5D2=9, R6D1=10, R6D2=11
  for (const c of [0, 1, 9, 10, 11]) {
    const [ne, m, s] = REGION_KEYS.map((r) => rightIdx(r, c));
    assert.ok(ne !== m && m !== s && ne !== s, `step ${c}: all three regions favor a different choice (NE=${ne}, M=${m}, S=${s})`);
  }
});

// --- Playthrough helpers: drive the adapter directly, honoring the shuffle ----
function playRun(region, pick = 'right') {
  const state = game.initMatch({ mode: 'solo', soloSide: region });
  for (let c = 0; c < game.totalActions; c++) {
    game.chapterEvent(state, region);
    const ss = state.sides[region];
    const step = stepsOf(ss.key)[c];
    // Prefer the requested verdict; if a step lacks it (e.g. no 'wrong' for NE at
    // step 0), fall back to the worst available so a "bad" run is always drivable.
    const order = pick === 'wrong' ? ['wrong', 'partial', 'right'] : ['right', 'partial', 'wrong'];
    let real = -1;
    for (const v of (pick === 'right' ? ['right'] : order)) {
      real = step.choices.findIndex((ch) => ch.verdict === v);
      if (real >= 0) break;
    }
    const choiceIndex = ss.shuffles[c].indexOf(real);
    const res = game.resolve(state, region, { kind: 'decision', choiceIndex });
    assert.ok(!res.error, `step ${c}: ${res.error}`);
  }
  return { report: game.report(state).perSide[region], state };
}

test('all-right down every region = 100% accuracy and a Royal Charter', () => {
  for (const region of REGION_KEYS) {
    const { report } = playRun(region, 'right');
    assert.equal(report.accuracy, 100, `${region}: all right = 100%`);
    assert.equal(report.ending.key, 'royal', `${region}: earns the royal charter`);
    assert.ok(report.score >= ROYAL_MIN, `${region}: score ${report.score} clears ${ROYAL_MIN}`);
    assert.equal(report.base, region);
  }
});

test('KEYS NOT SWAPPED: a New England-perfect run scored under the Southern key is far from 100%', () => {
  // Take NE's right choice at each step; score those same choice indices as Southern.
  let pts = 0;
  for (let c = 0; c < 12; c++) {
    const neChoice = rightIdx('newengland', c);
    pts += pointsFor(stepsOf('southern')[c].choices[neChoice].verdict);
  }
  const asSouthern = Math.round((pts / 12) * 100);
  assert.ok(asSouthern < 70, `NE-perfect scored as Southern = ${asSouthern}% (must be well under 100)`);
  assert.ok(asSouthern > 20, `sanity: the shared-right steps still count (${asSouthern}%)`);

  // And the mirror: a Southern-perfect run scored under the New England key.
  let pts2 = 0;
  for (let c = 0; c < 12; c++) {
    const sChoice = rightIdx('southern', c);
    pts2 += pointsFor(stepsOf('newengland')[c].choices[sChoice].verdict);
  }
  const asNE = Math.round((pts2 / 12) * 100);
  assert.ok(asNE < 70, `Southern-perfect scored as New England = ${asNE}%`);
});

test('the "Starving Time" crisis is flagged where the spec wants it, and never for the mild South', () => {
  const winterTrust = (region) => stepsOf(region)[2].choices.find((c) => /Trust the weather/.test(c.label));
  assert.equal(winterTrust('newengland').crisis, 'starving_time', 'NE: trusting the weather triggers the crisis');
  assert.equal(winterTrust('middle').crisis, 'starving_time', 'Middle: also a killing-winter risk');
  assert.equal(winterTrust('southern').crisis, undefined, 'South: mild winter, no crisis');
});

test('the crisis interstitial NEVER affects the grade — accuracy is verdict-only', () => {
  // Drive New England, taking the crisis choice at the winter step; the score is
  // exactly what the verdicts say — the crisis flag adds nothing to points.
  const state = game.initMatch({ mode: 'solo', soloSide: 'newengland' });
  let sawCrisis = false;
  for (let c = 0; c < 12; c++) {
    game.chapterEvent(state, 'newengland');
    const ss = state.sides.newengland;
    const step = stepsOf(ss.key)[c];
    // At the winter step (2) take the crisis "trust the weather" choice; else all-right.
    const target = c === 2
      ? step.choices.findIndex((ch) => /Trust the weather/.test(ch.label))
      : step.choices.findIndex((ch) => ch.verdict === 'right');
    const res = game.resolve(state, 'newengland', { kind: 'decision', choiceIndex: ss.shuffles[c].indexOf(target) });
    if (res.crisis) sawCrisis = true;
  }
  assert.ok(sawCrisis, 'the resolution surfaced the crisis for the client');
  const report = game.report(state).perSide.newengland;
  // 11 right + 1 wrong (the crisis choice is wrong for NE) = 11/12.
  assert.equal(report.accuracy, Math.round((11 / 12) * 100), 'crisis choice is graded only by its verdict (wrong), nothing more');
});

test('a worst-play run collapses to a Ghost Colony well under the middle tier', () => {
  for (const region of REGION_KEYS) {
    const { report } = playRun(region, 'wrong');
    assert.ok(report.score < HOLDS_MIN, `${region}: worst play (${report.score}) is a Ghost Colony`);
    assert.equal(report.ending.key, 'ghost', `${region}: fades like Roanoke`);
  }
});

test('the tobacco exception: Southern tobacco is right and pays coin; New England tobacco is wrong', () => {
  const tob = (region) => stepsOf(region)[1].choices.find((c) => /Tobacco to sell/.test(c.label));
  assert.equal(tob('southern').verdict, 'right');
  assert.deepEqual(tob('southern').effects, { coin: 10, food: -5 }, 'King Tobacco: coin up, a little food down');
  assert.equal(tob('newengland').verdict, 'wrong', 'tobacco cannot grow in the New England frost');
});

test('Colony Score tiers: royal >= 230, holds 130-229, ghost < 130', () => {
  assert.equal(endingFor(300).key, 'royal');
  assert.equal(endingFor(ROYAL_MIN).key, 'royal');
  assert.equal(endingFor(ROYAL_MIN - 1).key, 'holds');
  assert.equal(endingFor(HOLDS_MIN).key, 'holds');
  assert.equal(endingFor(HOLDS_MIN - 1).key, 'ghost');
  assert.equal(colonyScore({ ...START_METERS }), 150);
  assert.equal(ENDINGS.ghost.title, 'Ghost Colony');
});

test('the required teaching content and sensitivity beats are present per region', () => {
  const allText = (region) =>
    stepsOf(region).flatMap((s) => s.choices.map((c) => `${c.label} ${c.feedback}`)).join(' ')
    + ' ' + debriefFor(region);

  const ne = allText('newengland');
  const m = allText('middle');
  const s = allText('southern');

  assert.match(ne, /Wampanoag/, 'NE names the Wampanoag teaching Plymouth');
  assert.match(ne, /town meeting/i, 'NE names the town meeting');
  assert.match(ne, /Harvard|public school/i, 'NE names the first public schools / Harvard');
  assert.match(ne + m, /Pequot War|King Philip/i, 'the real wars are named as catastrophes');
  assert.match(m, /Penn|Lenape/i, 'Middle names Penn buying Lenape land fairly');
  assert.match(m, /toleran|Quaker/i, 'Middle names toleration / Quakers');
  assert.match(s, /Burgesses/i, 'South names the House of Burgesses');
  assert.match(s, /enslaved/i, 'South names enslaved Africans plainly');
  // Slavery is never a mechanic: the Southern debrief says the game will not let you "play" it.
  assert.match(debriefFor('southern'), /never|not let you|will not/i, 'South debrief says the game refuses to make slavery a move');
  assert.match(ne, /enslaved|human beings/i, 'the triangular-trade truth is named in New England');
});

test('debriefs are region-specific and name the real colony resembled', () => {
  assert.match(debriefFor('newengland'), /Massachusetts|Plymouth/);
  assert.match(debriefFor('middle'), /Pennsylvania|Penn/);
  assert.match(debriefFor('southern'), /Virginia|Carolina/);
  const three = REGION_KEYS.map(debriefFor);
  assert.ok(new Set(three).size === 3, 'all three debriefs differ');
  for (const d of three) assert.match(d, /Draw a different region/, 'each nudges a replay');
});

test('currentPrompt never leaks the answer key (labels only)', () => {
  const state = game.initMatch({ mode: 'solo', soloSide: 'middle' });
  game.chapterEvent(state, 'middle');
  const prompt = game.currentPrompt(state, 'middle');
  assert.equal(prompt.kind, 'decision');
  assert.equal(prompt.choices.length, 3);
  for (const c of prompt.choices) assert.equal(typeof c, 'string');
  assert.ok(!('verdict' in prompt), 'no verdict leaks');
});
