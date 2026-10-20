import { DANGER_DEFAULT, DESCRIPTION_MAX, NAME_MAX, SPOT_TAGS, suggestDanger, type Spot, type SpotTag } from "../api";
import { formatCoords } from "../lib/format";
import type { PhotoFormState } from "../lib/usePhotoUploads";
import DangerPicker from "./DangerPicker";
import PhotoPicker from "./PhotoPicker";
import TagPicker from "./TagPicker";

/** `id` set means editing that spot; otherwise adding a new one. */
export type FormState = PhotoFormState & {
  id?: string;
  lat: number;
  lng: number;
  name: string;
  description: string;
  danger: number;
  tags: SpotTag[];
  /** True until the user picks a danger rating themselves: tags may suggest one meanwhile. */
  dangerAuto: boolean;
};

/** Initial tag state for the add (no spot) or edit form. */
export function initialTags(spot?: Spot): Pick<FormState, "tags" | "dangerAuto"> {
  if (!spot) return { tags: [], dangerAuto: true };
  // Keep following the tags only if the saved rating is what they'd suggest
  // (i.e. the owner never overrode it); otherwise respect their pick.
  return { tags: spot.tags, dangerAuto: spot.tags.length > 0 && suggestDanger(spot.tags) === spot.danger };
}

/** Toggles a tag; while the danger is still automatic, follows the tags' suggestion. */
function toggleTag(form: FormState, tag: SpotTag): FormState {
  const has = form.tags.includes(tag);
  const tags = SPOT_TAGS.filter((t) => (t === tag ? !has : form.tags.includes(t)));
  const danger = form.dangerAuto ? (suggestDanger(tags) ?? DANGER_DEFAULT) : form.danger;
  return { ...form, tags, danger };
}

const FORM_ID = "spot-form";

export function SpotFormHeader({ form }: { form: FormState }) {
  return (
    <div className="sheet-title">
      <h2>{form.id ? "Edit herb spot" : "Add a herb spot"}</h2>
      <p className="sheet-sub">
        <span className="coords">{formatCoords(form.lat, form.lng)}</span>
      </p>
    </div>
  );
}

type FieldsProps = {
  form: FormState;
  onChange: (form: FormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  autoFocus: boolean;
  submitting: boolean;
  onAddPhotos: (files: File[]) => void;
  onRemovePhoto: (key: string) => void;
  onRetryPhoto: (key: string) => void;
};

export function SpotFormFields({
  form,
  onChange,
  onSubmit,
  autoFocus,
  submitting,
  onAddPhotos,
  onRemovePhoto,
  onRetryPhoto,
}: FieldsProps) {
  return (
    <form id={FORM_ID} className="spot-form" onSubmit={onSubmit}>
      <label className="field">
        <span className="field-label">Name</span>
        <input
          autoFocus={autoFocus}
          required
          maxLength={NAME_MAX}
          id="spot-name"
          name="spot-name"
          autoComplete="off"
          data-1p-ignore
          enterKeyHint="next"
          placeholder="e.g. Rosemary by the gate"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field-label">
          Description <span className="optional">optional</span>
        </span>
        <textarea
          maxLength={DESCRIPTION_MAX}
          rows={3}
          placeholder="Which herb? Public or ask first? Best time to visit…"
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
        />
      </label>
      <TagPicker value={form.tags} onToggle={(tag) => onChange(toggleTag(form, tag))} />
      <DangerPicker
        value={form.danger}
        onChange={(danger) => onChange({ ...form, danger, dangerAuto: false })}
        hint={form.dangerAuto && form.tags.length > 0 ? "Suggested from heads-up tags" : undefined}
      />
      <PhotoPicker
        photos={form.photos}
        error={form.photoError}
        busy={submitting}
        onAdd={onAddPhotos}
        onRemove={onRemovePhoto}
        onRetry={form.id ? onRetryPhoto : undefined}
      />
    </form>
  );
}

export function SpotFormFooter({
  form,
  submitting,
  onCancel,
}: {
  form: FormState;
  submitting: boolean;
  onCancel: () => void;
}) {
  const editing = form.id !== undefined;
  const processing = form.photos.some((p) => p.kind === "new" && p.status === "processing");
  const uploading = form.photos.some((p) => p.kind === "new" && p.status === "uploading");
  const label = uploading
    ? "Uploading photos…"
    : submitting
      ? editing
        ? "Saving…"
        : "Adding…"
      : processing
        ? "Preparing photos…"
        : editing
          ? "Save changes"
          : "Add spot";
  return (
    <div className="form-actions">
      <button type="button" className="btn btn-outline" onClick={onCancel} disabled={submitting}>
        Cancel
      </button>
      <button type="submit" form={FORM_ID} className="btn btn-primary" disabled={submitting || processing}>
        {label}
      </button>
    </div>
  );
}
