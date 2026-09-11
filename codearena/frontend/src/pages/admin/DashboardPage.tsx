import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Activity, CheckCircle, Clock, TrendingUp, Award, Eye, ArrowRight, FileText, PieChart, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface AnalyticsOverview {
  totalCandidates: number;
  totalInterviews: number;
  completedInterviews: number;
  pendingInterviews: number;
  avgScore: number;
  passRate: number;
}

interface InterviewSession {
  _id: string;
  user?: { name: string; email: string };
  problem?: { title: string; difficulty: string };
  status: string;
  overallScore: number | null;
  startedAt: string;
  answers?: any[];
  questions?: any[];
}

interface Candidate {
  _id: string;
  name: string;
  email: string;
  interviewCount: number;
  latestInterview?: {
    status: string;
    overallScore: number | null;
  } | null;
}

export function DashboardPage() {
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [recentInterviews, setRecentInterviews] = useState<InterviewSession[]>([]);
  const [recentCandidates, setRecentCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [analyticsRes, interviewsRes, candidatesRes] = await Promise.allSettled([
          api.get<any>("/admin/analytics"),
          api.get<{ interviews: InterviewSession[] }>("/admin/interviews?limit=5"),
          api.get<{ candidates: Candidate[] }>("/admin/candidates?limit=5"),
        ]);

        if (analyticsRes.status === "fulfilled") {
          const data = analyticsRes.value;
          const overview = data?.overview || data || {};
          setAnalytics({
            totalCandidates: typeof overview.totalCandidates === "number" ? overview.totalCandidates : 0,
            totalInterviews: typeof overview.totalInterviews === "number" ? overview.totalInterviews : 0,
            completedInterviews: typeof overview.completedInterviews === "number" ? overview.completedInterviews : 0,
            pendingInterviews: typeof overview.pendingInterviews === "number" ? overview.pendingInterviews : 0,
            avgScore: typeof overview.avgScore === "number" ? overview.avgScore : 0,
            passRate: typeof overview.passRate === "number" ? overview.passRate : 0,
          });
        } else {
          console.error("Analytics fetch failed:", analyticsRes.reason);
          setError("Failed to load dashboard metrics. Ensure backend server is accessible.");
        }

        if (interviewsRes.status === "fulfilled") {
          setRecentInterviews(interviewsRes.value.interviews || []);
        }

        if (candidatesRes.status === "fulfilled") {
          setRecentCandidates(candidatesRes.value.candidates || []);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError("Failed to load dashboard data. Ensure you have the proper permissions.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20">In Progress</Badge>;
      case "generating":
        return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/20">Generating</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const stats = [
    { label: "Total Candidates", value: analytics?.totalCandidates ?? 0, icon: Users },
    { label: "Total Interviews", value: analytics?.totalInterviews ?? 0, icon: Activity },
    { label: "Completed", value: analytics?.completedInterviews ?? 0, icon: CheckCircle },
    { label: "In Progress", value: analytics?.pendingInterviews ?? 0, icon: Clock },
    { label: "Avg Score", value: `${analytics?.avgScore ?? 0}%`, icon: TrendingUp },
    { label: "Pass Rate", value: `${analytics?.passRate ?? 0}%`, icon: Award },
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Loading assessment dashboard...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-destructive bg-destructive/10 rounded-xl">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assessment Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Overview of candidate evaluations, interview sessions, and system metrics.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {stats.map((stat, i) => (
          <Card
            key={stat.label}
            className="border-border/50 hover:border-border transition-all duration-200 group overflow-hidden relative"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1 tracking-tight">{stat.value}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-[oklch(0.58_0.18_145)] shadow-md transition-transform group-hover:scale-105 shrink-0">
                  <stat.icon className="w-4 h-4 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Interviews */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-lg">Recent Interviews</CardTitle>
              <CardDescription>Latest interview sessions conducted</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/interviews" className="text-xs flex items-center gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentInterviews.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No recent interview sessions found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInterviews.map((interview) => (
                    <TableRow key={interview._id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{interview.user?.name || "Unknown"}</span>
                          <span className="text-xs text-muted-foreground">{interview.problem?.title || interview.user?.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(interview.status)}</TableCell>
                      <TableCell>
                        {interview.overallScore !== null && interview.overallScore !== undefined ? (
                          <span className="font-semibold text-sm">{Math.round(interview.overallScore)}%</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/admin/interviews/${interview._id}`}>
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Candidates */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-lg">Recent Candidates</CardTitle>
              <CardDescription>Registered candidates and trainees</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/candidates" className="text-xs flex items-center gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentCandidates.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No candidates registered yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Interviews</TableHead>
                    <TableHead>Latest Score</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCandidates.map((candidate) => (
                    <TableRow key={candidate._id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{candidate.name}</span>
                          <span className="text-xs text-muted-foreground">{candidate.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{candidate.interviewCount ?? 0}</TableCell>
                      <TableCell>
                        {candidate.latestInterview?.overallScore !== null && candidate.latestInterview?.overallScore !== undefined ? (
                          <span className="font-semibold text-sm">{Math.round(candidate.latestInterview.overallScore)}%</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/admin/candidates/${candidate._id}`}>
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation Cards */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Quick Actions</CardTitle>
          <CardDescription>Shortcuts to key management modules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-muted/50" asChild>
              <Link to="/admin/candidates">
                <Users className="w-5 h-5 text-primary" />
                <span>Candidates</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-muted/50" asChild>
              <Link to="/admin/interviews">
                <Activity className="w-5 h-5 text-primary" />
                <span>Interviews</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-muted/50" asChild>
              <Link to="/admin/reports">
                <FileText className="w-5 h-5 text-primary" />
                <span>Reports</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-muted/50" asChild>
              <Link to="/admin/analytics">
                <PieChart className="w-5 h-5 text-primary" />
                <span>Analytics</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

