// Temporary sets for development. Replace the text and answer in each entry
// when the final questions arrive; retain set_id, level, and round points.
const practiceSets = {
  L2: [
    ['What is 2 + 3? Enter the number.', '5'],
    ['Which markup language structures a webpage? Enter its abbreviation.', 'html'],
    ['Which computer component is abbreviated CPU? Enter its full name.', 'central processing unit'],
    ['Which HTTP status code means Not Found? Enter the number.', '404'],
    ['Decode this ASCII sequence into a word: 104 101 108 108 111.', 'hello']
  ],
  L3: [
    ['What is 7 + 5? Enter the number.', '12'],
    ['Which stylesheet language controls webpage appearance? Enter its abbreviation.', 'css'],
    ['Which volatile computer memory is abbreviated RAM? Enter its full name.', 'random access memory'],
    ['Which version control tool uses the command "git commit"? Enter its name.', 'git'],
    ['Decode this ASCII sequence into a word: 112 121 116 104 111 110.', 'python']
  ]
};

module.exports = Object.entries(practiceSets).flatMap(([set_id, rounds]) =>
  rounds.map(([question_text, correct_answer], index) => ({
    set_id,
    level: index + 1,
    question_text: `Practice question — temporary event content.\n\n${question_text}`,
    correct_answer,
    points: (index + 1) * 100
  }))
);
