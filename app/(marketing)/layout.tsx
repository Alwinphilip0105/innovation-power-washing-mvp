import { ChatWidget } from "@/components/chat/chat-widget";
import { DemoCallHost } from "@/components/demo/demo-call";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { appUrl } from "@/lib/env";
import { formatPhone } from "@/lib/utils/phone";
import { getActiveServices, getCurrentBusiness } from "@/services/business";
import { voiceGreeting } from "@/services/voice-demo";

export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  const business = await getCurrentBusiness();
  const services = await getActiveServices(business.id);

  const phoneDisplay = formatPhone(business.phone);
  const phoneHref = `tel:${business.phone}`;

  const hoursNote = "Open 24 hours — text or call anytime";

  // LocalBusiness structured data, built from the same record the site renders.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    name: business.name,
    description: business.settings.tagline,
    telephone: business.phone,
    email: business.email,
    url: appUrl,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address,
      addressLocality: "Pompton Lakes",
      addressRegion: "NJ",
      postalCode: "07442",
      addressCountry: "US",
    },
    areaServed: business.settings.serviceArea.towns.map((town) => ({
      "@type": "City",
      name: `${town}, NJ`,
    })),
    makesOffer: services.map((service) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: service.name, description: service.description },
      ...(service.starting_price != null && service.pricing_model !== "quote_only"
        ? {
            priceSpecification: {
              "@type": "PriceSpecification",
              minPrice: service.starting_price,
              priceCurrency: "USD",
            },
          }
        : {}),
    })),
  };

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <SiteHeader phoneDisplay={phoneDisplay} phoneHref={phoneHref} hoursNote={hoursNote} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter business={business} services={services} />
      <ChatWidget
        assistantName={business.settings.ai.assistantName}
        businessName={business.name}
        greeting={business.settings.ai.greeting}
      />
      <DemoCallHost
        assistantName={business.settings.ai.assistantName}
        businessName={business.name}
        // The spoken greeting, not the chat one - this is a phone call, and
        // /demo/voice opens with exactly the same line.
        greeting={voiceGreeting(business)}
        phoneDisplay={phoneDisplay}
        phoneHref={phoneHref}
      />
      <script
        type="application/ld+json"
        // Serialized from our own database record - no user input reaches this.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
}
