const assert = require("assert");
const { scoreRuleBasedAnswer } = require("../src/services/ruleScorer");

// We'll test ruleScorer manually since answerEvaluator requires mocking LLM HTTP requests.

async function runTests() {
  console.log("Running Evaluation Pipeline Tests...\n");

  const qid = "Q01";
  const question = "Why do programmers put a repeated task into a method instead of writing the same steps again and again?";
  const rubric = "Expected spoken answer: Methods avoid code duplication, improve code reuse, and make code easier to maintain.";
  const criteria = [
    { point: "Mentions code reuse or avoiding duplication", marks: 3 },
    { point: "Mentions maintainability or modularity", marks: 2 }
  ];

  console.log("TEST 1: Correct answer (code reuse logic)");
  const ans1 = "Programmers put a repeated task into a method to avoid duplicating code. The method can be called whenever the task is needed, making the program easier to reuse, maintain, read, and modify.";
  const res1 = scoreRuleBasedAnswer({ qid, question, rubric, criteria, answer: ans1 });
  
  assert.ok(res1.score >= 4, `Expected high score, got ${res1.score}`);
  assert.ok(res1.matched.length > 0, "Expected matched concepts");
  console.log("✅ TEST 1 Passed");

  console.log("TEST 2: Strong answer using synonyms");
  const ans2 = "It lets us write logic once and call it multiple times, which improves maintainability and readability.";
  const res2 = scoreRuleBasedAnswer({ qid, question, rubric, criteria, answer: ans2 });
  
  assert.ok(res2.score >= 4, `Expected high score, got ${res2.score}`);
  console.log("✅ TEST 2 Passed");

  console.log("TEST 3: Incorrect answer");
  const ans3 = "A method is used to pass by value and create objects in memory.";
  const res3 = scoreRuleBasedAnswer({ qid, question, rubric, criteria, answer: ans3 });
  
  assert.ok(res3.score === 0, `Expected 0 score, got ${res3.score}`);
  console.log("✅ TEST 3 Passed");

  console.log("\nAll ruleScorer tests passed successfully!");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
