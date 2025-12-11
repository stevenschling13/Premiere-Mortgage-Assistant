import React from 'react';
import {
  AlertTriangle,
  BookOpen,
  Brain,
  Bug,
  CheckCircle,
  FileWarning,
  Flame,
  Globe2,
  KeyRound,
  Repeat2,
  Rocket,
  Shield,
  Wrench
} from 'lucide-react';

const backendErrors = [
  {
    httpCode: '400',
    status: 'INVALID_ARGUMENT',
    description: 'The request body is malformed.',
    example: 'There is a typo, or a missing required field in your request.',
    solution:
      'Check the API reference for request format, examples, and supported versions. Using features from a newer API version with an older endpoint can cause errors.'
  },
  {
    httpCode: '400',
    status: 'FAILED_PRECONDITION',
    description: 'Gemini API free tier is not available in your country. Please enable billing on your project in Google AI Studio.',
    example: 'You are making a request in a region where the free tier is not supported, and you have not enabled billing on your project in Google AI Studio.',
    solution: 'To use the Gemini API, you will need to setup a paid plan using Google AI Studio.'
  },
  {
    httpCode: '403',
    status: 'PERMISSION_DENIED',
    description: "Your API key doesn't have the required permissions.",
    example:
      'You are using the wrong API key; you are trying to use a tuned model without going through proper authentication.',
    solution: 'Check that your API key is set and has the right access. Make sure to go through proper authentication to use tuned models.'
  },
  {
    httpCode: '404',
    status: 'NOT_FOUND',
    description: "The requested resource wasn't found.",
    example: 'An image, audio, or video file referenced in your request was not found.',
    solution: 'Check if all parameters in your request are valid for your API version.'
  },
  {
    httpCode: '429',
    status: 'RESOURCE_EXHAUSTED',
    description: "You've exceeded the rate limit.",
    example: 'You are sending too many requests per minute with the free tier Gemini API.',
    solution:
      "Verify that you're within the model's rate limit. Request a quota increase if needed."
  },
  {
    httpCode: '500',
    status: 'INTERNAL',
    description: "An unexpected error occurred on Google's side.",
    example: 'Your input context is too long.',
    solution:
      'Reduce your input context or temporarily switch to another model (e.g. from Gemini 2.5 Pro to Gemini 2.5 Flash) and see if it works. Wait a bit and retry, and report it via Send feedback if it persists.'
  },
  {
    httpCode: '503',
    status: 'UNAVAILABLE',
    description: 'The service may be temporarily overloaded or down.',
    example: 'The service is temporarily running out of capacity.',
    solution: 'Temporarily switch to another model or wait and retry. Report via Send feedback if the issue persists.'
  },
  {
    httpCode: '504',
    status: 'DEADLINE_EXCEEDED',
    description: 'The service is unable to finish processing within the deadline.',
    example: 'Your prompt (or context) is too large to be processed in time.',
    solution: "Set a larger 'timeout' in your client request to avoid this error."
  }
];

const modelParameters = [
  {
    name: 'Candidate count',
    value: '1-8 (integer)'
  },
  {
    name: 'Temperature',
    value: '0.0-1.0'
  },
  {
    name: 'Max output tokens',
    value: 'Use get_model to determine the maximum number of tokens for the model you are using.'
  },
  {
    name: 'TopP',
    value: '0.0-1.0'
  }
];

const repetitiveIssues = [
  {
    title: 'Repeated hyphens in Markdown tables',
    description:
      'Occurs when the model tries to visually align a long Markdown table even though alignment is unnecessary.',
    workaround:
      'Add explicit Markdown table guidelines to your prompt (for example, always use |---| separators without extra hyphens), provide concise cells, and consider a higher temperature (>= 0.8).' 
  },
  {
    title: 'Repeated tokens in Markdown tables',
    description: 'Similar alignment problems can duplicate content.',
    workaround:
      'Add instructions such as "FOR TABLE HEADINGS, IMMEDIATELY ADD \' |\' AFTER THE TABLE HEADING." and increase temperature (>= 0.8).'
  },
  {
    title: 'Repeated newlines (\\n) in structured output',
    description: 'Unicode or escape sequences like \\u or \\t in inputs can cause repeated newlines.',
    workaround:
      'Replace forbidden escape sequences with UTF-8 characters and explicitly constrain allowed escapes (\\, \\n, \").' 
  },
  {
    title: 'Repeated text in structured output',
    description: 'Different ordering than the structured schema can lead to repetition.',
    workaround: "Avoid prescribing field order and make all output fields required." 
  },
  {
    title: 'Repetitive tool calling',
    description: 'The model can lose context or call unavailable endpoints repeatedly.',
    workaround:
      'Tell the model to maintain state in its silent thinking (for example, start thoughts with a brief recap of progress).' 
  },
  {
    title: 'Repetitive text outside structured output',
    description: "The model may get stuck on a request it can't resolve.",
    workaround: 'Avoid over-prescribing thought steps, raise temperature (>= 0.8), and add directives like “Be concise” or “Provide the answer once.”'
  }
];

const installCommands = [
  {
    language: 'Python',
    before: 'pip install -U -q "google-generativeai"',
    after: 'pip install -U -q "google-genai"'
  },
  {
    language: 'JavaScript',
    before: 'npm install @google/generative-ai',
    after: 'npm install @google/genai'
  },
  {
    language: 'Go',
    before: 'go get github.com/google/generative-ai-go',
    after: 'go get google.golang.org/genai'
  }
];

const callPatterns = [
  {
    scenario: 'Create a client and generate text',
    before:
      'Python: model = genai.GenerativeModel("gemini-1.5-flash"); response = model.generate_content("Tell me a story...")',
    after:
      "Python: client = genai.Client(); response = client.models.generate_content({ model: 'gemini-2.0-flash', contents: 'Tell me a story...' })"
  },
  {
    scenario: 'Streaming responses',
    before: 'JS: model.generateContentStream(prompt).stream for await (chunk) { ... }',
    after:
      'JS: ai.models.generateContentStream({ model: "gemini-2.0-flash", contents: prompt }) then iterate response async iterator'
  },
  {
    scenario: 'Centralized services',
    before: 'Separate clients for models, files, and caching',
    after: 'One Client object exposes models, chats, files, caches, and tunings under client.<service>'
  },
  {
    scenario: 'Authentication defaults',
    before: 'Manual configure() calls per SDK',
    after: 'Client picks up GEMINI_API_KEY or GOOGLE_API_KEY env vars; apiKey overrides are optional'
  }
];

export const GeminiGuide: React.FC = () => {
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div className="bg-gradient-to-r from-brand-dark to-brand-red text-white p-6 md:p-8 rounded-2xl shadow-lg border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-gold font-semibold mb-2 flex items-center">
              <Shield className="w-4 h-4 mr-2" /> Reliability Playbook
            </p>
            <h1 className="text-2xl md:text-3xl font-black leading-tight">Gemini API Troubleshooting & Build Guide</h1>
            <p className="text-white/80 mt-3 text-sm md:text-base max-w-3xl">
              Diagnose common backend responses, validate client parameters, and harden your Build mode workflows. Start with API key setup, then move through the error codes, parameter limits, and mitigation checklists below.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs md:text-sm bg-white/10 px-4 py-2 rounded-full shadow-inner">
            <CheckCircle className="w-4 h-4 text-green-300" />
            <span>API key checklist: configure via the API key setup guide before calling Gemini.</span>
          </div>
        </div>
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 text-brand-dark">
            <Rocket className="w-5 h-5" />
            <h2 className="text-lg font-bold text-gray-900">Google GenAI SDK migration cheat sheet</h2>
          </div>
          <span className="text-xs font-semibold text-brand-red bg-brand-red/10 px-3 py-1 rounded-full">GA with Gemini 2.0+</span>
        </div>

        <p className="text-sm text-gray-700">
          The legacy SDKs used separate clients and ad hoc auth. The new Google GenAI SDK centers all calls on a single <code>Client</code>, streamlines auth via <code>GEMINI_API_KEY</code>/<code>GOOGLE_API_KEY</code>, and ships new packages for each language.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {installCommands.map(cmd => (
            <div key={cmd.language} className="border border-gray-200 rounded-xl p-4 shadow-sm bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900">{cmd.language}</span>
                <span className="text-[10px] uppercase font-bold text-brand-dark">Install</span>
              </div>
              <div className="text-xs text-gray-700 space-y-1 font-mono">
                <div className="bg-white border border-gray-200 rounded-lg p-2">
                  <span className="font-semibold text-brand-red mr-2">Before</span>
                  {cmd.before}
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-2">
                  <span className="font-semibold text-green-700 mr-2">After</span>
                  {cmd.after}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-xl p-4 space-y-2 shadow-sm">
            <div className="flex items-center gap-2 text-brand-dark">
              <Brain className="w-4 h-4" />
              <span className="font-semibold">Client-first architecture</span>
            </div>
            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
              <li>Instantiate once: <code>const client = new GoogleGenAI(&#123; apiKey &#125;)</code> or <code>client = genai.Client()</code>.</li>
              <li>Use services from the client: <code>client.models.generate_content</code>, <code>client.chats.create</code>, <code>client.files.upload</code>, <code>client.caches.create</code>, <code>client.tunings.tune</code>.</li>
              <li>Prefer stateless calls; chats and Live sessions are the stateful exceptions.</li>
            </ul>
          </div>
          <div className="border border-gray-200 rounded-xl p-4 space-y-2 shadow-sm">
            <div className="flex items-center gap-2 text-brand-dark">
              <BookOpen className="w-4 h-4" />
              <span className="font-semibold">Config highlights</span>
            </div>
            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
              <li>Optional inputs live under a <code>config</code> object (<code>GenerateContentConfig</code> / plain objects).</li>
              <li>Safety, tools, temperature, max tokens, and response schemas share the same config shape across languages.</li>
              <li>Streaming mirrors non-streaming APIs: <code>models.generate_content_stream</code> (Python) or <code>models.generateContentStream</code> (JS).</li>
            </ul>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="px-3 py-2 text-left font-semibold">Workflow</th>
                <th className="px-3 py-2 text-left font-semibold">Before</th>
                <th className="px-3 py-2 text-left font-semibold">After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {callPatterns.map((row, idx) => (
                <tr key={idx} className="align-top">
                  <td className="px-3 py-3 font-semibold text-gray-900 w-48">{row.scenario}</td>
                  <td className="px-3 py-3 text-gray-700">{row.before}</td>
                  <td className="px-3 py-3 text-gray-800">{row.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-2">
          <div className="flex items-center gap-2 text-brand-dark font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            Backend status codes
          </div>
          <p className="text-gray-600 text-sm">
            Map HTTP codes to root causes and actions. Retry logic should treat 5xx as transient and 4xx as validation or quota issues.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-2">
          <div className="flex items-center gap-2 text-brand-dark font-bold text-sm">
            <Wrench className="w-4 h-4" />
            Parameter guardrails
          </div>
          <p className="text-gray-600 text-sm">
            Keep candidate counts, temperature, tokens, and TopP within allowed ranges and ensure you call the correct API version for beta features.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-2">
          <div className="flex items-center gap-2 text-brand-dark font-bold text-sm">
            <KeyRound className="w-4 h-4" />
            API key health
          </div>
          <p className="text-gray-600 text-sm">
            If calls fail authorization, confirm the key in Google AI Studio, regenerate leaked keys, and enable billing where required.
          </p>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileWarning className="text-brand-red" />
          <h2 className="text-lg font-bold text-gray-900">Gemini API backend service error codes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-3 py-2 font-semibold">HTTP</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Description</th>
                <th className="px-3 py-2 font-semibold">Example</th>
                <th className="px-3 py-2 font-semibold">Solution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {backendErrors.map((row, idx) => (
                <tr key={idx} className="align-top">
                  <td className="px-3 py-3 font-mono font-semibold text-gray-800">{row.httpCode}</td>
                  <td className="px-3 py-3 text-gray-800 font-semibold">{row.status}</td>
                  <td className="px-3 py-3 text-gray-700">{row.description}</td>
                  <td className="px-3 py-3 text-gray-700">{row.example}</td>
                  <td className="px-3 py-3 text-gray-800">{row.solution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Brain className="text-brand-dark" />
            <h3 className="text-lg font-bold text-gray-900">Validate model parameters</h3>
          </div>
          <p className="text-gray-600 text-sm">
            Keep parameter values within allowed limits and align the endpoint with the feature set you expect. Use /v1beta for beta-only features and confirm the model supports your requested capabilities.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="px-3 py-2 font-semibold text-left">Model parameter</th>
                  <th className="px-3 py-2 font-semibold text-left">Values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {modelParameters.map((param, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 font-semibold text-gray-800">{param.name}</td>
                    <td className="px-3 py-2 text-gray-700">{param.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 text-sm">
            <li>Verify that you are using a supported model from the models page.</li>
            <li>Gemini 2.5 Flash/Pro run with thinking enabled by default. To prioritize speed or minimize costs, adjust or disable thinking following the thinking budget guidance.</li>
            <li>
              For Gemini 3 models, keep temperature at the default 1.0. Lower values may cause looping or degraded reasoning, especially on complex math.
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Repeat2 className="text-brand-dark" />
            <h3 className="text-lg font-bold text-gray-900">Safety, recitation, and repetition</h3>
          </div>
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              If a prompt is blocked by your safety settings, review the content relative to your configured filters. A BlockedReason.OTHER response can signal a terms-of-service violation or otherwise unsupported query.
            </p>
            <p>
              For recitation stops, make the prompt more unique and consider a slightly higher temperature. Recitation indicates the output resembles existing data.
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <div className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Repeat2 className="w-4 h-4" />
              Repetitive tokens checklist
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs md:text-sm">
                <thead>
                  <tr className="bg-white text-gray-600">
                    <th className="px-2 py-2 text-left font-semibold">Pattern</th>
                    <th className="px-2 py-2 text-left font-semibold">Cause</th>
                    <th className="px-2 py-2 text-left font-semibold">Suggested workaround</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {repetitiveIssues.map((row, idx) => (
                    <tr key={idx} className="align-top">
                      <td className="px-2 py-3 font-semibold text-gray-800">{row.title}</td>
                      <td className="px-2 py-3 text-gray-700">{row.description}</td>
                      <td className="px-2 py-3 text-gray-700">{row.workaround}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6 space-y-5">
        <div className="flex items-center gap-2">
          <KeyRound className="text-brand-dark" />
          <h3 className="text-lg font-bold text-gray-900">Blocked or non-working API keys</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <Flame className="w-4 h-4 text-brand-red" />
              Why keys are blocked
            </div>
            <p>Some API keys have been publicly exposed. Known leaked keys are proactively blocked to protect your data.</p>
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Confirm if a key is affected
            </div>
            <p>
              Check Google AI Studio to see if any keys are blocked and regenerate new keys if needed. Requests with leaked keys return: “Your API key was reported as leaked. Please use another API key.”
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <Wrench className="w-4 h-4" />
              Take action
            </div>
            <p>Generate new keys in Google AI Studio and harden your key management to avoid exposure.</p>
            <p>
              Unexpected charges from the vulnerability? Submit a billing support case—Google’s billing team is addressing these incidents.
            </p>
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <Shield className="w-4 h-4 text-green-600" />
              Google safeguards
            </div>
            <ul className="list-disc pl-5 space-y-1">
              <li>New keys default to Google AI Studio usage, preventing unintended cross-key calls.</li>
              <li>Leaked keys are blocked by default for Gemini API access.</li>
              <li>Key status is visible in Google AI Studio with proactive notifications when issues are found.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="text-brand-dark" />
            <h4 className="font-bold text-gray-900">Improve model output</h4>
          </div>
          <p className="text-sm text-gray-700">Use structured prompts and follow the prompt engineering guide for higher-quality outputs.</p>
          <p className="text-sm text-gray-700">Review token limits in the token guide to size prompts and responses appropriately.</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Globe2 className="text-brand-dark" />
            <h4 className="font-bold text-gray-900">Known issues</h4>
          </div>
          <p className="text-sm text-gray-700">
            The API supports a select set of languages. Submitting prompts in unsupported languages can produce unexpected or blocked responses. Track supported languages on the models page.
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Bug className="text-brand-dark" />
            <h4 className="font-bold text-gray-900">File a bug</h4>
          </div>
          <p className="text-sm text-gray-700">
            Join the Google AI developer forum to report issues or ask questions.
          </p>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Rocket className="text-brand-dark" />
          <h3 className="text-lg font-bold text-gray-900">Build mode in Google AI Studio</h3>
        </div>
        <p className="text-sm text-gray-700">
          Quickly build, vibe code, and deploy apps that exercise Gemini capabilities like image generation and the Live API.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-800">
          <div className="space-y-2">
            <div className="font-semibold">Get started</div>
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li>Start with a prompt, add AI Chips for features, or dictate with speech-to-text.</li>
              <li>Use the “I’m Feeling Lucky” button for generated project ideas.</li>
              <li>Remix a project from the App Gallery by selecting Copy App.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <div className="font-semibold">What AI Studio creates</div>
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li>Default output is a React web app (Angular available via Settings).</li>
              <li>View generated code in the Code tab; geminiService.ts contains prompt construction, API calls, and response parsing using the GenAI TS SDK.</li>
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-800">
          <div className="space-y-2">
            <div className="font-semibold">Continue building</div>
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li>Iterate in Build mode via the chat panel (e.g., add buttons, change styling).</li>
              <li>Edit code directly in the Code tab.</li>
              <li>Save projects to GitHub for version control.</li>
              <li>Export as ZIP to develop locally with your toolchain.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <div className="font-semibold">Deploy or archive</div>
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li>Deploy to Google Cloud Run for scalable services (usage pricing applies).</li>
              <li>Export to GitHub to fit existing deployment workflows.</li>
              <li>Archive or share within AI Studio as needed.</li>
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-800">
          <div className="space-y-2">
            <div className="font-semibold">Key features</div>
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li>Annotation mode: highlight UI areas and describe visual changes; AI generates prompts with screenshots.</li>
              <li>Share apps to collaborate; recipients can fork or edit with permission.</li>
              <li>Explore the App Gallery for instant previews and remixing.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <div className="font-semibold">Limitations & security</div>
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li>Never embed real API keys in shared app code. AI Studio proxies user keys when running shared apps.</li>
              <li>Apps inherit Google Drive permissions; shared users can view code and fork, and editors can modify.</li>
              <li>For external deployments, move API key logic server-side to prevent exposure; client-side replacements are discouraged.</li>
              <li>Local development imports back into AI Studio are not supported.</li>
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-800">
          <div className="space-y-2">
            <div className="font-semibold">Support & references</div>
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li>Monitor latency and cost for 2.5 models; adjust thinking budgets when speed is critical.</li>
              <li>Align with rate limits and request quota increases when necessary.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <div className="font-semibold">What’s next</div>
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li>Remix projects from the App Gallery for inspiration.</li>
              <li>Watch the AI Studio vibe coding YouTube playlist for tutorials.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default GeminiGuide;
