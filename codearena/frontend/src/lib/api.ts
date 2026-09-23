const API_BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getErrorMessage(res: Response): Promise<string> {
  const error = await res.json().catch(() => ({ message: "Request failed" }));
  return error.message || `HTTP ${res.status}`;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    throw new Error(await getErrorMessage(res));
  }

  return res.json();
}

async function requestBlob(endpoint: string, data: unknown): Promise<Blob> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await getErrorMessage(res));
  }

  return res.blob();
}

async function requestAudio<T>(endpoint: string, audio: Blob): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": audio.type || "application/octet-stream",
      ...getAuthHeaders(),
    },
    body: audio,
  });

  if (!res.ok) {
    throw new Error(await getErrorMessage(res));
  }

  return res.json();
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),

  post: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data: unknown) =>
    request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  patch: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: "DELETE" }),

  postBlob: requestBlob,

  postAudio: requestAudio,
};

// --- Type definitions matching backend responses ---

export type Difficulty = "Easy" | "Medium" | "Hard";
export type SubmissionStatus =
  | "Accepted"
  | "Wrong Answer"
  | "Runtime Error"
  | "Compilation Error"
  | "Time Limit Exceeded"
  | "Pending";

export interface TestCase {
  _id?: string;
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
}

export interface Problem {
  _id: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
  testCases: TestCase[];
  boilerplate: string;
  isActive: boolean;
  createdAt: string;
  createdBy?: AuthUser | null;
  submissionCount?: number;
  timeConfig?: {
    preCodeAssessmentTimer?: number;
    codingTestTimer?: number;
    interviewTimer?: number;
  };
  questionsConfig?: {
    preCodeMaxQuestions?: number;
    postCodeMaxQuestions?: number;
  };
}

export interface Submission {
  _id: string;
  user: { _id: string; name: string; email: string };
  problem: { _id: string; title: string };
  code: string;
  language: string;
  status: SubmissionStatus;
  executionTime: string;
  testCaseResults: {
    passed: boolean;
    input?: string;
    expected?: string;
    actual?: string;
    isHidden?: boolean;
  }[];
  submittedAt: string;
}

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "faculty" | "user";
  isActive?: boolean;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface RunCodeResponse {
  status: string;
  results: {
    passed: boolean;
    input?: string;
    expected?: string;
    actual?: string;
    isHidden?: boolean;
  }[];
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
}

export interface SubmitCodeResponse {
  submission: Submission;
  status: string;
  results: {
    passed: boolean;
    input?: string;
    expected?: string;
    actual?: string;
    isHidden?: boolean;
  }[];
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
  attemptsUsed?: number;
  attemptsRemaining?: number;
  maxAttempts?: number;
  currentScore?: number;
  bestScore?: number;
  bestSubmissionId?: string;
  codingPassed?: boolean;
  allHiddenTestsPassed?: boolean;
  canProceedToNextRound?: boolean;
  canContinueCoding?: boolean;
}

export interface InterviewQuestion {
  qid: string;
  dimension: string;
  difficulty: "basic" | "intermediate" | "advanced" | "hard";
  question: string;
  source?: "benchmark_csv" | "submitted_code_llm" | string;
  code_anchor?: string;
  code_snippet?: string;
  code_line_start?: number;
  code_line_end?: number;
  anchor_resolution?: string;
}

export interface InterviewEvaluation {
  final_score: number | null;
  best_breakdown: Record<string, {
    label?: string;
    score: number;
    max: number;
    reason: string;
    issue?: string;
    expected?: string;
  }>;
  teacher_feedback?: {
    what_went_well?: string[];
    what_was_missing?: string[];
    better_answer?: string;
  };
  flag?: string | null;
  flag_reason?: string | null;
  gate_decision: string;
  gate_reason: string;
  confidence: number;
}

export interface InterviewAnswer {
  qid: string;
  answer: string;
  answerType?: "typed" | "voice";
  asrMeta?: {
    engine?: string;
    speech_seconds?: number | null;
    warnings?: string[];
    decision?: string;
    quality?: "high" | "medium" | "low";
  } | null;
  audioPath?: string;
  hasAudio?: boolean;
  evaluation?: InterviewEvaluation;
  answeredAt: string;
}

export interface InterviewSession {
  _id: string;
  user: string;
  submission: Submission | string;
  problem: Problem | string;
  status: "generating" | "in_progress" | "completed" | "failed";
  questions: InterviewQuestion[];
  answers: InterviewAnswer[];
  overallScore: number | null;
  codingScore: number | null;
  interviewScore: number | null;
  codingPassed: boolean;
  interviewPassed: boolean;
  overallPassed: boolean;
  candidateReport?: {
    strengths: string;
    weaknesses: string;
    stars: number;
  } | null;
  feedback: string;
  grade: string;
  startedAt: string;
  completedAt?: string;
  interviewState?: {
    phase: string;
    confidence: "High" | "Medium" | "Low";
    integrityScore: number;
    professionalismScore: number;
    conceptsCovered: string[];
    weakConcepts: string[];
    warningCount: number;
    irrelevantWarningCount?: number;
    unprofessionalWarningCount?: number;
    terminated: boolean;
    terminationType?: string | null;
    terminationReason?: string | null;
    terminationTimestamp?: string | null;
  } | null;
}

export interface InterviewAnswerResponse {
  evaluation?: InterviewEvaluation;
  acknowledged: boolean;
  advance: boolean;
  classification: string;
  message?: string;
  nextQuestion?: InterviewQuestion | null;
  complete?: boolean;
  contradictions?: { topic: string; earlier: string; later: string }[];
  interviewState?: InterviewSession["interviewState"];
  acknowledgment?: string;
}

export interface VoiceTranscriptionResponse {
  text: string;
  status?: "ok" | "warning";
  engine?: string;
  speech_seconds?: number | null;
  warnings?: string[];
}

export interface VoiceTranscript {
  text: string;
}

export interface VoiceStatus {
  piper: {
    configured: boolean;
    binary: boolean;
    model: boolean;
  };
  whisper: {
    engine: string;
    configured: boolean;
    binary: boolean;
    model: boolean;
  };
  fallbacks: {
    tts: string;
    transcription: string;
  };
}

export interface Batch {
  _id: string;
  name: string;
  description: string;
  candidates: AuthUser[];
  createdBy: AuthUser;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  assignmentCount?: number;
}

export interface Assignment {
  _id: string;
  assessment: Problem;
  batch?: Batch | string;
  candidate: AuthUser | string;
  assignedBy: AuthUser;
  assignedAt: string;
  dueDate: string | null;
  status: "Pending" | "In Progress" | "Completed";
  timeConfig?: {
    preCodeAssessmentTimer?: number;
    codingTestTimer?: number;
    interviewTimer?: number;
  };
  questionsConfig?: {
    preCodeMaxQuestions?: number;
    postCodeMaxQuestions?: number;
  };
}

export interface AssessmentDashboardItem {
  _id: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  isActive: boolean;
  createdAt: string;
  createdBy?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  totalTaken: number;
  totalCompleted: number;
  totalPending: number;
  precoding: {
    total: number;
    passed: number;
    failed: number;
    inProgress: number;
    passRate: number;
  };
  coding: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  postcoding: {
    total: number;
    completed: number;
    inProgress: number;
    passed: number;
    failed: number;
    passRate: number;
    avgScore: number;
  };
  overall: {
    passPercentage: number;
    failPercentage: number;
    totalPassed: number;
    totalFailed: number;
  };
}

export interface AssessmentDashboardResponse {
  assessments: AssessmentDashboardItem[];
  total: number;
  page: number;
  pages: number;
}

export interface AssessmentCandidateItem {
  candidate: {
    _id: string;
    name: string;
    email: string;
    isActive: boolean;
    role: string;
  };
  batch: string | null;
  assignment: {
    _id: string;
    assignedAt: string;
    dueDate: string | null;
    status: string;
  } | null;
  precoding: {
    status: string;
    score: number | null;
    completedAt: string | null;
  };
  coding: {
    status: string;
    passed: boolean;
    score: number | null;
    attempts: number;
  };
  postcoding: {
    _id?: string;
    status: string;
    score: number | null;
    passed: boolean;
    completedAt: string | null;
  };
  overallStatus: "Completed" | "In Progress" | "Pending";
  isCompleted: boolean;
  reportId: string | null;
  reportAvailable: boolean;
}

export interface AssessmentCandidatesResponse {
  assessment: Problem;
  candidates: AssessmentCandidateItem[];
  total: number;
  completedCount: number;
  pendingCount: number;
}

