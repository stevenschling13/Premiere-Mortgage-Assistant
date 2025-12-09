#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_MODEL = "gemini-3-pro-preview";
const SESSION_DIR = ".cli-sessions";

const DEFAULT_SYSTEM = `You are the Premiere Private Banking Assistant CLI agent. Be concise, numerate, and explicit about risk.
Always provide actionable next steps and cite any assumptions you are making.`;

type GroundedLink = { title: string; uri: string };

type Role = "user" | "model";
type ChatHistory = Array<{ role: Role; parts: Array<{ text: string }> }>;
type ChatResult = {
  text: string;
  links: GroundedLink[];
  finishReason?: string;
  safetyRatings?: unknown;
};

type ContextAttachment = { label: string; text: string };

const sanitizeSessionName = (name: string) => {
  const normalized = name.trim().replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-{2,}/g, "-");
  const trimmed = normalized.replace(/^-+/, "").replace(/-+$/, "");

  if (!trimmed) {
    throw new Error("Session name must include at least one letter or number.");
  }

  return trimmed.slice(0, 64);
};

const requireValue = (flag: string, value: string | undefined) => {
  if (value === undefined) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
};

const parseNumber = (flag: string, raw: string | undefined) => {
  const value = Number(requireValue(flag, raw));
  if (Number.isNaN(value)) {
    throw new Error(`${flag} must be a number.`);
  }
  return value;
};

type CliOptions = {
  prompt: string;
  contextPaths: string[];
  session?: string;
  resetSession: boolean;
  model: string;
  temperature: number;
  systemInstruction?: string;
  json: boolean;
};

class SessionStore {
  private filePath?: string;

  constructor(private sessionName?: string) {
    if (this.sessionName) {
      const resolvedDir = path.resolve(process.cwd(), SESSION_DIR);
      if (!fs.existsSync(resolvedDir)) {
        fs.mkdirSync(resolvedDir, { recursive: true });
      }
      this.filePath = path.join(resolvedDir, `${this.sessionName}.json`);
    }
  }

  reset() {
    if (this.filePath && fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }

  load(): ChatHistory {
    if (!this.filePath || !fs.existsSync(this.filePath)) {
      return [];
    }
    try {
      const data = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      if (Array.isArray(data)) {
        return data as ChatHistory;
      }
    } catch (error) {
      console.warn("Could not read existing session; starting fresh", error);
    }
    return [];
  }

  save(history: ChatHistory) {
    if (!this.filePath) return;
    fs.writeFileSync(this.filePath, JSON.stringify(history, null, 2));
  }
}

const resolveApiKey = () => {
  const key = process.env.VITE_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!key) {
    throw new Error("Missing API key. Set VITE_API_KEY, GEMINI_API_KEY, or API_KEY in your environment.");
  }
  return key;
};

const readContexts = (paths: string[]): ContextAttachment[] => {
  return paths.map((contextPath) => {
    const absolutePath = path.resolve(process.cwd(), contextPath);
    const stats = fs.existsSync(absolutePath) ? fs.statSync(absolutePath) : undefined;

    if (!stats || !stats.isFile()) {
      throw new Error(`Context file not found: ${contextPath}`);
    }

    return {
      label: path.basename(absolutePath),
      text: fs.readFileSync(absolutePath, "utf8"),
    };
  });
};

class GeminiCliAgent {
  private history: ChatHistory;
  private store: SessionStore;
  private apiKey: string;

  constructor(private options: CliOptions) {
    this.store = new SessionStore(options.session);
    if (options.resetSession) {
      this.store.reset();
    }
    this.history = this.store.load();
    this.apiKey = resolveApiKey();
  }

  private buildMessage(contexts: ContextAttachment[]): string {
    const contextBlock = contexts.length
      ? `\n\n# Context (read-only)\n${contexts
          .map((ctx, idx) => `Context ${idx + 1} (${ctx.label}):\n${ctx.text}`)
          .join("\n\n")}`
      : "";
    return `${this.options.prompt}${contextBlock}`;
  }

  private appendToHistory(role: Role, text: string) {
    this.history.push({ role, parts: [{ text }] });
    this.store.save(this.history);
  }

  async run(): Promise<ChatResult> {
    const contexts = readContexts(this.options.contextPaths);
    const payload = this.buildMessage(contexts);

    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const chat = ai.chats.create({
      model: this.options.model,
      history: this.history,
      config: {
        systemInstruction: this.options.systemInstruction || DEFAULT_SYSTEM,
        temperature: this.options.temperature,
        tools: [{ googleSearch: {} }],
      },
    });

    this.appendToHistory("user", payload);

    const response = await chat.sendMessage({ message: payload });
    const text = response.text || "(no text returned)";
    const candidate = response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;
    const links = (groundingMetadata?.groundingChunks || [])
      .map((chunk: any) => (chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null))
      .filter((link): link is GroundedLink => Boolean(link));

    this.appendToHistory("model", text);

    return {
      text,
      links,
      finishReason: candidate?.finishReason,
      safetyRatings: candidate?.safetyRatings,
    };
  }
}

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    prompt: "",
    contextPaths: [],
    session: undefined,
    resetSession: false,
    model: DEFAULT_MODEL,
    temperature: 0.4,
    systemInstruction: undefined,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--prompt":
      case "-p":
        options.prompt = requireValue(arg, args[++i]);
        break;
      case "--context":
      case "-c":
        options.contextPaths.push(requireValue(arg, args[++i]));
        break;
      case "--session":
      case "-s":
        options.session = sanitizeSessionName(requireValue(arg, args[++i]));
        break;
      case "--reset":
        options.resetSession = true;
        break;
      case "--model":
      case "-m":
        options.model = requireValue(arg, args[++i]);
        break;
      case "--temp":
      case "-t":
        options.temperature = parseNumber(arg, args[++i]);
        break;
      case "--system":
        options.systemInstruction = requireValue(arg, args[++i]);
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.prompt && !process.stdin.isTTY) {
    options.prompt = fs.readFileSync(0, "utf8");
  }

  options.prompt = options.prompt.trim();

  if (!options.prompt) {
    throw new Error("Prompt is required. Use --prompt or pipe text to the CLI.");
  }

  return options;
};

const printHelp = () => {
  console.log(`Gemini CLI agent\n\nUsage: npm run ai:cli -- --prompt "How do I prep for Monday?" [options]\n\nOptions:\n  -p, --prompt <text>     Prompt text (required unless piped)\n  -c, --context <path>    Attach a file as read-only context (repeatable)\n  -s, --session <name>    Persist conversation to .cli-sessions/<name>.json\n      --reset             Reset the named session before running\n  -m, --model <name>      Model to use (default: ${DEFAULT_MODEL})\n  -t, --temp <value>      Temperature (default: 0.4)\n      --system <text>     Override the default system instruction\n      --json              Emit JSON with metadata instead of plain text\n  -h, --help              Show this help message\n`);
};

(async () => {
  try {
    const options = parseArgs();
    const agent = new GeminiCliAgent(options);
    const result = await agent.run();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("\n=== Gemini Response ===\n");
      console.log(result.text.trim());
      if (result.links?.length) {
        console.log("\nSources:");
        for (const link of result.links) {
          console.log(`- ${link.title}: ${link.uri}`);
        }
      }
      if (result.finishReason && result.finishReason !== "STOP") {
        console.warn(`\n[Notice] Finish reason: ${result.finishReason}`);
      }
    }
  } catch (error: any) {
    console.error("Gemini CLI agent failed:", error.message || error);
    process.exit(1);
  }
})();
