import OpenAI from "openai";
import { DescribeImagesRequest, GenerateRequest, LlmProvider, ProviderError } from "../types";

const DEFAULT_MODEL = "gpt-4o-mini";

export class OpenAIProvider implements LlmProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generateText({ system, messages, maxTokens }: GenerateRequest): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      });
      const text = completion.choices[0]?.message?.content;
      if (!text) {
        throw new Error("response contained no text content");
      }
      return text;
    } catch (err) {
      throw new ProviderError(this.name, err);
    }
  }

  async describeImages({ system, prompt, images, maxTokens }: DescribeImagesRequest): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...images.map(
                (img): OpenAI.Chat.Completions.ChatCompletionContentPartImage => ({
                  type: "image_url",
                  image_url: { url: `data:image/png;base64,${img.base64}` },
                })
              ),
            ],
          },
        ],
      });
      const text = completion.choices[0]?.message?.content;
      if (!text) {
        throw new Error("response contained no text content");
      }
      return text;
    } catch (err) {
      throw new ProviderError(this.name, err);
    }
  }
}
