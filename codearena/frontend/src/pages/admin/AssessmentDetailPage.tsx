import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Eye,
  Lock,
  Loader2,
  CheckCircle2,
  Clock,
  Search,
  GraduationCap,
  Sparkles,
  FileText,
  AlertCircle
} from "lucide-react";
import { api, type AssessmentCandidatesResponse, type Difficulty } from "@/lib/api";

const difficultyColors: Record<Difficulty, string> = {
  Easy: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  Hard: "bg-red-500/15 text-red-500 border-red-500/30",
};

export function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<AssessmentCandidatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function fetchAssessmentDetails() {
      if (!id) return;
      try {
        setLoading(true);
        setError("");
        const res = await api.get<AssessmentCandidatesResponse>(`/admin/assessments/${id}/candidates`);
        setData(res);
      } catch (err: any) {
        console.error("Failed to load assessment candidates:", err);
        setError(err.message || "Failed to load assessment candidate details.");
      } finally {
        setLoading(false);
      }
    }

    fetchAssessmentDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span>Loading assessment details and candidate reports...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={() => navigate("/admin")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Button>
        <div className="p-4 bg-destructive/10 text-destructive rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error || "Assessment not found."}</span>
        </div>
      </div>
    );
  }

  const { assessment, candidates, completedCount, pendingCount } = data;

  const filteredCandidates = candidates.filter((item) => {
    const matchesSearch =
      item.candidate.name.toLowerCase().includes(search.toLowerCase()) ||
      item.candidate.email.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "completed" ? item.isCompleted : !item.isCompleted);

    return matchesSearch && matchesStatus;
  });

  const getRoundBadge = (status: string, score?: number | null) => {
    switch (status) {
      case "passed":
      case "Accepted":
      case "completed":
        return (
          <div className="flex items-center gap-1.5">
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
              Passed
            </Badge>
            {score !== null && score !== undefined && (
              <span className="text-xs font-mono font-medium text-muted-foreground">{Math.round(score)}%</span>
            )}
          </div>
        );
      case "in_progress":
      case "generating":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
            In Progress
          </Badge>
        );
      case "failed":
      case "Wrong Answer":
      case "Runtime Error":
      case "Compilation Error":
      case "Time Limit Exceeded":
        return (
          <div className="flex items-center gap-1.5">
            <Badge variant="destructive" className="text-xs">
              Failed
            </Badge>
            {score !== null && score !== undefined && (
              <span className="text-xs font-mono text-muted-foreground">{Math.round(score)}%</span>
            )}
          </div>
        );
      default:
        return <Badge variant="outline" className="text-xs text-muted-foreground">Not Started</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top back button */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Assessment Dashboard
        </Button>
      </div>

      {/* Assessment Header Card */}
      <Card className="border-border/60 shadow-sm bg-card/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{assessment.title}</h1>
                <Badge variant="outline" className={`${difficultyColors[assessment.difficulty]} font-medium`}>
                  {assessment.difficulty}
                </Badge>
                <Badge variant={assessment.isActive ? "default" : "secondary"}>
                  {assessment.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-purple-500" />
                  <span>
                    Created by Faculty:{" "}
                    <strong className="text-foreground">
                      {assessment.createdBy?.name || "Faculty Member"}
                    </strong>
                  </span>
                </div>
                <span>•</span>
                <span>Created {new Date(assessment.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/assignments">
                  <FileText className="w-4 h-4 mr-2" /> Assign to Batch / Student
                </Link>
              </Button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/50">
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Total Enrolled / Taken</p>
              <p className="text-2xl font-bold mt-0.5">{candidates.length}</p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Completed</p>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{completedCount}</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pending</p>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{pendingCount}</p>
            </div>
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-primary font-medium">Completion Rate</p>
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-primary mt-0.5">
                {candidates.length > 0 ? Math.round((completedCount / candidates.length) * 100) : 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Candidate Attempts Section */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Candidate Assessments & Reports</CardTitle>
              <CardDescription>
                Full report is available only for completed assessments. Pending assessments are actively monitored below.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search candidate..."
                  className="pl-8 h-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="Status Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed Only</SelectItem>
                  <SelectItem value="pending">Pending Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Candidate</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>1. Pre-Coding</TableHead>
                <TableHead>2. Coding Test</TableHead>
                <TableHead>3. AI Interview</TableHead>
                <TableHead className="text-center">Overall Status</TableHead>
                <TableHead className="text-right">Assessment Report</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCandidates.map((item) => (
                <TableRow key={item.candidate._id} className={item.isCompleted ? "" : "bg-muted/10"}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs shrink-0">
                        {item.candidate.name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm text-foreground">{item.candidate.name}</span>
                        <span className="text-xs text-muted-foreground">{item.candidate.email}</span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-sm">
                    {item.batch ? (
                      <Badge variant="outline" className="text-xs font-normal">
                        {item.batch}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Individual</span>
                    )}
                  </TableCell>

                  {/* Pre-coding */}
                  <TableCell>
                    {getRoundBadge(item.precoding.status, item.precoding.score)}
                  </TableCell>

                  {/* Coding */}
                  <TableCell>
                    {getRoundBadge(item.coding.status, item.coding.score)}
                  </TableCell>

                  {/* Post-coding / AI Interview */}
                  <TableCell>
                    {getRoundBadge(item.postcoding.status, item.postcoding.score)}
                  </TableCell>

                  {/* Overall Status */}
                  <TableCell className="text-center">
                    {item.isCompleted ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Completed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1">
                        <Clock className="w-3 h-3" /> Pending
                      </Badge>
                    )}
                  </TableCell>

                  {/* Report Action: Report ONLY for completed, pending is locked */}
                  <TableCell className="text-right">
                    {item.isCompleted ? (
                      item.reportId ? (
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white gap-1.5 text-xs shadow-sm"
                          asChild
                        >
                          <Link to={`/admin/reports/${item.reportId}`}>
                            <Eye className="w-3.5 h-3.5" /> View Report
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white gap-1.5 text-xs shadow-sm"
                          asChild
                        >
                          <Link to={`/admin/interviews/${item.postcoding._id}`}>
                            <Eye className="w-3.5 h-3.5" /> View Evaluation
                          </Link>
                        </Button>
                      )
                    ) : (
                      <div className="inline-flex items-center gap-1 text-xs text-muted-foreground/80 bg-muted/50 px-2.5 py-1.5 rounded-lg border border-border/40">
                        <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Available on completion</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}

              {filteredCandidates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No candidate records found for this assessment.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
