// How the public filter panel presents filters.json services: style families
// that nest their members, and friendlier display names. Shared by the site
// (App.tsx) and Social Studio so the carousel's filter sheets match the site.

// Picking a family matches any of its members (see derivedServiceMatches in
// salon-index.mjs). The "(all)" families are filter-only headings, not services,
// so they stay out of filters.json and never show up in the service pickers.
export const serviceFamilies: Record<string, readonly string[]> = {
  "Boho (all)": ["Boho braids / goddess braids", "Boho braids bob", "Boho sew-in"],
  "Fulani (all)": ["Fulani / lemonade braids", "Fulani sew-in"],
  "Feed-in & stitch braids (all)": ["Feed-in braids", "Stitch braids", "Feed-in / stitch braid sew-in"],
  "French curl (all)": ["French curl", "French curl bob"],
  "Tape-in (all)": ["Tape ins", "Tape-ins + sew-in"],
  "K-tip (all)": ["K-tips / invisible strands", "K-tips + sew-in"],
  "Hybrid (braids + sew-in)": ["Fulani sew-in", "Boho sew-in", "Feed-in / stitch braid sew-in"],
  "Hybrid installs": ["Tape-ins + sew-in", "K-tips + sew-in"],
  "Hybrid installs (all)": ["Boho sew-in", "Fulani sew-in", "Feed-in / stitch braid sew-in", "Tape-ins + sew-in", "K-tips + sew-in"],
};

// Which families nest their members in each category's filter list. Braids
// groups by style; Sew in / weave groups every hybrid by install.
export const subcategoryGroupsByCategory: Record<string, readonly string[]> = {
  "braiding-services": ["Boho (all)", "Fulani (all)", "Feed-in & stitch braids (all)", "French curl (all)"],
  "sew-in-weave": ["Hybrid installs (all)"],
  "extension-services": ["Tape-in (all)", "K-tip (all)"],
};

const serviceDisplayNames: Record<string, string> = {
  "Wig cornrows": "(Wig) cornrows",
  "Feed-in braids": "Feed-in braids / all backs",
  "Boho braids / goddess braids": "Boho braids",
  "Tape ins": "Tape-in install",
  "Tape-ins + sew-in": "Tapes + sew-in",
  "K-tips / invisible strands": "K-tip install",
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
