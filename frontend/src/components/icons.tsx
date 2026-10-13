import type { SVGProps } from "react";
type P = SVGProps<SVGSVGElement> & { size?: number };
function Svg({ size = 14, children, ...r }: P) {
return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...r}>{children}</svg>;
}
export const UploadIcon = (p: P) => <Svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></Svg>;
export const DownloadIcon = (p: P) => <Svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></Svg>;
export const FolderIcon = (p: P) => <Svg {...p}><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></Svg>;
export const FileTextIcon = (p: P) => <Svg {...p}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8M16 13H8M16 17H8"/></Svg>;
export const SaveIcon = (p: P) => <Svg {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></Svg>;
export const CheckIcon = (p: P) => <Svg {...p}><path d="M20 6 9 17l-5-5"/></Svg>;
export const PlayIcon = (p: P) => <Svg {...p}><path d="M6 4l14 8-14 8V4z"/></Svg>;
export const XIcon = (p: P) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12"/></Svg>;
export const CopyIcon = (p: P) => <Svg {...p}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></Svg>;
export const StarIcon = ({ filled, ...p }: P & { filled?: boolean }) => <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} {...p}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
export const AlertIcon = (p: P) => <Svg {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></Svg>;
export const ChevronUpIcon = (p: P) => <Svg {...p}><path d="M18 15l-6-6-6 6"/></Svg>;
export const ChevronDownIcon = (p: P) => <Svg {...p}><path d="M6 9l6 6 6-6"/></Svg>;
export const ChevronLeftIcon = (p: P) => <Svg {...p}><path d="M15 18l-6-6 6-6"/></Svg>;
export const DatabaseIcon = (p: P) => <Svg {...p}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></Svg>;
export const TrashIcon = (p: P) => <Svg {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></Svg>;
export const HelpIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></Svg>;
export const ArrowRightIcon = (p: P) => <Svg {...p}><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></Svg>;