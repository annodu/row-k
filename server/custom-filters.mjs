export function cleanString(value) {
  return String(value || "").trim();
}

export function sanitizeCustomFilters(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result = {};
  for (const [filterTypeId, selected] of Object.entries(value)) {
    const cleanedId = cleanString(filterTypeId);
    if (!cleanedId || !Array.isArray(selected)) continue;
    const values = [...new Set(selected.map((v) => cleanString(v)).filter(Boolean))];
    if (values.length) result[cleanedId] = values;
  }
  return result;
}
