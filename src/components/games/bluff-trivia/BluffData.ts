// ---------------------------------------------------------------------------
// Bluff Trivia questions. Answers are short and hard-to-guess so players' fake
// answers stay plausible. Keep answers to a few words.
// ---------------------------------------------------------------------------

export interface BluffQuestion {
  id: string;
  question: string;
  answer: string;
  category: string;
  difficulty: 1 | 2 | 3;
}

export const BLUFF_QUESTIONS: BluffQuestion[] = [
  // Science
  { id: 'b1', question: 'A group of flamingos is officially called a ____.', answer: 'flamboyance', category: 'Science', difficulty: 2 },
  { id: 'b2', question: 'The fear of long words is ironically named ____phobia.', answer: 'hippopotomonstrosesquippedalio', category: 'Science', difficulty: 3 },
  { id: 'b3', question: 'The only metal that is liquid at room temperature is ____.', answer: 'mercury', category: 'Science', difficulty: 1 },
  { id: 'b4', question: 'A bolt of lightning is about ____ times hotter than the sun’s surface.', answer: 'five', category: 'Science', difficulty: 2 },
  { id: 'b5', question: 'Bees communicate the location of food by doing a ____ dance.', answer: 'waggle', category: 'Science', difficulty: 2 },
  { id: 'b6', question: 'Human bones are, ounce for ounce, stronger than ____.', answer: 'steel', category: 'Science', difficulty: 2 },

  // History
  { id: 'b7', question: 'The shortest war in history lasted about ____ minutes.', answer: 'thirty-eight', category: 'History', difficulty: 3 },
  { id: 'b8', question: 'Cleopatra lived closer in time to the building of the first ____ than to the pyramids.', answer: 'pizza place', category: 'History', difficulty: 3 },
  { id: 'b9', question: 'Oxford University is older than the ____ civilization.', answer: 'Aztec', category: 'History', difficulty: 2 },
  { id: 'b10', question: 'The Eiffel Tower can grow up to ____ centimeters taller in summer.', answer: 'fifteen', category: 'History', difficulty: 2 },

  // Geography
  { id: 'b11', question: 'The capital of Australia is ____.', answer: 'Canberra', category: 'Geography', difficulty: 1 },
  { id: 'b12', question: 'The country with the most natural lakes is ____.', answer: 'Canada', category: 'Geography', difficulty: 2 },
  { id: 'b13', question: 'The smallest country in the world is ____.', answer: 'Vatican City', category: 'Geography', difficulty: 1 },
  { id: 'b14', question: 'The longest place name in the world is in ____.', answer: 'New Zealand', category: 'Geography', difficulty: 3 },
  { id: 'b15', question: 'Russia spans ____ time zones.', answer: 'eleven', category: 'Geography', difficulty: 2 },

  // Pop culture
  { id: 'b16', question: 'The first item ever sold on eBay was a broken ____.', answer: 'laser pointer', category: 'Pop Culture', difficulty: 3 },
  { id: 'b17', question: 'The original name for the search engine Google was ____.', answer: 'BackRub', category: 'Pop Culture', difficulty: 3 },
  { id: 'b18', question: 'In the game of Monopoly, the man on the logo is named ____.', answer: 'Rich Uncle Pennybags', category: 'Pop Culture', difficulty: 2 },
  { id: 'b19', question: 'The dot over a lowercase i or j is called a ____.', answer: 'tittle', category: 'Pop Culture', difficulty: 3 },
  { id: 'b20', question: 'A “jiffy” is an actual unit of time equal to ____ of a second.', answer: 'one hundredth', category: 'Pop Culture', difficulty: 2 },

  // Animals
  { id: 'b21', question: 'A baby ____ is called a “joey.”', answer: 'kangaroo', category: 'Animals', difficulty: 1 },
  { id: 'b22', question: 'Octopuses have ____ hearts.', answer: 'three', category: 'Animals', difficulty: 2 },
  { id: 'b23', question: 'A group of owls is called a ____.', answer: 'parliament', category: 'Animals', difficulty: 2 },
  { id: 'b24', question: 'Sloths can hold their breath longer than ____.', answer: 'dolphins', category: 'Animals', difficulty: 2 },
  { id: 'b25', question: 'The fingerprints of a ____ are almost identical to a human’s.', answer: 'koala', category: 'Animals', difficulty: 3 },

  // Office / Remote work
  { id: 'b26', question: 'The “@” symbol in email addresses is officially called the ____ in some languages.', answer: 'monkey tail', category: 'Office', difficulty: 3 },
  { id: 'b27', question: 'The first webcam was invented to monitor a ____.', answer: 'coffee pot', category: 'Office', difficulty: 3 },
  { id: 'b28', question: 'The average office worker spends ____ hours a year looking for misplaced items.', answer: 'six weeks', category: 'Office', difficulty: 2 },
  { id: 'b29', question: 'The “Pomodoro” productivity technique is named after a ____.', answer: 'tomato timer', category: 'Office', difficulty: 2 },
  { id: 'b30', question: 'The QWERTY keyboard was designed to ____ typists.', answer: 'slow down', category: 'Office', difficulty: 2 },

  // Food
  { id: 'b31', question: 'Honey never ____.', answer: 'spoils', category: 'Food', difficulty: 1 },
  { id: 'b32', question: 'Carrots were originally ____ in color.', answer: 'purple', category: 'Food', difficulty: 2 },
  { id: 'b33', question: 'Ketchup was once sold as ____.', answer: 'medicine', category: 'Food', difficulty: 2 },
  { id: 'b34', question: 'The most stolen food in the world is ____.', answer: 'cheese', category: 'Food', difficulty: 2 },
  { id: 'b35', question: 'Bananas are botanically classified as ____.', answer: 'berries', category: 'Food', difficulty: 2 },

  // Misc
  { id: 'b36', question: 'A “murmuration” is a group of ____.', answer: 'starlings', category: 'Misc', difficulty: 3 },
  { id: 'b37', question: 'The wobbly bit on a turkey’s neck is called a ____.', answer: 'snood', category: 'Misc', difficulty: 3 },
  { id: 'b38', question: 'The space between your eyebrows is called the ____.', answer: 'glabella', category: 'Misc', difficulty: 3 },
  { id: 'b39', question: 'A “baker’s dozen” equals ____.', answer: 'thirteen', category: 'Misc', difficulty: 1 },
  { id: 'b40', question: 'The plastic tip at the end of a shoelace is called an ____.', answer: 'aglet', category: 'Misc', difficulty: 2 },
];
