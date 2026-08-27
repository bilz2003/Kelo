import { apiFetch } from "./client";

export function registerPushToken(token: string): Promise<void> {
  return apiFetch("/users/me/push-token", { method: "POST", body: { token } });
}
