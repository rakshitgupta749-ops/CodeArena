import { useRef, useMemo } from "react";
import ReactQuill, { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

type DeltaOperation = { insert: string };
type DeltaConstructor = new (operations?: DeltaOperation[]) => unknown;
const Delta = Quill.import("delta") as DeltaConstructor;

interface QuillEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}
const formats = [
  "header",
  "bold", "italic", "underline", "strike",
  "list",
  "blockquote", "code-block",
  "link", "image",
  "color", "background",
  "align",
  "indent",
];

export function QuillEditor({ value, onChange, placeholder }: QuillEditorProps) {
  const quillRef = useRef<ReactQuill | null>(null);

  /**
   * Custom clipboard matcher: when plain text is pasted (e.g. from a PDF),
   * convert \n characters into proper Quill line breaks so paragraph
   * structure is preserved.
   */
  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote", "code-block"],
        ["link", "image"],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        ["clean"],
      ],
      clipboard: {
        matchVisual: false,
        matchers: [
          [
            Node.TEXT_NODE,
            (_node: Text) => {
              // Split on newlines and re-join with proper block-level inserts
              const ops: DeltaOperation[] = [];
              const text = _node.data || "";
              const parts = text.split(/\r?\n/);

              parts.forEach((part, i) => {
                if (part.length > 0) {
                  ops.push({ insert: part });
                }
                // Add a newline (block break) between parts, except after the last one
                if (i < parts.length - 1) {
                  ops.push({ insert: "\n" });
                }
              });

              return new Delta(ops);
            },
          ],
        ],
      },
    }),
    []
  );

  return (
    <div className="quill-wrapper rounded-lg overflow-hidden border border-border">
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder || "Write your problem description here..."}
      />
    </div>
  );
}
