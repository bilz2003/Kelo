import { Injectable, Logger } from "@nestjs/common";
import { EnodeClient } from "../sessions/adapters/enode-client";

interface EnodeUsersChargersResponse {
  data: { id: string; userId: string }[];
}

interface EnodeLinkResponse {
  linkUrl: string;
  linkToken: string;
}

interface EnodeSingleCharger {
  id: string;
  userId: string;
}

/**
 * The real end-user Link flow — distinct from the sandbox dashboard's
 * virtual-asset creation used for developer testing (see
 * ENODE-INTEGRATION.md's "Sandbox device provisioning" section). This is
 * what a real driver/host actually goes through to connect their own
 * charger account.
 *
 * Researched directly against Enode's real sandbox API this session,
 * since their docs (developers.enode.com -> platform.enode.com) now sit
 * behind a login wall — confirmed the real request/response shape with
 * live calls against the real endpoint using this project's existing
 * credentials, not guessed from stale third-party summaries:
 *   POST /users/{userId}/link
 *     body: { redirectUri, language, scopes, vendorType? }
 *     -> { linkUrl, linkToken }
 *   scopes is a required array from a fixed real enum (confirmed via a
 *   real 400 listing every valid value) — "charger:read:data" and
 *   "charger:control:charging" are the two this app actually needs,
 *   matching exactly what EnodeChargerAdapter already calls.
 *   language is also required; "browser" (let the hosted Link UI follow
 *   the browser's own locale) is a real accepted value, confirmed live.
 *   A custom URL scheme (kelo://...) is accepted as redirectUri without
 *   complaint — confirmed live, not assumed — which is what makes
 *   expo-web-browser's WebBrowser.openAuthSessionAsync usable here at
 *   all (it needs a real scheme redirect to detect completion).
 *   GET /users/{userId}/chargers -> { data: [{ id, userId, ... }], pagination }
 *   confirmed live against both a brand-new (never-linked) userId
 *   (real empty array) and this project's existing real linked sandbox
 *   device (real non-empty array, `id` a real UUID matching exactly
 *   what EnodeChargerAdapter already expects as enodeChargerId).
 *   GET /chargers/{chargerId} includes the owning userId directly —
 *   used below to verify a submitted enodeChargerId genuinely belongs
 *   to the calling host's own linked Enode account, not merely a
 *   plausible-looking string a client could otherwise fabricate.
 */
@Injectable()
export class EnodeLinkService {
  private readonly logger = new Logger(EnodeLinkService.name);

  // Fixed, not client-supplied — accepting an arbitrary redirect URI from
  // the client would mean a request could redirect a completed Link
  // session somewhere this app doesn't control. This is the one real
  // custom scheme AddChargerScreen listens for via
  // WebBrowser.openAuthSessionAsync (app.json's "scheme": "kelo").
  private static readonly REDIRECT_URI = "kelo://enode-link-callback";
  private static readonly SCOPES = ["charger:read:data", "charger:control:charging"];

  constructor(private readonly enode: EnodeClient) {}

  /**
   * One Enode "user" per Kelo host, not one per charger — matches
   * Enode's own model (a real end user links their real hardware
   * account once, potentially with several devices under it over time)
   * and this app's (one host account can list several chargers).
   * Deterministic, not stored anywhere separately: the same host always
   * maps to the same Enode userId, so linking a second Enode-route
   * charger later reuses the same linked account rather than starting
   * over.
   */
  enodeUserIdFor(ownerId: number): string {
    return `kelo-host-${ownerId}`;
  }

  private async listChargerIds(enodeUserId: string): Promise<string[]> {
    const result = await this.enode.request<EnodeUsersChargersResponse>("GET", `/users/${enodeUserId}/chargers`);
    return result.data.map((c) => c.id);
  }

  /**
   * Starts a real Link session. existingChargerIds is a snapshot of
   * whatever's already linked under this host's Enode account *before*
   * this session — the caller (AddChargerScreen, via the controller)
   * hands it back unchanged to resolveNewCharger below once the hosted
   * Link UI reports completion, so the real newly-linked device can be
   * identified by diffing against a real "before" state, the same
   * technique ENODE-INTEGRATION.md already established for confirming
   * real sandbox state changes.
   */
  async createLinkSession(ownerId: number): Promise<{ linkUrl: string; existingChargerIds: string[] }> {
    const enodeUserId = this.enodeUserIdFor(ownerId);
    const existingChargerIds = await this.listChargerIds(enodeUserId);
    const { linkUrl } = await this.enode.request<EnodeLinkResponse>("POST", `/users/${enodeUserId}/link`, {
      redirectUri: EnodeLinkService.REDIRECT_URI,
      language: "browser",
      scopes: EnodeLinkService.SCOPES,
      vendorType: "charger",
    });
    return { linkUrl, existingChargerIds };
  }

  /**
   * Called once the client's WebBrowser.openAuthSessionAsync reports the
   * hosted Link UI actually redirected back (not a cancel/dismiss) — not
   * proof on its own that a device was linked, just that the UI flow
   * ran to completion, hence the real re-check here rather than trusting
   * the redirect alone. If more than one new id somehow appears (e.g. a
   * vendor surfacing several devices from one login), the first is used
   * — a real, if unlikely, edge case worth a product decision later
   * rather than silently picking one forever.
   */
  async resolveNewCharger(ownerId: number, existingChargerIds: string[]): Promise<{ chargerId: string | null }> {
    const enodeUserId = this.enodeUserIdFor(ownerId);
    const known = new Set(existingChargerIds);
    const current = await this.listChargerIds(enodeUserId);
    const newlyLinked = current.filter((id) => !known.has(id));
    if (newlyLinked.length > 1) {
      this.logger.warn(`Enode Link for ${enodeUserId} produced ${newlyLinked.length} new chargers at once — using the first`);
    }
    return { chargerId: newlyLinked[0] ?? null };
  }

  /**
   * The real server-side enforcement behind the "hard block" — a client
   * could otherwise submit any plausible-looking enodeChargerId string
   * to POST /chargers without ever completing a real Link. Re-fetches
   * the charger directly from Enode and confirms its own reported
   * userId is genuinely this host's Enode account, not merely that the
   * id exists at all (a real device belonging to a different host account
   * entirely would still 200 here otherwise).
   */
  async verifyChargerBelongsToHost(ownerId: number, enodeChargerId: string): Promise<boolean> {
    const enodeUserId = this.enodeUserIdFor(ownerId);
    try {
      const charger = await this.enode.request<EnodeSingleCharger>("GET", `/chargers/${enodeChargerId}`);
      return charger.userId === enodeUserId;
    } catch {
      // Not found, or Enode itself unreachable — either way, not
      // something to treat as "verified" by default.
      return false;
    }
  }
}
