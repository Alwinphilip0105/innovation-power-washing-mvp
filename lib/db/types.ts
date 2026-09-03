import type { Weekday } from "@/lib/utils/datetime";

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "estimate_requested",
  "estimate_sent",
  "booked",
  "completed",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = ["website", "phone", "sms", "web_chat", "referral", "manual"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const APPOINTMENT_STATUSES = [
  "requested",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const CHANNELS = ["phone", "sms", "web"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CONVERSATION_STATUSES = ["open", "escalated", "closed"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const CALL_STATUSES = ["in_progress", "completed", "missed", "failed", "voicemail"] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const CALL_DIRECTIONS = ["inbound", "outbound"] as const;
export type CallDirection = (typeof CALL_DIRECTIONS)[number];

export const MESSAGE_DIRECTIONS = ["inbound", "outbound"] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

export const MESSAGE_SENDERS = ["customer", "ai", "staff", "system"] as const;
export type MessageSender = (typeof MESSAGE_SENDERS)[number];

export const MESSAGE_STATUSES = ["queued", "sent", "delivered", "failed", "received"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const ESTIMATE_STATUSES = ["requested", "draft", "sent", "accepted", "declined", "expired"] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const USER_ROLES = ["owner", "admin", "staff"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PRICING_MODELS = ["starting_at", "per_sqft", "flat", "quote_only"] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const NOTIFICATION_TYPES = [
  "lead.created",
  "appointment.created",
  "appointment.cancelled",
  "call.missed",
  "estimate.requested",
  "escalation.required",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface BusinessHoursWindow {
  open: string; // "08:00"
  close: string; // "17:00"
}

export type BusinessHours = Record<Weekday, BusinessHoursWindow[]>;

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface BookingRules {
  /** Minutes of lead time required before the earliest bookable slot. */
  minNoticeMinutes: number;
  /** How far out customers may book. */
  maxAdvanceDays: number;
  /** Grid the availability search walks, in minutes. */
  slotIntervalMinutes: number;
  /** Padding added after each appointment (travel/cleanup). */
  bufferMinutes: number;
  /** Simultaneous jobs the crew can run. */
  maxConcurrentAppointments: number;
}

export interface BusinessSettings {
  tagline: string;
  serviceArea: {
    description: string;
    counties: string[];
    towns: string[];
    radiusMiles: number;
  };
  faqs: FaqEntry[];
  policies: string[];
  bookingRules: BookingRules;
  ai: {
    assistantName: string;
    personality: string;
    greeting: string;
    escalationPhone: string;
  };
  notifications: {
    ownerEmail: string;
    ownerPhone: string;
  };
  social?: {
    google?: string;
    facebook?: string;
    instagram?: string;
  };
  licensing?: string;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  phone: string;
  email: string;
  website: string | null;
  address: string | null;
  timezone: string;
  business_hours: BusinessHours;
  settings: BusinessSettings;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  business_id: string;
  auth_user_id: string | null;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  customer_id: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
}

export interface Lead {
  id: string;
  business_id: string;
  customer_id: string;
  source: LeadSource;
  service_requested: string | null;
  service_id: string | null;
  status: LeadStatus;
  estimated_value: number | null;
  notes: string | null;
  assigned_to: string | null;
  preferred_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  business_id: string;
  slug: string;
  name: string;
  description: string;
  pricing_model: PricingModel;
  starting_price: number | null;
  price_unit: string | null;
  duration_minutes: number;
  active: boolean;
  highlights: string[];
  sort_order: number;
}

export interface Appointment {
  id: string;
  business_id: string;
  customer_id: string;
  lead_id: string | null;
  service_id: string | null;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes: string | null;
  source: LeadSource;
  external_calendar_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Call {
  id: string;
  business_id: string;
  customer_id: string | null;
  lead_id: string | null;
  provider: string;
  provider_call_id: string | null;
  direction: CallDirection;
  phone_number: string;
  started_at: string;
  ended_at: string | null;
  duration: number | null;
  status: CallStatus;
  transcript: string | null;
  summary: string | null;
  outcome: string | null;
  recording_url: string | null;
}

export interface Conversation {
  id: string;
  business_id: string;
  customer_id: string | null;
  lead_id: string | null;
  channel: Channel;
  status: ConversationStatus;
  subject: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  direction: MessageDirection;
  sender: MessageSender;
  body: string;
  provider_message_id: string | null;
  status: MessageStatus;
  created_at: string;
}

export interface Estimate {
  id: string;
  business_id: string;
  customer_id: string;
  lead_id: string | null;
  status: EstimateStatus;
  amount: number | null;
  notes: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

export interface AiAction {
  id: string;
  business_id: string;
  customer_id: string | null;
  conversation_id: string | null;
  action_type: string;
  input: unknown;
  output: unknown;
  success: boolean;
  error: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  business_id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  business_id: string | null;
  provider: string;
  provider_event_id: string;
  received_at: string;
}

export interface AnalyticsEvent {
  id: string;
  business_id: string;
  name: string;
  properties: Record<string, unknown>;
  created_at: string;
}
