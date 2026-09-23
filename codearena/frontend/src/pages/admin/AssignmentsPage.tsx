import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import type { Assignment, Problem, Batch } from "@/lib/api";
import {
  Loader2,
  Trash2,
  UserPlus,
  Users,
  Pencil,
  Lock,
  Clock,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

export function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Assign to batch modal state
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedBatchProblem, setSelectedBatchProblem] = useState("");
  const [assigningBatch, setAssigningBatch] = useState(false);

  // Assign to candidate modal state
  const [isCandidateOpen, setIsCandidateOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [selectedCandProblem, setSelectedCandProblem] = useState("");
  const [candidateDueDate, setCandidateDueDate] = useState("");
  const [showCandCustomConfig, setShowCandCustomConfig] = useState(false);
  const [candTimers, setCandTimers] = useState({
    preCodeAssessmentTimer: 15,
    codingTestTimer: 60,
    interviewTimer: 30,
  });
  const [candQuestions, setCandQuestions] = useState({
    preCodeMaxQuestions: 7,
    postCodeMaxQuestions: 10,
  });
  const [assigningCandidate, setAssigningCandidate] = useState(false);

  // Edit Pending Assignment state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [editProblem, setEditProblem] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editTimers, setEditTimers] = useState({
    preCodeAssessmentTimer: 15,
    codingTestTimer: 60,
    interviewTimer: 30,
  });
  const [editQuestions, setEditQuestions] = useState({
    preCodeMaxQuestions: 7,
    postCodeMaxQuestions: 10,
  });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assignRes, probRes, batchRes, candRes] = await Promise.all([
        api.get<Assignment[]>("/admin/assignments"),
        api.get<Problem[]>("/problems"),
        api.get<Batch[]>("/admin/batches"),
        api.get<{ candidates: any[] }>("/admin/candidates?role=student&limit=500")
      ]);
      setAssignments(assignRes);
      setProblems(probRes);
      setBatches(batchRes);
      setCandidates((candRes.candidates || []).filter(c => (c.role === "user" || !c.role) && c.isActive));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  };

  const handleCandidateProblemChange = (probId: string) => {
    setSelectedCandProblem(probId);
    const prob = problems.find(p => p._id === probId);
    if (prob) {
      setCandTimers({
        preCodeAssessmentTimer: prob.timeConfig?.preCodeAssessmentTimer ?? 15,
        codingTestTimer: prob.timeConfig?.codingTestTimer ?? 60,
        interviewTimer: prob.timeConfig?.interviewTimer ?? 30,
      });
      setCandQuestions({
        preCodeMaxQuestions: prob.questionsConfig?.preCodeMaxQuestions ?? 7,
        postCodeMaxQuestions: prob.questionsConfig?.postCodeMaxQuestions ?? 10,
      });
    }
  };

  const handleAssignToBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssigningBatch(true);
    try {
      const res = await api.post(`/admin/batches/${selectedBatch}/assign-assessment`, {
        assessmentId: selectedBatchProblem
      });
      toast.success((res as any).message || "Assignment to batch completed.");
      setIsBatchOpen(false);
      setSelectedBatch("");
      setSelectedBatchProblem("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign to batch");
    } finally {
      setAssigningBatch(false);
    }
  };

  const handleAssignToCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssigningCandidate(true);
    try {
      const payload: any = {
        candidateId: selectedCandidate,
        assessmentId: selectedCandProblem,
        dueDate: candidateDueDate ? new Date(candidateDueDate).toISOString() : null,
      };

      if (showCandCustomConfig) {
        payload.timeConfig = {
          preCodeAssessmentTimer: Number(candTimers.preCodeAssessmentTimer),
          codingTestTimer: Number(candTimers.codingTestTimer),
          interviewTimer: Number(candTimers.interviewTimer),
        };
        payload.questionsConfig = {
          preCodeMaxQuestions: Number(candQuestions.preCodeMaxQuestions),
          postCodeMaxQuestions: Number(candQuestions.postCodeMaxQuestions),
        };
      }

      await api.post("/admin/assignments", payload);
      toast.success("Assessment assigned to candidate successfully.");
      setIsCandidateOpen(false);
      setSelectedCandidate("");
      setSelectedCandProblem("");
      setCandidateDueDate("");
      setShowCandCustomConfig(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign to candidate");
    } finally {
      setAssigningCandidate(false);
    }
  };

  const handleOpenEdit = (assignment: any) => {
    if (assignment.status !== "Pending") {
      toast.error("Only assignments with 'Pending' status can be edited.");
      return;
    }
    setEditingAssignment(assignment);
    setEditProblem(assignment.assessment?._id || "");
    setEditDueDate(assignment.dueDate ? new Date(assignment.dueDate).toISOString().split("T")[0] : "");
    setEditTimers({
      preCodeAssessmentTimer:
        assignment.timeConfig?.preCodeAssessmentTimer ??
        assignment.assessment?.timeConfig?.preCodeAssessmentTimer ??
        15,
      codingTestTimer:
        assignment.timeConfig?.codingTestTimer ??
        assignment.assessment?.timeConfig?.codingTestTimer ??
        60,
      interviewTimer:
        assignment.timeConfig?.interviewTimer ??
        assignment.assessment?.timeConfig?.interviewTimer ??
        30,
    });
    setEditQuestions({
      preCodeMaxQuestions:
        assignment.questionsConfig?.preCodeMaxQuestions ??
        assignment.assessment?.questionsConfig?.preCodeMaxQuestions ??
        7,
      postCodeMaxQuestions:
        assignment.questionsConfig?.postCodeMaxQuestions ??
        assignment.assessment?.questionsConfig?.postCodeMaxQuestions ??
        10,
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssignment) return;
    setSavingEdit(true);
    try {
      await api.put(`/admin/assignments/${editingAssignment._id}`, {
        assessmentId: editProblem,
        dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
        timeConfig: {
          preCodeAssessmentTimer: Number(editTimers.preCodeAssessmentTimer),
          codingTestTimer: Number(editTimers.codingTestTimer),
          interviewTimer: Number(editTimers.interviewTimer),
        },
        questionsConfig: {
          preCodeMaxQuestions: Number(editQuestions.preCodeMaxQuestions),
          postCodeMaxQuestions: Number(editQuestions.postCodeMaxQuestions),
        },
      });
      toast.success("Pending assignment updated successfully!");
      setIsEditOpen(false);
      setEditingAssignment(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update assignment.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm("Are you sure you want to remove this assessment assignment?")) return;
    try {
      await api.delete(`/admin/assignments/${id}`);
      toast.success("Assignment removed successfully.");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove assignment");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Assign problem assessments to candidates and batches, customize per-student timing limits, and manage pending assignments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Assign to Candidate Dialog */}
          <Dialog open={isCandidateOpen} onOpenChange={setIsCandidateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="shadow-sm">
                <UserPlus className="w-4 h-4 mr-2 text-primary" />
                Assign to Candidate
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Assign Assessment to Candidate</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAssignToCandidate} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Select Candidate</Label>
                  <Select value={selectedCandidate} onValueChange={setSelectedCandidate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select candidate" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.name} ({c.email}) {!c.isActive ? "(Inactive)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Select Assessment</Label>
                  <Select value={selectedCandProblem} onValueChange={handleCandidateProblemChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assessment" />
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

                <div className="space-y-2">
                  <Label>Due Date (Optional)</Label>
                  <Input
                    type="date"
                    value={candidateDueDate}
                    onChange={(e) => setCandidateDueDate(e.target.value)}
                  />
                </div>

                {/* Optional Custom Timing & Question Caps Accordion */}
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
                  <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setShowCandCustomConfig(!showCandCustomConfig)}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Customize Round Timers & Question Limits for this Student</span>
                    </div>
                    {showCandCustomConfig ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  {showCandCustomConfig && (
                    <div className="pt-2 space-y-3 border-t border-border/50">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[11px]">Round 1: Pre-Code (min)</Label>
                          <Input
                            type="number"
                            min={5}
                            max={60}
                            value={candTimers.preCodeAssessmentTimer}
                            onChange={(e) =>
                              setCandTimers({ ...candTimers, preCodeAssessmentTimer: Number(e.target.value) })
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Round 2: Coding (min)</Label>
                          <Input
                            type="number"
                            min={5}
                            max={60}
                            value={candTimers.codingTestTimer}
                            onChange={(e) =>
                              setCandTimers({ ...candTimers, codingTestTimer: Number(e.target.value) })
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Round 3: Interview (min)</Label>
                          <Input
                            type="number"
                            min={5}
                            max={60}
                            value={candTimers.interviewTimer}
                            onChange={(e) =>
                              setCandTimers({ ...candTimers, interviewTimer: Number(e.target.value) })
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <Label className="text-[11px] flex items-center gap-1">
                            <BrainCircuit className="w-3 h-3 text-muted-foreground" />
                            Pre-Code Max Questions
                          </Label>
                          <Input
                            type="number"
                            min={2}
                            max={15}
                            value={candQuestions.preCodeMaxQuestions}
                            onChange={(e) =>
                              setCandQuestions({ ...candQuestions, preCodeMaxQuestions: Number(e.target.value) })
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] flex items-center gap-1">
                            <BrainCircuit className="w-3 h-3 text-muted-foreground" />
                            Post-Code Max Questions
                          </Label>
                          <Input
                            type="number"
                            min={2}
                            max={15}
                            value={candQuestions.postCodeMaxQuestions}
                            onChange={(e) =>
                              setCandQuestions({ ...candQuestions, postCodeMaxQuestions: Number(e.target.value) })
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={assigningCandidate || !selectedCandidate || !selectedCandProblem}
                    className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white"
                  >
                    {assigningCandidate ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Assign Assessment
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Assign to Batch Dialog */}
          <Dialog open={isBatchOpen} onOpenChange={setIsBatchOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white shadow-sm">
                <Users className="w-4 h-4 mr-2" />
                Assign to Batch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Assessment to Batch</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAssignToBatch} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Select Batch</Label>
                  <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.map((b) => (
                        <SelectItem key={b._id} value={b._id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Select Assessment</Label>
                  <Select value={selectedBatchProblem} onValueChange={setSelectedBatchProblem}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assessment" />
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
                    disabled={assigningBatch || !selectedBatch || !selectedBatchProblem}
                    className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white"
                  >
                    {assigningBatch ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Assign to Batch
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Pending Assignment Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              <DialogTitle>Edit Pending Assessment Assignment</DialogTitle>
            </div>
          </DialogHeader>
          {editingAssignment && (
            <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
              <div className="p-3 bg-muted/40 rounded-xl border border-border/50 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Candidate</p>
                  <p className="text-sm font-semibold mt-0.5">
                    {(editingAssignment.candidate as any)?.name || "Candidate"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(editingAssignment.candidate as any)?.email}
                  </p>
                </div>
                <Badge variant="outline" className="text-[11px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                  Status: Pending
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>Change Assessment</Label>
                <Select value={editProblem} onValueChange={setEditProblem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assessment" />
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

              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>

              {/* Round Timers */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <Label className="font-semibold text-sm">Round Timers (5 - 60 minutes)</Label>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Round 1: Pre-Code</Label>
                    <Input
                      type="number"
                      min={5}
                      max={60}
                      value={editTimers.preCodeAssessmentTimer}
                      onChange={(e) =>
                        setEditTimers({ ...editTimers, preCodeAssessmentTimer: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Round 2: Coding</Label>
                    <Input
                      type="number"
                      min={5}
                      max={60}
                      value={editTimers.codingTestTimer}
                      onChange={(e) =>
                        setEditTimers({ ...editTimers, codingTestTimer: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Round 3: Interview</Label>
                    <Input
                      type="number"
                      min={5}
                      max={60}
                      value={editTimers.interviewTimer}
                      onChange={(e) =>
                        setEditTimers({ ...editTimers, interviewTimer: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Interview Question Limits */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-primary" />
                  <Label className="font-semibold text-sm">Interview Question Limits (2 - 15)</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Pre-Coding Max Questions</Label>
                    <Input
                      type="number"
                      min={2}
                      max={15}
                      value={editQuestions.preCodeMaxQuestions}
                      onChange={(e) =>
                        setEditQuestions({ ...editQuestions, preCodeMaxQuestions: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Post-Coding Max Questions</Label>
                    <Input
                      type="number"
                      min={2}
                      max={15}
                      value={editQuestions.postCodeMaxQuestions}
                      onChange={(e) =>
                        setEditQuestions({ ...editQuestions, postCodeMaxQuestions: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingEdit || !editProblem}
                  className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white"
                >
                  {savingEdit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save Changes
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>All Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Timing & Questions</TableHead>
                  <TableHead>Assigned On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => {
                  const hasCustomConfig =
                    Boolean(a.timeConfig?.preCodeAssessmentTimer) ||
                    Boolean(a.questionsConfig?.preCodeMaxQuestions);

                  const isPending = a.status === "Pending";

                  return (
                    <TableRow key={a._id}>
                      <TableCell className="font-medium">
                        {a.candidate ? (
                          <div className="flex items-center gap-2">
                            <span>
                              {(a.candidate as any).name || (a.candidate as any).email || "Candidate"}
                            </span>
                            {(a.candidate as any).isActive === false && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                Inactive
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Candidate Unavailable</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {a.assessment ? (
                          <div className="flex items-center gap-2">
                            <span>{a.assessment.title}</span>
                            {a.assessment.difficulty && (
                              <Badge variant="outline" className="text-[10px]">
                                {a.assessment.difficulty}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Assessment Unavailable</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(a.batch as any)?.name || (
                          <span className="text-muted-foreground">Individual</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            a.status === "Completed"
                              ? "default"
                              : a.status === "In Progress"
                              ? "secondary"
                              : "outline"
                          }
                          className={
                            a.status === "Pending"
                              ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                              : ""
                          }
                        >
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {hasCustomConfig ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-600 border-blue-500/30 w-fit"
                            >
                              {a.timeConfig?.preCodeAssessmentTimer || 15}m /{" "}
                              {a.timeConfig?.codingTestTimer || 60}m /{" "}
                              {a.timeConfig?.interviewTimer || 30}m
                            </Badge>
                            {(a.questionsConfig?.preCodeMaxQuestions || a.questionsConfig?.postCodeMaxQuestions) && (
                              <span className="text-[10px] text-muted-foreground">
                                Qs: {a.questionsConfig?.preCodeMaxQuestions || 7} pre / {a.questionsConfig?.postCodeMaxQuestions || 10} post
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Global Standard</span>
                        )}
                      </TableCell>
                      <TableCell>{a.assignedAt ? new Date(a.assignedAt).toLocaleDateString() : "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                          {/* Edit Pending Assignment */}
                          {isPending ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(a)}
                              className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                              title="Edit Pending Assignment"
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1" />
                              Edit
                            </Button>
                          ) : (
                            <span
                              title={`Cannot edit: assessment is already ${a.status.toLowerCase()}`}
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 px-2 py-1 cursor-not-allowed"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Locked
                            </span>
                          )}

                          {/* Delete Assignment (only if not completed) */}
                          {a.status !== "Completed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAssignment(a._id)}
                              className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Delete Assignment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {assignments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No assignments found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
