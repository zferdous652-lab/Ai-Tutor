import Anthropic from "@anthropic-ai/sdk";
import { GenerateRequest, LlmProvider, ProviderError } from "../types";

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generateText({ system, messages, maxTokens }: GenerateRequest): Promise<string> {
    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const block = message.content.find((c) => c.type === "text");
      if (!block || block.type !== "text") {
        throw new Error("response contained no text content");
      }
      return block.text;
    } catch (err) {
      throw new ProviderError(this.name, err);
    }
  }
}
