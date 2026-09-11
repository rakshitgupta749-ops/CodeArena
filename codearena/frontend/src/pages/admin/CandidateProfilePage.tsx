import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import type { Assignment, Problem } from "@/lib/api";
import { Loader2, ArrowLeft, Calendar, Mail, Trash2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function CandidateProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<any>(null);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);

  // Assign Assessment State
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [candRes, intRes, assignRes, probRes] = await Promise.all([
          api.get(`/admin/candidates/${id}`),
          api.get(`/admin/candidates/${id}/interviews`),
          api.get<Assignment[]>(`/admin/candidates/${id}/assignments`),
          api.get<Problem[]>(`/problems`)
        ]);
        setCandidate(candRes);
        setInterviews((intRes as any).interviews);
        setAssignments(assignRes);
        setProblems(probRes);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!candidate) return <div>Candidate not found.</div>;

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProblem) return;
    
    setAssigning(true);
    try {
      await api.post("/admin/assignments", {
        assessmentId: selectedProblem,
        candidateId: candidate._id,
      });
      setIsAssignOpen(false);
      setSelectedProblem("");
      
      // Refresh assignments
      const assignRes = await api.get<Assignment[]>(`/admin/candidates/${id}/assignments`);
      setAssignments(assignRes);
    } catch (err: any) {
      alert(err.message || "Failed to assign assessment");
    } finally {
      setAssigning(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to deactivate this trainee? Historical data will be preserved, but they will not be able to log in.")) return;
    
    setDeleting(true);
    try {
      await api.delete(`/admin/candidates/${id}`);
      navigate("/admin/candidates");
    } catch (err: any) {
      alert(err.message || "Failed to delete candidate");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/candidates")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {candidate.name}
              {!candidate.isActive && <Badge variant="destructive" className="ml-3">Inactive</Badge>}
            </h1>
            <p className="text-muted-foreground flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1"><Mail className="h-4 w-4"/> {candidate.email}</span>
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4"/> Joined {new Date(candidate.createdAt).toLocaleDateString()}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="destructive" onClick={handleDelete} disabled={deleting || !candidate.isActive}>
            {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Deactivate Trainee
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assignments">Assignments ({assignments.length})</TabsTrigger>
          <TabsTrigger value="interviews">Interview Attempts ({candidate.interviewCount})</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>Status:</strong> {candidate.isActive ? "Active" : "Inactive"}</p>
                  <p><strong>Total Interviews:</strong> {candidate.interviewCount}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="assignments" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle>Assigned Assessments</CardTitle>
              <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Assign Assessment
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Assessment</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAssign} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="problem">Select Assessment</Label>
                      <Select value={selectedProblem} onValueChange={setSelectedProblem}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a problem" />
                        </SelectTrigger>
                        <SelectContent>
                          {problems.map(p => (
                            <SelectItem key={p._id} value={p._id}>
                              {p.title} ({p.difficulty})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button type="submit" disabled={assigning || !selectedProblem} className="bg-[oklch(0.58_0.18_145)]">
                        {assigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Assign
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assessment</TableHead>
                    <TableHead>Assigned By</TableHead>
                    <TableHead>Assigned On</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map(a => (
                    <TableRow key={a._id}>
                      <TableCell className="font-medium">{a.assessment?.title || "Unknown"}</TableCell>
                      <TableCell>{(a.assignedBy as any)?.name || "System"}</TableCell>
                      <TableCell>{new Date(a.assignedAt).toLocaleDateString()}</TableCell>
                      <TableCell><Badge variant={a.status === "Completed" ? "default" : "secondary"}>{a.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {assignments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No assignments found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="interviews" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Interview History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Problem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interviews.map((int: any) => (
                    <TableRow key={int._id}>
                      <TableCell>{new Date(int.startedAt).toLocaleString()}</TableCell>
                      <TableCell>{int.problem?.title || "Unknown"}</TableCell>
                      <TableCell><Badge>{int.status}</Badge></TableCell>
                      <TableCell>{int.overallScore ? `${Math.round(int.overallScore)}%` : "N/A"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/interviews/${int._id}`)}>
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {interviews.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">No interviews found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
