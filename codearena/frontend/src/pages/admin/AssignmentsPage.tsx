import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { Assignment, Problem, Batch } from "@/lib/api";
import { Loader2, Plus, Trash2 } from "lucide-react";

export function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  // Assign to batch
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedProblem, setSelectedProblem] = useState("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assignRes, probRes, batchRes] = await Promise.all([
        api.get<Assignment[]>("/admin/assignments"),
        api.get<Problem[]>("/problems"),
        api.get<Batch[]>("/admin/batches")
      ]);
      setAssignments(assignRes);
      setProblems(probRes);
      setBatches(batchRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignToBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssigning(true);
    try {
      const res = await api.post(`/admin/batches/${selectedBatch}/assign-assessment`, {
        assessmentId: selectedProblem
      });
      alert((res as any).message || "Assignment completed.");
      setIsAssignOpen(false);
      setSelectedBatch("");
      setSelectedProblem("");
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to assign to batch");
    } finally {
      setAssigning(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm("Are you sure you want to remove this assessment assignment?")) return;
    try {
      await api.delete(`/admin/assignments/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to remove assignment");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white">
              <Plus className="w-4 h-4 mr-2" />
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
                    {batches.map(b => (
                      <SelectItem key={b._id} value={b._id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Select Assessment</Label>
                <Select value={selectedProblem} onValueChange={setSelectedProblem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assessment" />
                  </SelectTrigger>
                  <SelectContent>
                    {problems.map(p => (
                      <SelectItem key={p._id} value={p._id}>{p.title} ({p.difficulty})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={assigning || !selectedBatch || !selectedProblem} className="bg-[oklch(0.58_0.18_145)]">
                  {assigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Assign
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map(a => (
                  <TableRow key={a._id}>
                    <TableCell className="font-medium">{(a.candidate as any)?.name}</TableCell>
                    <TableCell>{a.assessment?.title}</TableCell>
                    <TableCell>{(a.batch as any)?.name || "Individual"}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === "Completed" ? "default" : "secondary"}>{a.status}</Badge>
                    </TableCell>
                    <TableCell>{new Date(a.assignedAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {a.status !== "Completed" && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteAssignment(a._id)} 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {assignments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No assignments found.</TableCell>
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
