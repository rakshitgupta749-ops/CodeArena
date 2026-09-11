import Editor from "@monaco-editor/react";
import { useMonacoTheme } from "@/hooks/useMonacoTheme";

interface CodeViewerProps {
  code: string;
  language?: string;
  height?: string;
}

export function CodeViewer({ code, language = "java", height = "400px" }: CodeViewerProps) {
  const monacoTheme = useMonacoTheme();

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <Editor
        height={height}
        language={language}
        value={code}
        theme={monacoTheme}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', monospace",
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          padding: { top: 16 },
          renderLineHighlight: "none",
        }}
      />
    </div>
  );
}
