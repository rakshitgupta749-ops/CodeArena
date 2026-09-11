const dsaPrompt = require("./dsaInterviewerPrompt");
const oopPrompt = require("./oopInterviewerPrompt");
const basePrompt = require("./baseInterviewerPrompt");

function getInterviewerPrompt(problemType) {
  switch (problemType) {
    case "DSA":
      return dsaPrompt;

    case "OOP":
      return oopPrompt;

    default:
      return basePrompt;
  }
}

module.exports = getInterviewerPrompt;