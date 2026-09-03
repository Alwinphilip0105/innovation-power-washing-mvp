import "server-only";

import { registerAutomations } from "@/lib/events/handlers";

/**
 * Idempotent server-side startup. Called at the top of every server entry
 * point (root layout + each route handler) so automations are wired regardless
 * of which surface the request came in through.
 */
export function bootstrap() {
  registerAutomations();
}
