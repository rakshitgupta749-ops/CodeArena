import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  Search,
  FileCheck,
  Play,
  Calendar,
  Layers,
} from "lucide-react";

interface StudentAssessmentItem {
  id: string;
  assignmentId: string;
  problemId: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  description: string;
  batchName: string;
  assignedBy: string;
  assignedAt: string;
  dueDate?: string;
  status: "Pending" | "In Progress" | "Completed";
  timeConfig: {
    preCodeAssessmentTimer: number;
    codingTestTimer: number;
    interviewTimer: number;
  };
  stages: {
    precoding: { status: string; integrityScore: number };
    coding: { status: string; attempts: number; bestScore: number; passed: boolean };
    interview: { status: string; score: number | null; passed: boolean };
  };
  nextAction: {
    label: string;
    url: string;
    variant: string;
  };
}

const difficultyColors: Record<string, string> = {
  Easy: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  Hard: "bg-red-500/15 text-red-500 border-red-500/30",
};

export function StudentAssessmentsPage() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<StudentAssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      const res = await api.get<StudentAssessmentItem[]>("/student/assessments");
      setAssessments(res);
    } catch (err) {
      console.error("Failed to load assessments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, []);

  const filteredAssessments = useMemo(() => {
    return assessments.filter((item) => {
      // Search
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.batchName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.assignedBy.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Status
      if (statusFilter !== "all") {
        if (statusFilter === "pending" && item.status !== "Pending") return false;
        if (statusFilter === "in_progress" && item.status !== "In Progress") return false;
        if (statusFilter === "completed" && item.status !== "Completed") return false;
        if (statusFilter === "overdue") {
          if (!item.dueDate) return false;
          if (new Date(item.dueDate) >= new Date() || item.status === "Completed") return false;
        }
      }

      // Difficulty
      if (difficultyFilter !== "all" && item.difficulty !== difficultyFilter) {
        return false;
      }

      return true;
    });
  }, [assessments, searchQuery, statusFilter, difficultyFilter]);

  const counts = useMemo(() => {
    return {
      all: assessments.length,
      pending: assessments.filter((a) => a.status === "Pending").length,
      in_progress: assessments.filter((a) => a.status === "In Progress").length,
      completed: assessments.filter((a) => a.status === "Completed").length,
    };
  }, [assessments]);

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const due = new Date(dateStr);
    const now = new Date();
    const isPast = due.getTime() < now.getTime();
    const diffDays = Math.abs(Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    if (isPast) {
      return { text: `Overdue by ${diffDays}d`, isUrgent: true };
    }
    if (diffDays === 0) {
      return { text: "Due Today", isUrgent: true };
    }
    if (diffDays <= 2) {
      return { text: `Due in ${diffDays}d`, isUrgent: true };
    }
    return { text: `Due ${due.toLocaleDateString()}`, isUrgent: false };
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-6 animate-[fade-in_0.3s_ease-out]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <Layers className="w-7 h-7 text-primary" />
            My Assigned Assessments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Access your timed coding assessments, pre-coding MCQs, and AI technical viva rounds.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/60 self-start md:self-auto overflow-x-auto max-w-full">
          {[
            { key: "all", label: "All", count: counts.all },
            { key: "pending", label: "Pending", count: counts.pending },
            { key: "in_progress", label: "In Progress", count: counts.in_progress },
            { key: "completed", label: "Completed", count: counts.completed },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === tab.key
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                statusFilter === tab.key ? "bg-primary/10 text-primary font-bold" : "bg-muted text-muted-foreground"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search assessments by title, cohort batch, or instructor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs h-9 bg-card border-border/70"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-[150px] text-xs h-9 bg-card border-border/70">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulties</SelectItem>
              <SelectItem value="Easy">Easy</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Assessments List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse p-6 border-border/60">
              <div className="h-6 bg-muted rounded w-1/3 mb-4" />
              <div className="h-4 bg-muted/60 rounded w-1/2 mb-6" />
              <div className="grid grid-cols-3 gap-4">
                <div className="h-16 bg-muted/40 rounded" />
                <div className="h-16 bg-muted/40 rounded" />
                <div className="h-16 bg-muted/40 rounded" />
              </div>
            </Card>
          ))}
        </div>
      ) : filteredAssessments.length > 0 ? (
        <div className="space-y-4">
          {filteredAssessments.map((assessment) => {
            const dueInfo = formatDueDate(assessment.dueDate);
            const totalMinutes =
              assessment.timeConfig.preCodeAssessmentTimer +
              assessment.timeConfig.codingTestTimer +
              assessment.timeConfig.interviewTimer;

            return (
              <Card
                key={assessment.id}
                className="border-border/60 shadow-xs hover:border-primary/40 transition-all overflow-hidden bg-card"
              >
                <div className="p-5 md:p-6 space-y-5">
                  {/* Top row: Title, Badges, Due Date, CTA */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-lg font-bold tracking-tight text-foreground">
                          {assessment.title}
                        </h3>
                        <Badge
                          variant="outline"
                          className={`text-xs ${difficultyColors[assessment.difficulty] || ""}`}
                        >
                          {assessment.difficulty}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {assessment.batchName}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            assessment.status === "Completed"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : assessment.status === "In Progress"
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                              : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                          }`}
                        >
                          {assessment.status}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span>Instructor: <span className="text-foreground font-medium">{assessment.assignedBy}</span></span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          Total Time: {totalMinutes} mins
                        </span>
                        {dueInfo && (
                          <>
                            <span>·</span>
                            <span className={`flex items-center gap-1 font-medium ${
                              dueInfo.isUrgent ? "text-amber-500" : "text-muted-foreground"
                            }`}>
                              <Calendar className="w-3.5 h-3.5" />
                              {dueInfo.text}
                            </span>
                          </>
                        )}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <Button
                        onClick={() => navigate(assessment.nextAction.url)}
                        className={`gap-2 text-xs font-semibold shadow-xs ${
                          assessment.status === "Completed"
                            ? "bg-secondary hover:bg-secondary/80 text-foreground border border-border"
                            : "bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.53_0.18_145)] text-white"
                        }`}
                      >
                        {assessment.status === "Completed" ? (
                          <FileCheck className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 fill-current" />
                        )}
                        {assessment.nextAction.label}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Multi-Round Progress Tracker */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {/* Stage 1: Pre-Coding */}
                    <div className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${
                      assessment.stages.precoding.status === "completed"
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : assessment.stages.precoding.status === "in_progress"
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-border/50 bg-muted/20"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold flex items-center gap-1.5">
                          {assessment.stages.precoding.status === "completed" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">1</span>
                          )}
                          Pre-Coding MCQs
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {assessment.timeConfig.preCodeAssessmentTimer}m
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {assessment.stages.precoding.status === "completed"
                          ? `Passed · Integrity: ${assessment.stages.precoding.integrityScore}%`
                          : assessment.stages.precoding.status === "in_progress"
                          ? "Conversation in progress"
                          : "Concepts & Problem Rubrics"}
                      </p>
                    </div>

                    {/* Stage 2: Coding Sandbox */}
                    <div className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${
                      assessment.stages.coding.status === "completed"
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : assessment.stages.coding.status === "in_progress"
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-border/50 bg-muted/20"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold flex items-center gap-1.5">
                          {assessment.stages.coding.status === "completed" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">2</span>
                          )}
                          Coding Sandbox
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {assessment.timeConfig.codingTestTimer}m
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {assessment.stages.coding.status === "completed"
                          ? `Accepted · Score: ${assessment.stages.coding.bestScore}/100`
                          : assessment.stages.coding.status === "in_progress"
                          ? `Attempts: ${assessment.stages.coding.attempts}`
                          : "Piston test case execution"}
                      </p>
                    </div>

                    {/* Stage 3: AI Technical Viva */}
                    <div className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${
                      assessment.stages.interview.status === "completed"
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : assessment.stages.interview.status === "in_progress"
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-border/50 bg-muted/20"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold flex items-center gap-1.5">
                          {assessment.stages.interview.status === "completed" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">3</span>
                          )}
                          AI Technical Viva
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {assessment.timeConfig.interviewTimer}m
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {assessment.stages.interview.status === "completed"
                          ? `Evaluated · Score: ${assessment.stages.interview.score ?? 80}/100`
                          : assessment.stages.interview.status === "in_progress"
                          ? "In Session"
                          : "Verbal code reasoning"}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed border-border/80 p-12 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="p-3 rounded-full bg-muted w-12 h-12 mx-auto flex items-center justify-center">
              <Layers className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold">No assessments found</h3>
            <p className="text-xs text-muted-foreground">
              {searchQuery || statusFilter !== "all" || difficultyFilter !== "all"
                ? "No assessments match your active filter criteria. Try clearing search or filters."
                : "You do not currently have any assessments assigned. Once assigned by faculty or an instructor, they will appear here."}
            </p>
            {(searchQuery || statusFilter !== "all" || difficultyFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setDifficultyFilter("all");
                }}
                className="text-xs"
              >
                Reset Filters
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
