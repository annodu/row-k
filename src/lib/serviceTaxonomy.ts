// How the public filter panel presents filters.json services: filter-only
// headings and friendlier display names. Shared by the site
// (App.tsx) and Social Studio so the carousel's filter sheets match the site.

// Headings that match any of their members (see derivedServiceMatches in
// salon-index.mjs). "(all)" headings are filter-only, so they stay out of
// filters.json and never show up in the service pickers. Bond repair is also a
// service in its own right (salons that don't name a brand), so it's in
// filters.json too.
export const serviceFamilies: Record<string, readonly string[]> = {
  "Hybrid sew ins (all)": ["Boho sew-in", "Feed-in / stitch braid sew-in", "Fulani sew-in / quick weave", "K-tips + sew-in", "Tape-ins + sew-in", "Cassie braided sew-in", "Jayda Wayda braided sew-in"],
  "Hybrid installs (all)": ["K-tips + sew-in", "Tape-ins + sew-in"],
  "Wig installs (all)": ["Wig install (frontal / closure)", "U-Part / Half wig install", "Pixie wig / weave install"],
  "Celebrity-inspired braids (all)": ["Alicia Keys braids", "Pop smoke braids", "Jayda Wayda braided sew-in", "Cassie braided sew-in", "Coi Leray braids", "Tyla braids"],
  "Bond repair": ["Olaplex treatment", "K18 treatment"],
  "Barbering (women welcome)": ["Female barbers available"],
  "Keratin treatment / Brazilian blowdry": ["Formaldehyde-free keratin"],
};

// Families that nest their members in a category's filter list. Every other
// category lists its styles flat.
export const subcategoryGroupsByCategory: Record<string, readonly string[]> = {
  "sew-in-weave": ["Hybrid sew ins (all)"],
  "extension-services": ["Hybrid installs (all)"],
  "wig-services": ["Wig installs (all)"],
  "braiding-services": ["Celebrity-inspired braids (all)"],
  "straightening-treatments": ["Bond repair", "Keratin treatment / Brazilian blowdry"],
  "pixie-services": ["Barbering (women welcome)"],
};

const serviceDisplayNames: Record<string, string> = {
  "Wig cornrows": "(Wig) cornrows",
  "Boho braids / goddess braids": "Boho braids",
  "Boho sew-in": "Boho braids sew-in (hybrid)",
  "Fulani / lemonade braids": "Fulani braids",
  "Fulani sew-in": "Fulani sew-in / quick weave",
  "Feed-in braids": "Feed ins / all back braids",
  "Feed-in / stitch braid sew-in": "Feed in / stitch braids sew-in (hybrid)",
  "Tape-ins + sew-in": "Tapes + sew-in (hybrid)",
  "K-tips / invisible strands": "K-tips",
  "K-tips + sew-in": "K-tips + sew-in (hybrid)",
  "French curl": "French curl braids",
  "Cecred treatment": "Cécred wash & treatment",
  "Cécred treatment": "Cécred wash & treatment",
  "Bond repair": "Bond repair (e.g. Olaplex, K18)",
  "Extensions styling only (e.g. layers & curls)": "Extensions styling only",
  "Wig styling only (e.g. layers & curls)": "Wig styling only",
  ...Object.fromEntries(Object.keys(serviceFamilies).filter((family) => family.endsWith(" (all)")).map((family) => [family, family.slice(0, -" (all)".length)])),
};

export function getServiceDisplayName(service: string) {
  return serviceDisplayNames[service] ?? service;
}

// Filter-list names that differ from the stylist-card display names above
// (cards drop the "e.g." examples to stay short).
const serviceFilterLabels: Record<string, string> = {
  "Extensions styling only (e.g. layers & curls)": "Extensions styling only (e.g. layers & curls)",
  "Wig styling only (e.g. layers & curls)": "Wig styling only (e.g. layers & curls)",
  "Natural twists / plaits": "Natural twists / plaits (e.g. two strand twists, single plaits)",
};

// Shorter names when nested under a family heading that already says what
// they are ("Wig installs" → "Frontal / closure").
const nestedServiceFilterLabels: Record<string, string> = {
  "Wig install (frontal / closure)": "Frontal / closure",
  "U-Part / Half wig install": "U-part / half wig",
  "Pixie wig / weave install": "Pixie wig / weave",
};

export function getServiceFilterLabel(service: string, { nested = false } = {}) {
  return (nested ? nestedServiceFilterLabels[service] : undefined) ?? serviceFilterLabels[service] ?? getServiceDisplayName(service);
}

export type ServiceFilterRow = { service: string; nested: boolean };

// A category's styles in the site's filter-list order: A–Z by display name,
// with each family's members nested under it. A family's members only show
// once the family or one of them is in `selected` (as on the site).
export function serviceFilterRows(categoryId: string, subcategories: readonly string[], selected: readonly string[]): ServiceFilterRow[] {
  const families = (subcategoryGroupsByCategory[categoryId] ?? []).filter((family) => (serviceFamilies[family] ?? []).some((member) => subcategories.includes(member)));
  const nestedHere = new Set(families.flatMap((family) => serviceFamilies[family] ?? []));
  const sortKey = (service: string) => getServiceFilterLabel(service).replace(/^\W+/, "");
  const topLevel = [...subcategories.filter((service) => service !== "all" && !nestedHere.has(service) && !families.includes(service)), ...families].sort((left, right) =>
    sortKey(left).localeCompare(sortKey(right)),
  );
  return topLevel.flatMap((service) => {
    const children = families.includes(service) ? (serviceFamilies[service] ?? []).filter((child) => subcategories.includes(child)) : [];
    const open = [service, ...children].some((item) => selected.includes(item));
    return [{ service, nested: false }, ...(open ? children.map((child) => ({ service: child, nested: true })) : [])];
  });
}
