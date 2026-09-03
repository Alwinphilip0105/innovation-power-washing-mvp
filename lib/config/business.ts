import { stableId } from "@/lib/utils/id";
import type { Business, BusinessHours, Service } from "@/lib/db/types";

/**
 * Seed configuration for the first tenant. Facts are taken from the live
 * Innovation Power Washing site (innovationpowerwashing.com) — Pompton Lakes /
 * Wayne, NJ. Nothing in the application reads these constants directly; they
 * are loaded into `businesses` / `services` and resolved at runtime.
 */

export const DEFAULT_BUSINESS_SLUG = "innovation-power-washing";

export const INNOVATION_BUSINESS_ID = stableId("business", DEFAULT_BUSINESS_SLUG);

/** Crews typically run 7am–9pm; the live site lists the office as open 24 hours. */
const openAllWeek: BusinessHours = {
  sun: [{ open: "07:00", close: "21:00" }],
  mon: [{ open: "07:00", close: "21:00" }],
  tue: [{ open: "07:00", close: "21:00" }],
  wed: [{ open: "07:00", close: "21:00" }],
  thu: [{ open: "07:00", close: "21:00" }],
  fri: [{ open: "07:00", close: "21:00" }],
  sat: [{ open: "07:00", close: "21:00" }],
};

export const innovationPowerWashing: Business = {
  id: INNOVATION_BUSINESS_ID,
  name: "Innovation Power Washing",
  slug: DEFAULT_BUSINESS_SLUG,
  phone: "+19737508757",
  email: "office@innovationpowerwashing.com",
  website: "https://innovationpowerwashing.com/",
  address: "Pompton Lakes, NJ 07442",
  timezone: "America/New_York",
  business_hours: openAllWeek,
  settings: {
    tagline: "Innovative pressure washing for homes and businesses in Pompton Lakes, NJ.",
    serviceArea: {
      description:
        "We serve Pompton Lakes, Wayne, and Pompton Wayne, New Jersey. Text or call with your address if you are nearby — we will tell you straight away if we can get to you.",
      counties: ["Passaic"],
      towns: ["Pompton Lakes", "Wayne", "Pompton Wayne"],
      radiusMiles: 15,
    },
    faqs: [
      {
        question: "Does Innovation Power Washing provide free estimates for their pressure washing services?",
        answer:
          "Yes. Send us a text, call, or fill out the form with your address and what needs cleaning. We talk through the job on the phone and send a free written quote — no obligation.",
      },
      {
        question: "What sets Innovation Power Washing apart from other pressure washing services?",
        answer:
          "Owner Eric is hands-on: he keeps in touch, shows up when he says he will, and the crew is careful with landscaping. Neighbors mention reasonable pricing, arriving early, and leaving the property looking new without a mess.",
      },
      {
        question: "What services does Innovation Power Washing provide in the pressure washing industry?",
        answer:
          "House washing, pressure washing, power washing, painting and staining, roof cleaning, window cleaning, concrete cleaning, gutter cleaning, fence cleaning, graffiti removal, commercial pressure washing, and Christmas light installation.",
      },
      {
        question: "Is your cleaning solution safe for plants and landscaping?",
        answer:
          "Yes. Neighbors mention we take great care to protect landscaping, flowers and shrubs. We work around plants and leave no mess behind.",
      },
    ],
    policies: [
      "Free estimates — text us, call, or send the form. No obligation.",
      "We are fully insured. Ask and we will send proof of insurance.",
      "Quote path is the same as our live site: send a text, chat on the phone, receive a quote.",
      "The crew confirms in advance and lets you know what time to expect them.",
      "Landscaping and plants are protected — we take care around flowers, shrubs and awnings.",
    ],
    bookingRules: {
      minNoticeMinutes: 720,
      maxAdvanceDays: 45,
      slotIntervalMinutes: 60,
      bufferMinutes: 30,
      maxConcurrentAppointments: 2,
    },
    ai: {
      assistantName: "Innovation",
      personality:
        "Warm, efficient and plainspoken — the office voice of a local, owner-run pressure washing company. Short sentences. Never oversells. Offers a free quote instead of inventing a price.",
      greeting:
        "Hi, this is Innovation Power Washing. Text or tell us what you need cleaned and we will get you a quote.",
      escalationPhone: "+19737508757",
    },
    notifications: {
      ownerEmail: "office@innovationpowerwashing.com",
      ownerPhone: "+19737508757",
    },
    social: {
      google: "https://www.google.com/search?q=Innovation+Power+Washing+Pompton+Lakes+NJ",
    },
    licensing: "Fully insured · Pompton Lakes, NJ",
  },
  created_at: "2018-01-01T12:00:00.000Z",
  updated_at: "2026-09-02T12:00:00.000Z",
};

function service(
  slug: string,
  data: Omit<Service, "id" | "business_id" | "slug">,
): Service {
  return {
    id: stableId("service", `${DEFAULT_BUSINESS_SLUG}:${slug}`),
    business_id: INNOVATION_BUSINESS_ID,
    slug,
    ...data,
  };
}

/** Catalog matches innovationpowerwashing.com. Pricing is quote-only on the live site. */
export const innovationServices: Service[] = [
  service("house-washing", {
    name: "House Washing",
    description:
      "Gently removes dirt, grime, and mildew using low-pressure techniques to protect your home's surfaces while enhancing curb appeal and ensuring a fresh, clean exterior.",
    pricing_model: "quote_only",
    starting_price: null,
    price_unit: null,
    duration_minutes: 180,
    active: true,
    sort_order: 1,
    highlights: [
      "Low-pressure wash that is gentle on siding",
      "Removes dirt, grime and mildew",
      "Protects surfaces while restoring curb appeal",
      "Free written estimate",
    ],
  }),
  service("pressure-washing", {
    name: "Pressure Washing",
    description:
      "Professional pressure washing that removes dirt, grime, and stains to enhance curb appeal and protect surfaces. A meticulous clean that makes the home shine.",
    pricing_model: "quote_only",
    starting_price: null,
    price_unit: null,
    duration_minutes: 150,
    active: true,
    sort_order: 2,
    highlights: [
      "Removes dirt, grime and stains",
      "Protects exterior surfaces",
      "Residential and detailed work",
      "Free written estimate",
    ],
  }),
  service("power-washing", {
    name: "Power Washing",
    description:
      "A sparkling transformation for exterior surfaces — dirt and grime removed so the home looks brighter and stays protected longer.",
    pricing_model: "quote_only",
    starting_price: null,
    price_unit: null,
    duration_minutes: 150,
    active: true,
    sort_order: 3,
    highlights: [
      "Full exterior power wash",
      "Restores brightness to siding and trim",
      "Pairs well with staining and painting",
      "Free written estimate",
    ],
  }),
  service("painting-staining", {
    name: "Painting and Staining",
    description:
      "High-quality painting and staining that protect surfaces and add beauty, complementing a full pressure-washing prep.",
    pricing_model: "quote_only",
    starting_price: null,
    price_unit: null,
    duration_minutes: 360,
    active: true,
    sort_order: 4,
    highlights: [
      "Prep, paint and stain in one company",
      "Protective finishes for wood and siding",
      "Often combined with a power wash",
      "Free written estimate",
    ],
  }),
  service("roof-cleaning", {
    name: "Roof Cleaning",
    description:
      "Safely removes dirt, moss, and algae to improve how the roof looks and how long it lasts, without damaging shingles.",
    pricing_model: "quote_only",
    starting_price: null,
    price_unit: null,
    duration_minutes: 240,
    active: true,
    sort_order: 5,
    highlights: [
      "Soft chemical wash for moss and algae",
      "Treats black streaking on shingles",
      "Protects the roof investment",
      "Priced after we see the roof",
    ],
  }),
  service("window-cleaning", {
    name: "Window Cleaning",
    description:
      "Streak-free shine and clear views. The team revitalizes windows safely and efficiently, often alongside a house or deck wash.",
    pricing_model: "quote_only",
    starting_price: null,
    price_unit: null,
    duration_minutes: 120,
    active: true,
    sort_order: 6,
    highlights: [
      "Streak-free interior-facing glass finish",
      "Safe techniques for residential windows",
      "Easy to add onto a wash day",
      "Free written estimate",
    ],
  }),
  service("concrete-cleaning", {
    name: "Concrete Cleaning",
    description:
      "Restores driveways, walkways, patios and pavers. Dirt, grime and stains come off with professional pressure washing so surfaces look like new.",
    pricing_model: "quote_only",
    starting_price: null,
    price_unit: null,
    duration_minutes: 120,
    active: true,
    sort_order: 7,
    highlights: [
      "Driveways, walks, patios and pavers",
      "Lifts stains and years of weathering",
      "Even finish — no zebra stripes",
      "Free written estimate",
    ],
  }),
  service("gutter-cleaning", {
    name: "Gutter Cleaning",
    description:
      "Clears debris so gutters drain properly and water does not damage the home. Efficient, professional maintenance for the whole run.",
    pricing_model: "quote_only",
    starting_price: null,
    price_unit: null,
    duration_minutes: 90,
    active: true,
    sort_order: 8,
    highlights: [
      "Debris-free gutters and downspouts",
      "Helps prevent water damage",
      "Often bundled with house or fence work",
      "Free written estimate",
    ],
  }),
  service("fence-cleaning", {
    name: "Fence Cleaning",
    description:
      "Professional pressure washing that removes dirt, mold and grime from fences — including weathered cedar and white vinyl — so they look new again.",
    pricing_model: "quote_only",
    starting_price: null,
    price_unit: null,
    duration_minutes: 120,
    active: true,
    sort_order: 9,
    highlights: [
      "Wood, cedar and vinyl fences",
      "Removes mold, dirt and gray weathering",
      "No leftover mess on the yard",
      "Free written estimate",
    ],
  }),
  service("graffiti-removal", {
    name: "Graffiti Removal",
    description:
      "Specialized pressure washing that removes unwanted graffiti without damaging the surface underneath.",
    pricing_model: "quote_only",
    starting_price: null,
    price_unit: null,
    duration_minutes: 90,
    active: true,
    sort_order: 10,
    highlights: [
      "Safe on common exterior surfaces",
      "Residential and commercial properties",
      "Restores the original appearance",
      "Free written estimate",
    ],
  }),
  service("commercial-pressure-washing", {
    name: "Commercial Pressure Washing",
    description:
      "Exterior cleaning for businesses and properties — dirt, grime and mold removed so the building looks maintained and the value stays protected.",
    pricing_model: "quote_only",
    starting_price: null,
    price_unit: null,
    duration_minutes: 300,
    active: true,
    sort_order: 11,
    highlights: [
      "Storefronts, pads and common areas",
      "Owner-supervised, reliable crews",
      "Certificates of insurance on request",
      "Free written estimate",
    ],
  }),
  service("christmas-light-installation", {
    name: "Christmas Light Installation",
    description:
      "Professional holiday lighting — a safe, bright install so you can enjoy the season without climbing the house.",
    pricing_model: "quote_only",
    starting_price: null,
    price_unit: null,
    duration_minutes: 180,
    active: true,
    sort_order: 12,
    highlights: [
      "Designed and installed for you",
      "Safe placement on homes and trees",
      "Seasonal add-on to exterior work",
      "Free written estimate",
    ],
  }),
];
