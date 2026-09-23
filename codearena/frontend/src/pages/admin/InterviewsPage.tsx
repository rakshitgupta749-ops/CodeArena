import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";

export function InterviewsPage() {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchInterviews(page);
  }, [page]);

  const fetchInterviews = async (pageNumber: number) => {
    try {
      setIsLoading(true);
      const res: any = await api.get(`/admin/interviews?page=${pageNumber}&limit=10`);
      setInterviews(res.interviews);
      setTotalPages(res.pages);
    } catch (error) {
      console.error("Failed to fetch interviews", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">In Progress</Badge>;
      case "generating":
        return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">Generating</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Interviews</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Interview Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Problem</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-32 animate-pulse rounded-md bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-24 animate-pulse rounded-md bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-24 animate-pulse rounded-md bg-muted" /></TableCell>
                    <TableCell><div className="h-6 w-20 animate-pulse rounded-md bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-16 animate-pulse rounded-md bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-12 animate-pulse rounded-md bg-muted" /></TableCell>
                    <TableCell className="text-right"><div className="h-8 w-8 ml-auto animate-pulse rounded-md bg-muted" /></TableCell>
                  </TableRow>
                ))
              ) : interviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No interviews found.
                  </TableCell>
                </TableRow>
              ) : (
                interviews.map((interview) => (
                  <TableRow key={interview._id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{interview.user?.name || "Unknown Candidate"}</span>
                          {interview.user?.isActive === false && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0">Inactive</Badge>
                          )}
                        </div>
                        {interview.user?.email && (
                          <span className="text-xs text-muted-foreground">{interview.user.email}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span>{interview.problem?.title || "Unknown Problem"}</span>
                        {interview.problem?.difficulty && (
                          <Badge variant="outline" className="text-[10px]">{interview.problem.difficulty}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(interview.startedAt).toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(interview.status)}</TableCell>
                    <TableCell>
                      {interview.answers?.length || 0} / {interview.questions?.length || 10}
                    </TableCell>
                    <TableCell>
                      {interview.overallScore !== null ? (
                        <span className="font-medium">{Math.round(interview.overallScore)}%</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/admin/interviews/${interview._id}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-end space-x-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-sm font-medium">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
