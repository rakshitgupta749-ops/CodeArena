import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Loader2, Search, Eye, Plus, UserCheck, UserX, Trash2, GraduationCap, User as UserIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface UserItem {
  _id: string;
  name: string;
  email: string;
  role: "faculty" | "user" | "admin";
  isActive: boolean;
  interviewCount?: number;
  latestInterview?: {
    status: string;
    overallScore: number | null;
    startedAt: string;
    completedAt: string;
  } | null;
  assessmentsCreated?: number;
  traineesAssigned?: number;
}

export function CandidatesPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Create User State (Default role is Student / "user")
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"user" | "faculty">("user");
  const [creating, setCreating] = useState(false);

  const fetchUsers = async (pageToFetch = 1, searchQuery = search) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(pageToFetch),
        role: "user",
      });
      if (searchQuery) queryParams.set("search", searchQuery);

      const { candidates, pages } = await api.get<{ candidates: UserItem[]; pages: number }>(
        `/admin/candidates?${queryParams.toString()}`
      );
      setUsers(candidates);
      setTotalPages(pages || 1);
      setPage(pageToFetch);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1, search);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(1, search);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) return;

    setCreating(true);
    try {
      await api.post("/admin/candidates", {
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
      });
      setIsDialogOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("user"); // Reset back to student default
      fetchUsers(1, search);
    } catch (err: any) {
      alert(err.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleChangeRole = async (user: UserItem, targetRole: "user" | "faculty") => {
    if (user.role === targetRole) return;
    const roleLabels = { user: "Student", faculty: "Faculty" };
    if (
      !confirm(
        `Are you sure you want to change ${user.name}'s role to ${roleLabels[targetRole]}?`
      )
    ) {
      return;
    }

    try {
      await api.patch(`/admin/candidates/${user._id}/role`, { role: targetRole });
      setUsers((prev) =>
        prev.map((u) => (u._id === user._id ? { ...u, role: targetRole } : u))
      );
    } catch (err: any) {
      alert(err.message || "Failed to change user role");
    }
  };

  const handleDeactivate = async (user: UserItem) => {
    if (
      !confirm(
        `Are you sure you want to deactivate ${user.name}? Historical data will be preserved, but they will not be able to log in.`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/admin/candidates/${user._id}`);
      fetchUsers(page, search);
    } catch (err: any) {
      alert(err.message || "Failed to deactivate user");
    }
  };

  const handleActivate = async (user: UserItem) => {
    try {
      await api.patch(`/admin/candidates/${user._id}/reactivate`);
      fetchUsers(page, search);
    } catch (err: any) {
      alert(err.message || "Failed to activate user");
    }
  };

  const handleDeletePermanently = async (user: UserItem) => {
    if (
      !confirm(
        `DANGER: Are you sure you want to PERMANENTLY DELETE ${user.name} (${user.email})?\n\nAll records, assignments, and history will be deleted. This action cannot be undone!`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/admin/candidates/${user._id}/permanent`);
      fetchUsers(page, search);
    } catch (err: any) {
      alert(err.message || "Failed to permanently delete user");
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === "faculty") {
      return (
        <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 gap-1 font-medium">
          <GraduationCap className="w-3 h-3" /> Faculty
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 gap-1 font-medium">
        <UserIcon className="w-3 h-3" /> Student
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users & Candidates</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage student candidates across the platform.
          </p>
        </div>

        {/* Create User Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white shadow-sm" id="create-user-modal-btn">
              <Plus className="w-4 h-4 mr-2" />
              Create New User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Jane Doe"
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
                  placeholder="user@example.com"
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

              {/* Role Selection: Student or Faculty */}
              <div className="space-y-2">
                <Label htmlFor="role">User Role</Label>
                <Select
                  value={newRole}
                  onValueChange={(val: "user" | "faculty") => setNewRole(val)}
                >
                  <SelectTrigger id="role-select">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Student (Default)</SelectItem>
                    <SelectItem value="faculty">Faculty</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  By default, new users are created as Students. Select Faculty to create instructors who assign assessments.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={creating}
                  className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white"
                  id="submit-create-user-btn"
                >
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Create User
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Student Candidates</CardTitle>
            {/* Table option: Student only (Faculty and All removed) */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs">
              <button
                type="button"
                className="px-3 py-1 rounded-md bg-background text-foreground shadow-sm font-semibold cursor-default text-xs"
              >
                Students
              </button>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search name or email..."
                className="pl-8 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" size="sm" className="h-9">
              Search
            </Button>
          </form>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Loading students...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No students found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Student</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assessments Taken</TableHead>
                    <TableHead>Latest Status</TableHead>
                    <TableHead>Latest Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    return (
                      <TableRow key={u._id} className={u.isActive ? "" : "opacity-60 bg-muted/20"}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{u.name}</span>
                              {!u.isActive && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{u.email}</span>
                          </div>
                        </TableCell>

                        {/* Role Badge */}
                        <TableCell>{getRoleBadge(u.role)}</TableCell>

                        {/* Student Assessments Taken */}
                        <TableCell>
                          <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                            {u.interviewCount ?? 0}
                          </span>
                        </TableCell>

                        {/* Latest Status */}
                        <TableCell>
                          {u.latestInterview ? (
                            <Badge variant={u.latestInterview.status === "completed" ? "default" : "secondary"}>
                              {u.latestInterview.status}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </TableCell>

                        {/* Latest Score */}
                        <TableCell>
                          {u.latestInterview?.overallScore !== null && u.latestInterview?.overallScore !== undefined ? (
                            <span className="font-semibold text-sm">{Math.round(u.latestInterview.overallScore)}%</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Status Column */}
                        <TableCell>
                          <Badge
                            variant={u.isActive ? "outline" : "destructive"}
                            className={u.isActive ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10 text-[11px]" : "text-[11px]"}
                          >
                            {u.isActive ? "Active" : "Deactivated"}
                          </Badge>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-1.5 flex-wrap">
                            {/* Role Change Dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 text-xs">
                                  Change Role
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel className="text-xs">Set Role</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleChangeRole(u, "user")}
                                  className={u.role === "user" ? "font-bold text-primary" : ""}
                                >
                                  <UserIcon className="w-3.5 h-3.5 mr-2" /> Make Student
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleChangeRole(u, "faculty")}
                                  className={u.role === "faculty" ? "font-bold text-purple-600" : ""}
                                >
                                  <GraduationCap className="w-3.5 h-3.5 mr-2" /> Make Faculty
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            {/* If Active: Show Deactivate button */}
                            {u.isActive ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="Deactivate User"
                                onClick={() => handleDeactivate(u)}
                              >
                                <UserX className="h-3.5 w-3.5 mr-1" />
                                Deactivate
                              </Button>
                            ) : (
                              /* If Deactivated: Show 2 distinct options: 1st Activate, 2nd Delete Permanently */
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/30"
                                  title="Activate User"
                                  onClick={() => handleActivate(u)}
                                >
                                  <UserCheck className="h-3.5 w-3.5 mr-1" />
                                  Activate
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-8 px-2 text-xs bg-red-600 hover:bg-red-700 text-white"
                                  title="Delete Permanently"
                                  onClick={() => handleDeletePermanently(u)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                                  Delete Permanently
                                </Button>
                              </div>
                            )}

                            {/* View Profile */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs gap-1"
                              onClick={() => navigate(`/admin/candidates/${u._id}`)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-between p-4 border-t border-border/50">
            <div className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={page === 1}
                onClick={() => fetchUsers(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={page >= totalPages}
                onClick={() => fetchUsers(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
