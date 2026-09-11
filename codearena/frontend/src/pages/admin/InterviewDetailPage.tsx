import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Loader2, ArrowLeft, BrainCircuit, MessageSquare, Check, X } from "lucide-react";

export function InterviewDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInterview() {
      try {
        const data = await api.get(`/admin/interviews/${id}`);
        setInterview(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchInterview();
  }, [id]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!interview) return <div>Interview not found.</div>;

  const { answers = [], adaptiveLog = [] } = interview;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interview Timeline</h1>
          <p className="text-muted-foreground mt-1">Candidate: {interview.user?.name} | Score: {interview.overallScore !== null && interview.overallScore !== undefined ? `${Math.round(interview.overallScore)}%` : 'Pending'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Question & Evaluation Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {answers.map((ans: any) => {
                const question = interview.questions?.find((q: any) => q.qid === ans.qid);
                const evalData = ans.evaluation || {};
                
                return (
                  <div key={ans.qid} className="relative pl-6 border-l-2 border-border pb-6 last:pb-0 last:border-0">
                    <div className="absolute -left-2.5 top-0 w-5 h-5 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{ans.qid}</Badge>
                        <span className="font-semibold">{question?.concept_tags?.[0] || 'General'}</span>
                      </div>
                      <Badge variant={evalData.final_score >= 3 ? "default" : "destructive"}>
                        Score: {evalData.final_score || 0}/5
                      </Badge>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-lg space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-1">Question</p>
                        <p>{question?.question || "Question text unavailable"}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-1">Candidate Answer</p>
                        <p className="text-sm border-l-2 border-primary/50 pl-3 py-1 italic">{ans.answer || "(No textual answer)"}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-background p-3 rounded border border-border/50">
                        <div>
                          <p className="font-semibold mb-1 flex items-center gap-1"><Check className="h-3 w-3 text-green-500"/> Strengths</p>
                          <ul className="list-disc pl-4 text-muted-foreground">
                            {evalData.teacher_feedback?.what_went_well?.map((s: string, i: number) => <li key={i}>{s}</li>) || <li>None</li>}
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold mb-1 flex items-center gap-1"><X className="h-3 w-3 text-destructive"/> Weaknesses</p>
                          <ul className="list-disc pl-4 text-muted-foreground">
                            {evalData.teacher_feedback?.what_was_missing?.map((w: string, i: number) => <li key={i}>{w}</li>) || <li>None</li>}
                          </ul>
                        </div>
                      </div>
                      
                      {evalData.teacher_feedback?.better_answer && (
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                            <MessageSquare className="h-4 w-4"/> Better Answer
                          </p>
                          <p className="text-sm">{evalData.teacher_feedback.better_answer}</p>
                        </div>
                      )}
                      
                      {evalData.gate_decision && (
                        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                           <p className="text-sm font-semibold mb-1">Classification: {evalData.gate_decision.replace(/_/g, ' ')}</p>
                           <p className="text-sm text-muted-foreground">{evalData.gate_reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {answers.length === 0 && <p className="text-muted-foreground">No answers recorded yet.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5" />
                Adaptive Selection Trace
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {adaptiveLog.map((log: any, i: number) => (
                  <div key={i} className="text-sm p-3 border rounded-lg bg-sidebar">
                    <div className="flex items-center justify-between font-semibold mb-2">
                      <span>{log.qid}</span>
                      <Badge variant="outline">{log.difficulty}</Badge>
                    </div>
                    <div className="space-y-1 text-muted-foreground">
                      <p><span className="font-medium text-foreground">Target Concept:</span> {log.concept}</p>
                      <p><span className="font-medium text-foreground">Priority:</span> {Math.round(log.priorityScore)}</p>
                      <p><span className="font-medium text-foreground">Reason:</span> {log.selectionReason}</p>
                      {(log.weakState || log.masteredState) && (
                        <div className="flex gap-2 mt-2">
                          {log.weakState && <Badge variant="destructive" className="text-[10px]">Targeting Weakness</Badge>}
                          {log.masteredState && <Badge variant="secondary" className="text-[10px]">Re-testing Mastered</Badge>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {adaptiveLog.length === 0 && <p className="text-sm text-muted-foreground">No adaptive trace data available for this session.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
