// ---------------------------------------------------------------------------
// WordScrambleData – Word bank for Word Scramble Race
// ---------------------------------------------------------------------------

export interface ScrambleWord {
  word: string;
  category: string;
  difficulty: 1 | 2 | 3;
  hint: string;
}

export const SCRAMBLE_WORDS: ScrambleWord[] = [
  // =========================================================================
  // ANIMALS
  // =========================================================================
  { word: 'LION', category: 'Animals', difficulty: 1, hint: 'King of the jungle' },
  { word: 'EAGLE', category: 'Animals', difficulty: 1, hint: 'A majestic bird of prey' },
  { word: 'TIGER', category: 'Animals', difficulty: 1, hint: 'Striped big cat from Asia' },
  { word: 'WHALE', category: 'Animals', difficulty: 1, hint: 'Largest mammal in the ocean' },
  { word: 'FALCON', category: 'Animals', difficulty: 2, hint: 'Fastest animal on Earth when diving' },
  { word: 'DOLPHIN', category: 'Animals', difficulty: 2, hint: 'Intelligent marine mammal' },
  { word: 'PENGUIN', category: 'Animals', difficulty: 2, hint: 'Flightless bird that loves the cold' },
  { word: 'CHEETAH', category: 'Animals', difficulty: 2, hint: 'Fastest land animal' },
  { word: 'ELEPHANT', category: 'Animals', difficulty: 2, hint: 'Largest land animal with a trunk' },
  { word: 'CHAMELEON', category: 'Animals', difficulty: 3, hint: 'Lizard known for changing color' },
  { word: 'CROCODILE', category: 'Animals', difficulty: 3, hint: 'Ancient reptile with powerful jaws' },

  // =========================================================================
  // FOOD
  // =========================================================================
  { word: 'CAKE', category: 'Food', difficulty: 1, hint: 'Sweet dessert for celebrations' },
  { word: 'PIZZA', category: 'Food', difficulty: 1, hint: 'Italian dish with cheese and toppings' },
  { word: 'BREAD', category: 'Food', difficulty: 1, hint: 'Staple baked food made from flour' },
  { word: 'SUSHI', category: 'Food', difficulty: 1, hint: 'Japanese dish with rice and fish' },
  { word: 'WAFFLE', category: 'Food', difficulty: 2, hint: 'Breakfast item cooked in a grid pattern' },
  { word: 'NOODLE', category: 'Food', difficulty: 2, hint: 'Long thin pasta or Asian staple' },
  { word: 'PRETZEL', category: 'Food', difficulty: 2, hint: 'Twisted salted snack' },
  { word: 'BURRITO', category: 'Food', difficulty: 2, hint: 'Wrapped Mexican dish with fillings' },
  { word: 'PANCAKE', category: 'Food', difficulty: 2, hint: 'Flat breakfast item cooked on a griddle' },
  { word: 'CHOCOLATE', category: 'Food', difficulty: 3, hint: 'Sweet treat made from cacao' },
  { word: 'CROISSANT', category: 'Food', difficulty: 3, hint: 'Flaky French pastry' },

  // =========================================================================
  // TECHNOLOGY
  // =========================================================================
  { word: 'CODE', category: 'Technology', difficulty: 1, hint: 'Instructions for computers' },
  { word: 'PIXEL', category: 'Technology', difficulty: 1, hint: 'Smallest unit of a digital image' },
  { word: 'ROBOT', category: 'Technology', difficulty: 1, hint: 'Automated machine' },
  { word: 'CLOUD', category: 'Technology', difficulty: 1, hint: 'Remote computing storage' },
  { word: 'LAPTOP', category: 'Technology', difficulty: 2, hint: 'Portable computer' },
  { word: 'CURSOR', category: 'Technology', difficulty: 2, hint: 'The pointer on your screen' },
  { word: 'SERVER', category: 'Technology', difficulty: 2, hint: 'Computer that serves data to others' },
  { word: 'WIDGET', category: 'Technology', difficulty: 2, hint: 'Small app element on a screen' },
  { word: 'NETWORK', category: 'Technology', difficulty: 2, hint: 'Connected group of computers' },
  { word: 'BLUETOOTH', category: 'Technology', difficulty: 3, hint: 'Wireless connection standard' },
  { word: 'ALGORITHM', category: 'Technology', difficulty: 3, hint: 'Step-by-step problem-solving process' },

  // =========================================================================
  // NATURE
  // =========================================================================
  { word: 'RAIN', category: 'Nature', difficulty: 1, hint: 'Water falling from the sky' },
  { word: 'TREE', category: 'Nature', difficulty: 1, hint: 'Tall plant with a trunk and leaves' },
  { word: 'OCEAN', category: 'Nature', difficulty: 1, hint: 'Vast body of salt water' },
  { word: 'RIVER', category: 'Nature', difficulty: 1, hint: 'Flowing body of fresh water' },
  { word: 'FOREST', category: 'Nature', difficulty: 2, hint: 'Large area covered with trees' },
  { word: 'CANYON', category: 'Nature', difficulty: 2, hint: 'Deep valley carved by a river' },
  { word: 'ISLAND', category: 'Nature', difficulty: 2, hint: 'Land surrounded by water' },
  { word: 'GLACIER', category: 'Nature', difficulty: 2, hint: 'Massive slow-moving body of ice' },
  { word: 'VOLCANO', category: 'Nature', difficulty: 2, hint: 'Mountain that erupts with lava' },
  { word: 'WATERFALL', category: 'Nature', difficulty: 3, hint: 'Cascading water over a cliff' },
  { word: 'AVALANCHE', category: 'Nature', difficulty: 3, hint: 'Rapid flow of snow down a slope' },

  // =========================================================================
  // SPORTS
  // =========================================================================
  { word: 'GOAL', category: 'Sports', difficulty: 1, hint: 'What you score in soccer' },
  { word: 'RACE', category: 'Sports', difficulty: 1, hint: 'Competition of speed' },
  { word: 'SERVE', category: 'Sports', difficulty: 1, hint: 'Starting shot in tennis' },
  { word: 'COACH', category: 'Sports', difficulty: 1, hint: 'Person who trains a team' },
  { word: 'SPRINT', category: 'Sports', difficulty: 2, hint: 'Short fast running event' },
  { word: 'BASKET', category: 'Sports', difficulty: 2, hint: 'The hoop in basketball' },
  { word: 'BOXING', category: 'Sports', difficulty: 2, hint: 'Combat sport with gloves' },
  { word: 'TROPHY', category: 'Sports', difficulty: 2, hint: 'Award given to winners' },
  { word: 'CRICKET', category: 'Sports', difficulty: 2, hint: 'Bat-and-ball game popular in England and India' },
  { word: 'MARATHON', category: 'Sports', difficulty: 3, hint: '26.2 mile running race' },
  { word: 'BADMINTON', category: 'Sports', difficulty: 3, hint: 'Racquet sport with a shuttlecock' },

  // =========================================================================
  // GEOGRAPHY
  // =========================================================================
  { word: 'LAKE', category: 'Geography', difficulty: 1, hint: 'Inland body of water' },
  { word: 'DESERT', category: 'Geography', difficulty: 2, hint: 'Dry sandy landscape' },
  { word: 'TUNDRA', category: 'Geography', difficulty: 2, hint: 'Cold treeless biome' },
  { word: 'PLATEAU', category: 'Geography', difficulty: 2, hint: 'Elevated flat land' },
  { word: 'MOUNTAIN', category: 'Geography', difficulty: 2, hint: 'Tall natural elevation of earth' },
  { word: 'PENINSULA', category: 'Geography', difficulty: 3, hint: 'Land surrounded by water on three sides' },
  { word: 'CONTINENT', category: 'Geography', difficulty: 3, hint: 'One of seven large landmasses' },
];
