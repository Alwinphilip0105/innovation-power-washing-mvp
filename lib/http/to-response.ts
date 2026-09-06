import { NextResponse } from "next/server";

import type { ApiResult } from "@/lib/api/handlers";

/** Puts a shared handler's result on the wire. */
export function toResponse(result: ApiResult) {
  return NextResponse.json(result.body, { status: result.status });
}
