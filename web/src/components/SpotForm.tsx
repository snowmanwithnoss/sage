import { DESCRIPTION_MAX, NAME_MAX } from "../api";
import { formatCoords } from "../lib/format";
import type { PhotoFormState } from "../lib/usePhotoUploads";
import DangerPicker from "./DangerPicker";
import PhotoPicker from "./PhotoPicker";

/** `id` set means editing that spot; otherwise adding a new one. */
export type FormState = PhotoFormState & {
  id?: string;
  lat: number;
  lng: number;
  name: string;
  description: string;
  danger: number;
};

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
      <DangerPicker value={form.danger} onChange={(danger) => onChange({ ...form, danger })} />
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
