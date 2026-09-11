import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Settings as SettingsIcon, BrainCircuit, Clock } from "lucide-react";
import { toast } from "sonner";

export function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [timers, setTimers] = useState({
    preCodeAssessmentTimer: 15,
    codingTestTimer: 60,
    interviewTimer: 30,
  });


  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res: any = await api.get("/admin/settings");
      setSettings(res);
      if (res && res.timers) {
        setTimers({
          preCodeAssessmentTimer: res.timers.preCodeAssessmentTimer || 15,
          codingTestTimer: res.timers.codingTestTimer || 60,
          interviewTimer: res.timers.interviewTimer || 30,
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
    try {
      setIsSaving(true);
      await api.put("/admin/settings", { timers });
      toast.success("Settings Saved: Timer configurations have been successfully updated.");
    } catch (err) {
      toast.error("Error: Failed to save timer configurations.");
    } finally {
      setIsSaving(false);
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
          View system configuration, limits, and role access information. Note: Settings are currently read-only in this version.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <SettingsIcon className="h-5 w-5 text-primary" />
              <CardTitle>Interview Configuration</CardTitle>
            </div>
            <CardDescription>Global limits and parameters for interviews</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-3/4 animate-pulse rounded-md bg-muted" />
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Maximum Questions per Interview</span>
                  <Badge variant="secondary">{settings?.maxQuestionsLimit}</Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Adaptive Evaluation Mode</span>
                  {settings?.adaptiveInterviewEnabled ? (
                    <Badge className="bg-green-500/10 text-green-500">Enabled</Badge>
                  ) : (
                    <Badge variant="destructive">Disabled</Badge>
                  )}
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="font-medium">System Status</span>
                  <Badge variant="outline">{settings?.systemStatus}</Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle>Timer Configurations</CardTitle>
            </div>
            <CardDescription>Configure round durations (in minutes)</CardDescription>
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
                <div className="space-y-2">
                  <Label htmlFor="preCodeTimer">Pre-Code Assessment Timer</Label>
                  <Input
                    id="preCodeTimer"
                    type="number"
                    min="1"
                    value={timers.preCodeAssessmentTimer}
                    onChange={(e) => setTimers({ ...timers, preCodeAssessmentTimer: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codingTestTimer">Coding Test Timer</Label>
                  <Input
                    id="codingTestTimer"
                    type="number"
                    min="1"
                    value={timers.codingTestTimer}
                    onChange={(e) => setTimers({ ...timers, codingTestTimer: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interviewTimer">AI Interview Timer</Label>
                  <Input
                    id="interviewTimer"
                    type="number"
                    min="1"
                    value={timers.interviewTimer}
                    onChange={(e) => setTimers({ ...timers, interviewTimer: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={handleSaveTimers} disabled={isLoading || isSaving} className="w-full">
              {isSaving ? "Saving..." : "Save Timers"}
            </Button>
          </CardFooter>
        </Card>

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
        
        <Card className="md:col-span-2">
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
               <b>Agent 1 (Evaluator):</b> Analyzes user answers against problem rubrics, determines scores, and handles speech-to-text transcript anomaly detection.
               <br/>
               <b>Agent 2 (Interviewer):</b> Dynamically generates follow-up questions tailored to the candidate's initial answers, targeting weakest concepts according to the adaptive log.
             </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
