# Gemini Cookbook Mappings for Premiere Mortgage Assistant

This document captures the highest-leverage changes to align the app with the Gemini cookbook notebooks while keeping the current frontend-only architecture. Each item maps a notebook to concrete code refactors for this repo.

## RAG for guidelines & overlays
- **Cookbook:** `quickstarts/Embeddings.ipynb`, `examples/document_search.ipynb`, `examples/Vectordb_with_chroma.ipynb`
- **Actions:**
  - Add `src/services/embeddingService.ts` that wraps `text-embedding-004` to embed multiple strings in one call.
  - Add `src/services/guidelineIndex.ts` to flatten `AGENCY_GUIDELINES` into chunks, embed once on startup, and score queries via dot/cosine similarity.
  - Update `geminiService` to build guideline context with the top-k retrieved chunks instead of dumping the full JSON into prompts.

## Search grounding & verification
- **Cookbook:** `quickstarts/Search_Grounding.ipynb`, `examples/Search_Wikipedia_using_ReAct.ipynb`
- **Actions:**
  - Align `verifyFactualClaims` with the search-grounded generation pattern: enable Google Search tool, request JSON with `verdict`, `explanation`, and structured `citations`.
  - Optional "Research mode": ReAct loop that plans → calls search → reasons for market/macro questions; surface intermediate steps in the UI.

## Function calling for calculators
- **Cookbook:** `quickstarts/Function_calling.ipynb`, `examples/Agents_Function_Calling_Barista_Bot.ipynb`
- **Actions:**
  - Define Gemini `functionDeclarations` for existing calculators (DTI, payment, etc.) and pass them into scenario analysis calls.
  - In the streaming handler, execute tool calls with the deterministic TS calculators and return results back to the model.
  - Use tools inside the Architect/Reviewer passes to eliminate math hallucinations.

## Structured reasoning & JSON outputs
- **Cookbook:** `quickstarts/System_instructions.ipynb`, `examples/Basic_Reasoning.ipynb`, `examples/Chain_of_thought_prompting.ipynb`, `quickstarts/JSON_mode.ipynb`
- **Actions:**
  - Add a JSON-mode scenario endpoint that returns `eligibility_summary`, `options`, `risks`, and `questions` for LO-only views.
  - Split system instructions: lightweight chat vs. heavy scenario (Architect/Reviewer) so each call uses the right prompt depth.

## Performance, streaming, and evaluation
- **Cookbook:** `quickstarts/Streaming.ipynb`, `quickstarts/Caching.ipynb`, `quickstarts/Counting_Tokens.ipynb`, `examples/Basic_Evaluation.ipynb`
- **Actions:**
  - Add token/latency instrumentation around Gemini calls; log estimated vs. actual usage per request.
  - Cache expensive retrieval/verification calls in-memory with TTL to avoid repeated work during phrasing tweaks.
  - Create a lightweight eval harness: golden scenarios run through Architect/Reviewer, then Gemini-as-evaluator checks for required reasoning points.

## Suggested implementation order
1. RAG-lite guideline retrieval (embedding + index + prompt wiring).
2. Function calling for calculators.
3. JSON scenario mode + split system instructions.
4. Search-grounded verification alignment.
5. Token/latency instrumentation + caching.
6. Eval harness once stable.
