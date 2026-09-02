import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

interface EnodeProblem {
  title?: string;
  detail?: string;
}

/**
 * Thin, self-contained HTTP + OAuth2 client_credentials client for Enode's
 * API — verified live against the sandbox before this was written (real
 * 200 token exchange, real 400/404 error shapes from GET/POST /chargers).
 * EnodeChargerAdapter is the only caller; this has no retry/queueing logic
 * of its own since a charger genuinely refusing an action is a real,
 * expected outcome to surface, not something to paper over.
 */
@Injectable()
export class EnodeClient {
  private readonly logger = new Logger(EnodeClient.name);
  private cachedToken: CachedToken | null = null;

  constructor(private readonly config: ConfigService) {}

  private get clientId(): string | undefined {
    return this.config.get<string>("ENODE_CLIENT_ID") || undefined;
  }

  private get clientSecret(): string | undefined {
    return this.config.get<string>("ENODE_CLIENT_SECRET") || undefined;
  }

  private get apiBaseUrl(): string {
    return this.config.get<string>("ENODE_API_BASE_URL", "https://enode-api.sandbox.enode.io");
  }

  /**
   * Sandbox and production use different OAuth hosts (oauth.sandbox vs
   * oauth.production) but the swap is always "enode-api." -> "oauth." on
   * the same API base — derived here rather than a second env var, so the
   * token host and the API host can never point at mismatched
   * environments by mistake.
   */
  private get oauthTokenUrl(): string {
    return `${this.apiBaseUrl.replace("enode-api.", "oauth.")}/oauth2/token`;
  }

  private notConfigured(): never {
    throw new ServiceUnavailableException(
      "Enode integration is not configured — ENODE_CLIENT_ID/ENODE_CLIENT_SECRET are not set. See ENODE-INTEGRATION.md.",
    );
  }

  /**
   * Cached across calls with a 60s safety margin, refetched only once
   * actually expired (or expiring imminently) — not once per request, per
   * the ~3599s token lifetime Enode's docs and this exchange both confirm.
   * The token itself, and the client secret used to fetch it, are never
   * logged anywhere below.
   */
  private async getAccessToken(): Promise<string> {
    const { clientId, clientSecret } = this;
    if (!clientId || !clientSecret) this.notConfigured();

    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt - 60_000 > now) {
      return this.cachedToken.accessToken;
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    let response: Response;
    try {
      response = await fetch(this.oauthTokenUrl, {
        method: "POST",
        headers: { Authorization: `Basic ${basicAuth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials",
      });
    } catch (err) {
      this.logger.error("Enode OAuth2 token exchange failed — network error", err as Error);
      throw new ServiceUnavailableException("Could not reach Enode's auth server");
    }

    if (!response.ok) {
      // Status only — never the response body, in case it ever echoed
      // back anything request-derived.
      this.logger.error(`Enode OAuth2 token exchange failed with HTTP ${response.status}`);
      throw new ServiceUnavailableException("Could not authenticate with Enode — token exchange failed");
    }

    const body = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedToken = { accessToken: body.access_token, expiresAt: now + body.expires_in * 1000 };
    return this.cachedToken.accessToken;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    let response: Response;
    try {
      response = await fetch(`${this.apiBaseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      this.logger.error(`Enode API ${method} ${path} failed — network error`, err as Error);
      throw new ServiceUnavailableException("Could not reach Enode's API");
    }

    if (!response.ok) {
      let detail = "";
      try {
        const problem = (await response.json()) as EnodeProblem;
        detail = problem.detail ?? problem.title ?? "";
      } catch {
        // Non-JSON error body — proceed with an empty detail.
      }
      this.logger.warn(`Enode API ${method} ${path} failed: HTTP ${response.status}${detail ? ` — ${detail}` : ""}`);
      throw new BadGatewayException(`Enode API request failed: ${detail || `HTTP ${response.status}`}`);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}
