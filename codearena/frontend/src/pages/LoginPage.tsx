import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Code2, Eye, EyeOff, Loader2 } from "lucide-react";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "faculty" | "admin">("user");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRoleSelect = (selectedRole: "user" | "faculty" | "admin") => {
    setRole(selectedRole);
    setError("");
    if (selectedRole === "admin") {
      setEmail("admin@code.io");
      setPassword("admin123");
    } else if (selectedRole === "faculty") {
      setEmail("faculty@code.io");
      setPassword("faculty123");
    } else {
      setEmail("user@code.io");
      setPassword("user123");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await login(email, password);
    if (result.success) {
      // Read the stored user to determine role for navigation
      const stored = localStorage.getItem("auth_user");
      const userData = stored ? JSON.parse(stored) : null;
      navigate(userData?.role === "admin" || userData?.role === "faculty" ? "/admin" : "/problems");
    } else {
      setError(result.error || "Invalid credentials. Please try again.");
    }
    setIsLoading(false);
  };

  const getPlaceholderEmail = () => {
    if (role === "admin") return "admin@code.io";
    if (role === "faculty") return "faculty@code.io";
    return "user@code.io";
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Animated Background */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[oklch(0.15_0.05_155)]">
        {/* Floating code snippets */}
        <div className="absolute inset-0">
          <div className="absolute top-[15%] left-[10%] animate-[float_6s_ease-in-out_infinite] opacity-20">
            <div className="glass rounded-xl p-4 text-green-400 font-mono text-sm">
              <pre>{`class Solution {
  public int[] twoSum() {
    // Your code here
  }
}`}</pre>
            </div>
          </div>
          <div className="absolute top-[45%] right-[8%] animate-[float_8s_ease-in-out_infinite_1s] opacity-15">
            <div className="glass rounded-xl p-4 text-blue-400 font-mono text-sm">
              <pre>{`while (left < right) {
  int mid = (left+right)/2;
  if (arr[mid] == target)
    return mid;
}`}</pre>
            </div>
          </div>
          <div className="absolute bottom-[20%] left-[20%] animate-[float_7s_ease-in-out_infinite_2s] opacity-15">
            <div className="glass rounded-xl p-4 text-emerald-400 font-mono text-sm">
              <pre>{`Map<Integer, Integer> map
  = new HashMap<>();
map.put(key, value);`}</pre>
            </div>
          </div>
        </div>

        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[oklch(0.55_0.18_145)] rounded-full blur-[128px] opacity-30 animate-[pulse-glow_4s_ease-in-out_infinite]" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-[oklch(0.50_0.16_165)] rounded-full blur-[96px] opacity-20 animate-[pulse-glow_5s_ease-in-out_infinite_1s]" />

        {/* Branding */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full px-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-[oklch(0.58_0.18_145)] shadow-lg shadow-[oklch(0.58_0.18_145)]/30">
              <Code2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight">
              Code<span className="gradient-text">Arena</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md animate-[fade-in_0.6s_ease-out]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="p-2 rounded-xl bg-[oklch(0.58_0.18_145)]">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold">
              Code<span className="gradient-text">Arena</span>
            </h1>
          </div>

          <Card className="border-border/50 shadow-xl shadow-black/5 dark:shadow-black/20 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <h2 className="text-2xl font-bold tracking-tight">Sign In</h2>
              <p className="text-xs text-muted-foreground mt-1">Select your portal role to continue</p>
            </CardHeader>
            <CardContent>
              {/* Role Toggle - 3 Roles */}
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 mb-6" id="role-toggle">
                <button
                  type="button"
                  onClick={() => handleRoleSelect("user")}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    role === "user"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  id="role-user-btn"
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleSelect("faculty")}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    role === "faculty"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  id="role-faculty-btn"
                >
                  Faculty
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleSelect("admin")}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    role === "admin"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  id="role-admin-btn"
                >
                  Admin
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={getPlaceholderEmail()}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 pr-10 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      id="toggle-password-visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg animate-[slide-down_0.3s_ease-out]" id="login-error">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-medium bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.50_0.16_165)] text-white shadow-lg shadow-[oklch(0.58_0.18_145)]/25 transition-all duration-300 hover:shadow-xl hover:shadow-[oklch(0.58_0.18_145)]/30 hover:scale-[1.02] active:scale-[0.98]"
                  disabled={isLoading}
                  id="login-submit-btn"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    `Sign In as ${role === "user" ? "Student" : role === "faculty" ? "Faculty" : "Admin"}`
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground text-center">
                  Quick demo credentials: <br />
                  <span className="font-mono text-foreground/80 font-medium">
                    {role === "admin"
                      ? "admin@code.io / admin123"
                      : role === "faculty"
                      ? "faculty@code.io / faculty123"
                      : "user@code.io / user123"}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
