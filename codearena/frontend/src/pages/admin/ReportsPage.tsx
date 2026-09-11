import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Loader2, Eye } from "lucide-react";

export function ReportsPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchReports = async (pageToFetch = 1) => {
    setLoading(true);
    try {
      const data: any = await api.get(`/admin/reports?page=${pageToFetch}`);
      setReports(data.reports);
      setTotalPages(data.pages);
      setPage(pageToFetch);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Assessment Reports</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No reports generated yet.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow key={r._id}>
                      <TableCell>{new Date(r.generatedAt).toLocaleString()}</TableCell>
                      <TableCell className="font-medium">{r.user?.name || "Unknown"}</TableCell>
                      <TableCell>{r.reportType}</TableCell>
                      <TableCell>v{r.version}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/reports/${r._id}`)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => fetchReports(page - 1)}>
                  Previous
                </Button>
                <div className="text-sm self-center">Page {page} of {totalPages}</div>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => fetchReports(page + 1)}>
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
