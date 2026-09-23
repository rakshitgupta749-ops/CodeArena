import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CodeViewer } from "@/components/CodeViewer";
import { Search, Code2, Loader2 } from "lucide-react";
import { api, type Problem, type Submission, type SubmissionStatus } from "@/lib/api";

const statusColors: Record<SubmissionStatus, string> = {
  Accepted: "bg-success/15 text-success border-success/30",
  "Wrong Answer": "bg-destructive/15 text-destructive border-destructive/30",
  "Compilation Error": "bg-destructive/15 text-destructive border-destructive/30",
  "Runtime Error": "bg-warning/15 text-warning border-warning/30",
  "Time Limit Exceeded": "bg-warning/15 text-warning border-warning/30",
  Pending: "bg-blue-500/15 text-blue-500 border-blue-500/30",
};

export function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [problemFilter, setProblemFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [subsData, probsData] = await Promise.all([
          api.get<Submission[]>("/submissions"),
          api.get<Problem[]>("/problems"),
        ]);
        setSubmissions(subsData);
        setProblems(probsData);
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = submissions.filter((sub) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (sub.user?.name && sub.user.name.toLowerCase().includes(q)) ||
      (sub.user?.email && sub.user.email.toLowerCase().includes(q)) ||
      (sub.problem?.title && sub.problem.title.toLowerCase().includes(q));
    const matchesProblem = problemFilter === "all" || sub.problem?._id === problemFilter;
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    return Boolean(matchesSearch && matchesProblem && matchesStatus);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Submissions</h1>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10"
                id="search-submissions"
              />
            </div>
            <Select value={problemFilter} onValueChange={setProblemFilter}>
              <SelectTrigger className="w-52 h-10" id="filter-problem">
                <SelectValue placeholder="Filter by Problem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Problems</SelectItem>
                {problems.map((p) => (
                  <SelectItem key={p._id} value={p._id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 h-10" id="filter-status">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Accepted">Accepted</SelectItem>
                <SelectItem value="Wrong Answer">Wrong Answer</SelectItem>
                <SelectItem value="Runtime Error">Runtime Error</SelectItem>
                <SelectItem value="Compilation Error">Compilation Error</SelectItem>
                <SelectItem value="Time Limit Exceeded">Time Limit Exceeded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>User</TableHead>
                <TableHead>Problem</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Exec. Time</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Code</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((sub) => (
                <TableRow key={sub._id} className="cursor-pointer hover:bg-muted/50" id={`sub-row-${sub._id}`} onClick={() => setSelectedSubmission(sub)}>
                  <TableCell className="font-medium">{sub.user?.name || "Unknown Candidate"}</TableCell>
                  <TableCell className="text-muted-foreground">{sub.problem?.title || "Unknown Problem"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-mono">
                      {sub.language}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${statusColors[sub.status]} text-xs font-medium`}>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{sub.executionTime}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(sub.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell className="text-right">
                    <button className="text-primary hover:text-primary/80 transition-colors" onClick={(e) => { e.stopPropagation(); setSelectedSubmission(sub); }}>
                      <Code2 className="w-4 h-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No submissions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Code Viewer Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Code2 className="w-5 h-5" />
              Submission: {selectedSubmission?.problem?.title}
            </DialogTitle>
            <div className="flex items-center gap-3 pt-2">
              <span className="text-sm text-muted-foreground">by <span className="font-medium text-foreground">{selectedSubmission?.user?.name}</span></span>
              <Badge variant="outline" className={`${selectedSubmission ? statusColors[selectedSubmission.status] : ""} text-xs`}>
                {selectedSubmission?.status}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">{selectedSubmission?.executionTime}</span>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden mt-4">
            {selectedSubmission && (
              <CodeViewer code={selectedSubmission.code} height="450px" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
