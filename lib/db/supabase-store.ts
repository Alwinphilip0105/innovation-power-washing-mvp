import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env, supabaseUrl } from "@/lib/env";
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
import { normalizeEmail, normalizePhone } from "@/lib/utils/phone";

/**
 * Postgres-backed store via Supabase.
 *
 * It uses the service-role key and therefore bypasses RLS: authorization is
 * enforced in `lib/auth` + the service layer before anything reaches here, and
 * every query is still scoped by `business_id`. RLS remains enabled on the
 * tables as defence in depth for any client that talks to Supabase directly.
 * The service-role key is server-only and is never sent to the browser.
 */
export class SupabaseStore implements DataStore {
  readonly kind = "supabase" as const;

  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    if (client) {
      this.client = client;
      return;
    }
    if (!supabaseUrl || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "SupabaseStore requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Unset DATA_STORE to fall back to the in-memory store.",
      );
    }
    this.client = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async ready() {
    const { error } = await this.client.from("businesses").select("id").limit(1);
    if (error) throw new Error(`Supabase is not reachable or migrations have not been applied: ${error.message}`);
  }

  private table(name: string) {
    return this.client.from(name);
  }

  private static unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }, what: string): T {
    if (error) throw new Error(`${what}: ${error.message}`);
    if (data === null) throw new Error(`${what}: no data returned`);
    return data;
  }

  private static unwrapMaybe<T>({
    data,
    error,
  }: {
    data: T | null;
    error: { message: string; code?: string } | null;
  }): T | null {
    if (error) {
      // PGRST116 = "no rows" from `.single()`; treat as a miss, not a failure.
      if (error.code === "PGRST116") return null;
      throw new Error(error.message);
    }
    return data;
  }

  // ---------------------------------------------------------------- businesses

  async listBusinesses(): Promise<Business[]> {
    const result = await this.table("businesses").select("*").order("name");
    return SupabaseStore.unwrap(result, "listBusinesses") as Business[];
  }

  async getBusinessById(id: string): Promise<Business | null> {
    return SupabaseStore.unwrapMaybe(await this.table("businesses").select("*").eq("id", id).single());
  }

  async getBusinessBySlug(slug: string): Promise<Business | null> {
    return SupabaseStore.unwrapMaybe(await this.table("businesses").select("*").eq("slug", slug).single());
  }

  async updateBusiness(id: string, patch: Partial<Business>): Promise<Business> {
    const result = await this.table("businesses")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    const row = SupabaseStore.unwrapMaybe(result);
    if (!row) throw new NotFoundError("Business", id);
    return row as Business;
  }

  // -------------------------------------------------------------------- users

  async listUsers(businessId: string): Promise<User[]> {
    const result = await this.table("users").select("*").eq("business_id", businessId).order("created_at");
    return SupabaseStore.unwrap(result, "listUsers") as User[];
  }

  async getUserById(id: string): Promise<User | null> {
    return SupabaseStore.unwrapMaybe(await this.table("users").select("*").eq("id", id).single());
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    return SupabaseStore.unwrapMaybe(await this.table("users").select("*").ilike("email", normalized).single());
  }

  async getUserByAuthId(authUserId: string): Promise<User | null> {
    return SupabaseStore.unwrapMaybe(
      await this.table("users").select("*").eq("auth_user_id", authUserId).single(),
    );
  }

  // ----------------------------------------------------------------- services

  async listServices(businessId: string, options?: { activeOnly?: boolean }): Promise<Service[]> {
    let query = this.table("services").select("*").eq("business_id", businessId);
    if (options?.activeOnly) query = query.eq("active", true);
    const result = await query.order("sort_order");
    return SupabaseStore.unwrap(result, "listServices") as Service[];
  }

  async getServiceById(businessId: string, id: string): Promise<Service | null> {
    return SupabaseStore.unwrapMaybe(
      await this.table("services").select("*").eq("business_id", businessId).eq("id", id).single(),
    );
  }

  async getServiceBySlug(businessId: string, slug: string): Promise<Service | null> {
    return SupabaseStore.unwrapMaybe(
      await this.table("services").select("*").eq("business_id", businessId).eq("slug", slug).single(),
    );
  }

  async updateService(businessId: string, id: string, patch: Partial<Service>): Promise<Service> {
    const result = await this.table("services")
      .update(patch)
      .eq("business_id", businessId)
      .eq("id", id)
      .select()
      .single();
    const row = SupabaseStore.unwrapMaybe(result);
    if (!row) throw new NotFoundError("Service", id);
    return row as Service;
  }

  // ---------------------------------------------------------------- customers

  async createCustomer(input: NewCustomer): Promise<Customer> {
    const result = await this.table("customers").insert(input).select().single();
    return SupabaseStore.unwrap(result, "createCustomer") as Customer;
  }

  async updateCustomer(businessId: string, id: string, patch: Partial<Customer>): Promise<Customer> {
    const result = await this.table("customers")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("business_id", businessId)
      .eq("id", id)
      .select()
      .single();
    const row = SupabaseStore.unwrapMaybe(result);
    if (!row) throw new NotFoundError("Customer", id);
    return row as Customer;
  }

  async getCustomerById(businessId: string, id: string): Promise<Customer | null> {
    return SupabaseStore.unwrapMaybe(
      await this.table("customers").select("*").eq("business_id", businessId).eq("id", id).single(),
    );
  }

  async findCustomerByPhone(businessId: string, phone: string): Promise<Customer | null> {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    return SupabaseStore.unwrapMaybe(
      await this.table("customers").select("*").eq("business_id", businessId).eq("phone", normalized).limit(1).single(),
    );
  }

  async findCustomerByEmail(businessId: string, email: string): Promise<Customer | null> {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    return SupabaseStore.unwrapMaybe(
      await this.table("customers").select("*").eq("business_id", businessId).eq("email", normalized).limit(1).single(),
    );
  }

  async listCustomers(businessId: string, options?: { search?: string; limit?: number }): Promise<Customer[]> {
    let query = this.table("customers").select("*").eq("business_id", businessId);
    const search = options?.search?.trim();
    if (search) {
      const escaped = search.replace(/[%,()]/g, "");
      query = query.or(
        `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%`,
      );
    }
    const result = await query.order("created_at", { ascending: false }).limit(options?.limit ?? 200);
    return SupabaseStore.unwrap(result, "listCustomers") as Customer[];
  }

  // ---------------------------------------------------------------- addresses

  async createAddress(input: NewAddress): Promise<Address> {
    const result = await this.table("addresses").insert(input).select().single();
    return SupabaseStore.unwrap(result, "createAddress") as Address;
  }

  async listAddressesByCustomer(customerId: string): Promise<Address[]> {
    const result = await this.table("addresses").select("*").eq("customer_id", customerId);
    return SupabaseStore.unwrap(result, "listAddressesByCustomer") as Address[];
  }

  // -------------------------------------------------------------------- leads

  async createLead(input: NewLead): Promise<Lead> {
    const result = await this.table("leads").insert(input).select().single();
    return SupabaseStore.unwrap(result, "createLead") as Lead;
  }

  async updateLead(businessId: string, id: string, patch: Partial<Lead>): Promise<Lead> {
    const result = await this.table("leads")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("business_id", businessId)
      .eq("id", id)
      .select()
      .single();
    const row = SupabaseStore.unwrapMaybe(result);
    if (!row) throw new NotFoundError("Lead", id);
    return row as Lead;
  }

  async getLeadById(businessId: string, id: string): Promise<Lead | null> {
    return SupabaseStore.unwrapMaybe(
      await this.table("leads").select("*").eq("business_id", businessId).eq("id", id).single(),
    );
  }

  async listLeads(businessId: string, filter: LeadFilter = {}): Promise<Lead[]> {
    let query = this.table("leads").select("*").eq("business_id", businessId);

    if (filter.status) {
      query = Array.isArray(filter.status) ? query.in("status", filter.status) : query.eq("status", filter.status);
    }
    if (filter.source) query = query.eq("source", filter.source);
    if (filter.customerId) query = query.eq("customer_id", filter.customerId);
    if (filter.assignedTo) query = query.eq("assigned_to", filter.assignedTo);
    if (filter.createdAfter) query = query.gte("created_at", filter.createdAfter);
    if (filter.search) {
      const escaped = filter.search.replace(/[%,()]/g, "");
      query = query.or(`service_requested.ilike.%${escaped}%,notes.ilike.%${escaped}%`);
    }

    const result = await query.order("created_at", { ascending: false }).limit(filter.limit ?? 500);
    return SupabaseStore.unwrap(result, "listLeads") as Lead[];
  }

  // ------------------------------------------------------------- appointments

  async createAppointment(input: NewAppointment): Promise<Appointment> {
    const result = await this.table("appointments").insert(input).select().single();
    return SupabaseStore.unwrap(result, "createAppointment") as Appointment;
  }

  async updateAppointment(businessId: string, id: string, patch: Partial<Appointment>): Promise<Appointment> {
    const result = await this.table("appointments")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("business_id", businessId)
      .eq("id", id)
      .select()
      .single();
    const row = SupabaseStore.unwrapMaybe(result);
    if (!row) throw new NotFoundError("Appointment", id);
    return row as Appointment;
  }

  async getAppointmentById(businessId: string, id: string): Promise<Appointment | null> {
    return SupabaseStore.unwrapMaybe(
      await this.table("appointments").select("*").eq("business_id", businessId).eq("id", id).single(),
    );
  }

  async listAppointments(businessId: string, filter: AppointmentFilter = {}): Promise<Appointment[]> {
    let query = this.table("appointments").select("*").eq("business_id", businessId);

    if (filter.status) {
      query = Array.isArray(filter.status) ? query.in("status", filter.status) : query.eq("status", filter.status);
    }
    if (filter.customerId) query = query.eq("customer_id", filter.customerId);
    if (filter.leadId) query = query.eq("lead_id", filter.leadId);
    if (filter.from) query = query.gt("end_time", filter.from);
    if (filter.to) query = query.lt("start_time", filter.to);

    const result = await query.order("start_time").limit(filter.limit ?? 500);
    return SupabaseStore.unwrap(result, "listAppointments") as Appointment[];
  }

  // -------------------------------------------------------------------- calls

  async createCall(input: NewCall): Promise<Call> {
    const result = await this.table("calls").insert(input).select().single();
    return SupabaseStore.unwrap(result, "createCall") as Call;
  }

  async updateCall(businessId: string, id: string, patch: Partial<Call>): Promise<Call> {
    const result = await this.table("calls")
      .update(patch)
      .eq("business_id", businessId)
      .eq("id", id)
      .select()
      .single();
    const row = SupabaseStore.unwrapMaybe(result);
    if (!row) throw new NotFoundError("Call", id);
    return row as Call;
  }

  async getCallById(businessId: string, id: string): Promise<Call | null> {
    return SupabaseStore.unwrapMaybe(
      await this.table("calls").select("*").eq("business_id", businessId).eq("id", id).single(),
    );
  }

  async getCallByProviderId(businessId: string, provider: string, providerCallId: string): Promise<Call | null> {
    return SupabaseStore.unwrapMaybe(
      await this.table("calls")
        .select("*")
        .eq("business_id", businessId)
        .eq("provider", provider)
        .eq("provider_call_id", providerCallId)
        .limit(1)
        .single(),
    );
  }

  async listCalls(businessId: string, filter: CallFilter = {}): Promise<Call[]> {
    let query = this.table("calls").select("*").eq("business_id", businessId);
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.customerId) query = query.eq("customer_id", filter.customerId);
    if (filter.createdAfter) query = query.gte("started_at", filter.createdAfter);

    const result = await query.order("started_at", { ascending: false }).limit(filter.limit ?? 200);
    return SupabaseStore.unwrap(result, "listCalls") as Call[];
  }

  // ------------------------------------------------- conversations + messages

  async createConversation(input: NewConversation): Promise<Conversation> {
    const result = await this.table("conversations").insert(input).select().single();
    return SupabaseStore.unwrap(result, "createConversation") as Conversation;
  }

  async updateConversation(businessId: string, id: string, patch: Partial<Conversation>): Promise<Conversation> {
    const result = await this.table("conversations")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("business_id", businessId)
      .eq("id", id)
      .select()
      .single();
    const row = SupabaseStore.unwrapMaybe(result);
    if (!row) throw new NotFoundError("Conversation", id);
    return row as Conversation;
  }

  async getConversationById(businessId: string, id: string): Promise<Conversation | null> {
    return SupabaseStore.unwrapMaybe(
      await this.table("conversations").select("*").eq("business_id", businessId).eq("id", id).single(),
    );
  }

  async findOpenConversation(businessId: string, customerId: string, channel: string): Promise<Conversation | null> {
    return SupabaseStore.unwrapMaybe(
      await this.table("conversations")
        .select("*")
        .eq("business_id", businessId)
        .eq("customer_id", customerId)
        .eq("channel", channel)
        .neq("status", "closed")
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
    );
  }

  async listConversations(businessId: string, filter: ConversationFilter = {}): Promise<Conversation[]> {
    let query = this.table("conversations").select("*").eq("business_id", businessId);
    if (filter.channel) query = query.eq("channel", filter.channel);
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.customerId) query = query.eq("customer_id", filter.customerId);

    const result = await query.order("updated_at", { ascending: false }).limit(filter.limit ?? 200);
    return SupabaseStore.unwrap(result, "listConversations") as Conversation[];
  }

  async createMessage(input: NewMessage): Promise<Message> {
    const result = await this.table("messages").insert(input).select().single();
    const row = SupabaseStore.unwrap(result, "createMessage") as Message;
    await this.table("conversations")
      .update({ updated_at: row.created_at })
      .eq("id", row.conversation_id);
    return row;
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    const result = await this.table("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at");
    return SupabaseStore.unwrap(result, "listMessages") as Message[];
  }

  async findMessageByProviderId(providerMessageId: string): Promise<Message | null> {
    return SupabaseStore.unwrapMaybe(
      await this.table("messages").select("*").eq("provider_message_id", providerMessageId).limit(1).single(),
    );
  }

  // ---------------------------------------------------------------- estimates

  async createEstimate(input: NewEstimate): Promise<Estimate> {
    const result = await this.table("estimates").insert(input).select().single();
    return SupabaseStore.unwrap(result, "createEstimate") as Estimate;
  }

  async updateEstimate(businessId: string, id: string, patch: Partial<Estimate>): Promise<Estimate> {
    const result = await this.table("estimates")
      .update(patch)
      .eq("business_id", businessId)
      .eq("id", id)
      .select()
      .single();
    const row = SupabaseStore.unwrapMaybe(result);
    if (!row) throw new NotFoundError("Estimate", id);
    return row as Estimate;
  }

  async getEstimateById(businessId: string, id: string): Promise<Estimate | null> {
    return SupabaseStore.unwrapMaybe(
      await this.table("estimates").select("*").eq("business_id", businessId).eq("id", id).single(),
    );
  }

  async listEstimates(businessId: string, options?: { limit?: number }): Promise<Estimate[]> {
    const result = await this.table("estimates")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? 200);
    return SupabaseStore.unwrap(result, "listEstimates") as Estimate[];
  }

  // --------------------------------------------------------------- ai actions

  async createAiAction(input: NewAiAction): Promise<AiAction> {
    const result = await this.table("ai_actions").insert(input).select().single();
    return SupabaseStore.unwrap(result, "createAiAction") as AiAction;
  }

  async listAiActions(businessId: string, options?: { limit?: number }): Promise<AiAction[]> {
    const result = await this.table("ai_actions")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? 100);
    return SupabaseStore.unwrap(result, "listAiActions") as AiAction[];
  }

  // ------------------------------------------------------------ notifications

  async createNotification(input: NewNotification): Promise<Notification> {
    const result = await this.table("notifications")
      .insert({ read: false, ...input })
      .select()
      .single();
    return SupabaseStore.unwrap(result, "createNotification") as Notification;
  }

  async listNotifications(
    businessId: string,
    options?: { limit?: number; unreadOnly?: boolean },
  ): Promise<Notification[]> {
    let query = this.table("notifications").select("*").eq("business_id", businessId);
    if (options?.unreadOnly) query = query.eq("read", false);
    const result = await query.order("created_at", { ascending: false }).limit(options?.limit ?? 100);
    return SupabaseStore.unwrap(result, "listNotifications") as Notification[];
  }

  async markNotificationRead(businessId: string, id: string): Promise<void> {
    await this.table("notifications").update({ read: true }).eq("business_id", businessId).eq("id", id);
  }

  // ----------------------------------------------------------------- webhooks

  async recordWebhookEvent(
    provider: string,
    providerEventId: string,
    businessId?: string | null,
  ): Promise<boolean> {
    const { error } = await this.table("webhook_events").insert({
      provider,
      provider_event_id: providerEventId,
      business_id: businessId ?? null,
    });

    // 23505 = unique violation -> we have seen this event already.
    if (error) {
      if (error.code === "23505") return false;
      throw new Error(`recordWebhookEvent: ${error.message}`);
    }
    return true;
  }

  // ---------------------------------------------------------------- analytics

  async recordAnalyticsEvent(input: NewAnalyticsEvent): Promise<void> {
    const { error } = await this.table("analytics_events").insert(input);
    if (error) throw new Error(`recordAnalyticsEvent: ${error.message}`);
  }

  async listAnalyticsEvents(businessId: string, options?: { limit?: number }): Promise<AnalyticsEvent[]> {
    const result = await this.table("analytics_events")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? 200);
    return SupabaseStore.unwrap(result, "listAnalyticsEvents") as AnalyticsEvent[];
  }
}
