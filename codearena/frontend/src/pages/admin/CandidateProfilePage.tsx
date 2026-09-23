import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import type { Assignment, Problem } from "@/lib/api";
import {
  Loader2,
  ArrowLeft,
  Calendar,
  Mail,
  Plus,
  UserCheck,
  UserX,
  Trash2,
  GraduationCap,
  BookOpen,
  Users,
  CheckCircle2,
  User as UserIcon,
} from "lucide-react";
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

  // Assign Assessment State (Only used for student candidates)
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [candRes, intRes, assignRes, probRes] = await Promise.all([
          api.get(`/admin/candidates/${id}`),
          api.get(`/admin/candidates/${id}/interviews`).catch(() => ({ interviews: [] })),
          api.get<Assignment[]>(`/admin/candidates/${id}/assignments`).catch(() => []),
          api.get<Problem[]>(`/problems`).catch(() => []),
        ]);
        setCandidate(candRes);
        setInterviews((intRes as any).interviews || []);
        setAssignments(assignRes || []);
        setProblems(probRes || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">User not found.</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/candidates")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Users
        </Button>
      </div>
    );
  }

  const isFaculty = candidate.role === "faculty";

  // Assign Assessment (Students Only)
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

  // Deactivate
  const handleDeactivate = async () => {
    const roleTitle = isFaculty ? "faculty member" : "trainee";
    if (
      !confirm(
        `Are you sure you want to deactivate this ${roleTitle}? Historical data will be preserved, but they will not be able to log in.`
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      await api.delete(`/admin/candidates/${id}`);
      setCandidate((prev: any) => ({ ...prev, isActive: false }));
    } catch (err: any) {
      alert(err.message || "Failed to deactivate user");
    } finally {
      setActionLoading(false);
    }
  };

  // Reactivate
  const handleReactivate = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/admin/candidates/${id}/reactivate`);
      setCandidate((prev: any) => ({ ...prev, isActive: true }));
    } catch (err: any) {
      alert(err.message || "Failed to reactivate user");
    } finally {
      setActionLoading(false);
    }
  };

  // Permanently Delete
  const handleDeletePermanently = async () => {
    const roleTitle = isFaculty ? "faculty member" : "trainee";
    if (
      !confirm(
        `DANGER: Are you sure you want to PERMANENTLY DELETE this ${roleTitle} (${candidate.name})?\n\nThis will completely erase their account, assignments, and test history from the database. This action CANNOT be undone!`
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      await api.delete(`/admin/candidates/${id}/permanent`);
      alert("User deleted permanently.");
      navigate("/admin/candidates");
    } catch (err: any) {
      alert(err.message || "Failed to delete user permanently");
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/candidates")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-3xl font-bold tracking-tight">{candidate.name}</h1>
              {isFaculty ? (
                <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 gap-1 font-medium">
                  <GraduationCap className="w-3.5 h-3.5" /> Faculty
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 gap-1 font-medium">
                  <UserIcon className="w-3.5 h-3.5" /> Student
                </Badge>
              )}
              {!candidate.isActive && (
                <Badge variant="destructive">Deactivated</Badge>
              )}
            </div>
            <p className="text-muted-foreground flex items-center gap-4 mt-1 text-sm">
              <span className="flex items-center gap-1">
                <Mail className="h-4 w-4 text-muted-foreground" /> {candidate.email}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-muted-foreground" /> Joined{" "}
                {new Date(candidate.createdAt).toLocaleDateString()}
              </span>
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          {candidate.isActive ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeactivate}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserX className="w-4 h-4 mr-2" />
              )}
              Deactivate {isFaculty ? "Faculty" : "Trainee"}
            </Button>
          ) : (
            /* When Deactivated: 2 distinct options: 1st Activate, 2nd Delete Permanently */
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/30"
                onClick={handleReactivate}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <UserCheck className="w-4 h-4 mr-2" />
                )}
                Activate {isFaculty ? "Faculty" : "Trainee"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDeletePermanently}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete Permanently
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* RENDER FACULTY VIEW */}
      {isFaculty ? (
        <div className="space-y-6">
          {/* Faculty Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Assessments Created
                </CardTitle>
                <BookOpen className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {candidate.assessmentsCount ?? candidate.assessmentsCreated?.length ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Assessments authored by this faculty</p>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Trainees Assigned
                </CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {candidate.traineesCount ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Distinct candidates assigned assessments</p>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Assignments Issued
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {candidate.assignmentsCreated?.length ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total assignments dispatched to candidates</p>
              </CardContent>
            </Card>
          </div>

          {/* Faculty Tabs: Assessments Created, Assigned Trainees, Profile Details */}
          <Tabs defaultValue="created" className="w-full">
            <TabsList>
              <TabsTrigger value="created">
                Created Assessments ({candidate.assessmentsCreated?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="trainees">
                Assigned Trainees ({candidate.assignmentsCreated?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="profile">Faculty Profile</TabsTrigger>
            </TabsList>

            {/* Created Assessments Tab */}
            <TabsContent value="created" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Assessments Authored by {candidate.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Assessment Title</TableHead>
                        <TableHead>Difficulty</TableHead>
                        <TableHead>Tags</TableHead>
                        <TableHead>Created Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(candidate.assessmentsCreated || []).map((problem: any) => (
                        <TableRow key={problem._id}>
                          <TableCell className="font-medium">{problem.title}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                problem.difficulty === "Easy"
                                  ? "secondary"
                                  : problem.difficulty === "Medium"
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              {problem.difficulty}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {(problem.tags || []).map((t: string) => (
                                <span
                                  key={t}
                                  className="text-[11px] bg-muted px-2 py-0.5 rounded text-muted-foreground"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {problem.createdAt ? new Date(problem.createdAt).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => navigate(`/admin/assessments/${problem._id}`)}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!candidate.assessmentsCreated || candidate.assessmentsCreated.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                            No assessments authored yet by this faculty member.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Assigned Trainees Tab */}
            <TabsContent value="trainees" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Trainees Assigned by {candidate.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Candidate / Trainee</TableHead>
                        <TableHead>Assessment</TableHead>
                        <TableHead>Assigned On</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(candidate.assignmentsCreated || []).map((a: any) => (
                        <TableRow key={a._id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{a.candidate?.name || "Unknown Candidate"}</span>
                              <span className="text-xs text-muted-foreground">{a.candidate?.email || "—"}</span>
                            </div>
                          </TableCell>
                          <TableCell>{a.assessment?.title || "Unknown Assessment"}</TableCell>
                          <TableCell>
                            {a.assignedAt ? new Date(a.assignedAt).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={a.status === "Completed" ? "default" : "secondary"}>
                              {a.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!candidate.assignmentsCreated || candidate.assignmentsCreated.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                            No trainees assigned yet by this faculty member.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Profile Overview Tab */}
            <TabsContent value="profile" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Faculty Profile Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Full Name</p>
                      <p className="font-semibold text-base mt-0.5">{candidate.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email Address</p>
                      <p className="font-semibold text-base mt-0.5">{candidate.email}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Role</p>
                      <div className="mt-0.5">
                        <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30">
                          Faculty Instructor
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Account Status</p>
                      <div className="mt-0.5">
                        <Badge variant={candidate.isActive ? "outline" : "destructive"}>
                          {candidate.isActive ? "Active" : "Deactivated"}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date Joined</p>
                      <p className="font-semibold mt-0.5">
                        {new Date(candidate.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Assessments Authored</p>
                      <p className="font-semibold mt-0.5">
                        {candidate.assessmentsCount ?? candidate.assessmentsCreated?.length ?? 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        /* RENDER STUDENT / CANDIDATE VIEW */
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="assignments">Assignments ({assignments.length})</TabsTrigger>
            <TabsTrigger value="interviews">Interview Attempts ({candidate.interviewCount || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Full Name:</span>{" "}
                      <span className="font-medium">{candidate.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>{" "}
                      <span className="font-medium">{candidate.email}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Role:</span>{" "}
                      <Badge variant="outline" className="ml-1 text-xs">Student / Candidate</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>{" "}
                      <span className="font-medium">{candidate.isActive ? "Active" : "Deactivated"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Interviews Taken:</span>{" "}
                      <span className="font-medium">{candidate.interviewCount || 0}</span>
                    </div>
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
                      <DialogTitle>Assign Assessment to {candidate.name}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAssign} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="problem">Select Assessment</Label>
                        <Select value={selectedProblem} onValueChange={setSelectedProblem}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an assessment" />
                          </SelectTrigger>
                          <SelectContent>
                            {problems.map((p) => (
                              <SelectItem key={p._id} value={p._id}>
                                {p.title} ({p.difficulty})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end pt-2">
                        <Button
                          type="submit"
                          disabled={assigning || !selectedProblem}
                          className="bg-[oklch(0.58_0.18_145)] text-white"
                        >
                          {assigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          Assign
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
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
                    {assignments.map((a) => (
                      <TableRow key={a._id}>
                        <TableCell className="font-medium">{a.assessment?.title || "Unknown"}</TableCell>
                        <TableCell>{(a.assignedBy as any)?.name || "Faculty / Admin"}</TableCell>
                        <TableCell>{new Date(a.assignedAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={a.status === "Completed" ? "default" : "secondary"}>
                            {a.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {assignments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No assignments found for this candidate.
                        </TableCell>
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
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Problem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interviews.map((int: any) => (
                      <TableRow key={int._id}>
                        <TableCell>{new Date(int.startedAt).toLocaleString()}</TableCell>
                        <TableCell>{int.problem?.title || "Unknown"}</TableCell>
                        <TableCell>
                          <Badge>{int.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {int.overallScore ? `${Math.round(int.overallScore)}%` : "N/A"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/admin/interviews/${int._id}`)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {interviews.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No interviews recorded.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
