// ---------------------------------------------------------------------------
// TriviaData – Question bank for Trivia Battle
// ---------------------------------------------------------------------------

export interface TriviaQuestion {
  id: string;
  question: string;
  answers: [string, string, string, string];
  correctIndex: number;
  category: 'Pop Culture' | 'Sports' | 'Science' | 'History' | 'Food';
  difficulty: 'easy' | 'medium' | 'hard';
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  // =========================================================================
  // POP CULTURE
  // =========================================================================
  {
    id: 'pc-01',
    question: 'Which movie franchise features a character named "Optimus Prime"?',
    answers: ['Transformers', 'Power Rangers', 'Pacific Rim', 'Real Steel'],
    correctIndex: 0,
    category: 'Pop Culture',
    difficulty: 'easy',
  },
  {
    id: 'pc-02',
    question: 'What is the name of the fictional continent in "Game of Thrones"?',
    answers: ['Middle-earth', 'Narnia', 'Westeros', 'Azeroth'],
    correctIndex: 2,
    category: 'Pop Culture',
    difficulty: 'easy',
  },
  {
    id: 'pc-03',
    question: 'Which artist released the album "Thriller" in 1982?',
    answers: ['Prince', 'Michael Jackson', 'Stevie Wonder', 'Whitney Houston'],
    correctIndex: 1,
    category: 'Pop Culture',
    difficulty: 'easy',
  },
  {
    id: 'pc-04',
    question: 'In "The Matrix", what color pill does Neo take?',
    answers: ['Blue', 'Green', 'Red', 'Yellow'],
    correctIndex: 2,
    category: 'Pop Culture',
    difficulty: 'medium',
  },
  {
    id: 'pc-05',
    question: 'Which streaming service produced the series "Stranger Things"?',
    answers: ['Hulu', 'Netflix', 'Amazon Prime', 'Disney+'],
    correctIndex: 1,
    category: 'Pop Culture',
    difficulty: 'easy',
  },
  {
    id: 'pc-06',
    question: 'What year was the first iPhone released?',
    answers: ['2005', '2006', '2007', '2008'],
    correctIndex: 2,
    category: 'Pop Culture',
    difficulty: 'medium',
  },
  {
    id: 'pc-07',
    question: 'Which band wrote "Bohemian Rhapsody"?',
    answers: ['The Beatles', 'Led Zeppelin', 'Queen', 'Pink Floyd'],
    correctIndex: 2,
    category: 'Pop Culture',
    difficulty: 'easy',
  },
  {
    id: 'pc-08',
    question: 'In which fictional city does Batman operate?',
    answers: ['Metropolis', 'Star City', 'Gotham City', 'Central City'],
    correctIndex: 2,
    category: 'Pop Culture',
    difficulty: 'easy',
  },
  {
    id: 'pc-09',
    question: 'Which director is known for "Inception", "Interstellar", and "The Dark Knight"?',
    answers: ['Steven Spielberg', 'Christopher Nolan', 'James Cameron', 'Ridley Scott'],
    correctIndex: 1,
    category: 'Pop Culture',
    difficulty: 'medium',
  },
  {
    id: 'pc-10',
    question: 'What is the highest-grossing animated film of all time (as of 2024)?',
    answers: ['Toy Story 4', 'Frozen II', 'The Lion King (2019)', 'Inside Out 2'],
    correctIndex: 3,
    category: 'Pop Culture',
    difficulty: 'hard',
  },

  // =========================================================================
  // SPORTS
  // =========================================================================
  {
    id: 'sp-01',
    question: 'How many players are on a standard soccer team on the field?',
    answers: ['9', '10', '11', '12'],
    correctIndex: 2,
    category: 'Sports',
    difficulty: 'easy',
  },
  {
    id: 'sp-02',
    question: 'In which sport would you perform a "slam dunk"?',
    answers: ['Volleyball', 'Basketball', 'Tennis', 'Handball'],
    correctIndex: 1,
    category: 'Sports',
    difficulty: 'easy',
  },
  {
    id: 'sp-03',
    question: 'Which country has won the most FIFA World Cup titles?',
    answers: ['Germany', 'Argentina', 'Brazil', 'Italy'],
    correctIndex: 2,
    category: 'Sports',
    difficulty: 'medium',
  },
  {
    id: 'sp-04',
    question: 'What is the diameter of a basketball hoop in inches?',
    answers: ['16 inches', '18 inches', '20 inches', '22 inches'],
    correctIndex: 1,
    category: 'Sports',
    difficulty: 'hard',
  },
  {
    id: 'sp-05',
    question: 'Which tennis Grand Slam is played on clay courts?',
    answers: ['Wimbledon', 'US Open', 'Australian Open', 'French Open'],
    correctIndex: 3,
    category: 'Sports',
    difficulty: 'medium',
  },
  {
    id: 'sp-06',
    question: 'How many holes are played in a standard round of golf?',
    answers: ['9', '12', '18', '21'],
    correctIndex: 2,
    category: 'Sports',
    difficulty: 'easy',
  },
  {
    id: 'sp-07',
    question: 'Which athlete has won the most Olympic gold medals of all time?',
    answers: ['Usain Bolt', 'Michael Phelps', 'Carl Lewis', 'Larisa Latynina'],
    correctIndex: 1,
    category: 'Sports',
    difficulty: 'medium',
  },
  {
    id: 'sp-08',
    question: 'In baseball, how many strikes make an out?',
    answers: ['2', '3', '4', '5'],
    correctIndex: 1,
    category: 'Sports',
    difficulty: 'easy',
  },

  // =========================================================================
  // SCIENCE
  // =========================================================================
  {
    id: 'sc-01',
    question: 'What is the chemical symbol for gold?',
    answers: ['Go', 'Gd', 'Au', 'Ag'],
    correctIndex: 2,
    category: 'Science',
    difficulty: 'easy',
  },
  {
    id: 'sc-02',
    question: 'How many bones are in the adult human body?',
    answers: ['186', '206', '226', '256'],
    correctIndex: 1,
    category: 'Science',
    difficulty: 'medium',
  },
  {
    id: 'sc-03',
    question: 'What planet is known as the "Red Planet"?',
    answers: ['Venus', 'Jupiter', 'Mars', 'Saturn'],
    correctIndex: 2,
    category: 'Science',
    difficulty: 'easy',
  },
  {
    id: 'sc-04',
    question: 'What is the powerhouse of the cell?',
    answers: ['Nucleus', 'Ribosome', 'Mitochondria', 'Endoplasmic Reticulum'],
    correctIndex: 2,
    category: 'Science',
    difficulty: 'easy',
  },
  {
    id: 'sc-05',
    question: 'What is the speed of light in a vacuum (approximately)?',
    answers: ['150,000 km/s', '300,000 km/s', '450,000 km/s', '600,000 km/s'],
    correctIndex: 1,
    category: 'Science',
    difficulty: 'medium',
  },
  {
    id: 'sc-06',
    question: 'Which element has the atomic number 1?',
    answers: ['Helium', 'Hydrogen', 'Lithium', 'Carbon'],
    correctIndex: 1,
    category: 'Science',
    difficulty: 'easy',
  },
  {
    id: 'sc-07',
    question: 'What type of bond involves the sharing of electron pairs between atoms?',
    answers: ['Ionic bond', 'Covalent bond', 'Hydrogen bond', 'Metallic bond'],
    correctIndex: 1,
    category: 'Science',
    difficulty: 'medium',
  },
  {
    id: 'sc-08',
    question: 'What phenomenon explains why the sky is blue?',
    answers: ['Reflection', 'Refraction', 'Rayleigh scattering', 'Diffraction'],
    correctIndex: 2,
    category: 'Science',
    difficulty: 'hard',
  },
  {
    id: 'sc-09',
    question: 'How many chromosomes do humans have?',
    answers: ['23', '44', '46', '48'],
    correctIndex: 2,
    category: 'Science',
    difficulty: 'medium',
  },

  // =========================================================================
  // HISTORY
  // =========================================================================
  {
    id: 'hi-01',
    question: 'In what year did World War II end?',
    answers: ['1943', '1944', '1945', '1946'],
    correctIndex: 2,
    category: 'History',
    difficulty: 'easy',
  },
  {
    id: 'hi-02',
    question: 'Who was the first President of the United States?',
    answers: ['Thomas Jefferson', 'John Adams', 'George Washington', 'Benjamin Franklin'],
    correctIndex: 2,
    category: 'History',
    difficulty: 'easy',
  },
  {
    id: 'hi-03',
    question: 'Which ancient civilization built the Machu Picchu complex?',
    answers: ['Aztec', 'Maya', 'Inca', 'Olmec'],
    correctIndex: 2,
    category: 'History',
    difficulty: 'medium',
  },
  {
    id: 'hi-04',
    question: 'The Berlin Wall fell in which year?',
    answers: ['1987', '1988', '1989', '1990'],
    correctIndex: 2,
    category: 'History',
    difficulty: 'medium',
  },
  {
    id: 'hi-05',
    question: 'Who painted the ceiling of the Sistine Chapel?',
    answers: ['Leonardo da Vinci', 'Raphael', 'Michelangelo', 'Donatello'],
    correctIndex: 2,
    category: 'History',
    difficulty: 'medium',
  },
  {
    id: 'hi-06',
    question: 'What was the name of the ship the Pilgrims sailed to America in 1620?',
    answers: ['Santa Maria', 'Mayflower', 'Endeavour', 'Victoria'],
    correctIndex: 1,
    category: 'History',
    difficulty: 'easy',
  },
  {
    id: 'hi-07',
    question: 'Which empire was ruled by Genghis Khan?',
    answers: ['Ottoman Empire', 'Roman Empire', 'Mongol Empire', 'Persian Empire'],
    correctIndex: 2,
    category: 'History',
    difficulty: 'medium',
  },
  {
    id: 'hi-08',
    question: 'The Rosetta Stone was key to deciphering which ancient writing system?',
    answers: ['Cuneiform', 'Egyptian hieroglyphs', 'Linear B', 'Sanskrit'],
    correctIndex: 1,
    category: 'History',
    difficulty: 'hard',
  },

  // =========================================================================
  // FOOD
  // =========================================================================
  {
    id: 'fd-01',
    question: 'What country is the origin of the croissant?',
    answers: ['France', 'Austria', 'Italy', 'Belgium'],
    correctIndex: 1,
    category: 'Food',
    difficulty: 'hard',
  },
  {
    id: 'fd-02',
    question: 'Sushi originated in which country?',
    answers: ['China', 'Korea', 'Japan', 'Thailand'],
    correctIndex: 2,
    category: 'Food',
    difficulty: 'easy',
  },
  {
    id: 'fd-03',
    question: 'What is the main ingredient in guacamole?',
    answers: ['Tomato', 'Avocado', 'Lime', 'Jalapeno'],
    correctIndex: 1,
    category: 'Food',
    difficulty: 'easy',
  },
  {
    id: 'fd-04',
    question: 'Which spice is known as the most expensive in the world by weight?',
    answers: ['Vanilla', 'Cardamom', 'Saffron', 'Cinnamon'],
    correctIndex: 2,
    category: 'Food',
    difficulty: 'medium',
  },
  {
    id: 'fd-05',
    question: 'What type of pasta is shaped like small rice grains?',
    answers: ['Penne', 'Orzo', 'Fusilli', 'Farfalle'],
    correctIndex: 1,
    category: 'Food',
    difficulty: 'medium',
  },
  {
    id: 'fd-06',
    question: 'Which fruit is known as the "king of fruits" in Southeast Asia?',
    answers: ['Mango', 'Lychee', 'Durian', 'Jackfruit'],
    correctIndex: 2,
    category: 'Food',
    difficulty: 'medium',
  },
  {
    id: 'fd-07',
    question: 'What is the primary grain used to make traditional Japanese sake?',
    answers: ['Wheat', 'Barley', 'Rice', 'Corn'],
    correctIndex: 2,
    category: 'Food',
    difficulty: 'easy',
  },
  {
    id: 'fd-08',
    question: 'Which cheese is traditionally used on a classic Margherita pizza?',
    answers: ['Cheddar', 'Parmesan', 'Mozzarella', 'Gouda'],
    correctIndex: 2,
    category: 'Food',
    difficulty: 'easy',
  },
  {
    id: 'fd-09',
    question: 'What is the Scoville scale used to measure?',
    answers: ['Sweetness of sugar', 'Acidity of vinegar', 'Spiciness of peppers', 'Bitterness of coffee'],
    correctIndex: 2,
    category: 'Food',
    difficulty: 'medium',
  },
  {
    id: 'fd-10',
    question: 'Which country produces the most coffee in the world?',
    answers: ['Colombia', 'Vietnam', 'Ethiopia', 'Brazil'],
    correctIndex: 3,
    category: 'Food',
    difficulty: 'hard',
  },
];
