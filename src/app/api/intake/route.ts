import { NextResponse } from "next/server";
import { failure, readJSON } from "@/lib/server/http";
import { APIError } from "@/lib/server/supabase";
import { enquirySchema, saveEnquiry } from "@/lib/server/intake";
import { authorizedSecret } from "@/lib/integrations/verification";
export async function POST(request: Request) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true")
      throw new APIError("Intake is disabled in demo mode.", 503);
    if (
      !authorizedSecret(
        request.headers.get("authorization"),
        process.env.INTAKE_SECRET,
      )
    )
      throw new APIError("Unauthorized intake.", 401);
    const input = enquirySchema.parse(await readJSON(request));
    return NextResponse.json(await saveEnquiry(input), { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
