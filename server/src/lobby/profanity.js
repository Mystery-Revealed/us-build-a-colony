// profanity.js — nickname filter. The TEACHER'S APPROVAL is the real gate;
// this just auto-blocks the obvious stuff so a bad word never flashes on the
// roster while the teacher is looking away.

// SUBSTRING MATCHING BLOCKS REAL NAMES. This list previously contained the
// mild entries 'hell', 'damn', 'crap', 'stupid', 'idiot' and matched them as
// substrings — so a student named **Michelle** ("mic-HELL-e") or Shelly was
// told "Please pick a different name" and could not join at all, and Dickinson
// tripped 'dick'. The teacher's approval flow is the real gate here; this list
// only exists so a genuinely ugly word never flashes on the roster while the
// teacher is looking away. Keep it to words with no innocent substring use.
const BLOCKED = [
  'fuck', 'shit', 'bitch', 'cunt', 'pussy', 'nigg', 'whore', 'slut',
  'penis', 'vagina', 'porn', 'rape', 'nazi', 'kkk', 'butthole', 'anus',
];

// Words that ARE offensive standing alone but appear inside ordinary names or
// words, so they are matched only as whole words rather than as substrings.
const BLOCKED_WHOLE_WORD = ['dick', 'cock', 'fag', 'sex', 'hell', 'damn'];

// Returns { ok: boolean, reason?: string, cleaned: string }
export function checkNickname(raw, maxLen = 20) {
  const cleaned = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, maxLen);

  if (cleaned.length < 2) return { ok: false, reason: 'empty', cleaned };

  const squashed = cleaned.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const word of BLOCKED) {
    if (squashed.includes(word)) return { ok: false, reason: 'blocked', cleaned };
  }
  // Whole-word check runs on the SPACED text, so "Michelle" and "Dickinson"
  // pass while a bare "hell" or "Dick" does not.
  const words = cleaned.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const word of BLOCKED_WHOLE_WORD) {
    if (words.includes(word)) return { ok: false, reason: 'blocked', cleaned };
  }
  return { ok: true, cleaned };
}
