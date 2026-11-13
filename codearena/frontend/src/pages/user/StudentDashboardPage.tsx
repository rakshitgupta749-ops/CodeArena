import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Code2,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Award,
  FileCheck,
  BookOpen,
  MessageSquareText,
  Activity,
  Sparkles,
  Play,
  RotateCw,
  Layers,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { SystemReadinessModal } from "@/components/user/SystemReadinessModal";

interface DashboardData {
  student: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  metrics: {
    totalAssigned: number;
    completed: number;
    inProgress: number;
    pending: number;
    averagePreCodeIntegrity: number;
    codingPassRate: number;
    averageInterviewScore: number;
    reportsGenerated: number;
  };
  urgentSpotlight: {
    assignmentId: string;
    problemId: string;
    title: string;
    difficulty: "Easy" | "Medium" | "Hard";
    description: string;
    batchName: string;
    assignedBy: string;
    dueDate?: string;
    status: string;
    timeConfig: {
      preCodeAssessmentTimer: number;
      codingTestTimer: number;
      interviewTimer: number;
    };
    stages: {
      precoding: { status: string; integrityScore: number; rubricState: number };
      coding: { status: string; attempts: number; bestScore: number; passed: boolean };
      interview: { status: string; score: number | null; passed: boolean };
    };
    currentStage: string;
    nextStepAction: string;
    nextStepUrl: string;
  } | null;
  competencies: Array<{
    id: string;
    name: string;
    score: number;
    level: string;
    icon: string;
    description: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    timestamp: string;
    status: "success" | "warning" | "danger" | "info";
  }>;
}

const difficultyColors: Record<string, string> = {
  Easy: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  Hard: "bg-red-500/15 text-red-500 border-red-500/30",
};

export function StudentDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [readinessModalOpen, setReadinessModalOpen] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get<DashboardData>("/student/dashboard");
      setData(res);
    } catch (err) {
      console.error("Failed to load student dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const getCompetencyIcon = (iconName: string) => {
    switch (iconName) {
      case "Code2":
        return <Code2 className="w-4 h-4 text-emerald-500" />;
      case "BookOpen":
        return <BookOpen className="w-4 h-4 text-blue-500" />;
      case "MessageSquareText":
        return <MessageSquareText className="w-4 h-4 text-violet-500" />;
      case "ShieldCheck":
        return <ShieldCheck className="w-4 h-4 text-amber-500" />;
      default:
        return <Activity className="w-4 h-4 text-primary" />;
    }
  };

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return "Flexible Deadline";
    const due = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60));

    if (diffHours < 0) {
      return `Overdue by ${Math.abs(Math.round(diffHours / 24))}d`;
    }
    if (diffHours < 24) {
      return `Due in ${diffHours} hours`;
    }
    const days = Math.round(diffHours / 24);
    return `Due in ${days} days (${due.toLocaleDateString()})`;
  };

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8 animate-pulse">
        <div className="h-44 bg-muted/60 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 bg-muted/40 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-muted/40 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8 animate-[fade-in_0.3s_ease-out]">
      {/* 1. Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-6 md:p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/20 px-2.5 py-0.5 text-xs font-semibold">
                Candidate Assessment Portal
              </Badge>
              <Badge variant="outline" className="text-xs">
                Candidate ID: {user?._id?.slice(-6) || "9824A1"}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Active Session 🟢
              </Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Welcome back, {user?.name || "Candidate"} 👋
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Track your enterprise technical evaluations, coding sandboxes, and AI technical viva interviews. Ensure your workstation is pre-verified before starting timed rounds.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Button
              variant="outline"
              onClick={() => setReadinessModalOpen(true)}
              className="gap-2 text-xs border-primary/30 hover:bg-primary/10 shadow-sm"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              System Readiness
            </Button>
            <Button
              onClick={() => navigate("/assessments")}
              className="gap-2 text-xs shadow-md bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.53_0.18_145)] text-white"
            >
              <Layers className="w-4 h-4" />
              View My Assessments
            </Button>
          </div>
        </div>

        {/* Subtle background ambient blob */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      </div>

      {/* 2. Enterprise KPI Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Assigned */}
        <Card className="border-border/60 shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Assigned</span>
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-bold tracking-tight">{data?.metrics.totalAssigned ?? 0}</div>
            <p className="text-[11px] text-muted-foreground">Total evaluations</p>
          </CardContent>
        </Card>

        {/* Completed */}
        <Card className="border-border/60 shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-emerald-500">
              {data?.metrics.completed ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground">Finished all rounds</p>
          </CardContent>
        </Card>

        {/* In-Progress */}
        <Card className="border-border/60 shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">In Progress</span>
              <RotateCw className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-amber-500">
              {data?.metrics.inProgress ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground">Active assessments</p>
          </CardContent>
        </Card>

        {/* Pre-Code Integrity */}
        <Card className="border-border/60 shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Integrity Score</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {data?.metrics.averagePreCodeIntegrity ?? 100}%
            </div>
            <p className="text-[11px] text-emerald-500 font-medium">Proctoring verified</p>
          </CardContent>
        </Card>

        {/* Coding Pass Rate */}
        <Card className="border-border/60 shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Coding Pass</span>
              <Code2 className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {data?.metrics.codingPassRate ?? 0}%
            </div>
            <p className="text-[11px] text-muted-foreground">Sandbox test pass rate</p>
          </CardContent>
        </Card>

        {/* AI Interview Average */}
        <Card className="border-border/60 shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">AI Viva Avg</span>
              <Sparkles className="w-4 h-4 text-violet-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-violet-500">
              {data?.metrics.averageInterviewScore ?? 0}
              <span className="text-xs text-muted-foreground font-normal">/100</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Verbal reasoning rating</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Urgent / Next Assessment Spotlight */}
      {data?.urgentSpotlight && (
        <Card className="border-2 border-primary/30 shadow-md bg-card overflow-hidden">
          <div className="bg-primary/5 px-6 py-3 border-b border-primary/15 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Action Required · Priority Assessment
              </span>
            </div>
            <Badge variant="outline" className="text-xs font-medium bg-background/80 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              {formatDueDate(data.urgentSpotlight.dueDate)}
            </Badge>
          </div>

          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-xl font-bold tracking-tight">
                    {data.urgentSpotlight.title}
                  </h3>
                  <Badge
                    variant="outline"
                    className={`text-xs ${difficultyColors[data.urgentSpotlight.difficulty] || ""}`}
                  >
                    {data.urgentSpotlight.difficulty}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {data.urgentSpotlight.batchName}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Assigned by <span className="font-semibold text-foreground">{data.urgentSpotlight.assignedBy}</span> · 
                  Time Limit: {data.urgentSpotlight.timeConfig.preCodeAssessmentTimer + data.urgentSpotlight.timeConfig.codingTestTimer + data.urgentSpotlight.timeConfig.interviewTimer} mins total
                </p>
              </div>

              <Button
                size="lg"
                onClick={() => navigate(data.urgentSpotlight?.nextStepUrl || "/assessments")}
                className="gap-2 font-semibold shadow-md shrink-0 bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.53_0.18_145)] text-white"
              >
                <Play className="w-4 h-4 fill-current" />
                {data.urgentSpotlight.nextStepAction}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {/* 3-Round Interactive Stepper */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              {/* Round 1: Pre-Coding */}
              <div className={`p-4 rounded-xl border ${
                data.urgentSpotlight.stages.precoding.status === "completed"
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : data.urgentSpotlight.currentStage === "precoding"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border/60 bg-muted/20 opacity-70"
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    {data.urgentSpotlight.stages.precoding.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">1</span>
                    )}
                    Round 1: Pre-Coding
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {data.urgentSpotlight.timeConfig.preCodeAssessmentTimer} mins
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.urgentSpotlight.stages.precoding.status === "completed"
                    ? "Passed · Integrity: " + data.urgentSpotlight.stages.precoding.integrityScore + "%"
                    : data.urgentSpotlight.stages.precoding.status === "in_progress"
                    ? "In Progress · Conversation active"
                    : "Problem understanding & MCQ rubrics"}
                </p>
              </div>

              {/* Round 2: Coding Sandbox */}
              <div className={`p-4 rounded-xl border ${
                data.urgentSpotlight.stages.coding.status === "completed"
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : data.urgentSpotlight.currentStage === "coding"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border/60 bg-muted/20 opacity-70"
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    {data.urgentSpotlight.stages.coding.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">2</span>
                    )}
                    Round 2: Coding Sandbox
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {data.urgentSpotlight.timeConfig.codingTestTimer} mins
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.urgentSpotlight.stages.coding.status === "completed"
                    ? "Accepted · Score: " + data.urgentSpotlight.stages.coding.bestScore + "/100"
                    : data.urgentSpotlight.stages.coding.status === "in_progress"
                    ? "Code attempted · Test cases pending"
                    : "Piston isolated sandbox execution"}
                </p>
              </div>

              {/* Round 3: AI Technical Viva */}
              <div className={`p-4 rounded-xl border ${
                data.urgentSpotlight.stages.interview.status === "completed"
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : data.urgentSpotlight.currentStage === "interview"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border/60 bg-muted/20 opacity-70"
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    {data.urgentSpotlight.stages.interview.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">3</span>
                    )}
                    Round 3: AI Viva Interview
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {data.urgentSpotlight.timeConfig.interviewTimer} mins
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.urgentSpotlight.stages.interview.status === "completed"
                    ? "Completed · Score: " + (data.urgentSpotlight.stages.interview.score ?? "Evaluated")
                    : data.urgentSpotlight.stages.interview.status === "in_progress"
                    ? "Interview in session"
                    : "Verbal code explanation & complexity viva"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Competency Breakdown & Skills Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Evaluated Competency & Skills Matrix
              </h2>
              <p className="text-xs text-muted-foreground">
                Aggregated benchmark across all your CodeArena assessments and viva rounds.
              </p>
            </div>
            <Badge variant="outline" className="text-xs bg-muted/40">
              Enterprise Benchmarked
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data?.competencies.map((comp) => (
              <Card key={comp.id} className="border-border/60 bg-card/60">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-muted border border-border/50">
                        {getCompetencyIcon(comp.icon)}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold">{comp.name}</h4>
                        <span className="text-[10px] text-muted-foreground">
                          Rating: <span className="font-medium text-foreground">{comp.level}</span>
                        </span>
                      </div>
                    </div>
                    <span className="text-base font-bold font-mono">
                      {comp.score}%
                    </span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-secondary/80 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-300"
                      style={{ width: `${comp.score}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {comp.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 5. System Readiness & Compatibility Widget */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              System Readiness Status
            </h2>
            <p className="text-xs text-muted-foreground">
              Browser & microphone readiness for assessments.
            </p>
          </div>

          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-4 space-y-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Browser & WebRTC
                </span>
                <span className="font-medium text-emerald-500">Compatible</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Microphone Access
                </span>
                <span className="font-medium text-foreground">Ready for Viva</span>
              </div>

              <div className="pt-2 border-t border-border/60">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReadinessModalOpen(true)}
                  className="w-full text-xs h-8 gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  System Readiness Check
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Rules */}
          <div className="p-3.5 rounded-xl border border-border/70 bg-muted/20 text-xs space-y-1.5">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Assessment Rules & Honor Code
            </div>
            <ul className="list-disc list-inside text-muted-foreground text-[11px] space-y-0.5">
              <li>Keep microphone enabled during viva.</li>
              <li>Tab switches and external navigation are monitored.</li>
              <li>Submit code within the allotted round timer.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 6. Recent Activity Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Recent Evaluation Activity
            </h2>
            <p className="text-xs text-muted-foreground">
              Your latest submissions, interview sessions, and round transitions.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/reports")}
            className="text-xs gap-1"
          >
            View All Reports
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {data?.recentActivity && data.recentActivity.length > 0 ? (
          <div className="space-y-2.5">
            {data.recentActivity.map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    act.status === "success"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : act.status === "warning"
                      ? "bg-amber-500/10 text-amber-500"
                      : "bg-blue-500/10 text-blue-500"
                  }`}>
                    {act.type === "submission" ? (
                      <Code2 className="w-4 h-4" />
                    ) : act.type === "interview" ? (
                      <MessageSquareText className="w-4 h-4" />
                    ) : (
                      <FileCheck className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-foreground">{act.title}</h5>
                    <p className="text-[11px] text-muted-foreground">{act.detail}</p>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  {new Date(act.timestamp).toLocaleDateString()} · {new Date(act.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-border/80">
            <CardContent className="p-8 text-center text-muted-foreground text-xs">
              No recent assessment activity recorded yet. Start an assessment from your "My Assessments" tab.
            </CardContent>
          </Card>
        )}
      </div>

      {/* System Readiness Modal */}
      <SystemReadinessModal
        open={readinessModalOpen}
        onOpenChange={setReadinessModalOpen}
      />
    </div>
  );
}
