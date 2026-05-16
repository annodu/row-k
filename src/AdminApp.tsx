import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Loader2, LogOut, Plus, Save, Trash2 } from "lucide-react";

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
};

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
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [form, setForm] = useState<DraftForm>(emptyForm);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
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

  const selectedDraft = useMemo(
    () => drafts.find((draft) => draft.id === selectedDraftId) ?? drafts[0] ?? null,
    [drafts, selectedDraftId],
  );

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (isAuthed) {
      loadAdminData();
    }
  }, [isAuthed]);

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

      updateDraft(selectedDraft.id, {
        services: mergeServices(selectedDraft.services, matchedServices),
      });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [selectedDraft?.id, selectedDraftRawServices, isAuthed]);

  async function checkSession() {
    setIsCheckingSession(true);
    try {
      const response = await fetch("/api/admin/session", { credentials: "include" });
      setIsAuthed(response.ok);
    } finally {
      setIsCheckingSession(false);
    }
  }

  async function loadAdminData() {
    setIsBusy(true);
    try {
      const [draftResponse, optionResponse, dashboardResponse, discoveryResponse] = await Promise.all([
        fetch("/api/admin/stylists/drafts", { credentials: "include" }),
        fetch("/api/admin/stylists/options", { credentials: "include" }),
        fetch("/api/admin/dashboard", { credentials: "include" }),
        fetch("/api/admin/discovery", { credentials: "include" }),
      ]);
      if (!draftResponse.ok || !optionResponse.ok) {
        setIsAuthed(false);
        return;
      }
      const draftPayload = await draftResponse.json();
      const optionPayload = await optionResponse.json();
      const dashboardPayload = dashboardResponse.ok ? await dashboardResponse.json() : null;
      const discoveryPayload = discoveryResponse.ok ? await discoveryResponse.json() : null;
      setDrafts(draftPayload.drafts ?? []);
      setRegions(optionPayload.regions ?? []);
      setServices(optionPayload.services ?? []);
      setDashboard(dashboardPayload ?? null);
      setSuggestions(discoveryPayload?.suggestions ?? []);
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
      if (!response.ok) {
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
        setMessage(payload.message || "Could not create draft.");
        return;
      }
      setForm(emptyForm);
      setDrafts((current) => [payload.draft, ...current]);
      setSelectedDraftId(payload.draft.id);
      setMessage("Draft created.");
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
        setMessage(payload.message || "Could not create drafts.");
        return;
      }
      const createdDrafts = payload.drafts ?? [];
      setIntakeText("");
      setDrafts((current) => [...createdDrafts, ...current]);
      setSelectedDraftId(createdDrafts[0]?.id ?? null);
      setActiveView("drafts");
      setMessage(`Created ${createdDrafts.length} draft${createdDrafts.length === 1 ? "" : "s"}.`);
      await loadAdminData();
    } finally {
      setIsBusy(false);
    }
  }

  async function saveDraft(draft: StylistDraft) {
    setMessage("");
    setIsBusy(true);
    try {
      const response = await fetch(`/api/admin/stylists/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.message || "Could not save draft.");
        return;
      }
      setDrafts((current) => current.map((item) => (item.id === draft.id ? payload.draft : item)));
      setMessage("Draft saved.");
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
        setMessage(payload.message || "Could not approve draft.");
        return;
      }
      setDrafts((current) => current.filter((item) => item.id !== draft.id));
      setSelectedDraftId(null);
      setMessage(`${payload.salon.name} was added to the directory.`);
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
        setMessage(payload.message || "Could not delete draft.");
        return;
      }
      setDrafts((current) => current.filter((draft) => draft.id !== draftId));
      setSelectedDraftId(null);
      setMessage("Draft deleted.");
    } finally {
      setIsBusy(false);
    }
  }

  async function runChecks(offset = 0) {
    setMessage("");
    setActiveCheckBatch({ from: offset + 1, to: offset + 50 });
    setIsRunningChecks(true);
    try {
      const response = await fetch(`/api/admin/stylists/checks?offset=${offset}&limit=50`, { credentials: "include" });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.message || "Could not run checks.");
        return;
      }
      setChecks((current) => (offset === 0 ? (payload.checks ?? []) : [...current, ...(payload.checks ?? [])]));
      setChecksLoadedAt(payload.checkedAt || new Date().toISOString());
      setCheckProgress({
        checkedCount: payload.checkedCount ?? 0,
        total: payload.total ?? 0,
        nextOffset: payload.nextOffset ?? null,
      });
      setMessage(`Checked ${payload.checkedCount ?? 0} of ${payload.total ?? 0}. Found ${(payload.checks ?? []).length} updates in this batch.`);
      await loadAdminData();
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
      setMessage("Draft created from suggestion.");
      await loadAdminData();
    } finally {
      setIsBusy(false);
    }
  }

  async function applyFreshnessUpdate(
    check: DirectoryCheck,
    update: {
      addServices?: string[];
      removeServices?: string[];
      bookingUrl?: string;
      instagramUrl?: string;
      websiteUrl?: string;
      rejectAddedServices?: string[];
      rejectRemovedServices?: string[];
    },
  ) {
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
              }
            : item,
        ),
      );
      setMessage("Directory listing updated.");
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

  function updateDraft(draftId: string, update: Partial<StylistDraft>) {
    setDrafts((current) => current.map((draft) => (draft.id === draftId ? { ...draft, ...update } : draft)));
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
              <p className="text-sm uppercase tracking-[0.2em] text-stone-400">ROW K admin</p>
              <h1 className="mt-3 text-3xl font-semibold">Stylist intake</h1>
            </div>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Admin password"
              className="rounded-md border-stone-700 bg-stone-900 text-stone-50 placeholder:text-stone-500"
            />
            {loginError ? <p className="text-sm text-red-300">{loginError}</p> : null}
            <Button type="submit" disabled={isBusy} className="w-full rounded-md">
              {isBusy ? <Loader2 className="size-4 animate-spin" /> : null}
              Unlock admin
            </Button>
            <p className="text-xs leading-5 text-stone-500">Local default password is rowk-admin unless ADMIN_PASSWORD is set.</p>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 text-stone-950">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">ROW K admin</p>
            <h1 className="text-2xl font-semibold">Operations dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            {message ? <p className="text-sm text-stone-600">{message}</p> : null}
            <Button type="button" variant="outline" onClick={logout} className="rounded-md">
              <LogOut className="size-4" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pt-5">
        <div className="flex flex-wrap gap-2">
          {(["overview", "drafts", "freshness", "discovery"] as const).map((view) => (
            <Button
              key={view}
              type="button"
              variant={activeView === view ? "default" : "outline"}
              onClick={() => setActiveView(view)}
              className="rounded-md capitalize"
            >
              {view}
            </Button>
          ))}
        </div>
      </div>

      {activeView === "overview" ? (
        <DashboardOverview
          dashboard={dashboard}
          intakeText={intakeText}
          isBusy={isBusy}
          onIntakeChange={setIntakeText}
          onSubmit={createBulkDrafts}
          onOpenView={setActiveView}
        />
      ) : null}

      <div className={cn("mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.15fr)]", activeView === "overview" && "hidden")}>
        <section className="space-y-5">
          {activeView === "drafts" ? (
          <Card className="rounded-md">
            <CardHeader>
              <CardTitle>New draft</CardTitle>
              <CardDescription>Paste social, booking, or website links, then add any services you already know.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createDraft} className="space-y-4">
                <Field label="Links">
                  <Textarea
                    value={form.links}
                    onChange={(value) => setForm((current) => ({ ...current, links: value }))}
                    placeholder="https://www.instagram.com/..."
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name">
                    <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                  </Field>
                  <Field label="Location">
                    <Select value={form.areaId} onChange={(value) => setForm((current) => ({ ...current, areaId: value }))}>
                      <option value="">Choose</option>
                      {regions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="Raw services">
                  <Textarea
                    value={form.rawServices}
                    onChange={(value) => setForm((current) => ({ ...current, rawServices: value }))}
                    placeholder="Silk press&#10;Tape ins&#10;Leave out weave"
                  />
                </Field>
                <ServicePicker
                  services={services}
                  selected={form.services}
                  onChange={(next) => setForm((current) => ({ ...current, services: next }))}
                />
                <Button type="submit" disabled={isBusy} className="w-full rounded-md">
                  <Plus className="size-4" />
                  Create draft
                </Button>
              </form>
            </CardContent>
          </Card>
          ) : null}

          {activeView === "drafts" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-500">Drafts</h2>
              <Badge variant="secondary">{drafts.length}</Badge>
            </div>
            {drafts.length === 0 ? (
              <p className="rounded-md border border-dashed border-stone-300 bg-white p-4 text-sm text-stone-500">No drafts waiting.</p>
            ) : (
              drafts.map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => setSelectedDraftId(draft.id)}
                  className={cn(
                    "block w-full rounded-md border bg-white p-4 text-left transition hover:border-stone-500",
                    selectedDraft?.id === draft.id ? "border-stone-950" : "border-stone-200",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{draft.name}</p>
                      <p className="mt-1 text-sm text-stone-500">{draft.areaLabel || "Location needed"}</p>
                    </div>
                    <StatusBadge status={draft.status} />
                  </div>
                </button>
              ))
            )}
          </div>
          ) : null}

          {activeView === "freshness" ? (
          <div className="rounded-md border border-stone-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-500">Freshness checks</h2>
                <p className="mt-2 text-sm text-stone-500">Check live links and compare booking-page services with the directory.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => runChecks(0)} disabled={isRunningChecks} className="rounded-md">
                {isRunningChecks ? <Loader2 className="size-4 animate-spin" /> : null}
                {isRunningChecks ? "Checking" : "Run"}
              </Button>
            </div>
            {checksLoadedAt ? (
              <p className="mt-3 text-xs text-stone-400">
                Last checked {new Date(checksLoadedAt).toLocaleString()}
                {checkProgress.total ? ` · ${checkProgress.checkedCount} of ${checkProgress.total} checked` : ""}
              </p>
            ) : null}
            {isRunningChecks ? (
              <>
                <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  Checking listings {activeCheckBatch.from}-{activeCheckBatch.to}. This can take 10-30 seconds while live links respond.
                </div>
                <FreshnessSkeleton />
              </>
            ) : checks.length ? (
              <>
                <div className="mt-4 max-h-72 space-y-2 overflow-auto">
                  {checks.map((check) => (
                    <FreshnessResultCard key={check.id} check={check} isBusy={isBusy} onApply={applyFreshnessUpdate} />
                  ))}
                </div>
                {checkProgress.nextOffset !== null ? (
                  <Button type="button" variant="outline" onClick={() => runChecks(checkProgress.nextOffset ?? 0)} disabled={isRunningChecks} className="mt-3 w-full rounded-md">
                    Check next 50
                  </Button>
                ) : null}
              </>
            ) : checksLoadedAt ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-stone-500">No broken links or service changes found in this batch.</p>
                {checkProgress.nextOffset !== null ? (
                  <Button type="button" variant="outline" onClick={() => runChecks(checkProgress.nextOffset ?? 0)} disabled={isRunningChecks} className="w-full rounded-md">
                    Check next 50
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          ) : null}

          {activeView === "discovery" ? (
            <DiscoveryPanel
              suggestions={suggestions}
              isGenerating={isGeneratingSuggestions}
              isBusy={isBusy}
              onGenerate={generateDiscoverySuggestions}
              onCreateDraft={createDraftFromSuggestion}
            />
          ) : null}
        </section>

        <section>
          {activeView === "drafts" && selectedDraft ? (
            <DraftEditor
              draft={selectedDraft}
              regions={regions}
              services={services}
              isBusy={isBusy}
              onChange={(update) => updateDraft(selectedDraft.id, update)}
              onSave={() => saveDraft(selectedDraft)}
              onApprove={() => approveDraft(selectedDraft)}
              onDelete={() => deleteDraft(selectedDraft.id)}
            />
          ) : activeView === "drafts" ? (
            <div className="flex min-h-96 items-center justify-center rounded-md border border-dashed border-stone-300 bg-white text-sm text-stone-500">
              Select or create a draft.
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-500">
              Use the panel on the left to review this section.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function DashboardOverview({
  dashboard,
  intakeText,
  isBusy,
  onIntakeChange,
  onSubmit,
  onOpenView,
}: {
  dashboard: DashboardMetrics | null;
  intakeText: string;
  isBusy: boolean;
  onIntakeChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onOpenView: (view: "overview" | "drafts" | "freshness" | "discovery") => void;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-5 py-6">
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>Add stylists</CardTitle>
          <CardDescription>Paste Instagram, TikTok, booking links, websites, or messy notes. One or many links can become drafts.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <Textarea
              value={intakeText}
              onChange={onIntakeChange}
              placeholder={"https://www.instagram.com/example/\nServices: silk press, leave out weave\n\nhttps://example.as.me/schedule/demo"}
            />
            <Button type="submit" disabled={isBusy || !intakeText.trim()} className="w-full rounded-md">
              {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create draft{intakeText.split("http").length > 2 ? "s" : ""}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardCard
          title="Drafts"
          value={dashboard?.drafts.total ?? 0}
          detail={`${dashboard?.drafts.needsReview ?? 0} needs review · ${dashboard?.drafts.readyToApprove ?? 0} ready`}
          onClick={() => onOpenView("drafts")}
        />
        <DashboardCard
          title="Freshness"
          value={dashboard?.freshness.totalIssues ?? 0}
          detail={`${dashboard?.freshness.brokenLinks ?? 0} link issues · ${dashboard?.freshness.serviceChanges ?? 0} service changes`}
          onClick={() => onOpenView("freshness")}
        />
        <DashboardCard
          title="Discovery"
          value={dashboard?.discovery.total ?? 0}
          detail={`${dashboard?.discovery.highConfidence ?? 0} high confidence · ${dashboard?.discovery.needsReview ?? 0} to review`}
          onClick={() => onOpenView("discovery")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>Draft focus</CardTitle>
            <CardDescription>
              {dashboard?.drafts.missingLocation ?? 0} missing location · {dashboard?.drafts.missingServices ?? 0} missing services
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>Freshness coverage</CardTitle>
            <CardDescription>
              {dashboard?.freshness.checkedCount ?? 0} of {dashboard?.freshness.total ?? 0} checked
              {dashboard?.freshness.updatedAt ? ` · last run ${new Date(dashboard.freshness.updatedAt).toLocaleDateString()}` : ""}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

function DashboardCard({ title, value, detail, onClick }: { title: string; value: number; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md border border-stone-200 bg-white p-5 text-left shadow-sm transition hover:border-stone-500">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{title}</p>
      <p className="mt-3 text-4xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-stone-500">{detail}</p>
    </button>
  );
}

function DiscoveryPanel({
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
    <div className="rounded-md border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-500">Discovery</h2>
          <p className="mt-2 text-sm text-stone-500">Generate research leads from patterns in the existing directory, then turn promising leads into drafts.</p>
        </div>
        <Button type="button" variant="outline" onClick={onGenerate} disabled={isGenerating} className="rounded-md">
          {isGenerating ? <Loader2 className="size-4 animate-spin" /> : null}
          Generate
        </Button>
      </div>
      {suggestions.length ? (
        <div className="mt-4 max-h-[34rem] space-y-2 overflow-auto">
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="space-y-3 rounded-md bg-stone-100 p-3">
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
        <p className="mt-4 rounded-md border border-dashed border-stone-300 p-4 text-sm text-stone-500">No discovery leads yet.</p>
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
  onApply: (
    check: DirectoryCheck,
    update: {
      addServices?: string[];
      removeServices?: string[];
      bookingUrl?: string;
      instagramUrl?: string;
      websiteUrl?: string;
      rejectAddedServices?: string[];
      rejectRemovedServices?: string[];
    },
  ) => void;
}) {
  const [bookingUrl, setBookingUrl] = useState(check.bookingUrl || "");
  const [instagramUrl, setInstagramUrl] = useState(check.instagramUrl || "");
  const [websiteUrl, setWebsiteUrl] = useState(check.websiteUrl || "");
  const hasBrokenLinks = check.linkChecks.some((linkCheck) => linkCheck.status !== "ok");

  return (
    <div className="space-y-3 rounded-md bg-stone-100 p-3">
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
        <div className="space-y-2 rounded-md border border-stone-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Update links</p>
          <Input value={bookingUrl} onChange={(event) => setBookingUrl(event.target.value)} placeholder="Booking URL" className="h-10 rounded-md" />
          <Input value={instagramUrl} onChange={(event) => setInstagramUrl(event.target.value)} placeholder="Instagram URL" className="h-10 rounded-md" />
          <Input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="Website URL" className="h-10 rounded-md" />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onApply(check, { bookingUrl, instagramUrl, websiteUrl })}
            disabled={isBusy}
            className="w-full rounded-md"
          >
            Save updated links
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[check.bookingUrl, check.instagramUrl, check.websiteUrl].filter(Boolean).map((link) => (
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
  onSave,
  onApprove,
  onDelete,
}: {
  draft: StylistDraft;
  regions: RegionOption[];
  services: string[];
  isBusy: boolean;
  onChange: (update: Partial<StylistDraft>) => void;
  onSave: () => void;
  onApprove: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="rounded-md">
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
            <Button type="button" variant="outline" onClick={onSave} disabled={isBusy} className="rounded-md">
              <Save className="size-4" />
              Save
            </Button>
            <Button type="button" onClick={onApprove} disabled={isBusy} className="rounded-md">
              <Check className="size-4" />
              Approve
            </Button>
            <Button type="button" variant="ghost" onClick={onDelete} disabled={isBusy} className="rounded-md text-red-700">
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {draft.warnings?.length ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {draft.warnings.join(" ")}
          </div>
        ) : null}

        <div className="grid gap-4">
          <Field label="Name">
            <Input value={draft.name} onChange={(event) => onChange({ name: event.target.value })} />
          </Field>
        </div>

        <div className="grid gap-4">
          <Field label="Location">
            <Select
              value={draft.areaId}
              onChange={(value) =>
                onChange({
                  areaId: value,
                  areaLabel: regions.find((region) => region.id === value)?.label || "",
                })
              }
            >
              <option value="">Choose</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instagram">
            <Input value={draft.instagramUrl} onChange={(event) => onChange({ instagramUrl: event.target.value })} />
          </Field>
          <Field label="Booking URL">
            <Input value={draft.bookingUrl} onChange={(event) => onChange({ bookingUrl: event.target.value })} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          {[draft.instagramUrl, draft.bookingUrl, draft.websiteUrl].filter(Boolean).map((link) => (
            <a
              key={link}
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 hover:border-stone-900"
            >
              <ExternalLink className="size-3" />
              Open source
            </a>
          ))}
        </div>

        <Field label="Raw services">
          <Textarea value={(draft.rawServices || []).join("\n")} onChange={(value) => onChange({ rawServices: splitLines(value) })} />
        </Field>

        <ServicePicker services={services} selected={draft.services} onChange={(next) => onChange({ services: next })} />

      </CardContent>
    </Card>
  );
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
            className="rounded-full bg-stone-950 px-3 py-1 text-xs text-white"
          >
            {service}
          </button>
        ))}
      </div>
      <div className="max-h-80 overflow-auto rounded-md border border-stone-200 bg-white p-3">
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
                      className={cn(
                        "rounded-md px-3 py-2 text-left text-xs transition",
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
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize", colorClass)}>
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

  return <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium capitalize", colorClass)}>{label.replace(/_/g, " ")}</span>;
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
          <div key={service} className="flex flex-col gap-2 rounded-md border border-stone-200 bg-white p-2 sm:flex-row sm:items-center sm:justify-between">
            <span className={cn("text-sm", tone === "add" ? "text-emerald-800" : "text-red-800")}>
              {tone === "add" ? "+ " : "- "}
              {service}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onAccept(service)}
                disabled={isBusy}
                className="rounded-md bg-stone-950 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {acceptLabel}
              </button>
              <button
                type="button"
                onClick={() => onReject(service)}
                disabled={isBusy}
                className="rounded-md border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 disabled:opacity-50"
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
    <div className="mt-4 space-y-2">
      {[0, 1, 2].map((item) => (
        <div key={item} className="space-y-3 rounded-md bg-stone-100 p-3">
          <div className="h-4 w-2/5 animate-pulse rounded bg-stone-200" />
          <div className="h-3 w-1/4 animate-pulse rounded bg-stone-200" />
          <div className="flex gap-2">
            <div className="h-6 w-24 animate-pulse rounded-full bg-stone-200" />
            <div className="h-6 w-28 animate-pulse rounded-full bg-stone-200" />
          </div>
          <div className="h-3 w-4/5 animate-pulse rounded bg-stone-200" />
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
      className="min-h-28 w-full rounded-md border border-stone-200 bg-white px-4 py-3 text-sm shadow-sm outline-none placeholder:text-stone-400 focus:border-stone-400 focus:ring-4 focus:ring-stone-100"
    />
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-12 w-full rounded-md border border-stone-200 bg-white px-4 text-sm shadow-sm outline-none focus:border-stone-400 focus:ring-4 focus:ring-stone-100"
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
