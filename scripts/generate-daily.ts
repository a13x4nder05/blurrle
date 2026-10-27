import { parseArgs } from "node:util";
import { supabaseAdmin } from "../server/supabase-client.js";
const { values } = parseArgs({
  options: {
    day: { type: "string", default: new Date().toISOString().slice(0, 10) },
  },
});
if (!/^\d{4}-\d{2}-\d{2}$/.test(values.day!))
  throw new Error("Use --day YYYY-MM-DD (UTC).");
const admin = supabaseAdmin();
try {
  console.log(
    await admin.request("/rest/v1/rpc/generate_blurrle_daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_day: values.day }),
    }),
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Daily generation failed.",
  );
  process.exitCode = 1;
}
