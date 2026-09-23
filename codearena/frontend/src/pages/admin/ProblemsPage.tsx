import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Loader2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api, type Problem, type Difficulty } from "@/lib/api";

const difficultyColors: Record<Difficulty, string> = {
  Easy: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  Hard: "bg-red-500/15 text-red-500 border-red-500/30",
};

export function ProblemsPage() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchProblems() {
      try {
        const data = await api.get<Problem[]>("/problems");
        setProblems(data);
      } catch (err) {
        console.error("Failed to fetch problems:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProblems();
  }, []);

  const filteredProblems = problems.filter((p) => {
    const matchesFilter = filter === "all" || (filter === "active" ? p.isActive : !p.isActive);
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const toggleActive = async (id: string) => {
    try {
      const updated = await api.patch<Problem>(`/problems/${id}/toggle`);
      setProblems((prev) =>
        prev.map((p) => (p._id === id ? { ...p, isActive: updated.isActive } : p))
      );
    } catch (err) {
      console.error("Failed to toggle problem:", err);
    }
  };

  const handleDeleteProblem = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete problem "${title}"? This action cannot be undone.`)) return;

    try {
      await api.delete(`/problems/${id}`);
      setProblems((prev) => prev.filter((p) => p._id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete problem");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Problems</h1>
        </div>
        <Button
          onClick={() => navigate("/admin/problems/create")}
          className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white shadow-lg shadow-[oklch(0.58_0.18_145)]/20"
          id="create-problem-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Problem
        </Button>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search problems..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10"
                id="search-problems"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40 h-10" id="filter-problems">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Problems</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="text-center">Submissions</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProblems.map((problem, idx) => (
                <TableRow
                  key={problem._id}
                  className="cursor-pointer group"
                  id={`problem-row-${problem._id}`}
                >
                  <TableCell className="text-muted-foreground font-mono text-sm">{idx + 1}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => navigate(`/admin/problems/edit/${problem._id}`)}
                      className="font-medium text-foreground hover:text-primary transition-colors text-left"
                    >
                      {problem.title}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${difficultyColors[problem.difficulty]} text-xs font-medium`}>
                      {problem.difficulty}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {problem.createdBy ? (
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-foreground">
                          {problem.createdBy.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground capitalize">
                          {problem.createdBy.role}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Admin / System</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground font-mono text-sm">{problem.submissionCount || 0}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(problem.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Switch
                        checked={problem.isActive}
                        onCheckedChange={() => toggleActive(problem._id)}
                        id={`toggle-${problem._id}`}
                        className="data-[state=checked]:bg-success"
                      />
                      <span className={`text-xs font-medium ${problem.isActive ? "text-success" : "text-muted-foreground"}`}>
                        {problem.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Delete Problem"
                      onClick={(e) => handleDeleteProblem(e, problem._id, problem.title)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProblems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    No problems found.
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
