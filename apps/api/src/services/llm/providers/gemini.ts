import { GoogleGenerativeAI } from "@google/generative-ai";
import { GenerateRequest, LlmProvider, ProviderError } from "../types";

const DEFAULT_MODEL = "gemini-2.0-flash";

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async generateText({ system, messages, maxTokens }: GenerateRequest): Promise<string> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: system,
      });

      const history = messages.slice(0, -1).map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      }));
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) {
        throw new Error("no messages to send");
      }

      const chat = model.startChat({
        history,
        generationConfig: { maxOutputTokens: maxTokens },
      });
      const result = await chat.sendMessage(lastMessage.content);
      const text = result.response.text();
      if (!text) {
        throw new Error("response contained no text content");
      }
      return text;
    } catch (err) {
      throw new ProviderError(this.name, err);
    }
  }
}
