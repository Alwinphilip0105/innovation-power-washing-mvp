import type { SceneKind } from "@/components/graphics/scenes";

/**
 * Marketing copy aligned with innovationpowerwashing.com reviews and towns.
 */

export interface Testimonial {
  quote: string;
  name: string;
  town: string;
  service: string;
}

export interface GalleryItem {
  title: string;
  location: string;
  detail: string;
  scene: SceneKind;
}

export interface ProcessStep {
  title: string;
  detail: string;
}

export interface Differentiator {
  title: string;
  detail: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "This is the second summer we've used Innovation Power Washing, and once again they exceeded our expectations. They power washed our deck and the CoolCrete around our pool, and everything looks brand new. They took great care to protect all of our landscaping and plants.",
    name: "Adam Lederman",
    town: "Wayne",
    service: "Power Washing",
  },
  {
    quote:
      "Eric power washed our house, fence, patio, and pavers, and the results were incredible. He was extremely easy to communicate with, scheduling was simple, and his pricing was very fair. We would highly recommend him.",
    name: "Mallory Griffin",
    town: "Pompton Lakes",
    service: "House Washing",
  },
  {
    quote:
      "Excellent job power washing and staining our deck. Eric keeps in touch with his customers, so you're not left hanging waiting for the contractor to show up. Reasonable pricing. Would recommend.",
    name: "Jim Stagnitto",
    town: "Wayne",
    service: "Painting and Staining",
  },
  {
    quote:
      "We had a very good experience. The crew was prompt and thorough with the soft chemical wash that treated the moss on our roof, and the power washing of the house left it looking great. The price was excellent too.",
    name: "Robert Kwartler",
    town: "Pompton Lakes",
    service: "Roof Cleaning",
  },
  {
    quote:
      "They show up on time. They are reliable. They work tirelessly until they do a perfect job. Everything looks like new, including the once weathered-looking cedar fence.",
    name: "Janet Kalina-Suarez",
    town: "Wayne",
    service: "Fence Cleaning",
  },
  {
    quote:
      "In the many years I have managed properties I can attest that Innovation Power Washing is the most reliable company I have worked with. The owner Eric is hands on and makes sure his customers are satisfied.",
    name: "Lisa C",
    town: "Wayne",
    service: "Commercial Pressure Washing",
  },
];

export const GALLERY: GalleryItem[] = [
  {
    title: "House and patio wash",
    location: "Pompton Lakes, NJ",
    detail:
      "Neighbors describe the after photos as a brand-new patio and house — Eric walked the concerns first, then the crew cleaned both.",
    scene: "siding",
  },
  {
    title: "Pavers and walkway",
    location: "Wayne, NJ",
    detail:
      "Years of staining lifted from pavers and CoolCrete. Reviewers say the original color came back in a single afternoon.",
    scene: "concrete",
  },
  {
    title: "Cedar fence restored",
    location: "Wayne, NJ",
    detail:
      "Weathered cedar brought back to an even tone. Crews leave no mess — just a fence that looks new.",
    scene: "deck",
  },
  {
    title: "Roof moss treatment",
    location: "Pompton Lakes, NJ",
    detail:
      "Soft chemical wash for moss and algae on shingles, paired with a house power wash.",
    scene: "roof",
  },
  {
    title: "Storefront and common areas",
    location: "Wayne, NJ",
    detail:
      "Property managers call out reliability and an owner who stays involved until the customer is satisfied.",
    scene: "storefront",
  },
  {
    title: "White vinyl fence",
    location: "Pompton Wayne, NJ",
    detail:
      "White fence power washed with no leftover mess — reviewers said it looked like the crew was never there, except for the shine.",
    scene: "deck",
  },
];

export const PROCESS: ProcessStep[] = [
  {
    title: "Send us a text",
    detail:
      "The same first step as our live site. Text (973) 750-8757 or use the form with your name, address and what you need cleaned.",
  },
  {
    title: "Chat on the phone",
    detail:
      "Eric or the office calls back quickly — often the same day — to walk through the job and answer questions.",
  },
  {
    title: "Receive a quote",
    detail:
      "You get a clear, reasonable price before anyone shows up. No high-pressure visit required.",
  },
  {
    title: "We show up when we said",
    detail:
      "The crew confirms in advance, arrives on time (often early), protects plants, and leaves the property looking new.",
  },
];

export const DIFFERENTIATORS: Differentiator[] = [
  {
    title: "Owner on the job",
    detail:
      "Eric is hands-on. Neighbors mention he keeps in touch, listens to concerns, and does not leave you hanging for a contractor who never shows.",
  },
  {
    title: "Insured, local, and careful",
    detail:
      "Fully insured crews that protect landscaping, arrive early, and leave no mess. That is what the reviews actually say.",
  },
  {
    title: "Free estimates by text",
    detail:
      "Send a text, talk on the phone, get a quote. That is the Innovation process — we built the same path into this site.",
  },
  {
    title: "More than a wash",
    detail:
      "House, roof, concrete, gutters, fences, windows, graffiti, commercial work, painting and staining, and Christmas lights — one local team.",
  },
];
