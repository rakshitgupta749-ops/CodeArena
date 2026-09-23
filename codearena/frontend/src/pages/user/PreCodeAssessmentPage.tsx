import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Send,
  FileText,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ServerCrash,
  Mic,
  Square,
  Volume2,
  VolumeX,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  api,
  type Problem,
  type Difficulty,
} from "@/lib/api";
import interviewerAvatar from "@/assets/profile.png";
import { playSound, initAudio } from "@/lib/sounds";

const INTERVIEWER_NAME = "ok";
const INTERVIEWER_ROLE = "Senior Developer";
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000;

interface PreCodeConversationMessage {
  role: "ai" | "candidate";
  text: string;
  questionId: string;
  createdAt?: string;
  isWarning?: boolean;
  isConductViolation?: boolean;
  isTerminated?: boolean;
  warningCount?: number;
}

interface PreCodeAssessment {
  id: string;
  problem: string;
  status: "in_progress" | "passed" | "failed" | "completed" | "terminated" | string;
  problemType: string;
  currentRubric?: string;
  relevantConcepts: string[];
  currentQuestion: string;
  questionCount: number;
  warningCount?: number;
  integrityScore?: number;
  maxQuestions: number;
  conversation: PreCodeConversationMessage[];
  startedAt: string;
  completedAt: string | null;
  rubricSummary?: {
    rubric: string;
    rating: string;
    reason: string;
  }[];
  rubricState?: Record<string, {
    status: string;
    rating?: string;
    reason?: string;
    probeUsed?: boolean;
    [key: string]: unknown;
  }>;
}

interface PreCodeAnswerResult {
  responseClassification?: string;
  decision?: "continue" | "pass" | "fail" | string;
  interviewerMessage?: string;
}

interface PreCodeStartResponse {
  assessment: PreCodeAssessment;
}

interface PreCodeAnswerResponse {
  acknowledged?: boolean;
  warningType?: string;
  warningCount?: number;
  terminated?: boolean;
  message?: string;
  assessment: PreCodeAssessment;
  result?: PreCodeAnswerResult;
}

const difficultyColors: Record<Difficulty, string> = {
  Easy: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  Hard: "bg-red-500/15 text-red-500 border-red-500/30",
};

export function PreCodeAssessmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [assessment, setAssessment] = useState<PreCodeAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [startError, setStartError] = useState<string | null>(null);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(15 * 60);
  
  // App state
  const [instructionsAccepted, setInstructionsAccepted] = useState(false);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [inactivityWiped, setInactivityWiped] = useState(false);
  const [decision, setDecision] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  // Chat state
  const [inputValue, setInputValue] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Audio / Voice
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [pendingVoiceReceipt, setPendingVoiceReceipt] = useState<{text: string} | null>(null);

  // Layout
  const [leftWidth, setLeftWidth] = useState(45); // percent
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingH = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [remainingSeconds, setRemainingSeconds] = useState(15 * 60);
  
  // Audio refs
  const spokenMessageIdsRef = useRef<Set<string>>(new Set());
  const playbackRequestIdRef = useRef(0);
  const recognitionRef = useRef<any | null>(null);
  const recognitionStartTimeRef = useRef<number | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);

  // Audio helpers
  const clearAudioPlayback = useCallback(() => {
    window.speechSynthesis.cancel();
  }, []);

  const stopSpeaking = useCallback(() => {
    playbackRequestIdRef.current += 1;
    clearAudioPlayback();
    setSpeakingMessageId(null);
  }, [clearAudioPlayback]);

  const speakMessage = useCallback(
    async (message: PreCodeConversationMessage, index: number) => {
      const msgId = `ai-${index}`;
      const speakableText = message.text;
      if (!speakableText) return;

      stopSpeaking();
      const requestId = playbackRequestIdRef.current;
      setVoiceError(null);
      setSpeakingMessageId(msgId);

      try {
        const utterance = new SpeechSynthesisUtterance(speakableText);
        
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Samantha'))) || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.onend = () => {
          if (requestId !== playbackRequestIdRef.current) return;
          setSpeakingMessageId(null);
        };

        utterance.onerror = () => {
          if (requestId !== playbackRequestIdRef.current) return;
          setVoiceError("Browser audio playback failed.");
          setSpeakingMessageId(null);
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        if (requestId !== playbackRequestIdRef.current) return;
        setVoiceError("Browser text-to-speech is unavailable.");
        setSpeakingMessageId(null);
      }
    },
    [stopSpeaking]
  );

  const handleReplayQuestion = useCallback(() => {
    if (!assessment || !assessment.conversation) return;
    const aiMessages = assessment.conversation.map((m, i) => ({...m, idx: i})).filter(m => m.role === "ai");
    const latestQuestion = aiMessages.length > 0 ? aiMessages[aiMessages.length - 1] : null;

    if (!latestQuestion) return;

    spokenMessageIdsRef.current.add(`ai-${latestQuestion.idx}`);
    setVoiceModeEnabled(true);
    void speakMessage(latestQuestion, latestQuestion.idx);
  }, [assessment, speakMessage]);

  const cancelRecognition = useCallback(() => {
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    recognitionStartTimeRef.current = null;
  }, []);

  const startRecording = useCallback(() => {
    if (isAiTyping || completed || startError || recordingState !== "idle") return;

    const SpeechRecognition =
      (window as typeof window & {
        SpeechRecognition?: any;
        webkitSpeechRecognition?: any;
      }).SpeechRecognition ||
      (window as typeof window & {
        SpeechRecognition?: any;
        webkitSpeechRecognition?: any;
      }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError("Voice recording is unavailable in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    let latestTranscript = "";

    recognition.onresult = (event: any) => {
      latestTranscript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript || "")
        .join(" ")
        .trim();

      setInputValue(latestTranscript);

      if (event.results[event.results.length - 1]?.isFinal) {
        setPendingVoiceReceipt({ text: latestTranscript });
      }
    };

    recognition.onerror = (event: any) => {
      setVoiceError(
        event?.error === "not-allowed" || event?.error === "service-not-allowed"
          ? "Microphone permission is needed for voice answers."
          : `Voice recognition failed: ${event?.error || "unknown error"}.`
      );
      recognitionRef.current = null;
      setRecordingState("idle");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      recognitionStartTimeRef.current = null;
      setRecordingState("idle");

      if (!latestTranscript.trim()) {
        setVoiceError("No speech was recognized. Type the answer or try again.");
      }

      window.requestAnimationFrame(() => inputRef.current?.focus());
    };

    recognitionRef.current = recognition;
    recognitionStartTimeRef.current = Date.now();
    setPendingVoiceReceipt(null);
    setInputValue("");
    setVoiceError(null);
    setRecordingState("recording");

    recognition.start();
  }, [completed, isAiTyping, recordingState, startError]);

  const stopRecording = useCallback(() => {
    if (recordingState !== "recording") return;
    recognitionRef.current?.stop();
  }, [recordingState]);

  const startDragH = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingH.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingH.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(Math.max(pct, 25), 70));
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

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [assessment?.conversation, isAiTyping, scrollToBottom]);

  useEffect(() => {
    if (!voiceModeEnabled) {
      stopSpeaking();
      return;
    }

    if (!assessment || !assessment.conversation) return;
    
    const aiMessages = assessment.conversation.map((m, i) => ({...m, idx: i})).filter(m => m.role === "ai");
    const latestQuestion = aiMessages.length > 0 ? aiMessages[aiMessages.length - 1] : null;

    if (!latestQuestion || spokenMessageIdsRef.current.has(`ai-${latestQuestion.idx}`)) {
      return;
    }

    spokenMessageIdsRef.current.add(`ai-${latestQuestion.idx}`);
    void speakMessage(latestQuestion, latestQuestion.idx);
  }, [assessment?.conversation, speakMessage, stopSpeaking, voiceModeEnabled]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      cancelRecognition();
    };
  }, [cancelRecognition, stopSpeaking]);

  // Security: Inactivity Tracker
  useEffect(() => {
    if (!id) return;
    const storageKey = `precode_leave_${id}`;

    const terminateOnBackend = async () => {
      const sessionId = activeSessionIdRef.current;
      if (sessionId) {
        try {
          await api.post(`/pre-code/${sessionId}/terminate`, {});
        } catch {
        }
      }
    };

    const checkInactivity = () => {
      const leftAt = localStorage.getItem(storageKey);
      if (leftAt && Date.now() - parseInt(leftAt, 10) > INACTIVITY_TIMEOUT_MS) {
        terminateOnBackend();
        activeSessionIdRef.current = null;
        setInactivityWiped(true);
        setAssessment(null);
        setCompleted(true);
        setDecision("abandoned");
        localStorage.removeItem(storageKey);
        return true;
      }
      return false;
    };

    if (checkInactivity()) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        localStorage.setItem(storageKey, Date.now().toString());
      } else {
        if (!checkInactivity()) {
          localStorage.removeItem(storageKey);
        }
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      localStorage.setItem(storageKey, Date.now().toString());
      if (assessmentStarted && !completed) {
        e.preventDefault();
        e.returnValue = "Are you sure you want to leave? If you are away for more than 2 minutes, your assessment will be terminated.";
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [id, assessmentStarted, completed]);

  // Fetch problem and settings
  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<Problem>(`/problems/${id}`),
      api.get(`/settings?problemId=${id}`)
    ])
      .then(([probData, settingsData]: [any, any]) => {
        setProblem(probData);
        if (settingsData?.timers?.preCodeAssessmentTimer) {
          const limit = settingsData.timers.preCodeAssessmentTimer * 60;
          setTimeLimitSeconds(limit);
          setRemainingSeconds(limit);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch problem or settings:", err);
        setStartError("Failed to fetch problem details.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleStart = async () => {
    if (!id) return;
    await initAudio();
    setAssessmentStarted(true);
    setLoading(true);
    setStartError(null);
    setCompleted(false);
    setDecision(null);
    setInputValue("");
    setRemainingSeconds(timeLimitSeconds);
    activeSessionIdRef.current = null;

    try {
      const response = await api.post<PreCodeStartResponse>(
        "/pre-code/start",
        { problemId: id }
      );
      activeSessionIdRef.current = response.assessment.id;
      setAssessment(response.assessment);
      
      // Play a notification sound
      playSound("notification/notification").catch(() => {});
    } catch (err) {
      console.error("Failed to start pre-code assessment:", err);
      setStartError(
        err instanceof Error
          ? err.message
          : "Unable to start the assessment."
      );
    } finally {
      setLoading(false);
    }
  };

  // Assessment timer
  useEffect(() => {
    if (!assessment || assessment.status !== "in_progress") {
      return;
    }

    const startedAt = new Date(assessment.startedAt).getTime();
    let hasTimedOut = false;

    const updateTimer = async () => {
      const elapsedSeconds = Math.floor(
        (Date.now() - startedAt) / 1000
      );
      const remaining = Math.max(timeLimitSeconds - elapsedSeconds, 0);
      setRemainingSeconds(remaining);

      if (remaining === 0 && !hasTimedOut) {
        hasTimedOut = true;
        setIsSubmitting(true);
        try {
          const response = await api.post<{ assessment: PreCodeAssessment; result: { decision: string } }>(
            `/pre-code/${assessment.id}/timeout`,
            {}
          );
          setAssessment(response.assessment);
          setDecision(response.result?.decision || "time_expired");
          setCompleted(true);
        } catch (err) {
          setCompleted(true);
          setDecision("time_expired");
        } finally {
          setIsSubmitting(false);
        }
      }
    };

    updateTimer();
    const timerId = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timerId);
  }, [assessment]);

  const handleSend = async () => {
    const confirmedAnswer = inputValue.trim();
    if (!assessment || !confirmedAnswer || isSubmitting || isAiTyping || completed) return;

    const submittedSessionId = assessment.id;
    
    setIsSubmitting(true);
    setIsAiTyping(true);
    
    // Add user message optimistically
    setAssessment((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        conversation: [
          ...prev.conversation,
          {
            role: "candidate",
            text: confirmedAnswer,
            questionId: prev.currentQuestion || "",
          }
        ]
      }
    });
    
    setInputValue("");
    setPendingVoiceReceipt(null);
    
    try {
      const response = await api.post<PreCodeAnswerResponse>(
        `/pre-code/${assessment.id}/answer`,
        { answer: confirmedAnswer }
      );

      if (activeSessionIdRef.current !== submittedSessionId) {
        return;
      }

      if (response.acknowledged === false || response.warningType) {
        const isSolution = response.warningType === "solution_request";
        const isConduct =
          response.warningType === "prompt_injection" ||
          response.warningType === "abusive_language";
        const isTerminated = Boolean(
          response.terminated || response.assessment?.status === "terminated"
        );
        const count = response.warningCount ?? response.assessment?.warningCount ?? 0;

        setAssessment((prev) => {
          if (!prev) return response.assessment;
          return {
            ...response.assessment,
            conversation: [
              ...prev.conversation,
              {
                role: "ai",
                text: response.message || "Please answer the question appropriately.",
                questionId: prev.currentQuestion || "",
                isWarning: isSolution || isConduct,
                isConductViolation: isConduct,
                isTerminated: isTerminated,
                warningCount: count,
              },
            ],
          };
        });

        playSound("notification/notification").catch(() => {});

        if (isTerminated) {
          setCompleted(true);
          setDecision("terminated");
        }
        return;
      }

      setAssessment(response.assessment);
      
      playSound("notification/notification").catch(() => {});

      const result = response.result;
      if (result?.decision) {
        setDecision(result.decision);
      }

      if (
        response.assessment.status === "passed" ||
        response.assessment.status === "failed" ||
        response.assessment.status === "terminated" ||
        result?.decision === "pass" ||
        result?.decision === "fail" ||
        result?.decision === "terminate"
      ) {
        setCompleted(true);
      }
    } catch (err) {
      console.error("Failed to submit answer:", err);
      setStartError(err instanceof Error ? err.message : "Unable to submit your answer.");
    } finally {
      setIsSubmitting(false);
      setIsAiTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (inactivityWiped) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border border-destructive/20 bg-card p-8 shadow-2xl text-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Session Terminated</h1>
          <p className="text-muted-foreground mb-8">
            Your assessment was terminated because you navigated away from the window for more than 2 minutes.
          </p>
          <Button className="w-full" onClick={() => navigate("/problems")}>
            Back to Problems
          </Button>
        </div>
      </div>
    );
  }

  if (loading && !assessmentStarted) {
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

  if (!assessmentStarted) {
    return (
      <div className="h-[calc(100vh-64px)] bg-background flex flex-col items-center justify-center text-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background pointer-events-none" />
        <div className="relative z-10">
          <div className="relative mb-6 mx-auto w-fit">
            <Avatar className="h-24 w-24 border border-border shadow-sm">
              <AvatarImage src={interviewerAvatar} alt={INTERVIEWER_NAME} />
              <AvatarFallback className="bg-slate-200 text-xl font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                DM
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-background bg-emerald-500" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl mb-3">
            Pre-Code Technical Assessment
          </h1>
          <p className="max-w-md text-sm leading-6 text-muted-foreground mb-8 mx-auto">
            The AI will evaluate your understanding of the problem before you code. Ensure your microphone is connected and your volume is up. No tab switching allowed.
          </p>
          <div className="flex items-center justify-center gap-3 mb-8 bg-muted/30 p-4 rounded-lg border border-border/50 max-w-md mx-auto text-left">
            <input
              id="assessment-ready"
              type="checkbox"
              checked={instructionsAccepted}
              onChange={(e) => setInstructionsAccepted(e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-primary text-primary focus:ring-primary/20 transition-all cursor-pointer"
            />
            <label htmlFor="assessment-ready" className="text-sm font-medium leading-tight cursor-pointer select-none">
              I acknowledge the rules. I understand that leaving the exam window for more than 2 minutes will result in an automatic failure.
            </label>
          </div>
          <Button size="lg" disabled={!instructionsAccepted} onClick={handleStart}>
            Start Assessment
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="relative mb-6">
          <Avatar className="h-24 w-24 border border-border shadow-sm">
            <AvatarImage src={interviewerAvatar} alt={INTERVIEWER_NAME} />
            <AvatarFallback className="bg-slate-200 text-xl font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              DM
            </AvatarFallback>
          </Avatar>
          <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-background bg-emerald-500" />
        </div>

        <div className="mb-5 flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Shield className="h-3.5 w-3.5 text-primary" />
          Pre-Code Round
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Connecting to interviewer
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          Preparing your personalized technical interview for {problem.title}.
        </p>

        <div className="mt-8 w-full max-w-md space-y-3 text-left">
          {[
            "Analyzing problem requirements",
            "Preparing conceptual questions",
          ].map((step) => (
            <div
              key={step}
              className="flex items-center gap-3 rounded-md border border-border bg-muted/20 px-4 py-3 text-sm text-foreground"
            >
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!assessment) return null;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top Bar */}
      <div className="h-12 border-b border-border bg-muted/30 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Pre-Code</span>
            <span className="text-muted-foreground text-sm">— Technical Assessment</span>
          </div>
          <Separator orientation="vertical" className="h-5" />
          <h2 className="font-semibold text-sm">{problem.title}</h2>
          <Badge variant="outline" className={`${difficultyColors[problem.difficulty]} text-xs`}>
            {problem.difficulty}
          </Badge>
          <Badge
            variant={remainingSeconds <= 2 * 60 ? "destructive" : "outline"}
            className={`ml-4 ${remainingSeconds <= 2 * 60 ? "bg-red-500 text-white animate-pulse" : ""}`}
          >
            Time left: {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:{String(remainingSeconds % 60).padStart(2, "0")}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant={voiceModeEnabled ? "secondary" : "ghost"}
            onClick={() => setVoiceModeEnabled((enabled) => !enabled)}
            title={voiceModeEnabled ? "Turn off question voice" : "Turn on question voice"}
          >
            {voiceModeEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={handleReplayQuestion}
            disabled={!assessment.conversation.some(m => m.role === "ai")}
            title="Replay latest question"
          >
            {speakingMessageId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* 2-Panel Layout */}
      <div className="flex-1 flex overflow-hidden" ref={containerRef}>
        
        {/* LEFT: Problem */}
        <div style={{ width: `${leftWidth}%` }} className="flex-shrink-0 flex flex-col min-h-0">
          <div className="h-10 px-3 border-b border-border bg-muted/20 flex items-center gap-1 flex-shrink-0">
            <div className="h-7 px-3 rounded-md text-xs font-medium bg-background text-foreground shadow-sm flex items-center">
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Problem
            </div>
            
            <div className="ml-auto flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-wider">Secured</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
              <div
                className="prose prose-sm dark:prose-invert max-w-none [&_pre]:bg-muted/50 [&_pre]:p-3 [&_pre]:rounded-lg [&_code]:text-primary [&_code]:bg-primary/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono"
                dangerouslySetInnerHTML={{ __html: problem.description }}
              />
              <Separator />
              <div>
                <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Constraints</h4>
                <pre className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg whitespace-pre-wrap font-mono">
                  {problem.constraints}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Horizontal drag handle */}
        <div
          onMouseDown={startDragH}
          className="w-1.5 flex-shrink-0 cursor-col-resize group flex items-center justify-center hover:bg-primary/20 active:bg-primary/30 transition-colors z-10 border-x border-border"
        >
          <div className="w-0.5 h-8 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
        </div>

        {/* RIGHT: Chat Interface */}
        <div className="flex-1 flex flex-col bg-background min-h-0">
          
          {/* Chat Header */}
          <div className="h-10 px-4 border-b border-border flex items-center gap-2.5 flex-shrink-0 bg-muted/20">
            <div className="relative">
              <Avatar className="h-7 w-7">
                <AvatarImage src={interviewerAvatar} alt={INTERVIEWER_NAME} />
                <AvatarFallback className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[10px] font-bold">
                  DM
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border-[1.5px] border-background online-dot" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-semibold leading-none">{INTERVIEWER_NAME}</h3>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{INTERVIEWER_ROLE} · <span className="text-emerald-500 font-medium">Online</span></p>
            </div>
            {assessment.currentRubric && (
               <Badge variant="secondary" className="text-[10px] font-medium py-0 px-2 ml-auto">
                 {assessment.currentRubric}
               </Badge>
            )}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
              {assessment.conversation.map((msg, index) => (
                <div
                  key={index}
                  className={`flex flex-col animate-message-in group ${msg.role === "candidate" ? "items-end" : "items-start"}`}
                >
                  <div className={`flex items-center gap-1 ${msg.role === "candidate" ? "justify-end" : ""}`}>
                    <div
                      className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === "ai"
                          ? "chat-bubble-ai bg-muted/60 text-foreground"
                          : "chat-bubble-user bg-[oklch(0.58_0.18_145)] text-white"
                        }`}
                    >
                      {msg.role === "ai" && msg.isTerminated ? (
                        <div className="space-y-2">
                           <div className="flex items-center gap-2 font-bold text-xs text-destructive">
                             <ShieldAlert className="w-4 h-4 shrink-0" />
                             <span>TERMINATED — CONDUCT VIOLATION</span>
                           </div>
                           <p>{msg.text}</p>
                        </div>
                      ) : msg.role === "ai" && msg.isConductViolation ? (
                         <div className="space-y-2">
                           <div className="flex items-center gap-2 font-bold text-xs text-destructive">
                             <ShieldAlert className="w-4 h-4 shrink-0" />
                             <span>CONDUCT WARNING ({msg.warningCount || 1}/2)</span>
                           </div>
                           <p>{msg.text}</p>
                         </div>
                      ) : msg.role === "ai" && msg.isWarning ? (
                         <div className="space-y-2">
                           <div className="flex items-center gap-2 font-bold text-xs text-amber-500">
                             <AlertTriangle className="w-4 h-4 shrink-0" />
                             <span>SOLUTION REQUEST NOT PERMITTED</span>
                           </div>
                           <p>{msg.text}</p>
                         </div>
                      ) : (
                         <span>{msg.text}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {completed && (
                <div className="flex flex-col items-center justify-center p-6 space-y-4 bg-muted/20 border border-border rounded-xl mt-6">
                  {decision === "terminated" || assessment?.status === "terminated" ? (
                    <>
                      <ShieldAlert className="h-10 w-10 text-destructive" />
                      <h3 className="font-bold text-destructive">Assessment Terminated</h3>
                      <Button onClick={() => navigate("/problems")} variant="destructive">Return to Problems</Button>
                    </>
                  ) : (
                    <>
                      {assessment?.status === "passed" || decision === "pass" ? (
                        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-10 w-10 text-destructive" />
                      )}
                      <h3 className="font-bold">
                        {assessment?.status === "passed" || decision === "pass" ? "Assessment Passed" : "Assessment Failed"}
                      </h3>
                      {assessment?.status === "passed" || decision === "pass" ? (
                        <Button onClick={() => navigate(`/problems/${id}`)}>Continue to Coding Test</Button>
                      ) : (
                        <Button onClick={() => navigate("/problems")} variant="destructive">Return to Problems</Button>
                      )}
                    </>
                  )}
                </div>
              )}

              {startError && (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600">
                  <ServerCrash className="h-4 w-4 shrink-0" />
                  <span>{startError}</span>
                </div>
              )}

              {isAiTyping && (
                <div className="flex flex-col items-start animate-message-in">
                  <div className="chat-bubble-ai bg-muted/60 px-4 py-3 flex items-center gap-1.5">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Chat Input / Submit Button */}
          <div className="border-t border-border p-3 flex-shrink-0 bg-muted/10">
            {completed ? (
              <div className="flex items-center justify-center h-10 text-muted-foreground text-xs font-medium bg-muted/20 border border-dashed border-border rounded-lg">
                Assessment completed.
              </div>
            ) : (
              <div className="space-y-2">
                {voiceError && (
                  <p className="px-2 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    {voiceError}
                  </p>
                )}
                {pendingVoiceReceipt && (
                  <p className="px-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    Transcript ready. Review or edit it, then submit to continue.
                  </p>
                )}
                {pendingVoiceReceipt && inputValue.trim() && (
                  <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      Transcribed answer
                    </p>
                    <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                      {inputValue}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      startError
                        ? "Assessment unavailable"
                        : recordingState === "recording"
                          ? "Listening..."
                          : recordingState === "transcribing"
                            ? "Transcribing..."
                            : pendingVoiceReceipt
                              ? "Review the transcript before sending..."
                              : isAiTyping || isSubmitting
                                ? "Wait for the interviewer..."
                                : "Type or speak your answer..."
                    }
                    disabled={isAiTyping || isSubmitting || Boolean(startError) || recordingState === "transcribing"}
                    className="flex-1 h-10 px-4 rounded-full border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant={recordingState === "recording" ? "destructive" : "outline"}
                    onClick={recordingState === "recording" ? stopRecording : startRecording}
                    disabled={isAiTyping || isSubmitting || Boolean(startError) || recordingState === "transcribing"}
                    className="h-10 w-10 rounded-full shadow-sm disabled:opacity-40"
                  >
                    {recordingState === "transcribing" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : recordingState === "recording" ? (
                      <Square className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={
                      !inputValue.trim() ||
                      isAiTyping ||
                      isSubmitting ||
                      Boolean(startError) ||
                      recordingState !== "idle"
                    }
                    className="h-10 w-10 rounded-full bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white shadow-md disabled:opacity-40"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
