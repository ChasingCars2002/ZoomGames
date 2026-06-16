// ---------------------------------------------------------------------------
// Emoji Decode puzzles. `emojis` is the rebus; `answer` is canonical and
// `aliases` list other accepted spellings (with/without articles, etc.).
// ---------------------------------------------------------------------------

export interface EmojiPuzzle {
  id: string;
  emojis: string;
  answer: string;
  aliases: string[];
  category: string;
  difficulty: 1 | 2 | 3;
}

export const EMOJI_PUZZLES: EmojiPuzzle[] = [
  // ----- Movies & TV (easy) -----
  { id: 'e1', emojis: '🦁👑', answer: 'The Lion King', aliases: ['Lion King'], category: 'Movies', difficulty: 1 },
  { id: 'e2', emojis: '🕷️🕸️👨', answer: 'Spider-Man', aliases: ['Spiderman'], category: 'Movies', difficulty: 1 },
  { id: 'e3', emojis: '❄️⛄👸', answer: 'Frozen', aliases: [], category: 'Movies', difficulty: 1 },
  { id: 'e4', emojis: '🐠🔍', answer: 'Finding Nemo', aliases: ['Finding Dory'], category: 'Movies', difficulty: 2 },
  { id: 'e5', emojis: '🚢🧊💔', answer: 'Titanic', aliases: [], category: 'Movies', difficulty: 1 },
  { id: 'e6', emojis: '🌌⭐⚔️', answer: 'Star Wars', aliases: ['Starwars'], category: 'Movies', difficulty: 1 },
  { id: 'e7', emojis: '🧙‍♂️💍🌋', answer: 'Lord of the Rings', aliases: ['The Lord of the Rings', 'LOTR'], category: 'Movies', difficulty: 2 },
  { id: 'e8', emojis: '🦇🧍‍♂️', answer: 'Batman', aliases: ['The Batman'], category: 'Movies', difficulty: 1 },
  { id: 'e9', emojis: '👻🚫', answer: 'Ghostbusters', aliases: ['Ghost Busters'], category: 'Movies', difficulty: 2 },
  { id: 'e10', emojis: '🐀👨‍🍳', answer: 'Ratatouille', aliases: [], category: 'Movies', difficulty: 3 },
  { id: 'e11', emojis: '🤖❤️', answer: 'WALL-E', aliases: ['Wall E', 'Walle'], category: 'Movies', difficulty: 2 },
  { id: 'e12', emojis: '🦖🏞️🧬', answer: 'Jurassic Park', aliases: ['Jurassic World'], category: 'Movies', difficulty: 2 },

  // ----- Phrases & idioms -----
  { id: 'e13', emojis: '🍕🕐', answer: 'Pizza Time', aliases: [], category: 'Phrases', difficulty: 1 },
  { id: 'e14', emojis: '🌧️🐱🐶', answer: 'Raining Cats and Dogs', aliases: ['Cats and Dogs'], category: 'Phrases', difficulty: 2 },
  { id: 'e15', emojis: '🍰🚶', answer: 'Piece of Cake', aliases: [], category: 'Phrases', difficulty: 2 },
  { id: 'e16', emojis: '🔥💧', answer: 'Fire and Water', aliases: [], category: 'Phrases', difficulty: 3 },
  { id: 'e17', emojis: '🐦✋🐦🐦🌳', answer: 'A Bird in the Hand', aliases: ['Bird in the Hand'], category: 'Phrases', difficulty: 3 },
  { id: 'e18', emojis: '🌙🚶‍♂️', answer: 'Moonwalk', aliases: ['Moon Walk'], category: 'Phrases', difficulty: 2 },
  { id: 'e19', emojis: '☕☀️', answer: 'Good Morning', aliases: ['Coffee Morning'], category: 'Phrases', difficulty: 2 },
  { id: 'e20', emojis: '👀💡', answer: 'Bright Idea', aliases: ['Eye Idea'], category: 'Phrases', difficulty: 3 },

  // ----- Food -----
  { id: 'e21', emojis: '🍔🍟', answer: 'Burger and Fries', aliases: ['Fast Food', 'Burger Fries'], category: 'Food', difficulty: 1 },
  { id: 'e22', emojis: '🥞🍁', answer: 'Pancakes and Syrup', aliases: ['Pancakes'], category: 'Food', difficulty: 2 },
  { id: 'e23', emojis: '🍎🥧', answer: 'Apple Pie', aliases: [], category: 'Food', difficulty: 1 },
  { id: 'e24', emojis: '🧀🍔', answer: 'Cheeseburger', aliases: ['Cheese Burger'], category: 'Food', difficulty: 1 },
  { id: 'e25', emojis: '🌮🕛', answer: 'Taco Tuesday', aliases: [], category: 'Food', difficulty: 2 },
  { id: 'e26', emojis: '🍦🚚', answer: 'Ice Cream Truck', aliases: [], category: 'Food', difficulty: 2 },
  { id: 'e27', emojis: '🥜🧈🍇', answer: 'Peanut Butter and Jelly', aliases: ['PB and J', 'Peanut Butter Jelly'], category: 'Food', difficulty: 2 },

  // ----- Office / Remote work -----
  { id: 'e28', emojis: '💻📞👥', answer: 'Video Call', aliases: ['Conference Call', 'Zoom Call'], category: 'Office', difficulty: 2 },
  { id: 'e29', emojis: '☕⏸️', answer: 'Coffee Break', aliases: [], category: 'Office', difficulty: 1 },
  { id: 'e30', emojis: '📧📥', answer: 'Inbox', aliases: ['Email Inbox'], category: 'Office', difficulty: 2 },
  { id: 'e31', emojis: '🔇🗣️', answer: 'You Are on Mute', aliases: ['On Mute', 'Youre on Mute'], category: 'Office', difficulty: 2 },
  { id: 'e32', emojis: '🗓️📌', answer: 'Calendar Invite', aliases: ['Meeting Invite'], category: 'Office', difficulty: 3 },
  { id: 'e33', emojis: '⏰💼', answer: 'Nine to Five', aliases: ['9 to 5', 'Work Hours'], category: 'Office', difficulty: 3 },

  // ----- Animals & nature -----
  { id: 'e34', emojis: '🐝🐝', answer: 'Busy Bee', aliases: [], category: 'Nature', difficulty: 2 },
  { id: 'e35', emojis: '🦋🌸', answer: 'Butterfly Garden', aliases: ['Butterfly'], category: 'Nature', difficulty: 2 },
  { id: 'e36', emojis: '🐢🐰', answer: 'Tortoise and the Hare', aliases: ['Turtle and the Hare'], category: 'Nature', difficulty: 3 },
  { id: 'e37', emojis: '🌈🦄', answer: 'Rainbow Unicorn', aliases: [], category: 'Nature', difficulty: 2 },
  { id: 'e38', emojis: '🌊🏄', answer: 'Surfing', aliases: ['Surf'], category: 'Nature', difficulty: 1 },

  // ----- Games & misc -----
  { id: 'e39', emojis: '👾🕹️', answer: 'Video Game', aliases: ['Arcade', 'Video Games'], category: 'Misc', difficulty: 1 },
  { id: 'e40', emojis: '🎸🦸', answer: 'Guitar Hero', aliases: [], category: 'Misc', difficulty: 2 },
  { id: 'e41', emojis: '🛏️🏠', answer: 'Bedroom', aliases: [], category: 'Misc', difficulty: 2 },
  { id: 'e42', emojis: '🌍🎶', answer: 'World Music', aliases: [], category: 'Misc', difficulty: 3 },
  { id: 'e43', emojis: '🔑📥', answer: 'Keyboard', aliases: ['Key Board'], category: 'Misc', difficulty: 3 },
  { id: 'e44', emojis: '🦷🧚', answer: 'Tooth Fairy', aliases: [], category: 'Misc', difficulty: 2 },
  { id: 'e45', emojis: '☀️🌻', answer: 'Sunflower', aliases: ['Sun Flower'], category: 'Nature', difficulty: 1 },
];
