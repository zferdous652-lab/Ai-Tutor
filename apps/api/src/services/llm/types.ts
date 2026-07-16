export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateRequest {
  system: string;
  /** Full turn history, ending with the newest user turn to respond to. */
  messages: ChatTurn[];
  maxTokens: number;
}

export interface ImagePage {
  page: number;
  /** PNG bytes, base64-encoded. */
  base64: string;
}

export interface DescribeImagesRequest {
  system: string;
  prompt: string;
  images: ImagePage[];
  maxTokens: number;
}

export interface LlmProvider {
  readonly name: string;
  generateText(request: GenerateRequest): Promise<string>;
  /** Vision call: describe diagrams/maps/photos/charts across a batch of rendered PDF pages. */
  describeImages(request: DescribeImagesRequest): Promise<string>;
}

/** Thrown by a provider for errors worth falling back to the next provider for (rate limits,
 * outages, auth failures) as opposed to errors in our own request that would fail identically
 * everywhere. */
export class ProviderError extends Error {
  constructor(public providerName: string, cause: unknown) {
    super(`${providerName} provider failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.cause = cause;
  }
}
