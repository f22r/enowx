import { agentApi } from "../../lib/api";

// OpenAI-style tool (function) schemas sent to the model in the request body.
export const TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file in the working directory.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Path relative to the working directory." } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "List files and folders in a directory of the working directory.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Directory path relative to the working directory. Use '.' for the root." } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or overwrite a file with the given content.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path relative to the working directory." },
          content: { type: "string", description: "Full file content to write." },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "Replace a unique snippet in a file with new text. The old string must appear exactly once.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          old: { type: "string", description: "Exact existing text to replace (must be unique in the file)." },
          new: { type: "string", description: "Replacement text." },
        },
        required: ["path", "old", "new"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Run a shell command in the working directory and return stdout/stderr/exit code.",
      parameters: {
        type: "object",
        properties: { command: { type: "string", description: "The shell command to run." } },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "http_request",
      description: "Make an HTTP request to any URL and return the status, headers and body.",
      parameters: {
        type: "object",
        properties: {
          method: { type: "string" },
          url: { type: "string" },
          headers: { type: "object" },
          body: { type: "string" },
        },
        required: ["url"],
      },
    },
  },
];

export type ToolName = "read_file" | "list_dir" | "write_file" | "edit_file" | "run_command" | "http_request";

// Which tools mutate/side-effect (need approval at the "Sedang" level).
export const WRITE_TOOLS = new Set<ToolName>(["write_file", "edit_file", "run_command", "http_request"]);

export type PermLevel = "need" | "medium" | "bypass";

// needsApproval decides whether a tool call must be confirmed before running.
export function needsApproval(level: PermLevel, tool: ToolName): boolean {
  if (level === "bypass") return false;
  if (level === "need") return true;
  return WRITE_TOOLS.has(tool); // medium
}

export interface ToolResult {
  ok: boolean;
  // A short string fed back to the model as the tool result.
  output: string;
  // Extra data for rich rendering (diff, exec output, etc.).
  meta?: Record<string, unknown>;
}

// runTool executes a tool call against the local agent endpoints and returns a
// result string for the model plus meta for the UI.
export async function runTool(cwd: string, tool: ToolName, args: Record<string, unknown>): Promise<ToolResult> {
  try {
    switch (tool) {
      case "read_file": {
        const r = await agentApi.fsRead(cwd, String(args.path ?? ""));
        return { ok: true, output: r.content + (r.truncated ? "\n…(truncated)" : ""), meta: { path: r.path } };
      }
      case "list_dir": {
        const r = await agentApi.fsList(cwd, String(args.path ?? "."));
        const lines = r.entries.map((e) => `${e.is_dir ? "d" : "-"} ${e.name}${e.is_dir ? "/" : ` (${e.size}b)`}`).join("\n");
        return { ok: true, output: lines || "(empty)", meta: { entries: r.entries } };
      }
      case "write_file": {
        const r = await agentApi.fsWrite(cwd, String(args.path ?? ""), String(args.content ?? ""));
        return { ok: true, output: `${r.created ? "Created" : "Wrote"} ${r.path}`, meta: { diff: { path: r.path, old: r.old, new: r.new } } };
      }
      case "edit_file": {
        const r = await agentApi.fsEdit(cwd, String(args.path ?? ""), String(args.old ?? ""), String(args.new ?? ""));
        return { ok: true, output: `Edited ${r.path}`, meta: { diff: { path: r.path, old: r.old, new: r.new } } };
      }
      case "run_command": {
        const r = await agentApi.exec(cwd, String(args.command ?? ""));
        const out = [r.stdout && `stdout:\n${r.stdout}`, r.stderr && `stderr:\n${r.stderr}`, `exit: ${r.exit_code}${r.timed_out ? " (timed out)" : ""}`].filter(Boolean).join("\n");
        return { ok: r.exit_code === 0, output: out, meta: { exec: r } };
      }
      case "http_request": {
        const r = await agentApi.http(String(args.method ?? "GET"), String(args.url ?? ""), (args.headers as Record<string, string>) ?? undefined, args.body ? String(args.body) : undefined);
        return { ok: r.status < 400, output: `HTTP ${r.status}\n${r.body}`, meta: { http: r } };
      }
      default:
        return { ok: false, output: `unknown tool: ${tool}` };
    }
  } catch (e) {
    return { ok: false, output: `error: ${e instanceof Error ? e.message : String(e)}` };
  }
}
