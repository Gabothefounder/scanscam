/**
 * Partner config for MSP routing. Hardcoded for MVP.
 */

export type PartnerConfig = {
  slug: string;
  name: string;
  email: string;
  logoUrl?: string;
  active: boolean;
};

const PARTNERS: PartnerConfig[] = [
  {
    slug: "acme-it",
    name: "ACME IT Solutions",
    email: "gestionrockwell@gmail.com",
    active: true,
  },
  {
    slug: "contoso-msp",
    name: "Contoso MSP",
    email: "alerts@contoso-msp.example.com",
    active: true,
  },
  {
    slug: "groupe-ti",
    name: "Groupe TI",
    email: "fraude@groupe-ti.example.com",
    active: true,
  },
  {
    slug: "legacy-partner",
    name: "Legacy Partner",
    email: "support@legacy.example.com",
    active: false,
  },
];

export function getPartnerBySlug(slug: string): PartnerConfig | null {
  if (!slug || typeof slug !== "string") return null;
  const normalized = slug.trim().toLowerCase();
  const partner = PARTNERS.find((p) => p.slug.toLowerCase() === normalized);
  return partner ?? null;
}

export function getActivePartners(): PartnerConfig[] {
  return PARTNERS.filter((p) => p.active);
}
