import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Settings as SettingsIcon, BrainCircuit, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Timers State & Feedback
  const [timers, setTimers] = useState({
    preCodeAssessmentTimer: 15,
    codingTestTimer: 60,
    interviewTimer: 30,
  });
  const [isSavingTimers, setIsSavingTimers] = useState(false);
  const [timerMessage, setTimerMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Questions Limit State & Feedback
  const [questionsConfig, setQuestionsConfig] = useState({
    preCodeMaxQuestions: 7,
    postCodeMaxQuestions: 10,
  });
  const [isSavingQuestions, setIsSavingQuestions] = useState(false);
  const [questionsMessage, setQuestionsMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res: any = await api.get("/admin/settings");
      setSettings(res);
      if (res) {
        if (res.timers) {
          setTimers({
            preCodeAssessmentTimer: res.timers.preCodeAssessmentTimer ?? 15,
            codingTestTimer: res.timers.codingTestTimer ?? 60,
            interviewTimer: res.timers.interviewTimer ?? 30,
          });
        }
        setQuestionsConfig({
          preCodeMaxQuestions: res.preCodeMaxQuestions ?? 7,
          postCodeMaxQuestions: res.postCodeMaxQuestions ?? res.maxQuestionsLimit ?? 10,
        });
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("You do not have permission to view settings. Admin access required.");
      } else {
        setError("Failed to fetch settings.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTimers = async () => {
    setTimerMessage(null);
    const pTimer = Number(timers.preCodeAssessmentTimer);
    const cTimer = Number(timers.codingTestTimer);
    const iTimer = Number(timers.interviewTimer);

    // Validation: greater than 5 min and up to 60 min
    if (
      isNaN(pTimer) || pTimer < 5 || pTimer > 60 ||
      isNaN(cTimer) || cTimer < 5 || cTimer > 60 ||
      isNaN(iTimer) || iTimer < 5 || iTimer > 60
    ) {
      const errMsg = "The timing should be greater then 5 min and can be upto 60 min for a single round.";
      setTimerMessage({ type: "error", text: errMsg });
      toast.error(errMsg);
      return;
    }

    try {
      setIsSavingTimers(true);
      await api.put("/admin/settings", { timers: { preCodeAssessmentTimer: pTimer, codingTestTimer: cTimer, interviewTimer: iTimer } });
      const successMsg = "Timing configuration saved successfully! Each round duration is updated (between 5 and 60 minutes).";
      setTimerMessage({ type: "success", text: successMsg });
      toast.success("Timing configuration updated successfully.");
    } catch (err: any) {
      const errMsg = err.message || "Failed to save timer configurations.";
      setTimerMessage({ type: "error", text: errMsg });
      toast.error(errMsg);
    } finally {
      setIsSavingTimers(false);
    }
  };

  const handleSaveQuestions = async () => {
    setQuestionsMessage(null);
    const preQ = Number(questionsConfig.preCodeMaxQuestions);
    const postQ = Number(questionsConfig.postCodeMaxQuestions);

    // Validation: greater than 1 and up to 15
    if (isNaN(preQ) || preQ <= 1 || preQ > 15 || isNaN(postQ) || postQ <= 1 || postQ > 15) {
      const errMsg = "Maximum questions must be greater than 1 and not more than 15.";
      setQuestionsMessage({ type: "error", text: errMsg });
      toast.error(errMsg);
      return;
    }

    try {
      setIsSavingQuestions(true);
      await api.put("/admin/settings", {
        preCodeMaxQuestions: preQ,
        postCodeMaxQuestions: postQ,
      });
      const successMsg = "Interview question limits saved successfully! Pre-code and Post-code rounds updated.";
      setQuestionsMessage({ type: "success", text: successMsg });
      toast.success("Interview question configuration updated successfully.");
    } catch (err: any) {
      const errMsg = err.message || "Failed to save interview question configuration.";
      setQuestionsMessage({ type: "error", text: errMsg });
      toast.error(errMsg);
    } finally {
      setIsSavingQuestions(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-destructive">
              <Shield className="h-5 w-5" />
              <p className="font-medium">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage platform configurations, round timers, and interview question limits.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Interview Configuration Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <SettingsIcon className="h-5 w-5 text-primary" />
              <CardTitle>Interview Configuration</CardTitle>
            </div>
            <CardDescription>Configure maximum questions and round limits (1–15 questions)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              </div>
            ) : (
              <>
                {questionsMessage && (
                  <div
                    className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                      questionsMessage.type === "success"
                        ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                        : "bg-destructive/15 text-destructive border border-destructive/30"
                    }`}
                  >
                    {questionsMessage.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    )}
                    <span>{questionsMessage.text}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="preCodeQuestions">Pre-Coding Max Questions</Label>
                    <Badge variant="outline" className="text-xs">Recommended: 7</Badge>
                  </div>
                  <Input
                    id="preCodeQuestions"
                    type="number"
                    min={2}
                    max={15}
                    value={questionsConfig.preCodeMaxQuestions}
                    onChange={(e) =>
                      setQuestionsConfig({
                        ...questionsConfig,
                        preCodeMaxQuestions: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Asks questions until rubrics are met OR this maximum question limit is reached (prevents infinite loops). Must be between 2 and 15.
                  </p>
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="postCodeQuestions">Post-Coding Max Questions</Label>
                    <Badge variant="outline" className="text-xs">Recommended: 10</Badge>
                  </div>
                  <Input
                    id="postCodeQuestions"
                    type="number"
                    min={2}
                    max={15}
                    value={questionsConfig.postCodeMaxQuestions}
                    onChange={(e) =>
                      setQuestionsConfig({
                        ...questionsConfig,
                        postCodeMaxQuestions: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum questions generated and asked during the post-coding technical interview round. Must be between 2 and 15.
                  </p>
                </div>

                <div className="flex justify-between items-center py-2 border-t mt-4">
                  <span className="font-medium text-sm">Adaptive Evaluation Mode</span>
                  <Badge className="bg-green-500/10 text-green-500">Enabled</Badge>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSaveQuestions}
              disabled={isLoading || isSavingQuestions}
              className="w-full bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white"
            >
              {isSavingQuestions ? "Saving Configuration..." : "Save Interview Configuration"}
            </Button>
          </CardFooter>
        </Card>

        {/* Timer Configurations Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle>Timer Configurations</CardTitle>
            </div>
            <CardDescription>Configure round durations (must be greater than 5 min and up to 60 min)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              </div>
            ) : (
              <>
                {timerMessage && (
                  <div
                    className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                      timerMessage.type === "success"
                        ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                        : "bg-destructive/15 text-destructive border border-destructive/30"
                    }`}
                  >
                    {timerMessage.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    )}
                    <span>{timerMessage.text}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="preCodeTimer">Pre-Code Assessment Timer (minutes)</Label>
                    <span className="text-xs text-muted-foreground">Range: 5–60 min</span>
                  </div>
                  <Input
                    id="preCodeTimer"
                    type="number"
                    min="5"
                    max="60"
                    value={timers.preCodeAssessmentTimer}
                    onChange={(e) =>
                      setTimers({ ...timers, preCodeAssessmentTimer: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="codingTestTimer">Coding Test Timer (minutes)</Label>
                    <span className="text-xs text-muted-foreground">Range: 5–60 min</span>
                  </div>
                  <Input
                    id="codingTestTimer"
                    type="number"
                    min="5"
                    max="60"
                    value={timers.codingTestTimer}
                    onChange={(e) =>
                      setTimers({ ...timers, codingTestTimer: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="interviewTimer">AI Interview Timer (minutes)</Label>
                    <span className="text-xs text-muted-foreground">Range: 5–60 min</span>
                  </div>
                  <Input
                    id="interviewTimer"
                    type="number"
                    min="5"
                    max="60"
                    value={timers.interviewTimer}
                    onChange={(e) =>
                      setTimers({ ...timers, interviewTimer: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSaveTimers}
              disabled={isLoading || isSavingTimers}
              className="w-full bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white"
            >
              {isSavingTimers ? "Saving Timers..." : "Save Timer Configuration"}
            </Button>
          </CardFooter>
        </Card>

        {/* Role Management Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Role Management</CardTitle>
            </div>
            <CardDescription>Current permissions for user roles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              </div>
            ) : (
              <>
                <div className="space-y-1 py-2 border-b">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">Administrator</span>
                    <Badge className="bg-purple-500/10 text-purple-500 text-[10px]">Full Access</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{settings?.roleInformation?.admin}</p>
                </div>
                <div className="space-y-1 py-2 border-b">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">Faculty</span>
                    <Badge className="bg-blue-500/10 text-blue-500 text-[10px]">Evaluator</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{settings?.roleInformation?.faculty}</p>
                </div>
                <div className="space-y-1 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">Student</span>
                    <Badge className="bg-green-500/10 text-green-500 text-[10px]">Candidate</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{settings?.roleInformation?.student}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        
        {/* AI Engine Configuration Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <BrainCircuit className="h-5 w-5 text-primary" />
              <CardTitle>AI Engine Configuration</CardTitle>
            </div>
            <CardDescription>Information about the interview AI models in use</CardDescription>
          </CardHeader>
          <CardContent>
             <p className="text-sm text-muted-foreground">
               The CodeArena platform utilizes advanced LLM chains for evaluation and conversational flow.
               <br/><br/>
               <b>Round 1 (Pre-Code Engine):</b> Evaluates the candidate's understanding and algorithmic approach against structured rubrics before code editor access.
               <br/><br/>
               <b>Round 3 (Post-Code Interview):</b> Dynamically analyzes submitted code and poses code-anchored and conceptual follow-up questions.
             </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
