import {
  DEFAULT_BUSINESS_SLUG,
  INNOVATION_BUSINESS_ID,
  innovationPowerWashing,
  innovationServices,
} from "@/lib/config/business";
import { stableId } from "@/lib/utils/id";
import { addDaysIso, parseZonedDateTime, toZonedDateIso, weekdayIn } from "@/lib/utils/datetime";
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

export interface SeedData {
  businesses: Business[];
  users: User[];
  services: Service[];
  customers: Customer[];
  addresses: Address[];
  leads: Lead[];
  appointments: Appointment[];
  calls: Call[];
  conversations: Conversation[];
  messages: Message[];
  estimates: Estimate[];
  aiActions: AiAction[];
  notifications: Notification[];
  analyticsEvents: AnalyticsEvent[];
}

const BID = INNOVATION_BUSINESS_ID;
const TZ = innovationPowerWashing.timezone;

const id = (kind: string, key: string) => stableId(kind, `${DEFAULT_BUSINESS_SLUG}:${key}`);
const serviceId = (slug: string) => id("service", slug);

function hoursAgo(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString();
}

function daysAgo(now: Date, days: number): string {
  return hoursAgo(now, days * 24);
}

/** Nth open day (Mon–Sat) at or after `offsetDays` from today, in business time. */
function upcomingOpenDate(now: Date, offsetDays: number): string {
  let dateIso = addDaysIso(toZonedDateIso(now, TZ), offsetDays);
  for (let guard = 0; guard < 14; guard += 1) {
    const probe = parseZonedDateTime(dateIso, "12:00", TZ);
    if (weekdayIn(probe, TZ) !== "sun") return dateIso;
    dateIso = addDaysIso(dateIso, 1);
  }
  return dateIso;
}

function pastOpenDate(now: Date, offsetDays: number): string {
  let dateIso = addDaysIso(toZonedDateIso(now, TZ), -Math.abs(offsetDays));
  for (let guard = 0; guard < 14; guard += 1) {
    const probe = parseZonedDateTime(dateIso, "12:00", TZ);
    if (weekdayIn(probe, TZ) !== "sun") return dateIso;
    dateIso = addDaysIso(dateIso, -1);
  }
  return dateIso;
}

function slot(dateIso: string, time: string, durationMinutes: number) {
  const start = parseZonedDateTime(dateIso, time, TZ);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start_time: start.toISOString(), end_time: end.toISOString() };
}

/**
 * Realistic demo dataset for the first tenant. Everything is positioned
 * relative to `now`, so the dashboard looks like a live business on any day
 * the app is started.
 */
export function buildSeedData(now: Date = new Date()): SeedData {
  const businesses: Business[] = [innovationPowerWashing];
  const services = innovationServices;

  const users: User[] = [
    {
      id: id("user", "owner"),
      business_id: BID,
      auth_user_id: null,
      name: "Eric",
      email: "owner@innovationpowerwashing.com",
      role: "owner",
      created_at: "2011-04-02T12:00:00.000Z",
    },
    {
      id: id("user", "office"),
      business_id: BID,
      auth_user_id: null,
      name: "Office",
      email: "office.admin@innovationpowerwashing.com",
      role: "admin",
      created_at: "2019-06-11T12:00:00.000Z",
    },
    {
      id: id("user", "tech"),
      business_id: BID,
      auth_user_id: null,
      name: "Nico",
      email: "nico@innovationpowerwashing.com",
      role: "staff",
      created_at: "2022-03-14T12:00:00.000Z",
    },
  ];

  const ownerId = users[0].id;
  const officeId = users[1].id;

  interface CustomerSeed {
    key: string;
    first: string;
    last: string;
    phone: string;
    email: string;
    street: string;
    city: string;
    zip: string;
    notes?: string;
  }

  const customerSeeds: CustomerSeed[] = [
    {
      key: "hannity",
      first: "Karen",
      last: "Whitfield",
      phone: "+19735550118",
      email: "karen.whitfield@example.com",
      street: "27 Lakeside Avenue",
      city: "Pompton Lakes",
      zip: "07442",
      notes: "Repeat customer — third year in a row. Prefers morning slots.",
    },
    {
      key: "torres",
      first: "Anthony",
      last: "Torres",
      phone: "+19735550193",
      email: "atorres@example.com",
      street: "14 Valley Road",
      city: "Wayne",
      zip: "07470",
      notes: "Big cedar deck out back, wants it done before staining in the fall.",
    },
    {
      key: "nguyen",
      first: "Linh",
      last: "Nguyen",
      phone: "+19735550176",
      email: "linh.nguyen@example.com",
      street: "8 Pompton Avenue",
      city: "Wayne",
      zip: "07470",
    },
    {
      key: "obrien",
      first: "Patrick",
      last: "O'Brien",
      phone: "+19735550164",
      email: "pobrien@example.com",
      street: "331 Hamburg Turnpike",
      city: "Pompton Lakes",
      zip: "07442",
      notes: "North side of the house is heavily shaded — expect heavy mildew.",
    },
    {
      key: "shah",
      first: "Priya",
      last: "Shah",
      phone: "+17325550137",
      email: "priya.shah@example.com",
      street: "62 Ratzer Road",
      city: "Wayne",
      zip: "07470",
    },
    {
      key: "kowalski",
      first: "Ed",
      last: "Kowalski",
      phone: "+19735550151",
      email: "ekowalski@example.com",
      street: "19 Hamburg Turnpike",
      city: "Wayne",
      zip: "07470",
      notes: "Owns the strip center on Main — asked about a recurring commercial route.",
    },
    {
      key: "brennan",
      first: "Megan",
      last: "Brennan",
      phone: "+19735550129",
      email: "megan.brennan@example.com",
      street: "5 Wanaque Avenue",
      city: "Pompton Lakes",
      zip: "07442",
    },
    {
      key: "davis",
      first: "Robert",
      last: "Davis",
      phone: "+19735550188",
      email: "rdavis@example.com",
      street: "77 Alps Road",
      city: "Wayne",
      zip: "07470",
    },
    {
      key: "ferraro",
      first: "Gina",
      last: "Ferraro",
      phone: "+19735550172",
      email: "gina.ferraro@example.com",
      street: "210 Colfax Avenue",
      city: "Pompton Lakes",
      zip: "07442",
    },
    {
      key: "lin",
      first: "David",
      last: "Lin",
      phone: "+17325550145",
      email: "dlin@example.com",
      street: "44 Ringwood Avenue",
      city: "Pompton Wayne",
      zip: "07470",
    },
  ];

  const customers: Customer[] = customerSeeds.map((seed, index) => ({
    id: id("customer", seed.key),
    business_id: BID,
    first_name: seed.first,
    last_name: seed.last,
    phone: seed.phone,
    email: seed.email,
    notes: seed.notes ?? null,
    created_at: daysAgo(now, 120 - index * 9),
    updated_at: daysAgo(now, 3),
  }));

  const addresses: Address[] = customerSeeds.map((seed) => ({
    id: id("address", seed.key),
    customer_id: id("customer", seed.key),
    street: seed.street,
    city: seed.city,
    state: "NJ",
    zip: seed.zip,
    latitude: null,
    longitude: null,
  }));

  const cust = (key: string) => id("customer", key);

  const leads: Lead[] = [
    {
      id: id("lead", "hannity"),
      business_id: BID,
      customer_id: cust("hannity"),
      source: "website",
      service_requested: "House Washing",
      service_id: serviceId("house-washing"),
      status: "booked",
      estimated_value: 349,
      notes: "Two-story colonial, vinyl siding. Repeat customer, wants the same crew as last year.",
      assigned_to: officeId,
      preferred_date: upcomingOpenDate(now, 1),
      created_at: daysAgo(now, 6),
      updated_at: daysAgo(now, 4),
    },
    {
      id: id("lead", "torres"),
      business_id: BID,
      customer_id: cust("torres"),
      source: "phone",
      service_requested: "Painting and Staining",
      service_id: serviceId("painting-staining"),
      status: "booked",
      estimated_value: 425,
      notes: "600 sq ft cedar deck plus railings. Staining in three weeks, needs dry time.",
      assigned_to: officeId,
      preferred_date: upcomingOpenDate(now, 2),
      created_at: daysAgo(now, 5),
      updated_at: daysAgo(now, 3),
    },
    {
      id: id("lead", "nguyen"),
      business_id: BID,
      customer_id: cust("nguyen"),
      source: "web_chat",
      service_requested: "House Washing",
      service_id: serviceId("house-washing"),
      status: "qualified",
      estimated_value: 299,
      notes: "Ranch, roughly 1,800 sq ft. Asked about plant safety — reassured on the chat.",
      assigned_to: officeId,
      preferred_date: upcomingOpenDate(now, 4),
      created_at: daysAgo(now, 2),
      updated_at: daysAgo(now, 1),
    },
    {
      id: id("lead", "obrien"),
      business_id: BID,
      customer_id: cust("obrien"),
      source: "website",
      service_requested: "Roof Cleaning",
      service_id: serviceId("roof-cleaning"),
      status: "estimate_sent",
      estimated_value: 780,
      notes: "Black streaking on the south-facing roof plane. Estimate emailed, waiting on approval.",
      assigned_to: ownerId,
      preferred_date: upcomingOpenDate(now, 9),
      created_at: daysAgo(now, 8),
      updated_at: daysAgo(now, 2),
    },
    {
      id: id("lead", "shah"),
      business_id: BID,
      customer_id: cust("shah"),
      source: "sms",
      service_requested: "Concrete Cleaning",
      service_id: serviceId("concrete-cleaning"),
      status: "contacted",
      estimated_value: 199,
      notes: "Missed call, replied by text. Wants driveway plus front walk priced together.",
      assigned_to: officeId,
      preferred_date: null,
      created_at: hoursAgo(now, 20),
      updated_at: hoursAgo(now, 18),
    },
    {
      id: id("lead", "kowalski"),
      business_id: BID,
      customer_id: cust("kowalski"),
      source: "referral",
      service_requested: "Commercial Pressure Washing",
      service_id: serviceId("commercial-pressure-washing"),
      status: "estimate_requested",
      estimated_value: 2400,
      notes:
        "Commercial storefront on Hamburg Turnpike. Sidewalks, awnings and dumpster pad. Asked about a quarterly contract.",
      assigned_to: ownerId,
      preferred_date: null,
      created_at: daysAgo(now, 3),
      updated_at: daysAgo(now, 1),
    },
    {
      id: id("lead", "brennan"),
      business_id: BID,
      customer_id: cust("brennan"),
      source: "website",
      service_requested: "House Washing",
      service_id: serviceId("house-washing"),
      status: "new",
      estimated_value: null,
      notes: "Submitted the estimate form last night. Mentioned green algae on the north wall.",
      assigned_to: null,
      preferred_date: upcomingOpenDate(now, 6),
      created_at: hoursAgo(now, 11),
      updated_at: hoursAgo(now, 11),
    },
    {
      id: id("lead", "davis"),
      business_id: BID,
      customer_id: cust("davis"),
      source: "web_chat",
      service_requested: "Concrete Cleaning",
      service_id: serviceId("concrete-cleaning"),
      status: "new",
      estimated_value: null,
      notes: "Chat lead — long paver driveway, asked whether we re-sand joints.",
      assigned_to: null,
      preferred_date: null,
      created_at: hoursAgo(now, 4),
      updated_at: hoursAgo(now, 4),
    },
    {
      id: id("lead", "ferraro"),
      business_id: BID,
      customer_id: cust("ferraro"),
      source: "phone",
      service_requested: "House Washing",
      service_id: serviceId("house-washing"),
      status: "completed",
      estimated_value: 315,
      notes: "Completed last week. Left a five-star Google review.",
      assigned_to: officeId,
      preferred_date: null,
      created_at: daysAgo(now, 21),
      updated_at: daysAgo(now, 6),
    },
    {
      id: id("lead", "lin"),
      business_id: BID,
      customer_id: cust("lin"),
      source: "website",
      service_requested: "Fence Cleaning",
      service_id: serviceId("fence-cleaning"),
      status: "lost",
      estimated_value: 260,
      notes: "Went with a neighbor's handyman. Follow up next spring.",
      assigned_to: officeId,
      preferred_date: null,
      created_at: daysAgo(now, 26),
      updated_at: daysAgo(now, 14),
    },
  ];

  const day1 = upcomingOpenDate(now, 1);
  const day2 = upcomingOpenDate(now, 2);
  const day4 = upcomingOpenDate(now, 4);
  const day5 = upcomingOpenDate(now, 5);
  const pastDay = pastOpenDate(now, 6);

  const appointments: Appointment[] = [
    {
      id: id("appointment", "hannity"),
      business_id: BID,
      customer_id: cust("hannity"),
      lead_id: id("lead", "hannity"),
      service_id: serviceId("house-washing"),
      ...slot(day1, "13:00", 180),
      status: "confirmed",
      notes: "Two-story colonial. Gate code 4417. Same crew as last year.",
      source: "website",
      external_calendar_id: null,
      created_at: daysAgo(now, 4),
      updated_at: daysAgo(now, 4),
    },
    {
      id: id("appointment", "torres"),
      business_id: BID,
      customer_id: cust("torres"),
      lead_id: id("lead", "torres"),
      service_id: serviceId("painting-staining"),
      ...slot(day2, "13:00", 180),
      status: "confirmed",
      notes: "Cedar deck plus railings and steps. Wood brightener included.",
      source: "phone",
      external_calendar_id: null,
      created_at: daysAgo(now, 3),
      updated_at: daysAgo(now, 3),
    },
    {
      id: id("appointment", "nguyen"),
      business_id: BID,
      customer_id: cust("nguyen"),
      lead_id: id("lead", "nguyen"),
      service_id: serviceId("house-washing"),
      ...slot(day4, "13:00", 180),
      status: "requested",
      notes: "Booked through the website chat assistant. Needs confirmation call.",
      source: "web_chat",
      external_calendar_id: null,
      created_at: daysAgo(now, 1),
      updated_at: daysAgo(now, 1),
    },
    {
      id: id("appointment", "shah"),
      business_id: BID,
      customer_id: cust("shah"),
      lead_id: id("lead", "shah"),
      service_id: serviceId("concrete-cleaning"),
      ...slot(day5, "10:00", 120),
      status: "requested",
      notes: "Driveway plus front walk. Confirm final price on site.",
      source: "sms",
      external_calendar_id: null,
      created_at: hoursAgo(now, 17),
      updated_at: hoursAgo(now, 17),
    },
    {
      id: id("appointment", "ferraro"),
      business_id: BID,
      customer_id: cust("ferraro"),
      lead_id: id("lead", "ferraro"),
      service_id: serviceId("house-washing"),
      ...slot(pastDay, "09:00", 180),
      status: "completed",
      notes: "Completed. Customer paid by card on site.",
      source: "phone",
      external_calendar_id: null,
      created_at: daysAgo(now, 18),
      updated_at: daysAgo(now, 6),
    },
  ];

  const calls: Call[] = [
    {
      id: id("call", "torres"),
      business_id: BID,
      customer_id: cust("torres"),
      lead_id: id("lead", "torres"),
      provider: "mock",
      provider_call_id: "mock-call-1041",
      direction: "inbound",
      phone_number: "+19735550193",
      started_at: daysAgo(now, 5),
      ended_at: new Date(new Date(daysAgo(now, 5)).getTime() + 212_000).toISOString(),
      duration: 212,
      status: "completed",
      transcript: [
        "Innovation: Thanks for calling Innovation Power Washing. How can we help?",
        "Caller: Hi, I've got a cedar deck that's turned gray and I want it cleaned before I stain it.",
        "Innovation: We can do the wash and the stain. Roughly how big is the deck?",
        "Caller: About six hundred square feet, plus railings.",
        "Innovation: We will quote that after Eric sees the photos or walks it. I can hold an eight o'clock opening later this week if you want.",
        "Caller: That works. When can you come out?",
        "Innovation: I have an eight o'clock opening later this week. Should I hold it for you?",
        "Caller: Yes, please.",
        "Innovation: Done. You'll get a text confirmation in a minute. Anything else?",
        "Caller: That's it, thank you.",
      ].join("\n"),
      summary:
        "Anthony Torres requested deck washing and staining for a ~600 sq ft cedar deck. Estimate to follow; 8:00 AM slot held, confirmation text sent.",
      outcome: "booked",
      recording_url: null,
    },
    {
      id: id("call", "shah"),
      business_id: BID,
      customer_id: cust("shah"),
      lead_id: id("lead", "shah"),
      provider: "mock",
      provider_call_id: "mock-call-1058",
      direction: "inbound",
      phone_number: "+17325550137",
      started_at: hoursAgo(now, 21),
      ended_at: hoursAgo(now, 21),
      duration: 0,
      status: "missed",
      transcript: null,
      summary: "Missed call outside business hours. Automated follow-up SMS sent.",
      outcome: "missed_call_sms_sent",
      recording_url: null,
    },
    {
      id: id("call", "kowalski"),
      business_id: BID,
      customer_id: cust("kowalski"),
      lead_id: id("lead", "kowalski"),
      provider: "mock",
      provider_call_id: "mock-call-1063",
      direction: "outbound",
      phone_number: "+19735550151",
      started_at: daysAgo(now, 1),
      ended_at: new Date(new Date(daysAgo(now, 1)).getTime() + 358_000).toISOString(),
      duration: 358,
      status: "completed",
      transcript: null,
      summary:
        "Eric called Ed back about the Hamburg Turnpike property. Walk-through scheduled; quarterly maintenance contract discussed.",
      outcome: "estimate_scheduled",
      recording_url: null,
    },
  ];

  const conversations: Conversation[] = [
    {
      id: id("conversation", "nguyen"),
      business_id: BID,
      customer_id: cust("nguyen"),
      lead_id: id("lead", "nguyen"),
      channel: "web",
      status: "open",
      subject: "House washing — ranch in Wayne",
      created_at: daysAgo(now, 2),
      updated_at: daysAgo(now, 1),
    },
    {
      id: id("conversation", "shah"),
      business_id: BID,
      customer_id: cust("shah"),
      lead_id: id("lead", "shah"),
      channel: "sms",
      status: "open",
      subject: "Missed call follow-up",
      created_at: hoursAgo(now, 21),
      updated_at: hoursAgo(now, 17),
    },
    {
      id: id("conversation", "davis"),
      business_id: BID,
      customer_id: cust("davis"),
      lead_id: id("lead", "davis"),
      channel: "web",
      status: "escalated",
      subject: "Paver driveway — joint sand question",
      created_at: hoursAgo(now, 4),
      updated_at: hoursAgo(now, 4),
    },
  ];

  const messageAt = (base: string, offsetSeconds: number) =>
    new Date(new Date(base).getTime() + offsetSeconds * 1000).toISOString();

  const nguyenBase = daysAgo(now, 2);
  const shahBase = hoursAgo(now, 21);
  const davisBase = hoursAgo(now, 4);

  const messages: Message[] = [
    // Web chat that converted into a booking.
    {
      id: id("message", "nguyen-1"),
      conversation_id: id("conversation", "nguyen"),
      direction: "inbound",
      sender: "customer",
      body: "Hi — how much for a house wash on a ranch?",
      provider_message_id: null,
      status: "received",
      created_at: messageAt(nguyenBase, 0),
    },
    {
      id: id("message", "nguyen-2"),
      conversation_id: id("conversation", "nguyen"),
      direction: "outbound",
      sender: "ai",
      body: "Happy to help. House washing is quoted after we see the home. Roughly how many square feet is the house, and what town are you in?",
      provider_message_id: null,
      status: "sent",
      created_at: messageAt(nguyenBase, 24),
    },
    {
      id: id("message", "nguyen-3"),
      conversation_id: id("conversation", "nguyen"),
      direction: "inbound",
      sender: "customer",
      body: "About 1,800 square feet, in Wayne. Is the solution safe for my hydrangeas?",
      provider_message_id: null,
      status: "received",
      created_at: messageAt(nguyenBase, 71),
    },
    {
      id: id("message", "nguyen-4"),
      conversation_id: id("conversation", "nguyen"),
      direction: "outbound",
      sender: "ai",
      body: "Yes — reviewers mention we take care around plants and flowers. Wayne is right in our service area. Can I grab your name and the best phone number so I can check openings?",
      provider_message_id: null,
      status: "sent",
      created_at: messageAt(nguyenBase, 95),
    },
    {
      id: id("message", "nguyen-5"),
      conversation_id: id("conversation", "nguyen"),
      direction: "inbound",
      sender: "customer",
      body: "Linh Nguyen, 973-555-0176. 8 Pompton Avenue, Wayne 07470.",
      provider_message_id: null,
      status: "received",
      created_at: messageAt(nguyenBase, 140),
    },
    {
      id: id("message", "nguyen-6"),
      conversation_id: id("conversation", "nguyen"),
      direction: "outbound",
      sender: "ai",
      body: "Thanks Linh. I have a 1:00 PM opening later this week for a house wash — about three hours. Want me to hold it?",
      provider_message_id: null,
      status: "sent",
      created_at: messageAt(nguyenBase, 168),
    },
    {
      id: id("message", "nguyen-7"),
      conversation_id: id("conversation", "nguyen"),
      direction: "inbound",
      sender: "customer",
      body: "Yes please.",
      provider_message_id: null,
      status: "received",
      created_at: messageAt(nguyenBase, 201),
    },
    {
      id: id("message", "nguyen-8"),
      conversation_id: id("conversation", "nguyen"),
      direction: "outbound",
      sender: "ai",
      body: "Booked. You're on the schedule for 1:00 PM and the office will call to confirm. Anything else I can help with?",
      provider_message_id: null,
      status: "sent",
      created_at: messageAt(nguyenBase, 228),
    },

    // Missed-call SMS recovery.
    {
      id: id("message", "shah-1"),
      conversation_id: id("conversation", "shah"),
      direction: "outbound",
      sender: "ai",
      body: "Sorry we missed your call — this is Innovation Power Washing. How can we help?",
      provider_message_id: "mock-sms-8801",
      status: "delivered",
      created_at: messageAt(shahBase, 45),
    },
    {
      id: id("message", "shah-2"),
      conversation_id: id("conversation", "shah"),
      direction: "inbound",
      sender: "customer",
      body: "Looking to get my driveway cleaned. It's concrete, pretty stained near the garage.",
      provider_message_id: "mock-sms-8802",
      status: "received",
      created_at: messageAt(shahBase, 3_600),
    },
    {
      id: id("message", "shah-3"),
      conversation_id: id("conversation", "shah"),
      direction: "outbound",
      sender: "ai",
      body: "We can take care of that. Driveway and concrete cleaning starts at $179, and oil-shadow treatment is included. What's the address, and would you like the front walk done at the same time?",
      provider_message_id: "mock-sms-8803",
      status: "delivered",
      created_at: messageAt(shahBase, 3_680),
    },
    {
      id: id("message", "shah-4"),
      conversation_id: id("conversation", "shah"),
      direction: "inbound",
      sender: "customer",
      body: "62 Talmadge Road, Edison. Yes, add the walkway.",
      provider_message_id: "mock-sms-8804",
      status: "received",
      created_at: messageAt(shahBase, 12_600),
    },
    {
      id: id("message", "shah-5"),
      conversation_id: id("conversation", "shah"),
      direction: "outbound",
      sender: "ai",
      body: "Got it. I've put you down for a 10:00 AM slot and flagged the walkway on the job. The office will confirm the final number before we start.",
      provider_message_id: "mock-sms-8805",
      status: "delivered",
      created_at: messageAt(shahBase, 14_400),
    },

    // Escalated chat — AI correctly refused to invent a price.
    {
      id: id("message", "davis-1"),
      conversation_id: id("conversation", "davis"),
      direction: "inbound",
      sender: "customer",
      body: "Do you re-sand paver joints after cleaning? Mine is about 900 square feet.",
      provider_message_id: null,
      status: "received",
      created_at: messageAt(davisBase, 0),
    },
    {
      id: id("message", "davis-2"),
      conversation_id: id("conversation", "davis"),
      direction: "outbound",
      sender: "ai",
      body: "We do offer paver sand replacement as an add-on to driveway cleaning. Cleaning starts at $179; the sand replacement is priced per job, so I don't want to guess at a number for 900 square feet.",
      provider_message_id: null,
      status: "sent",
      created_at: messageAt(davisBase, 31),
    },
    {
      id: id("message", "davis-3"),
      conversation_id: id("conversation", "davis"),
      direction: "inbound",
      sender: "customer",
      body: "Can someone just call me with a real number? 973-555-0188.",
      provider_message_id: null,
      status: "received",
      created_at: messageAt(davisBase, 78),
    },
    {
      id: id("message", "davis-4"),
      conversation_id: id("conversation", "davis"),
      direction: "outbound",
      sender: "ai",
      body: "Of course — I've passed this to the office with your number and the details. Someone will call you back today.",
      provider_message_id: null,
      status: "sent",
      created_at: messageAt(davisBase, 96),
    },
  ];

  const estimates: Estimate[] = [
    {
      id: id("estimate", "obrien"),
      business_id: BID,
      customer_id: cust("obrien"),
      lead_id: id("lead", "obrien"),
      status: "sent",
      amount: 780,
      notes: "Roof cleaning, ~2,600 sq ft of roof plane. Includes gutter face cleaning.",
      sent_at: daysAgo(now, 2),
      accepted_at: null,
      created_at: daysAgo(now, 3),
    },
    {
      id: id("estimate", "kowalski"),
      business_id: BID,
      customer_id: cust("kowalski"),
      lead_id: id("lead", "kowalski"),
      status: "requested",
      amount: null,
      notes: "Strip center walk-through needed before pricing. Quarterly contract discussed.",
      sent_at: null,
      accepted_at: null,
      created_at: daysAgo(now, 1),
    },
    {
      id: id("estimate", "ferraro"),
      business_id: BID,
      customer_id: cust("ferraro"),
      lead_id: id("lead", "ferraro"),
      status: "accepted",
      amount: 315,
      notes: "House wash, split-level with attached garage.",
      sent_at: daysAgo(now, 12),
      accepted_at: daysAgo(now, 11),
      created_at: daysAgo(now, 13),
    },
  ];

  const aiActions: AiAction[] = [
    {
      id: id("ai_action", "nguyen-create-lead"),
      business_id: BID,
      customer_id: cust("nguyen"),
      conversation_id: id("conversation", "nguyen"),
      action_type: "create_lead",
      input: { service: "House Washing", source: "web_chat", town: "Wayne" },
      output: { lead_id: id("lead", "nguyen"), status: "qualified" },
      success: true,
      error: null,
      created_at: messageAt(nguyenBase, 150),
    },
    {
      id: id("ai_action", "nguyen-book"),
      business_id: BID,
      customer_id: cust("nguyen"),
      conversation_id: id("conversation", "nguyen"),
      action_type: "create_appointment",
      input: { service_id: serviceId("house-washing"), start_time: `${day4}T13:00 (America/New_York)` },
      output: { appointment_id: id("appointment", "nguyen"), status: "requested" },
      success: true,
      error: null,
      created_at: messageAt(nguyenBase, 220),
    },
    {
      id: id("ai_action", "davis-escalate"),
      business_id: BID,
      customer_id: cust("davis"),
      conversation_id: id("conversation", "davis"),
      action_type: "notify_owner",
      input: { reason: "customer_requested_human", detail: "Wants a real number for paver re-sanding" },
      output: { notified: true },
      success: true,
      error: null,
      created_at: messageAt(davisBase, 90),
    },
  ];

  const notifications: Notification[] = [
    {
      id: id("notification", "davis-escalation"),
      business_id: BID,
      user_id: ownerId,
      type: "escalation.required",
      title: "Chat escalated — Robert Davis",
      body: "Customer asked for a callback about paver joint re-sanding. Phone: (973) 555-0188.",
      read: false,
      created_at: messageAt(davisBase, 96),
    },
    {
      id: id("notification", "brennan-lead"),
      business_id: BID,
      user_id: ownerId,
      type: "lead.created",
      title: "New website lead — Megan Brennan",
      body: "House Washing · Hillsborough, NJ · submitted through the estimate form.",
      read: false,
      created_at: hoursAgo(now, 11),
    },
    {
      id: id("notification", "shah-missed"),
      business_id: BID,
      user_id: ownerId,
      type: "call.missed",
      title: "Missed call — (732) 555-0137",
      body: "Follow-up SMS sent automatically. Customer replied and is now booked.",
      read: true,
      created_at: hoursAgo(now, 21),
    },
    {
      id: id("notification", "nguyen-appointment"),
      business_id: BID,
      user_id: ownerId,
      type: "appointment.created",
      title: "Appointment requested — Linh Nguyen",
      body: "House Washing, 1:00 PM. Booked by the web chat assistant, needs confirmation.",
      read: true,
      created_at: daysAgo(now, 1),
    },
  ];

  const analyticsEvents: AnalyticsEvent[] = [
    {
      id: id("analytics", "1"),
      business_id: BID,
      name: "lead_submitted",
      properties: { source: "website", service: "House Washing" },
      created_at: hoursAgo(now, 11),
    },
    {
      id: id("analytics", "2"),
      business_id: BID,
      name: "cta_click",
      properties: { cta: "get_free_estimate", location: "hero" },
      created_at: hoursAgo(now, 12),
    },
    {
      id: id("analytics", "3"),
      business_id: BID,
      name: "appointment_created",
      properties: { source: "web_chat" },
      created_at: daysAgo(now, 1),
    },
  ];

  return {
    businesses,
    users,
    services,
    customers,
    addresses,
    leads,
    appointments,
    calls,
    conversations,
    messages,
    estimates,
    aiActions,
    notifications,
    analyticsEvents,
  };
}
