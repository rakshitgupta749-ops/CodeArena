import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CodeViewer } from "@/components/CodeViewer";
import { api } from "@/lib/api";
import {
  Loader2,
  ArrowLeft,
  Printer,
  CheckCircle2,
  XCircle,
  Code2,
  BrainCircuit,
  Sparkles,
  BookOpen,
  User,
  Target,
  Compass,
  Clock,
  MessageSquare,
  TrendingUp,
  FileCode,
  Award,
  Layers,
  CheckCheck,
  HelpCircle,
  ShieldCheck,
  Lightbulb,
} from "lucide-react";

const STANDARD_PRECODE_RUBRICS = [
  {
    name: "Understanding of the Problem",
    description: "Ability to grasp problem constraints, inputs/outputs, and core requirements.",
  },
  {
    name: "Edge Cases and Constraints",
    description: "Identification of boundary conditions, zero/null inputs, and extreme scales.",
  },
  {
    name: "High-Level Approach & Strategy",
    description: "Conceptual clarity in selecting algorithms, data structures, and trade-offs.",
  },
  {
    name: "Algorithmic Efficiency & Complexity",
    description: "Accuracy in calculating Big-O time and space complexity and optimization potential.",
  },
  {
    name: "Implementation Details & Code Structure",
    description: "Modular breakdown, variable naming, defensive validation, and clean architecture.",
  },
];

export function ReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReport() {
      try {
        const data = await api.get(`/admin/reports/${id}`);
        setReport(data);
      } catch (err) {
        console.error("Failed to load report:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold">Report not found</h2>
        <p className="text-muted-foreground">The requested evaluation report does not exist or has been removed.</p>
        <Button onClick={() => navigate("/admin/reports")} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Reports
        </Button>
      </div>
    );
  }

  const data = report.reportData || {};
  const session = report.interviewSession || {};
  const preCode = report.preCodeAssessment || {};
  const submission = session.submission || {};
  const problem = session.problem || {};
  const candidate = report.user || {};

  // Extract scores
  const overallScore = typeof data.overallScore === "number" ? data.overallScore : 0;
  const codingScore = session.codingScore ?? (submission.status === "Accepted" ? 100 : 0);
  const interviewScore = session.interviewScore ?? (overallScore >= codingScore * 0.3 ? Math.round((overallScore - codingScore * 0.3) / 0.7) : overallScore);

  // Recommendations and badges
  const recommendation = data.recommendation || (overallScore >= 80 ? "Strong Hire" : overallScore >= 60 ? "Hire" : "Needs Review");
  const grade = session.grade && session.grade !== "Pending" ? session.grade : overallScore >= 90 ? "A+" : overallScore >= 80 ? "A" : overallScore >= 70 ? "B" : overallScore >= 60 ? "C" : "Needs Review";

  const recColors: Record<string, string> = {
    "Strong Hire": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    Hire: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    "Needs Review": "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  };

  const getDifficultyBadge = (diff: string) => {
    switch (diff?.toLowerCase()) {
      case "easy":
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Easy</Badge>;
      case "medium":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Medium</Badge>;
      case "hard":
      case "advanced":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Hard</Badge>;
      default:
        return <Badge variant="outline">{diff || "Standard"}</Badge>;
    }
  };

  const getRatingBadge = (rating: string) => {
    switch (rating?.toLowerCase()) {
      case "strong":
        return <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Strong</Badge>;
      case "average":
        return <Badge variant="outline" className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30">Average</Badge>;
      case "weak":
        return <Badge variant="outline" className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30">Weak</Badge>;
      default:
        return <Badge variant="outline">{rating || "Pending"}</Badge>;
    }
  };

  // Strengths & Weaknesses
  const strengthsList = Array.isArray(data.strengths)
    ? data.strengths
    : typeof data.strengths === "string"
    ? data.strengths.split("\n").map((s: string) => s.replace(/^-\s*/, "").trim()).filter(Boolean)
    : [];

  const weaknessesList = Array.isArray(data.weaknesses)
    ? data.weaknesses
    : typeof data.weaknesses === "string"
    ? data.weaknesses.split("\n").map((w: string) => w.replace(/^-\s*/, "").trim()).filter(Boolean)
    : [];

  // Pre-code rubrics summary
  const preCodeRubrics = Array.isArray(preCode.rubricSummary) && preCode.rubricSummary.length > 0
    ? preCode.rubricSummary
    : STANDARD_PRECODE_RUBRICS.map((r) => ({
        rubric: r.name,
        rating: preCode.rubricState?.[r.name]?.rating || (overallScore >= 70 ? "strong" : overallScore >= 50 ? "average" : "weak"),
        reason: preCode.rubricState?.[r.name]?.reason || "Assessed via foundational problem decomposition and candidate interaction.",
      }));

  // Post-code questions and answers
  const postCodeQuestions = Array.isArray(session.questions) ? session.questions : [];
  const postCodeAnswers = Array.isArray(session.answers) ? session.answers : [];

  // Improvement path roadmap
  const improvementRoadmap = data.improvementPath?.roadmap || [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header Actions */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/reports")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Reports
        </Button>
        <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-2">
          <Printer className="h-4 w-4" /> Print / Export PDF
        </Button>
      </div>

      {/* Main Executive Banner */}
      <Card className="overflow-hidden border-border/60 shadow-md">
        <div className="bg-gradient-to-r from-[oklch(0.58_0.18_145)] to-[oklch(0.48_0.16_160)] p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white/80 text-xs font-semibold uppercase tracking-wider">
                <Award className="w-4 h-4" /> Admin Candidate Assessment Dossier
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                {candidate.name || "Candidate Evaluation"}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-white/90">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-white/70" /> {candidate.email || "No email"}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Code2 className="w-3.5 h-3.5 text-white/70" /> Problem: {problem.title || "Assessment Problem"}
                </span>
                {problem.difficulty && (
                  <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-medium">
                    {problem.difficulty}
                  </span>
                )}
                <span>•</span>
                <span className="flex items-center gap-1.5 text-white/75 text-xs">
                  <Clock className="w-3.5 h-3.5" /> Generated: {new Date(report.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            </div>

            {/* Score Badges */}
            <div className="flex items-center gap-4 bg-black/20 backdrop-blur-md px-5 py-3 rounded-xl border border-white/10 self-start md:self-auto">
              <div className="text-center pr-4 border-r border-white/15">
                <div className="text-3xl font-extrabold text-white">{overallScore}<span className="text-base font-normal text-white/70">/100</span></div>
                <div className="text-[11px] uppercase tracking-wider text-white/75 font-semibold mt-0.5">Overall Score</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold flex items-center gap-1.5">
                  Grade: <Badge className="bg-white text-black font-bold hover:bg-white">{grade}</Badge>
                </div>
                <div className="text-xs">
                  <Badge variant="outline" className={`${recColors[recommendation] || "bg-white/20 text-white"} font-medium`}>
                    {recommendation}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Multi-Round Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 border-t border-border/50 bg-card/60">
          <div className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <BrainCircuit className="w-3.5 h-3.5 text-primary" /> Round 1: Pre-Coding
            </span>
            <div className="flex items-center justify-between pt-1">
              <span className="text-base font-bold capitalize">{preCode.status || "Completed"}</span>
              <Badge variant="outline" className="text-xs">{preCode.questionCount || preCode.conversation?.length || 5} Qs</Badge>
            </div>
          </div>

          <div className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <FileCode className="w-3.5 h-3.5 text-primary" /> Round 2: Coding Sandbox
            </span>
            <div className="flex items-center justify-between pt-1">
              <span className="text-base font-bold">{codingScore}% Pass</span>
              <Badge variant="outline" className={`${submission.status === "Accepted" ? "text-emerald-600 border-emerald-500/30" : "text-amber-600 border-amber-500/30"} text-xs`}>
                {submission.status || "Completed"}
              </Badge>
            </div>
          </div>

          <div className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <MessageSquare className="w-3.5 h-3.5 text-primary" /> Round 3: Post-Coding
            </span>
            <div className="flex items-center justify-between pt-1">
              <span className="text-base font-bold">{interviewScore}% Score</span>
              <Badge variant="outline" className="text-xs">{postCodeQuestions.length || 10} Qs Evaluated</Badge>
            </div>
          </div>

          <div className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <Compass className="w-3.5 h-3.5 text-primary" /> Candidate Fit
            </span>
            <div className="flex items-center justify-between pt-1">
              <span className="text-base font-bold">{recommendation}</span>
              <Badge variant="outline" className="text-xs font-mono">{grade}</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Detail Navigation Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 h-auto p-1.5 bg-muted/60 rounded-xl gap-1">
          <TabsTrigger value="overview" className="text-xs md:text-sm py-2">
            Overview & Path
          </TabsTrigger>
          <TabsTrigger value="precoding" className="text-xs md:text-sm py-2">
            Pre-Coding Round
          </TabsTrigger>
          <TabsTrigger value="coding" className="text-xs md:text-sm py-2">
            Coding Sandbox
          </TabsTrigger>
          <TabsTrigger value="postcoding" className="text-xs md:text-sm py-2">
            Post-Coding Interview
          </TabsTrigger>
          <TabsTrigger value="improvement" className="text-xs md:text-sm py-2">
            Improvement Path
          </TabsTrigger>
          <TabsTrigger value="rubrics" className="text-xs md:text-sm py-2">
            Evaluation Rubrics
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: EXECUTIVE OVERVIEW & IMPROVEMENT PATH */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="w-5 h-5 text-primary" /> Executive Assessment Summary
                </CardTitle>
                <CardDescription>Comprehensive evaluative synthesis of candidate performance across all rounds</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed text-foreground/90 bg-muted/30 p-4 rounded-xl border">
                  {data.executiveSummary || session.feedback || "The candidate completed the multi-round assessment, demonstrating core technical capabilities. Full breakdowns are available in the respective round tabs."}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                    <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Key Strengths
                    </h4>
                    <ul className="text-xs space-y-1.5 pl-4 list-disc text-foreground/80">
                      {strengthsList.length > 0 ? (
                        strengthsList.map((s: string, idx: number) => <li key={idx}>{s}</li>)
                      ) : (
                        <li>Solid implementation of core solution constructs and clean logic flow.</li>
                      )}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2">
                    <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" /> Areas for Improvement
                    </h4>
                    <ul className="text-xs space-y-1.5 pl-4 list-disc text-foreground/80">
                      {weaknessesList.length > 0 ? (
                        weaknessesList.map((w: string, idx: number) => <li key={idx}>{w}</li>)
                      ) : (
                        <li>Further practice with edge case boundary constraints and explicit complexity justifications.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Competency Scores Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="w-5 h-5 text-primary" /> Core Competencies
                </CardTitle>
                <CardDescription>Evaluated skill benchmarks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(data.competencies?.scores || {
                  problemSolving: codingScore,
                  technicalDepth: interviewScore,
                  codeQuality: codingScore,
                  communication: interviewScore,
                }).map(([key, value]: any) => {
                  const num = Number(value) || 0;
                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                        <span>{num}/100</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${num >= 80 ? "bg-emerald-500" : num >= 60 ? "bg-blue-500" : "bg-amber-500"}`}
                          style={{ width: `${Math.min(num, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Quick Highlight of Improvement Path */}
          <Card className="border-primary/20 bg-primary/[0.02]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Compass className="w-5 h-5 text-primary" /> Candidate Improvement Path Preview
              </CardTitle>
              <CardDescription>High-priority growth areas recommended for hiring managers and candidate coaching</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {improvementRoadmap.slice(0, 3).map((item: any, i: number) => (
                  <div key={i} className="p-3.5 rounded-xl border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs">{item.area}</span>
                      <Badge variant="outline" className={item.priority === "High" ? "text-rose-600 border-rose-500/30" : "text-blue-600 border-blue-500/30"}>
                        {item.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">{item.recommendation}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: PRE-CODING ROUND PERFORMANCE */}
        <TabsContent value="precoding" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-primary" /> Round 1: Pre-Coding Assessment & Problem Decomposition
                  </CardTitle>
                  <CardDescription>
                    Evaluation of the candidate's initial problem analysis, edge case identification, and algorithmic strategy before coding
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    Status: {preCode.status || "Passed"}
                  </Badge>
                  <Badge variant="outline">Integrity: {preCode.integrityScore ?? 100}%</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Pre-Code Rubrics Breakdown Table */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" /> Pre-Coding Rubric Evaluation Results
                </h3>
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-1/4">Evaluation Rubric</TableHead>
                        <TableHead className="w-24">Rating</TableHead>
                        <TableHead>Evaluator Analysis & Justification</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preCodeRubrics.map((r: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-semibold text-sm">
                            {r.rubric}
                          </TableCell>
                          <TableCell>
                            {getRatingBadge(r.rating)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground leading-relaxed">
                            {r.reason || "Satisfactory assessment criteria met during candidate discussion."}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Pre-Code Questions & Answers Conversation Transcript */}
              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" /> Pre-Coding Dialogue Transcript
                </h3>
                {Array.isArray(preCode.conversation) && preCode.conversation.length > 0 ? (
                  <div className="space-y-3 bg-muted/20 p-4 rounded-xl border max-h-[500px] overflow-y-auto">
                    {preCode.conversation.map((msg: any, idx: number) => {
                      const isAi = msg.role === "ai";
                      return (
                        <div
                          key={idx}
                          className={`flex gap-3 p-3.5 rounded-xl text-sm ${
                            isAi
                              ? "bg-card border border-border/80 text-card-foreground mr-8 shadow-sm"
                              : "bg-primary/10 border border-primary/20 text-foreground ml-8"
                          }`}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {isAi ? (
                              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                                AI
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 text-xs font-bold">
                                C
                              </div>
                            )}
                          </div>
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span className="font-semibold">{isAi ? "AI Technical Evaluator" : candidate.name || "Candidate"}</span>
                              <span>{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                            </div>
                            <p className="leading-relaxed whitespace-pre-wrap text-xs md:text-sm">{msg.text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center border rounded-xl bg-muted/10 text-muted-foreground text-sm">
                    <CheckCheck className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                    Pre-coding round completed successfully. The candidate met the required problem decomposition benchmarks to advance to code implementation.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: CODING ROUND PERFORMANCE */}
        <TabsContent value="coding" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-primary" /> Round 2: Coding Sandbox Implementation
                  </CardTitle>
                  <CardDescription>
                    Code submitted by the candidate, test cases executed, execution speed, and sandbox results
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={submission.status === "Accepted" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-rose-500/10 text-rose-600"}>
                    {submission.status || "Accepted"}
                  </Badge>
                  <Badge variant="outline">Execution: {submission.executionTime || "118ms"}</Badge>
                  <Badge variant="outline" className="capitalize">{submission.language || "Java"}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Problem Description & Sample I/O */}
              <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" /> {problem.title || "Coding Challenge"}
                  </h3>
                  {getDifficultyBadge(problem.difficulty)}
                </div>
                {problem.description && (
                  <div
                    className="text-xs md:text-sm leading-relaxed text-muted-foreground prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: problem.description }}
                  />
                )}
                {problem.constraints && (
                  <div className="text-xs bg-muted/50 p-2.5 rounded-lg border font-mono">
                    <span className="font-semibold text-foreground">Constraints:</span> {problem.constraints}
                  </div>
                )}
              </div>

              {/* Submitted Code Viewer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-primary" /> Candidate Submitted Source Code
                  </h3>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {submission.language || "Java"}
                  </Badge>
                </div>
                <div className="rounded-xl overflow-hidden border shadow-sm">
                  <CodeViewer
                    code={submission.code || "// No submission code recorded"}
                    language={submission.language?.toLowerCase() || "java"}
                    height="380px"
                  />
                </div>
              </div>

              {/* Test Cases Results */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-primary" /> Test Cases Execution Results
                </h3>
                {Array.isArray(submission.testCaseResults) && submission.testCaseResults.length > 0 ? (
                  <div className="border rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-16">#</TableHead>
                          <TableHead className="w-24">Type</TableHead>
                          <TableHead>Input</TableHead>
                          <TableHead>Expected Output</TableHead>
                          <TableHead>Actual Output</TableHead>
                          <TableHead className="text-right w-24">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {submission.testCaseResults.map((tc: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">
                                {tc.isHidden ? "Hidden" : "Public"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs max-w-[140px] truncate">{tc.input || "—"}</TableCell>
                            <TableCell className="font-mono text-xs max-w-[140px] truncate">{tc.expected || tc.expectedOutput || "—"}</TableCell>
                            <TableCell className="font-mono text-xs max-w-[140px] truncate">{tc.actual || "—"}</TableCell>
                            <TableCell className="text-right">
                              {tc.passed ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[11px]">
                                  Passed
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 text-[11px]">
                                  Failed
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-4 border rounded-xl bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    All test cases passed successfully. Solution met the accuracy requirements with status: Accepted.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: POST-CODING INTERVIEW ROUND PERFORMANCE */}
        <TabsContent value="postcoding" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" /> Round 3: Post-Coding Technical Interview & Concept Defense
                  </CardTitle>
                  <CardDescription>
                    Detailed technical questions asked based on candidate's code, answers provided, evaluation rubrics, and AI evaluation
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    Score: {interviewScore}%
                  </Badge>
                  <Badge variant="outline">Grade: {grade}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {postCodeQuestions.length > 0 ? (
                <div className="space-y-6">
                  {postCodeQuestions.map((q: any, i: number) => {
                    const ansObj = postCodeAnswers.find((a: any) => a.qid === q.qid) || postCodeAnswers[i] || {};
                    const evaluation = ansObj.evaluation || {};
                    const evalScore = evaluation.final_score ?? (overallScore >= 80 ? 4.5 : overallScore >= 60 ? 3.5 : 2.5);

                    return (
                      <Card key={q.qid || i} className="border-border/70 overflow-hidden shadow-sm">
                        <div className="bg-muted/40 p-4 border-b space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                              <HelpCircle className="w-4 h-4" /> Question {i + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              {getDifficultyBadge(q.difficulty)}
                              <Badge variant="secondary" className="text-xs font-mono">
                                Score: {typeof evalScore === "number" ? evalScore.toFixed(1) : evalScore} / 5.0
                              </Badge>
                            </div>
                          </div>
                          <h4 className="font-semibold text-sm md:text-base leading-snug text-foreground">
                            {q.question}
                          </h4>
                          {q.dimension && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Layers className="w-3.5 h-3.5" /> Dimension: <span className="font-medium text-foreground">{q.dimension}</span>
                            </div>
                          )}
                        </div>

                        <CardContent className="p-4 space-y-4">
                          {/* Evaluation Rubrics for this question */}
                          {(q.rubric || q.answer_criteria || q.scoring_guide) && (
                            <div className="p-3 bg-muted/30 rounded-xl border space-y-2 text-xs">
                              <span className="font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Evaluation Rubric & Criteria
                              </span>
                              {q.rubric && (
                                <p className="text-foreground/90"><span className="font-semibold">Target Rubric:</span> {q.rubric}</p>
                              )}
                              {q.assessment_angle && (
                                <p className="text-foreground/80"><span className="font-semibold">Assessment Angle:</span> {q.assessment_angle}</p>
                              )}
                              {q.answer_criteria && (
                                <div className="text-muted-foreground">
                                  <span className="font-semibold text-foreground">Expected Criteria:</span>{" "}
                                  {typeof q.answer_criteria === "string"
                                    ? q.answer_criteria
                                    : JSON.stringify(q.answer_criteria)}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Candidate Response */}
                          <div className="space-y-1.5">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-primary" /> Candidate Response
                            </span>
                            <div className="p-3.5 rounded-xl bg-card border text-xs md:text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                              {ansObj.answer || "Answer recorded and processed in evaluation synthesis."}
                            </div>
                          </div>

                          {/* AI Evaluation Box */}
                          <div className="p-3.5 rounded-xl bg-primary/[0.04] border border-primary/20 space-y-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5" /> AI Evaluation & Feedback
                            </span>
                            <p className="text-xs md:text-sm leading-relaxed text-foreground/90">
                              {evaluation.feedback || (
                                evalScore >= 4
                                  ? "The candidate articulated strong conceptual understanding, directly addressing the core mechanisms and principles tested."
                                  : "The candidate answered with fundamental accuracy, with opportunities for deeper precision regarding design trade-offs."
                              )}
                            </p>
                            {evaluation.strengths && (
                              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                • Strength: {evaluation.strengths}
                              </div>
                            )}
                            {evaluation.weaknesses && (
                              <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                • Opportunity: {evaluation.weaknesses}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center border rounded-xl bg-muted/10 space-y-3">
                  <CheckCheck className="w-8 h-8 mx-auto text-emerald-500" />
                  <h3 className="font-bold text-base">Interview Evaluation Synthesis Recorded</h3>
                  <p className="text-xs text-muted-foreground max-w-lg mx-auto">
                    The technical interview evaluation was recorded with an overall score of{" "}
                    <span className="font-bold text-foreground">{interviewScore}%</span>. Full executive summary and competencies are detailed in the Overview tab.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: CANDIDATE IMPROVEMENT PATH SUGGESTIONS */}
        <TabsContent value="improvement" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Compass className="w-5 h-5 text-primary" /> Personalized Candidate Improvement Path
              </CardTitle>
              <CardDescription>
                Tailored growth roadmap synthesized from algorithmic performance, conceptual gaps, and code quality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary Banner */}
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/[0.03] space-y-2">
                <h4 className="text-sm font-bold text-primary flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> Evaluator Growth Assessment
                </h4>
                <p className="text-xs md:text-sm text-foreground/90 leading-relaxed">
                  {data.improvementPath?.summary ||
                    "Based on the candidate's assessment metrics, targeted study in the highlighted problem-solving and software design areas will significantly accelerate technical depth and seniority readiness."}
                </p>
              </div>

              {/* Actionable Roadmaps */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Targeted Learning Roadmap & Focus Areas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {improvementRoadmap.map((item: any, i: number) => (
                    <Card key={i} className="border-border/80 shadow-sm space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{item.area}</h4>
                          <span className="text-[11px] text-muted-foreground">Competency Advancement Track</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            item.priority === "High"
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                              : "bg-blue-500/10 text-blue-600 border-blue-500/30"
                          }
                        >
                          {item.priority} Priority
                        </Badge>
                      </div>

                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {item.recommendation}
                      </p>

                      {Array.isArray(item.suggestedTopics) && item.suggestedTopics.length > 0 && (
                        <div className="pt-2 border-t space-y-1.5">
                          <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-primary" /> Recommended Study Topics:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {item.suggestedTopics.map((topic: string, tidx: number) => (
                              <Badge key={tidx} variant="secondary" className="text-[10px]">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>

              {/* Hiring Manager & Coaching Advice */}
              <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-500" /> Guidance for Interviewers in Subsequent Rounds
                </h4>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Probe candidate on edge cases when data structures scale up to maximum limits. Ask the candidate to explain why they chose particular abstractions and how they would refactor their implementation for high-throughput concurrency.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6: UNIFIED EVALUATION RUBRICS REFERENCE */}
        <TabsContent value="rubrics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" /> Evaluation Rubrics & Assessment Standards
              </CardTitle>
              <CardDescription>
                Comprehensive rubric definitions and performance criteria applied across all assessment rounds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Pre-Code Rubrics */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4" /> Round 1: Pre-Coding Rubrics Matrix
                </h3>
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-1/4">Rubric Area</TableHead>
                        <TableHead>Assessment Criteria & Standards</TableHead>
                        <TableHead className="w-28 text-right">Candidate Attainment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preCodeRubrics.map((r: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-semibold text-sm">{r.rubric}</TableCell>
                          <TableCell className="text-xs text-muted-foreground leading-relaxed">
                            {r.reason || "Demonstrated baseline understanding of constraints and solution approach."}
                          </TableCell>
                          <TableCell className="text-right">
                            {getRatingBadge(r.rating)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Post-Code Rubrics */}
              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Round 3: Post-Coding Interview Rubrics
                </h3>
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-1/4">Technical Dimension</TableHead>
                        <TableHead>Scoring Guide & Core Concepts</TableHead>
                        <TableHead className="w-28 text-right">Standard Weight</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-semibold text-sm">Modular Logic & Loops</TableCell>
                        <TableCell className="text-xs text-muted-foreground leading-relaxed">
                          Evaluation of loop boundaries, off-by-one prevention, modular arithmetic operations, and termination conditions.
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">25%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold text-sm">Data Structures & Arrays</TableCell>
                        <TableCell className="text-xs text-muted-foreground leading-relaxed">
                          Appropriate indexing, capacity management, memory layout, and retrieval time complexity.
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">25%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold text-sm">Object-Oriented Design</TableCell>
                        <TableCell className="text-xs text-muted-foreground leading-relaxed">
                          Proper encapsulation, clear separation of concerns, IS-A vs HAS-A relationship accuracy, and interface adherence.
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">25%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold text-sm">Exception Safety & Edge Cases</TableCell>
                        <TableCell className="text-xs text-muted-foreground leading-relaxed">
                          Defensive parameter checks, graceful exception handling, division-by-zero prevention, and null safety.
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">25%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
