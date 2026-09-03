import { buildSeedData, type SeedData } from "@/lib/db/seed";
import { NotFoundError, type DataStore } from "@/lib/db/store";
import type {
  AppointmentFilter,
  CallFilter,
  ConversationFilter,
  LeadFilter,
  NewAddress,
  NewAiAction,
  NewAnalyticsEvent,
  NewAppointment,
  NewCall,
  NewConversation,
  NewCustomer,
  NewEstimate,
  NewLead,
  NewMessage,
  NewNotification,
} from "@/lib/db/store";
import type {
  Address,
  AiAction,
  AnalyticsEvent,
  Appointment,
  Business,
  Call,
  Conversation,
  Customer,
  Estimate,
  Lead,
  Message,
  Notification,
  Service,
  User,
} from "@/lib/db/types";
import { newId } from "@/lib/utils/id";
import { normalizeEmail, normalizePhone } from "@/lib/utils/phone";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function toArray<T>(value: T | T[] | undefined): T[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

function byCreatedDesc(a: { created_at: string }, b: { created_at: string }) {
  return b.created_at.localeCompare(a.created_at);
}

/**
 * In-process data store. This is the default so the whole product — website,
 * CRM, chat, booking, webhooks — runs with `npm run dev` and no credentials.
 *
 * It is intentionally not durable: restart the server and you are back to the
 * seeded demo dataset. Point `DATA_STORE=supabase` at a real database for
 * anything that needs to persist.
 */
export class MemoryStore implements DataStore {
  readonly kind = "memory" as const;

  private data: SeedData;
  private webhookEvents = new Set<string>();

  constructor(seed: SeedData = buildSeedData()) {
    this.data = clone(seed);
  }

  async ready() {
    /* nothing to warm up */
  }

  /** Test helper — restores the seeded dataset. */
  reset(seed: SeedData = buildSeedData()) {
    this.data = clone(seed);
    this.webhookEvents.clear();
  }

  // ---------------------------------------------------------------- businesses

  async listBusinesses(): Promise<Business[]> {
    return clone(this.data.businesses);
  }

  async getBusinessById(id: string): Promise<Business | null> {
    return clone(this.data.businesses.find((b) => b.id === id) ?? null);
  }

  async getBusinessBySlug(slug: string): Promise<Business | null> {
    return clone(this.data.businesses.find((b) => b.slug === slug) ?? null);
  }

  async updateBusiness(id: string, patch: Partial<Business>): Promise<Business> {
    const index = this.data.businesses.findIndex((b) => b.id === id);
    if (index === -1) throw new NotFoundError("Business", id);
    const next = { ...this.data.businesses[index], ...patch, id, updated_at: new Date().toISOString() };
    this.data.businesses[index] = next;
    return clone(next);
  }

  // -------------------------------------------------------------------- users

  async listUsers(businessId: string): Promise<User[]> {
    return clone(this.data.users.filter((u) => u.business_id === businessId));
  }

  async getUserById(id: string): Promise<User | null> {
    return clone(this.data.users.find((u) => u.id === id) ?? null);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const normalized = normalizeEmail(email);
    return clone(this.data.users.find((u) => normalizeEmail(u.email) === normalized) ?? null);
  }

  async getUserByAuthId(authUserId: string): Promise<User | null> {
    return clone(this.data.users.find((u) => u.auth_user_id === authUserId) ?? null);
  }

  // ----------------------------------------------------------------- services

  async listServices(businessId: string, options?: { activeOnly?: boolean }): Promise<Service[]> {
    const rows = this.data.services
      .filter((s) => s.business_id === businessId)
      .filter((s) => (options?.activeOnly ? s.active : true))
      .sort((a, b) => a.sort_order - b.sort_order);
    return clone(rows);
  }

  async getServiceById(businessId: string, id: string): Promise<Service | null> {
    return clone(this.data.services.find((s) => s.business_id === businessId && s.id === id) ?? null);
  }

  async getServiceBySlug(businessId: string, slug: string): Promise<Service | null> {
    return clone(this.data.services.find((s) => s.business_id === businessId && s.slug === slug) ?? null);
  }

  async updateService(businessId: string, id: string, patch: Partial<Service>): Promise<Service> {
    const index = this.data.services.findIndex((s) => s.business_id === businessId && s.id === id);
    if (index === -1) throw new NotFoundError("Service", id);
    const next = { ...this.data.services[index], ...patch, id, business_id: businessId };
    this.data.services[index] = next;
    return clone(next);
  }

  // ---------------------------------------------------------------- customers

  async createCustomer(input: NewCustomer): Promise<Customer> {
    const now = new Date().toISOString();
    const row: Customer = {
      ...input,
      id: input.id ?? newId(),
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    };
    this.data.customers.push(row);
    return clone(row);
  }

  async updateCustomer(businessId: string, id: string, patch: Partial<Customer>): Promise<Customer> {
    const index = this.data.customers.findIndex((c) => c.business_id === businessId && c.id === id);
    if (index === -1) throw new NotFoundError("Customer", id);
    const next = {
      ...this.data.customers[index],
      ...patch,
      id,
      business_id: businessId,
      updated_at: new Date().toISOString(),
    };
    this.data.customers[index] = next;
    return clone(next);
  }

  async getCustomerById(businessId: string, id: string): Promise<Customer | null> {
    return clone(this.data.customers.find((c) => c.business_id === businessId && c.id === id) ?? null);
  }

  async findCustomerByPhone(businessId: string, phone: string): Promise<Customer | null> {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    return clone(
      this.data.customers.find(
        (c) => c.business_id === businessId && normalizePhone(c.phone) === normalized,
      ) ?? null,
    );
  }

  async findCustomerByEmail(businessId: string, email: string): Promise<Customer | null> {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    return clone(
      this.data.customers.find(
        (c) => c.business_id === businessId && normalizeEmail(c.email) === normalized,
      ) ?? null,
    );
  }

  async listCustomers(businessId: string, options?: { search?: string; limit?: number }): Promise<Customer[]> {
    let rows = this.data.customers.filter((c) => c.business_id === businessId);

    const search = options?.search?.trim().toLowerCase();
    if (search) {
      rows = rows.filter((c) =>
        [c.first_name, c.last_name, c.email, c.phone]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(search)),
      );
    }

    rows = rows.sort(byCreatedDesc);
    return clone(options?.limit ? rows.slice(0, options.limit) : rows);
  }

  // ---------------------------------------------------------------- addresses

  async createAddress(input: NewAddress): Promise<Address> {
    const row: Address = { ...input, id: input.id ?? newId() };
    this.data.addresses.push(row);
    return clone(row);
  }

  async listAddressesByCustomer(customerId: string): Promise<Address[]> {
    return clone(this.data.addresses.filter((a) => a.customer_id === customerId));
  }

  // -------------------------------------------------------------------- leads

  async createLead(input: NewLead): Promise<Lead> {
    const now = new Date().toISOString();
    const row: Lead = {
      ...input,
      id: input.id ?? newId(),
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    };
    this.data.leads.push(row);
    return clone(row);
  }

  async updateLead(businessId: string, id: string, patch: Partial<Lead>): Promise<Lead> {
    const index = this.data.leads.findIndex((l) => l.business_id === businessId && l.id === id);
    if (index === -1) throw new NotFoundError("Lead", id);
    const next = {
      ...this.data.leads[index],
      ...patch,
      id,
      business_id: businessId,
      updated_at: new Date().toISOString(),
    };
    this.data.leads[index] = next;
    return clone(next);
  }

  async getLeadById(businessId: string, id: string): Promise<Lead | null> {
    return clone(this.data.leads.find((l) => l.business_id === businessId && l.id === id) ?? null);
  }

  async listLeads(businessId: string, filter: LeadFilter = {}): Promise<Lead[]> {
    let rows = this.data.leads.filter((l) => l.business_id === businessId);

    const statuses = toArray(filter.status);
    if (statuses) rows = rows.filter((l) => statuses.includes(l.status));
    if (filter.source) rows = rows.filter((l) => l.source === filter.source);
    if (filter.customerId) rows = rows.filter((l) => l.customer_id === filter.customerId);
    if (filter.assignedTo) rows = rows.filter((l) => l.assigned_to === filter.assignedTo);
    if (filter.createdAfter) rows = rows.filter((l) => l.created_at >= filter.createdAfter!);

    const search = filter.search?.trim().toLowerCase();
    if (search) {
      const customerIds = new Set(
        this.data.customers
          .filter(
            (c) =>
              c.business_id === businessId &&
              [c.first_name, c.last_name, c.email, c.phone]
                .filter(Boolean)
                .some((field) => String(field).toLowerCase().includes(search)),
          )
          .map((c) => c.id),
      );
      rows = rows.filter(
        (l) =>
          customerIds.has(l.customer_id) ||
          (l.service_requested ?? "").toLowerCase().includes(search) ||
          (l.notes ?? "").toLowerCase().includes(search),
      );
    }

    rows = rows.sort(byCreatedDesc);
    return clone(filter.limit ? rows.slice(0, filter.limit) : rows);
  }

  // ------------------------------------------------------------- appointments

  async createAppointment(input: NewAppointment): Promise<Appointment> {
    const now = new Date().toISOString();
    const row: Appointment = {
      ...input,
      id: input.id ?? newId(),
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    };
    this.data.appointments.push(row);
    return clone(row);
  }

  async updateAppointment(businessId: string, id: string, patch: Partial<Appointment>): Promise<Appointment> {
    const index = this.data.appointments.findIndex((a) => a.business_id === businessId && a.id === id);
    if (index === -1) throw new NotFoundError("Appointment", id);
    const next = {
      ...this.data.appointments[index],
      ...patch,
      id,
      business_id: businessId,
      updated_at: new Date().toISOString(),
    };
    this.data.appointments[index] = next;
    return clone(next);
  }

  async getAppointmentById(businessId: string, id: string): Promise<Appointment | null> {
    return clone(this.data.appointments.find((a) => a.business_id === businessId && a.id === id) ?? null);
  }

  async listAppointments(businessId: string, filter: AppointmentFilter = {}): Promise<Appointment[]> {
    let rows = this.data.appointments.filter((a) => a.business_id === businessId);

    const statuses = toArray(filter.status);
    if (statuses) rows = rows.filter((a) => statuses.includes(a.status));
    if (filter.customerId) rows = rows.filter((a) => a.customer_id === filter.customerId);
    if (filter.leadId) rows = rows.filter((a) => a.lead_id === filter.leadId);
    // Overlap semantics: any appointment intersecting [from, to).
    if (filter.from) rows = rows.filter((a) => a.end_time > filter.from!);
    if (filter.to) rows = rows.filter((a) => a.start_time < filter.to!);

    rows = rows.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return clone(filter.limit ? rows.slice(0, filter.limit) : rows);
  }

  // -------------------------------------------------------------------- calls

  async createCall(input: NewCall): Promise<Call> {
    const row: Call = { ...input, id: input.id ?? newId() };
    this.data.calls.push(row);
    return clone(row);
  }

  async updateCall(businessId: string, id: string, patch: Partial<Call>): Promise<Call> {
    const index = this.data.calls.findIndex((c) => c.business_id === businessId && c.id === id);
    if (index === -1) throw new NotFoundError("Call", id);
    const next = { ...this.data.calls[index], ...patch, id, business_id: businessId };
    this.data.calls[index] = next;
    return clone(next);
  }

  async getCallById(businessId: string, id: string): Promise<Call | null> {
    return clone(this.data.calls.find((c) => c.business_id === businessId && c.id === id) ?? null);
  }

  async getCallByProviderId(businessId: string, provider: string, providerCallId: string): Promise<Call | null> {
    return clone(
      this.data.calls.find(
        (c) => c.business_id === businessId && c.provider === provider && c.provider_call_id === providerCallId,
      ) ?? null,
    );
  }

  async listCalls(businessId: string, filter: CallFilter = {}): Promise<Call[]> {
    let rows = this.data.calls.filter((c) => c.business_id === businessId);
    if (filter.status) rows = rows.filter((c) => c.status === filter.status);
    if (filter.customerId) rows = rows.filter((c) => c.customer_id === filter.customerId);
    if (filter.createdAfter) rows = rows.filter((c) => c.started_at >= filter.createdAfter!);

    rows = rows.sort((a, b) => b.started_at.localeCompare(a.started_at));
    return clone(filter.limit ? rows.slice(0, filter.limit) : rows);
  }

  // ------------------------------------------------- conversations + messages

  async createConversation(input: NewConversation): Promise<Conversation> {
    const now = new Date().toISOString();
    const row: Conversation = {
      ...input,
      id: input.id ?? newId(),
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    };
    this.data.conversations.push(row);
    return clone(row);
  }

  async updateConversation(businessId: string, id: string, patch: Partial<Conversation>): Promise<Conversation> {
    const index = this.data.conversations.findIndex((c) => c.business_id === businessId && c.id === id);
    if (index === -1) throw new NotFoundError("Conversation", id);
    const next = {
      ...this.data.conversations[index],
      ...patch,
      id,
      business_id: businessId,
      updated_at: new Date().toISOString(),
    };
    this.data.conversations[index] = next;
    return clone(next);
  }

  async getConversationById(businessId: string, id: string): Promise<Conversation | null> {
    return clone(this.data.conversations.find((c) => c.business_id === businessId && c.id === id) ?? null);
  }

  async findOpenConversation(businessId: string, customerId: string, channel: string): Promise<Conversation | null> {
    const rows = this.data.conversations
      .filter(
        (c) =>
          c.business_id === businessId &&
          c.customer_id === customerId &&
          c.channel === channel &&
          c.status !== "closed",
      )
      .sort(byCreatedDesc);
    return clone(rows[0] ?? null);
  }

  async listConversations(businessId: string, filter: ConversationFilter = {}): Promise<Conversation[]> {
    let rows = this.data.conversations.filter((c) => c.business_id === businessId);
    if (filter.channel) rows = rows.filter((c) => c.channel === filter.channel);
    if (filter.status) rows = rows.filter((c) => c.status === filter.status);
    if (filter.customerId) rows = rows.filter((c) => c.customer_id === filter.customerId);

    rows = rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return clone(filter.limit ? rows.slice(0, filter.limit) : rows);
  }

  async createMessage(input: NewMessage): Promise<Message> {
    const row: Message = {
      ...input,
      id: input.id ?? newId(),
      created_at: input.created_at ?? new Date().toISOString(),
    };
    this.data.messages.push(row);

    const conversation = this.data.conversations.find((c) => c.id === row.conversation_id);
    if (conversation) conversation.updated_at = row.created_at;

    return clone(row);
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    return clone(
      this.data.messages
        .filter((m) => m.conversation_id === conversationId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    );
  }

  async findMessageByProviderId(providerMessageId: string): Promise<Message | null> {
    return clone(this.data.messages.find((m) => m.provider_message_id === providerMessageId) ?? null);
  }

  // ---------------------------------------------------------------- estimates

  async createEstimate(input: NewEstimate): Promise<Estimate> {
    const row: Estimate = {
      ...input,
      id: input.id ?? newId(),
      created_at: input.created_at ?? new Date().toISOString(),
    };
    this.data.estimates.push(row);
    return clone(row);
  }

  async updateEstimate(businessId: string, id: string, patch: Partial<Estimate>): Promise<Estimate> {
    const index = this.data.estimates.findIndex((e) => e.business_id === businessId && e.id === id);
    if (index === -1) throw new NotFoundError("Estimate", id);
    const next = { ...this.data.estimates[index], ...patch, id, business_id: businessId };
    this.data.estimates[index] = next;
    return clone(next);
  }

  async getEstimateById(businessId: string, id: string): Promise<Estimate | null> {
    return clone(this.data.estimates.find((e) => e.business_id === businessId && e.id === id) ?? null);
  }

  async listEstimates(businessId: string, options?: { limit?: number }): Promise<Estimate[]> {
    const rows = this.data.estimates.filter((e) => e.business_id === businessId).sort(byCreatedDesc);
    return clone(options?.limit ? rows.slice(0, options.limit) : rows);
  }

  // --------------------------------------------------------------- ai actions

  async createAiAction(input: NewAiAction): Promise<AiAction> {
    const row: AiAction = {
      ...input,
      id: input.id ?? newId(),
      created_at: input.created_at ?? new Date().toISOString(),
    };
    this.data.aiActions.push(row);
    return clone(row);
  }

  async listAiActions(businessId: string, options?: { limit?: number }): Promise<AiAction[]> {
    const rows = this.data.aiActions.filter((a) => a.business_id === businessId).sort(byCreatedDesc);
    return clone(options?.limit ? rows.slice(0, options.limit) : rows);
  }

  // ------------------------------------------------------------ notifications

  async createNotification(input: NewNotification): Promise<Notification> {
    const row: Notification = {
      ...input,
      id: input.id ?? newId(),
      read: input.read ?? false,
      created_at: input.created_at ?? new Date().toISOString(),
    };
    this.data.notifications.push(row);
    return clone(row);
  }

  async listNotifications(
    businessId: string,
    options?: { limit?: number; unreadOnly?: boolean },
  ): Promise<Notification[]> {
    let rows = this.data.notifications.filter((n) => n.business_id === businessId);
    if (options?.unreadOnly) rows = rows.filter((n) => !n.read);
    rows = rows.sort(byCreatedDesc);
    return clone(options?.limit ? rows.slice(0, options.limit) : rows);
  }

  async markNotificationRead(businessId: string, id: string): Promise<void> {
    const row = this.data.notifications.find((n) => n.business_id === businessId && n.id === id);
    if (row) row.read = true;
  }

  // ----------------------------------------------------------------- webhooks

  // `businessId` is part of the interface (the Supabase store persists it for
  // auditing); the in-memory ledger only needs the de-duplication key.
  async recordWebhookEvent(
    provider: string,
    providerEventId: string,
    _businessId?: string | null,
  ): Promise<boolean> {
    const key = `${provider}:${providerEventId}`;
    if (this.webhookEvents.has(key)) return false;
    this.webhookEvents.add(key);
    return true;
  }

  // ---------------------------------------------------------------- analytics

  async recordAnalyticsEvent(input: NewAnalyticsEvent): Promise<void> {
    this.data.analyticsEvents.push({
      ...input,
      id: input.id ?? newId(),
      created_at: input.created_at ?? new Date().toISOString(),
    });
  }

  async listAnalyticsEvents(businessId: string, options?: { limit?: number }): Promise<AnalyticsEvent[]> {
    const rows = this.data.analyticsEvents.filter((e) => e.business_id === businessId).sort(byCreatedDesc);
    return clone(options?.limit ? rows.slice(0, options.limit) : rows);
  }
}
