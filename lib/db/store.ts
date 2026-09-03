import type {
  Address,
  AiAction,
  AnalyticsEvent,
  Appointment,
  AppointmentStatus,
  Business,
  Call,
  Conversation,
  Customer,
  Estimate,
  Lead,
  LeadStatus,
  Message,
  Notification,
  Service,
  User,
} from "@/lib/db/types";

type Timestamps = "created_at" | "updated_at";

export type NewCustomer = Omit<Customer, "id" | Timestamps> & Partial<Pick<Customer, "id" | Timestamps>>;
export type NewAddress = Omit<Address, "id"> & Partial<Pick<Address, "id">>;
export type NewLead = Omit<Lead, "id" | Timestamps> & Partial<Pick<Lead, "id" | Timestamps>>;
export type NewAppointment = Omit<Appointment, "id" | Timestamps> &
  Partial<Pick<Appointment, "id" | Timestamps>>;
export type NewCall = Omit<Call, "id"> & Partial<Pick<Call, "id">>;
export type NewConversation = Omit<Conversation, "id" | Timestamps> &
  Partial<Pick<Conversation, "id" | Timestamps>>;
export type NewMessage = Omit<Message, "id" | "created_at"> & Partial<Pick<Message, "id" | "created_at">>;
export type NewEstimate = Omit<Estimate, "id" | "created_at"> & Partial<Pick<Estimate, "id" | "created_at">>;
export type NewAiAction = Omit<AiAction, "id" | "created_at"> & Partial<Pick<AiAction, "id" | "created_at">>;
export type NewNotification = Omit<Notification, "id" | "created_at" | "read"> &
  Partial<Pick<Notification, "id" | "created_at" | "read">>;
export type NewAnalyticsEvent = Omit<AnalyticsEvent, "id" | "created_at"> &
  Partial<Pick<AnalyticsEvent, "id" | "created_at">>;

export interface LeadFilter {
  status?: LeadStatus | LeadStatus[];
  source?: string;
  search?: string;
  customerId?: string;
  assignedTo?: string;
  createdAfter?: string;
  limit?: number;
}

export interface AppointmentFilter {
  from?: string;
  to?: string;
  status?: AppointmentStatus | AppointmentStatus[];
  customerId?: string;
  leadId?: string;
  limit?: number;
}

export interface CallFilter {
  status?: string;
  customerId?: string;
  createdAfter?: string;
  limit?: number;
}

export interface ConversationFilter {
  channel?: string;
  status?: string;
  customerId?: string;
  limit?: number;
}

/**
 * The single seam between application code and persistence.
 *
 * Two implementations ship: an in-memory store (default; makes `npm run dev`
 * work with zero credentials) and a Supabase/Postgres store. Application and
 * service code must never import a driver directly.
 */
export interface DataStore {
  readonly kind: "memory" | "supabase";
  ready(): Promise<void>;

  // Businesses
  listBusinesses(): Promise<Business[]>;
  getBusinessById(id: string): Promise<Business | null>;
  getBusinessBySlug(slug: string): Promise<Business | null>;
  updateBusiness(id: string, patch: Partial<Business>): Promise<Business>;

  // Users
  listUsers(businessId: string): Promise<User[]>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByAuthId(authUserId: string): Promise<User | null>;

  // Services
  listServices(businessId: string, options?: { activeOnly?: boolean }): Promise<Service[]>;
  getServiceById(businessId: string, id: string): Promise<Service | null>;
  getServiceBySlug(businessId: string, slug: string): Promise<Service | null>;
  updateService(businessId: string, id: string, patch: Partial<Service>): Promise<Service>;

  // Customers
  createCustomer(input: NewCustomer): Promise<Customer>;
  updateCustomer(businessId: string, id: string, patch: Partial<Customer>): Promise<Customer>;
  getCustomerById(businessId: string, id: string): Promise<Customer | null>;
  findCustomerByPhone(businessId: string, phone: string): Promise<Customer | null>;
  findCustomerByEmail(businessId: string, email: string): Promise<Customer | null>;
  listCustomers(businessId: string, options?: { search?: string; limit?: number }): Promise<Customer[]>;

  // Addresses
  createAddress(input: NewAddress): Promise<Address>;
  listAddressesByCustomer(customerId: string): Promise<Address[]>;

  // Leads
  createLead(input: NewLead): Promise<Lead>;
  updateLead(businessId: string, id: string, patch: Partial<Lead>): Promise<Lead>;
  getLeadById(businessId: string, id: string): Promise<Lead | null>;
  listLeads(businessId: string, filter?: LeadFilter): Promise<Lead[]>;

  // Appointments
  createAppointment(input: NewAppointment): Promise<Appointment>;
  updateAppointment(businessId: string, id: string, patch: Partial<Appointment>): Promise<Appointment>;
  getAppointmentById(businessId: string, id: string): Promise<Appointment | null>;
  listAppointments(businessId: string, filter?: AppointmentFilter): Promise<Appointment[]>;

  // Calls
  createCall(input: NewCall): Promise<Call>;
  updateCall(businessId: string, id: string, patch: Partial<Call>): Promise<Call>;
  getCallById(businessId: string, id: string): Promise<Call | null>;
  getCallByProviderId(businessId: string, provider: string, providerCallId: string): Promise<Call | null>;
  listCalls(businessId: string, filter?: CallFilter): Promise<Call[]>;

  // Conversations + messages
  createConversation(input: NewConversation): Promise<Conversation>;
  updateConversation(businessId: string, id: string, patch: Partial<Conversation>): Promise<Conversation>;
  getConversationById(businessId: string, id: string): Promise<Conversation | null>;
  findOpenConversation(businessId: string, customerId: string, channel: string): Promise<Conversation | null>;
  listConversations(businessId: string, filter?: ConversationFilter): Promise<Conversation[]>;
  createMessage(input: NewMessage): Promise<Message>;
  listMessages(conversationId: string): Promise<Message[]>;
  findMessageByProviderId(providerMessageId: string): Promise<Message | null>;

  // Estimates
  createEstimate(input: NewEstimate): Promise<Estimate>;
  updateEstimate(businessId: string, id: string, patch: Partial<Estimate>): Promise<Estimate>;
  getEstimateById(businessId: string, id: string): Promise<Estimate | null>;
  listEstimates(businessId: string, options?: { limit?: number }): Promise<Estimate[]>;

  // AI actions (audit log)
  createAiAction(input: NewAiAction): Promise<AiAction>;
  listAiActions(businessId: string, options?: { limit?: number }): Promise<AiAction[]>;

  // Notifications
  createNotification(input: NewNotification): Promise<Notification>;
  listNotifications(businessId: string, options?: { limit?: number; unreadOnly?: boolean }): Promise<Notification[]>;
  markNotificationRead(businessId: string, id: string): Promise<void>;

  // Webhook idempotency — returns true when the event is new.
  recordWebhookEvent(provider: string, providerEventId: string, businessId?: string | null): Promise<boolean>;

  // Analytics
  recordAnalyticsEvent(input: NewAnalyticsEvent): Promise<void>;
  listAnalyticsEvents(businessId: string, options?: { limit?: number }): Promise<AnalyticsEvent[]>;
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} "${id}" not found`);
    this.name = "NotFoundError";
  }
}
