import { enquirySchema } from "@vitalos/validation";
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = enquirySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid enquiry" }, { status: 400 });
  return Response.json(
    { error: "Enquiry delivery is not configured in this environment" },
    { status: 503 },
  );
}
