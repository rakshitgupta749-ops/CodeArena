import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import Editor from "@monaco-editor/react";
import {
  ArrowLeft,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Terminal,
  FileText,
  Loader2,
  PartyPopper,
  ArrowRight,
  Sparkles,
  Trophy,
  CloudUpload,
  AlignLeft,
} from "lucide-react";
import { api, type Problem, type Difficulty, type RunCodeResponse, type SubmitCodeResponse } from "@/lib/api";
import { useMonacoTheme } from "@/hooks/useMonacoTheme";
import { playSound } from "@/lib/sounds";

const difficultyColors: Record<Difficulty, string> = {
  Easy: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  Hard: "bg-red-500/15 text-red-500 border-red-500/30",
};

export function CodingTestPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const monacoTheme = useMonacoTheme();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultTab, setResultTab] = useState("testcases");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    status: string;
    results: { passed: boolean; input?: string; expected?: string; actual?: string; isHidden?: boolean }[];
    aggregate?: {
      visiblePassed: number;
      visibleTotal: number;
      hiddenPassed: number;
      hiddenTotal: number;
      totalPassed: number;
      totalTestCases: number;
    };
    executionTime: string;
    compileError?: string;
    isRunOnly?: boolean;
    attemptsUsed?: number;
    attemptsRemaining?: number;
    maxAttempts?: number;
    currentScore?: number;
    bestScore?: number;
    codingPassed?: boolean;
    canProceedToNextRound?: boolean;
    canContinueCoding?: boolean;
  } | null>(null);
  const [showCongrats, setShowCongrats] = useState(false);
  const [showFailed, setShowFailed] = useState(false);
  const [latestSubmissionId, setLatestSubmissionId] = useState<string | null>(null);
  const [activeTestCaseIdx, setActiveTestCaseIdx] = useState(0);
  const [activeResultCaseIdx, setActiveResultCaseIdx] = useState(0);
  // Resizable panels
  const [leftWidth, setLeftWidth] = useState(45); // percent
  const [bottomHeight, setBottomHeight] = useState(240); // px
  const containerRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const isDraggingH = useRef(false);
  const isDraggingV = useRef(false);

  // ── Java Code Formatter ──────────────────────────────────────────────
  const formatJavaCode = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const raw = editor.getValue();
    const lines = raw.split(/\r?\n/);
    const formatted: string[] = [];
    let indent = 0;
    const TAB = "    "; // 4 spaces

    for (let rawLine of lines) {
      let line = rawLine.trim();
      if (line.length === 0) {
        formatted.push("");
        continue;
      }

      // Decrease indent for closing braces/parens at start of line
      if (/^[}\])]+/.test(line)) {
        indent = Math.max(0, indent - 1);
      }

      // Handle case/default labels (outdent by 1 from switch body)
      let currentIndent = indent;
      if (/^(case\s+|default\s*:)/.test(line)) {
        currentIndent = Math.max(0, indent - 1);
      }

      // Apply indentation
      formatted.push(TAB.repeat(currentIndent) + line);

      // Increase indent after opening braces (ignoring ones in strings/comments)
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      indent += openBraces - closeBraces;

      // Re-adjust if we went negative
      if (indent < 0) indent = 0;
    }

    const result = formatted.join("\n");
    editor.setValue(result);
    setCode(result);
  }, []);

  const handleEditorMount = useCallback((editor: any) => {
    editorRef.current = editor;

    // Register Shift+Alt+F shortcut for formatting
    editor.addAction({
      id: "format-java-code",
      label: "Format Java Code",
      keybindings: [
        // Monaco KeyMod.Shift | Monaco KeyMod.Alt | Monaco KeyCode.KeyF
        // Values: Shift=1024, Alt=512, KeyF=36
        1024 | 512 | 36,
      ],
      run: () => formatJavaCode(),
    });
  }, [formatJavaCode]);

  const startDragH = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingH.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingH.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(Math.max(pct, 20), 75));
    };
    const onUp = () => {
      isDraggingH.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const startDragV = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingV.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingV.current || !rightPanelRef.current) return;
      const rect = rightPanelRef.current.getBoundingClientRect();
      const fromBottom = rect.bottom - ev.clientY;
      setBottomHeight(Math.min(Math.max(fromBottom, 120), rect.height - 120));
    };
    const onUp = () => {
      isDraggingV.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const [timeLeft, setTimeLeft] = useState(60 * 60); // Default 60 minutes
  const [showRulesModal, setShowRulesModal] = useState(true);

  useEffect(() => {
    if (showRulesModal) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [showRulesModal]);

  // Fetch problem and check session status
  useEffect(() => {
    if (!id) return;

    // Check progression status to block backward navigation
    api.get<{ status: string; sessionId?: string; submissionId?: string }>(`/interviews/session-status/${id}`)
      .then((res) => {
        if (res.status === "interview_completed") {
          navigate(`/problems/${id}/report`, { replace: true });
        } else if (res.status === "interview_in_progress" || res.status === "coding_completed") {
          navigate(`/problems/${id}/interview`, { 
            state: { submissionId: res.submissionId },
            replace: true 
          });
        } else {
          // Normal flow: fetch problem and settings
          Promise.all([
            api.get<Problem>(`/problems/${id}`),
            api.get("/settings")
          ])
            .then(([probData, settingsData]: [any, any]) => {
              setProblem(probData);
              setCode(probData.boilerplate);
              if (settingsData?.timers?.codingTestTimer) {
                setTimeLeft(settingsData.timers.codingTestTimer * 60);
              }
            })
            .catch((err) => console.error("Failed to fetch problem or settings:", err))
            .finally(() => setLoading(false));
        }
      })
      .catch((err) => {
        console.error("Failed to check session status:", err);
        setLoading(false);
      });
  }, [id, navigate]);

  useEffect(() => {
    if (showCongrats) {
      playSound("notification/success").catch((err) => console.error("Failed to play success sound:", err));
    }
  }, [showCongrats]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const handleRun = async () => {
    if (!problem) return;
    setIsRunning(true);
    setResultTab("result");
    setSubmissionResult(null);

    try {
      const result = await api.post<RunCodeResponse>("/submissions/run", {
        code,
        problemId: problem._id,
      });
      // Store in submissionResult so the full results view is shown
      setSubmissionResult({
        status: result.status,
        results: result.results,
        aggregate: result.aggregate,
        executionTime: result.executionTime,
        compileError: result.compileError,
        isRunOnly: true,
      });
      setActiveResultCaseIdx(0);

      if (result.status === "Accepted") {
        playSound("notification/completed").catch((err) => console.error("Failed to play completed sound:", err));
      } else {
        playSound("notification/error").catch((err) => console.error("Failed to play error sound:", err));
      }
    } catch (err) {
      setSubmissionResult({
        status: "Runtime Error",
        results: [],
        executionTime: "0ms",
        compileError: err instanceof Error ? err.message : "Failed to run code",
        isRunOnly: true,
      });
      setActiveResultCaseIdx(0);
      playSound("notification/error").catch((err) => console.error("Failed to play error sound:", err));
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!problem) return;
    setIsSubmitting(true);
    setResultTab("result");
    setSubmissionResult(null);

    try {
      const result = await api.post<SubmitCodeResponse>("/submissions/submit", {
        code,
        problemId: problem._id,
      });

      setSubmissionResult({
        status: result.status,
        results: result.results,
        aggregate: result.aggregate,
        executionTime: result.executionTime,
        compileError: result.compileError,
        attemptsUsed: result.attemptsUsed,
        attemptsRemaining: result.attemptsRemaining,
        maxAttempts: result.maxAttempts,
        currentScore: result.currentScore,
        bestScore: result.bestScore,
        codingPassed: result.codingPassed,
        canProceedToNextRound: result.canProceedToNextRound,
        canContinueCoding: result.canContinueCoding,
      });
      setActiveResultCaseIdx(0);

      // If passing criteria is met, show congratulations
      if (result.codingPassed) {
        if (result.bestSubmissionId) {
          setLatestSubmissionId(result.bestSubmissionId);
        }
        playSound("notification/completed").catch((err) => console.error("Failed to play completed sound:", err));
        setTimeout(() => setShowCongrats(true), 800);
      } else {
        playSound("notification/error").catch((err) => console.error("Failed to play error sound:", err));
        if (result.attemptsRemaining === 0) {
          setTimeout(() => setShowFailed(true), 800);
        }
      }
    } catch (err) {
      setSubmissionResult({
        status: "Runtime Error",
        results: [],
        executionTime: "0ms",
        compileError: err instanceof Error ? err.message : "Submission failed",
      });
      setActiveResultCaseIdx(0);
      playSound("notification/error").catch((err) => console.error("Failed to play error sound:", err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Problem not found</h2>
          <Button variant="outline" onClick={() => navigate("/problems")}>Back to Problems</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top bar */}
      <div className="h-12 border-b border-border bg-muted/30 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => navigate("/problems")} id="back-to-problems">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="font-semibold text-sm">{problem.title}</h2>
          <Badge variant="outline" className={`${difficultyColors[problem.difficulty]} text-xs`}>
            {problem.difficulty}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium ${
            timeLeft <= 120 ? "bg-red-500 text-white animate-pulse" : "bg-muted text-muted-foreground"
          }`} id="timer">
            <Clock className="w-3.5 h-3.5" />
            {formatTime(timeLeft)}
          </div>
          <Badge variant="outline" className="text-xs font-mono bg-muted/50">
            Java
          </Badge>
        </div>
      </div>

      {/* Main content - split view */}
      <div className="flex-1 flex overflow-hidden" ref={containerRef}>
        {/* Left panel - Problem description */}
        <div className="border-r border-border overflow-auto flex-shrink-0 min-w-0" style={{ width: `${leftWidth}%` }}>
          <div className="p-6 space-y-6 overflow-hidden" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
            <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_pre]:bg-muted/50 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:whitespace-pre-wrap [&_pre]:overflow-x-auto [&_code]:text-primary [&_code]:bg-primary/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:break-all" dangerouslySetInnerHTML={{ __html: problem.description }} />

            <Separator />

            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Constraints
              </h3>
              <pre className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg whitespace-pre-wrap font-mono">{problem.constraints}</pre>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Sample Input</h3>
                  <button
                    onClick={() => copyToClipboard(problem.sampleInput, "input")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    id="copy-sample-input"
                  >
                    {copiedField === "input" ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <pre className="text-sm bg-muted/30 p-3 rounded-lg font-mono">{problem.sampleInput}</pre>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Sample Output</h3>
                  <button
                    onClick={() => copyToClipboard(problem.sampleOutput, "output")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    id="copy-sample-output"
                  >
                    {copiedField === "output" ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <pre className="text-sm bg-muted/30 p-3 rounded-lg font-mono">{problem.sampleOutput}</pre>
              </div>
            </div>
          </div>
        </div>
        {/* Horizontal drag handle */}
        <div
          onMouseDown={startDragH}
          className="w-1.5 flex-shrink-0 cursor-col-resize group flex items-center justify-center hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
          title="Drag to resize"
        >
          <div className="w-0.5 h-8 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
        </div>

        {/* Right panel - Code editor + output */}
        <div className="flex-1 flex flex-col min-w-0" ref={rightPanelRef}>
          {/* Code editor */}
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language="java"
              value={code}
              onChange={(v) => setCode(v || "")}
              onMount={handleEditorMount}
              theme={monacoTheme}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                padding: { top: 16, bottom: 16 },
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                automaticLayout: true,
                formatOnPaste: true,
              }}
            />
          </div>
          {/* Vertical drag handle between editor and bottom panel */}
          <div
            onMouseDown={startDragV}
            className="h-1.5 flex-shrink-0 cursor-row-resize group flex items-center justify-center border-t border-border hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
            title="Drag to resize"
          >
            <div className="h-0.5 w-8 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
          </div>

          {/* Bottom panel - Output/Results */}
          <div className="flex flex-col flex-shrink-0 min-h-0" style={{ height: `${bottomHeight}px` }}>
            <Tabs value={resultTab} onValueChange={setResultTab} className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/10">
                <TabsList className="bg-muted/50 p-1 rounded-xl h-fit gap-1 border-none">
                  <TabsTrigger
                    value="testcases"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus:outline-none border-none"
                  >
                    Testcase
                  </TabsTrigger>
                  <TabsTrigger
                    value="result"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus:outline-none border-none"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    Test Result
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={formatJavaCode}
                    className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                    title="Format Code (Shift+Alt+F)"
                    id="format-code-btn"
                  >
                    <AlignLeft className="w-3 h-3" />
                    Format
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRun}
                    disabled={isRunning || isSubmitting}
                    className="h-8 text-xs gap-1.5"
                    id="run-code-btn"
                  >
                    {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Run Code
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={isRunning || isSubmitting || submissionResult?.canContinueCoding === false}
                    className="h-8 text-xs gap-1.5 bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white font-medium disabled:opacity-50"
                    id="submit-code-btn"
                  >
                    {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CloudUpload className="w-3 h-3" />}
                    {submissionResult?.attemptsRemaining !== undefined ? `Submit (${submissionResult.attemptsRemaining} left)` : "Submit Code"}
                  </Button>
                </div>
              </div>

              <TabsContent value="testcases" className="flex-1 overflow-auto min-h-0 p-4 m-0">
                <div className="space-y-4">
                  {/* Case Pills Selector — show only public (first 2) test cases */}
                  <Tabs value={String(activeTestCaseIdx)} onValueChange={(val) => setActiveTestCaseIdx(Number(val))} className="w-fit">
                    <TabsList className="bg-muted/50 p-1 rounded-xl h-fit gap-1 border-none">
                      {problem.testCases.filter(tc => !tc.isHidden).map((tc, idx) => (
                        <TabsTrigger
                          key={tc._id}
                          value={String(idx)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus:outline-none border-none"
                        >
                          Case {idx + 1}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>

                  {/* Active Case Content */}
                  {problem.testCases.filter(tc => !tc.isHidden)[activeTestCaseIdx] && (
                    <div className="space-y-4 animate-slide-up" key={activeTestCaseIdx}>
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold mb-1.5">Input</p>
                        <pre className="text-sm font-mono bg-muted/30 p-3 rounded-xl border border-border/40 whitespace-pre-wrap">
                          {problem.testCases.filter(tc => !tc.isHidden)[activeTestCaseIdx].input}
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold mb-1.5">Expected Output</p>
                        <pre className="text-sm font-mono bg-muted/30 p-3 rounded-xl border border-border/40 whitespace-pre-wrap">
                          {problem.testCases.filter(tc => !tc.isHidden)[activeTestCaseIdx].expectedOutput}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="result" className="flex-1 overflow-auto min-h-0 p-4 m-0">
                {(isRunning || isSubmitting) ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isRunning ? "Compiling and running..." : "Running all test cases..."}
                  </div>
                ) : submissionResult ? (
                  /* ── SUBMISSION RESULT ── */
                  submissionResult.compileError ? (
                    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-5 h-5 text-destructive" />
                        <p className="font-semibold text-destructive">Compilation Error</p>
                      </div>
                      <pre className="text-xs font-mono text-destructive/80 whitespace-pre-wrap">{submissionResult.compileError}</pre>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between pb-3 border-b border-border/50">
                        <div className="flex items-center gap-3">
                          <span className={`text-xl font-bold ${
                            (submissionResult.codingPassed || submissionResult.status === "Accepted") ? "text-success" : "text-destructive"
                          }`}>
                            {submissionResult.codingPassed ? "Passed Criteria" : submissionResult.status}
                          </span>
                          {submissionResult.currentScore !== undefined && (
                            <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded-md">
                              Score: {submissionResult.currentScore}%
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground font-medium">
                            Runtime: {submissionResult.executionTime}
                          </span>
                        </div>
                        {submissionResult.isRunOnly && (
                          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">Run only — not submitted</span>
                        )}
                      </div>

                      <Tabs value={String(activeResultCaseIdx)} onValueChange={(val) => setActiveResultCaseIdx(Number(val))} className="w-fit">
                        <TabsList className="bg-muted/50 p-1 rounded-xl h-fit gap-1 border-none flex-wrap">
                          {submissionResult.results.map((res, idx) => (
                            <TabsTrigger
                              key={idx}
                              value={String(idx)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus:outline-none border-none"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${res.passed ? "bg-success" : "bg-destructive"}`} />
                              Case {idx + 1}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </Tabs>

                      {submissionResult.results[activeResultCaseIdx] && (
                        <div className="space-y-4 animate-slide-up" key={activeResultCaseIdx}>
                          <div>
                            <p className="text-xs text-muted-foreground font-semibold mb-1.5">Input</p>
                            <pre className="text-sm font-mono bg-muted/30 p-3 rounded-xl border border-border/40 whitespace-pre-wrap">
                              {submissionResult.results[activeResultCaseIdx].isHidden ? "[hidden]" : submissionResult.results[activeResultCaseIdx].input}
                            </pre>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground font-semibold mb-1.5">Your Output</p>
                              <pre className={`text-sm font-mono p-3 rounded-xl border whitespace-pre-wrap ${
                                submissionResult.results[activeResultCaseIdx].isHidden
                                  ? "bg-muted/30 border-border/40 text-muted-foreground italic"
                                  : submissionResult.results[activeResultCaseIdx].passed
                                    ? "bg-muted/30 border-border/40 text-foreground"
                                    : "bg-destructive/5 border-destructive/20 text-destructive font-semibold"
                              }`}>
                                {submissionResult.results[activeResultCaseIdx].isHidden ? "[hidden]" : (submissionResult.results[activeResultCaseIdx].actual?.trim() || "No output")}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-semibold mb-1.5">Expected Output</p>
                              <pre className="text-sm font-mono bg-muted/30 p-3 rounded-xl border border-border/40 whitespace-pre-wrap">
                                {submissionResult.results[activeResultCaseIdx].isHidden ? "[hidden]" : submissionResult.results[activeResultCaseIdx].expected}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">Run or submit your code to see the results.</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Congratulations Modal */}
      {showCongrats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fade-in_0.3s_ease-out]">
          {/* Confetti particles */}
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="confetti-particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
                backgroundColor: [
                  "oklch(0.70 0.18 145)",
                  "oklch(0.75 0.18 75)",
                  "oklch(0.58 0.18 250)",
                  "oklch(0.65 0.22 25)",
                  "oklch(0.68 0.18 145)",
                  "oklch(0.72 0.16 330)",
                ][Math.floor(Math.random() * 6)],
                width: `${6 + Math.random() * 8}px`,
                height: `${6 + Math.random() * 8}px`,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              }}
            />
          ))}

          <div className="relative bg-card border border-border rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl animate-[slide-up_0.5s_ease-out] celebration-glow">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mb-5">
                <Trophy className="w-10 h-10 text-success" />
              </div>

              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h2 className="text-2xl font-bold">Congratulations!</h2>
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>

              <p className="text-muted-foreground text-sm mb-2">
                You've met the passing criteria! You can now proceed to the technical interview.
              </p>

              <div className="flex items-center gap-3 my-4">
                <Badge variant="outline" className="bg-success/15 text-success border-success/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {submissionResult?.aggregate?.totalPassed ?? submissionResult?.results.filter(r => r.passed).length}/{submissionResult?.aggregate?.totalTestCases ?? submissionResult?.results.length} Passed
                </Badge>
                <Badge variant="outline" className="text-muted-foreground">
                  <Clock className="w-3 h-3 mr-1" />
                  {submissionResult?.executionTime}
                </Badge>
              </div>

              <div className="w-full p-4 rounded-xl bg-muted/30 border border-border/50 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <PartyPopper className="w-4 h-4 text-primary" />
                  <span className="font-medium">Round 2: Technical Interview</span>
                </div>
                <p className="text-xs text-left text-muted-foreground mt-1">
                  An interviewer will discuss your solution with you. Be ready to explain your approach!
                </p>
              </div>

              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  onClick={() => setShowCongrats(false)}
                  className="flex-1"
                  disabled={submissionResult?.attemptsRemaining === 0}
                  id="close-congrats-btn"
                >
                  Review Code
                </Button>
                <Button
                  onClick={() => navigate(`/problems/${id}/interview`, {
                    state: { code, problem, submissionId: latestSubmissionId },
                  })}
                  className="flex-1 gap-2 bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white"
                  id="proceed-round2-btn"
                >
                  Proceed to Round 2
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Failed Modal */}
      {showFailed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fade-in_0.3s_ease-out]">
          <div className="relative bg-card border border-border rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl animate-[slide-up_0.5s_ease-out]">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-destructive/15 flex items-center justify-center mb-5">
                <XCircle className="w-10 h-10 text-destructive" />
              </div>

              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-2xl font-bold">Assessment Failed</h2>
              </div>

              <p className="text-muted-foreground text-sm mb-4">
                You have exhausted your submission attempts and did not meet the passing criteria for this coding test.
              </p>

              <div className="w-full p-4 rounded-xl bg-muted/30 border border-border/50 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="font-medium">Report Generated</span>
                </div>
                <p className="text-xs text-left text-muted-foreground mt-1">
                  Your coding results have been recorded. Proceed to view your final evaluation report.
                </p>
              </div>

              <div className="flex gap-3 w-full">
                <Button
                  onClick={() => navigate(`/problems/${id}/report`, { replace: true })}
                  className="flex-1 gap-2 bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white"
                >
                  View Report
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fade-in_0.3s_ease-out]">
          <div className="relative bg-card border border-border rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl animate-[slide-up_0.5s_ease-out]">
            <div className="flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Assessment Rules</h2>
              </div>

              <div className="space-y-4 text-sm text-muted-foreground mb-6">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Time Limit</p>
                    <p>You have 45 minutes to complete this coding challenge. The timer will start immediately after you close this window.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Play className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Testing Your Code</p>
                    <p>Use the <strong>Run Code</strong> button to test your solution against the visible sample test cases without using up your submission attempts.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CloudUpload className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Submitting & Attempts</p>
                    <p>Use the <strong>Submit Code</strong> button to evaluate your code against all hidden test cases. You have a limited number of submission attempts. Make sure your code is ready before submitting!</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => setShowRulesModal(false)}
                  className="w-full sm:w-auto bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white"
                  id="start-assessment-btn"
                >
                  I understand, start assessment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
