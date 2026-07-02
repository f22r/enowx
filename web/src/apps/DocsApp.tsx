import { useEffect, useState } from "react";
import { AppShell } from "./shell";
import { docsApi, type Docs, type DocEndpoint } from "../lib/api";

const METHOD_TONE: Record<string, string> = {
  GET: "text-sky-300 bg-sky-500/10 ring-sky-500/30",
  POST: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/30",
  PATCH: "text-amber-300 bg-amber-500/10 ring-amber-500/30",
  DELETE: "text-red-300 bg-red-500/10 ring-red-500/30",
};

function methodTone(m: string) {
  return METHOD_TONE[m] ?? "text-white/60 bg-white/5 ring-white/15";
}

export function DocsApp() {
  const [docs, setDocs] = useState<Docs | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    docsApi
      .get()
      .then(setDocs)
      .catch((e) => setError(e instanceof Error ? e.message : "failed to load"));
  }, []);

  const tabs = docs
    ? [
        { id: "overview", label: "Overview" },
        { id: "shortcuts", label: "Shortcuts" },
        { id: "plugins", label: "Plugins" },
        ...docs.groups.map((g) => ({ id: g.name, label: g.name })),
      ]
    : [];
  const activeGroup = docs?.groups.find((g) => g.name === tab);

  return (
    <AppShell title="Docs" subtitle="API reference for integrations & plugins">
      {error && <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}
      {!docs ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      ) : (
        <div className="flex h-full flex-col">
          {/* Top navigation: Overview · Plugins · one tab per endpoint group. */}
          <div className="term-tabs -mx-1 mb-3 flex shrink-0 gap-1 overflow-x-auto px-1 pb-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  tab === t.id ? "bg-white/12 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {tab === "overview" && <Overview docs={docs} />}
            {tab === "shortcuts" && <Shortcuts docs={docs} />}
            {tab === "plugins" && <Plugins docs={docs} />}
            {activeGroup && (
              <section>
                <p className="mb-2 text-[11px] text-white/40">{activeGroup.desc}</p>
                <div className="space-y-2">
                  {activeGroup.endpoints.map((e) => (
                    <Endpoint key={e.method + e.path} e={e} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Overview({ docs }: { docs: Docs }) {
  const o = docs.overview;
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-white">{o.name}</h2>
        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/50">v{docs.version}</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-white/55">{o.summary}</p>
      <div className="mt-2.5 space-y-1 text-[11px] text-white/50">
        <Line k="Base URL" v={o.base_url} mono />
        <Line k="OpenAI" v={o.openai_base} mono />
        <Line k="Anthropic" v={o.anthropic_base} mono />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-white/40">{o.auth}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-white/40">{o.envelope}</p>
    </section>
  );
}

function Plugins({ docs }: { docs: Docs }) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3.5">
        <h2 className="text-sm font-semibold text-emerald-200">Plugins</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/55">{docs.plugins.summary}</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">{docs.plugins.discovery}</p>
      </section>
      <PluginSDK />
    </div>
  );
}

function Code({ children }: { children: string }) {
  return <pre className="overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-white/80">{children}</pre>;
}

// PluginSDK documents the plugin-builder: manifest, folder layout, the UI kit,
// and the JS bridge — so authors have a stable reference (not "ngawur").
function PluginSDK() {
  return (
    <div className="space-y-3 text-xs leading-relaxed text-white/60">
      <section>
        <h3 className="mb-1 text-sm font-semibold text-white">Build your own plugin</h3>
        <p>Create a plugin from the <span className="text-white/80">Plugins</span> app (pick a runtime — Python, Node, Go, or a static HTML app). It scaffolds a folder under <code className="rounded bg-white/10 px-1">~/.enowx/plugins/&lt;id&gt;/</code> you can edit. A non-static plugin runs as a sidecar process; enowx gives it a free <code className="rounded bg-white/10 px-1">PORT</code> and proxies its UI at <code className="rounded bg-white/10 px-1">/plugins/&lt;id&gt;/</code>.</p>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-white">plugin.json</h3>
        <Code>{`{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "What it does",
  "icon": "puzzle",
  "runtime": "python",      // go | python | node | static
  "entry": "main.py",       // launched with env PORT set (ignored for static)
  "ui": "public/index.html"
}`}</Code>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-white">Serve your UI on $PORT</h3>
        <p>Your entry starts an HTTP server on <code className="rounded bg-white/10 px-1">process.env.PORT</code> / <code className="rounded bg-white/10 px-1">os.environ["PORT"]</code>, serves your <code className="rounded bg-white/10 px-1">public/</code> UI, and exposes any endpoints your UI calls. Static plugins skip this — enowx serves the folder directly.</p>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-white">UI kit</h3>
        <p>For a consistent look, include the enowx kit and use its classes:</p>
        <Code>{`<link rel="stylesheet" href="/plugin-kit/kit.css">
<script src="/plugin-kit/kit.js" defer></script>

<div class="ex-card">
  <h1 class="ex-title">Hello</h1>
  <div class="ex-row">
    <input class="ex-input" id="name" placeholder="Name">
    <button class="ex-btn" id="go">Run</button>
  </div>
  <pre class="ex-out" id="out"></pre>
</div>`}</Code>
        <p className="text-white/45">Classes: <code className="rounded bg-white/10 px-1">ex-card</code>, <code className="rounded bg-white/10 px-1">ex-title</code>, <code className="rounded bg-white/10 px-1">ex-muted</code>, <code className="rounded bg-white/10 px-1">ex-row</code>, <code className="rounded bg-white/10 px-1">ex-stack</code>, <code className="rounded bg-white/10 px-1">ex-btn</code> (+ <code className="rounded bg-white/10 px-1">ex-ghost</code>/<code className="rounded bg-white/10 px-1">ex-danger</code>), <code className="rounded bg-white/10 px-1">ex-input</code>, <code className="rounded bg-white/10 px-1">ex-textarea</code>, <code className="rounded bg-white/10 px-1">ex-select</code>, <code className="rounded bg-white/10 px-1">ex-out</code>, <code className="rounded bg-white/10 px-1">ex-badge</code>.</p>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-white">JS bridge</h3>
        <Code>{`enowx.pluginId          // your plugin id
enowx.self("api/x")     // call your OWN endpoint
enowx.api("models")     // call the enowx dashboard API (/api/models)`}</Code>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-white">Custom icon</h3>
        <p>Drop an <code className="rounded bg-white/10 px-1">icon.png</code> (or webp/jpg/svg) in the plugin folder, or set one when creating the plugin. It's shown on the app tile and auto-fits (cover). Otherwise a default puzzle icon is used.</p>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-white">Publish to the marketplace</h3>
        <p>Hit <span className="text-white/80">Publish</span> on your plugin (Plugins app) to share it. enowx zips the folder — excluding <code className="rounded bg-white/10 px-1">_deps/</code>, <code className="rounded bg-white/10 px-1">node_modules/</code>, <code className="rounded bg-white/10 px-1">.git/</code> (deps are re-installed on the installer's machine) — uploads it, and runs a security scan. The outcome is one of:</p>
        <ul className="mt-1.5 ml-4 list-disc space-y-1 text-white/55">
          <li><span className="text-emerald-300">approved</span> — listed publicly right away.</li>
          <li><span className="text-red-300">rejected</span> — not listed; you get the reason. A moderator can still override a false positive.</li>
          <li><span className="text-amber-300">pending</span> — the AI reviewer was momentarily unavailable; a moderator reviews it manually before it goes live.</li>
        </ul>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-white">What the scan rejects</h3>
        <p>Two layers run on every publish. Write plain, readable source and you'll pass.</p>
        <ul className="mt-1.5 ml-4 list-disc space-y-1 text-white/55">
          <li><span className="text-white/80">Heuristics</span> — binaries/executables (<code className="rounded bg-white/10 px-1">.so/.dll/.exe</code>, ELF/Mach-O/PE), obfuscated or <span className="text-white/80">encrypted</span> scripts (<code className="rounded bg-white/10 px-1">exec/eval</code> of base64/marshal, PyArmor, packed <code className="rounded bg-white/10 px-1">_0x</code> JS, big high-entropy blobs), and disguised network addresses (hex-escaped, <code className="rounded bg-white/10 px-1">chr()</code>-built, split-string URLs).</li>
          <li><span className="text-white/80">AI review</span> — judges intent: reverse shells/backdoors, credential/data exfiltration, keyloggers, crypto miners, and downloading-and-running remote code are rejected.</li>
        </ul>
        <p className="mt-1.5 text-white/45">Outbound network calls are <span className="text-white/70">allowed</span> — plugins can talk to <code className="rounded bg-white/10 px-1">ENOWX_API</code> and to third-party APIs your plugin legitimately needs. The scan flags egress so the reviewer can confirm the destination fits your plugin's purpose; sending user data (tokens, files, keystrokes) to an unrelated host is what gets rejected, no matter how reputable the domain looks.</p>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-white">Install from the marketplace</h3>
        <p>Open the <span className="text-white/80">Marketplace</span> tab in the Plugins app, search, and hit <span className="text-white/80">Install</span>. enowx downloads the bundle and extracts it into <code className="rounded bg-white/10 px-1">~/.enowx/plugins/&lt;id&gt;/</code>; it then appears as an app (with a <span className="text-amber-300">plugin</span> badge) and its dependencies install on first run.</p>
      </section>

      <section className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3 text-[11px] text-amber-200/90">
        Plugins run on your machine with full access. The scan blocks obvious malware, but only install plugins you trust.
      </section>
    </div>
  );
}

function Shortcuts({ docs }: { docs: Docs }) {
  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-white/55">{docs.shortcuts.summary}</p>
      {docs.shortcuts.groups.map((g) => (
        <section key={g.name}>
          <h2 className="mb-2 text-sm font-semibold text-white">{g.name}</h2>
          <div className="space-y-1">
            {g.items.map((s) => (
              <div key={s.keys} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
                <span className="text-xs text-white/70">{s.desc}</span>
                <kbd className="rounded border border-white/15 bg-black/40 px-2 py-0.5 font-mono text-[10px] text-white/80">{s.keys}</kbd>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Endpoint({ e }: { e: DocEndpoint }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2">
        <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ring-1 ring-inset ${methodTone(e.method)}`}>
          {e.method}
        </span>
        <span className="truncate font-mono text-xs text-white/85">{e.path}</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">{e.desc}</p>
      {e.params && e.params.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {e.params.map((p) => (
            <div key={p.in + p.name} className="flex items-baseline gap-2 text-[10px]">
              <span className="font-mono text-white/70">{p.name}</span>
              <span className="rounded bg-white/5 px-1 py-px text-white/35">{p.in}</span>
              <span className="text-white/40">{p.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Line({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-white/40">{k}</span>
      <span className={`truncate ${mono ? "font-mono" : ""} text-white/70`}>{v}</span>
    </div>
  );
}
