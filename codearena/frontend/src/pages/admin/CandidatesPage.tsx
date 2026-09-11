import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Loader2, Search, Eye, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Candidate {
  _id: string;
  name: string;
  email: string;
  isActive: boolean;
  interviewCount: number;
  latestInterview: {
    status: string;
    overallScore: number | null;
    startedAt: string;
    completedAt: string;
  } | null;
}

export function CandidatesPage() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Create Trainee State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchCandidates = async (pageToFetch = 1, searchQuery = search) => {
    setLoading(true);
    try {
      const { candidates, pages } = await api.get<{ candidates: Candidate[], pages: number }>(`/admin/candidates?page=${pageToFetch}&search=${searchQuery}`);
      setCandidates(candidates);
      setTotalPages(pages);
      setPage(pageToFetch);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCandidates(1, search);
  };

  const handleCreateTrainee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) return;
    
    setCreating(true);
    try {
      await api.post("/admin/candidates", {
        name: newName,
        email: newEmail,
        password: newPassword,
      });
      setIsDialogOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      fetchCandidates(1, search); // Refresh list
    } catch (err: any) {
      alert(err.message || "Failed to create trainee");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Candidates</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Trainee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Trainee</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateTrainee} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="john@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Initial Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={creating} className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)]">
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Create Trainee
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle>All Candidates</CardTitle>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search name or email..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">Search</Button>
          </form>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No candidates found.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Interviews</TableHead>
                    <TableHead>Latest Status</TableHead>
                    <TableHead>Latest Score</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((c) => (
                    <TableRow key={c._id} className={c.isActive ? "" : "opacity-50 bg-muted/20"}>
                      <TableCell className="font-medium">
                        {c.name}
                        {!c.isActive && <Badge variant="destructive" className="ml-2 text-[10px]">Inactive</Badge>}
                      </TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell>{c.interviewCount}</TableCell>
                      <TableCell>
                        {c.latestInterview ? (
                          <Badge variant={c.latestInterview.status === "completed" ? "default" : "secondary"}>
                            {c.latestInterview.status}
                          </Badge>
                        ) : (
                          <Badge variant="outline">None</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.latestInterview?.overallScore !== null && c.latestInterview?.overallScore !== undefined ? `${Math.round(c.latestInterview.overallScore)}%` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/candidates/${c._id}`)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => fetchCandidates(page - 1)}>
                  Previous
                </Button>
                <div className="text-sm self-center">Page {page} of {totalPages}</div>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => fetchCandidates(page + 1)}>
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
