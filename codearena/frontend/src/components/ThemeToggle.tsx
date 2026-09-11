import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" || 
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setIsDark(!isDark)}
      className="relative overflow-hidden rounded-full"
      id="theme-toggle"
    >
      <Sun className={`h-4 w-4 transition-all duration-300 ${isDark ? "rotate-90 scale-0" : "rotate-0 scale-100"}`} />
      <Moon className={`absolute h-4 w-4 transition-all duration-300 ${isDark ? "rotate-0 scale-100" : "-rotate-90 scale-0"}`} />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
