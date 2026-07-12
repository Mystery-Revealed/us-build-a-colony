// Datapad.jsx — the student game. A small state machine over socket pushes:
// title → how to play → region draw → join → (approval) → briefing →
// match (6 rounds, 12 decisions) → result. Variant solo, no branch: the SAME
// twelve prompts face every player; the drawn region only changes the answer
// key. The server owns all truth; this component only renders what it's told.

import { useEffect, useReducer, useRef, useState } from 'react';
import { getSocket, emitAck, errorText } from '../../services/socket.js';
import { Art } from '../../services/assets.jsx';
import MatchView from './MatchView.jsx';
import ResultScreen from './ResultScreen.jsx';

const REGIONS = [
  { key: 'newengland', name: 'New England', image: 'card_newengland.jpg',
    tag: 'Rocky coast · long winters · the sea',
    blurb: 'Rocky soil, deep forests, and fine harbors, but long winters and a short growing season. Your fortune is not in the ground — it is in the sea.' },
  { key: 'middle', name: 'Middle Colonies', image: 'card_middle.jpg',
    tag: 'Rich soil · wide rivers · the Breadbasket',
    blurb: 'Fertile soil and a mild climate, with rivers as watery highways to market. This is the Breadbasket, and the most mixed, tolerant place in the colonies.' },
  { key: 'southern', name: 'Southern Colonies', image: 'card_southern.jpg',
    tag: 'Warm & long season · cash crops · plantations',
    blurb: 'Rich soil and a long, warm season — perfect for cash crops grown on big plantations. But the swampy lowlands breed disease.' },
];

const REGION_LABEL = { newengland: 'New England', middle: 'Middle', southern: 'Southern' };

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const initialState = {
  screen: 'title', // title | how | draw | join | waiting_approval | briefing | match | result | ended
  joinCode: '',
  name: '',
  nation: null, // 'newengland' | 'middle' | 'southern' — the drawn/chosen region
  studentId: null,
  error: '',
  endedMessage: '',
  match: null,
  matchEnd: null,
};

function freshMatch(begin) {
  return {
    begin,
    meters: begin.meters,
    eventCard: null,
    turn: null,
    feedback: null,
  };
}

// Merge live payloads (chapter:event, turn:begin, turn:resolution) into the match.
function mergeLive(match, payload) {
  const next = { ...match };
  if (payload.meters) next.meters = payload.meters;
  return next;
}

function reducer(state, action) {
  switch (action.type) {
    case 'ui':
      return { ...state, ...action.patch };
    case 'joined':
      return {
        ...state,
        studentId: action.studentId,
        error: '',
        screen: action.approved ? 'briefing' : 'waiting_approval',
      };
    case 'approved':
      return { ...state, screen: state.screen === 'waiting_approval' ? 'briefing' : state.screen };
    case 'match:begin':
      return { ...state, screen: 'match', matchEnd: null, match: freshMatch(action.payload) };
    case 'chapter:event': {
      if (!state.match) return state;
      const match = mergeLive(state.match, action.payload);
      return { ...state, match: { ...match, eventCard: action.payload } };
    }
    case 'turn:begin': {
      if (!state.match) return state;
      const match = mergeLive(state.match, action.payload);
      return { ...state, match: { ...match, turn: action.payload } };
    }
    case 'turn:resolution': {
      if (!state.match) return state;
      const match = mergeLive(state.match, action.payload);
      return { ...state, match: { ...match, feedback: action.payload } };
    }
    case 'match:end': {
      // Hold the result until pending feedback is dismissed (chronological order).
      const showNow = !state.match?.feedback;
      return { ...state, matchEnd: action.payload, screen: showNow ? 'result' : state.screen };
    }
    case 'dismiss-feedback': {
      if (!state.match) return state;
      if (state.matchEnd) return { ...state, screen: 'result', match: { ...state.match, feedback: null } };
      return { ...state, match: { ...state.match, feedback: null } };
    }
    case 'dismiss-event':
      return state.match ? { ...state, match: { ...state.match, eventCard: null } } : state;
    case 'sync': {
      const s = action.sync;
      if (s.screen === 'waiting_approval') return { ...state, screen: 'waiting_approval' };
      if (s.screen === 'lobby') return { ...state, screen: 'briefing', nation: s.nation };
      if (s.screen === 'result') return { ...state, screen: 'result', matchEnd: s.matchEnd };
      if (s.screen === 'match') {
        const match = freshMatch(s.matchBegin);
        return {
          ...state,
          screen: 'match',
          matchEnd: null,
          match: { ...match, eventCard: s.chapterEvent, turn: s.turn },
        };
      }
      return state;
    }
    case 'removed':
      return { ...initialState, screen: 'join', joinCode: state.joinCode, name: '', error: 'Your teacher removed you from the session. You can join again.' };
    case 'ended':
      return { ...initialState, screen: 'ended', endedMessage: 'Your teacher ended this session. Your colony’s story is told.' };
    case 'play-again':
      return { ...initialState, screen: 'draw', joinCode: state.joinCode, name: state.name };
    default:
      return state;
  }
}

export default function Datapad() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const socket = getSocket();
    const on = (event, type) => {
      const fn = (payload) => dispatch({ type, payload });
      socket.on(event, fn);
      return [event, fn];
    };
    const subs = [
      on('match:begin', 'match:begin'),
      on('chapter:event', 'chapter:event'),
      on('turn:begin', 'turn:begin'),
      on('turn:resolution', 'turn:resolution'),
      on('match:end', 'match:end'),
    ];
    const approved = () => dispatch({ type: 'approved' });
    const removed = () => dispatch({ type: 'removed' });
    const ended = () => dispatch({ type: 'ended' });
    socket.on('join:approved', approved);
    socket.on('student:removed', removed);
    socket.on('session:ended', ended);

    // School wifi blip: the socket reconnects → re-attach and re-sync the screen.
    const onReconnect = async () => {
      const s = stateRef.current;
      if (!s.studentId || !s.joinCode) return;
      const res = await emitAck('student:rejoin', { joinCode: s.joinCode, studentId: s.studentId });
      if (res.ok) dispatch({ type: 'sync', sync: res.sync });
    };
    socket.io.on('reconnect', onReconnect);

    return () => {
      for (const [event, fn] of subs) socket.off(event, fn);
      socket.off('join:approved', approved);
      socket.off('student:removed', removed);
      socket.off('session:ended', ended);
      socket.io.off('reconnect', onReconnect);
    };
  }, []);

  const { screen } = state;
  return (
    <div className="app student-app">
      {screen === 'title' && <TitleScreen onStart={() => dispatch({ type: 'ui', patch: { screen: 'draw' } })} onHow={() => dispatch({ type: 'ui', patch: { screen: 'how' } })} />}
      {screen === 'how' && <HowToPlay onBack={() => dispatch({ type: 'ui', patch: { screen: 'title' } })} />}
      {screen === 'draw' && (
        <RegionDraw
          onPicked={(nation) => dispatch({ type: 'ui', patch: { nation, screen: 'join' } })}
        />
      )}
      {screen === 'join' && <JoinForm state={state} dispatch={dispatch} />}
      {screen === 'waiting_approval' && (
        <WaitCard title="Hold tight!" text="Your teacher is checking names. Your colony’s story will begin in a moment." />
      )}
      {screen === 'briefing' && (
        <WaitCard
          title={`You are steering the ${REGION_LABEL[state.nation] || ''} colony.`}
          text="It’s 1620. Your ship has landed. Your first round is being drawn up — stand ready."
        />
      )}
      {screen === 'match' && state.match && <MatchView state={state} dispatch={dispatch} />}
      {screen === 'result' && state.matchEnd && <ResultScreen state={state} dispatch={dispatch} />}
      {screen === 'ended' && (
        <WaitCard title="Session ended" text={state.endedMessage}>
          <button className="btn" onClick={() => dispatch({ type: 'ui', patch: { ...initialState, screen: 'title' } })}>
            Back to the title screen
          </button>
        </WaitCard>
      )}
      <footer className="app-footer">Made for 8th Grade U.S. History · TEKS 8.2B, 8.10B, 8.11A, 8.12A, 8.31B</footer>
    </div>
  );
}

/* ---------------- small screens ---------------- */

function TitleScreen({ onStart, onHow }) {
  return (
    <div className="card title-screen">
      <Art name="title_hero.jpg" alt="A palisaded settlement at dawn on a wild coastline, a ship at anchor" className="hero-art" />
      <h1 className="game-title">Build-a-Colony</h1>
      <p className="tagline">It’s 1620. Draw a region. Land your settlers. Ten years to earn a charter.</p>
      <p className="title-blurb">
        Draw a region card — <b>New England</b>, <b>Middle</b>, or <b>Southern</b> —
        and steer a brand-new colony for ten years. Every player faces the
        <b> same twelve choices</b>. But the right answer depends entirely on
        your geography — what wins in rocky New England can sink a colony in
        the warm South. Play it again and draw a different region.
      </p>
      <div className="btn-col">
        <button className="btn big" onClick={onStart}>Join your class</button>
        <button className="btn secondary" onClick={onHow}>How to play</button>
      </div>
    </div>
  );
}

function HowToPlay({ onBack }) {
  return (
    <div className="card how-screen">
      <h2>How to play</h2>
      <ol className="how-list">
        <li><b>Draw a region card</b> — New England, Middle, or Southern — or choose one yourself.</li>
        <li><b>Join with your class code</b> and your first name.</li>
        <li><b>Live 6 rounds</b> of your colony’s story, 1620–1630. Each round you make <b>two calls</b> — a decision with 3 choices.</li>
        <li><b>The same choices face every region.</b> The right answer changes with your geography — that difference is the whole lesson.</li>
      </ol>
      <div className="note">
        <b>Winning versus accuracy.</b> Meters are drama. <b>Accuracy measures
        whether you played your region the way real geography and history
        rewarded.</b> The ending names the real colony you resembled.
      </div>
      <h3>Your three meters</h3>
      <ul className="how-list">
        <li>🌾 <b>Food</b> — full barns and fed settlers. Empty barns end colonies.</li>
        <li>🤝 <b>Unity</b> — peace at home and with your neighbors.</li>
        <li>💰 <b>Coin</b> — money and trade, the proof a colony pays.</li>
      </ul>
      <h3>Words to know</h3>
      <ul className="how-list">
        <li><b>Charter</b> — the king’s permission for a colony.</li>
        <li><b>Cash crop</b> — grown to sell, not to eat.</li>
        <li><b>Town meeting</b> — everyone votes directly.</li>
        <li><b>Representative assembly</b> — you elect lawmakers to speak for you.</li>
        <li><b>Toleration</b> — letting others worship differently.</li>
      </ul>
      <button className="btn" onClick={onBack}>Back</button>
    </div>
  );
}

function RegionDraw({ onPicked }) {
  const [order] = useState(() => shuffle(REGIONS));
  const [revealedKey, setRevealedKey] = useState(null);
  const [mode, setMode] = useState('draw'); // 'draw' | 'choose'

  function draw(i) {
    if (revealedKey) return;
    setRevealedKey(order[i].key);
  }

  if (mode === 'choose') {
    return (
      <div className="card draw-screen">
        <h2>Choose your region</h2>
        <p className="muted">Every region faces the same twelve choices — but the right answer changes with the land.</p>
        <div className="family-grid">
          {REGIONS.map((r) => (
            <button key={r.key} type="button" className="family-card" onClick={() => onPicked(r.key)}>
              <Art name={r.image} alt={r.name} className="family-art" />
              <div className="family-name">{r.name}</div>
              <div className="family-tag">{r.tag}</div>
              <p className="family-blurb">{r.blurb}</p>
            </button>
          ))}
        </div>
        <button className="btn ghost" onClick={() => setMode('draw')}>Back to drawing</button>
      </div>
    );
  }

  const revealed = revealedKey ? REGIONS.find((r) => r.key === revealedKey) : null;

  return (
    <div className="card draw-screen">
      <h2>Draw your region</h2>
      <p className="muted">Tap a face-down card. Your colony’s land is chosen the moment you draw.</p>
      {!revealed && (
        <div className="region-card-row">
          {order.map((r, i) => (
            <button key={r.key} type="button" className="region-card facedown" onClick={() => draw(i)} aria-label="Draw a region card">
              <span className="region-card-back">?</span>
            </button>
          ))}
        </div>
      )}
      {revealed && (
        <div className="region-reveal">
          <Art name={revealed.image} alt={revealed.name} className="family-art" />
          <div className="family-name">{revealed.name}</div>
          <div className="family-tag">{revealed.tag}</div>
          <p className="family-blurb">{revealed.blurb}</p>
          <button className="btn big" onClick={() => onPicked(revealed.key)}>Land here</button>
        </div>
      )}
      {!revealed && (
        <button className="btn ghost" onClick={() => setMode('choose')}>Choose instead</button>
      )}
    </div>
  );
}

function JoinForm({ state, dispatch }) {
  const [busy, setBusy] = useState(false);
  const set = (patch) => dispatch({ type: 'ui', patch });

  async function join() {
    if (busy) return;
    setBusy(true);
    set({ error: '' });
    const res = await emitAck('student:join', {
      joinCode: state.joinCode.trim(),
      nickname: state.name.trim(),
      mode: 'solo',
      nation: state.nation,
    });
    setBusy(false);
    if (!res.ok) return set({ error: errorText(res.error) });
    dispatch({ type: 'joined', studentId: res.studentId, approved: res.approved });
  }

  const ready = state.joinCode.length === 6 && state.name.trim().length >= 2 && !!state.nation;

  return (
    <div className="card join-screen">
      <h2>Join your class</h2>
      <div className="region-chip-row">
        <span className={`region-pill ${state.nation}`}>{REGION_LABEL[state.nation]} colony drawn</span>
        <button className="btn ghost small" onClick={() => set({ screen: 'draw' })}>Draw again</button>
      </div>
      <label htmlFor="join-code">Class code</label>
      <input
        id="join-code" inputMode="numeric" autoComplete="off" maxLength={6}
        placeholder="6-digit code" value={state.joinCode}
        onChange={(e) => set({ joinCode: e.target.value.replace(/\D/g, '') })}
      />
      <label htmlFor="join-name">Your first name</label>
      <input
        id="join-name" maxLength={20} placeholder="e.g. Ana R." value={state.name}
        onChange={(e) => set({ name: e.target.value })}
      />

      <p className="err" role="alert">{state.error}</p>
      <div className="btn-col">
        <button className="btn big" disabled={busy || !ready} onClick={join}>
          {busy ? 'Joining…' : 'Begin the story'}
        </button>
        <button className="btn ghost" onClick={() => set({ screen: 'title', error: '' })}>Back</button>
      </div>
    </div>
  );
}

function WaitCard({ title, text, children }) {
  return (
    <div className="card wait-card">
      <div className="pulse-dot" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
