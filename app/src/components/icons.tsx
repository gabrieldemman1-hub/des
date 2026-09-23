import type { SVGProps } from 'react';

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export function HomeIcon() {
  return (
    <Icon>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h5v-6h4v6h5V9.5" />
    </Icon>
  );
}

export function LoadoutsIcon() {
  return (
    <Icon>
      <path d="M12 3 2.5 8 12 13l9.5-5Z" />
      <path d="m2.5 12.5 9.5 5 9.5-5" />
      <path d="m2.5 17 9.5 5 9.5-5" />
    </Icon>
  );
}

export function ProfileIcon() {
  return (
    <Icon>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Icon>
  );
}

export function SourcesIcon() {
  return (
    <Icon>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
      <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
      <path d="M9 8h7M9 12h5" />
    </Icon>
  );
}

export function CrosshairMark({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true" focusable="false" className="mark">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="34">
        <circle cx="256" cy="256" r="150" />
        <path d="M256 50v120M256 342v120M50 256h120M342 256h120" />
      </g>
      <circle cx="256" cy="256" r="24" fill="currentColor" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <Icon width="20" height="20">
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}
