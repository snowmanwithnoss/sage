// Small inline icon set (Material Symbols-style paths, 24px grid). Decorative:
// buttons carry their own accessible labels.

type IconProps = { size?: number; className?: string };

function make(path: string) {
  return function Icon({ size = 24, className }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" focusable="false">
        <path d={path} fill="currentColor" />
      </svg>
    );
  };
}

export const SearchIcon = make(
  "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
);
export const CloseIcon = make(
  "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
);
export const MyLocationIcon = make(
  "M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"
);
export const LocationSearchingIcon = make(
  "M20.94 11A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"
);
export const DirectionsIcon = make(
  "M21.71 11.29l-9-9a.996.996 0 0 0-1.41 0l-9 9a.996.996 0 0 0 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 0 0 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z"
);
export const ShareIcon = make(
  "M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"
);
/** Pegman-style person standing on a ground ring (Street View). */
export const StreetViewIcon = make(
  "M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM9.5 7h5c.83 0 1.5.67 1.5 1.5V13h-1.5v4h-5v-4H8V8.5C8 7.67 8.67 7 9.5 7zM6.5 15.3v1.6C4.6 17.4 3.5 18.1 3.5 18.8c0 1.1 3.8 2.2 8.5 2.2s8.5-1.1 8.5-2.2c0-.7-1.1-1.4-3-1.9v-1.6c3 .6 5 1.9 5 3.5 0 2.1-4.7 3.7-10.5 3.7S1.5 20.9 1.5 18.8c0-1.6 2-2.9 5-3.5z"
);
export const EditIcon = make(
  "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
);
export const DeleteIcon = make("M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z");
export const AddIcon = make("M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z");
export const PersonIcon = make(
  "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
);
export const LogoutIcon = make(
  "M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
);
export const PlaceIcon = make(
  "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"
);
export const CalendarIcon = make(
  "M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"
);
export const PanToolIcon = make(
  "M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16.04.01 4.31 2.46 4.31 2.46V4c0-.83.67-1.5 1.5-1.5S11 3.17 11 4v7h1V1.5c0-.83.67-1.5 1.5-1.5S15 .67 15 1.5V11h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z"
);

/** North arrow; the caller rotates it to match the map bearing. */
export function CompassIcon({ size = 24, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <path d="M12 2.5 16 12H8z" fill="#e8453c" />
      <path d="M12 21.5 8 12h8z" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

/** The Sage logo: the guitar-pick sprig from the favicon. */
export function SageLogo({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      <path
        d="M26 56C16 46 4 33 4 19.5 4 8 17 2.5 32 2.5S60 8 60 19.5C60 33 48 46 38 56Q32 62 26 56Z"
        fill="#2f5d34"
        stroke="#2f5d34"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <g transform="translate(32 28) scale(.98) translate(-32 -33)">
        <path d="M32 56V14" stroke="#e8f3e8" strokeWidth="3.5" strokeLinecap="round" />
        <g fill="#a8c69f">
          <path d="M32 14c-6 2-8 8-6 13 5-1 8-6 6-13z" />
          <path d="M32 30c-9-3-15 1-17 7 7 3 13 0 17-7z" />
          <path d="M32 30c9-3 15 1 17 7-7 3-13 0-17-7z" />
        </g>
        <g fill="#cfe3c8">
          <path d="M32 44c-8-2-13 1-15 6 6 2 11 0 15-6z" />
          <path d="M32 44c8-2 13 1 15 6-6 2-11 0-15-6z" />
        </g>
      </g>
    </svg>
  );
}

/** Chilli pepper for danger ratings (coloured; CSS greys out unlit ones). */
export function ChiliIcon({ size = 20, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <path d="M6.2 9.2C4.6 14 7.6 19.8 19.6 21.6 15 18.6 13.4 14.2 12.8 10.2 11 8.4 8 8.2 6.2 9.2Z" fill="#e0421c" />
      <path d="M7.6 10.2c.4-.5 1.6-.7 2.4-.3" stroke="#fff" strokeOpacity=".55" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M5.6 9.6c1.2-1.9 5-2.4 7.6.4-.4-1.4-1.6-2.6-3.6-2.8-1.8-.2-3.4.7-4 2.4Z" fill="#3d8b3d" />
      <path d="M9.4 7.4C9.4 5.2 10.8 3.6 13.4 3.2" stroke="#3d8b3d" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}
export const AddPhotoIcon = make(
  "M3 4V1h2v3h3v2H5v3H3V6H0V4h3zm3 6V7h3V4h7l1.83 2H21c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V10h3zm7 9c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-3.2-5c0 1.77 1.43 3.2 3.2 3.2s3.2-1.43 3.2-3.2-1.43-3.2-3.2-3.2-3.2 1.43-3.2 3.2z"
);
export const ChevronLeftIcon = make("M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z");
export const ChevronRightIcon = make("M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z");
export const RetryIcon = make(
  "M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
);

// ---- heads-up tag icons (same 24px grid, filled) ----

function makeEvenOdd(path: string) {
  return function Icon({ size = 24, className }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" focusable="false">
        <path d={path} fill="currentColor" fillRule="evenodd" />
      </svg>
    );
  };
}

/** Paw print. */
export const DogIcon = make(
  "M2.3 10.5a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 1 0-4.4 0zM6.8 6.5a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 1 0-4.4 0zM12.8 6.5a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 1 0-4.4 0zM17.3 10.5a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 1 0-4.4 0zM12 11.5c-2.5 0-4 2.2-5.5 4.2C5.3 17.2 5.6 20.5 8 20.5c1.5 0 2.5-.6 4-.6s2.5.6 4 .6c2.4 0 2.7-3.3 1.5-4.8-1.5-2-3-4.2-5.5-4.2z"
);
/** Three pickets and two rails. */
export const FenceIcon = make(
  "M4.5 6 6.5 3.5 8.5 6v14h-4zM10 6l2-2.5L14 6v14h-4zM15.5 6l2-2.5 2 2.5v14h-4zM2.5 8.5h19v2h-19zM2.5 14.5h19v2h-19z"
);
export const CameraIcon = make(
  "M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
);
/** Speech bubble with a question mark. */
export const AskIcon = makeEvenOdd(
  "M4 2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2zm7 11v2h2v-2zm1-8a3.4 3.4 0 0 0-3.4 3.2h1.9c0-.8.7-1.4 1.5-1.4s1.5.6 1.5 1.4c0 .5-.2.8-.6 1.1l-.9.8c-.7.6-1 1.2-1 2.2v.2h2c0-.8.2-1.1.7-1.6l.8-.7c.6-.6.9-1.2.9-2A3.4 3.4 0 0 0 12 5z"
);
/** Walking person. */
export const FootpathIcon = make(
  "M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"
);
/** A tree (park). */
export const PublicIcon = make("M17 12h2L12 2 5.05 12H7l-3.9 6h6.92v4h3.95v-4H21l-4-6z");
