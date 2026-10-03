import { user, db, fail } from "@/lib/server";
export async function GET(request: Request) {
  try {
    const publisher = await user();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new Error("Dataset ID is required.");
    const { data, error } = await db()
      .from("datasets")
      .select("id,title,encrypted_data,digest")
      .eq("id", id)
      .eq("publisher", publisher)
      .single();
    if (error || !data || !data.encrypted_data)
      throw new Error("Encrypted publisher dataset not found.");
    return Response.json(data);
  } catch (e) {
    return fail(e);
  }
}
