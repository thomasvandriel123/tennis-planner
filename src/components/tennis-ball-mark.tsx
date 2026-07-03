/** A small tennis-ball glyph used as the app's logo mark. Purely decorative. */
export function TennisBallMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <circle cx="12" cy="12" r="10" className="fill-ball" />
      <path
        d="M12 2c-2.5 2.7-2.5 16.6 0 20M12 2c2.5 2.7 2.5 16.6 0 20"
        stroke="currentColor"
        strokeWidth="1.2"
        className="text-court"
      />
    </svg>
  );
}
