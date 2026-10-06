// How the public filter panel presents filters.json services: filter-only
// headings and friendlier display names. Shared by the site
// (App.tsx) and Social Studio so the carousel's filter sheets match the site.

// Filter-only headings that match any of their members (see
// derivedServiceMatches in salon-index.mjs). They aren't services, so they stay
// out of filters.json and never show up in the service pickers.
export const serviceFamilies: Record<string, readonly string[]> = {
  "Hybrid sew ins (all)": ["Boho sew-in", "Feed-in / stitch braid sew-in", "Fulani sew-in", "K-tips + sew-in", "Tape-ins + sew-in"],
};

// Families that nest their members in a category's filter list. Only Sew in /
// weave nests (its hybrids); every other category lists its styles flat.
export const subcategoryGroupsByCategory: Record<string, readonly string[]> = {
  "sew-in-weave": ["Hybrid sew ins (all)"],
};

const serviceDisplayNames: Record<string, string> = {
  "Wig cornrows": "(Wig) cornrows / twists",
  "Boho braids / goddess braids": "Boho braids",
  "Boho sew-in": "Boho braids sew-in (hybrid)",
  "Fulani / lemonade braids": "Fulani braids",
  "Fulani sew-in": "Fulani braids sew-in (hybrid)",
  "Feed-in braids": "Feed ins / all back braids",
  "Feed-in / stitch braid sew-in": "Feed in / stitch braids sew-in (hybrid)",
  "Tape-ins + sew-in": "Tapes + sew-in (hybrid)",
  "K-tips / invisible strands": "K-tips",
  "K-tips + sew-in": "K-tips + sew-in (hybrid)",
  "French curl": "French curl braids",
  ...Object.fromEntries(Object.keys(serviceFamilies).filter((family) => family.endsWith(" (all)")).map((family) => [family, family.slice(0, -" (all)".length)])),
};

export function getServiceDisplayName(service: string) {
  return serviceDisplayNames[service] ?? service;
}

export type ServiceFilterRow = { service: string; nested: boolean };

// A category's styles in the site's filter-list order: A–Z by display name,
// with each family's members nested under it. A family's members only show
// once the family or one of them is in `selected` (as on the site).
export function serviceFilterRows(categoryId: string, subcategories: readonly string[], selected: readonly string[]): ServiceFilterRow[] {
  const families = (subcategoryGroupsByCategory[categoryId] ?? []).filter((family) => (serviceFamilies[family] ?? []).some((member) => subcategories.includes(member)));
  const nestedHere = new Set(families.flatMap((family) => serviceFamilies[family] ?? []));
  const sortKey = (service: string) => getServiceDisplayName(service).replace(/^\W+/, "");
  const topLevel = [...subcategories.filter((service) => service !== "all" && !nestedHere.has(service) && !families.includes(service)), ...families].sort((left, right) =>
    sortKey(left).localeCompare(sortKey(right)),
  );
  return topLevel.flatMap((service) => {
    const children = families.includes(service) ? (serviceFamilies[service] ?? []).filter((child) => subcategories.includes(child)) : [];
    const open = [service, ...children].some((item) => selected.includes(item));
    return [{ service, nested: false }, ...(open ? children.map((child) => ({ service: child, nested: true })) : [])];
  });
}
