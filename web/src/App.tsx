import { useCallback, useEffect, useRef, useState } from "react";
import type maplibregl from "maplibre-gl";
import { ApiError, createSpot, deleteSpot, fetchSpots, updateSpot, DANGER_DEFAULT, type Spot } from "./api";
import { authClient } from "./auth";
import AuthDialog from "./components/AuthDialog";
import AccountButton from "./components/AccountButton";
import BottomSheet from "./components/BottomSheet";
import { AddFab, CompassButton, LocateButton } from "./components/MapControls";
import PlacementOverlay from "./components/PlacementOverlay";
import SearchBar from "./components/SearchBar";
import Snackbar, { type SnackbarMessage } from "./components/Snackbar";
import { SpotBody, SpotHeader } from "./components/SpotDetails";
import { SpotFormFields, SpotFormFooter, SpotFormHeader, type FormState } from "./components/SpotForm";
import { spotUrl } from "./lib/format";
import { prefersReducedMotion, useColorScheme, useIsDesktop } from "./lib/hooks";
import { initialPhotos, releasePhotos, usePhotoUploads } from "./lib/usePhotoUploads";
import { useMap } from "./map/useMap";
import { useMapGestures, useMapOrientation } from "./map/useMapGestures";
import { useDraftMarker, useSpotMarkers } from "./map/useSpotMarkers";
import { useUserLocation } from "./map/useUserLocation";

const round6 = (n: number) => Number(n.toFixed(6));

export default function App() {
  const theme = useColorScheme();
  const isDesktop = useIsDesktop();
  const appRef = useRef<HTMLDivElement>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useMap(mapContainer, theme);

  const [spots, setSpots] = useState<Spot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setFormState] = useState<FormState | null>(null);
  // Closing or replacing the form frees its photo preview blobs.
  const setForm = useCallback((update: FormState | null | ((f: FormState | null) => FormState | null)) => {
    setFormState((prev) => {
      const next = typeof update === "function" ? update(prev) : update;
      if (prev && next === null) releasePhotos(prev);
      return next;
    });
  }, []);
  const [placing, setPlacing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState<SnackbarMessage | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | undefined>(undefined);

  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const sessionState = sessionPending ? "pending" : userId !== null ? "signed-in" : "signed-out";

  const selected = spots.find((s) => s.id === selectedId) ?? null;
  const photoUploads = usePhotoUploads<FormState>(setForm, setSpots);

  const notify = useCallback((text: string, kind: SnackbarMessage["kind"] = "info") => {
    setSnack({ id: Date.now(), text, kind });
  }, []);
  const dismissSnack = useCallback(() => setSnack(null), []);

  const openSignIn = (reason?: string) => {
    setAuthReason(reason);
    setAuthOpen(true);
  };

  /** Shows an API error; a 401 means the session expired, so prompt sign-in instead. */
  const reportError = (e: unknown, fallback: string) => {
    if (e instanceof ApiError && e.status === 401) {
      setSnack(null);
      openSignIn("Your session has expired. Please sign in again.");
      return;
    }
    notify(e instanceof Error ? e.message : fallback, "error");
  };

  /** Signed-in check for adding; prompts sign-in when signed out. */
  const canAdd = () => {
    if (sessionState === "pending") return false;
    if (sessionState === "signed-out") {
      openSignIn("Sign in to add a herb spot.");
      return false;
    }
    return true;
  };

  // ---- data ----

  // Load spots once the session is known, and again whenever the user
  // changes, so `is_mine` reflects who is signed in.
  useEffect(() => {
    if (sessionPending) return;
    let cancelled = false;
    fetchSpots()
      .then((loadedSpots) => {
        if (cancelled) return;
        setSpots(loadedSpots);
        setLoaded(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) notify(e instanceof Error ? e.message : "Failed to load spots", "error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, sessionPending, notify]);

  // Signing out closes any open add/edit form or placement.
  useEffect(() => {
    if (!userId) {
      setForm(null);
      setPlacing(false);
    }
  }, [userId]);

  // ---- map focus (keep the target visible beside/above the sheet) ----

  const sheetHeightRef = useRef(0);
  const onSheetHeight = useCallback((px: number, dragging: boolean) => {
    sheetHeightRef.current = px;
    const app = appRef.current;
    if (!app) return;
    app.classList.toggle("sheet-dragging", dragging);
    app.style.setProperty("--sheet-h", `${Math.round(px)}px`);
    app.classList.toggle("sheet-tall", px > window.innerHeight * 0.5);
  }, []);

  const focusOn = useCallback(
    (lng: number, lat: number, opts: { zoom?: number; fly?: boolean } = {}) => {
      if (!map) return;
      // Wait two frames so a newly opened sheet has measured itself.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          let offset: [number, number] = [0, 0];
          const sheet = document.querySelector<HTMLElement>(".sheet:not(.sheet-closing)");
          if (isDesktop) {
            const right = sheet?.getBoundingClientRect().right ?? 0;
            offset = [right / 2, 0];
          } else {
            const top = document.querySelector(".search-pill")?.getBoundingClientRect().bottom ?? 0;
            offset = [0, (top - sheetHeightRef.current) / 2];
          }
          const animate = !prefersReducedMotion();
          const target = { center: [lng, lat] as [number, number], offset, zoom: opts.zoom ?? map.getZoom() };
          if (opts.fly && animate) map.flyTo({ ...target, duration: 1400 });
          else map.easeTo({ ...target, duration: animate ? 450 : 0 });
        })
      );
    },
    [map, isDesktop]
  );

  // ---- selection ----

  const selectSpot = useCallback(
    (spot: Spot, opts: { fly?: boolean } = {}) => {
      setPlacing(false);
      setForm(null);
      setSelectedId(spot.id);
      const zoom = map ? (opts.fly ? Math.max(map.getZoom(), 16) : Math.max(map.getZoom(), 14)) : undefined;
      focusOn(spot.lng, spot.lat, { zoom, fly: opts.fly });
    },
    [map, focusOn]
  );

  // A `?spot=<id>` deep link, read once before the URL sync below can clear it.
  const deepLinkId = useRef(new URL(window.location.href).searchParams.get("spot"));
  const deepLinkDone = useRef(false);

  // Keep `?spot=<id>` in the URL so the current spot can be shared/bookmarked.
  useEffect(() => {
    if (!deepLinkDone.current) return;
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set("spot", selectedId);
    else url.searchParams.delete("spot");
    if (url.toString() !== window.location.href) window.history.replaceState(null, "", url);
  }, [selectedId]);

  // Open a deep-linked spot once both the map and spots are ready.
  useEffect(() => {
    if (!map || !loaded || deepLinkDone.current) return;
    deepLinkDone.current = true;
    const id = deepLinkId.current;
    const spot = id ? spots.find((s) => s.id === id) : undefined;
    if (spot) {
      map.jumpTo({ center: [spot.lng, spot.lat], zoom: 16 });
      selectSpot(spot);
    } else if (id) {
      const url = new URL(window.location.href);
      url.searchParams.delete("spot");
      window.history.replaceState(null, "", url);
      notify("That herb spot is no longer here.", "error");
    }
  }, [map, loaded, spots, selectSpot, notify]);

  // ---- adding ----

  const openAddForm = (lngLat: { lng: number; lat: number }) => {
    setPlacing(false);
    setSelectedId(null);
    setForm({
      lat: round6(lngLat.lat),
      lng: round6(lngLat.lng),
      name: "",
      description: "",
      danger: DANGER_DEFAULT,
      ...initialPhotos(),
    });
    focusOn(lngLat.lng, lngLat.lat);
  };

  const startPlacement = () => {
    if (!map || !canAdd()) return;
    setSelectedId(null);
    setForm(null);
    setPlacing(true);
    // A leftover info toast ("Link copied") would sit over the placement bar.
    setSnack((s) => (s?.kind === "info" ? null : s));
    if (map.getZoom() < 15) map.easeTo({ zoom: 16, duration: prefersReducedMotion() ? 0 : 500 });
  };

  const confirmPlacement = (lngLat: maplibregl.LngLat) => openAddForm(lngLat);

  // ---- map gestures & markers ----

  useSpotMarkers(map, spots, selectedId, (spot) => {
    if (form || placing) return; // don't lose an unsaved form
    selectSpot(spot);
  });
  useDraftMarker(map, form && form.id === undefined ? form : null);

  useMapGestures(map, {
    onTap: () => {
      (document.activeElement as HTMLElement | null)?.blur?.();
      if (!form && !placing) setSelectedId(null);
    },
    onLongPress: (lngLat) => {
      if (form || placing) return;
      if (!canAdd()) return;
      openAddForm(lngLat);
    },
  });

  const orientation = useMapOrientation(map);
  const location = useUserLocation(map, (msg) => notify(msg, "error"));

  // ---- spot actions ----

  const handleEdit = (spot: Spot) => {
    setForm({
      id: spot.id,
      lat: spot.lat,
      lng: spot.lng,
      name: spot.name,
      description: spot.description,
      danger: spot.danger,
      ...initialPhotos(spot),
    });
  };

  const handleDelete = async (spot: Spot) => {
    if (!window.confirm(`Delete “${spot.name}”? This can't be undone.`)) return;
    setSnack(null);
    try {
      await deleteSpot(spot.id);
      setSpots((prev) => prev.filter((s) => s.id !== spot.id));
      setSelectedId((id) => (id === spot.id ? null : id));
      setForm((f) => (f?.id === spot.id ? null : f));
      notify("Herb spot deleted");
    } catch (e) {
      reportError(e, "Failed to delete spot");
    }
  };

  const handleShare = async (spot: Spot) => {
    const url = spotUrl(spot.id);
    if (navigator.share) {
      try {
        await navigator.share({ title: spot.name, text: `${spot.name} — a herb spot on Sage`, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Otherwise fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      notify("Link copied");
    } catch {
      notify(`Couldn't copy the link: ${url}`, "error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || submitting) return;
    setSubmitting(true);
    setSnack(null);
    const input = {
      name: form.name,
      description: form.description,
      lat: form.lat,
      lng: form.lng,
      danger: form.danger,
    };
    const editing = form.id !== undefined;
    try {
      // 1. The spot itself. It stays saved even if a photo fails below.
      const spot = form.id ? await updateSpot(form.id, input) : await createSpot(input);
      setSpots((prev) => (editing ? prev.map((s) => (s.id === spot.id ? spot : s)) : [spot, ...prev]));
      setSelectedId(spot.id);
      // From here on the form edits the saved spot (so a retry won't create a duplicate).
      setForm((f) => f && { ...f, id: spot.id });

      // 2. Photos: removals, then uploads (progress shows on each tile).
      const failed = await photoUploads.syncPhotos(spot.id, form);
      if (failed > 0) {
        const what = failed === 1 ? "a photo" : `${failed} photos`;
        notify(`Spot saved, but ${what} didn't upload. Tap Retry on the photo, or Cancel to skip it.`, "error");
        return;
      }
      setForm(null);
      focusOn(spot.lng, spot.lat); // re-centre above the (now shorter) details sheet
      notify(editing ? "Changes saved" : "Herb spot added");
    } catch (e) {
      reportError(e, form.id ? "Failed to update spot" : "Failed to add spot");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelForm = () => {
    if (!submitting) setForm(null);
  };

  // Escape: leave placement, cancel the form, or close the sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
      if (placing) setPlacing(false);
      else if (form) cancelForm();
      else if (selectedId) setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- render ----

  const sheetOpen = form !== null || selected !== null;
  const user = session ? { name: session.user.name, email: session.user.email } : null;
  const showHint = loaded && spots.length === 0 && !sheetOpen && !placing;

  let sheet: React.ComponentProps<typeof BottomSheet> | null = null;
  if (form) {
    sheet = {
      open: true,
      contentKey: `form-${form.id ?? "new"}`,
      initialSnap: "expanded",
      label: form.id ? "Edit herb spot" : "Add a herb spot",
      header: <SpotFormHeader form={form} />,
      children: (
        <SpotFormFields
          form={form}
          onChange={setForm}
          onSubmit={handleSubmit}
          autoFocus={isDesktop}
          submitting={submitting}
          onAddPhotos={(files) => photoUploads.addFiles(files, form)}
          onRemovePhoto={photoUploads.removeTile}
          onRetryPhoto={(key) => {
            const tile = form.photos.find((p) => p.key === key);
            if (form.id && tile) void photoUploads.uploadTile(form.id, tile);
          }}
        />
      ),
      footer: <SpotFormFooter form={form} submitting={submitting} onCancel={cancelForm} />,
      onDismiss: cancelForm,
      dismissible: !submitting,
    };
  } else if (selected) {
    sheet = {
      open: true,
      contentKey: `spot-${selected.id}`,
      initialSnap: "peek",
      label: selected.name,
      header: (
        <SpotHeader
          spot={selected}
          userPosition={location.position}
          onShare={handleShare}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ),
      children: <SpotBody spot={selected} />,
      onDismiss: () => setSelectedId(null),
    };
  }

  const appClass = ["app", placing && "placing", sheetOpen && "has-sheet", snack && "has-snack"]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={appRef} className={appClass}>
      <div ref={mapContainer} className="map" />

      {!placing && (
        <SearchBar
          spots={spots}
          onPick={(spot) => selectSpot(spot, { fly: true })}
          getOrigin={() => {
            if (location.position) return location.position;
            const c = map?.getCenter();
            return c ? { lat: c.lat, lng: c.lng } : { lat: -37.81, lng: 144.97 };
          }}
          originIsUser={location.position !== null}
          account={
            <AccountButton
              pending={sessionPending}
              user={user}
              onSignIn={() => openSignIn()}
              onSignOut={() => void authClient.signOut()}
            />
          }
        />
      )}

      {showHint && (
        <div className="hint" role="note">
          {session ? (
            <>
              No herbs here yet. Tap <strong>Add herb</strong> or long-press the map to drop the first one.
            </>
          ) : (
            <>No herbs here yet. Sign in to drop the first one.</>
          )}
        </div>
      )}

      {map && (
        <CompassButton
          bearing={orientation.bearing}
          pitch={orientation.pitch}
          onReset={() => map.resetNorthPitch({ duration: prefersReducedMotion() ? 0 : 400 })}
        />
      )}

      <div className="map-buttons">
        <LocateButton status={location.status} onClick={location.locate} />
        {!placing && <AddFab onClick={startPlacement} />}
      </div>

      {placing && map && (
        <PlacementOverlay map={map} onCancel={() => setPlacing(false)} onConfirm={confirmPlacement} />
      )}

      <BottomSheet
        {...(sheet ?? {
          open: false,
          contentKey: "none",
          initialSnap: "peek",
          label: "",
          header: null,
          onDismiss: () => {},
        })}
        onVisibleHeightChange={onSheetHeight}
      />

      <Snackbar message={snack} onDismiss={dismissSnack} />

      <AuthDialog open={authOpen} reason={authReason} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
