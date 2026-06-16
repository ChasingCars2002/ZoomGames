// ---------------------------------------------------------------------------
// Team Hangman word & phrase list
// Words may contain spaces and hyphens; non-letters are revealed for free.
// ---------------------------------------------------------------------------

export interface HangmanWord {
  word: string;
  category: string;
  difficulty: 1 | 2 | 3; // 1 = easy, 2 = medium, 3 = hard
}

export const HANGMAN_WORDS: HangmanWord[] = [
  // ----- Easy -----
  { word: 'PIZZA', category: 'Food', difficulty: 1 },
  { word: 'COFFEE', category: 'Food', difficulty: 1 },
  { word: 'TACO', category: 'Food', difficulty: 1 },
  { word: 'DONUT', category: 'Food', difficulty: 1 },
  { word: 'PENGUIN', category: 'Animals', difficulty: 1 },
  { word: 'GIRAFFE', category: 'Animals', difficulty: 1 },
  { word: 'DOLPHIN', category: 'Animals', difficulty: 1 },
  { word: 'HAMSTER', category: 'Animals', difficulty: 1 },
  { word: 'LAPTOP', category: 'Office Life', difficulty: 1 },
  { word: 'KEYBOARD', category: 'Office Life', difficulty: 1 },
  { word: 'MEETING', category: 'Office Life', difficulty: 1 },
  { word: 'DEADLINE', category: 'Office Life', difficulty: 1 },
  { word: 'BEACH', category: 'Travel', difficulty: 1 },
  { word: 'PASSPORT', category: 'Travel', difficulty: 1 },
  { word: 'GUITAR', category: 'Music', difficulty: 1 },
  { word: 'KARAOKE', category: 'Music', difficulty: 1 },
  { word: 'RAINBOW', category: 'Nature', difficulty: 1 },
  { word: 'VOLCANO', category: 'Nature', difficulty: 1 },

  // ----- Medium -----
  { word: 'SPREADSHEET', category: 'Office Life', difficulty: 2 },
  { word: 'BRAINSTORM', category: 'Office Life', difficulty: 2 },
  { word: 'WATER COOLER', category: 'Office Life', difficulty: 2 },
  { word: 'STANDUP MEETING', category: 'Office Life', difficulty: 2 },
  { word: 'OUT OF OFFICE', category: 'Office Life', difficulty: 2 },
  { word: 'REPLY ALL', category: 'Office Life', difficulty: 2 },
  { word: 'SCREEN SHARE', category: 'Remote Work', difficulty: 2 },
  { word: 'YOU ARE ON MUTE', category: 'Remote Work', difficulty: 2 },
  { word: 'VIRTUAL BACKGROUND', category: 'Remote Work', difficulty: 2 },
  { word: 'HOME OFFICE', category: 'Remote Work', difficulty: 2 },
  { word: 'COFFEE BREAK', category: 'Remote Work', difficulty: 2 },
  { word: 'TIME ZONE', category: 'Remote Work', difficulty: 2 },
  { word: 'ROLLER COASTER', category: 'Fun & Games', difficulty: 2 },
  { word: 'TREASURE HUNT', category: 'Fun & Games', difficulty: 2 },
  { word: 'BOARD GAME', category: 'Fun & Games', difficulty: 2 },
  { word: 'ESCAPE ROOM', category: 'Fun & Games', difficulty: 2 },
  { word: 'NORTHERN LIGHTS', category: 'Nature', difficulty: 2 },
  { word: 'SHOOTING STAR', category: 'Nature', difficulty: 2 },
  { word: 'ROAD TRIP', category: 'Travel', difficulty: 2 },
  { word: 'JET LAG', category: 'Travel', difficulty: 2 },
  { word: 'POPCORN MACHINE', category: 'Food', difficulty: 2 },
  { word: 'ICE CREAM SUNDAE', category: 'Food', difficulty: 2 },

  // ----- Hard -----
  { word: 'SYNERGY', category: 'Corporate Buzzwords', difficulty: 3 },
  { word: 'CIRCLE BACK', category: 'Corporate Buzzwords', difficulty: 3 },
  { word: 'LOW-HANGING FRUIT', category: 'Corporate Buzzwords', difficulty: 3 },
  { word: 'MOVE THE NEEDLE', category: 'Corporate Buzzwords', difficulty: 3 },
  { word: 'QUICK WIN', category: 'Corporate Buzzwords', difficulty: 3 },
  { word: 'BANDWIDTH', category: 'Corporate Buzzwords', difficulty: 3 },
  { word: 'JAZZ HANDS', category: 'Fun & Games', difficulty: 3 },
  { word: 'RUBBER DUCK DEBUGGING', category: 'Remote Work', difficulty: 3 },
  { word: 'KEYBOARD WARRIOR', category: 'Remote Work', difficulty: 3 },
  { word: 'ZIGZAG', category: 'Tricky Words', difficulty: 3 },
  { word: 'JUKEBOX', category: 'Tricky Words', difficulty: 3 },
  { word: 'QUIZZICAL', category: 'Tricky Words', difficulty: 3 },
  { word: 'AWKWARD', category: 'Tricky Words', difficulty: 3 },
  { word: 'RHYTHM', category: 'Tricky Words', difficulty: 3 },
  { word: 'OXYGEN', category: 'Tricky Words', difficulty: 3 },
  { word: 'GALAXY QUEST', category: 'Movies & TV', difficulty: 3 },
  { word: 'PLOT TWIST', category: 'Movies & TV', difficulty: 3 },
  { word: 'CLIFFHANGER', category: 'Movies & TV', difficulty: 3 },
];
