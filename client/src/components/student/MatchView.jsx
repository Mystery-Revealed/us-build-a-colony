// MatchView.jsx — one round beat at a time: year card → decision → verdict
// flash + feedback. Variant solo (New England / Middle / Southern), so it's
// always your turn. No branch, no map — the drawn region only changes the
// answer key underneath identical prompts. A flagged wrong choice can carry a
// `crisis` id (e.g. 'starving_time'): a dramatic, crimson-trimmed, UNGRADED
// interstitial the client plays instead of the plain feedback card.

import { useEffect, useRef, useState } from 'react';
import { emitAck, errorText } from '../../services/socket.js';
import { Art } from '../../services/assets.jsx';
import MetersBar from '../shared/MetersBar.jsx';

const NAMES = { newengland: 'New England', middle: 'Middle', southern: 'Southern' };
const colonyScore = (m) => (m ? (m.food || 0) + (m.unity || 0) + (m.coin || 0) : 0);

const CRISIS_COPY = {
  starving_time: {
    title: 'Starving Time',
    text: 'The storehouse is bare and winter is not done with you. This is the crisis that emptied real colonies — Jamestown lost hundreds of settlers to a season just like this one. This moment is drama, not your grade: it never changes your score.',
  },
};

export default function MatchView({ state, dispatch }) {
  const { match } = state;
  const { begin, eventCard, turn, feedback } = match;
  const meta = begin.meta;
  const side = begin.side;

  // The engine batches the next round's card+turn together with this round's
  // LAST turn:resolution — eventCard AND turn have both already raced ahead
  // by the time this feedback renders. Pin the header to the last round seen
  // before feedback started so it doesn't read "Round 3" over a Round 2
  // verdict.
  const settledChapterRef = useRef(null);
  if (!feedback) settledChapterRef.current = eventCard?.chapter || turn?.chapter || settledChapterRef.current;
  const phase = feedback ? (settledChapterRef.current || eventCard?.chapter || turn?.chapter) : (eventCard?.chapter || turn?.chapter);
  const lowMeter = Object.entries(match.meters || {}).find(([, v]) => v <= 15);

  return (
    <div className="match">
      <header className="match-header">
        <div className={`nation-chip ${side}`}>{NAMES[side] || side} colony</div>
        <div className="hold-chip" title="Your three meters added up (max 300)">
          Colony Score <b>{colonyScore(match.meters)}</b><span className="muted"> / 300</span>
        </div>
        {phase && (
          <div className="chapter-chip">
            Round {phase.index + 1} of {phase.count} · {phase.date}
          </div>
        )}
      </header>

      <div className="meters-row solo">
        <MetersBar meters={match.meters} meta={meta} title="Your Colony" />
      </div>

      {lowMeter && !feedback && (
        <div className="banner danger" role="alert">
          ⚠️ Your {meta.meters[lowMeter[0]]?.name || lowMeter[0]} is running very low.
        </div>
      )}

      <div className="match-body single">
        <section className="action-panel" aria-live="polite">
          {feedback ? (
            feedback.crisis ? (
              <CrisisPanel
                feedback={feedback}
                meta={meta}
                matchEnded={!!state.matchEnd}
                onContinue={() => dispatch({ type: 'dismiss-feedback' })}
              />
            ) : (
              <FeedbackPanel
                feedback={feedback}
                meta={meta}
                matchEnded={!!state.matchEnd}
                onContinue={() => dispatch({ type: 'dismiss-feedback' })}
              />
            )
          ) : eventCard ? (
            <EventCard eventCard={eventCard} meta={meta} onContinue={() => dispatch({ type: 'dismiss-event' })} />
          ) : turn?.yourTurn && turn.kind === 'decision' ? (
            <DecisionPanel turn={turn} />
          ) : (
            <div className="waiting-panel"><div className="pulse-dot" aria-hidden="true" /><p>Steady…</p></div>
          )}
        </section>
      </div>
    </div>
  );
}

/* -------- panels -------- */

function EventCard({ eventCard, meta, onContinue }) {
  const ch = eventCard.chapter;
  return (
    <div className="event-card">
      <div className="event-kicker">Round {ch.index + 1} of {ch.count} · {ch.date}</div>
      <h2>{ch.title}</h2>
      <Art name={ch.image} alt={ch.title} className="event-art" />
      <p className="event-text">{eventCard.text}</p>
      {eventCard.eventEffects && (
        <div className="effects-row">
          {Object.entries(eventCard.eventEffects).map(([k, v]) => (
            <span key={k} className={`effect-chip ${v > 0 ? 'up' : 'down'}`}>
              {meta.meters[k]?.name} {v > 0 ? `+${v}` : v}
            </span>
          ))}
        </div>
      )}
      <button className="btn big" onClick={onContinue}>Face it</button>
    </div>
  );
}

function DecisionPanel({ turn }) {
  const [busy, setBusy] = useState(false);
  // Synchronous double-click lock. State alone can't stop two clicks landing
  // in the same render frame (both read the stale `busy === false`), and the
  // server acks before pushing turn:resolution — so the second submit would be
  // graded against the NEXT decision (server cursor already advanced). The ref
  // engages immediately; `busy` still drives the disabled styling.
  const busyRef = useRef(false);
  const [err, setErr] = useState('');

  // A new decision arriving always releases the lock — covers a post-reconnect
  // sync replacing the turn in place without remounting this panel.
  useEffect(() => {
    busyRef.current = false;
    setBusy(false);
  }, [turn.stepIndex]);

  async function choose(choiceIndex) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const res = await emitAck('student:submit_move', { move: { kind: 'decision', choiceIndex } });
    // Deliberately NOT unlocked on success: the ack arrives BEFORE the
    // turn:resolution push. The panel unmounts when feedback arrives, or the
    // stepIndex effect above releases the lock.
    if (!res.ok) { setErr(errorText(res.error)); busyRef.current = false; setBusy(false); }
  }

  return (
    <div className="move-panel">
      <h2>🤔 Your decision</h2>
      <p className="prompt">{turn.prompt}</p>
      {turn.hint && <p className="hint">💡 {turn.hint}</p>}
      <div className="choice-list">
        {(turn.choices || []).map((label, i) => (
          <button key={i} className="choice-btn" disabled={busy} onClick={() => choose(i)}>
            {label}
          </button>
        ))}
      </div>
      <p className="err" role="alert">{err}</p>
    </div>
  );
}

const VERDICT_UI = {
  right: { label: 'A choice that helped', className: 'right', icon: '✓' },
  partial: { label: 'A middle path', className: 'partial', icon: '≈' },
  wrong: { label: 'Not the wise move', className: 'wrong', icon: '✗' },
};

function FeedbackPanel({ feedback, meta, matchEnded, onContinue }) {
  const v = VERDICT_UI[feedback.verdict] || VERDICT_UI.partial;
  return (
    <div className="feedback-panel">
      <div className={`verdict-badge ${v.className} flash`}>
        <span aria-hidden="true">{v.icon}</span> {v.label}
      </div>
      <p className="feedback-text">{feedback.feedback}</p>
      <div className="effects-row">
        {Object.entries(feedback.effects || {}).map(([k, val]) => (
          <span key={k} className={`effect-chip ${val > 0 ? 'up' : 'down'}`}>
            {meta.meters[k]?.name} {val > 0 ? `+${val}` : val}
          </span>
        ))}
      </div>
      <button className="btn big" onClick={onContinue}>
        {matchEnded ? 'See how it ends' : 'Continue'}
      </button>
    </div>
  );
}

/* -------- crisis interstitial (spec §3.2: drama only, never graded) -------- */

function CrisisPanel({ feedback, meta, matchEnded, onContinue }) {
  const copy = CRISIS_COPY[feedback.crisis] || { title: 'Crisis', text: '' };
  return (
    <div className="crisis-panel">
      <div className="crisis-kicker">⚠️ Crisis — never graded</div>
      <h2 className="crisis-title">{copy.title}</h2>
      <p className="crisis-text">{copy.text}</p>
      <p className="feedback-text">{feedback.feedback}</p>
      <div className="effects-row">
        {Object.entries(feedback.effects || {}).map(([k, val]) => (
          <span key={k} className={`effect-chip ${val > 0 ? 'up' : 'down'}`}>
            {meta.meters[k]?.name} {val > 0 ? `+${val}` : val}
          </span>
        ))}
      </div>
      <button className="btn big crisis-btn" onClick={onContinue}>
        {matchEnded ? 'See how it ends' : 'Hold on'}
      </button>
    </div>
  );
}
