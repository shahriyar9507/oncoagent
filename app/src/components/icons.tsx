// Stroke icons (Lucide-style geometry, drawn inline). Decorative: aria-hidden; buttons carry their own labels.
import type { SVGProps } from "react";

function Svg(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />;
}

export const IconGrid = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Svg>);
export const IconUsers = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>);
export const IconInbox = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></Svg>);
export const IconPlug = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M18 8v5a6 6 0 0 1-12 0V8Z" /></Svg>);
export const IconGauge = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></Svg>);
export const IconLayers = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="m12 2 10 5-10 5L2 7Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></Svg>);
export const IconShield = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></Svg>);
export const IconSpark = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></Svg>);
export const IconDna = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M2 15c6.667-6 13.333 0 20-6" /><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" /><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" /><path d="m17 6-2.5-2.5" /><path d="m14 8-1-1" /><path d="m7 18 2.5 2.5" /><path d="m3.5 14.5.5.5" /><path d="m20 9 .5.5" /><path d="m6.5 12.5 1 1" /><path d="m16.5 10.5 1 1" /><path d="m10 16 1.5 1.5" /></Svg>);
export const IconActivity = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Svg>);
export const IconClock = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>);
export const IconFlask = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M10 2v7.31" /><path d="M14 9.3V2" /><path d="M8.5 2h7" /><path d="M14 9.3a6.5 6.5 0 1 1-4 0" /><path d="M5.52 16h12.96" /></Svg>);
export const IconPill = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" /></Svg>);
export const IconCalc = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" /></Svg>);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>);
export const IconX = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>);
export const IconEdit = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>);
export const IconPlay = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="m6 3 14 9-14 9Z" /></Svg>);
export const IconLink = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Svg>);
export const IconFile = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></Svg>);
export const IconAlert = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4M12 17h.01" /></Svg>);
export const IconAtom = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><circle cx="12" cy="12" r="1.5" /><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z" /><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z" /></Svg>);
export const IconGithub = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></Svg>);
export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>);
export const IconChevronRight = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>);
export const IconPrinter = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" rx="1" /></Svg>);
export const IconRefresh = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M3 12a9 9 0 0 1 15.36-6.36L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" /><path d="M3 21v-5h5" /></Svg>);
export const IconCopy = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Svg>);
export const IconExternal = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></Svg>);
export const IconTerminal = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="m4 17 6-6-6-6" /><path d="M12 19h8" /></Svg>);
export const IconHistory = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></Svg>);
export const IconLungs = (p: SVGProps<SVGSVGElement>) => (<Svg {...p}><path d="M12 4v8" /><path d="M12 12c-1.5 1-3 1.5-3 1.5" /><path d="M12 12c1.5 1 3 1.5 3 1.5" /><path d="M8.5 6.5C5 7 3 12 3 16.5 3 19 4.5 20 6 20c2 0 3.5-1.5 3.5-4V8.5c0-1.2-.4-2-1-2Z" /><path d="M15.5 6.5C19 7 21 12 21 16.5c0 2.5-1.5 3.5-3 3.5-2 0-3.5-1.5-3.5-4V8.5c0-1.2.4-2 1-2Z" /></Svg>);
