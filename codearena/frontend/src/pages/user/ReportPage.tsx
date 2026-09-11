import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Download,
  Trophy,
  CheckCircle2,
  Clock,
  Code2,
  ArrowLeft,
  Star,
  TrendingUp,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api, type Problem, type Difficulty, type InterviewSession } from "@/lib/api";

// ---- Mock evaluation data (to be replaced by backend later) ----
const MOCK_EVALUATION = {
  overallScore: 82,
  grade: "A-",
  round1: {
    status: "Accepted",
    testCasesPassed: 3,
    totalTestCases: 3,
    executionTime: "45ms",
  },
  round2: {
    categories: [
      { name: "Problem Understanding", score: 88, maxScore: 100 },
      { name: "Code Explanation", score: 85, maxScore: 100 },
      { name: "Technical Depth", score: 78, maxScore: 100 },
      { name: "Critical Thinking", score: 72, maxScore: 100 },
    ],
  },
  feedback:
    "Strong problem-solving skills demonstrated. The candidate showed excellent understanding of the problem constraints. Consider deepening knowledge of optimization techniques and edge-case analysis for further improvement.",
};

const difficultyColors: Record<Difficulty, string> = {
  Easy: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  Hard: "bg-red-500/15 text-red-500 border-red-500/30",
};

interface TopicFeedbackItem {
  name: string;
  score: number | null;
  status: string;
  feedback: string;
  strengths: string[];
  issues: string[];
  betterAnswers: string[];
  missedCriteria: string[];
  pendingCount: number;
}

type BehaviorMetricKey = "concept" | "logic";

interface BehaviorMetric {
  key: BehaviorMetricKey;
  label: string;
  score: number;
  status: string;
  description: string;
  barClass: string;
  textClass: string;
}

interface InterviewBehaviorSummary {
  overall: number;
  metrics: BehaviorMetric[];
  summary: string;
}

const BEHAVIOR_PASSING_SCORE = 50;
const TOPIC_LABEL_ALIASES = new Map([
  ["array and arraylist", "Array / ArrayList"],
  ["array / arraylist", "Array / ArrayList"],
  ["class object and constructor", "Class / Object / Constructor"],
  ["class object constructor", "Class / Object / Constructor"],
  ["class / object / constructor", "Class / Object / Constructor"],
  ["control structures and loops", "Control Structures / Loops"],
  ["control structures / loops", "Control Structures / Loops"],
  ["exception handling", "Exception Handling / Runtime Safety"],
  ["exception handling / runtime safety", "Exception Handling / Runtime Safety"],
  ["functions methods parameters and return type", "Functions / Methods / Parameters / Return Type"],
  ["functions / methods / parameters / return type", "Functions / Methods / Parameters / Return Type"],
  ["is-a and has-a relationship inheritance and association", "IS-A / HAS-A Relationship, Inheritance / Association"],
  ["is-a and has-a relationship (inheritance and association)", "IS-A / HAS-A Relationship, Inheritance / Association"],
  ["is-a / has-a relationship inheritance / association", "IS-A / HAS-A Relationship, Inheritance / Association"],
  ["is-a / has-a relationship, inheritance / association", "IS-A / HAS-A Relationship, Inheritance / Association"],
  ["is-a / has-a relationship, inheritance and association", "IS-A / HAS-A Relationship, Inheritance / Association"],
  ["variables and datatypes", "Variables / Data Types"],
  ["variables and data types", "Variables / Data Types"],
  ["variables / data types", "Variables / Data Types"],
]);

function normalizeTopicLabel(value: string | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const key = raw
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[,\-/]+/g, " ")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return TOPIC_LABEL_ALIASES.get(key) || TOPIC_LABEL_ALIASES.get(raw.toLowerCase()) || raw;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function averagePercent(values: number[]) {
  if (values.length === 0) return 0;
  return clampPercent(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getBehaviorStatus(score: number) {
  if (score >= 85) return "Strong";
  if (score >= BEHAVIOR_PASSING_SCORE) return "Meets standard";
  if (score >= 40) return "Needs practice";
  return "Needs review";
}

function getGradeFromScore(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Average";
  return "Needs Practice";
}

function getStarsFromScore(score: number) {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  return 1;
}

function makeBehaviorMetric(
  key: BehaviorMetricKey,
  label: string,
  score: number,
  description: string,
  barClass: string,
  textClass: string
): BehaviorMetric {
  return {
    key,
    label,
    score,
    status: getBehaviorStatus(score),
    description,
    barClass,
    textClass,
  };
}

function scoreEvaluationPercent(finalScore: number | null | undefined) {
  return typeof finalScore === "number" ? clampPercent((finalScore / 5) * 100) : null;
}

function averageScoredAnswers(
  answers: InterviewSession["answers"],
  questions: InterviewSession["questions"],
  predicate: (question: InterviewSession["questions"][number] | undefined) => boolean
) {
  const scores = answers
    .map((answer) => {
      const question = questions.find((item) => item.qid === answer.qid);
      if (!predicate(question)) return null;
      if (
        answer.evaluation?.flag === "EVALUATION_ERROR" ||
        answer.evaluation?.flag === "MANUAL_REVIEW_REQUIRED"
      ) {
        return null;
      }
      return scoreEvaluationPercent(answer.evaluation?.final_score);
    })
    .filter((score): score is number => typeof score === "number");

  return scores.length > 0 ? averagePercent(scores) : null;
}

function isSubmittedCodeQuestion(question: InterviewSession["questions"][number] | undefined) {
  const source = String(question?.source || "").toLowerCase();
  if (source === "submitted_code_llm") return true;
  if (source === "benchmark_csv") return false;

  return Boolean(
    question?.qid?.startsWith("C") ||
    question?.code_anchor?.trim() ||
    question?.code_snippet?.trim() ||
    question?.code_line_start
  );
}

function buildInterviewBehaviorSummary(session: InterviewSession | null): InterviewBehaviorSummary {
  if (!session) {
    const metrics = [
      makeBehaviorMetric(
        "concept",
        "Concept Understanding",
        88,
        "Direct Java concept questions were answered with strong understanding.",
        "bg-violet-500",
        "text-violet-600 dark:text-violet-300"
      ),
      makeBehaviorMetric(
        "logic",
        "Logic / Problem Solving",
        84,
        "Code-related answers connected the shown code to the reasoning path.",
        "bg-emerald-500",
        "text-emerald-600 dark:text-emerald-300"
      ),
    ];
    return {
      metrics,
      overall: averagePercent(metrics.map((metric) => metric.score)),
      summary: "Overall score is equally weighted across concept understanding and logic / problem solving.",
    };
  }

  const answers = session.answers || [];
  if (answers.length === 0) {
    const metrics = [
      makeBehaviorMetric("concept", "Concept Understanding", 0, "No interview answers were submitted.", "bg-violet-500", "text-violet-600 dark:text-violet-300"),
      makeBehaviorMetric("logic", "Logic / Problem Solving", 0, "No interview answers were submitted.", "bg-emerald-500", "text-emerald-600 dark:text-emerald-300"),
    ];
    return {
      metrics,
      overall: 0,
      summary: "Final score will appear after interview answers are available.",
    };
  }

  const allScoredAverage = averageScoredAnswers(
    answers,
    session.questions,
    () => true
  );
  const concept = averageScoredAnswers(
    answers,
    session.questions,
    (question) => !isSubmittedCodeQuestion(question)
  ) ?? allScoredAverage ?? 0;
  const logic = averageScoredAnswers(
    answers,
    session.questions,
    (question) => isSubmittedCodeQuestion(question)
  ) ?? allScoredAverage ?? 0;

  const metrics = [
    makeBehaviorMetric(
      "concept",
      "Concept Understanding",
      concept,
      "Benchmark Java questions: definitions, Java ideas, and fundamental understanding.",
      "bg-violet-500",
      "text-violet-600 dark:text-violet-300"
    ),
    makeBehaviorMetric(
      "logic",
      "Logic / Problem Solving",
      logic,
      "Submitted-code questions: reasoning through behavior, flow, edge cases, and approach.",
      "bg-emerald-500",
      "text-emerald-600 dark:text-emerald-300"
    ),
  ];
  const overall = averagePercent(metrics.map((metric) => metric.score));

  return {
    metrics,
    overall,
    summary:
      overall >= BEHAVIOR_PASSING_SCORE
        ? "Overall score is passing: concept understanding and logic / problem solving each contribute 50%."
        : "Overall score is below benchmark: improve concept answers or code reasoning.",
  };
}

function getTopicStatus(score: number | null) {
  if (score === null) return "Pending Review";
  if (score >= 85) return "Strong";
  if (score >= 65) return "Good Base";
  if (score >= 40) return "Needs Practice";
  return "Revise First";
}

function buildTopicFallbackFeedbackText(
  topic: string,
  score: number | null,
  pendingCount: number
) {
  if (score === null) {
    return `${topic} needs manual review before feedback can be finalized.`;
  }

  if (pendingCount > 0) {
    return `${topic} has a provisional score because ${pendingCount} answer${pendingCount === 1 ? "" : "s"} still need manual review.`;
  }

  return `Detailed evaluator feedback was not returned for ${topic}.`;
}

function ScoreRing({ score, size = 90, strokeWidth = 7 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 90) return "oklch(0.70 0.18 145)";
    if (s >= 75) return "oklch(0.68 0.18 145)";
    if (s >= 60) return "oklch(0.75 0.18 75)";
    return "oklch(0.65 0.22 25)";
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/40"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="score-ring-animated"
          style={{
            "--score-circumference": circumference,
            "--score-offset": offset,
          } as React.CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{score}</span>
        <span className="text-xs text-muted-foreground font-medium">/ 100</span>
      </div>
    </div>
  );
}

function BehaviorMetricIcon({ type }: { type: BehaviorMetricKey }) {
  if (type === "concept") {
    return <FileText className="h-4 w-4" />;
  }

  return <CheckCircle2 className="h-4 w-4" />;
}

function InterviewBehaviorGraph({ summary }: { summary: InterviewBehaviorSummary }) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.35 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Card className="border-border/50 overflow-hidden">
      <div ref={sectionRef}>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Final Interview Score Breakdown
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {summary.summary}
              </p>
            </div>
            <div className="flex items-baseline gap-2 rounded-md border border-border/60 px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Overall</span>
              <span
                className={`text-2xl font-bold ${
                  summary.overall >= BEHAVIOR_PASSING_SCORE
                    ? "text-emerald-600 dark:text-emerald-300"
                    : "text-amber-600 dark:text-amber-300"
                }`}
              >
                {summary.overall}
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative h-72 rounded-md border border-border/60 bg-muted/20 px-5 pb-5 pt-8">
            <div
              className="absolute left-5 right-5 z-20 border-t-2 border-dashed border-amber-500/80"
              style={{ bottom: `${BEHAVIOR_PASSING_SCORE}%` }}
            >
              <span className="absolute -top-6 right-0 rounded-sm bg-background px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                Passing {BEHAVIOR_PASSING_SCORE}%
              </span>
            </div>

            <div className="relative z-10 grid h-full grid-cols-2 items-end gap-5">
              {summary.metrics.map((metric, index) => (
                <div key={metric.key} className="flex h-full flex-col items-center justify-end gap-2">
                  <span
                    className={`text-sm font-bold transition-all duration-500 ${
                      isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                    } ${metric.textClass}`}
                    style={{ transitionDelay: `${index * 140 + 250}ms` }}
                  >
                    {metric.score}%
                  </span>
                  <div className="flex h-[205px] w-full max-w-24 items-end rounded-t-md bg-background/70 shadow-inner">
                    <div
                      className={`w-full rounded-t-md ${metric.barClass} shadow-sm transition-[height] duration-1000 ease-out`}
                      style={{
                        height: isVisible ? `${metric.score}%` : "0%",
                        transitionDelay: `${index * 140}ms`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 divide-y divide-border/60 md:grid-cols-2 md:divide-x md:divide-y-0">
            {summary.metrics.map((metric) => (
              <div key={metric.key} className="px-0 py-4 md:px-5 md:py-0">
                <div className={`mb-2 flex items-center gap-2 text-sm font-semibold ${metric.textClass}`}>
                  <BehaviorMetricIcon type={metric.key} />
                  <span>{metric.label}</span>
                </div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-lg font-bold">{metric.score}%</span>
                  <span className="text-xs font-medium text-muted-foreground">weight 50%</span>
                  <Badge
                    variant="outline"
                    className={
                      metric.score >= BEHAVIOR_PASSING_SCORE
                        ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                    }
                  >
                    {metric.status}
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {metric.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

export function ReportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const problem: Problem | null = location.state?.problem || null;
  const sessionId: string | undefined = location.state?.sessionId;

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(!!sessionId);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [codingFailed, setCodingFailed] = useState(false);
  const [codingScore, setCodingScore] = useState<number | null>(null);

  const { id } = useParams();

  useEffect(() => {
    if (!id) return;
    
    // Check session status to ensure they belong on the report page
    api.get<{ status: string; sessionId?: string; submissionId?: string }>(`/interviews/session-status/${id}`)
      .then((res) => {
        if (res.status === "none") {
          navigate(`/problems/${id}/solve`, { replace: true });
        } else if (res.status === "coding_completed" || res.status === "interview_in_progress") {
          navigate(`/problems/${id}/interview`, { 
            state: { submissionId: res.submissionId },
            replace: true 
          });
        } else if (res.status === "coding_failed") {
          setCodingFailed(true);
          api.get<any[]>("/assignments/me")
            .then((assignments) => {
              const assignment = assignments.find(a => 
                (a.assessment?._id === id || a.assessment === id)
              );
              if (assignment) {
                setCodingScore(assignment.bestCodingScore);
              }
            })
            .catch(console.error)
            .finally(() => setLoadingSession(false));
        } else if (res.status === "interview_completed" && res.sessionId) {
          api.get<InterviewSession>(`/interviews/${res.sessionId}`)
            .then(setSession)
            .catch(console.error)
            .finally(() => setLoadingSession(false));
        }
      })
      .catch((err) => {
        console.error("Failed to check session status:", err);
        setLoadingSession(false);
      });
  }, [id, navigate]);

  const now = new Date();

  // Compute evaluation stats from session answers
  let feedback = MOCK_EVALUATION.feedback;
  let topicFeedback: TopicFeedbackItem[] = MOCK_EVALUATION.round2.categories.map((category) => ({
    name: category.name,
    score: category.score,
    status: getTopicStatus(category.score),
    feedback: buildTopicFallbackFeedbackText(category.name, category.score, 0),
    strengths: [],
    issues: [],
    betterAnswers: [],
    missedCriteria: [],
    pendingCount: 0,
  }));
  let answeredCount = 10;
  let pendingEvaluationCount = 0;
  const totalQuestionCount = session?.questions.length || 10;

  if (session) {
    answeredCount = session.answers.length;
    topicFeedback = [];
    feedback =
      session.feedback && session.feedback !== "Pending evaluation."
        ? session.feedback
        : "Interview evaluation is pending.";

    let totalScoreSum = 0;
    let scoredAnswers = 0;
    const topicScores = new Map<string, {
      score: number;
      max: number;
      strengths: Set<string>;
      issues: Set<string>;
      betterAnswers: Set<string>;
      missedCriteria: Set<string>;
      pendingCount: number;
    }>();

    const ensureTopicScore = (topic: string) => {
      const current = topicScores.get(topic) || {
        score: 0,
        max: 0,
        strengths: new Set<string>(),
        issues: new Set<string>(),
        betterAnswers: new Set<string>(),
        missedCriteria: new Set<string>(),
        pendingCount: 0,
      };
      topicScores.set(topic, current);
      return current;
    };

    session.answers.forEach(a => {
      const question = session.questions.find(q => q.qid === a.qid);
      const topic = normalizeTopicLabel(question?.dimension) || "Java Understanding";
      const evaluationUnavailable =
        a.evaluation?.flag === "EVALUATION_ERROR" ||
        a.evaluation?.flag === "MANUAL_REVIEW_REQUIRED";

      if (
        a.evaluation &&
        typeof a.evaluation.final_score === "number" &&
        !evaluationUnavailable
      ) {
        totalScoreSum += a.evaluation.final_score;
        scoredAnswers++;
        const current = ensureTopicScore(topic);
        current.score += a.evaluation.final_score;
        current.max += 5;

        a.evaluation.teacher_feedback?.what_went_well?.forEach((item) => {
          if (item.trim()) current.strengths.add(item.trim());
        });
        a.evaluation.teacher_feedback?.what_was_missing?.forEach((item) => {
          if (item.trim()) current.issues.add(item.trim());
        });
        if (a.evaluation.teacher_feedback?.better_answer?.trim()) {
          current.betterAnswers.add(a.evaluation.teacher_feedback.better_answer.trim());
        }

        Object.values(a.evaluation.best_breakdown || {}).forEach((criterion) => {
          if (criterion.score < criterion.max) {
            current.missedCriteria.add(criterion.label || criterion.reason);
            if (criterion.issue?.trim()) current.issues.add(criterion.issue.trim());
          }
          if (criterion.expected?.trim()) current.betterAnswers.add(criterion.expected.trim());
        });
      } else {
        pendingEvaluationCount++;
        ensureTopicScore(topic).pendingCount++;
      }
    });

    if (scoredAnswers > 0) {
      const interviewAnswerScore = Math.round((totalScoreSum / (scoredAnswers * 5)) * 100);
      topicFeedback = Array.from(topicScores.entries()).map(([name, values]) => {
        const score = values.max > 0 ? Math.round((values.score / values.max) * 100) : null;
        const missedCriteria = Array.from(values.missedCriteria);
        const strengths = Array.from(values.strengths);
        const issues = Array.from(values.issues);
        const betterAnswers = Array.from(values.betterAnswers);

        return {
          name,
          score,
          status: getTopicStatus(score),
          feedback: buildTopicFallbackFeedbackText(name, score, values.pendingCount),
          strengths,
          issues,
          betterAnswers,
          missedCriteria,
          pendingCount: values.pendingCount,
        };
      });

      if (session.feedback && session.feedback !== "Pending evaluation.") {
        feedback = session.feedback;
      } else {
        if (interviewAnswerScore >= 80) {
          feedback = "The scored answers show strong Java understanding.";
        } else if (interviewAnswerScore >= 60) {
          feedback = "The scored answers show a good foundation, with some question-specific points to revise.";
        } else {
          feedback = "Review the missed answer criteria shown under each question before the next attempt.";
        }
      }
    } else if (session.answers.length > 0) {
      feedback =
        "Automatic scoring was unavailable, so no performance judgment was made. The interview answers need manual review.";
      topicFeedback = Array.from(topicScores.entries()).map(([name, values]) => ({
        name,
        score: null,
        status: getTopicStatus(null),
        feedback: buildTopicFallbackFeedbackText(name, null, values.pendingCount),
        strengths: [],
        issues: [],
        betterAnswers: [],
        missedCriteria: [],
        pendingCount: values.pendingCount,
      }));
    }

  }

  // Compute round1 stats from submission if available
  const round1 = { ...MOCK_EVALUATION.round1 };
  if (session && typeof session.submission === 'object' && session.submission !== null) {
    const submission = session.submission;
    if (submission.testCaseResults && Array.isArray(submission.testCaseResults)) {
      const passedCount = submission.testCaseResults.filter((tc) => tc.passed).length;
      round1.testCasesPassed = passedCount;
      round1.totalTestCases = submission.testCaseResults.length;
      round1.status = passedCount === submission.testCaseResults.length ? "Accepted" : "Partial";
    }
    if (submission.executionTime) {
      round1.executionTime = submission.executionTime;
    }
  }

  const behaviorSummary = buildInterviewBehaviorSummary(session);
  const finalOverallScore = session?.overallScore ?? (codingFailed ? (codingScore || 0) : behaviorSummary.overall);
  const finalStars = codingFailed 
    ? getStarsFromScore(finalOverallScore) 
    : (session?.candidateReport?.stars ?? getStarsFromScore(finalOverallScore));

  const eval_ = {
    ...MOCK_EVALUATION,
    overallScore: finalOverallScore,
    grade: session?.grade ?? (codingFailed ? "Failed" : (pendingEvaluationCount > 0 ? "Pending Review" : getGradeFromScore(finalOverallScore))),
    feedback: session?.feedback ?? (codingFailed ? "Candidate failed the coding assessment and the interview was skipped." : feedback),
    round1,
    stars: finalStars,
  };

  if (loadingSession) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleDownload = () => {
    window.print();
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background print-container">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Back + Download */}
        <div className="flex items-center justify-between no-print">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/problems")}
            className="gap-2 text-muted-foreground hover:text-foreground"
            id="back-to-problems-btn"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Problems
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="gap-2"
            id="download-report-btn"
          >
            <Download className="w-4 h-4" />
            Download Report
          </Button>
        </div>

        {/* Report Title Card */}
        <Card className="border-border/50 overflow-hidden p-0">
          <div className="bg-[oklch(0.58_0.18_145)] p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-white/70" />
                  <span className="text-white/70 text-sm font-medium uppercase tracking-wider">Evaluation Report</span>
                </div>
                <h1 className="text-2xl font-bold mb-1">{problem?.title || "Coding Challenge"}</h1>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-white/20 text-white text-[10px] font-semibold">
                        {user?.name?.split(" ").map(n => n[0]).join("") || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{user?.name || "Candidate"}</span>
                  </div>
                  <span className="text-white/50">•</span>
                  <span className="text-sm text-white/70">
                    {now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                  {problem && (
                    <>
                      <span className="text-white/50">•</span>
                      <Badge variant="outline" className={`${difficultyColors[problem.difficulty]} text-xs border-white/30 text-white bg-white/10`}>
                        {problem.difficulty}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-300" />
                  <span className="text-xl font-bold">{eval_.grade}</span>
                </div>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${i < eval_.stars ? "text-amber-400 fill-amber-400" : "text-white/30"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Overall Score + Round 1 Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Overall Score */}
          <Card className="border-border/50">
            <CardHeader className="pb-1.5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                {codingFailed ? "Coding Score" : (pendingEvaluationCount > 0 ? "Provisional Score" : "Overall Score")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center py-2">
              {typeof eval_.overallScore === "number" ? (
                <>
                  <ScoreRing score={eval_.overallScore} />
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    {eval_.overallScore >= 80
                      ? "Excellent performance!"
                      : eval_.overallScore >= 60
                      ? "Good performance with room to grow."
                      : "Keep practicing and improving!"}
                  </p>
                </>
              ) : (
                <div className="min-h-[120px] flex flex-col items-center justify-center text-center">
                  <Clock className="w-8 h-8 text-amber-500 mb-2" />
                  <p className="font-semibold">Pending review</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No automatic score was assigned.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Round 1 Card */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Code2 className="w-4 h-4 text-primary" />
                Round 1 — Coding (30%)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="outline" className={!codingFailed ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-xs" : "bg-red-500/15 text-red-500 border-red-500/30 text-xs"}>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {!codingFailed ? "Passed" : "Failed"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Score</span>
                <div>
                  <span className="text-sm font-medium">
                    {codingFailed ? (codingScore ?? 0) : (session?.codingScore ?? 0)}%
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">(Passing: 50%)</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Execution Time</span>
                <span className="text-sm font-mono text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {eval_.round1.executionTime || "N/A"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Round 2 Summary Card */}
          <Card className="border-border/50">
            <CardHeader className="pb-2.5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Round 2 — Interview (70%)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Questions</span>
                <span className="text-sm font-medium">{answeredCount}/{totalQuestionCount} answered</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Score</span>
                <div>
                  <span className="text-sm font-semibold">
                    {session?.interviewScore ?? 0}%
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">(Passing: {BEHAVIOR_PASSING_SCORE}%)</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Status
                </span>
                <span className={`text-sm font-medium ${codingFailed ? 'text-red-500' : pendingEvaluationCount > 0 ? 'text-amber-500' : ((session?.interviewScore ?? 0) >= BEHAVIOR_PASSING_SCORE) ? 'text-emerald-500' : 'text-red-500'}`}>
                  {codingFailed ? "Not Qualified" : (pendingEvaluationCount > 0
                    ? `${pendingEvaluationCount} pending`
                    : ((session?.interviewScore ?? 0) >= BEHAVIOR_PASSING_SCORE)
                      ? "Passed"
                      : "Failed")}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {user?.role === "user" ? (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Performance Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-semibold">Overall Rating</span>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${
                          i < eval_.stars
                            ? "text-amber-400 fill-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 mb-1.5"><TrendingUp className="w-4 h-4"/> Strengths</span>
                    <div className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
                      {codingFailed 
                        ? "Attempted to solve the coding assessment and submitted solutions." 
                        : session?.candidateReport?.strengths || "Strengths pending evaluation."}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2 mb-1.5"><Clock className="w-4 h-4"/> Areas for Improvement</span>
                    <div className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
                      {codingFailed 
                        ? "Core logic and problem-solving skills need improvement. Did not pass the required test cases." 
                        : session?.candidateReport?.weaknesses || "Areas for improvement pending evaluation."}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {!codingFailed && <InterviewBehaviorGraph summary={behaviorSummary} />}

            {/* Topic Feedback */}
            {!codingFailed && (
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Topic Feedback (Admin Only)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topicFeedback.length > 0 ? (
                    <div className="space-y-3">
                      {topicFeedback.map((topic) => (
                        <div key={topic.name} className="p-4 rounded-xl bg-muted/30 border border-border/50">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div>
                              <p className="text-sm font-semibold">{topic.name}</p>
                              <p className="text-xs text-muted-foreground">{topic.status}</p>
                            </div>
                            <Badge
                              variant="outline"
                              className={
                                topic.score === null
                                  ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                                  : topic.score >= 75
                                    ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                                    : topic.score >= 50
                                      ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                                      : "bg-red-500/15 text-red-600 border-red-500/30"
                              }
                            >
                              {topic.score === null ? "Pending" : `${topic.score}%`}
                            </Badge>
                          </div>
                          <ul className="list-disc pl-5 text-sm leading-relaxed text-foreground space-y-1">
                            {topic.strengths.slice(0, 2).map((item) => (
                              <li key={`strength-${item}`}>
                                What went well: {item}
                              </li>
                            ))}
                            {topic.issues.slice(0, 2).map((item) => (
                              <li key={`issue-${item}`} className="text-muted-foreground">
                                Issue: {item}
                              </li>
                            ))}
                            {topic.betterAnswers.slice(0, 1).map((item) => (
                              <li key={`better-${item}`} className="text-muted-foreground">
                                Better answer should include: {item}
                              </li>
                            ))}
                            {topic.strengths.length === 0 &&
                              topic.issues.length === 0 &&
                              topic.betterAnswers.length === 0 && (
                              <li>{topic.feedback}</li>
                            )}
                            {topic.missedCriteria.slice(0, 2).map((criterion) => (
                              <li key={`missed-${criterion}`} className="text-muted-foreground">
                                Scoring criterion missed: {criterion}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                      <p className="text-sm leading-relaxed text-foreground">{eval_.feedback}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Question-by-Question Breakdown */}
        {!codingFailed && user?.role !== "user" && session && session.answers.length > 0 && (
          <Card className="border-border/50 print-break-before no-print">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border/50">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Question-by-Question Breakdown
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setActiveQuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={activeQuestionIndex === 0}
                  className="h-8 w-8 rounded-full"
                  id="prev-question-btn"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[80px] text-center text-muted-foreground">
                  Q{activeQuestionIndex + 1} of {session.answers.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setActiveQuestionIndex(prev => Math.min(session.answers.length - 1, prev + 1))}
                  disabled={activeQuestionIndex === session.answers.length - 1}
                  className="h-8 w-8 rounded-full"
                  id="next-question-btn"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {(() => {
                const answer = session.answers[activeQuestionIndex];
                const question = session.questions.find(q => q.qid === answer.qid);
                const evaluation = answer.evaluation;
                const evaluationUnavailable =
                  evaluation?.flag === "MANUAL_REVIEW_REQUIRED" ||
                  evaluation?.flag === "EVALUATION_ERROR";
                const displayReviewFlag =
                  evaluation?.flag &&
                  !evaluationUnavailable &&
                  evaluation.flag !== "LOW_CONFIDENCE";
                const teacherFeedback = evaluation?.teacher_feedback;
                const hasTeacherFeedback = Boolean(
                  teacherFeedback &&
                  (
                    (teacherFeedback.what_went_well?.length || 0) > 0 ||
                    (teacherFeedback.what_was_missing?.length || 0) > 0 ||
                    teacherFeedback.better_answer?.trim()
                  )
                );

                return (
                  <div key={activeQuestionIndex} className="space-y-6 animate-slide-up">
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <h4 className="text-sm font-semibold">Question {activeQuestionIndex + 1} — {normalizeTopicLabel(question?.dimension) || "Assessment"}</h4>
                        <p className="text-xs text-muted-foreground">
                          {question?.difficulty && (
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                question.difficulty === 'basic' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' :
                                question.difficulty === 'intermediate' ? 'bg-amber-500/15 text-amber-600 border-amber-500/30' :
                                'bg-red-500/15 text-red-600 border-red-500/30'
                              }`}
                            >
                                {question.difficulty.toUpperCase()}
                            </Badge>
                          )}
                        </p>
                      </div>
                      {evaluation && (
                        <div className="text-right">
                          {typeof evaluation.final_score === "number" && !evaluationUnavailable ? (
                            <>
                              <div className="text-2xl font-bold">{evaluation.final_score}</div>
                              <div className="text-xs text-muted-foreground">/ 5</div>
                            </>
                          ) : (
                            <>
                              <div className="text-sm font-semibold text-amber-600">Pending</div>
                              <div className="text-xs text-muted-foreground">manual review</div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Question Text */}
                    <div className="py-2 border-t border-border/50">
                      <p className="text-sm text-muted-foreground mb-2"><strong>Question:</strong></p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{question?.question}</p>
                    </div>

                    {/* Answer */}
                    <div className="py-2 border-t border-border/50">
                      <p className="text-sm text-muted-foreground mb-2"><strong>Your Answer:</strong></p>
                      {answer.answerType === "voice" && answer.asrMeta && (
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="outline" className="bg-muted/40">
                            Voice transcript
                          </Badge>
                          {answer.asrMeta.quality && (
                            <Badge
                              variant="outline"
                              className={
                                answer.asrMeta.quality === "high"
                                  ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                                  : answer.asrMeta.quality === "medium"
                                    ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                                    : "bg-red-500/15 text-red-600 border-red-500/30"
                              }
                            >
                              {answer.asrMeta.quality} quality
                            </Badge>
                          )}
                          {typeof answer.asrMeta.speech_seconds === "number" && (
                            <span className="text-muted-foreground">
                              {answer.asrMeta.speech_seconds}s recorded
                            </span>
                          )}
                          {(answer.asrMeta.warnings || []).length > 0 && (
                            <span className="text-amber-600">
                              Flags: {(answer.asrMeta.warnings || []).join(", ")}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-sm leading-relaxed bg-muted/30 p-3 rounded border border-border/30">{answer.answer}</p>
                    </div>

                    {/* Evaluation Details */}
                    {evaluation && (
                      <div className="py-2 border-t border-border/50 space-y-2">
                        {!evaluationUnavailable && hasTeacherFeedback && (
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
                            <p className="text-sm font-semibold">Evaluator feedback</p>
                            {teacherFeedback?.what_went_well && teacherFeedback.what_went_well.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">What went well</p>
                                <ul className="list-disc pl-5 text-xs leading-relaxed">
                                  {teacherFeedback.what_went_well.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {teacherFeedback?.what_was_missing && teacherFeedback.what_was_missing.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">What was missing</p>
                                <ul className="list-disc pl-5 text-xs leading-relaxed">
                                  {teacherFeedback.what_was_missing.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {teacherFeedback?.better_answer && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Better answer</p>
                                <p className="text-xs leading-relaxed">{teacherFeedback.better_answer}</p>
                              </div>
                            )}
                          </div>
                        )}
                        {!evaluationUnavailable &&
                          Object.keys(evaluation.best_breakdown || {}).length > 0 && (
                          <>
                            <p className="text-sm text-muted-foreground mb-3">
                              <strong>Marks by answer criterion:</strong>
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {Object.entries(evaluation.best_breakdown).map(([key, val]) => (
                                <div key={key} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="text-xs font-medium leading-relaxed">
                                      {val.label || key.replace(/_/g, " ")}
                                    </p>
                                    <Badge variant="outline" className="shrink-0">
                                      {val.score}/{val.max}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                                    {val.reason}
                                  </p>
                                  {val.issue && (
                                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-2 leading-relaxed">
                                      Issue: {val.issue}
                                    </p>
                                  )}
                                  {val.expected && (
                                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                                      Expected: {val.expected}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        {evaluationUnavailable ? (
                          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-800 dark:text-amber-200">
                            {evaluation.flag_reason || "Automatic scoring did not complete. No marks were assigned to this answer; it needs manual review."}
                          </div>
                        ) : displayReviewFlag ? (
                          <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-700 dark:text-red-300">
                            {evaluation.flag_reason || "This answer needs review."}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Navigation buttons */}
                    <div className="flex flex-wrap gap-1.5 items-center justify-center pt-4 border-t border-border/50">
                      {session.answers.map((_, idx) => (
                        <Button
                          key={idx}
                          variant={activeQuestionIndex === idx ? "default" : "outline"}
                          size="sm"
                          className="h-7 w-7 p-0 rounded-full text-xs font-bold transition-all duration-200"
                          onClick={() => setActiveQuestionIndex(idx)}
                        >
                          {idx + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Footer spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
}
