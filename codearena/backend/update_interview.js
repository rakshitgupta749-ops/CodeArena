const fs = require('fs');
const file = '/home/labuser/Desktop/Project/3207854-CodeArena/codearena/backend/src/controllers/interviewController.js';
let content = fs.readFileSync(file, 'utf8');

const t1 = `      } else {
        session.grade = null; // Will be filled by fallback below
      }
    } catch (reportErr) {`;
const r1 = `      } else {
        session.grade = null; // Will be filled by fallback below
      }

      session.candidateReport = {
        strengths: report.strengths || "Strengths pending review.",
        weaknesses: report.weaknesses || "Weaknesses pending review.",
        stars: typeof report.stars === 'number' ? report.stars : 3
      };
    } catch (reportErr) {`;

const t2 = `      session.grade = null;
    }`;
const r2 = `      session.grade = null;
      session.candidateReport = { strengths: "Strengths pending review.", weaknesses: "Weaknesses pending review.", stars: 3 };
    }`;

const t3 = `      session.grade = "Pending Review";
    } else if (!hasValidFeedback) {`;
const r3 = `      session.grade = "Pending Review";
      session.candidateReport = { strengths: "Pending manual review.", weaknesses: "Pending manual review.", stars: 0 };
    } else if (!hasValidFeedback) {`;

const t4 = `        session.feedback = "You faced challenges during the technical interview. More preparation and study of fundamental Java concepts is recommended before advancing to the next round.";
      }
    }`;
const r4 = `        session.feedback = "You faced challenges during the technical interview. More preparation and study of fundamental Java concepts is recommended before advancing to the next round.";
      }
      
      if (!session.candidateReport) {
        session.candidateReport = {
          strengths: "Candidate showed effort during the interview.",
          weaknesses: "More preparation is needed on core concepts.",
          stars: session.overallScore >= 80 ? 5 : session.overallScore >= 60 ? 4 : session.overallScore >= 40 ? 3 : 2
        };
      }
    }`;

function replaceOrLog(t, r) {
    if (content.includes(t)) {
        content = content.replace(t, r);
        console.log("Replaced block (LF)");
    } else {
        const tCrlf = t.replace(/\n/g, '\r\n');
        if (content.includes(tCrlf)) {
            content = content.replace(tCrlf, r.replace(/\n/g, '\r\n'));
            console.log("Replaced block (CRLF)");
        } else {
            console.log("Could not find block:\n" + t);
        }
    }
}

replaceOrLog(t1, r1);
replaceOrLog(t2, r2);
replaceOrLog(t3, r3);
replaceOrLog(t4, r4);

fs.writeFileSync(file, content, 'utf8');
