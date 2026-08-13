import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSalonIndex } from "./salon-index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manualVendorsPath = path.resolve(__dirname, "../data/manual-vendors.json");

const vendorProductTypeGroups = [
  { label: "Braiding hair", options: ["Bulk braiding hair", "Bone Straight (synthetic)", "Braiding hair (colour mix)", "Crochet (Miracle knots)", "French curl braiding hair"] },
  { label: "Extensions", options: ["I-tips", "K-tips", "Tape-ins", "Clip-ins", "Ponytails"] },
  { label: "Wigs", options: ["Wigs", "Half wigs / Upart wigs / headband wigs"] },
  { label: "Bundles & lace systems", options: ["Bundles (wefts)", "Custom colour bundles", "Frontals / closures"] },
];

export async function readVendorIndex() {
  try {
    const raw = await fs.readFile(manualVendorsPath, "utf8");
    const data = JSON.parse(raw);
    const vendors = Array.isArray(data.vendors) ? data.vendors : [];
    return {
      meta: {
        source: data.meta?.source ?? "manual",
        updatedAt: data.meta?.updatedAt ?? null,
        count: vendors.length,
      },
      vendors,
    };
  } catch {
    return {
      meta: { source: "manual", updatedAt: null, count: 0 },
      vendors: [],
    };
  }
}

export async function searchVendors({ productTypeGroups = [], productTypes = [], fulfilment = [], hairstylistOwned = false } = {}) {
  const index = await readVendorIndex();
  const selectedProductTypeGroups = Array.isArray(productTypeGroups) ? productTypeGroups.filter(Boolean) : [];
  const selectedProductTypes = Array.isArray(productTypes) ? productTypes.filter(Boolean) : [];
  const selectedFulfilment = Array.isArray(fulfilment) ? fulfilment.filter(Boolean) : [];

  const salonIndex = await readSalonIndex();

  const results = index.vendors
    .filter((vendor) => matchesProductTypeSelection(vendor, selectedProductTypeGroups, selectedProductTypes) && matchesFulfilment(vendor, selectedFulfilment))
    .map((vendor) => ({ ...vendor, linkedStylist: getLinkedStylist(vendor, salonIndex.salons) }))
    .filter((vendor) => !hairstylistOwned || vendor.linkedStylist !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    ok: true,
    total: results.length,
    results,
    indexMeta: index.meta,
  };
}

function getLinkedStylist(vendor, salons) {
  if (!vendor.linkedSalonId) {
    return null;
  }

  const matches = salons
    .filter((salon) => (salon.id === vendor.linkedSalonId || salon.brandId === vendor.linkedSalonId) && !salon.temporarilyClosed);

  if (matches.length === 0) {
    return null;
  }

  return {
    name: matches[0].brandName ?? matches[0].name,
    instagramUrl: matches[0].instagramUrl ?? null,
    priceIncludesHair: matches[0].priceIncludesHair === true,
    branches: matches.map((salon) => ({
      id: salon.id,
      label: salon.branchLabel ?? salon.name,
      areaLabel: salon.areaLabel ?? null,
      bookingUrl: salon.bookingUrl ?? null,
      bookingPlatform: salon.bookingPlatform ?? null,
    })),
  };
}

function matchesProductTypeGroup(vendor, groupLabel) {
  const vendorProductTypes = Array.isArray(vendor.productTypes) ? vendor.productTypes : [];
  const knownGroup = vendorProductTypeGroups.find((group) => group.label === groupLabel);
  if (knownGroup) {
    return knownGroup.options.some((option) => vendorProductTypes.includes(option));
  }
  if (groupLabel === "Other") {
    const groupedOptions = new Set(vendorProductTypeGroups.flatMap((group) => group.options));
    return vendorProductTypes.some((productType) => !groupedOptions.has(productType));
  }
  return false;
}

function matchesProductTypeSelection(vendor, selectedProductTypeGroups, selectedProductTypes) {
  if (selectedProductTypeGroups.length === 0 && selectedProductTypes.length === 0) {
    return true;
  }

  const matchesGroups = selectedProductTypeGroups.every((groupLabel) => matchesProductTypeGroup(vendor, groupLabel));
  if (!matchesGroups) {
    return false;
  }

  const vendorProductTypes = Array.isArray(vendor.productTypes) ? vendor.productTypes : [];
  return selectedProductTypes.every((productType) => vendorProductTypes.includes(productType));
}

function matchesFulfilment(vendor, selectedFulfilment) {
  if (selectedFulfilment.length === 0) {
    return true;
  }
  const vendorFulfilment = Array.isArray(vendor.fulfilment) ? vendor.fulfilment : [];
  return selectedFulfilment.every((fulfilmentOption) => vendorFulfilment.includes(fulfilmentOption));
}

export async function getVendorFilterOptions() {
  const index = await readVendorIndex();
  const productTypes = new Set();
  const fulfilment = new Set();

  for (const vendor of index.vendors) {
    for (const productType of vendor.productTypes ?? []) productTypes.add(productType);
    for (const fulfilmentOption of vendor.fulfilment ?? []) fulfilment.add(fulfilmentOption);
  }

  return {
    productTypes: [...productTypes].sort(),
    fulfilment: [...fulfilment].sort(),
  };
}
