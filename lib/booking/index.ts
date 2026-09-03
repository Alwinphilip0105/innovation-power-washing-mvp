import { InternalBookingProvider } from "@/lib/booking/internal-provider";
import { createCalendarClient } from "@/lib/booking/calendar-clients";
import type { BookingProvider } from "@/lib/booking/provider";

const globalRef = globalThis as unknown as { __ipwBookingProvider?: BookingProvider };

export function getBookingProvider(): BookingProvider {
  if (!globalRef.__ipwBookingProvider) {
    globalRef.__ipwBookingProvider = new InternalBookingProvider(createCalendarClient());
  }
  return globalRef.__ipwBookingProvider;
}

export function setBookingProvider(provider: BookingProvider) {
  globalRef.__ipwBookingProvider = provider;
}

export * from "@/lib/booking/availability";
export type { BookingProvider } from "@/lib/booking/provider";
