import "dotenv/config";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
    process.exit(1);
  }

  // Read migration file
  const migrationPath = join(
    __dirname,
    "../supabase/migrations/00001_initial_schema.sql"
  );
  const sql = readFileSync(migrationPath, "utf-8");

  console.log("Running migration against:", supabaseUrl);
  console.log("Migration file:", migrationPath);

  // Use Supabase's SQL endpoint
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseSecretKey,
      Authorization: `Bearer ${supabaseSecretKey}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    // The exec_sql RPC might not exist, try direct postgres connection info
    console.log("\nThe exec_sql RPC is not available.");
    console.log("\n" + "=".repeat(60));
    console.log("Please run the migration manually:");
    console.log("=".repeat(60));
    console.log("\n1. Go to your Supabase Dashboard:");
    console.log(`   ${supabaseUrl.replace(".supabase.co", "")}`);
    console.log("\n2. Navigate to: SQL Editor (left sidebar)");
    console.log("\n3. Click 'New query'");
    console.log("\n4. Copy and paste the contents of:");
    console.log(`   ${migrationPath}`);
    console.log("\n5. Click 'Run' (or press Cmd/Ctrl + Enter)");
    console.log("\n" + "=".repeat(60));

    // Also print a direct link
    const projectRef = supabaseUrl
      .replace("https://", "")
      .replace(".supabase.co", "");
    console.log(`\nDirect link to SQL Editor:`);
    console.log(
      `https://supabase.com/dashboard/project/${projectRef}/sql/new`
    );

    process.exit(0);
  }

  const result = await response.json();
  console.log("Migration completed successfully!");
  console.log(result);
}

runMigration().catch(console.error);
