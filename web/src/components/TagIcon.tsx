import type { SpotTag } from "../api";
import { AskIcon, CameraIcon, DogIcon, FenceIcon, FootpathIcon, PublicIcon } from "./icons";

const TAG_ICONS: Record<SpotTag, (props: { size?: number; className?: string }) => React.JSX.Element> = {
  dog: DogIcon,
  fence: FenceIcon,
  cameras: CameraIcon,
  ask: AskIcon,
  footpath: FootpathIcon,
  public: PublicIcon,
};

/** The small icon for a heads-up tag (decorative; pair it with the label). */
export default function TagIcon({ tag, size = 18 }: { tag: SpotTag; size?: number }) {
  const Icon = TAG_ICONS[tag];
  return <Icon size={size} />;
}
