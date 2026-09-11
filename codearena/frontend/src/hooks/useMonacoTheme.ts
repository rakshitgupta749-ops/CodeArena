import { useState, useEffect } from "react";

/**
 * Returns the current Monaco editor theme based on the app's light/dark mode.
 * Watches for changes to the `dark` class on the document root.
 */
export function useMonacoTheme(): "vs" | "vs-dark" {
  const [theme, setTheme] = useState<"vs" | "vs-dark">(() =>
    document.documentElement.classList.contains("dark") ? "vs-dark" : "vs"
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "vs-dark" : "vs");
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}
