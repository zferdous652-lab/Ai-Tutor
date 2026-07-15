import { GenerateRequest, LlmProvider, ProviderError } from "./types";

/**
 * The "Model router" from the AI Gateway architecture: holds an ordered list of providers and
 * tries them in turn, falling back to the next one when a provider fails (rate limit, outage,
 * bad/missing key). Only a ProviderError triggers fallback — anything else (a bug in our own
 * request-building code) fails fast instead of silently retrying against every provider.
 */
export class ModelRouter {
  constructor(private providers: LlmProvider[]) {
    if (providers.length === 0) {
      throw new Error(
        "No LLM providers configured. Set ANTHROPIC_API_KEY and/or GEMINI_API_KEY."
      );
    }
  }

  async generateText(request: GenerateRequest): Promise<string> {
    const errors: ProviderError[] = [];
    for (const provider of this.providers) {
      try {
        return await provider.generateText(request);
      } catch (err) {
        if (!(err instanceof ProviderError)) throw err;
        console.error(`[model-router] ${err.message}, trying next provider if available`);
        errors.push(err);
      }
    }
    throw new Error(
      `All LLM providers failed: ${errors.map((e) => e.message).join("; ")}`
    );
  }
}
