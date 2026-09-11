import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Loader2, ArrowLeft, Printer } from "lucide-react";

export function ReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReport() {
      try {
        const data = await api.get(`/admin/reports/${id}`);
        setReport(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [id]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!report) return <div>Report not found.</div>;

  const data = report.reportData || {};

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Assessment Report</h1>
            <p className="text-muted-foreground mt-1">Generated: {new Date(report.generatedAt).toLocaleString()}</p>
          </div>
        </div>
        <Button onClick={() => window.print()} variant="outline">
          <Printer className="h-4 w-4 mr-2" />
          Print / PDF
        </Button>
      </div>

      <div className="print:block space-y-8 bg-card text-card-foreground shadow-sm rounded-xl border p-8">
        <div className="border-b pb-6 mb-6">
          <h2 className="text-2xl font-bold uppercase tracking-widest text-primary mb-2">CodeArena Assessment</h2>
          <div className="grid grid-cols-2 gap-4 text-sm mt-4">
            <div>
              <p className="text-muted-foreground">Candidate Name</p>
              <p className="font-semibold text-lg">{report.user?.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Report Type</p>
              <p className="font-semibold text-lg">{report.reportType}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-bold mb-4 border-b pb-2">Overall Performance</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="font-semibold">Final Score</span>
                <span className="text-2xl font-bold">{data.overallScore || 0}/100</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="font-semibold">Recommendation</span>
                <span className="text-lg font-bold">{data.recommendation || 'Pending'}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4 border-b pb-2">Competencies</h3>
            <div className="space-y-2">
              {Object.entries(data.competencies?.scores || {}).map(([key, value]: any) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span className="font-semibold">{value}/100</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold mb-4 border-b pb-2">Executive Summary</h3>
          <p className="text-sm leading-relaxed">{data.executiveSummary || 'No summary available.'}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <div>
            <h3 className="text-lg font-bold mb-4 border-b pb-2 text-success">Key Strengths</h3>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {data.strengths?.map((s: string, i: number) => <li key={i}>{s}</li>) || <li>None recorded</li>}
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4 border-b pb-2 text-destructive">Areas for Improvement</h3>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {data.weaknesses?.map((w: string, i: number) => <li key={i}>{w}</li>) || <li>None recorded</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
