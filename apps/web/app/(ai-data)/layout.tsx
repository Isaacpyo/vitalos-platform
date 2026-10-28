/**
 * The Vitalos AI & Data section (docs/ai-data/PLAN.md, AID-002): its own header and footer
 * instead of the main site shell. Each page renders `AiDataPage` (header, `<main id="main">`,
 * footer) so the header can mark the current page without client JavaScript. The light AI & Data
 * tone is the default for everything between the bands.
 */
export default function AiDataLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-aid-tone="light" className="flex min-h-dvh flex-col [&>main]:flex-1">
      {children}
    </div>
  );
}
