import { SPOT_TAG_LABELS, SPOT_TAGS, type SpotTag } from "../api";
import TagIcon from "./TagIcon";

type Props = {
  value: SpotTag[];
  onToggle: (tag: SpotTag) => void;
};

/** Optional multi-select "heads-up" chips (toggle buttons). */
export default function TagPicker({ value, onToggle }: Props) {
  return (
    <fieldset className="tag-picker">
      <legend>
        Heads-up <span className="optional">optional</span>
      </legend>
      <div className="tag-options">
        {SPOT_TAGS.map((tag) => {
          const on = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              className={`tag-toggle${on ? " on" : ""}`}
              aria-pressed={on}
              onClick={() => onToggle(tag)}
            >
              <TagIcon tag={tag} />
              {SPOT_TAG_LABELS[tag]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Read-only tag chips for the spot sheet. */
export function TagList({ tags }: { tags: SpotTag[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="tag-list" aria-label="Heads-up">
      {tags.map((tag) => (
        <li key={tag} className="tag-chip">
          <TagIcon tag={tag} size={16} />
          {SPOT_TAG_LABELS[tag]}
        </li>
      ))}
    </ul>
  );
}
