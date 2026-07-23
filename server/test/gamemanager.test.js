// gamemanager.test.js — drives the manager exactly the way socketHandlers does
// and inspects the emit instructions it returns. No sockets involved. Build-a-
// Colony is variant solo (draw a region, play alone — no branch, no AI rival),
// so these focus on the solo lifecycle, the per-REGION class grouping, the
// crisis passthrough, and the "still scores /12" promise.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GameManager } from '../src/GameManager.js';
import game, { phasesFor } from '../src/games/usBuildAColony.js';

const PIN = '4242';
const stepsOf = (region) => phasesFor(region).flatMap((p) => p.steps);

function makeSession(manager, { requireApproval = false } = {}) {
  const res = manager.createSession({ pin: PIN, requireApproval });
  assert.ok(res.joinCode, 'session created');
  return res.joinCode;
}

function join(manager, joinCode, nickname, nation = 'newengland') {
  const res = manager.joinStudent({ joinCode, nickname, mode: 'solo', nation });
  assert.ok(!res.error, `join failed: ${res.error}`);
  return res;
}

const eventsOf = (emits, name) => emits.filter((e) => e.event === name);
const studentEvents = (emits, studentId, name) =>
  emits.filter((e) => e.to.type === 'student' && e.to.studentId === studentId && (!name || e.event === name));

function liveSide(manager, joinCode, studentId) {
  const session = manager.registry.get(joinCode);
  const student = session.students.get(studentId);
  const match = session.matches.get(student.matchId);
  return { match, ss: match.gameState.sides[match.side] };
}

// Submit the choice at a specific REAL index (mapped through the shuffle).
function submitReal(manager, joinCode, studentId, realIndex) {
  const { ss } = liveSide(manager, joinCode, studentId);
  const step = stepsOf(ss.key)[ss.cursor];
  const choiceIndex = ss.shuffles[ss.cursor].indexOf(realIndex);
  return manager.submitMove({ joinCode, studentId, move: { kind: step.kind, choiceIndex } });
}

// Play the current step with the historically right move.
function playRight(manager, joinCode, studentId) {
  const { match } = liveSide(manager, joinCode, studentId);
  const move = game.aiMove(match.gameState, match.side);
  return manager.submitMove({ joinCode, studentId, move });
}

function playAllRight(manager, joinCode, studentId) {
  let last;
  for (let i = 0; i < game.totalActions; i++) {
    last = playRight(manager, joinCode, studentId);
    assert.ok(!last.error, `step ${i}: ${last.error}`);
  }
  return last;
}

test('createSession rejects a bad PIN', () => {
  const manager = new GameManager();
  assert.equal(manager.createSession({ pin: 'abc' }).error, 'bad_pin');
  assert.equal(manager.createSession({ pin: '12345' }).error, 'bad_pin');
});

test('the default game is Build-a-Colony', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  assert.equal(manager.registry.get(joinCode).gameId, 'us-build-a-colony');
});

test('teacher ops require the right PIN', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  assert.equal(manager.endSession({ joinCode, pin: '9999' }).error, 'bad_pin');
  assert.equal(manager.setApproval({ joinCode, pin: '0000', requireApproval: false }).error, 'bad_pin');
});

test('a New England colony starts on join and, playing all-right, earns a charter at 100%', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const res = join(manager, joinCode, 'Ana', 'newengland');

  const begin = studentEvents(res.emits, res.studentId, 'match:begin');
  assert.equal(begin.length, 1, 'solo match begins on join');
  assert.equal(begin[0].payload.side, 'newengland');
  assert.equal(begin[0].payload.chapterCount, 6, 'six rounds');
  assert.equal(begin[0].payload.rivalMeters, null, 'you steer one colony alone — no rival');

  const last = playAllRight(manager, joinCode, res.studentId);
  const end = studentEvents(last.emits, res.studentId, 'match:end');
  assert.equal(end.length, 1, 'match ends after 12 actions');
  assert.equal(end[0].payload.you.accuracy, 100);
  assert.equal(end[0].payload.you.ending.key, 'royal', 'all-right earns the royal charter');
  assert.match(end[0].payload.you.debrief, /Massachusetts|Plymouth/, 'New England debrief');

  const roster = manager.roster(manager.registry.get(joinCode));
  assert.equal(roster.students[0].status, 'completed');
  assert.equal(roster.students[0].nation, 'newengland', 'grouped by region');
  assert.equal(roster.students[0].accuracy, 100);
});

test('the teacher sees "in_progress" on the VERY FIRST lobby:update, not a stale "not_started"', () => {
  // Regression: joinStudent used to snapshot the roster before the solo match
  // started, so the teacher's only lobby:update for an auto-start solo join
  // showed the student as not_started until they later completed.
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const res = join(manager, joinCode, 'Ana', 'newengland');
  const lobbyPushes = eventsOf(res.emits, 'lobby:update');
  assert.equal(lobbyPushes.length, 1, 'one roster push on join');
  const me = lobbyPushes[0].payload.students.find((s) => s.id === res.studentId);
  assert.equal(me.status, 'in_progress', 'the roster already reflects the match that just started');
});

test('each region scores 100% all-right, independently', () => {
  for (const region of ['newengland', 'middle', 'southern']) {
    const manager = new GameManager();
    const joinCode = makeSession(manager);
    const res = join(manager, joinCode, 'Pat', region);
    const last = playAllRight(manager, joinCode, res.studentId);
    const end = studentEvents(last.emits, res.studentId, 'match:end')[0];
    assert.equal(end.payload.you.accuracy, 100, `${region}: 100%`);
    assert.equal(end.payload.you.ending.key, 'royal', `${region}: royal charter`);
  }
});

test('the crisis flag rides the resolution to the client (ungraded drama)', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const res = join(manager, joinCode, 'Bea', 'newengland');
  const sid = res.studentId;
  // Play the first two decisions right, then take the "trust the weather" crisis
  // choice at step 2 (Round 2, decision 1).
  playRight(manager, joinCode, sid);
  playRight(manager, joinCode, sid);
  const { ss } = liveSide(manager, joinCode, sid);
  assert.equal(ss.cursor, 2, 'at the winter step');
  const crisisReal = stepsOf(ss.key)[2].choices.findIndex((c) => /Trust the weather/.test(c.label));
  const r = submitReal(manager, joinCode, sid, crisisReal);
  const resolution = studentEvents(r.emits, sid, 'turn:resolution')[0].payload;
  assert.equal(resolution.crisis, 'starving_time', 'the client is told to play the Starving Time interstitial');
  assert.equal(resolution.verdict, 'wrong', 'and it is graded only as a wrong answer');
});

test('class accuracy is grouped by region (newengland / middle / southern)', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const a = join(manager, joinCode, 'Ana', 'newengland');
  const b = join(manager, joinCode, 'Ben', 'newengland');
  const c = join(manager, joinCode, 'Cara', 'southern');
  for (const s of [a, b, c]) playAllRight(manager, joinCode, s.studentId);

  const roster = manager.roster(manager.registry.get(joinCode));
  assert.equal(roster.classAccuracy.newengland.count, 2, 'two New England colonies');
  assert.equal(roster.classAccuracy.newengland.average, 100);
  assert.equal(roster.classAccuracy.southern.count, 1, 'one Southern colony');
  assert.equal(roster.classAccuracy.middle.count, 0, 'nobody drew Middle');
});

test('approval gate: a solo student waits, then starts on approve keeping their region', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager, { requireApproval: true });
  const res = join(manager, joinCode, 'Mara', 'southern');
  assert.equal(res.approved, false);
  assert.equal(studentEvents(res.emits, res.studentId, 'match:begin').length, 0);

  const ok = manager.approveStudent({ joinCode, pin: PIN, studentId: res.studentId });
  assert.equal(studentEvents(ok.emits, res.studentId, 'join:approved').length, 1);
  const begin = studentEvents(ok.emits, res.studentId, 'match:begin');
  assert.equal(begin.length, 1);
  assert.equal(begin[0].payload.side, 'southern', 'their drawn region survived the wait');
});

test('a wrong-kind move is rejected (every step is a decision)', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const res = join(manager, joinCode, 'Ana');
  const bad = manager.submitMove({ joinCode, studentId: res.studentId, move: { kind: 'map', choiceIndex: 0 } });
  assert.equal(bad.error, 'wrong_step_kind');
});

test('rejoin returns a full snapshot of the live turn', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const res = join(manager, joinCode, 'Ana', 'middle');
  playRight(manager, joinCode, res.studentId); // one decision done; another pending

  manager.markDisconnected({ joinCode, studentId: res.studentId });
  const back = manager.rejoinStudent({ joinCode, studentId: res.studentId });
  assert.ok(!back.error);
  assert.equal(back.sync.screen, 'match');
  assert.equal(back.sync.turn.kind, 'decision');
  assert.equal(back.sync.matchBegin.side, 'middle');
  assert.ok(Array.isArray(back.sync.turn.choices) && back.sync.turn.choices.length === 3);
});

test('end_session wipes the session from memory', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  join(manager, joinCode, 'Ana');
  const res = manager.endSession({ joinCode, pin: PIN });
  assert.ok(eventsOf(res.emits, 'session:ended').length >= 2, 'teacher + student notified');
  assert.equal(manager.registry.get(joinCode), undefined);
});

test('students cannot reach teacher data: report requires the PIN', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  assert.equal(manager.sessionReport({ joinCode, pin: '1111' }).error, 'bad_pin');
  assert.ok(manager.sessionReport({ joinCode, pin: PIN }).report);
});
