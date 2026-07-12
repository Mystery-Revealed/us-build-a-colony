// games/index.js — registry of playable games. GameManager looks games up here.
// This repo ships one U.S. History Unit 1 game: Build-a-Colony.

import usBuildAColony from './usBuildAColony.js';

export const GAMES = {
  [usBuildAColony.id]: usBuildAColony,
};

export function getGame(id) {
  return GAMES[id] || null;
}
