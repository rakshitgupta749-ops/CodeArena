import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Batch, AuthUser } from "@/lib/api";
import { Loader2, Plus, Edit2, Trash2, Users, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [candidates, setCandidates] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Batch State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit Batch State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSelectedCandidates, setEditSelectedCandidates] = useState<string[]>([]);
  const [editStudentSearch, setEditStudentSearch] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [batchesRes, candsRes] = await Promise.all([
        api.get<Batch[]>("/admin/batches"),
        api.get<{ candidates: AuthUser[] }>("/admin/candidates?role=student&limit=500"),
      ]);
      setBatches(batchesRes);
      // Ensure only students are listed (faculty & admin cannot be batch members)
      const studentsOnly = (candsRes.candidates || []).filter(
        (c) => (c.role === "user" || !c.role || (c.role as string) === "student") && c.isActive
      );
      setCandidates(studentsOnly);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/admin/batches", {
        name,
        description,
        candidates: selectedCandidates,
      });
      setIsDialogOpen(false);
      setName("");
      setDescription("");
      setSelectedCandidates([]);
      setStudentSearch("");
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to create batch");
    } finally {
      setCreating(false);
    }
  };

  const openEditDialog = (batch: Batch) => {
    setEditingBatchId(batch._id);
    setEditName(batch.name);
    setEditDescription(batch.description);
    setEditSelectedCandidates(batch.candidates.map((c: any) => c._id || c));
    setEditStudentSearch("");
    setIsEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatchId) return;
    setUpdating(true);
    try {
      await api.put(`/admin/batches/${editingBatchId}`, {
        name: editName,
        description: editDescription,
        candidates: editSelectedCandidates,
      });
      setIsEditOpen(false);
      setEditingBatchId(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to update batch");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (batchId: string) => {
    if (!window.confirm("Are you sure you want to delete this batch?")) return;
    try {
      await api.delete(`/admin/batches/${batchId}`);
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to delete batch");
    }
  };

  // Filter student options for Create dialog
  const filteredCreateStudents = candidates.filter((c) =>
    c.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // Filter student options for Edit dialog
  const filteredEditStudents = candidates.filter((c) =>
    c.name.toLowerCase().includes(editStudentSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(editStudentSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Batches</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Group student cohorts together for batch assessment assignments.
          </p>
        </div>

        {/* Create Batch Dialog (Larger size sm:max-w-2xl) */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Create Batch
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">Create New Batch</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Batch Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Summer Cohort 2024"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Batch description..."
                />
              </div>

              {/* Student Candidate Selection with Search Bar */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label>Assign Students to Batch</Label>
                  <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {selectedCandidates.length} students selected
                  </span>
                </div>

                {/* Search Bar for Student Names/Emails */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search student by name or email..."
                    className="pl-8 h-9 text-sm"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />
                </div>

                {/* Quick Selection Helpers */}
                <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
                  <span>
                    Showing {filteredCreateStudents.length} of {candidates.length} active students
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const visibleIds = filteredCreateStudents.map((s) => s._id);
                        const merged = Array.from(new Set([...selectedCandidates, ...visibleIds]));
                        setSelectedCandidates(merged);
                      }}
                      className="text-primary hover:underline font-medium"
                    >
                      Select visible
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => {
                        const visibleSet = new Set(filteredCreateStudents.map((s) => s._id));
                        setSelectedCandidates(selectedCandidates.filter((id) => !visibleSet.has(id)));
                      }}
                      className="hover:underline"
                    >
                      Deselect visible
                    </button>
                  </div>
                </div>

                {/* Scrollable Students List */}
                <div className="border border-border rounded-md max-h-60 overflow-y-auto p-2 space-y-1 divide-y divide-border/30">
                  {filteredCreateStudents.map((student) => (
                    <div key={student._id} className="flex items-center space-x-2 pt-1.5 first:pt-0">
                      <input
                        type="checkbox"
                        id={`cand-${student._id}`}
                        checked={selectedCandidates.includes(student._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCandidates([...selectedCandidates, student._id]);
                          } else {
                            setSelectedCandidates(selectedCandidates.filter((id) => id !== student._id));
                          }
                        }}
                        className="w-4 h-4 rounded border-border bg-background cursor-pointer"
                      />
                      <label
                        htmlFor={`cand-${student._id}`}
                        className="text-sm cursor-pointer flex-1 flex justify-between items-center py-0.5"
                      >
                        <span className="font-medium">{student.name}</span>
                        <span className="text-xs text-muted-foreground">{student.email}</span>
                      </label>
                    </div>
                  ))}
                  {filteredCreateStudents.length === 0 && (
                    <div className="text-sm text-muted-foreground py-6 text-center">
                      {studentSearch ? "No students matching search query." : "No active students found."}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={creating} className="bg-[oklch(0.58_0.18_145)] text-white">
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Create Batch
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Batches</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Assignments</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b._id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-muted-foreground">{b.description || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">{b.candidates.length}</span>
                      </div>
                    </TableCell>
                    <TableCell>{b.assignmentCount || 0}</TableCell>
                    <TableCell>{new Date(b.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(b)}>
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(b._id)}>
                        <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {batches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No batches found. Create one using the button above.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Batch Dialog (Larger size sm:max-w-2xl) */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit Batch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Batch Name</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDescription">Description</Label>
              <Input
                id="editDescription"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>

            {/* Edit Students Selection with Search Bar */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label>Assign Students to Batch</Label>
                <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {editSelectedCandidates.length} students selected
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search student by name or email..."
                  className="pl-8 h-9 text-sm"
                  value={editStudentSearch}
                  onChange={(e) => setEditStudentSearch(e.target.value)}
                />
              </div>

              {/* Quick Selection Helpers */}
              <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
                <span>
                  Showing {filteredEditStudents.length} of {candidates.length} active students
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const visibleIds = filteredEditStudents.map((s) => s._id);
                      const merged = Array.from(new Set([...editSelectedCandidates, ...visibleIds]));
                      setEditSelectedCandidates(merged);
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    Select visible
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      const visibleSet = new Set(filteredEditStudents.map((s) => s._id));
                      setEditSelectedCandidates(
                        editSelectedCandidates.filter((id) => !visibleSet.has(id))
                      );
                    }}
                    className="hover:underline"
                  >
                    Deselect visible
                  </button>
                </div>
              </div>

              {/* Scrollable Students List */}
              <div className="border border-border rounded-md max-h-60 overflow-y-auto p-2 space-y-1 divide-y divide-border/30">
                {filteredEditStudents.map((student) => (
                  <div key={student._id} className="flex items-center space-x-2 pt-1.5 first:pt-0">
                    <input
                      type="checkbox"
                      id={`edit-cand-${student._id}`}
                      checked={editSelectedCandidates.includes(student._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditSelectedCandidates([...editSelectedCandidates, student._id]);
                        } else {
                          setEditSelectedCandidates(
                            editSelectedCandidates.filter((id) => id !== student._id)
                          );
                        }
                      }}
                      className="w-4 h-4 rounded border-border bg-background cursor-pointer"
                    />
                    <label
                      htmlFor={`edit-cand-${student._id}`}
                      className="text-sm cursor-pointer flex-1 flex justify-between items-center py-0.5"
                    >
                      <span className="font-medium">{student.name}</span>
                      <span className="text-xs text-muted-foreground">{student.email}</span>
                    </label>
                  </div>
                ))}
                {filteredEditStudents.length === 0 && (
                  <div className="text-sm text-muted-foreground py-6 text-center">
                    {editStudentSearch ? "No students matching search query." : "No active students found."}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={updating} className="bg-[oklch(0.58_0.18_145)] text-white">
                {updating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Update Batch
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
