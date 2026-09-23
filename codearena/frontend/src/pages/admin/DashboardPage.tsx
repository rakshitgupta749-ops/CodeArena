import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  CheckCircle,
  Clock,
  TrendingUp,
  ArrowRight,
  Plus,
  Search,
  Loader2,
  GraduationCap,
  Layers,
  Settings,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Code2
} from "lucide-react";
import {
  api,
  type AssessmentDashboardItem,
  type Difficulty
} from "@/lib/api";

const difficultyColors: Record<Difficulty, string> = {
  Easy: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  Hard: "bg-red-500/15 text-red-500 border-red-500/30",
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isFaculty = user?.role === "faculty";

  const [assessments, setAssessments] = useState<AssessmentDashboardItem[]>([]);
  const [facultyStats, setFacultyStats] = useState<any>(null);
  const [totalAssessments, setTotalAssessments] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAssessments = async (pageToFetch = page, searchQuery = search, diff = difficultyFilter, stat = statusFilter) => {
    try {
      setLoading(true);
      setError("");
      const queryParams = new URLSearchParams({
        page: String(pageToFetch),
        limit: "8",
      });
      if (searchQuery) queryParams.set("search", searchQuery);
      if (diff !== "all") queryParams.set("difficulty", diff);
      if (stat !== "all") queryParams.set("status", stat);

      const res = await api.get<any>(`/admin/assessment-dashboard?${queryParams.toString()}`);
      setAssessments(res.assessments || []);
      setTotalAssessments(res.total || 0);
      setTotalPages(res.pages || 1);
      setPage(res.page || 1);
      if (res.facultyStats) {
        setFacultyStats(res.facultyStats);
      }
    } catch (err: any) {
      console.error("Error fetching assessment dashboard:", err);
      setError(err.message || "Failed to load assessment data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments(1);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAssessments(1, search, difficultyFilter, statusFilter);
  };

  const handleDifficultyChange = (val: string) => {
    setDifficultyFilter(val);
    fetchAssessments(1, search, val, statusFilter);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    fetchAssessments(1, search, difficultyFilter, val);
  };

  // Aggregated totals across currently fetched assessments (for admin)
  const totalTakenSum = assessments.reduce((acc, a) => acc + (a.totalTaken || 0), 0);
  const totalCompletedSum = assessments.reduce((acc, a) => acc + (a.totalCompleted || 0), 0);
  const totalPendingSum = assessments.reduce((acc, a) => acc + (a.totalPending || 0), 0);
  const avgPassRate =
    assessments.length > 0
      ? Math.round(assessments.reduce((acc, a) => acc + (a.overall?.passPercentage || 0), 0) / assessments.length)
      : 0;

  // Personalized KPI stats for faculty vs global stats for admin
  const stats = isFaculty
    ? [
        { label: "Total Assignments Created", value: facultyStats?.totalAssignmentsCreated ?? 0, icon: BookOpen },
        { label: "Total Candidates Assigned", value: facultyStats?.totalCandidatesAssigned ?? 0, icon: Users },
        { label: "Assessments Completed", value: facultyStats?.assessmentsCompleted ?? 0, icon: CheckCircle },
        { label: "Assessments In Progress", value: facultyStats?.assessmentsInProgress ?? 0, icon: Clock },
        { label: "Average Pass Rate", value: `${facultyStats?.avgPassRate ?? 0}%`, icon: TrendingUp },
      ]
    : [
        { label: "Total Assessments", value: totalAssessments, icon: BookOpen },
        { label: "Total Candidates Taken", value: totalTakenSum, icon: Users },
        { label: "Assessments Completed", value: totalCompletedSum, icon: CheckCircle },
        { label: "Assessments In Progress", value: totalPendingSum, icon: Clock },
        { label: "Average Pass Rate", value: `${avgPassRate}%`, icon: TrendingUp },
      ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight">
              {isFaculty ? "Faculty Assessment Dashboard" : "Admin Assessment Dashboard"}
            </h1>
            {isFaculty && (
              <Badge variant="outline" className="text-xs font-semibold bg-purple-500/10 text-purple-600 border-purple-500/30">
                Faculty Workspace
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {isFaculty
              ? `Welcome back, ${user?.name || "Faculty"}. Monitor your created assignments, assigned candidates, and evaluation pass rates.`
              : "Track faculty assessments, pre-coding, coding, post-coding evaluations, and candidate reports."}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isFaculty ? (
            <>
              <Button
                onClick={() => navigate("/admin/problems/create")}
                className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white gap-1.5 shadow-sm"
                size="sm"
                id="faculty-create-problem-btn"
              >
                <Plus className="w-4 h-4" />
                <span>Create Problem</span>
              </Button>
              <Button
                onClick={() => navigate("/admin/assignments")}
                variant="outline"
                size="sm"
                className="gap-1.5 shadow-sm"
                id="faculty-assign-btn"
              >
                <Users className="w-4 h-4 text-primary" />
                <span>Assign Assessment</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => navigate("/admin/candidates")}
                variant="outline"
                size="sm"
                className="gap-1.5 shadow-sm"
                id="quick-create-user-btn"
              >
                <Plus className="w-4 h-4 text-primary" />
                <span>Create User / Role</span>
              </Button>

              <Button
                onClick={() => navigate("/admin/batches")}
                variant="outline"
                size="sm"
                className="gap-1.5 shadow-sm"
                id="quick-create-batch-btn"
              >
                <Layers className="w-4 h-4 text-primary" />
                <span>Create Batch</span>
              </Button>

              <Button
                onClick={() => navigate("/admin/settings")}
                className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white gap-1.5 shadow-sm"
                size="sm"
                id="quick-settings-btn"
              >
                <Settings className="w-4 h-4" />
                <span>System Config</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {stats.map((stat, i) => (
          <Card
            key={stat.label}
            className="border-border/50 hover:border-border/80 transition-all duration-200 overflow-hidden relative shadow-sm"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1 tracking-tight">{stat.value}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-[oklch(0.58_0.18_145)]/10 text-[oklch(0.58_0.18_145)] shrink-0">
                  <stat.icon className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Feature: Assessments Created by Faculty Table with Pagination */}
      <Card className="border-border/60 shadow-sm bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">
                  {isFaculty ? "My Assigned Assessments & Student Reports" : "Faculty Assessments & Evaluation Progress"}
                </CardTitle>
                <Badge variant="outline" className="text-xs font-normal">
                  {totalAssessments} Total
                </Badge>
              </div>
              <CardDescription className="mt-1">
                {isFaculty
                  ? "Student reports and evaluation progress for assessments assigned by you (creator can be anyone). Click any assessment to inspect candidate evaluations and reports."
                  : "Click any assessment to inspect completed candidate evaluation reports and monitor pending assessments."}
              </CardDescription>
            </div>

            {/* Filters and Search Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              <form onSubmit={handleSearchSubmit} className="relative w-56">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search assessment..."
                  className="pl-8 h-9 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>

              <Select value={difficultyFilter} onValueChange={handleDifficultyChange}>
                <SelectTrigger className="w-32 h-9 text-xs">
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Difficulties</SelectItem>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-28 h-9 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Button type="button" variant="secondary" size="sm" onClick={() => fetchAssessments(1, search, difficultyFilter, statusFilter)} className="h-9 text-xs">
                Filter
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Loading faculty assessments...</span>
            </div>
          ) : error ? (
            <div className="p-6 text-destructive bg-destructive/10 text-center m-4 rounded-xl">
              {error}
            </div>
          ) : assessments.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground space-y-2">
              <Code2 className="w-10 h-10 mx-auto opacity-30" />
              <p className="font-medium text-base">No assessments found</p>
              <p className="text-xs">Assessments created by faculty will show up here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[200px]">Assessment Name</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="text-center">Taken / Total</TableHead>
                    <TableHead>1. Pre-Coding</TableHead>
                    <TableHead>2. Coding</TableHead>
                    <TableHead>3. AI Interview</TableHead>
                    <TableHead className="min-w-[150px]">Pass / Fail Rate</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.map((item) => (
                    <TableRow
                      key={item._id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors group"
                      onClick={() => navigate(`/admin/assessments/${item._id}`)}
                    >
                      {/* Assessment Name & Difficulty */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm group-hover:text-primary transition-colors">
                              {item.title}
                            </span>
                            <Badge variant="outline" className={`${difficultyColors[item.difficulty]} text-[10px] px-1.5 py-0`}>
                              {item.difficulty}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground line-clamp-1 max-w-[240px]">
                            {item.description.replace(/<[^>]*>?/gm, "")}
                          </span>
                        </div>
                      </TableCell>

                      {/* Created By Faculty */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-foreground">
                              {item.createdBy?.name || "Faculty Member"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {item.createdBy?.email || "faculty"}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Total Taken */}
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center justify-center">
                          <span className="font-bold text-sm text-foreground">{item.totalTaken}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {item.totalCompleted} done / {item.totalPending} pend
                          </span>
                        </div>
                      </TableCell>

                      {/* Pre-coding Stats */}
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              {item.precoding.passed} passed
                            </span>
                            <span className="text-[10px] text-muted-foreground">/ {item.precoding.total}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {item.precoding.passRate}% pass rate
                          </span>
                        </div>
                      </TableCell>

                      {/* Coding Stats */}
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              {item.coding.passed} passed
                            </span>
                            <span className="text-[10px] text-muted-foreground">/ {item.coding.total}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {item.coding.passRate}% pass rate
                          </span>
                        </div>
                      </TableCell>

                      {/* Post-coding AI Interview Stats */}
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              {item.postcoding.passed} passed
                            </span>
                            <span className="text-[10px] text-muted-foreground">/ {item.postcoding.completed}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            avg {item.postcoding.avgScore}% score
                          </span>
                        </div>
                      </TableCell>

                      {/* Pass / Fail Percentage */}
                      <TableCell>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {item.overall.passPercentage}% Pass
                            </span>
                            <span className="text-rose-500 font-normal text-[11px]">
                              {item.overall.failPercentage}% Fail
                            </span>
                          </div>
                          {/* Mini Progress Bar */}
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex">
                            <div
                              className="bg-emerald-500 transition-all duration-300"
                              style={{ width: `${item.overall.passPercentage}%` }}
                            />
                            <div
                              className="bg-rose-500/80 transition-all duration-300"
                              style={{ width: `${item.overall.failPercentage}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1 group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                          onClick={() => navigate(`/admin/assessments/${item._id}`)}
                        >
                          <span>Reports</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-border/50 gap-3">
            <div className="text-xs text-muted-foreground">
              Showing page <strong className="text-foreground">{page}</strong> of{" "}
              <strong className="text-foreground">{totalPages}</strong> (Total {totalAssessments} assessments)
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1"
                disabled={page <= 1 || loading}
                onClick={() => fetchAssessments(page - 1)}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </Button>

              {/* Page Number Chips */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "default" : "ghost"}
                  size="sm"
                  className={`h-8 w-8 p-0 text-xs ${p === page ? "bg-[oklch(0.58_0.18_145)] text-white" : ""}`}
                  onClick={() => fetchAssessments(p)}
                >
                  {p}
                </Button>
              ))}

              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1"
                disabled={page >= totalPages || loading}
                onClick={() => fetchAssessments(page + 1)}
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
