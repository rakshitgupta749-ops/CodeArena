import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { Batch, AuthUser } from "@/lib/api";
import { Loader2, Plus, Users, Edit2, Trash2 } from "lucide-react";

export function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<AuthUser[]>([]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Edit Batch State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSelectedCandidates, setEditSelectedCandidates] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [batchesRes, candsRes] = await Promise.all([
        api.get<Batch[]>("/admin/batches"),
        api.get<{ candidates: AuthUser[] }>("/admin/candidates?limit=100") // get all or large limit
      ]);
      setBatches(batchesRes);
      setCandidates(candsRes.candidates);
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

  const candidateOptions = candidates.filter(c => c.isActive).map(c => ({
    label: `${c.name} (${c.email})`,
    value: c._id,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Batches</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Batch
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Batch</DialogTitle>
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
              <div className="space-y-2">
                <Label>Candidates</Label>
                <div className="border border-border rounded-md max-h-48 overflow-y-auto p-2 space-y-2">
                  {candidateOptions.map(option => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`cand-${option.value}`}
                        checked={selectedCandidates.includes(option.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCandidates([...selectedCandidates, option.value]);
                          } else {
                            setSelectedCandidates(selectedCandidates.filter(id => id !== option.value));
                          }
                        }}
                        className="w-4 h-4 rounded border-border bg-background cursor-pointer"
                      />
                      <label htmlFor={`cand-${option.value}`} className="text-sm cursor-pointer">
                        {option.label}
                      </label>
                    </div>
                  ))}
                  {candidateOptions.length === 0 && (
                    <div className="text-sm text-muted-foreground p-2 text-center">No active candidates found</div>
                  )}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={creating} className="bg-[oklch(0.58_0.18_145)]">
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Create
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
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Assignments</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map(b => (
                  <TableRow key={b._id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-muted-foreground">{b.description || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        {b.candidates.length}
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
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No batches found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Batch</DialogTitle>
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
            <div className="space-y-2">
              <Label>Candidates</Label>
              <div className="border border-border rounded-md max-h-48 overflow-y-auto p-2 space-y-2">
                {candidateOptions.map(option => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`edit-cand-${option.value}`}
                      checked={editSelectedCandidates.includes(option.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditSelectedCandidates([...editSelectedCandidates, option.value]);
                        } else {
                          setEditSelectedCandidates(editSelectedCandidates.filter(id => id !== option.value));
                        }
                      }}
                      className="w-4 h-4 rounded border-border bg-background cursor-pointer"
                    />
                    <label htmlFor={`edit-cand-${option.value}`} className="text-sm cursor-pointer">
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={updating} className="bg-[oklch(0.58_0.18_145)]">
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
