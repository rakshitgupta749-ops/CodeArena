import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileCheck,
  Award,
  Code2,
  MessageSquareText,
  ShieldCheck,
  Calendar,
  Layers,
  Printer,
  ExternalLink,
} from "lucide-react";

interface ReportItem {
  id: string;
  sessionId: string;
  problemId: string;
  problemTitle: string;
  difficulty: "Easy" | "Medium" | "Hard";
  batchName: string;
  instructorName: string;
  completedAt: string;
  overallScore: number;
  overallPassed: boolean;
  grade: string;
  scores: {
    preCoding: {
      integrityScore: number;
      status: string;
    };
    coding: {
      score: number;
      passed: boolean;
      passedTestCases: number;
      totalTestCases: number;
      executionTime: string;
    };
    interview: {
      score: number;
      passed: boolean;
      totalQuestions: number;
      answeredQuestions: number;
    };
  };
  reportUrl: string;
}

interface ReportsResponse {
  stats: {
    totalReports: number;
    passedReports: number;
    passRate: number;
    avgScore: number;
    highestScore: number;
  };
  reports: ReportItem[];
}

const difficultyColors: Record<string, string> = {
  Easy: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  Hard: "bg-red-500/15 text-red-500 border-red-500/30",
};

export function StudentReportsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get<ReportsResponse>("/student/reports");
      setData(res);
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8 animate-[fade-in_0.3s_ease-out]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <FileCheck className="w-7 h-7 text-primary" />
            My Assessment Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review detailed candidate evaluation rubrics, code execution metrics, and AI technical viva insights.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => window.print()}
          className="gap-1.5 text-xs self-start md:self-auto"
        >
          <Printer className="w-3.5 h-3.5" />
          Print / Export Transcripts
        </Button>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Evaluated Reports</span>
            <div className="text-2xl font-bold tracking-tight">
              {data?.stats.totalReports ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground">Total completed tests</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Pass Rate</span>
            <div className="text-2xl font-bold tracking-tight text-emerald-500">
              {data?.stats.passRate ?? 0}%
            </div>
            <p className="text-[11px] text-muted-foreground">
              {data?.stats.passedReports ?? 0} assessments passed
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Average Score</span>
            <div className="text-2xl font-bold tracking-tight text-primary">
              {data?.stats.avgScore ?? 0}
              <span className="text-xs text-muted-foreground font-normal">/100</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Cumulative performance</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Highest Score</span>
            <div className="text-2xl font-bold tracking-tight text-violet-500">
              {data?.stats.highestScore ?? 0}
              <span className="text-xs text-muted-foreground font-normal">/100</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Top evaluation mark</p>
          </CardContent>
        </Card>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse p-6 border-border/60">
              <div className="h-6 bg-muted rounded w-1/3 mb-4" />
              <div className="h-4 bg-muted/60 rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : data?.reports && data.reports.length > 0 ? (
        <div className="space-y-4">
          {data.reports.map((report) => (
            <Card
              key={report.id}
              className="border-border/60 shadow-xs hover:border-primary/40 transition-all overflow-hidden bg-card"
            >
              <div className="p-5 md:p-6 space-y-5">
                {/* Header info */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-lg font-bold tracking-tight text-foreground">
                        {report.problemTitle}
                      </h3>
                      <Badge
                        variant="outline"
                        className={`text-xs ${difficultyColors[report.difficulty] || ""}`}
                      >
                        {report.difficulty}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {report.batchName}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          report.overallPassed
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        }`}
                      >
                        {report.overallPassed ? "Passed" : "Needs Review"}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Completed: {new Date(report.completedAt).toLocaleDateString()}
                      </span>
                      <span>·</span>
                      <span>Evaluator: <span className="font-medium text-foreground">{report.instructorName}</span></span>
                      <span>·</span>
                      <span>Overall Grade: <span className="font-semibold text-primary">{report.grade}</span></span>
                    </p>
                  </div>

                  {/* Score pill & CTA */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
                      <Award className="w-4 h-4 text-primary" />
                      <div>
                        <div className="text-xs font-semibold text-foreground">Score: {report.overallScore}/100</div>
                        <div className="text-[10px] text-muted-foreground">{report.grade}</div>
                      </div>
                    </div>

                    <Button
                      onClick={() => navigate(report.reportUrl)}
                      className="gap-2 text-xs font-semibold shadow-xs bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.53_0.18_145)] text-white"
                    >
                      View Full Detailed Report
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* 3-Round Score Breakdown Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Round 1 Score */}
                  <div className="p-3 rounded-xl border border-border/60 bg-muted/20 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        Pre-Coding Round
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        {report.scores.preCoding.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Integrity Index: <span className="font-semibold text-foreground">{report.scores.preCoding.integrityScore}%</span>
                    </p>
                  </div>

                  {/* Round 2 Score */}
                  <div className="p-3 rounded-xl border border-border/60 bg-muted/20 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-blue-500" />
                        Coding Sandbox
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20">
                        Score: {report.scores.coding.score}/100
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Test Cases: <span className="font-semibold text-foreground">{report.scores.coding.passedTestCases}/{report.scores.coding.totalTestCases}</span> · Time: {report.scores.coding.executionTime}
                    </p>
                  </div>

                  {/* Round 3 Score */}
                  <div className="p-3 rounded-xl border border-border/60 bg-muted/20 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <MessageSquareText className="w-3.5 h-3.5 text-violet-500" />
                        AI Viva Interview
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-500 border-violet-500/20">
                        Score: {report.scores.interview.score}/100
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Questions Evaluated: <span className="font-semibold text-foreground">{report.scores.interview.answeredQuestions}/{report.scores.interview.totalQuestions}</span>
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-border/80 p-12 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="p-3 rounded-full bg-muted w-12 h-12 mx-auto flex items-center justify-center">
              <FileCheck className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold">No evaluation reports generated yet</h3>
            <p className="text-xs text-muted-foreground">
              Complete an assessment round from your "My Assessments" tab to receive comprehensive evaluation reports and interview scorecards.
            </p>
            <Button
              onClick={() => navigate("/assessments")}
              className="gap-2 text-xs mt-2 bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.53_0.18_145)] text-white"
            >
              <Layers className="w-4 h-4" />
              Go to My Assessments
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
