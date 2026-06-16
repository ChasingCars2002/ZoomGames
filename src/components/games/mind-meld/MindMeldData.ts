// ---------------------------------------------------------------------------
// Mind Meld spectrums. Each round picks one pole pair; the hidden target sits
// somewhere between `left` (0) and `right` (100).
// ---------------------------------------------------------------------------

export interface Spectrum {
  id: string;
  left: string;
  right: string;
}

export const SPECTRUMS: Spectrum[] = [
  { id: 's1', left: 'Overrated', right: 'Underrated' },
  { id: 's2', left: 'Cold', right: 'Hot' },
  { id: 's3', left: 'Useless', right: 'Essential' },
  { id: 's4', left: 'Villain', right: 'Hero' },
  { id: 's5', left: 'Boring', right: 'Exciting' },
  { id: 's6', left: 'Cheap', right: 'Expensive' },
  { id: 's7', left: 'Weird', right: 'Normal' },
  { id: 's8', left: 'Scary', right: 'Cute' },
  { id: 's9', left: 'Underdog', right: 'Favorite' },
  { id: 's10', left: 'Forgettable', right: 'Iconic' },
  { id: 's11', left: 'Healthy', right: 'Junk Food' },
  { id: 's12', left: 'Introvert', right: 'Extrovert' },
  { id: 's13', left: 'Low Tech', right: 'High Tech' },
  { id: 's14', left: 'Casual', right: 'Formal' },
  { id: 's15', left: 'Guilty Pleasure', right: 'Respected' },
  { id: 's16', left: 'Common', right: 'Rare' },
  { id: 's17', left: 'Quiet', right: 'Loud' },
  { id: 's18', left: 'Useless Superpower', right: 'Amazing Superpower' },
  { id: 's19', left: 'Bad Movie', right: 'Great Movie' },
  { id: 's20', left: 'Ordinary', right: 'Legendary' },
  { id: 's21', left: 'Soft', right: 'Hard' },
  { id: 's22', left: 'Fancy', right: 'Basic' },
  { id: 's23', left: 'Risky', right: 'Safe' },
  { id: 's24', left: 'Old School', right: 'Modern' },
  { id: 's25', left: 'A Want', right: 'A Need' },
  { id: 's26', left: 'Bad Habit', right: 'Good Habit' },
  { id: 's27', left: 'Wet', right: 'Dry' },
  { id: 's28', left: 'Round', right: 'Pointy' },
  { id: 's29', left: 'Smells Bad', right: 'Smells Great' },
  { id: 's30', left: 'Hard to Spell', right: 'Easy to Spell' },
  { id: 's31', left: 'Comfort Food', right: 'Fine Dining' },
  { id: 's32', left: 'Worst Chore', right: 'Best Chore' },
  { id: 's33', left: 'Underpaid', right: 'Overpaid' },
  { id: 's34', left: 'Movie Night', right: 'Night Out' },
  { id: 's35', left: 'Useless App', right: 'Must-Have App' },
  { id: 's36', left: 'Tame', right: 'Wild' },
  { id: 's37', left: 'Forget Instantly', right: 'Never Forget' },
  { id: 's38', left: 'Bad Gift', right: 'Perfect Gift' },
  { id: 's39', left: 'Overthinking It', right: 'Not Thinking At All' },
  { id: 's40', left: 'Monday Energy', right: 'Friday Energy' },
];
