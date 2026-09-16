import type { AnchorHTMLAttributes } from "react";
export function ButtonLink({ className = "", ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...props}
      className={`vitalos-button ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 48,
        padding: ".75rem 1.25rem",
        marginTop: "1rem",
        background: "#2457FF",
        color: "white",
        fontWeight: 700,
        textDecoration: "none",
        borderRadius: 4,
      }}
    />
  );
}
