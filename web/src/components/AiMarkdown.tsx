import { memo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";
import { copyText } from "../os/clipboard";

// AiMarkdown renders full GitHub-flavored markdown for the AI chat: headings,
// lists (incl. nested + task lists), tables, blockquotes, links, and fenced code
// blocks with syntax highlighting + a copy button. Separate from the Discord
// subset used by community chat/posts so that surface stays untouched.
export const AiMarkdown = memo(function AiMarkdown({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="ai-md text-sm leading-relaxed text-white/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock as never,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener" className="text-indigo-300 hover:underline">{children}</a>
          ),
          h1: ({ children }) => <h1 className="mb-2 mt-3 text-lg font-bold text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-1.5 mt-3 text-base font-bold text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 mt-2.5 text-sm font-semibold text-white">{children}</h3>,
          p: ({ children }) => <p className="my-1.5">{children}</p>,
          ul: ({ children }) => <ul className="my-1.5 ml-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 ml-5 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="marker:text-white/40">{children}</li>,
          blockquote: ({ children }) => <blockquote className="my-1.5 border-l-2 border-white/25 pl-3 text-white/70">{children}</blockquote>,
          hr: () => <hr className="my-3 border-white/10" />,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          table: ({ children }) => <div className="my-2 overflow-x-auto"><table className="w-full border-collapse text-xs">{children}</table></div>,
          thead: ({ children }) => <thead className="border-b border-white/15 text-left text-white/70">{children}</thead>,
          th: ({ children }) => <th className="px-2 py-1 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b border-white/5 px-2 py-1">{children}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});

// CodeBlock renders inline code plainly and fenced blocks with Prism highlighting
// + a language label and copy button.
function CodeBlock({ inline, className, children }: { inline?: boolean; className?: string; children?: ReactNode }) {
  const code = String(children ?? "").replace(/\n$/, "");
  const lang = /language-(\w+)/.exec(className || "")?.[1];

  // react-markdown v10 doesn't pass `inline`; treat single-line, no-language as inline.
  if (inline || (!lang && !code.includes("\n"))) {
    return <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-[0.85em] text-white/90">{code}</code>;
  }

  return <FencedCode code={code} lang={lang} />;
}

function FencedCode({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    copyText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="my-2 overflow-hidden rounded-lg border border-white/10 bg-[#282c34]">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-1 text-[10px] text-white/40">
        <span className="font-mono">{lang || "text"}</span>
        <button onClick={copy} className="flex items-center gap-1 hover:text-white/80">
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={lang || "text"}
        style={oneDark}
        customStyle={{ margin: 0, background: "transparent", padding: "10px 12px", fontSize: "12px", lineHeight: 1.5 }}
        codeTagProps={{ style: { fontFamily: "ui-monospace, monospace" } }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
