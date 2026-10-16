/** The Share menu's words and links, shared by Insights articles and Careers roles. */
export const shareCopy = {
  share: "Share",
  copyLink: "Copy link",
  linkCopied: "Link copied",
  more: "More options",
  opensInNewTab: "(opens in a new tab)",
} as const;

export interface ShareTarget {
  key: "linkedin" | "x" | "facebook" | "whatsapp" | "reddit" | "bluesky" | "email";
  label: string;
  href: string;
  /** Opens the network in a new tab; email opens the visitor's mail app instead. */
  newTab: boolean;
}

/**
 * Plain share links for the major networks: no SDKs, no scripts, no tracking parameters. The
 * page's canonical URL and title are the only data passed on.
 */
export function shareTargets(url: string, title: string): ShareTarget[] {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const titleAndUrl = encodeURIComponent(`${title} ${url}`);
  return [
    {
      key: "linkedin",
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
      newTab: true,
    },
    { key: "x", label: "X", href: `https://x.com/intent/post?url=${u}&text=${t}`, newTab: true },
    {
      key: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      newTab: true,
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${titleAndUrl}`,
      newTab: true,
    },
    {
      key: "reddit",
      label: "Reddit",
      href: `https://www.reddit.com/submit?url=${u}&title=${t}`,
      newTab: true,
    },
    {
      key: "bluesky",
      label: "Bluesky",
      href: `https://bsky.app/intent/compose?text=${titleAndUrl}`,
      newTab: true,
    },
    { key: "email", label: "Email", href: `mailto:?subject=${t}&body=${u}`, newTab: false },
  ];
}
