//intereview page for round 2
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Editor from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import {
  Send,
  FileText,
  Code2,
  Loader2,
  Shield,
  BookOpenCheck,
  ServerCrash,
  Mic,
  Square,
  Volume2,
  VolumeX,
  RotateCcw,
  Clock,
} from "lucide-react";
import {
  api,
  type Problem,
  type Difficulty,
  type InterviewSession,
  type InterviewQuestion,
  type InterviewAnswerResponse,
  type VoiceTranscript,
} from "@/lib/api";
import { useMonacoTheme } from "@/hooks/useMonacoTheme";
import interviewerAvatar from "@/assets/profile.png";
import { playSound, initAudio } from "@/lib/sounds";

// (Mock questions removed, using backend)

const INTERVIEWER_NAME = "ok";
const INTERVIEWER_ROLE = "Senior Developer";
const AI_WELCOME = `Hey there! 👋
Thanks for making it to Round 2. I've gone through your submission and will ask follow-up questions based on your code and answers. Take your time: each answer is reviewed before we continue.

Important notes:

Your answers are recorded privately during the live interview.
Type Skip if you want to move past a question. Unrelated or incomplete responses will stay on the current question.

Let's get started!`;

interface ChatMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
  timestamp: Date;
  qid?: string;
  isCompletion?: boolean;
  isAnswerHidden?: boolean;
}

interface QuestionDisplay {
  code: string | null;
  prompt: string;
  lineLabel?: string;
  code_line_start?: number;
  code_line_end?: number;
}

interface LocalInterviewAnswer {
  qid: string;
  answer: string;
  answerType: "typed" | "voice";
}

const difficultyColors: Record<Difficulty, string> = {
  Easy: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  Hard: "bg-red-500/15 text-red-500 border-red-500/30",
};

const UNAVAILABLE_CODE_QUESTION_MESSAGE =
  "This submitted-code question is unavailable because its code snippet line range is missing. Please restart the interview so the server can regenerate safe questions.";

function isSubmittedCodeQuestion(question?: InterviewQuestion) {
  const source = String(question?.source || "").toLowerCase();
  return source === "submitted_code_llm" || (!source && String(question?.qid || "").startsWith("C"));
}

function hasCompleteSubmittedCodeRange(question?: InterviewQuestion) {
  return Boolean(
    question?.code_anchor?.trim() &&
    question?.code_snippet?.trim() &&
    Number.isInteger(question?.code_line_start) &&
    Number.isInteger(question?.code_line_end) &&
    (question?.code_line_start || 0) > 0 &&
    (question?.code_line_end || 0) >= (question?.code_line_start || 0)
  );
}

function isUnavailableSubmittedCodeQuestion(question?: InterviewQuestion) {
  return isSubmittedCodeQuestion(question) && !hasCompleteSubmittedCodeRange(question);
}

function getQuestionPromptText(question: InterviewQuestion) {
  return isUnavailableSubmittedCodeQuestion(question)
    ? UNAVAILABLE_CODE_QUESTION_MESSAGE
    : question.question;
}

export function InterviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const monacoTheme = useMonacoTheme();

  // Get data passed from Round 1
  const submittedCode: string = location.state?.code || "";
  const problemData: Problem | null = location.state?.problem || null;
  const locationSubmissionId: string = location.state?.submissionId || "";

  const [problem, setProblem] = useState<Problem | null>(problemData);
  const [submissionId, setSubmissionId] = useState<string>(locationSubmissionId);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(30 * 60);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [connectingToInterviewer, setConnectingToInterviewer] = useState(Boolean(submissionId));
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [hasUserStarted, setHasUserStarted] = useState(false);
  const [leftTab, setLeftTab] = useState<"problem" | "code">("problem");
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [pendingVoiceReceipt, setPendingVoiceReceipt] = useState<VoiceTranscript | null>(null);

  // Resizable panel
  const [leftWidth, setLeftWidth] = useState(45); // percent
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingH = useRef(false);

  useEffect(() => {
    if (interviewComplete || !hasUserStarted) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          setInterviewComplete(true);
          handleSubmitForEvaluation(userAnswers);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [interviewComplete, hasUserStarted]);

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([]);
  const [startError, setStartError] = useState<string | null>(null);
  const [highlightedQuestionId, setHighlightedQuestionId] = useState<string | null>(null);

  // Collect answers locally
  const [userAnswers, setUserAnswers] = useState<LocalInterviewAnswer[]>([]);
  const [submittingEvaluation, setSubmittingEvaluation] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const codeEditorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const codeHighlightRef = useRef<MonacoEditor.IEditorDecorationsCollection | null>(null);
  const spokenMessageIdsRef = useRef<Set<string>>(new Set());
  const playbackRequestIdRef = useRef(0);
  const recognitionRef = useRef<any | null>(null);
  const recognitionStartTimeRef = useRef<number | null>(null);

  const applyCodeHighlight = useCallback(() => {
    const editor = codeEditorRef.current;
    if (!editor) return;

    if (!codeHighlightRef.current) {
      codeHighlightRef.current = editor.createDecorationsCollection();
    }

    const question = interviewQuestions.find(
      (item) => item.qid === highlightedQuestionId
    );
    const startLine = question?.code_line_start;
    const endLine = question?.code_line_end || startLine;
    const model = editor.getModel();

    if (!model || !startLine || !endLine) {
      codeHighlightRef.current.clear();
      return;
    }

    const boundedStart = Math.max(1, Math.min(startLine, model.getLineCount()));
    const boundedEnd = Math.max(
      boundedStart,
      Math.min(endLine, model.getLineCount())
    );

    codeHighlightRef.current.set([
      {
        range: {
          startLineNumber: boundedStart,
          startColumn: 1,
          endLineNumber: boundedEnd,
          endColumn: model.getLineMaxColumn(boundedEnd),
        },
        options: {
          isWholeLine: true,
          className: "interview-code-highlight-line",
          linesDecorationsClassName: "interview-code-highlight-gutter",
        },
      },
    ]);
    editor.revealLinesInCenter(boundedStart, boundedEnd);
  }, [highlightedQuestionId, interviewQuestions]);

  const handleCodeEditorMount = useCallback(
    (editor: MonacoEditor.IStandaloneCodeEditor) => {
      codeEditorRef.current = editor;
      codeHighlightRef.current = editor.createDecorationsCollection();
      applyCodeHighlight();
    },
    [applyCodeHighlight]
  );

  const clearAudioPlayback = useCallback(() => {
    window.speechSynthesis.cancel();
  }, []);

  const stopSpeaking = useCallback(() => {
    playbackRequestIdRef.current += 1;
    clearAudioPlayback();
    setSpeakingMessageId(null);
  }, [clearAudioPlayback]);

  const speakQuestionMessage = useCallback(
    async (message: ChatMessage) => {
      if (!message.qid) return;

      const question = interviewQuestions.find((item) => item.qid === message.qid);
      const speakableText = getSpeakableQuestionText(message.text, question);
      if (!speakableText) return;

      stopSpeaking();
      const requestId = playbackRequestIdRef.current;
      setVoiceError(null);
      setSpeakingMessageId(message.id);

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
    [interviewQuestions, stopSpeaking]
  );

  const handleReplayQuestion = useCallback(() => {
    const latestQuestion = [...messages]
      .reverse()
      .find((message) => message.sender === "ai" && Boolean(message.qid));

    if (!latestQuestion) return;

    spokenMessageIdsRef.current.add(latestQuestion.id);
    setVoiceModeEnabled(true);
    void speakQuestionMessage(latestQuestion);
  }, [messages, speakQuestionMessage]);

  const cancelRecognition = useCallback(() => {
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    recognitionStartTimeRef.current = null;
  }, []);

  const startRecording = useCallback(() => {
    if (isAiTyping || interviewComplete || startError || recordingState !== "idle") return;

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
  }, [interviewComplete, isAiTyping, recordingState, startError]);

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

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiTyping, scrollToBottom]);

  useEffect(() => {
    if (!voiceModeEnabled) {
      stopSpeaking();
      return;
    }

    const latestQuestion = [...messages]
      .reverse()
      .find((message) => message.sender === "ai" && Boolean(message.qid));

    if (!latestQuestion || spokenMessageIdsRef.current.has(latestQuestion.id)) {
      return;
    }

    spokenMessageIdsRef.current.add(latestQuestion.id);
    void speakQuestionMessage(latestQuestion);
  }, [messages, speakQuestionMessage, stopSpeaking, voiceModeEnabled]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(applyCodeHighlight);
    return () => window.cancelAnimationFrame(frameId);
  }, [applyCodeHighlight]);

  useEffect(() => {
    return () => {
      codeHighlightRef.current?.clear();
      codeHighlightRef.current = null;
      codeEditorRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      stopSpeaking();
      cancelRecognition();
    };
  }, [cancelRecognition, stopSpeaking]);

  // Fetch problem and check session status
  useEffect(() => {
    if (!id) return;

    // Check progression status to block backward navigation
    api.get<{ status: string; sessionId?: string; submissionId?: string }>(`/interviews/session-status/${id}`)
      .then((res) => {
        if (res.status === "none") {
          navigate(`/problems/${id}/solve`, { replace: true });
        } else if (res.status === "interview_completed") {
          navigate(`/problems/${id}/report`, { replace: true });
        } else {
          // Status is coding_completed or interview_in_progress
          if (res.submissionId && !submissionId) {
            setSubmissionId(res.submissionId);
          }
          Promise.all([
            !problem ? api.get<Problem>(`/problems/${id}`) : Promise.resolve(problem),
            api.get(`/settings?problemId=${id}`)
          ])
            .then(([probData, settingsData]: [any, any]) => {
              if (!problem) setProblem(probData);
              if (settingsData?.timers?.interviewTimer) {
                setTimeLeft(settingsData.timers.interviewTimer * 60);
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
  }, [id, navigate, problem, submissionId]);

  const hasStartedRef = useRef(false);

  // Start interview with welcome + first question
  useEffect(() => {
    if (!hasUserStarted) return;
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const startInterview = async () => {
      if (!submissionId) {
        setStartError("Missing submission details. Please return to Round 1 and proceed again.");
        setConnectingToInterviewer(false);
        return;
      }
      setConnectingToInterviewer(true);
      setIsAiTyping(true);
      setStartError(null);
      try {
        const sess = await api.post<InterviewSession>("/interviews/start", { submissionId });
        setSession(sess);
        // The backend is the source of truth for progression; keep only the active
        // path rather than allowing the client to advance through a fixed list.
        setInterviewQuestions(sess.questions?.slice(0, 1) || []);

        await delay(1200);
        addAiMessage(AI_WELCOME);
        setConnectingToInterviewer(false);
        setIsAiTyping(true);
        await delay(2000);

        if (sess.questions && sess.questions.length > 0) {
          const firstQuestion = sess.questions[0];
          addAiMessage(getQuestionPromptText(firstQuestion), firstQuestion.qid);
          setHighlightedQuestionId(firstQuestion.qid);
          if (isUnavailableSubmittedCodeQuestion(firstQuestion)) {
            setStartError("This interview has a malformed submitted-code question. Please restart the interview.");
            setInterviewComplete(true);
            return;
          }
          if (firstQuestion.code_line_start) {
            setLeftTab("code");
          }
        } else {
          addAiMessage("Question generation did not return a usable interview set. Please retry after confirming the API key and backend generation logs.");
          setStartError("Question generation returned no usable questions.");
          setInterviewComplete(true);
        }
      } catch (err: unknown) {
        console.error("Failed to start interview:", err);
        setStartError("Server error. Unable to start the interview.");
        setConnectingToInterviewer(false);
        setIsAiTyping(false);
      }
    };

    startInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUserStarted]);

  function addAiMessage(text: string, qid?: string, isCompletion?: boolean) {
    console.log("AI MESSAGE:", text);
    setMessages((prev) => [
      ...prev,
      {
        id: `ai-${Date.now()}-${Math.random()}`,
        sender: "ai",
        text,
        timestamp: new Date(),
        qid,
        isCompletion,
      },
    ]);
    setIsAiTyping(false);
    playSound("notification/notification").catch((err) => console.error("Failed to play message sound:", err));
  }

  function addUserMessage(text: string, qid?: string, hideAnswer = false) {
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: "user",
        text,
        timestamp: new Date(),
        qid,
        isAnswerHidden: hideAnswer,
      },
    ]);
  }

  const handleSend = async () => {
    const confirmedAnswer = inputValue.trim();
    const hasVoiceAnswer = Boolean(pendingVoiceReceipt);

    if (
      !confirmedAnswer ||
      isAiTyping ||
      isSubmitting ||
      interviewComplete ||
      !session ||
      recordingState !== "idle"
    ) {
      return;
    }

    const activeQuestion = interviewQuestions.at(-1);

    if (!activeQuestion) {
      console.error("No active question found.");
      return;
    }

    const qid = activeQuestion.qid;

    setIsAiTyping(true);
    setIsSubmitting(true);

    try {
      console.log("========== SUBMIT ANSWER ==========");
      console.log("Submitting QID:", qid);

      const result = await api.post<InterviewAnswerResponse>(
        `/interviews/${session._id}/answer`,
        {
          qid,
          answer: confirmedAnswer,
        }
      );

      console.log("API RESPONSE:", result);
      console.log("Acknowledged:", result.acknowledged);
      console.log("Complete:", result.complete);
      console.log("Next Question:", result.nextQuestion);

      addUserMessage(confirmedAnswer, qid);

      setInputValue("");
      setPendingVoiceReceipt(null);

      if (!result.acknowledged) {
        console.log("Backend did not acknowledge answer.");

        addAiMessage(
          result.message ||
          "Please answer the current question or type Skip.",
          qid
        );

        if (result.interviewState?.terminated || result.complete) {
          setInterviewComplete(true);
          await handleSubmitForEvaluation(userAnswers);
        }

        return;
      }

      const updatedUserAnswers = [
        ...userAnswers.filter((saved) => saved.qid !== qid),
        {
          qid,
          answer: confirmedAnswer,
          answerType: (hasVoiceAnswer ? "voice" : "typed") as "typed" | "voice",
        },
      ];
      setUserAnswers(updatedUserAnswers);

      setHighlightedQuestionId(null);

      if (result.contradictions?.length) {
        console.log("Contradictions detected.");

        addAiMessage(
          `Earlier you said ${result.contradictions[0].earlier}. Can you explain why your answer changed?`
        );
      }

      if (result.complete || result.interviewState?.terminated) {
        console.log("Interview completed.");

        addAiMessage(
          "Thank you. The interview is complete and ready for evaluation.",
          undefined,
          true
        );

        setInterviewComplete(true);
        await handleSubmitForEvaluation(updatedUserAnswers);

        return;
      }

      if (!result.nextQuestion) {
        console.error(
          "Backend returned acknowledged=true but nextQuestion is null."
        );

        addAiMessage(
          "An internal error occurred. The interviewer could not load the next question."
        );

        return;
      }

      if (
        result.acknowledged === true &&
        result.advance === true &&
        result.complete === false &&
        result.nextQuestion
      ) {
        if (result.acknowledgment) {
          addAiMessage(result.acknowledgment);
          await delay(800);
        }

        const next = (result.nextQuestion as any)?._doc ?? result.nextQuestion;
        console.log("Appending next question:", next);

        setInterviewQuestions((previous) => {
          const exists = previous.some((q) => q.qid === next.qid);
          if (exists) return previous;
          return [...previous, next];
        });

        setHighlightedQuestionId(next.qid);

        if (next.code_line_start) {
          setLeftTab("code");
        }

        await delay(450);

        console.log("Displaying next question.");

        addAiMessage(getQuestionPromptText(next), next.qid);
      }

      console.log("========== END ==========");

    } catch (err) {

      console.error("SUBMIT FAILED");
      console.error(err);

      setStartError(
        err instanceof Error
          ? err.message
          : "Unable to submit this answer."
      );

    } finally {
      setIsAiTyping(false);
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSubmitForEvaluation = async (finalAnswers?: typeof userAnswers) => {
    if (!session) return;
    setSubmittingEvaluation(true);
    setEvaluationError(null);
    try {
      await api.post(`/interviews/${session._id}/complete`, { answers: finalAnswers || userAnswers });
      navigate(`/problems/${id}/report`, {
        state: {
          problem,
          code: submittedCode,
          chatTranscript: messages,
          sessionId: session._id,
        },
      });
    } catch (err: unknown) {
      console.error(err);
      setEvaluationError(
        err instanceof Error
          ? err.message
          : "An error occurred during evaluation. Please try again."
      );
      setSubmittingEvaluation(false);
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

  if (connectingToInterviewer) {
    if (!hasUserStarted) {
      return (
        <div className="h-[calc(100vh-64px)] bg-background flex flex-col items-center justify-center text-center p-6">
          <div className="relative mb-6">
            <Avatar className="h-24 w-24 border border-border shadow-sm">
              <AvatarImage src={interviewerAvatar} alt={INTERVIEWER_NAME} />
              <AvatarFallback className="bg-slate-200 text-xl font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                DM
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-background bg-emerald-500" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl mb-3">
            Ready to begin?
          </h1>
          <p className="max-w-md text-sm leading-6 text-muted-foreground mb-8">
            Ensure your microphone is connected and your volume is up.
          </p>
          <Button size="lg" onClick={async () => {
            await initAudio();
            setHasUserStarted(true);
          }}>
            Start Interview
          </Button>
        </div>
      );
    }
    return <ConnectingToInterviewerScreen problemTitle={problem.title} />;
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top Bar */}
      <div className="h-12 border-b border-border bg-muted/30 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Round 2</span>
            <span className="text-muted-foreground text-sm">— Technical Interview</span>
          </div>
          <Separator orientation="vertical" className="h-5" />
          <h2 className="font-semibold text-sm">{problem.title}</h2>
          <Badge variant="outline" className={`${difficultyColors[problem.difficulty]} text-xs`}>
            {problem.difficulty}
          </Badge>
          <Badge
            variant={timeLeft <= 120 ? "destructive" : "outline"}
            className={`ml-4 ${timeLeft <= 120 ? "bg-red-500 text-white animate-pulse" : ""}`}
          >
            <Clock className="w-3 h-3 mr-1" />
            Time left: {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:{String(timeLeft % 60).padStart(2, "0")}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant={voiceModeEnabled ? "secondary" : "ghost"}
            onClick={() => setVoiceModeEnabled((enabled) => !enabled)}
            title={voiceModeEnabled ? "Turn off question voice" : "Turn on question voice"}
            aria-label={voiceModeEnabled ? "Turn off question voice" : "Turn on question voice"}
          >
            {voiceModeEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={handleReplayQuestion}
            disabled={!messages.some((message) => message.sender === "ai" && Boolean(message.qid))}
            title="Replay latest question"
            aria-label="Replay latest question"
          >
            {speakingMessageId ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* 2-Panel Layout */}
      <div className="flex-1 flex overflow-hidden" ref={containerRef}>

        {/* LEFT: Problem / Code (toggled) */}
        <div style={{ width: `${leftWidth}%` }} className="flex-shrink-0 flex flex-col min-h-0">
          <div className="h-10 px-3 border-b border-border bg-muted/20 flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setLeftTab("problem")}
              className={`h-7 px-3 rounded-md text-xs font-medium transition-colors ${leftTab === "problem"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <FileText className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
              Problem
            </button>
            <button
              onClick={() => setLeftTab("code")}
              className={`h-7 px-3 rounded-md text-xs font-medium transition-colors ${leftTab === "code"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <Code2 className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
              Your Submission
            </button>
            {leftTab === "code" && (
              <Badge variant="outline" className="text-[10px] ml-auto font-mono">Read Only</Badge>
            )}
          </div>

          {/* Problem view */}
          {leftTab === "problem" && (
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
          )}

          {/* Code view */}
          {leftTab === "code" && (
            <div className="flex-1 min-h-0 overflow-hidden">
              <Editor
                height="100%"
                language="java"
                value={submittedCode || "// No code submitted"}
                theme={monacoTheme}
                onMount={handleCodeEditorMount}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  padding: { top: 16, bottom: 16 },
                  renderLineHighlight: "none",
                  automaticLayout: true,
                  domReadOnly: true,
                  scrollbar: {
                    vertical: "visible",
                    horizontal: "visible",
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  },
                }}
              />
            </div>
          )}
        </div>

        {/* Horizontal drag handle */}
        <div
          onMouseDown={startDragH}
          className="w-1.5 flex-shrink-0 cursor-col-resize group flex items-center justify-center hover:bg-primary/20 active:bg-primary/30 transition-colors z-10 border-x border-border"
          title="Drag to resize"
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
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col animate-message-in group ${msg.sender === "user" ? "items-end" : "items-start"
                    }`}
                >
                  <div className={`flex items-center gap-1 ${msg.sender === "user" ? "justify-end" : ""}`}>
                    <div
                      className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${msg.sender === "ai"
                          ? "chat-bubble-ai bg-muted/60 text-foreground"
                          : "chat-bubble-user bg-[oklch(0.58_0.18_145)] text-white"
                        }`}
                    >
                      <>
                        {msg.sender === "ai" ? (
                          <InterviewQuestionContent
                            text={msg.text}
                            question={interviewQuestions.find((question) => question.qid === msg.qid)}
                          />
                        ) : (
                          <span>{msg.isAnswerHidden ? "Answer recorded" : msg.text}</span>
                        )}
                        {msg.isCompletion && (
                          <div className="mt-3 space-y-2.5 flex flex-col items-start">
                            <p className="text-md leading-relaxed">
                              Your recorded answers will be visible in the final report.
                            </p>
                            {evaluationError && (
                              <p className="text-xs text-red-500 font-medium">
                                {evaluationError}
                              </p>
                            )}
                            <Button
                              size="sm"
                              disabled={submittingEvaluation}
                              onClick={() => handleSubmitForEvaluation()}
                              className="w-fit bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white shadow-sm text-xs font-semibold gap-1.5 px-4"
                              id="evaluate-chat-btn"
                            >
                              {submittingEvaluation ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Evaluating...
                                </>
                              ) : (
                                <>
                                  <BookOpenCheck className="w-3.5 h-3.5" />
                                  Evaluate
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </>
                    </div>
                  </div>
                  <p className={`text-[10px] mt-1 ${msg.sender === "ai" ? "text-muted-foreground" : "text-muted-foreground"
                    }`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}

              {startError && (
                <div
                  role="alert"
                  className="flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400"
                >
                  <ServerCrash className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{startError}</span>
                </div>
              )}

              {/* Typing Indicator */}
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
            {interviewComplete ? (
              <div className="flex items-center justify-center h-10 text-muted-foreground text-xs font-medium bg-muted/20 border border-dashed border-border rounded-lg">
                Interview completed. Recorded answers will appear in the report.
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
                        ? "Interview unavailable"
                        : recordingState === "recording"
                          ? "Listening..."
                          : recordingState === "transcribing"
                            ? "Transcribing..."
                            : pendingVoiceReceipt
                              ? "Review the transcript before sending..."
                              : isAiTyping
                                ? "Wait for the interviewer..."
                                : "Type or speak your answer..."
                    }
                    disabled={isAiTyping || Boolean(startError) || recordingState === "transcribing"}
                    className="flex-1 h-10 px-4 rounded-full border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    id="chat-input"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant={recordingState === "recording" ? "destructive" : "outline"}
                    onClick={recordingState === "recording" ? stopRecording : startRecording}
                    disabled={isAiTyping || Boolean(startError) || recordingState === "transcribing"}
                    className="h-10 w-10 rounded-full shadow-sm disabled:opacity-40"
                    title={recordingState === "recording" ? "Stop recording" : "Record answer"}
                    aria-label={recordingState === "recording" ? "Stop recording" : "Record answer"}
                    id="record-answer-btn"
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
                      Boolean(startError) ||
                      recordingState !== "idle"
                    }
                    className="h-10 w-10 rounded-full bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white shadow-md disabled:opacity-40"
                    id="send-message-btn"
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ConnectingToInterviewerScreen({ problemTitle }: { problemTitle: string }) {
  return (
    <div className="h-[calc(100vh-64px)] bg-background">
      <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-6 text-center">
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
          Round 2
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Connecting to interviewer
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          Preparing your personalized technical interview for {problemTitle}.
        </p>

        <div className="mt-8 w-full max-w-md space-y-3 text-left">
          {[
            "Checking your Round 1 submission",
            "Preparing benchmark Java questions",
            "Generating code-specific follow-ups",
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
    </div>
  );
}

function InterviewQuestionContent({
  text,
  question,
}: {
  text: string;
  question?: InterviewQuestion;
}) {
  const display = getQuestionDisplay(text, question);

  if (!display.code) {
    return <>{display.prompt}</>;
  }

  return (
    <div className="space-y-3 whitespace-normal">
      <JavaCodeBlock code={display.code} lineLabel={display.lineLabel} code_line_start={display.code_line_start} code_line_end={display.code_line_end} />
      <p className="whitespace-pre-wrap">{display.prompt}</p>
    </div>
  );
}

function JavaCodeBlock({ code, lineLabel, code_line_start, code_line_end }: { code: string; lineLabel?: string; code_line_start?: number; code_line_end?: number }) {
  const codeLines = code.split("\n");
  const hasLineNumbers = code_line_start !== undefined && code_line_start > 0;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-300">
          Java
        </span>
        <div className="flex items-center gap-2">
          {lineLabel && (
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {lineLabel}
            </span>
          )}
          {hasLineNumbers && (
            <span className="text-[9px] text-slate-400 dark:text-slate-500">
              (See highlighted in editor →)
            </span>
          )}
        </div>
      </div>
      <pre className="overflow-x-auto bg-slate-50 dark:bg-slate-950">
        <code className="font-mono block text-xs leading-5">
          {codeLines.map((line, idx) => {
            const absoluteLineNumber = code_line_start ? code_line_start + idx : idx + 1;
            const isHighlighted = hasLineNumbers && code_line_start && code_line_end && absoluteLineNumber >= code_line_start && absoluteLineNumber <= code_line_end;

            return (
              <div
                key={idx}
                className={`px-3 py-0.5 ${isHighlighted
                    ? "bg-amber-100/50 dark:bg-amber-900/20 border-l-2 border-amber-500"
                    : ""
                  }`}
              >
                {hasLineNumbers && (
                  <span className="inline-block w-8 pr-3 text-right text-slate-400 dark:text-slate-500 select-none">
                    {absoluteLineNumber}
                  </span>
                )}
                <span className="inline">{highlightJava(line)}</span>
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
}

function getQuestionDisplay(text: string, question?: InterviewQuestion): QuestionDisplay {
  if (isUnavailableSubmittedCodeQuestion(question)) {
    return { code: null, prompt: UNAVAILABLE_CODE_QUESTION_MESSAGE };
  }

  const codeSnippet = question?.code_anchor?.trim() || question?.code_snippet?.trim();

  if (codeSnippet) {
    const promptSeparator = text.indexOf("\n\n");
    const prompt = promptSeparator >= 0 ? text.slice(promptSeparator + 2).trim() : text.trim();

    return {
      code: codeSnippet,
      prompt,
      lineLabel: question ? formatLineLabel(question) : undefined,
      code_line_start: question?.code_line_start,
      code_line_end: question?.code_line_end,
    };
  }

  return splitInlineJavaQuestion(text);
}

function getSpeakableQuestionText(text: string, question?: InterviewQuestion): string {
  const display = getQuestionDisplay(text, question);
  const parts = [
    display.code && display.lineLabel ? `${display.lineLabel}.` : "",
    display.prompt,
  ];

  return parts
    .join(" ")
    .replace(/`{1,3}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitInlineJavaQuestion(text: string): QuestionDisplay {
  const codePrefix = /^Code:\s*/;
  if (!codePrefix.test(text)) {
    return { code: null, prompt: text };
  }

  const content = text.replace(codePrefix, "");
  const questionStart = /\s+(What|How|Why|When|Where|Which|Is|Are|Does|Do|Can|Will|If)\b/g;
  let match: RegExpExecArray | null;

  while ((match = questionStart.exec(content)) !== null) {
    const possibleCode = content.slice(0, match.index).trim();
    if (/[;}]\s*$/.test(possibleCode)) {
      return {
        code: possibleCode,
        prompt: content.slice(match.index).trim(),
      };
    }
  }

  return { code: null, prompt: text };
}

function formatLineLabel(question: InterviewQuestion): string | undefined {
  if (!question.code_line_start) return undefined;
  if (!question.code_line_end || question.code_line_end === question.code_line_start) {
    return `Line ${question.code_line_start}`;
  }
  return `Lines ${question.code_line_start}-${question.code_line_end}`;
}

function highlightJava(code: string) {
  const tokenPattern =
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\/|\b(?:abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|if|implements|import|instanceof|int|interface|long|native|new|null|package|private|protected|public|record|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|var|void|volatile|while|true|false)\b|\b\d+(?:\.\d+)?\b)/g;

  return code.split(tokenPattern).map((token, index) => {
    if (!token) return null;

    const className = /^["']/.test(token)
      ? "text-emerald-700 dark:text-emerald-300"
      : /^(\/\/|\/\*)/.test(token)
        ? "text-slate-500 italic dark:text-slate-400"
        : /^\d/.test(token)
          ? "text-sky-700 dark:text-sky-300"
          : "text-violet-700 dark:text-violet-300";

    return (
      <span className={className} key={`${token}-${index}`}>
        {token}
      </span>
    );
  });
}
