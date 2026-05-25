import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsRight,
  ClockAlert,
  ExternalLink,
  FileText,
  Globe,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  SearchCheck,
  Trash2,
  Unlink,
  Undo2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type RegionOption = {
  id: string;
  label: string;
};

type StylistDraft = {
  id: string;
  status: string;
  name: string;
  areaId: string;
  areaIds?: string[];
  areaLabel: string;
  neighbourhood: string;
  postcode: string;
  bookingPlatform: string;
  bookingUrl: string;
  websiteUrl: string;
  instagramUrl: string;
  tiktokUrl?: string;
  services: string[];
  rawServices: string[];
  hijabiFriendly?: boolean;
  canBraidWithoutGel?: boolean;
  summary: string;
  warnings: string[];
  evidence: string[];
  createdAt: string;
  updatedAt: string;
};

type DraftForm = {
  links: string;
  name: string;
  areaId: string;
  rawServices: string;
  services: string[];
  hijabiFriendly: boolean;
  canBraidWithoutGel: boolean;
};

type DraftEditorStep = "details" | "services" | "review";

type DirectoryCheck = {
  id: string;
  name: string;
  areaLabel?: string;
  bookingUrl?: string;
  instagramUrl?: string;
  websiteUrl?: string;
  issues: string[];
  linkChecks: {
    type: string;
    url: string;
    finalUrl: string;
    status: string;
    httpStatus: number | null;
    issues: string[];
  }[];
  serviceCheck: {
    confidence: string;
    rawServices: string[];
    matchedServices: string[];
  };
  currentServices: string[];
  detectedServices: string[];
  addedServices: string[];
  removedServices: string[];
  checkedAt: string;
};

type FreshnessUpdate = {
  addServices?: string[];
  removeServices?: string[];
  bookingUrl?: string;
  instagramUrl?: string;
  websiteUrl?: string;
  rejectAddedServices?: string[];
  rejectRemovedServices?: string[];
};

type FreshnessUndoState = {
  check: DirectoryCheck;
  previousServices: string[];
  update: FreshnessUpdate;
  label: string;
};

type AdminToast = {
  id: number;
  message: string;
  tone: "success" | "error";
};

type DiscoverySuggestion = {
  id: string;
  name: string;
  status: string;
  confidence: string;
  sourceUrl: string;
  areaLabel?: string;
  services: string[];
  reason: string;
};

type DashboardMetrics = {
  drafts: {
    total: number;
    needsReview: number;
    readyToApprove: number;
    missingLocation: number;
    missingServices: number;
  };
  freshness: {
    totalIssues: number;
    checkedCount: number;
    total: number;
    brokenLinks: number;
    manualLinks?: number;
    serviceChanges: number;
    updatedAt: string | null;
  };
  discovery: {
    total: number;
    highConfidence: number;
    needsReview: number;
  };
};

const emptyForm: DraftForm = {
  links: "",
  name: "",
  areaId: "",
  rawServices: "",
  services: [],
  hijabiFriendly: false,
  canBraidWithoutGel: false,
};

const serviceGroups = [
  {
    label: "Braids",
    services: [
      "Boho braids / goddess braids",
      "Braid take-down",
      "Box braids",
      "Crochet",
      "Creative braids (e.g. patewo)",
      "Feed-in braids",
      "French curl",
      "Fulani / Lemonade braids",
      "Half braids, half sew-in",
      "Knotless braids",
      "Miracle knots",
      "Microbraids / x-small braids",
      "Pre-parting",
      "Stitch braids",
      "Twists (with extensions)",
    ],
  },
  {
    label: "Colour",
    services: ["Balayage", "Full head colour", "Highlights", "Wig colour"],
  },
  {
    label: "Bridal / Editorial",
    services: ["Bridal / Editorial"],
  },
  {
    label: "Extensions",
    services: ["Clip ins (+ Silk press)", "K-tips / Invisible strands", "LA weave", "Microlinks", "Tape ins"],
  },
  {
    label: "Locs",
    services: ["Butterfly locs", "Faux locs", "Microlocs / Sisterlocs", "Retwist", "Starter locs"],
  },
  {
    label: "Sew in / Weave",
    services: [
      "Closure sew-in",
      "Flipover / Versatile sew-in",
      "Frontal sew-in",
      "Hybrid sew-in",
      "Pixie wig / weave install",
      "Quick weave",
      "Sew-in take-down",
      "Tracks (+ Silk press) / Partial / Invisible sew-in",
      "Traditional sew-in / leave out",
    ],
  },
  {
    label: "Style (Sew-In / Frontal / Relaxer)",
    services: ["Frontal ponytail / bun", "Half up half down", "Pixie / finger waves", "Sleek ponytail / bun", "Updo"],
  },
  {
    label: "Treatments",
    services: [
      "Hair Botox",
      "Japanese straightening",
      "K-18 treatment",
      "Keratin treatment",
      "Moisturising treatment",
      "Olaplex treatment",
      "Relaxer / texturiser",
      "Scalp care",
      "Texture release",
    ],
  },
  {
    label: "Wash / Style (Natural hair)",
    services: [
      "Wig cornrows",
      "Curly cut / Wash & go",
      "Natural hair education",
      "Silk press",
      "Trim / Hair cut",
      "Twist out / Flexi rod",
      "Wash & blowdry",
    ],
  },
  {
    label: "Wigs",
    services: ["Custom wig", "Pixie wig / weave install", "U-Part wig install", "Wig colour", "Wig install (frontal / closure)"],
  },
];

export function AdminApp() {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [drafts, setDrafts] = useState<StylistDraft[]>([]);
  const [publishedStylists, setPublishedStylists] = useState<StylistDraft[]>([]);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [form, setForm] = useState<DraftForm>(emptyForm);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<AdminToast | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [checks, setChecks] = useState<DirectoryCheck[]>([]);
  const [checksLoadedAt, setChecksLoadedAt] = useState("");
  const [isRunningChecks, setIsRunningChecks] = useState(false);
  const [checkProgress, setCheckProgress] = useState({ checkedCount: 0, total: 0, nextOffset: null as number | null });
  const [activeCheckBatch, setActiveCheckBatch] = useState({ from: 0, to: 50 });
  const [activeView, setActiveView] = useState<"overview" | "drafts" | "freshness" | "discovery">("overview");
  const [intakeText, setIntakeText] = useState("");
  const [dashboard, setDashboard] = useState<DashboardMetrics | null>(null);
  const [suggestions, setSuggestions] = useState<DiscoverySuggestion[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [stylistStatusFilter, setStylistStatusFilter] = useState("all");
  const [isDraftEditorOpen, setIsDraftEditorOpen] = useState(false);
  const [freshnessUndoStack, setFreshnessUndoStack] = useState<FreshnessUndoState[]>([]);

	  function updateDraftLocations(draft: StylistDraft, nextAreaIds: string[]) {
	    const normalizedAreaIds = [...new Set(nextAreaIds.filter(Boolean))];
	    const primaryAreaId = normalizedAreaIds[0] || "";
	    const labels = normalizedAreaIds.map((areaId) => regions.find((region) => region.id === areaId)?.label || areaLabelFromId(areaId)).filter(Boolean);
	    updateStylist(draft.id, {
	      areaId: primaryAreaId,
	      areaIds: normalizedAreaIds,
	      areaLabel: labels.join(" / "),
	      neighbourhood: labels.length > 1 ? `${labels.join(" and ")} London` : labels[0] ? `${labels[0]} London` : "",
	    });
	  }

  const allStylists = useMemo(() => [...drafts, ...publishedStylists], [drafts, publishedStylists]);

	  const selectedDraft = useMemo(
	    () => (selectedDraftId ? allStylists.find((draft) => draft.id === selectedDraftId) ?? null : allStylists[0] ?? null),
	    [allStylists, selectedDraftId],
	  );

  const filteredStylists = useMemo(() => {
    return allStylists.filter((draft) => {
      const matchesStatus = stylistStatusFilter === "all" || draft.status === stylistStatusFilter || getDraftDisplayStatus(draft) === stylistStatusFilter;
      return matchesStatus;
    });
  }, [allStylists, stylistStatusFilter]);

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (isAuthed) {
      loadAdminData();
    }
  }, [isAuthed]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!isAuthed || !form.rawServices.trim()) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      const matchedServices = await matchRawServices(form.rawServices);
      if (!matchedServices.length) {
        return;
      }

      setForm((current) => ({
        ...current,
        services: mergeServices(current.services, matchedServices),
      }));
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [form.rawServices, isAuthed]);

  const selectedDraftRawServices = selectedDraft?.rawServices?.join("\n") ?? "";

  useEffect(() => {
    if (!isAuthed || !selectedDraft || !selectedDraftRawServices.trim()) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      const matchedServices = await matchRawServices(selectedDraftRawServices);
      if (!matchedServices.length) {
        return;
      }

	      updateStylist(selectedDraft.id, {
	        services: mergeServices(selectedDraft.services, matchedServices),
	      });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [selectedDraft?.id, selectedDraftRawServices, isAuthed]);

  async function checkSession() {
    setIsCheckingSession(true);
    try {
      const response = await fetch("/api/admin/session", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await response.json().catch(() => null) : null;
      setIsAuthed(response.ok && payload?.ok === true);
    } catch {
      setIsAuthed(false);
    } finally {
      setIsCheckingSession(false);
    }
  }

  async function loadAdminData() {
    setIsBusy(true);
    try {
      const [draftResponse, publishedResponse, optionResponse, dashboardResponse, discoveryResponse, savedChecksResponse] = await Promise.all([
        fetch("/api/admin/stylists/drafts", { credentials: "include" }),
        fetch("/api/admin/stylists/published", { credentials: "include" }),
        fetch("/api/admin/stylists/options", { credentials: "include" }),
        fetch("/api/admin/dashboard", { credentials: "include" }),
        fetch("/api/admin/discovery", { credentials: "include" }),
        fetch("/api/admin/stylists/checks/saved", { credentials: "include" }),
      ]);
      if (!draftResponse.ok || !optionResponse.ok) {
        setIsAuthed(false);
        return;
      }
      const draftPayload = await draftResponse.json();
      const publishedPayload = publishedResponse.ok ? await publishedResponse.json() : null;
      const optionPayload = await optionResponse.json();
      const dashboardPayload = dashboardResponse.ok ? await dashboardResponse.json() : null;
      const discoveryPayload = discoveryResponse.ok ? await discoveryResponse.json() : null;
      const savedChecksPayload = savedChecksResponse.ok ? await savedChecksResponse.json() : null;
      setDrafts(draftPayload.drafts ?? []);
      setPublishedStylists(publishedPayload?.stylists ?? []);
      setRegions(optionPayload.regions ?? []);
      setServices(optionPayload.services ?? []);
      setDashboard(dashboardPayload ?? null);
      setSuggestions(discoveryPayload?.suggestions ?? []);
      setChecks(savedChecksPayload?.checks ?? []);
      setChecksLoadedAt(savedChecksPayload?.checkedAt ?? "");
      if (savedChecksPayload) {
        setCheckProgress({
          checkedCount: savedChecksPayload.checkedCount ?? 0,
          total: savedChecksPayload.total ?? 0,
          nextOffset: savedChecksPayload.nextOffset ?? null,
        });
      }
      setSelectedDraftId((current) => current ?? draftPayload.drafts?.[0]?.id ?? null);
    } finally {
      setIsBusy(false);
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoginError("");
    setIsBusy(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) {
        setLoginError(payload.message || "Login failed.");
        return;
      }
      setPassword("");
      setIsAuthed(true);
    } finally {
      setIsBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    setIsAuthed(false);
    setDrafts([]);
  }

  function notify(messageText: string, tone: AdminToast["tone"] = "success") {
    setMessage(messageText);
    setToast({ id: Date.now(), message: messageText, tone });
  }

  async function createDraft(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setIsBusy(true);
    try {
      const response = await fetch("/api/admin/stylists/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        notify(payload.message || "Could not create draft.", "error");
        return;
      }
      setForm(emptyForm);
      setDrafts((current) => [payload.draft, ...current]);
      setSelectedDraftId(payload.draft.id);
      setActiveView("drafts");
      setIsDraftEditorOpen(true);
      notify("Draft created.");
    } finally {
      setIsBusy(false);
    }
  }

  async function createBulkDrafts(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setIsBusy(true);
    try {
      const response = await fetch("/api/admin/stylists/intake-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: intakeText }),
      });
      const payload = await response.json();
      if (!response.ok) {
        notify(payload.message || "Could not create drafts.", "error");
        return;
      }
      const createdDrafts = payload.drafts ?? [];
      setIntakeText("");
      setDrafts((current) => [...createdDrafts, ...current]);
      setSelectedDraftId(createdDrafts[0]?.id ?? null);
      setActiveView("drafts");
      setIsDraftEditorOpen(true);
      notify(`Created ${createdDrafts.length} draft${createdDrafts.length === 1 ? "" : "s"}.`);
    } finally {
      setIsBusy(false);
    }
  }

  async function saveDraft(draft: StylistDraft) {
    setMessage("");
    setIsBusy(true);
    try {
      const isPublished = getDraftDisplayStatus(draft) === "published";
      const response = await fetch(isPublished ? `/api/admin/stylists/published/${draft.id}` : `/api/admin/stylists/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok) {
        notify(payload.message || `Could not save ${isPublished ? "published stylist" : "draft"}.`, "error");
        return;
      }
      if (isPublished) {
        setPublishedStylists((current) => current.map((item) => (item.id === draft.id ? payload.stylist : item)));
        notify("Published stylist saved.");
      } else {
        setDrafts((current) => current.map((item) => (item.id === draft.id ? payload.draft : item)));
        notify("Draft saved.");
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function approveDraft(draft: StylistDraft) {
    setMessage("");
    setIsBusy(true);
    try {
      const response = await fetch(`/api/admin/stylists/drafts/${draft.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok) {
        notify(payload.message || "Could not approve draft.", "error");
        return;
      }
      setDrafts((current) => current.filter((item) => item.id !== draft.id));
      setSelectedDraftId(null);
      setIsDraftEditorOpen(false);
      notify(`${payload.salon.name} was added to the directory.`);
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteDraft(draftId: string) {
    setMessage("");
    setIsBusy(true);
    try {
      const response = await fetch(`/api/admin/stylists/drafts/${draftId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        notify(payload.message || "Could not delete draft.", "error");
        return;
      }
      setDrafts((current) => current.filter((draft) => draft.id !== draftId));
      setSelectedDraftId(null);
      setIsDraftEditorOpen(false);
      notify("Draft deleted.");
    } finally {
      setIsBusy(false);
    }
  }

  async function runChecks(offset = 0) {
    setMessage("");
    const isFullRun = offset === 0;
    if (isFullRun) {
      setChecks([]);
      setChecksLoadedAt("");
      setCheckProgress({
        checkedCount: 0,
        total: dashboard?.freshness.total || checkProgress.total || 0,
        nextOffset: null,
      });
    }
    setIsRunningChecks(true);
    try {
      let nextOffset: number | null = offset;
      let totalUpdates = 0;
      let lastCheckedAt = "";
      let completedChecks: DirectoryCheck[] = [];
      let completedCount = 0;
      let totalCount = 0;

      while (nextOffset !== null) {
        const batchOffset = nextOffset;
        setActiveCheckBatch({ from: batchOffset + 1, to: batchOffset + 50 });
        const response = await fetch(`/api/admin/stylists/checks?offset=${batchOffset}&limit=50`, { credentials: "include" });
        const payload = await response.json().catch(() => ({ message: "Could not run checks." }));
        if (!response.ok) {
          setMessage(payload.message || "Could not run checks.");
          return;
        }

        const batchChecks = payload.checks ?? [];
        totalUpdates += batchChecks.length;
        lastCheckedAt = payload.checkedAt || lastCheckedAt || new Date().toISOString();
        completedChecks = batchOffset === 0 ? batchChecks : [...completedChecks, ...batchChecks];
        setChecks(completedChecks);
        setChecksLoadedAt(lastCheckedAt);
        setCheckProgress({
          checkedCount: payload.checkedCount ?? 0,
          total: payload.total ?? 0,
          nextOffset: payload.nextOffset ?? null,
        });
        completedCount = payload.checkedCount ?? completedCount;
        totalCount = payload.total ?? totalCount;
        setMessage(`Checked ${payload.checkedCount ?? 0} of ${payload.total ?? 0}. Found ${totalUpdates} update${totalUpdates === 1 ? "" : "s"} so far.`);
        nextOffset = payload.nextOffset ?? null;
      }

      setMessage(`Health check complete. Found ${totalUpdates} update${totalUpdates === 1 ? "" : "s"}.`);
      setDashboard((current) =>
        current
          ? {
              ...current,
              freshness: {
                ...current.freshness,
                totalIssues: completedChecks.length,
                checkedCount: completedCount || current.freshness.checkedCount,
                total: totalCount || current.freshness.total,
                updatedAt: lastCheckedAt || current.freshness.updatedAt,
                brokenLinks: completedChecks.filter((check) => check.linkChecks?.some(isActionableBrokenLink)).length,
                manualLinks: completedChecks.filter((check) => check.linkChecks?.some(isManualCheckLink)).length,
                serviceChanges: completedChecks.filter((check) => check.addedServices?.length || check.removedServices?.length).length,
              },
            }
          : current,
      );
    } finally {
      setIsRunningChecks(false);
    }
  }

  async function generateDiscoverySuggestions() {
    setIsGeneratingSuggestions(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/discovery/generate", { method: "POST", credentials: "include" });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.message || "Could not generate suggestions.");
        return;
      }
      setSuggestions(payload.suggestions ?? []);
      setMessage(`Generated ${(payload.suggestions ?? []).length} discovery leads.`);
      await loadAdminData();
    } finally {
      setIsGeneratingSuggestions(false);
    }
  }

  async function createDraftFromSuggestion(suggestionId: string) {
    setIsBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/discovery/${suggestionId}/create-draft`, { method: "POST", credentials: "include" });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.message || "Could not create draft from suggestion.");
        return;
      }
      setDrafts((current) => [payload.draft, ...current]);
      setSelectedDraftId(payload.draft.id);
      setActiveView("drafts");
      setIsDraftEditorOpen(true);
      setMessage("Draft created from suggestion.");
    } finally {
      setIsBusy(false);
    }
  }

  async function applyFreshnessUpdate(check: DirectoryCheck, update: FreshnessUpdate) {
    const undoState: FreshnessUndoState = {
      check: cloneDirectoryCheck(check),
      previousServices: [...check.currentServices],
      update,
      label: getFreshnessUndoLabel(update),
    };
    setIsBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/stylists/${check.id}/freshness`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(update),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.message || "Could not update listing.");
        return;
      }
      setChecks((current) =>
        current.map((item) =>
          item.id === check.id
            ? {
                ...item,
                bookingUrl: update.bookingUrl ?? item.bookingUrl,
                instagramUrl: update.instagramUrl ?? item.instagramUrl,
                websiteUrl: update.websiteUrl ?? item.websiteUrl,
                currentServices: payload.salon?.services ?? item.currentServices,
                addedServices: removeReviewedServices(item.addedServices, [...(update.addServices ?? []), ...(update.rejectAddedServices ?? [])]),
                removedServices: removeReviewedServices(item.removedServices, [...(update.removeServices ?? []), ...(update.rejectRemovedServices ?? [])]),
                ...removeReviewedLinkChecks(item, update),
              }
            : item,
        ),
      );
      setFreshnessUndoStack((current) => [...current, undoState]);
      setMessage("Directory listing updated.");
    } finally {
      setIsBusy(false);
    }
  }

  async function undoFreshnessUpdate() {
    const lastFreshnessUndo = freshnessUndoStack[freshnessUndoStack.length - 1];
    if (!lastFreshnessUndo) return;
    setIsBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/stylists/${lastFreshnessUndo.check.id}/freshness/undo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          check: lastFreshnessUndo.check,
          previousServices: lastFreshnessUndo.previousServices,
          rejectAddedServices: lastFreshnessUndo.update.rejectAddedServices,
          rejectRemovedServices: lastFreshnessUndo.update.rejectRemovedServices,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.message || "Could not undo health check action.");
        return;
      }
      const restoredCheck = payload.check ?? lastFreshnessUndo.check;
      setChecks((current) => [restoredCheck, ...current.filter((item) => item.id !== restoredCheck.id)]);
      setFreshnessUndoStack((current) => current.slice(0, -1));
      setMessage("Health check action undone.");
      await loadAdminData();
    } finally {
      setIsBusy(false);
    }
  }

  async function matchRawServices(rawServices: string) {
    const response = await fetch("/api/admin/stylists/match-services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ rawServices }),
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return Array.isArray(payload.services) ? payload.services : [];
  }

  function updateStylist(draftId: string, update: Partial<StylistDraft>) {
    setDrafts((current) => current.map((draft) => (draft.id === draftId ? { ...draft, ...update } : draft)));
    setPublishedStylists((current) => current.map((draft) => (draft.id === draftId ? { ...draft, ...update } : draft)));
  }

  if (isCheckingSession) {
    return (
      <main className="min-h-screen bg-stone-950 text-stone-50">
        <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
          <Loader2 className="size-5 animate-spin" />
        </div>
      </main>
    );
  }

  if (!isAuthed) {
    return (
      <main className="min-h-screen bg-stone-950 text-stone-50">
        <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
          <form onSubmit={login} className="w-full space-y-5">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-stone-400">ROW K</p>
              <h1 className="mt-3 text-3xl font-semibold">Admin portal</h1>
            </div>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Admin password"
              className="rounded-none border-stone-700 bg-stone-900 text-stone-50 placeholder:text-stone-500"
            />
            {loginError ? <p className="text-sm text-red-300">{loginError}</p> : null}
            <Button type="submit" disabled={isBusy} className="w-full rounded-none">
              {isBusy ? <Loader2 className="size-4 animate-spin" /> : null}
              Unlock admin
            </Button>
          </form>
        </div>
      </main>
    );
  }

  const syncLabel = dashboard?.freshness.updatedAt ? `Synced ${formatRelativeTime(dashboard.freshness.updatedAt)}` : "Synced just now";

  return (
    <main className="min-h-screen bg-[#f8f8f7] text-stone-950">
      <header className="mx-auto max-w-7xl px-5 pt-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="inline-flex rounded-none bg-stone-950 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-white">ROW K ADMIN</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-2 text-xs text-stone-500">
              <span className="size-2 rounded-none bg-emerald-500" />
              {syncLabel}
            </span>
            <Button type="button" variant="outline" onClick={logout} className="h-9 rounded-none bg-white px-3 text-xs">
              Log out
            </Button>
          </div>
        </div>

        <nav className="mt-9 flex gap-7 border-b border-stone-200">
          {(["overview", "drafts", "freshness"] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setActiveView(view)}
              className={cn(
                "border-b-2 px-0 pb-3 text-sm capitalize transition",
                activeView === view ? "border-stone-950 text-stone-950" : "border-transparent text-stone-500 hover:text-stone-900",
              )}
            >
              {view === "drafts" ? "Stylists" : view === "freshness" ? "Health" : view}
            </button>
          ))}
        </nav>
      </header>

      {activeView === "overview" ? (
        <DashboardOverview
          dashboard={dashboard}
          checks={checks}
          publishedCount={publishedStylists.length}
          onOpenView={setActiveView}
        />
      ) : null}

      {activeView === "drafts" ? (
        <StylistsPage
          drafts={filteredStylists}
          allDrafts={allStylists}
          editableDrafts={drafts}
          publishedStylists={publishedStylists}
          dashboard={dashboard}
          statusFilter={stylistStatusFilter}
          isBusy={isBusy}
          intakeText={intakeText}
          selectedDraft={isDraftEditorOpen ? selectedDraft : null}
          regions={regions}
          services={services}
          onStatusFilterChange={setStylistStatusFilter}
          onIntakeChange={setIntakeText}
          onSubmitIntake={createBulkDrafts}
          onSelectDraft={(draftId) => {
            setSelectedDraftId(draftId);
            setIsDraftEditorOpen(true);
          }}
          onCloseEditor={() => setIsDraftEditorOpen(false)}
          onChangeDraft={(update) => selectedDraft ? updateStylist(selectedDraft.id, update) : undefined}
          onChangeDraftLocations={(areaIds) => selectedDraft ? updateDraftLocations(selectedDraft, areaIds) : undefined}
          onSaveDraft={() => selectedDraft ? saveDraft(selectedDraft) : undefined}
          onApproveDraft={() => selectedDraft ? approveDraft(selectedDraft) : undefined}
          onDeleteDraft={() => selectedDraft ? deleteDraft(selectedDraft.id) : undefined}
        />
      ) : null}

      {activeView === "freshness" ? (
        <FreshnessPage
          dashboard={dashboard}
          checks={checks}
          checksLoadedAt={checksLoadedAt}
          checkProgress={checkProgress}
          activeCheckBatch={activeCheckBatch}
          isRunningChecks={isRunningChecks}
          isBusy={isBusy}
          lastUndo={freshnessUndoStack[freshnessUndoStack.length - 1] ?? null}
          onRunChecks={() => runChecks(0)}
          onApply={applyFreshnessUpdate}
          onUndo={undoFreshnessUpdate}
        />
      ) : null}

      {activeView === "discovery" ? (
        <DiscoveryPage
          suggestions={suggestions}
          isGenerating={isGeneratingSuggestions}
          isBusy={isBusy}
          onGenerate={generateDiscoverySuggestions}
          onCreateDraft={createDraftFromSuggestion}
        />
      ) : null}

      <AdminToastMessage toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}

function AdminToastMessage({ toast, onClose }: { toast: AdminToast | null; onClose: () => void }) {
  if (!toast) {
    return null;
  }

  const isError = toast.tone === "error";

  return (
    <div className="fixed bottom-5 right-5 z-[60] w-[calc(100vw-2.5rem)] max-w-sm" role="status" aria-live="polite">
      <div className={cn("flex items-start gap-3 border bg-white p-4 shadow-lg", isError ? "border-red-200" : "border-stone-200")}>
        <span className={cn("mt-0.5 inline-flex size-5 shrink-0 items-center justify-center", isError ? "text-red-700" : "text-emerald-700")}>
          {isError ? <AlertTriangle className="size-4" /> : <Check className="size-4" />}
        </span>
        <p className="min-w-0 flex-1 text-sm font-medium text-stone-900">{toast.message}</p>
        <button type="button" onClick={onClose} className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500 hover:text-stone-950">
          Close
        </button>
      </div>
    </div>
  );
}

function StylistsPage({
  drafts,
  allDrafts,
  editableDrafts,
  publishedStylists,
  dashboard,
  statusFilter,
  isBusy,
  intakeText,
  selectedDraft,
  regions,
  services,
  onStatusFilterChange,
  onIntakeChange,
  onSubmitIntake,
  onSelectDraft,
  onCloseEditor,
  onChangeDraft,
  onChangeDraftLocations,
  onSaveDraft,
  onApproveDraft,
  onDeleteDraft,
}: {
  drafts: StylistDraft[];
  allDrafts: StylistDraft[];
  editableDrafts: StylistDraft[];
  publishedStylists: StylistDraft[];
  dashboard: DashboardMetrics | null;
  statusFilter: string;
  isBusy: boolean;
  intakeText: string;
  selectedDraft: StylistDraft | null;
  regions: RegionOption[];
  services: string[];
  onStatusFilterChange: (value: string) => void;
  onIntakeChange: (value: string) => void;
  onSubmitIntake: (event: FormEvent) => void;
  onSelectDraft: (draftId: string) => void;
  onCloseEditor: () => void;
  onChangeDraft: (update: Partial<StylistDraft>) => void;
  onChangeDraftLocations: (areaIds: string[]) => void;
  onSaveDraft: () => void;
  onApproveDraft: () => void;
  onDeleteDraft: () => void;
}) {
  const readyDraftCount = editableDrafts.filter((draft) => getDraftDisplayStatus(draft) === "ready_to_publish").length;
  const draftCount = editableDrafts.filter((draft) => getDraftDisplayStatus(draft) === "draft").length;
  const ready = readyDraftCount || dashboard?.drafts.readyToApprove || 0;
  const published = publishedStylists.length || dashboard?.freshness.total || 0;
  const statusLabel = statusFilter === "all" ? "All statuses" : getStylistStatusLabel(statusFilter);

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-9">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Stylists</h1>
      </section>

      <form onSubmit={onSubmitIntake} className="relative">
        <Plus className="pointer-events-none absolute left-6 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
        <textarea
          value={intakeText}
          onChange={(event) => onIntakeChange(event.target.value)}
          rows={1}
          aria-label="Create draft from link, handle, or notes"
          placeholder="Paste a link, handle, or notes about a stylist..."
          className="block h-16 min-h-16 w-full resize-none overflow-hidden whitespace-nowrap rounded-none border border-stone-200 bg-white py-5 pl-16 pr-24 text-base leading-6 outline-none placeholder:text-stone-400 focus:border-stone-400"
        />
        <button
          type="submit"
          disabled={isBusy || !intakeText.trim()}
          className="absolute right-3 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-none bg-stone-100 text-stone-600 transition hover:bg-stone-200 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Create draft"
        >
          {isBusy ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-3">
        <StylistMetricCard
          title="Draft"
          value={draftCount}
          icon={<FileText className="size-4" />}
          valueClassName="text-sky-700"
          isActive={statusFilter === "draft"}
          onClick={() => onStatusFilterChange(statusFilter === "draft" ? "all" : "draft")}
        />
        <StylistMetricCard
          title="Ready to Publish"
          value={ready}
          icon={<Check className="size-4" />}
          valueClassName="text-emerald-700"
          isActive={statusFilter === "ready_to_publish"}
          onClick={() => onStatusFilterChange(statusFilter === "ready_to_publish" ? "all" : "ready_to_publish")}
        />
        <StylistMetricCard
          title="Published"
          value={published}
          icon={<CompassDot />}
          isActive={statusFilter === "published"}
          onClick={() => onStatusFilterChange(statusFilter === "published" ? "all" : "published")}
        />
      </div>

      <section className="overflow-hidden rounded-none border border-stone-200 bg-white">
        <div className="flex items-start justify-between gap-4 p-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Stylist entries</h2>
            <p className="mt-1 text-sm text-stone-500">
              {drafts.length} of {allDrafts.length} stylist{allDrafts.length === 1 ? "" : "s"}
              {statusFilter !== "all" ? ` · ${statusLabel}` : ""}
            </p>
          </div>
          <button type="button" className="inline-flex items-center gap-1.5 text-sm text-stone-700 hover:text-stone-950">
            <ArrowUpDown className="size-4" />
            Sort
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm md:min-w-[900px]">
            <thead className="border-b border-stone-100 text-xs font-medium text-stone-500">
              <tr>
                <th className="px-4 py-3">Stylist</th>
                <th className="px-4 py-3">Status</th>
                <th className="hidden px-4 py-3 md:table-cell">Completeness</th>
                <th className="hidden px-4 py-3 md:table-cell">Services</th>
                <th className="hidden px-4 py-3 md:table-cell">Location</th>
                <th className="hidden px-4 py-3 md:table-cell">Last edited</th>
                <th className="w-10 px-4 py-3">
                  <span className="sr-only">Open stylist</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {drafts.length ? (
                drafts.map((draft) => {
                  const completeness = getDraftCompleteness(draft);
                  return (
	                    <tr
	                      key={draft.id}
	                      tabIndex={0}
	                      onClick={() => onSelectDraft(draft.id)}
	                      onKeyDown={(event) => {
	                        if (event.key === "Enter" || event.key === " ") {
	                          event.preventDefault();
	                          onSelectDraft(draft.id);
	                        }
	                      }}
	                      className="cursor-pointer border-b border-stone-100 transition hover:bg-stone-50 focus:bg-stone-50 focus:outline-none last:border-b-0"
	                    >
                      <td className="max-w-[12rem] truncate px-4 py-4 font-medium text-stone-950 sm:max-w-none">{draft.name || "Untitled stylist"}</td>
                      <td className="px-4 py-4">
                        <DraftTableStatusBadge draft={draft} />
                      </td>
                      <td className="hidden px-4 py-4 md:table-cell">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-20 overflow-hidden rounded-none bg-stone-100">
                            <div className="h-full rounded-none bg-stone-950" style={{ width: `${completeness}%` }} />
                          </div>
                          <span className="text-xs text-stone-500">{completeness}%</span>
                        </div>
                      </td>
                      <td className="hidden px-4 py-4 text-stone-700 md:table-cell">{draft.services.length}</td>
                      <td className="hidden px-4 py-4 text-stone-700 md:table-cell">{draft.areaLabel || "—"}</td>
                      <td className="hidden px-4 py-4 text-stone-500 md:table-cell">{formatRelativeTime(draft.updatedAt || draft.createdAt)}</td>
	                      <td className="px-4 py-4">
	                        <span className="inline-flex size-7 items-center justify-center rounded-none text-stone-500">
	                          <ChevronRight className="size-4" />
	                        </span>
	                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">
                    No stylists match those filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedDraft ? (
        <DraftEditorDrawer
          draft={selectedDraft}
          regions={regions}
          services={services}
          isBusy={isBusy}
          onClose={onCloseEditor}
          onChange={onChangeDraft}
          onChangeLocations={onChangeDraftLocations}
          onSave={onSaveDraft}
          onApprove={onApproveDraft}
          onDelete={onDeleteDraft}
        />
      ) : null}
    </div>
  );
}

function DraftEditorDrawer({
  draft,
  regions,
  services,
  isBusy,
  onClose,
  onChange,
  onChangeLocations,
  onSave,
  onApprove,
  onDelete,
}: {
  draft: StylistDraft;
  regions: RegionOption[];
  services: string[];
  isBusy: boolean;
  onClose: () => void;
  onChange: (update: Partial<StylistDraft>) => void;
  onChangeLocations: (areaIds: string[]) => void;
  onSave: () => void;
  onApprove: () => void;
  onDelete: () => void;
}) {
  const isPublished = getDraftDisplayStatus(draft) === "published";
  const canDelete = !isPublished;
  const displayStatus = getDraftDisplayStatus(draft);
  const [activeStep, setActiveStep] = useState<DraftEditorStep>("details");
  const stepOrder: DraftEditorStep[] = ["details", "services", "review"];
  const activeStepIndex = stepOrder.indexOf(activeStep);
  const canGoBack = activeStepIndex > 0;
  const canGoNext = activeStepIndex < stepOrder.length - 1;

  useEffect(() => {
    setActiveStep("details");
  }, [draft.id]);

  function goToPreviousStep() {
    if (canGoBack) {
      setActiveStep(stepOrder[activeStepIndex - 1]);
    }
  }

  function goToNextStep() {
    if (canGoNext) {
      setActiveStep(stepOrder[activeStepIndex + 1]);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/20 backdrop-blur-[1px]">
      <button type="button" aria-label="Close editor" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[628px] flex-col overflow-hidden border-l border-stone-200 bg-white">
        <div className="shrink-0 border-b border-stone-200 px-7 pb-7 pt-7">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-stone-700">
              <button type="button" onClick={onClose} className="inline-flex size-8 items-center justify-center rounded-none hover:bg-stone-100" aria-label="Close editor">
                <ChevronsRight className="size-4" />
              </button>
            </div>
            {canDelete ? (
              <button
                type="button"
                onClick={onDelete}
                disabled={isBusy}
                className="inline-flex size-8 items-center justify-center rounded-none text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Delete draft"
                title="Delete draft"
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-stone-950">{draft.name || "Untitled stylist"}</h2>
            <DraftStatusPill status={displayStatus} />
          </div>

          <DraftEditorStepper activeStep={activeStep} onStepChange={setActiveStep} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-7 pb-32">
          <DraftEditor
            draft={draft}
            regions={regions}
            services={services}
            isBusy={isBusy}
            onChange={onChange}
            onChangeLocations={onChangeLocations}
            onSave={onSave}
            onApprove={onApprove}
            onDelete={onDelete}
            canDelete={!isPublished}
            activeStep={activeStep}
            isEmbedded
          />
        </div>

        <div className="shrink-0 border-t border-stone-200 bg-white/95 px-7 py-4 backdrop-blur">
          <div className="grid grid-cols-2 gap-4">
            {canGoBack || isPublished ? (
              <Button
                type="button"
                variant="outline"
                onClick={canGoBack ? goToPreviousStep : onSave}
                disabled={isBusy}
                className="h-11 rounded-none bg-white"
              >
                {canGoBack ? <ChevronLeft className="size-4" /> : null}
                {canGoBack ? "Back" : "Save changes"}
              </Button>
            ) : null}
            {canGoNext ? (
              <Button type="button" onClick={goToNextStep} disabled={isBusy} className="h-11 rounded-none bg-stone-950">
                {activeStep === "details" ? "Services" : "Review"}
                <ChevronRight className="size-4" />
              </Button>
            ) : !isPublished ? (
              <Button type="button" onClick={onApprove} disabled={isBusy} className="h-11 rounded-none bg-stone-950">
                Publish
              </Button>
            ) : (
              <Button type="button" onClick={onSave} disabled={isBusy} className="h-11 rounded-none bg-stone-950">
                Save
              </Button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function DraftStatusPill({ status }: { status: string }) {
  const label = getStylistStatusLabel(status);
  const colorClass =
    status === "ready_to_publish"
      ? "bg-emerald-100 text-emerald-800"
      : status === "published"
        ? "bg-blue-100 text-blue-800"
        : "bg-stone-100 text-stone-700";

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-none px-3 py-1.5 text-sm font-medium", colorClass)}>
      {status === "ready_to_publish" ? <Check className="size-3.5" /> : null}
      {label}
    </span>
  );
}

function DraftEditorStepper({
  activeStep,
  onStepChange,
}: {
  activeStep: DraftEditorStep;
  onStepChange: (step: DraftEditorStep) => void;
}) {
  const steps = [
    { id: "details" as const, number: 1, label: "Details" },
    { id: "services" as const, number: 2, label: "Services" },
    { id: "review" as const, number: 3, label: "Review" },
  ];

  return (
    <div className="mt-5 border-t border-stone-200 pt-5">
      <div className="mx-auto grid max-w-[440px] grid-cols-[1fr_1fr_1fr] items-start">
        {steps.map((step, index) => (
          <div key={step.id} className="relative flex flex-col items-center gap-2 text-center">
            {index > 0 ? <span className="absolute right-1/2 top-4 h-px w-full bg-stone-200" /> : null}
            <button
              type="button"
              onClick={() => onStepChange(step.id)}
              aria-current={step.id === activeStep ? "step" : undefined}
              aria-label={`Go to ${step.label} step`}
              className="group relative z-10 flex flex-col items-center gap-2 rounded-none px-3 text-center outline-none"
            >
              <span
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-none border text-sm font-semibold transition",
                  step.id === activeStep
                    ? "border-stone-200 bg-stone-100 text-stone-950 group-hover:border-stone-300 group-hover:bg-stone-200"
                    : "border-transparent bg-stone-100 text-stone-500 group-hover:border-stone-300 group-hover:bg-stone-200 group-hover:text-stone-900",
                )}
              >
                {step.number}
              </span>
              <span className={cn("text-sm transition", step.id === activeStep ? "font-medium text-stone-950" : "text-stone-500 group-hover:text-stone-900")}>{step.label}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StylistMetricCard({
  title,
  value,
  icon,
  valueClassName,
  isActive,
  onClick,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  valueClassName?: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">{title}</p>
        <span className="text-stone-400">{icon}</span>
      </div>
      <p className={cn("mt-5 text-4xl font-semibold leading-none tracking-tight", valueClassName)}>{value}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isActive}
        aria-label={`Show ${title} stylists`}
      className={cn(
        "rounded-none border bg-white p-6 text-left transition hover:border-stone-400",
        isActive ? "border-stone-300 bg-stone-100 hover:bg-stone-200" : "border-stone-200",
      )}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="rounded-none border border-stone-200 bg-white p-6">
      {content}
    </div>
  );
}

function CompassDot() {
  return <SearchCheck className="size-4" />;
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DraftTableStatusBadge({ draft }: { draft: StylistDraft }) {
  const status = getDraftDisplayStatus(draft);
  const label = getStylistStatusLabel(status);
  const colorClass =
    status === "ready_to_publish"
      ? "bg-emerald-100 text-emerald-800"
      : status === "published"
        ? "bg-blue-100 text-blue-800"
        : "bg-sky-100 text-sky-800";

  return <span className={cn("rounded-none px-3 py-1 text-xs", colorClass)}>{label}</span>;
}

function getDraftDisplayStatus(draft: StylistDraft) {
  if (draft.status === "approved") {
    return "published";
  }

  if (draft.status === "ready_to_approve") {
    return "ready_to_publish";
  }

  return "draft";
}

function getStylistStatusLabel(status: string) {
  if (status === "ready_to_publish") {
    return "Ready to Publish";
  }
  if (status === "published") {
    return "Published";
  }
  return "Draft";
}

function getVisibleDraftWarnings(draft: StylistDraft) {
  return (draft.warnings || []).filter((warning) => {
    if (warning === "No booking link identified yet.") {
      return !hasDraftBookingLink(draft);
    }
    if (warning === "No services matched yet.") {
      return draft.services.length === 0;
    }
    return true;
  });
}

function hasDraftBookingLink(draft: StylistDraft) {
  return Boolean(draft.bookingUrl.trim() || isBookingLikeUrl(draft.websiteUrl));
}

function urlsMatch(left = "", right = "") {
  const normalize = (value: string) => value.trim().replace(/\/+$/, "").toLowerCase();
  return Boolean(normalize(left) && normalize(left) === normalize(right));
}

function isBookingLikeUrl(url = "") {
  try {
    const parsed = new URL(url);
    const text = `${parsed.pathname} ${parsed.search} ${parsed.hash}`.toLowerCase();
    return /\b(book|booking|appointments?|schedule|calendar|reserve|reservation)\b/.test(text);
  } catch {
    return false;
  }
}

function getStylistStatusCounts(drafts: StylistDraft[]) {
  return drafts.reduce(
    (counts, draft) => {
      const status = getDraftDisplayStatus(draft);
      counts[status] += 1;
      return counts;
    },
    {
      draft: 0,
      published: 0,
      ready_to_publish: 0,
    } as Record<"draft" | "published" | "ready_to_publish", number>,
  );
}

function getDraftCompleteness(draft: StylistDraft) {
  const fields = [
    Boolean(draft.name.trim()),
    Boolean(draft.instagramUrl),
    Boolean(draft.bookingUrl),
    draft.services.length > 0,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function DashboardOverview({
  dashboard,
  checks,
  publishedCount,
  onOpenView,
}: {
  dashboard: DashboardMetrics | null;
  checks: DirectoryCheck[];
  publishedCount: number;
  onOpenView: (view: "overview" | "drafts" | "freshness") => void;
}) {
  const healthRows = buildFreshnessRecommendationGroups(checks);
  const visibleStaleEntries = checks.length ? healthRows.length : dashboard?.freshness.totalIssues || 0;
  const visibleWrongServices = healthRows.filter((row) => row.details.some((detail) => detail.kind === "add" || detail.kind === "remove")).length;
  const visibleBrokenLinks = healthRows.reduce((count, row) => count + row.details.filter((detail) => detail.kind === "fix").length, 0);
  const visibleManualChecks = healthRows.reduce((count, row) => count + row.details.filter((detail) => detail.kind === "manual").length, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-5 py-11">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Overview</h1>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCard
          title="Stylists"
          value={publishedCount}
          detail={`${dashboard?.drafts.total ?? 0} draft${(dashboard?.drafts.total ?? 0) === 1 ? "" : "s"} · ${dashboard?.drafts.readyToApprove ?? 0} ready · ${publishedCount} published`}
          icon={<FileText className="size-4" />}
          onClick={() => onOpenView("drafts")}
        />
        <DashboardCard
          title="Stale entries"
          value={visibleStaleEntries}
          detail={`${visibleWrongServices} wrong service${visibleWrongServices === 1 ? "" : "s"} · ${visibleBrokenLinks} broken link${visibleBrokenLinks === 1 ? "" : "s"} · ${visibleManualChecks} couldn't verify`}
          icon={<ClockAlert className="size-4" />}
          onClick={() => onOpenView("freshness")}
        />
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  detail,
  icon,
  onClick,
}: {
  title: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open ${title}`}
      className={cn(
        "cursor-pointer rounded-none border p-6 text-left transition",
        "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 active:bg-stone-100",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">{title}</p>
        <span className="text-stone-400">{icon}</span>
      </div>
      <p className="mt-5 text-4xl font-semibold leading-none tracking-tight text-stone-950">{value}</p>
      <p className="mt-4 text-sm text-stone-500">{detail}</p>
    </button>
  );
}

type FreshnessPageApplyHandler = (
  check: DirectoryCheck,
  update: FreshnessUpdate,
) => void;

function FreshnessPage({
  dashboard,
  checks,
  checksLoadedAt,
  checkProgress,
  activeCheckBatch,
  isRunningChecks,
  isBusy,
  lastUndo,
  onRunChecks,
  onApply,
  onUndo,
}: {
  dashboard: DashboardMetrics | null;
  checks: DirectoryCheck[];
  checksLoadedAt: string | null;
  checkProgress: { checkedCount: number; total: number; nextOffset: number | null };
  activeCheckBatch: { from: number; to: number };
  isRunningChecks: boolean;
  isBusy: boolean;
  lastUndo: FreshnessUndoState | null;
  onRunChecks: () => void;
  onApply: FreshnessPageApplyHandler;
  onUndo: () => void;
}) {
  const total = checkProgress.total || dashboard?.freshness.total || 0;
  const checkedCount = checkProgress.checkedCount || dashboard?.freshness.checkedCount || 0;
	  const [freshnessFilter, setFreshnessFilter] = useState<"all" | "service-changes" | "broken-links" | "manual-check">("all");
	  const rows = buildFreshnessRecommendationGroups(checks);
	  const recommendationCount = rows.length;
		  const lastCompletedAt = checksLoadedAt || dashboard?.freshness.updatedAt;
		  const hasCompletedCheck = Boolean(lastCompletedAt || checkedCount > 0 || rows.length > 0);
  const isWaitingForResults = isRunningChecks && rows.length === 0;
  const activeBatchTo = total ? Math.min(activeCheckBatch.to, total) : activeCheckBatch.to;
  const runButtonLabel = isRunningChecks
    ? `Checking ${activeCheckBatch.from} - ${activeBatchTo}`
    : hasCompletedCheck
      ? "Refresh"
      : "Run";
	  const serviceChanges = rows.filter((row) => row.details.some((detail) => detail.kind === "add" || detail.kind === "remove")).length;
	  const brokenLinks = rows.reduce((count, row) => count + row.details.filter((detail) => detail.kind === "fix").length, 0);
  const manualChecks = rows.reduce((count, row) => count + row.details.filter((detail) => detail.kind === "manual").length, 0);
	  const filteredRows = freshnessFilter === "service-changes"
	    ? rows.filter((row) => row.details.some((d) => d.kind === "add" || d.kind === "remove"))
	    : freshnessFilter === "broken-links"
	      ? rows.filter((row) => row.details.some((d) => d.kind === "fix"))
        : freshnessFilter === "manual-check"
          ? rows.filter((row) => row.details.some((d) => d.kind === "manual"))
	      : rows;

	  return (
	    <div className="mx-auto max-w-7xl space-y-7 px-5 py-9">
	      <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
	        <div>
	          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Health check</h1>
	          <p className="mt-2 text-sm text-stone-500">
	            {lastCompletedAt ? `Last updated ${formatRelativeTime(lastCompletedAt)}` : "Not run yet"}
	          </p>
	        </div>
	        <div className="flex items-center gap-2">
	          {lastUndo ? (
	            <button
	              type="button"
	              onClick={onUndo}
	              disabled={isBusy}
	              title={`Undo ${lastUndo.label}`}
	              className="inline-flex h-10 items-center gap-2 rounded-none border border-stone-200 bg-white px-3 text-sm text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-40"
	            >
	              <Undo2 className="size-4" />
	              Undo
	            </button>
	          ) : null}
	          <Button type="button" onClick={onRunChecks} disabled={isRunningChecks} className="h-10 rounded-none bg-stone-950 px-4 text-sm">
	            {isRunningChecks ? <Loader2 className="size-4 animate-spin" /> : hasCompletedCheck ? <RefreshCw className="size-4" /> : <PlayIcon />}
	            {runButtonLabel}
	          </Button>
	        </div>
	      </section>

	      {isWaitingForResults ? (
          <FreshnessMetricSkeleton />
        ) : (
          <div className="grid gap-5 md:grid-cols-4">
            <FreshnessMetricCard title="Stale entries" value={recommendationCount} icon={<RefreshCw className="size-4" />} isActive={freshnessFilter === "all"} onClick={() => setFreshnessFilter("all")} />
            <FreshnessMetricCard title="Services incorrect" value={serviceChanges} icon={<AlertTriangle className="size-4" />} isActive={freshnessFilter === "service-changes"} onClick={() => setFreshnessFilter(freshnessFilter === "service-changes" ? "all" : "service-changes")} />
            <FreshnessMetricCard title="Broken links" value={brokenLinks} icon={<Unlink className="size-4" />} isActive={freshnessFilter === "broken-links"} onClick={() => setFreshnessFilter(freshnessFilter === "broken-links" ? "all" : "broken-links")} />
            <FreshnessMetricCard title="Could not verify" value={manualChecks} icon={<AlertTriangle className="size-4" />} isActive={freshnessFilter === "manual-check"} onClick={() => setFreshnessFilter(freshnessFilter === "manual-check" ? "all" : "manual-check")} />
          </div>
        )}

	      <section className="overflow-hidden rounded-none border border-stone-200 bg-white">
	        {isWaitingForResults ? (
            <FreshnessSkeleton />
          ) : filteredRows.length ? (
	          filteredRows.map((row, index) => (
	            <FreshnessRecommendationCard key={row.id} row={row} defaultOpen={index === 0} isBusy={isBusy} onApply={onApply} />
	          ))
	        ) : (
	          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-16 text-center">
              <h2 className="text-lg font-semibold tracking-tight text-stone-950">All clear</h2>
              <p className="mt-3 max-w-xl text-base text-stone-500">No health issues found. Everything is running smoothly.</p>
              <Button type="button" variant="outline" onClick={onRunChecks} disabled={isRunningChecks} className="mt-8 h-11 rounded-none bg-white px-4 text-sm">
                <RefreshCw className="size-4" />
                Run check again
              </Button>
            </div>
	        )}
	      </section>
	    </div>
	  );
	}

function PlayIcon() {
  return <span className="ml-0.5 inline-block size-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-current" />;
}

function FreshnessMetricCard({ title, value, icon, isActive, onClick }: { title: string; value: number; icon: React.ReactNode; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Show ${title}`}
      className={cn(
        "cursor-pointer rounded-none border border-stone-200 bg-white p-7 text-left transition hover:border-stone-300 active:bg-stone-50",
        isActive
          ? ""
          : "",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{title}</p>
        <span className="text-stone-400">{icon}</span>
      </div>
      <p className="mt-6 text-4xl font-semibold leading-none tracking-tight text-stone-950">{value}</p>
    </button>
  );
}

function FreshnessRecommendationCard({
  row,
  defaultOpen,
  isBusy,
  onApply,
}: {
  row: FreshnessRecommendationGroup;
  defaultOpen: boolean;
  isBusy: boolean;
  onApply: FreshnessPageApplyHandler;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasWebsiteLinkIssue = row.check.linkChecks.some((linkCheck) => linkCheck.type === "website" && linkCheck.status !== "ok");
  const primaryLinkLabel = hasWebsiteLinkIssue ? "Website URL" : "Booking URL";
  const primaryLinkValue = hasWebsiteLinkIssue ? row.websiteUrl || row.bookingUrl || "" : row.bookingUrl || "";
  const [primaryLinkUrl, setPrimaryLinkUrl] = useState(primaryLinkValue);
  const [instagramUrl, setInstagramUrl] = useState(row.instagramUrl || "");
  const [linkSaveState, setLinkSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const hasLinkIssues = row.details.some((d) => d.kind === "fix" || d.kind === "manual");

  async function handleSaveLinks() {
    setLinkSaveState("saving");
    try {
      const linkUpdate: FreshnessUpdate = hasWebsiteLinkIssue
        ? { websiteUrl: primaryLinkUrl }
        : {
            bookingUrl: primaryLinkUrl,
            ...(row.websiteUrl && urlsMatch(row.websiteUrl, row.bookingUrl) ? { websiteUrl: primaryLinkUrl } : {}),
          };
      await Promise.resolve(onApply(row.check, { ...linkUpdate, instagramUrl }));
      setLinkSaveState("saved");
      setTimeout(() => setLinkSaveState("idle"), 2500);
    } catch {
      setLinkSaveState("idle");
    }
  }

  return (
    <div className="border-b border-stone-100 last:border-b-0">
      <div className="flex items-center justify-between gap-4 px-7 py-5">
        <button type="button" onClick={() => setIsOpen((current) => !current)} className="min-w-0 flex-1 text-left">
          <span className="inline-flex min-w-0 flex-wrap items-center gap-3">
            <span className="text-lg font-semibold text-stone-950">{row.stylist}</span>
            <FreshnessDetailSummary details={row.details} />
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2 text-stone-700">
          <FreshnessLinkButtons row={row} />
          <IconActionDivider />
          <button type="button" onClick={() => setIsOpen((current) => !current)} className="inline-flex size-8 items-center justify-center rounded-none hover:bg-stone-100" aria-label={isOpen ? "Collapse recommendations" : "Expand recommendations"}>
            {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="space-y-3 px-7 pb-6">
          {row.details.map((detail, index) => (
            <FreshnessRecommendationItem
              key={`${row.id}-${detail.label}-${index}`}
              detail={detail}
              row={row}
              isBusy={isBusy}
              onApply={onApply}
              onSaveLinks={handleSaveLinks}
              linkSaveState={linkSaveState}
            />
          ))}
          {hasLinkIssues ? (
            <div className="space-y-3 rounded-none border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-600">Links</p>
              </div>
              <div className="h-px bg-stone-200" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={primaryLinkLabel}>
                  <Input value={primaryLinkUrl} onChange={(event) => setPrimaryLinkUrl(event.target.value)} placeholder="https://..." className="h-9 rounded-none" />
                </Field>
                <Field label="Instagram URL">
                  <Input value={instagramUrl} onChange={(event) => setInstagramUrl(event.target.value)} placeholder="https://www.instagram.com/..." className="h-9 rounded-none" />
                </Field>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FreshnessRecommendationItem({
  detail,
  row,
  isBusy,
  onApply,
  onSaveLinks,
  linkSaveState,
}: {
  detail: FreshnessRecommendationDetail;
  row: FreshnessRecommendationGroup;
  isBusy: boolean;
  onApply: FreshnessPageApplyHandler;
  onSaveLinks: () => void;
  linkSaveState: "idle" | "saving" | "saved";
}) {
  const isAdd = detail.kind === "add";
  const isRemove = detail.kind === "remove";
  const isManual = detail.kind === "manual";
  const visual = getFreshnessDetailVisual(detail);
  const acceptUpdate =
    detail.kind === "add" && detail.service
      ? { addServices: [detail.service] }
      : detail.kind === "remove" && detail.service
        ? { removeServices: [detail.service] }
        : row.acceptUpdate;
  const rejectUpdate =
    detail.kind === "add" && detail.service
      ? { rejectAddedServices: [detail.service] }
      : detail.kind === "remove" && detail.service
        ? { rejectRemovedServices: [detail.service] }
        : row.rejectUpdate;
  const primaryActionLabel = isAdd ? "Add service" : isRemove ? "Remove" : detail.kind === "fix" ? "Save" : "Resolve";
  const secondaryActionLabel = isAdd ? "Ignore" : isRemove ? "Keep" : "Ignore";

  return (
    <div
      className={cn(
        "grid gap-4 rounded-none border border-stone-200 bg-stone-50 px-4 sm:grid-cols-[minmax(0,1fr)_auto]",
        isManual ? "py-3 sm:items-center" : "py-4 sm:items-start",
      )}
    >
      <div className={cn("grid min-w-0 flex-1 gap-4", isManual ? "sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center" : "sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-start")}>
        <div className={cn("mt-1 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em]", visual.textClass)}>
          <span className={cn("size-3 rounded-none", visual.dotClass)} />
          {visual.label}
        </div>
        <div className="min-w-0">
          <div className={cn("flex min-w-0 flex-wrap items-center", isManual ? "gap-x-5 gap-y-1" : "gap-x-3 gap-y-1")}>
            <p className="font-semibold text-stone-950">{detail.label}</p>
            {detail.kind === "fix" || detail.kind === "manual" || detail.kind === "review" ? (
              <p className="text-sm font-medium text-stone-500">{detail.description}</p>
            ) : null}
          </div>
          {detail.evidence?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {detail.evidence.map((line) => (
                <span key={line} className="rounded-none border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-500">
                  {line}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {detail.kind !== "fix" ? (
        <div className="flex items-center justify-end gap-2 text-sm font-semibold">
          {isManual ? (
            <button
              type="button"
              disabled={isBusy || linkSaveState === "saving"}
              onClick={onSaveLinks}
              className={cn(
                "inline-flex items-center gap-2 rounded-none border px-3 py-2 transition disabled:cursor-not-allowed disabled:opacity-35",
                linkSaveState === "saved"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-stone-950 bg-stone-950 text-white hover:bg-stone-800 active:bg-stone-700",
              )}
            >
              {linkSaveState === "saving" ? (
                <><Loader2 className="size-3.5 animate-spin" /> Updating</>
              ) : linkSaveState === "saved" ? (
                <><Check className="size-3.5" /> Updated</>
              ) : (
                "Update"
              )}
            </button>
          ) : null}
          <button
            type="button"
            disabled={isBusy || !rejectUpdate}
            onClick={() => rejectUpdate ? onApply(row.check, rejectUpdate) : undefined}
            className="rounded-none border border-stone-200 bg-white px-3 py-2 text-stone-700 transition hover:border-stone-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {secondaryActionLabel}
          </button>
          {!isManual ? (
            <button
              type="button"
              disabled={isBusy || !acceptUpdate}
              onClick={() => acceptUpdate ? onApply(row.check, acceptUpdate) : undefined}
              className={cn(
                "rounded-none px-3 py-2 transition disabled:cursor-not-allowed disabled:opacity-35",
                isAdd
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
              )}
            >
              {primaryActionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type FreshnessRecommendationGroup = {
  id: string;
  check: DirectoryCheck;
  stylist: string;
  recommendation: string;
  typeTone: "critical" | "warning" | "info" | "neutral";
  details: FreshnessRecommendationDetail[];
  detected: string;
  status: "Open" | "Resolved";
  bookingUrl?: string;
  instagramUrl?: string;
  websiteUrl?: string;
  acceptUpdate?: {
    addServices?: string[];
    removeServices?: string[];
  };
  rejectUpdate?: FreshnessUpdate;
};

type FreshnessRecommendationDetail = {
  kind: "add" | "remove" | "fix" | "manual" | "review";
  label: string;
  description: string;
  service?: string;
  evidence?: string[];
  evidenceLabel?: string;
  reviewTone?: "danger" | "caution";
};

function getFreshnessDetailVisual(detail: FreshnessRecommendationDetail) {
  if (detail.kind === "add") {
    return { label: "Add", dotClass: "bg-emerald-500", textClass: "text-emerald-700" };
  }
  if (detail.kind === "remove" && detail.reviewTone === "caution") {
    return { label: "Review", dotClass: "bg-sky-500", textClass: "text-sky-700" };
  }
  if (detail.kind === "fix") {
    return { label: "Fix", dotClass: "bg-red-500", textClass: "text-red-700" };
  }
  if (detail.kind === "remove") {
    return { label: "Remove", dotClass: "bg-red-500", textClass: "text-red-700" };
  }
  if (detail.kind === "manual") {
    return { label: "Verify", dotClass: "bg-amber-500", textClass: "text-amber-700" };
  }
  return { label: "Review", dotClass: "bg-sky-500", textClass: "text-sky-700" };
}

function FreshnessDetailSummary({ details }: { details: FreshnessRecommendationDetail[] }) {
  const counts = details.reduce(
    (summary, detail) => ({
      ...summary,
      [detail.kind === "remove" && detail.reviewTone === "caution" ? "review" : detail.kind]: summary[detail.kind === "remove" && detail.reviewTone === "caution" ? "review" : detail.kind] + 1,
    }),
    { add: 0, remove: 0, fix: 0, manual: 0, review: 0 } as Record<FreshnessRecommendationDetail["kind"], number>,
  );
  const parts = [
    { count: counts.add, label: "add", className: "bg-emerald-100 text-emerald-700" },
    { count: counts.remove, label: "remove", className: "bg-red-100 text-red-700" },
    { count: counts.fix, label: "link fix", className: "bg-red-100 text-red-700" },
    { count: counts.manual, label: "verify", className: "bg-amber-100 text-amber-700" },
    { count: counts.review, label: "review", className: "bg-stone-100 text-stone-600" },
  ].filter((part) => part.count);

  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-2 text-sm text-stone-500">
      {parts.length
        ? parts.map((part) => (
            <span key={part.label} className="inline-flex items-center gap-1.5">
              <span className={`inline-flex size-5 items-center justify-center rounded-none text-[11px] font-semibold tabular-nums ${part.className}`}>{part.count}</span>
              <span>{part.label}</span>
            </span>
          ))
        : null}
    </span>
  );
}

function buildFreshnessRecommendationGroups(checks: DirectoryCheck[]): FreshnessRecommendationGroup[] {
  return checks.flatMap((check) => {
    const detected = check.checkedAt ? formatRelativeTime(check.checkedAt) : "Just now";
    const brokenLinks = check.linkChecks.filter(isActionableBrokenLink);
    const manualLinks = check.linkChecks.filter(isManualCheckLink);
    const addedServices = getActionableAddedServices(check);
    const removedServices = getActionableRemovedServices(check);
    const actionableIssues = check.issues.filter((issue) => isActionableFreshnessIssue(issue, check));
    const details: FreshnessRecommendationDetail[] = [
      ...brokenLinks.map((linkCheck) => ({
        kind: "fix" as const,
        label: `${titleCase(linkCheck.type)} link`,
        description: linkCheck.issues[0] || "Link not loading",
      })),
      ...manualLinks.map((linkCheck) => ({
        kind: "manual" as const,
        label: `${titleCase(linkCheck.type)} link`,
        description: getManualCheckDescription(linkCheck),
      })),
      ...removedServices.map((service) => {
        const possibleEvidence = getRemovalReviewEvidence(check.serviceCheck.rawServices, service);
        return {
          kind: "remove" as const,
          label: service,
          description: possibleEvidence.length ? "Possible evidence it still exists" : "Service no longer listed",
          service,
          evidence: possibleEvidence,
          evidenceLabel: possibleEvidence.length ? "Evidence it still exists" : undefined,
          reviewTone: possibleEvidence.length ? "caution" as const : "danger" as const,
        };
      }),
      ...addedServices.map((service) => ({
        kind: "add" as const,
        label: service,
        description: "New service detected",
        service,
        evidence: getServiceEvidence(check.serviceCheck.rawServices, service),
      })),
      ...actionableIssues.map((issue) => ({
        kind: "review" as const,
        label: "Review listing",
        description: issue,
      })),
    ];

    if (!details.length) {
      return [];
    }

    const hasServiceRecommendations = addedServices.length > 0 || removedServices.length > 0;
    const linkDismissUpdate = getLinkDismissUpdate(check);
    const acceptUpdate = hasServiceRecommendations
      ? {
          ...(addedServices.length ? { addServices: addedServices } : {}),
          ...(removedServices.length ? { removeServices: removedServices } : {}),
        }
      : undefined;
    const rejectUpdate = hasServiceRecommendations || linkDismissUpdate
      ? {
          ...(addedServices.length ? { rejectAddedServices: addedServices } : {}),
          ...(removedServices.length ? { rejectRemovedServices: removedServices } : {}),
          ...linkDismissUpdate,
        }
      : undefined;

    return [{
      check,
      stylist: check.name,
      detected,
      status: "Open" as const,
      bookingUrl: check.bookingUrl,
      instagramUrl: check.instagramUrl,
      websiteUrl: check.websiteUrl,
      id: `${check.id}-recommendations`,
      recommendation: getFreshnessGroupRecommendation(check, brokenLinks.length, manualLinks.length, addedServices, removedServices),
      typeTone: brokenLinks.length ? "critical" : manualLinks.length ? "warning" : addedServices.length ? "info" : "neutral",
      details,
      acceptUpdate,
      rejectUpdate,
    }];
  });
}

function isActionableBrokenLink(linkCheck: DirectoryCheck["linkChecks"][number]) {
  return linkCheck.status === "broken" && (linkCheck.httpStatus === 404 || linkCheck.httpStatus === 410);
}

function getActionableAddedServices(check: DirectoryCheck) {
  return check.addedServices.filter((service) => hasSupportedFreshnessEvidence(check, service) && getServiceEvidence(check.serviceCheck.rawServices, service).length > 0);
}

function getActionableRemovedServices(check: DirectoryCheck) {
  return check.removedServices.filter((service) => !hasSupportedFreshnessEvidence(check, service));
}

function hasSupportedFreshnessEvidence(check: DirectoryCheck, service: string) {
  if (service === "U-Part wig install") {
    return check.serviceCheck.rawServices.some((line) => hasExplicitUPartWigEvidence(line));
  }
  if (service === "Closure sew-in") {
    return check.serviceCheck.rawServices.some((line) => hasClosureSewInEvidence(line));
  }
  if (service === "Pixie wig / weave install") {
    return check.serviceCheck.rawServices.some((line) => hasPixieInstallEvidence(line));
  }
  if (service === "Wig install (frontal / closure)") {
    return hasWigInstallEvidence(check.serviceCheck.rawServices);
  }
  if (service === "Custom wig") {
    return hasCustomWigEvidence(check.serviceCheck.rawServices);
  }
  if (service === "Pixie / finger waves") {
    return hasRawEvidenceForService(check.serviceCheck.rawServices, service);
  }
  if (service === "Feed-in braids") {
    return !check.serviceCheck.rawServices.some((line) => hasHalfBraidsHalfSewInEvidence(line));
  }
  if (service === "Sleek ponytail / bun") {
    return !check.serviceCheck.rawServices.some((line) => hasFrontalPonytailEvidence(line) || hasBraidedPonytailEvidence(line));
  }
  if (service === "Natural hair education") {
    return check.serviceCheck.rawServices.some((line) => hasNaturalHairEducationEvidence(line));
  }
  if (service === "Keratin treatment") {
    return !check.serviceCheck.rawServices.some((line) => hasKeratinTipEvidence(line));
  }
  if (service === "Starter locs") {
    return check.serviceCheck.rawServices.some((line) => hasStarterLocsEvidence(line));
  }
  if (service === "Twists (with extensions)") {
    return check.serviceCheck.rawServices.some((line) => hasTwistsWithExtensionsEvidence(line));
  }
  if (service === "Tracks (+ Silk press) / Partial / Invisible sew-in") {
    return check.serviceCheck.rawServices.some((line) => hasTracksEvidence(line));
  }
  if (service === "Wash & blowdry") {
    return check.serviceCheck.rawServices.some((line) => hasWashBlowdryEvidence(line));
  }
  if (service === "Wig cornrows") {
    return check.serviceCheck.rawServices.some((line, index, lines) => hasWigCornrowsEvidence(line, lines, index));
  }
  if (service === "Stitch braids") {
    return check.serviceCheck.rawServices.some((line) => hasStitchBraidsEvidence(line));
  }
  if (service === "Butterfly locs" || service === "Faux locs") {
    return check.serviceCheck.rawServices.some((line) => hasSpecificLocSubtypeEvidence(line, service));
  }
  if (service === "Full head colour" || service === "Balayage" || service === "Highlights") {
    return !hasWigColourEvidence(check.serviceCheck.rawServices);
  }

  return true;
}

function hasRawEvidenceForService(rawServices: string[], service: string) {
  const normalizedRaw = normalizeEvidenceText(rawServices.join(" "));

  if (service === "Pixie wig / weave install") {
    return rawServices.some((line) => hasPixieInstallEvidence(line));
  }
  if (service === "Pixie / finger waves") {
    return /\b(finger\s+waves?|pixie\s+cut|short\s+pixie|wrap)\b/.test(normalizedRaw) && !hasRawEvidenceForService(rawServices, "Pixie wig / weave install");
  }
  if (service === "Wig colour") {
    return hasWigColourEvidence(rawServices);
  }
  if (service === "Olaplex treatment") {
    return /\bolaplex\b|\b(repair|bond)\b.*\b(bond|repair|treatment)\b/.test(normalizedRaw);
  }
  if (service === "Moisturising treatment") {
    return /\bmoisturi[sz](ing|e)\b|\bmoisture\b|\bhydrat(e|ing|ion)\b|\bprotein\s*&?\s+moisture\b|\bdeep\s+condition(ing)?\b|\bsteam\s+treat(ment)?\b/.test(normalizedRaw);
  }
  if (service === "Half up half down") {
    return /\bhalf\s+up\b.*\bhalf\s+down\b|\bhalf\s+up\s*,?\s*half\s+down\b/.test(normalizedRaw);
  }

  return false;
}

function hasExplicitUPartWigEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\b(u[\s-]*part|v[\s-]*part|u[\s/-]*v[\s-]*part|uvpart)\b.*\b(wig|install|installation)\b|\b(wig|install|installation)\b.*\b(u[\s-]*part|v[\s-]*part|u[\s/-]*v[\s-]*part|uvpart)\b/.test(normalized);
}

function hasClosureSewInEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\bclosure\b.*\b(sew\s*in|sewin|weave)\b|\b(sew\s*in|sewin|weave)\b.*\bclosure\b|\bweave\b.*\b(lace\s+)?closure\b|\bclosure\b.*\bbehind\s+the\s+hairline\b/.test(normalized);
}

function hasPixieInstallEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\bpixie\b/.test(normalized) && /\b(wig|weave|sew\s*in|sewin|install|installation)\b/.test(normalized);
}

function hasWigInstallEvidence(value: string | string[]) {
  const normalized = normalizeEvidenceText(Array.isArray(value) ? value.join(" ") : value);
  return /\bwig\b.*\b(install|installation|instal|application|fit|fitting)\b|\b(glueless|lace|frontal|closure)\s+wig\b|\b(lace\s+)?frontal\s+installation\b|\b(lace\s+)?closure\s+installation\b|\b(frontal|closure|ready[\s-]*made)\s+unit\b|\bunit\b.*\b(install|installation|instal|application|fit|fitting)\b/.test(normalized);
}

function hasCustomWigEvidence(value: string | string[]) {
  const normalized = normalizeEvidenceText(Array.isArray(value) ? value.join(" ") : value);
  return /\bcustom\b.*\bwig\b|\bbespoke\b.*\bwig\b|\bcustom\s+handmade\s+wigs?\b|\bwig\b.*\b(custom|bespoke|handmade|made|making|construction|unit)\b|\bunit\b.*\bcustomi[sz](ing|ation)\b|\bcustomi[sz](ing|ation)\b.*\bunit\b|\bcustomi[sz]ed\s+closure\s+unit\b|\bcustom\s+mini\s+frontal\s+unit\b|\bcustom(?:\s+made)?\b.*\b(frontal|closure)\s+unit\b|\bcustom\b.*\bfrontal\s+closure\s+units?\b|\bwig\s+(making|construction|customi[sz](ing|ation))\b|\bconstruction\s+of\s+(the\s+)?wig\b|\bconstruction\b.*\bcustomi[sz](ing|ation)\b|\bcustomi[sz](ing|ation)\b.*\bconstruction\b|\b(frontal|closure)\b.*\bcustomi[sz](ing|ation)\b/.test(normalized) && !/\b(factory\s+made|pre\s*made|premade|ready\s*made|raw\s+pre\s*made)\b/.test(normalized);
}

function hasHalfBraidsHalfSewInEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\bhalf\b.*\b(feed\s*in|feed-in|braids?|cornrows?)\b.*\b(weave|sew[\s-]*in|sewin)\b/.test(normalized) || /\bhalf\b.*\b(weave|sew[\s-]*in|sewin)\b.*\b(feed\s*in|feed-in|braids?|cornrows?)\b/.test(normalized);
}

function hasFrontalPonytailEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\bfrontal\b.*\b(pony|ponytail|bun|updo|up\s*do)\b/.test(normalized) || /\b(pony|ponytail|bun|updo|up\s*do)\b.*\bfrontal\b/.test(normalized);
}

function hasNaturalHairEducationEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\b(afro|natural|curly|curl|hair)\b.*\beducation\b|\beducation\b.*\b(afro|natural|curly|curl|hair)\b|\b(hair|curl|styling)\b.*\btutorial\b|\btutorial\b.*\b(hair|curl|styling)\b|\btrichology\b|\bhair\s+health\b.*\b(assessment|plan|growth|consultation)\b|\bgrowth\s+plan\b|\bconsultation\b.*\bnatural\b|\bnatural\s+hair\b.*\b(class|education|consultation)\b|\bcurl\s+makeover\b.*\b(hands?\s*on|tutorial|styling)\b/.test(normalized);
}

function hasBraidedPonytailEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\b(braided?|braids?|feed\s*in|feed-in|cornrows?)\b.*\b(pony|ponytail)\b/.test(normalized) || /\b(pony|ponytail)\b.*\b(braided?|braids?|feed\s*in|feed-in|cornrows?)\b/.test(normalized);
}

function hasTwistsWithExtensionsEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\btwists?\b.*\b(extension|extensions|hair added)\b|\b(extension|extensions|hair added)\b.*\btwists?\b|\b(passion|marley|senegalese|island|kinky|rope)\s+twists?\b/.test(normalized);
}

function hasTracksEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  if (/\btracks?\b.*\btapes?\b.*\bhybrid\b|\bhybrid\b.*\btracks?\b.*\btapes?\b/.test(normalized)) {
    return false;
  }
  return /\btracks?\b|\bindividual\s+sewn\s+on\s+tracks?\b|\bpartial\b.*\b(sew\s*in|sewin|weave)\b|\binvisible\b.*\b(sew\s*in|sewin|weave|wefts?)\b|\b(row|rows|line)\s+(?:of\s+)?(sew\s*in|sewin|weave)\b|\b(sew\s*in|sewin|weave)\s+(row|rows|line)\b|\bweave\s+on\s+per\s+row\b|\bweave\s+tracks?\s*\(?per\s+track\)?\b|\bper\s+(track|row|line)\b|\btrack\s+per\s+row\b|\btracks?\s+per\s+(track|row|line|double\s+row)\b|\btraditional\s+weave\s+rows?\b|\bone\s+row\b/.test(normalized);
}

function hasKeratinTipEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\bkeratin\s+(tips?|bonds?|extensions?)\b/.test(normalized);
}

function hasWashBlowdryEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  if (/\b(arrive|come|please|note|recommended)\b.*\b(freshly\s+washed|clean|product\s+free|product-free)\b/.test(normalized) && !/\bblow\s*dry|blowdry|blowout\b/.test(normalized)) {
    return false;
  }
  return /\bwash\b.*\b(blow\s*dry|blowdry|blowout)\b|\bshampoo\b.*\b(blow\s*dry|blowdry|blowout)\b|\bblow\s*out\b|\bblowout\b/.test(normalized);
}

function hasWigCornrowsEvidence(value: string, lines: string[] = [value], index = 0) {
  const normalized = normalizeEvidenceText(value);
  const nearby = normalizeEvidenceText([lines[index - 1], value, lines[index + 1]].filter(Boolean).join(" "));
  if (hasStyleRemovalInstructionEvidence(nearby)) {
    return false;
  }
  return /\bunder\s*wig\b|\bwig\s+cornrows?\b|\bcornrows?\s+for\s+wig\s+installation\b|\bcornrows?\b/.test(normalized);
}

function hasStyleRemovalInstructionEvidence(value: string) {
  return /\b(please\s+)?ensure\b.*\b(hair|styles?)\b.*\b(free|removed?|without|not\s+in)\b.*\b(braids?|cornrows?|sew[\s-]*ins?|weaves?)\b/.test(value) || /\b(hair|styles?)\b.*\b(free|removed?|without|not\s+in)\b.*\b(braids?|cornrows?|sew[\s-]*ins?|weaves?)\b/.test(value);
}

function hasStitchBraidsEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\bstitch\b/.test(normalized);
}

function hasSpecificLocSubtypeEvidence(value: string, service: string) {
  const normalized = normalizeEvidenceText(value);
  if (service === "Butterfly locs") {
    return /\bbutterfly\s+locs?\b/.test(normalized);
  }
  if (service === "Faux locs") {
    return /\bfaux\s+locs?\b|\binvisible\s+locs?\b|\bsoft\s+locs?\b/.test(normalized);
  }
  return false;
}

function hasStarterLocsEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\bstarter\s+locs?\b|\bstart\s+locs?\b|\bloc\s+start\b/.test(normalized);
}

function hasWigColourEvidence(rawServices: string[]) {
  const normalizedRaw = normalizeEvidenceText(rawServices.join(" "));
  const hasColourSignal = /\b(colou?r|colou?ring|dye|custom colour|custom color|highlight|tone|toning|tint|bleach|bright)\b/.test(normalizedRaw);
  const hasWigColourContext = /\b(wig|extensions?|bundle|bundles|lace\s+system|closure|frontal|wefts?|613|non[\s-]*contact)\b/.test(normalizedRaw);

  return hasColourSignal && hasWigColourContext;
}

function isManualCheckLink(linkCheck: DirectoryCheck["linkChecks"][number]) {
  return linkCheck.status !== "ok" && !isActionableBrokenLink(linkCheck);
}

function getLinkDismissUpdate(check: DirectoryCheck): FreshnessUpdate | undefined {
  const linkTypes = new Set(check.linkChecks.filter((linkCheck) => linkCheck.status !== "ok").map((linkCheck) => linkCheck.type));
  const update: FreshnessUpdate = {};

  if (linkTypes.has("booking") && check.bookingUrl !== undefined) {
    update.bookingUrl = check.bookingUrl;
  }
  if (linkTypes.has("website") && check.websiteUrl !== undefined) {
    update.websiteUrl = check.websiteUrl;
  }
  if (linkTypes.has("instagram") && check.instagramUrl !== undefined) {
    update.instagramUrl = check.instagramUrl;
  }

  return Object.keys(update).length ? update : undefined;
}

function getManualCheckDescription(linkCheck: DirectoryCheck["linkChecks"][number]) {
  if (linkCheck.httpStatus === 401 || linkCheck.httpStatus === 403 || linkCheck.httpStatus === 429) {
    return `Could not verify automatically: HTTP ${linkCheck.httpStatus}`;
  }
  if (linkCheck.httpStatus) {
    return `Could not verify automatically: HTTP ${linkCheck.httpStatus}`;
  }
  return "Could not verify automatically";
}

function getFreshnessGroupRecommendation(check: DirectoryCheck, brokenLinkCount: number, manualLinkCount: number, addedServices = check.addedServices, removedServices = check.removedServices) {
  const hasAddedServices = addedServices.length > 0;
  const hasRemovedServices = removedServices.length > 0;
  const hasServiceRecommendations = hasAddedServices || hasRemovedServices;

  if (brokenLinkCount && hasServiceRecommendations) {
    return "Review listing";
  }
  if (brokenLinkCount) {
    return brokenLinkCount === 1 ? "Fix broken link" : "Fix broken links";
  }
  if (manualLinkCount) {
    return manualLinkCount === 1 ? "Manual check" : "Manual checks";
  }
  if (hasAddedServices && hasRemovedServices) {
    return "Update services";
  }
  if (hasAddedServices) {
    return addedServices.length === 1 ? "Add service" : "Add services";
  }
  if (hasRemovedServices) {
    return removedServices.length === 1 ? "Remove service" : "Remove services";
  }
  return check.issues.some((issue) => issue.toLowerCase().includes("price")) ? "Review price" : "Review service";
}

function getServiceEvidence(rawServices: string[] = [], service: string) {
  const keywords = serviceEvidenceKeywords[service] ?? service.toLowerCase().split(/\s+|\/|\(|\)|-/).filter((word) => word.length > 3);
  const normalizedKeywords = keywords.map(normalizeEvidenceText);
  const exactMatches = rawServices.filter((line) => {
    const normalizedLine = normalizeEvidenceText(line);
    return normalizedKeywords.some((keyword) => keyword && normalizedLine.includes(keyword));
  });

  if (exactMatches.length) {
    return exactMatches.slice(0, 4);
  }

  return rawServices.filter((line) => isColourService(service) && /colou?r|highlight|balayage|tone|tint|bleach|root/i.test(line)).slice(0, 4);
}

function getRemovalReviewEvidence(rawServices: string[] = [], service: string) {
  const exactEvidence = getServiceEvidence(rawServices, service).filter((line) => !hasStyleRemovalInstructionEvidence(normalizeEvidenceText(line)));
  if (exactEvidence.length) {
    return exactEvidence;
  }

  const family = getServiceGroupLabel(service);
  const siblingKeywords = family
    ? serviceGroups
        .find((group) => group.label === family)
        ?.services.flatMap((relatedService) => serviceEvidenceKeywords[relatedService] ?? [])
    : [];
  const serviceWords = service
    .toLowerCase()
    .split(/\s+|\/|\(|\)|-|\+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 4 && !genericRemovalEvidenceWords.has(word));
  const keywords = [...new Set([...(removalReviewKeywords[service] ?? []), ...(siblingKeywords ?? []), ...serviceWords].map(normalizeEvidenceText).filter(Boolean))];

  return rawServices
    .map((line) => {
      const normalizedLine = normalizeEvidenceText(line);
      const score = keywords.reduce((total, keyword) => total + (normalizedLine.includes(keyword) ? getRemovalEvidenceKeywordWeight(keyword) : 0), 0);
      return { line, score };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((match) => match.line)
    .filter((line, index, lines) => lines.indexOf(line) === index)
    .slice(0, 5);
}

function getRemovalEvidenceKeywordWeight(keyword: string) {
  return keyword.length > 10 ? 2 : 1;
}

function getServiceGroupLabel(service: string) {
  return serviceGroups.find((group) => group.services.includes(service))?.label ?? "";
}

const serviceEvidenceKeywords: Record<string, string[]> = {
  "Balayage": ["balayage"],
  "Highlights": ["highlight", "highlights", "lowlights"],
  "Full head colour": ["colour", "color", "tint", "dye", "rooting"],
  "Wig colour": ["wig colour", "wig color", "colouring full wig", "custom colour", "colour service", "613", "non-contact", "non contact"],
  "Frontal sew-in": ["frontal sew in", "frontal sew-in", "frontal sewin", "frontal weave"],
  "Closure sew-in": ["closure sew in", "closure sew-in", "closure sewin", "closure weave", "weave with lace closure", "closure behind the hairline"],
  "Creative braids (e.g. patewo)": ["creative braids", "patewo", "dolly braids", "shuku", "koroba braids"],
  "Feed-in braids": ["feed in", "feed-in", "all back", "braids going back"],
  "Fulani / Lemonade braids": ["fulani", "lemonade", "alicia keys braids"],
  "K-tips / Invisible strands": ["k tips", "k-tips", "keratin tip", "keratin tips", "keratin bonds", "invisible strands"],
  "Frontal ponytail / bun": ["frontal ponytail", "frontal pony", "frontal bun", "frontal updo"],
  "U-Part wig install": ["u part", "upart", "u-part", "u part wig", "u-part wig", "upart wig", "v part", "vpart", "v-part", "u/vpart", "uvpart"],
  "Custom wig": ["custom wig", "bespoke wig", "custom lace", "custom unit", "customised closure unit", "customized closure unit", "custom mini frontal unit", "unit customisation", "unit customization", "construction of wig", "construction of the wig", "wig making", "wig construction", "wig customising", "wig customisation", "wig customization", "construction and customisation", "construction and customization"],
  "Wig install (frontal / closure)": ["wig install", "wig installation", "installation of the wig", "wig application", "wig fitting", "glueless wig", "lace wig", "frontal wig", "closure wig", "lace frontal installation", "lace closure installation", "frontal unit", "closure unit", "ready-made unit", "ready made unit", "unit install", "frontal unit install", "closure unit install"],
  "Pixie wig / weave install": ["pixie wig", "pixie weave", "pixie install", "pixie sew in", "pixie sew-in", "pixie sewin"],
  "Twists (with extensions)": ["twists with extensions", "passion twists", "marley twists", "senegalese twists", "kinky twists", "rope twists", "island twists", "island twist"],
  "Hybrid sew-in": ["hybrid sew in", "hybrid sew-in", "hybrid weave", "tracks + tapes hybrid", "tracks and tapes hybrid"],
  "Tracks (+ Silk press) / Partial / Invisible sew-in": ["tracks", "track per row", "per track", "per row", "one row", "individual sewn on track", "individual sewn on tracks", "tracks add on", "tracks add-on", "silk press add on tracks", "silk press add-on tracks", "row sew in", "rows of sew in", "weave tracks", "weave tracks per track", "weave on per row", "traditional weave rows", "partial sew in", "partial sewin", "invisible sew in", "invisible weave", "invisible weft", "invisible wefts"],
  "Wash & blowdry": ["wash blowdry", "wash blow dry", "wash and blowdry", "wash and blow dry", "shampoo blowdry", "shampoo blow dry", "shampoo and blowdry", "shampoo and blow dry", "blowout"],
  "Updo": ["updo", "up do", "pin up", "french roll up", "french roll"],
  "Wig cornrows": ["under wig", "wig cornrows", "cornrows for wig installation", "cornrows"],
  "Butterfly locs": ["butterfly locs"],
  "Faux locs": ["faux locs", "invisible locs", "soft locs"],
  "Starter locs": ["starter locs", "start locs", "loc start"],
  "Stitch braids": ["stitch braids", "stitch"],
};

const removalReviewKeywords: Record<string, string[]> = {
  "Custom wig": ["unit customisation", "unit customization", "wig customisation", "wig customization", "wig customising", "construction of wig", "construction of the wig", "wig making", "wig construction", "bespoke wig", "custom unit"],
  "Wig install (frontal / closure)": ["wig installation", "installation of the wig", "lace frontal installation", "lace closure installation", "frontal unit", "closure unit", "ready-made unit", "ready made unit", "unit install"],
  "Tracks (+ Silk press) / Partial / Invisible sew-in": ["tracks add on", "tracks add-on", "silk press add on tracks", "silk press add-on tracks", "partial sew", "row sew", "one row", "individual sewn on track", "weave tracks", "weave tracks per track", "per track"],
  "Natural hair education": ["hair education", "natural hair education", "hair health", "growth plan", "trichology", "tutorial"],
};

const genericRemovalEvidenceWords = new Set(["service", "services", "install", "installation", "treatment", "braids", "style", "styling", "with", "hair"]);

function isColourService(service: string) {
  return service === "Balayage" || service === "Highlights" || service === "Full head colour" || service === "Wig colour";
}

function normalizeEvidenceText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function isActionableFreshnessIssue(issue: string, check: DirectoryCheck) {
  const normalizedIssue = issue.toLowerCase();
  if (normalizedIssue === "possible new services found" || normalizedIssue === "possible removed services found") {
    return false;
  }
  if (normalizedIssue.includes("booking link") && check.bookingUrl) {
    return false;
  }
  return true;
}

function FreshnessIssuePill({ tone, children }: { tone: FreshnessRecommendationGroup["typeTone"]; children: React.ReactNode }) {
  const colorClass =
    tone === "critical"
      ? "bg-red-100 text-red-700"
      : tone === "info"
        ? "bg-emerald-100 text-emerald-700"
        : tone === "warning"
          ? "bg-sky-100 text-sky-700"
          : "bg-stone-100 text-stone-700";

  return <span className={cn("inline-flex rounded-none px-2.5 py-1 text-xs font-medium", colorClass)}>{children}</span>;
}

function FreshnessStatusPill({ status }: { status: FreshnessRecommendationGroup["status"] }) {
  const colorClass = status === "Resolved" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700";

  return <span className={cn("inline-flex rounded-none px-2.5 py-1 text-xs font-medium", colorClass)}>{status}</span>;
}

function FreshnessRecommendationDetails({ row }: { row: FreshnessRecommendationGroup }) {
  if (row.details.length <= 1) {
    return <span>{row.details[0]?.description}</span>;
  }

  return (
    <div className="space-y-1.5">
      {row.details.map((detail, index) => (
        <div key={`${detail.label}-${index}`} className="flex items-start gap-2">
          <span className="mt-2 size-1.5 shrink-0 rounded-none bg-stone-300" />
          <span>{detail.description}</span>
        </div>
      ))}
    </div>
  );
}

function FreshnessLinkButtons({ row }: { row: FreshnessRecommendationGroup }) {
  const websiteUrl = row.websiteUrl || row.bookingUrl;
  const brokenTypes = new Set(row.check.linkChecks.filter((lc) => lc.status !== "ok").map((lc) => lc.type));
  const instagramBroken = brokenTypes.has("instagram");
  const bookingBroken = brokenTypes.has("booking") || brokenTypes.has("website");

  return (
    <span className="inline-flex items-center gap-1">
      {row.instagramUrl ? (
        <a
          href={row.instagramUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${row.stylist} Instagram${instagramBroken ? " (broken)" : ""}`}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-none transition hover:bg-stone-100",
            instagramBroken ? "text-red-500 hover:text-red-700" : "text-stone-500 hover:text-stone-950",
          )}
        >
          <InstagramIcon className="size-4" />
        </a>
      ) : null}
      {websiteUrl ? (
        <a
          href={websiteUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${row.stylist} website${bookingBroken ? " (broken)" : ""}`}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-none transition hover:bg-stone-100",
            bookingBroken ? "text-red-500 hover:text-red-700" : "text-stone-500 hover:text-stone-950",
          )}
        >
          <Globe className="size-4" />
        </a>
      ) : null}
    </span>
  );
}

function IconActionDivider() {
  return <span aria-hidden="true" className="mx-1 h-6 w-px bg-stone-200" />;
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "just now";
  }

  const elapsedSeconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (elapsedSeconds < 60) {
    return "just now";
  }
  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min ago`;
  }
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }
  return `${Math.round(elapsedHours / 24)}d ago`;
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function DiscoveryPage({
  suggestions,
  isGenerating,
  isBusy,
  onGenerate,
  onCreateDraft,
}: {
  suggestions: DiscoverySuggestion[];
  isGenerating: boolean;
  isBusy: boolean;
  onGenerate: () => void;
  onCreateDraft: (suggestionId: string) => void;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-9">
      <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Discovery</h1>
          <p className="mt-2 text-sm text-stone-500">Generate research leads from directory patterns, then turn promising leads into drafts.</p>
        </div>
        <Button type="button" variant="outline" onClick={onGenerate} disabled={isGenerating} className="h-10 rounded-none bg-white px-4">
          {isGenerating ? <Loader2 className="size-4 animate-spin" /> : null}
          Generate
        </Button>
      </section>

      <DiscoveryPanel suggestions={suggestions} isBusy={isBusy} onCreateDraft={onCreateDraft} />
    </div>
  );
}

function DiscoveryPanel({
  suggestions,
  isBusy,
  onCreateDraft,
}: {
  suggestions: DiscoverySuggestion[];
  isBusy: boolean;
  onCreateDraft: (suggestionId: string) => void;
}) {
  return (
    <div className="rounded-none border border-stone-200 bg-white p-4">
      {suggestions.length ? (
        <div className="max-h-[34rem] space-y-2 overflow-auto">
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="space-y-3 rounded-none bg-stone-100 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{suggestion.name}</p>
                  <p className="mt-1 text-xs text-stone-500">{suggestion.areaLabel || "Location pattern"}</p>
                </div>
                <FreshnessBadge status="service" label={suggestion.confidence} />
              </div>
              <p className="text-sm text-stone-600">{suggestion.reason}</p>
              <div className="flex flex-wrap gap-1">
                {suggestion.services.map((service) => (
                  <Badge key={service} variant="outline" className="bg-white">
                    {service}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={suggestion.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-stone-600 underline underline-offset-2 hover:text-stone-950">
                  Open search
                </a>
                <button
                  type="button"
                  onClick={() => onCreateDraft(suggestion.id)}
                  disabled={isBusy || suggestion.status === "draft_created"}
                  className="text-xs font-medium text-stone-900 underline underline-offset-2 disabled:text-stone-400"
                >
                  {suggestion.status === "draft_created" ? "Draft created" : "Create draft"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-none border border-dashed border-stone-300 p-4 text-sm text-stone-500">No discovery leads yet.</p>
      )}
    </div>
  );
}

function FreshnessResultCard({
  check,
  isBusy,
  onApply,
}: {
  check: DirectoryCheck;
  isBusy: boolean;
  onApply: (check: DirectoryCheck, update: FreshnessUpdate) => void;
}) {
  const [bookingUrl, setBookingUrl] = useState(check.bookingUrl || "");
  const [instagramUrl, setInstagramUrl] = useState(check.instagramUrl || "");
  const hasBrokenLinks = check.linkChecks.some((linkCheck) => linkCheck.status !== "ok");

  return (
    <div className="space-y-3 rounded-none bg-stone-100 p-3">
      <p className="text-sm font-medium">{check.name}</p>
      <p className="mt-1 text-xs text-stone-500">{check.areaLabel || "Location unknown"}</p>
      <div className="flex flex-wrap gap-1">
        {check.linkChecks.map((linkCheck) => (
          <FreshnessBadge key={`${check.id}-${linkCheck.type}`} status={linkCheck.status} label={`${linkCheck.type}: ${linkCheck.status}`} />
        ))}
        {check.serviceCheck?.confidence && check.serviceCheck.confidence !== "unknown" ? (
          <FreshnessBadge status="service" label={`services: ${check.serviceCheck.confidence}`} />
        ) : null}
      </div>

      {check.addedServices.length ? (
        <div className="space-y-2">
          <ServiceSuggestionList
            label="Possible added"
            services={check.addedServices}
            tone="add"
            acceptLabel="Add"
            rejectLabel="Reject"
            isBusy={isBusy}
            onAccept={(service) => onApply(check, { addServices: [service] })}
            onReject={(service) => onApply(check, { rejectAddedServices: [service] })}
          />
        </div>
      ) : null}

      {check.removedServices.length ? (
        <div className="space-y-2">
          <ServiceSuggestionList
            label="Possible removed"
            services={check.removedServices}
            tone="remove"
            acceptLabel="Remove"
            rejectLabel="Keep"
            isBusy={isBusy}
            onAccept={(service) => onApply(check, { removeServices: [service] })}
            onReject={(service) => onApply(check, { rejectRemovedServices: [service] })}
          />
        </div>
      ) : null}

      {check.issues.length ? (
        <div className="flex flex-wrap gap-1">
          {check.issues.map((issue) => (
            <Badge key={issue} variant="outline" className="bg-white">
              {issue}
            </Badge>
          ))}
        </div>
      ) : null}

      {hasBrokenLinks ? (
        <div className="space-y-2 rounded-none border border-stone-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Update links</p>
          <Input value={bookingUrl} onChange={(event) => setBookingUrl(event.target.value)} placeholder="Booking URL" className="h-10 rounded-none" />
          <Input value={instagramUrl} onChange={(event) => setInstagramUrl(event.target.value)} placeholder="Instagram URL" className="h-10 rounded-none" />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onApply(check, { bookingUrl, instagramUrl })}
            disabled={isBusy}
            className="w-full rounded-none"
          >
            Save updated links
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[check.bookingUrl, check.instagramUrl].filter(Boolean).map((link) => (
          <a
            key={link}
            href={link}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-stone-600 underline underline-offset-2 hover:text-stone-950"
          >
            Open source
          </a>
        ))}
      </div>
    </div>
  );
}

function DraftEditor({
  draft,
  regions,
  services,
  isBusy,
  onChange,
  onChangeLocations,
  onSave,
  onApprove,
  onDelete,
  canDelete = true,
  activeStep = "details",
  isEmbedded = false,
}: {
  draft: StylistDraft;
  regions: RegionOption[];
  services: string[];
  isBusy: boolean;
  onChange: (update: Partial<StylistDraft>) => void;
  onChangeLocations: (areaIds: string[]) => void;
  onSave: () => void;
  onApprove: () => void;
  onDelete: () => void;
  canDelete?: boolean;
  activeStep?: DraftEditorStep;
  isEmbedded?: boolean;
}) {
  const bookingMatchesInstagram = urlsMatch(draft.bookingUrl, draft.instagramUrl);
  const visibleWarnings = getVisibleDraftWarnings(draft);
  const selectedAreaIds = getDraftAreaIds(draft);
  const selectedLocationLabels = selectedAreaIds
    .map((areaId) => regions.find((region) => region.id === areaId)?.label || areaLabelFromId(areaId))
    .filter(Boolean);

  function updateInstagramUrl(instagramUrl: string) {
    onChange({
      instagramUrl,
      ...(bookingMatchesInstagram ? { bookingUrl: instagramUrl } : {}),
    });
  }

  function toggleBookingSameAsInstagram(checked: boolean) {
    onChange({
      bookingUrl: checked ? draft.instagramUrl : bookingMatchesInstagram ? "" : draft.bookingUrl,
      ...(checked ? { bookingPlatform: "Instagram" } : {}),
    });
  }

  const warningsContent = visibleWarnings.length ? (
    <div className="rounded-none border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{visibleWarnings.join(" ")}</div>
  ) : null;

  const detailsContent = (
    <section className="space-y-6">
      <Field label="Name">
        <Input value={draft.name} onChange={(event) => onChange({ name: event.target.value })} placeholder="Stylist name" className="h-11 rounded-none" />
      </Field>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Links</p>
        <DraftLinkField
          label="Instagram"
          icon={<InstagramIcon className="size-4" />}
          value={draft.instagramUrl}
          onChange={updateInstagramUrl}
          placeholder="@handle or URL"
          href={draft.instagramUrl}
        />
        <DraftLinkField
          label="Booking URL"
          icon={<Link2 className="size-4" />}
          value={draft.bookingUrl}
          onChange={(bookingUrl) => onChange({ bookingUrl })}
          placeholder="https://..."
          href={draft.bookingUrl}
        >
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              checked={bookingMatchesInstagram}
              disabled={!draft.instagramUrl}
              onChange={(event) => toggleBookingSameAsInstagram(event.target.checked)}
              className="size-4 rounded-none border-stone-300 accent-stone-950 disabled:opacity-40"
            />
            Same as Instagram
          </label>
        </DraftLinkField>
      </div>

      <DraftLocationSelector draft={draft} regions={regions} onChange={onChangeLocations} />

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Preferences</p>
        <div className="grid gap-2">
          <DraftBooleanOption
            label="Hijabi friendly"
            checked={draft.hijabiFriendly === true}
            onToggle={(checked) => onChange({ hijabiFriendly: checked })}
          />
          <DraftBooleanOption
            label="Can braid without gel"
            checked={draft.canBraidWithoutGel === true}
            onToggle={(checked) => onChange({ canBraidWithoutGel: checked })}
          />
        </div>
      </div>
    </section>
  );

  const servicesContent = (
    <section className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-stone-950">Services</h3>
        <p className="mt-1 text-sm text-stone-500">Raw booking copy and matched services.</p>
      </div>
      <Field label="Raw services">
        <Textarea value={(draft.rawServices || []).join("\n")} onChange={(value) => onChange({ rawServices: splitLines(value) })} />
      </Field>
      <ServicePicker services={services} selected={draft.services} onChange={(next) => onChange({ services: next })} />
    </section>
  );

  const reviewContent = (
    <section className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-stone-950">Review</h3>
        <p className="mt-1 text-sm text-stone-500">Check the final details before publishing.</p>
      </div>
      <div className="divide-y divide-stone-100 rounded-none border border-stone-200 bg-white">
        <DraftReviewRow label="Name" value={draft.name || "Untitled stylist"} />
        <DraftReviewRow label="Instagram" value={draft.instagramUrl || "Not added"} />
        <DraftReviewRow label="Booking URL" value={draft.bookingUrl || "Not added"} />
        <DraftReviewRow label="Locations" value={selectedLocationLabels.length ? selectedLocationLabels.join(", ") : draft.areaLabel || "No location selected"} />
        <DraftReviewRow
          label="Preferences"
          value={[
            draft.hijabiFriendly ? "Hijabi friendly" : "",
            draft.canBraidWithoutGel ? "Can braid without gel" : "",
          ].filter(Boolean).join(", ") || "None selected"}
        />
        <DraftReviewRow label="Services">
          <div className="space-y-3">
            <p className="text-sm font-medium text-stone-900">{draft.services.length} selected</p>
            {draft.services.length ? (
              <div className="flex flex-wrap gap-2">
                {draft.services.map((service) => (
                  <span key={service} className="rounded-none border border-stone-200 bg-stone-50 px-2.5 py-1 text-sm font-medium text-stone-700">
                    {service}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </DraftReviewRow>
      </div>
    </section>
  );

  const stepContent = activeStep === "details" ? detailsContent : activeStep === "services" ? servicesContent : reviewContent;
  const content = (
    <div className="space-y-7">
      {warningsContent}
      {stepContent}
    </div>
  );

  if (isEmbedded) {
    return (
      <div>{content}</div>
    );
  }

  return (
    <Card className="rounded-none">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Edit draft</CardTitle>
              <StatusBadge status={draft.status} />
            </div>
            <CardDescription>Clean up the research result before it joins the public directory.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onSave} disabled={isBusy} className="rounded-none">
              <Save className="size-4" />
              Save
            </Button>
	            {canDelete ? (
	              <>
	                <Button type="button" onClick={onApprove} disabled={isBusy} className="rounded-none">
	                  <Check className="size-4" />
	                  Approve
	                </Button>
                <Button type="button" variant="ghost" onClick={onDelete} disabled={isBusy} className="rounded-none text-red-700">
	                  <Trash2 className="size-4" />
                    <span className="sr-only">Delete draft</span>
	                </Button>
	              </>
	            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

function DraftReviewRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[128px_1fr] sm:gap-4">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</span>
      {children ?? <span className="min-w-0 break-words text-sm font-medium text-stone-900">{value}</span>}
    </div>
  );
}

function DraftLinkField({
  label,
  icon,
  value,
  onChange,
  placeholder,
  href,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  href?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-none border border-stone-200 bg-stone-50 px-4 py-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
        <span className="text-stone-500">{icon}</span>
        {label}
      </div>
      <div className="flex items-center gap-3">
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 rounded-none bg-white" />
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-none text-stone-500 transition hover:bg-stone-100 hover:text-stone-950"
            aria-label={`Open ${label}`}
          >
            <ExternalLink className="size-4" />
          </a>
        ) : (
          <span className="size-9 shrink-0" />
        )}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function DraftLocationSelector({
  draft,
  regions,
  onChange,
}: {
  draft: StylistDraft;
  regions: RegionOption[];
  onChange: (areaIds: string[]) => void;
}) {
  const selectedAreaIds = getDraftAreaIds(draft);
  const london = regions.find((region) => region.id === "all-london");
  const londonAreaIds = new Set(["central", "north", "north-west", "east", "south-east", "south-west", "west", "croydon"]);
  const londonRows = regions.filter((region) => londonAreaIds.has(region.id));
  const standaloneRows = regions.filter((region) => region.id !== "all-london" && !londonAreaIds.has(region.id));

  function toggle(areaId: string) {
    onChange(selectedAreaIds.includes(areaId) ? selectedAreaIds.filter((id) => id !== areaId) : [...selectedAreaIds, areaId]);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Locations</p>
      {london ? (
        <DraftLocationOption region={london} checked={selectedAreaIds.includes(london.id)} onToggle={() => toggle(london.id)} />
      ) : null}
      <div className="grid gap-2 pl-6 sm:grid-cols-2">
        {londonRows.map((region) => (
          <DraftLocationOption key={region.id} region={region} checked={selectedAreaIds.includes(region.id)} onToggle={() => toggle(region.id)} />
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {standaloneRows.map((region) => (
          <DraftLocationOption key={region.id} region={region} checked={selectedAreaIds.includes(region.id)} onToggle={() => toggle(region.id)} />
        ))}
      </div>
    </div>
  );
}

function DraftLocationOption({ region, checked, onToggle }: { region: RegionOption; checked: boolean; onToggle: () => void }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-none border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-900 transition hover:border-stone-300",
        checked ? "border-stone-400 bg-stone-50" : "",
      )}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="size-4 rounded-none border-stone-300 accent-stone-950" />
      {region.label}
    </label>
  );
}

function DraftBooleanOption({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: (checked: boolean) => void }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-none border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-900 transition hover:border-stone-300",
        checked ? "border-stone-400 bg-stone-50" : "",
      )}
    >
      <input type="checkbox" checked={checked} onChange={(event) => onToggle(event.target.checked)} className="size-4 rounded-none border-stone-300 accent-stone-950" />
      {label}
    </label>
  );
}

function MultiLocationPicker({
  draft,
  regions,
  onChange,
}: {
  draft: StylistDraft;
  regions: RegionOption[];
  onChange: (areaIds: string[]) => void;
}) {
  const selectedAreaIds = getDraftAreaIds(draft);

  function toggle(areaId: string) {
    onChange(selectedAreaIds.includes(areaId) ? selectedAreaIds.filter((id) => id !== areaId) : [...selectedAreaIds, areaId]);
  }

  return (
    <Field label="Locations">
      <div className="rounded-none border border-stone-200 bg-white p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {regions.map((region) => (
            <label
              key={region.id}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-none px-3 py-2 text-sm transition",
                selectedAreaIds.includes(region.id) ? "bg-stone-950 text-white" : "bg-stone-50 text-stone-700 hover:bg-stone-100",
              )}
            >
              <input
                type="checkbox"
                checked={selectedAreaIds.includes(region.id)}
                onChange={() => toggle(region.id)}
                className="size-3.5 accent-stone-950"
              />
              {region.label}
            </label>
          ))}
        </div>
      </div>
    </Field>
  );
}

function getDraftAreaIds(draft: StylistDraft) {
  return draft.areaIds?.length ? draft.areaIds : draft.areaId ? [draft.areaId] : [];
}

function areaLabelFromId(areaId: string) {
  return areaId.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function ServicePicker({
  services,
  selected,
  onChange,
}: {
  services: string[];
  selected: string[];
  onChange: (services: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const serviceSet = useMemo(() => new Set(services), [services]);
  const groupedServices = serviceGroups
    .map((group) => ({
      ...group,
      services: group.services.filter(
        (service) => serviceSet.has(service) && (!normalizedQuery || service.toLowerCase().includes(normalizedQuery)),
      ),
    }))
    .filter((group) => group.services.length > 0);

  function toggle(service: string) {
    onChange(selected.includes(service) ? selected.filter((item) => item !== service) : [...selected, service]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <Field label="Matched services" className="flex-1">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search filters" />
        </Field>
        <Badge variant="secondary">{selected.length} selected</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {selected.map((service) => (
          <button
            key={service}
            type="button"
            onClick={() => toggle(service)}
            aria-label={`Remove ${service}`}
            className="rounded-none bg-stone-950 px-3 py-1 text-xs text-white"
          >
            {service}
          </button>
        ))}
      </div>
      <div className="max-h-80 overflow-auto rounded-none border border-stone-200 bg-white p-3">
        {groupedServices.length ? (
          <div className="space-y-4">
            {groupedServices.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{group.label}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.services.map((service) => (
                    <button
                      key={`${group.label}-${service}`}
                      type="button"
                      onClick={() => toggle(service)}
                      aria-label={`${selected.includes(service) ? "Remove" : "Add"} ${service}`}
                      className={cn(
                        "rounded-none px-3 py-2 text-left text-xs transition",
                        selected.includes(service) ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200",
                      )}
                    >
                      {service}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-3 text-sm text-stone-500">No matching services.</p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");
  const colorClass =
    status === "ready_to_approve"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "needs_review"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : status === "approved"
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : "border-stone-200 bg-stone-100 text-stone-700";

  return (
    <span className={cn("inline-flex items-center rounded-none border px-2.5 py-1 text-xs font-medium capitalize", colorClass)}>
      {label}
    </span>
  );
}

function FreshnessBadge({ status, label }: { status: string; label: string }) {
  const colorClass =
    status === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "service"
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : status === "possibly_blocked" || status === "unknown"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-red-200 bg-red-50 text-red-800";

  return <span className={cn("rounded-none border px-2 py-0.5 text-xs font-medium capitalize", colorClass)}>{label.replace(/_/g, " ")}</span>;
}

function ServiceSuggestionList({
  label,
  services,
  tone,
  acceptLabel,
  rejectLabel,
  isBusy,
  onAccept,
  onReject,
}: {
  label: string;
  services: string[];
  tone: "add" | "remove";
  acceptLabel: string;
  rejectLabel: string;
  isBusy: boolean;
  onAccept: (service: string) => void;
  onReject: (service: string) => void;
}) {
  return (
    <div>
      <p className={cn("text-xs font-semibold uppercase tracking-[0.12em]", tone === "add" ? "text-emerald-700" : "text-red-700")}>{label}</p>
      <div className="mt-2 space-y-2">
        {services.map((service) => (
          <div key={service} className="flex flex-col gap-2 rounded-none border border-stone-200 bg-white p-2 sm:flex-row sm:items-center sm:justify-between">
            <span className={cn("text-sm", tone === "add" ? "text-emerald-800" : "text-red-800")}>
              {tone === "add" ? "+ " : "- "}
              {service}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onAccept(service)}
                disabled={isBusy}
                className="rounded-none bg-stone-950 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {acceptLabel}
              </button>
              <button
                type="button"
                onClick={() => onReject(service)}
                disabled={isBusy}
                className="rounded-none border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 disabled:opacity-50"
              >
                {rejectLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FreshnessSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[0, 1, 2].map((item) => (
        <div key={item} className="space-y-4 rounded-none border border-stone-100 bg-white p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="h-4 w-2/5 animate-pulse rounded-none bg-stone-200" />
            <div className="flex gap-2">
              <div className="size-8 animate-pulse rounded-none bg-stone-100" />
              <div className="size-8 animate-pulse rounded-none bg-stone-100" />
              <div className="size-8 animate-pulse rounded-none bg-stone-100" />
            </div>
          </div>
          <div className="h-3 w-1/4 animate-pulse rounded-none bg-stone-100" />
          <div className="rounded-none border border-stone-100 bg-stone-50 p-4">
            <div className="h-4 w-1/3 animate-pulse rounded-none bg-stone-200" />
            <div className="mt-3 h-3 w-4/5 animate-pulse rounded-none bg-stone-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FreshnessMetricSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="rounded-none border border-stone-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="h-3 w-28 animate-pulse rounded-none bg-stone-200" />
            <div className="size-4 animate-pulse rounded-none bg-stone-100" />
          </div>
          <div className="mt-5 h-10 w-16 animate-pulse rounded-none bg-stone-200" />
        </div>
      ))}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-2", className)}>
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</span>
      {children}
    </label>
  );
}

function Textarea({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="min-h-28 w-full rounded-none border border-stone-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-stone-400 focus:border-stone-400"
    />
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-12 w-full rounded-none border border-stone-200 bg-white px-4 text-sm outline-none focus:border-stone-400"
    >
      {children}
    </select>
  );
}

function splitLines(value: string) {
  return value
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function mergeServices(current: string[], matched: string[]) {
  return [...new Set([...current, ...matched])];
}

function removeReviewedServices(current: string[], reviewed: string[]) {
  return current.filter((service) => !reviewed.includes(service));
}

function removeReviewedLinkChecks(check: DirectoryCheck, update: FreshnessUpdate) {
  const reviewedLinkTypes = new Set<string>();
  if (update.bookingUrl !== undefined) {
    reviewedLinkTypes.add("booking");
  }
  if (update.websiteUrl !== undefined) {
    reviewedLinkTypes.add("website");
  }
  if (update.instagramUrl !== undefined) {
    reviewedLinkTypes.add("instagram");
  }
  const reviewedIssues = new Set(
    check.linkChecks
      .filter((linkCheck) => reviewedLinkTypes.has(linkCheck.type))
      .flatMap((linkCheck) => linkCheck.issues),
  );

  return {
    linkChecks: check.linkChecks.filter((linkCheck) => !reviewedLinkTypes.has(linkCheck.type)),
    issues: check.issues.filter((issue) => !reviewedIssues.has(issue)),
  };
}

function cloneDirectoryCheck(check: DirectoryCheck) {
  return JSON.parse(JSON.stringify(check)) as DirectoryCheck;
}

function getFreshnessUndoLabel(update: FreshnessUpdate) {
  if (update.addServices?.length) {
    return `added ${formatServiceList(update.addServices)}`;
  }
  if (update.removeServices?.length) {
    return `removed ${formatServiceList(update.removeServices)}`;
  }
  if (update.rejectAddedServices?.length || update.rejectRemovedServices?.length) {
    return "rejected recommendation";
  }
  return "health check update";
}

function formatServiceList(services: string[]) {
  if (services.length === 1) return services[0];
  return `${services.length} services`;
}
