import type {
  IntegrityV1AttestationRequest,
  IntegrityV1AttestationResponse,
  IntegrityV1ChallengeRetryRequest,
  IntegrityV1CommitRequest,
  IntegrityV1CommitResponse,
  IntegrityV1ObserveResponse,
  IntegrityV1ObservedToolCall,
  IntegrityV1PreflightRequest,
  IntegrityV1PreflightResponse,
} from "./types";

export * from "./types";

export class IntegrityApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: unknown;

  constructor(input: {
    status: number;
    code: string;
    message?: string;
    body?: unknown;
  }) {
    super(input.message ?? input.code);
    this.name = "IntegrityApiError";
    this.status = input.status;
    this.code = input.code;
    this.body = input.body;
  }
}

export type IntegrityClientOptions = {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
};

function normalizedBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export class IntegrityClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: IntegrityClientOptions) {
    if (!options.baseUrl) throw new Error("integrity_sdk_base_url_required");
    if (!options.apiKey) throw new Error("integrity_sdk_api_key_required");
    this.baseUrl = normalizedBaseUrl(options.baseUrl);
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetch ?? fetch;
  }

  async observe(input: IntegrityV1ObservedToolCall): Promise<IntegrityV1ObserveResponse> {
    return this.request("/api/integrity/v1/observe", input);
  }

  async preflight(input: IntegrityV1PreflightRequest): Promise<IntegrityV1PreflightResponse> {
    return this.request("/api/integrity/v1/preflight", input);
  }

  async attest(input: IntegrityV1AttestationRequest): Promise<IntegrityV1AttestationResponse> {
    return this.request("/api/integrity/v1/attest", input);
  }

  async retryChallenge(
    input: IntegrityV1ChallengeRetryRequest
  ): Promise<IntegrityV1PreflightResponse> {
    return this.request("/api/integrity/v1/challenge", input);
  }

  async commit(input: IntegrityV1CommitRequest): Promise<IntegrityV1CommitResponse> {
    return this.request("/api/integrity/v1/commit", input);
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const raw = await response.text();
    let parsed: any = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }

    if (!response.ok) {
      const nestedCode =
        parsed &&
        typeof parsed === "object" &&
        parsed.error &&
        typeof parsed.error === "object" &&
        typeof parsed.error.code === "string"
          ? parsed.error.code
          : null;
      const flatCode =
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.error === "string"
          ? parsed.error
          : null;
      const nestedMessage =
        parsed &&
        typeof parsed === "object" &&
        parsed.error &&
        typeof parsed.error === "object" &&
        typeof parsed.error.message === "string"
          ? parsed.error.message
          : undefined;

      throw new IntegrityApiError({
        status: response.status,
        code: nestedCode ?? flatCode ?? "integrity_api_error",
        message: nestedMessage,
        body: parsed,
      });
    }

    return parsed as T;
  }
}

export function createIntegrityClient(options: IntegrityClientOptions): IntegrityClient {
  return new IntegrityClient(options);
}
