import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { QuillEditor } from "@/components/QuillEditor";
import { ArrowLeft, Plus, Trash2, Save, Eye, Loader2, Clock, BrainCircuit } from "lucide-react";
import Editor from "@monaco-editor/react";
import { api, type Difficulty } from "@/lib/api";

interface TestCaseLocal {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
}

export function CreateProblemPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [description, setDescription] = useState("");
  const [constraints, setConstraints] = useState("");
  const [sampleInput, setSampleInput] = useState("");
  const [sampleOutput, setSampleOutput] = useState("");
  const [testCases, setTestCases] = useState<TestCaseLocal[]>([{ input: "", expectedOutput: "", isHidden: false }]);
  const [boilerplate, setBoilerplate] = useState(
    `import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your code here\n        \n        sc.close();\n    }\n}`
  );
  const [activeTab, setActiveTab] = useState("editor");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Timing & Questions Limits Configuration
  const [timeConfig, setTimeConfig] = useState({
    preCodeAssessmentTimer: 15,
    codingTestTimer: 60,
    interviewTimer: 30,
  });
  const [questionsConfig, setQuestionsConfig] = useState({
    preCodeMaxQuestions: 7,
    postCodeMaxQuestions: 10,
  });

  // Fetch global settings to initialize defaults if creating new problem
  useEffect(() => {
    if (!id) {
      api.get<any>("/settings")
        .then((res) => {
          if (res?.timers) {
            setTimeConfig({
              preCodeAssessmentTimer: res.timers.preCodeAssessmentTimer ?? 15,
              codingTestTimer: res.timers.codingTestTimer ?? 60,
              interviewTimer: res.timers.interviewTimer ?? 30,
            });
          }
          setQuestionsConfig({
            preCodeMaxQuestions: res?.preCodeMaxQuestions ?? 7,
            postCodeMaxQuestions: res?.postCodeMaxQuestions ?? 10,
          });
        })
        .catch(() => {});
    }
  }, [id]);

  // Fetch existing problem if editing
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<any>(`/problems/${id}`)
      .then((problem) => {
        setTitle(problem.title);
        setDifficulty(problem.difficulty);
        setDescription(problem.description);
        setConstraints(problem.constraints);
        setSampleInput(problem.sampleInput);
        setSampleOutput(problem.sampleOutput);
        setTestCases(
          problem.testCases.map((tc: any) => ({ input: tc.input, expectedOutput: tc.expectedOutput, isHidden: tc.isHidden }))
        );
        setBoilerplate(problem.boilerplate);
        if (problem.timeConfig) {
          setTimeConfig({
            preCodeAssessmentTimer: problem.timeConfig.preCodeAssessmentTimer ?? 15,
            codingTestTimer: problem.timeConfig.codingTestTimer ?? 60,
            interviewTimer: problem.timeConfig.interviewTimer ?? 30,
          });
        }
        if (problem.questionsConfig) {
          setQuestionsConfig({
            preCodeMaxQuestions: problem.questionsConfig.preCodeMaxQuestions ?? 7,
            postCodeMaxQuestions: problem.questionsConfig.postCodeMaxQuestions ?? 10,
          });
        }
      })
      .catch((err) => console.error("Failed to fetch problem:", err))
      .finally(() => setLoading(false));
  }, [id]);

  const addTestCase = () => {
    setTestCases([...testCases, { input: "", expectedOutput: "", isHidden: false }]);
  };

  const removeTestCase = (index: number) => {
    if (testCases.length > 1) {
      setTestCases(testCases.filter((_, i) => i !== index));
    }
  };

  const updateTestCase = (index: number, field: "input" | "expectedOutput" | "isHidden", value: string | boolean) => {
    setTestCases(testCases.map((tc, i) => (i === index ? { ...tc, [field]: value } : tc)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title,
        difficulty,
        description,
        constraints,
        sampleInput,
        sampleOutput,
        testCases,
        boilerplate,
        timeConfig: {
          preCodeAssessmentTimer: Number(timeConfig.preCodeAssessmentTimer),
          codingTestTimer: Number(timeConfig.codingTestTimer),
          interviewTimer: Number(timeConfig.interviewTimer),
        },
        questionsConfig: {
          preCodeMaxQuestions: Number(questionsConfig.preCodeMaxQuestions),
          postCodeMaxQuestions: Number(questionsConfig.postCodeMaxQuestions),
        },
      };

      if (isEdit) {
        await api.put(`/problems/${id}`, payload);
      } else {
        await api.post("/problems", payload);
      }
      navigate("/admin/problems");
    } catch (err) {
      console.error("Failed to save problem:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/problems")} className="rounded-full" id="back-btn">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {isEdit ? "Edit Problem" : "Create Problem"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate("/admin/problems")} id="cancel-btn">
            Cancel
          </Button>
          <Button
            className="bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white shadow-lg shadow-[oklch(0.58_0.18_145)]/20"
            onClick={handleSave}
            disabled={saving}
            id="save-problem-btn"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {isEdit ? "Update" : "Publish"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="editor" className="gap-2">
            <Save className="w-3.5 h-3.5" />
            Editor
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="w-3.5 h-3.5" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-6 mt-6">
          {/* Basic info */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="problem-title">Problem Title</Label>
                  <Input
                    id="problem-title"
                    placeholder="e.g., Two Sum"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="problem-difficulty">Difficulty</Label>
                  <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                    <SelectTrigger className="h-11" id="problem-difficulty">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Easy">🟢 Easy</SelectItem>
                      <SelectItem value="Medium">🟡 Medium</SelectItem>
                      <SelectItem value="Hard">🔴 Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assessment & Interview Timing and Question Configuration */}
          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base">Assessment & Interview Configuration (Optional Overrides)</CardTitle>
                </div>
                <Badge variant="outline" className="text-[11px] font-normal">
                  Defaults to Global Settings
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Configure default round durations (5 to 60 min) and maximum question limits (2 to 15) for this assessment. Faculty can also customize these per student upon assignment.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="timer-precode" className="text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    Round 1: Pre-Code Timer (min)
                  </Label>
                  <Input
                    id="timer-precode"
                    type="number"
                    min={5}
                    max={60}
                    value={timeConfig.preCodeAssessmentTimer}
                    onChange={(e) => setTimeConfig({ ...timeConfig, preCodeAssessmentTimer: Number(e.target.value) })}
                    className="h-10"
                  />
                  <span className="text-[10px] text-muted-foreground">Range: 5 - 60 minutes</span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="timer-coding" className="text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    Round 2: Coding Sandbox Timer (min)
                  </Label>
                  <Input
                    id="timer-coding"
                    type="number"
                    min={5}
                    max={60}
                    value={timeConfig.codingTestTimer}
                    onChange={(e) => setTimeConfig({ ...timeConfig, codingTestTimer: Number(e.target.value) })}
                    className="h-10"
                  />
                  <span className="text-[10px] text-muted-foreground">Range: 5 - 60 minutes</span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="timer-interview" className="text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    Round 3: Interview Timer (min)
                  </Label>
                  <Input
                    id="timer-interview"
                    type="number"
                    min={5}
                    max={60}
                    value={timeConfig.interviewTimer}
                    onChange={(e) => setTimeConfig({ ...timeConfig, interviewTimer: Number(e.target.value) })}
                    className="h-10"
                  />
                  <span className="text-[10px] text-muted-foreground">Range: 5 - 60 minutes</span>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="q-precode" className="text-xs flex items-center gap-1.5">
                    <BrainCircuit className="w-3.5 h-3.5 text-muted-foreground" />
                    Pre-Code Interview Max Questions
                  </Label>
                  <Input
                    id="q-precode"
                    type="number"
                    min={2}
                    max={15}
                    value={questionsConfig.preCodeMaxQuestions}
                    onChange={(e) => setQuestionsConfig({ ...questionsConfig, preCodeMaxQuestions: Number(e.target.value) })}
                    className="h-10"
                  />
                  <span className="text-[10px] text-muted-foreground">Allowed: 2 - 15 questions</span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="q-postcode" className="text-xs flex items-center gap-1.5">
                    <BrainCircuit className="w-3.5 h-3.5 text-muted-foreground" />
                    Post-Code Interview Max Questions
                  </Label>
                  <Input
                    id="q-postcode"
                    type="number"
                    min={2}
                    max={15}
                    value={questionsConfig.postCodeMaxQuestions}
                    onChange={(e) => setQuestionsConfig({ ...questionsConfig, postCodeMaxQuestions: Number(e.target.value) })}
                    className="h-10"
                  />
                  <span className="text-[10px] text-muted-foreground">Allowed: 2 - 15 questions</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Description - Quill Editor */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Problem Description</CardTitle>
            </CardHeader>
            <CardContent>
              <QuillEditor
                value={description}
                onChange={setDescription}
                placeholder="Describe the problem, include examples, and explain expected behavior..."
              />
            </CardContent>
          </Card>

          {/* Constraints */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Constraints</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder={"e.g., 1 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9"}
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                rows={4}
                className="font-mono text-sm"
                id="problem-constraints"
              />
            </CardContent>
          </Card>

          {/* Sample I/O */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Sample Input / Output</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sample-input">Sample Input</Label>
                  <Textarea
                    id="sample-input"
                    placeholder="Enter sample input..."
                    value={sampleInput}
                    onChange={(e) => setSampleInput(e.target.value)}
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sample-output">Sample Output</Label>
                  <Textarea
                    id="sample-output"
                    placeholder="Expected output..."
                    value={sampleOutput}
                    onChange={(e) => setSampleOutput(e.target.value)}
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Test Cases */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Test Cases</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={addTestCase} id="add-test-case-btn">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Test Case
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {testCases.map((tc, index) => (
                <div key={index} className="space-y-3">
                  {index > 0 && <Separator />}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Test Case {index + 1}</span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`tc-hidden-${index}`} className="text-xs text-muted-foreground">
                          Hidden from Candidates
                        </Label>
                        <Switch
                          id={`tc-hidden-${index}`}
                          checked={tc.isHidden}
                          onCheckedChange={(checked) => updateTestCase(index, "isHidden", checked)}
                        />
                      </div>
                      {testCases.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeTestCase(index)} className="text-destructive hover:text-destructive h-7 px-2" id={`remove-tc-${index}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Textarea
                      placeholder="Input"
                      value={tc.input}
                      onChange={(e) => updateTestCase(index, "input", e.target.value)}
                      rows={3}
                      className="font-mono text-sm"
                      id={`tc-input-${index}`}
                    />
                    <Textarea
                      placeholder="Expected Output"
                      value={tc.expectedOutput}
                      onChange={(e) => updateTestCase(index, "expectedOutput", e.target.value)}
                      rows={3}
                      className="font-mono text-sm"
                      id={`tc-output-${index}`}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Boilerplate Code */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Initial Code Template (Java)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg overflow-hidden border border-border">
                <Editor
                  height="250px"
                  language="java"
                  value={boilerplate}
                  onChange={(v) => setBoilerplate(v || "")}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', monospace",
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    padding: { top: 16 },
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{title || "Untitled Problem"}</CardTitle>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  difficulty === "Easy" ? "bg-emerald-500/15 text-emerald-500" :
                  difficulty === "Medium" ? "bg-amber-500/15 text-amber-500" :
                  "bg-red-500/15 text-red-500"
                }`}>
                  {difficulty}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: description || "<p class='text-muted-foreground'>No description yet...</p>" }} />

              {constraints && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Constraints:</h3>
                    <pre className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg whitespace-pre-wrap">{constraints}</pre>
                  </div>
                </>
              )}

              {(sampleInput || sampleOutput) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Sample Input:</h3>
                      <pre className="text-sm bg-muted/50 p-3 rounded-lg font-mono">{sampleInput || "—"}</pre>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Sample Output:</h3>
                      <pre className="text-sm bg-muted/50 p-3 rounded-lg font-mono">{sampleOutput || "—"}</pre>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
