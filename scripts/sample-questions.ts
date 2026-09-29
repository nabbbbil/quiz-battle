// Prints a sample game for each age group, or just one:
//   npm run sample-questions
//   npm run sample-questions -- 7-8
import { makeQuestionSet } from "../src/game/questions.js";
import { AGE_GROUPS, isAgeGroup } from "../src/shared/ageGroups.js";

const TOTAL_ROUNDS = 10;

const arg = process.argv[2];
if (arg !== undefined && !isAgeGroup(arg)) {
  console.error(`Unknown age group "${arg}". Use one of: ${AGE_GROUPS.map((g) => g.id).join(", ")}`);
  process.exit(1);
}

for (const group of AGE_GROUPS.filter((g) => !arg || g.id === arg)) {
  console.log(`\n${group.label}`);
  makeQuestionSet(group.id, TOTAL_ROUNDS).forEach((q, i) => {
    const choices = q.choices.map((c, j) => (j === q.correctIndex ? `[${c}]` : c)).join("  ");
    console.log(`${String(i + 1).padStart(3)}. ${q.text.padEnd(26)} ${choices}`);
  });
}
console.log("\n[ ] marks the right answer. Run it again for a new set.");
