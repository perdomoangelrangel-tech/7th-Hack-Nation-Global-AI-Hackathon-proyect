/** Drawn icons, one stroke weight (1.75), currentColor. */
type P = { className?: string; size?: number };
const base = (size = 18) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const MicIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></svg>
);
export const StopIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><rect x="6.5" y="6.5" width="11" height="11" rx="2" /></svg>
);
export const ArrowIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M5 12h13M13 6l6 6-6 6" /></svg>
);
export const ExternalIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const CloseIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const ChevronIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M6 9l6 6 6-6" /></svg>
);
export const SpeakerIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></svg>
);
export const BackIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M19 12H6M11 6l-6 6 6 6" /></svg>
);
