// ResultScreen.jsx — two stories, in order: (1) how the COLONY fared (Colony
// Score + ending tier — Royal Charter / The Colony Holds On / Ghost Colony),
// (2) the score that matters to your teacher — accuracy, how well you played
// your region as real geography and history rewarded — then the region debrief,
// which names the real colony you resembled and nudges a replay in a different
// region (spec §3.3).

import { Art } from '../../services/assets.jsx';

const TIER_CLASS = { royal: 'win', holds: 'mid', ghost: 'low' };
const NAMES = { newengland: 'New England', middle: 'Middle', southern: 'Southern' };
// Only the Ghost Colony ending gets a dedicated image (spec §7's 8-asset
// budget has one ending image); Royal Charter and Colony Holds On reuse the
// hero art — a fitting callback to the ship that landed ten years earlier.
const ENDING_ART = { royal: 'title_hero.jpg', holds: 'title_hero.jpg', ghost: 'ending_ghost.jpg' };

export default function ResultScreen({ state, dispatch }) {
  const end = state.matchEnd;
  const meta = end.meta || state.match?.begin?.meta;
  const you = end.you;
  const ending = you.ending;
  const score = you.score ?? 0;
  const side = end.yourSide;

  return (
    <div className="card result-screen">
      <div className="event-kicker">{NAMES[side] || side} colony</div>
      <h1 className={`result-headline ${TIER_CLASS[ending.key] || 'mid'}`}>{ending.title}</h1>

      <Art
        name={ENDING_ART[ending.key] || 'ending_holds.jpg'}
        alt={ending.key === 'ghost' ? 'An empty palisade gate at dusk, tall grass, one carved post' : 'A colonial settlement, ten years on, under a clearing sky'}
        className="result-art"
      />

      <p className="fall-note">
        This game was never about "winning" the colony. It was about
        <b> whether you played your region the way real geography and history rewarded</b> —
        and your accuracy shows exactly that.
      </p>

      <div className={`ending-block ${TIER_CLASS[ending.key] || 'mid'}`}>
        <p>{ending.text}</p>
      </div>

      <div className="score-block" aria-label="Colony Score">
        <div className="score-head">
          <span className="score-title">🏛️ Colony Score</span>
          <span className="score-num">{score}<span className="muted"> / 300</span></span>
        </div>
        <span className="score-bar-track">
          <span className={`score-bar ${TIER_CLASS[ending.key] || 'mid'}`} style={{ width: `${Math.min(100, (score / 300) * 100)}%` }} />
        </span>
        <div className="meter-final-row">
          {Object.entries(you.meters || {}).map(([k, v]) => (
            <span key={k} className="meter-final">{meta?.meters?.[k]?.name || k}: <b>{v}</b></span>
          ))}
        </div>
      </div>

      <div className="accuracy-block">
        <div className="accuracy-number">{you.accuracy}%</div>
        <div>
          <b>Your accuracy — the score your teacher sees.</b>
          <p>How well your 12 calls matched what real geography and history rewarded in the {NAMES[side] || side} colonies. Meters can tell a different story than the score — accuracy is about the choices, not the drama.</p>
        </div>
      </div>

      <div className="debrief">
        <h3>What really happened</h3>
        <p>{you.debrief}</p>
      </div>

      <div className="btn-col">
        <button className="btn big" onClick={() => dispatch({ type: 'play-again' })}>
          Play again — draw a different region
        </button>
      </div>
    </div>
  );
}
