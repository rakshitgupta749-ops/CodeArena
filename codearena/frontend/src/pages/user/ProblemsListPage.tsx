import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Code2, Loader2 } from "lucide-react";
import { api, type Problem } from "@/lib/api";

export function ProblemsListPage() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProblems() {
      try {
        const data = await api.get<Problem[]>("/problems");
        setProblems(data);
      } catch (err) {
        console.error("Failed to fetch problems:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProblems();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6 animate-[slide-up_0.5s_ease-out]">
        <h1 className="text-3xl font-bold tracking-tight">Problems</h1>
      </div>

      {/* Problem Cards */}
      <div className="grid gap-4">
        {problems.map((problem, i) => (
          <Card
            key={problem._id}
            className="border-border/50 hover:border-primary/30 transition-all duration-300 cursor-pointer group hover:shadow-lg hover:shadow-primary/5 animate-[slide-up_0.5s_ease-out] [animation-fill-mode:both]"
            style={{ animationDelay: `${150 + i * 80}ms` }}
            onClick={() => navigate(`/problems/${problem._id}/precoding`)}
            id={`problem-card-${problem._id}`}
          >
            <CardContent className="p-5 flex items-center justify-between gap-4">
              {/* Problem info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                  {problem.title}
                </h3>
              </div>

              {/* Arrow */}
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
            </CardContent>
          </Card>
        ))}

        {problems.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Code2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No problems found</p>
          </div>
        )}
      </div>
    </div>
  );
}
