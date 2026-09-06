import {
  handleAppointment,
  handleAvailability,
  handleChat,
  handleLead,
  handleVoiceDemo,
  type ApiResult,
} from "@/lib/api/handlers";
import { bootstrap } from "@/lib/bootstrap";
import { errorBody } from "@/lib/http/responses";

/**
 * How the browser reaches the API when there is no server: it runs the
 * handlers itself.
 *
 * Swapped in over `transport.ts` by `scripts/build-static.mjs` for the
 * self-contained static build, so callers cannot tell the difference - the
 * same handlers, the same validation, the same JSON, returned as a real
 * `Response`.
 *
 * The dataset is the seeded one, held per visitor in this tab. Nothing is
 * shared with anyone else and nothing reaches a real database, which is the
 * point: the demo needs no backend, no keys and no configuration.
 */
async function dispatch(path: string, init?: RequestInit): Promise<ApiResult> {
  // Idempotent; wires the automations that turn a booking into notifications.
  bootstrap();

  const url = new URL(path, window.location.origin);
  const body = typeof init?.body === "string" ? safeParse(init.body) : undefined;

  switch (url.pathname) {
    case "/api/chat":
      return handleChat(body);
    case "/api/leads":
      return handleLead(body);
    case "/api/appointments":
      return handleAppointment(body);
    case "/api/demo/voice":
      return handleVoiceDemo(body);
    case "/api/availability":
      return handleAvailability({
        serviceId: url.searchParams.get("serviceId"),
        serviceSlug: url.searchParams.get("serviceSlug"),
        from: url.searchParams.get("from"),
        days: url.searchParams.get("days"),
      });
    default:
      return { status: 404, body: errorBody("That endpoint is not part of the demo.") };
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function callApi(path: string, init?: RequestInit): Promise<Response> {
  const result = await dispatch(path, init);

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
}
