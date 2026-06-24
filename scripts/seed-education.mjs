import "dotenv/config";
import process from "node:process";
import pg from "pg";

// Idempotent demo-data seeder for the education ecosystem.
// Creates 200+ education-organisation leads (preschools, K12 schools, colleges,
// universities, coaching institutes, professional-studies institutions,
// vocational colleges, tuition centres) tagged with the eLite SIS products they
// fit, plus a sample of accounts and opportunities to show the pipeline.
//
// Re-running deletes the previous "education-demo" batch first, so it is safe to
// run repeatedly. Run with:  node scripts/seed-education.mjs
//
// Requires: the core seed has run (so option sets exist) and DATABASE_URL is set.

const { Pool } = pg;
const SEED_BATCH = "education-demo";

const SEGMENTS = [
  { key: "preschool", label: "Pre-school", products: ["elite_sis_k12", "elite_sis_learn"], prefixes: ["Little Stars", "Bright Beginnings", "Tiny Tots", "Sunshine", "Rainbow Kids", "Happy Feet", "Kangaroo Kids", "EuroKids", "Hello Kids", "Podar Jumbo"], suffixes: ["Preschool", "Play School", "Early Learning Centre", "Kindergarten"] },
  { key: "k12_school", label: "K12 School", products: ["elite_sis_k12", "elite_sis_learn"], prefixes: ["Delhi Public", "St. Xavier's", "Ryan International", "DAV", "Kendriya Vidyalaya", "Modern", "Greenwood High", "National Public", "Bishop Cotton", "Army Public", "Sacred Heart", "Springdales"], suffixes: ["School", "Senior Secondary School", "High School", "Academy"] },
  { key: "college", label: "College", products: ["elite_sis_higher_ed", "elite_sis_learn"], prefixes: ["St. Stephen's", "Hindu", "Loyola", "Christ", "Fergusson", "Hansraj", "Miranda House", "Lady Shri Ram", "Presidency", "Ramjas", "Mount Carmel", "Stella Maris"], suffixes: ["College", "College of Arts & Science", "Degree College"] },
  { key: "university", label: "University", products: ["elite_sis_higher_ed", "elite_sis_learn"], prefixes: ["Amity", "Manipal", "Lovely Professional", "SRM", "VIT", "Symbiosis", "Ashoka", "Shiv Nadar", "Bennett", "Chandigarh", "Sharda", "Galgotias"], suffixes: ["University", "Global University", "Institute of Technology"] },
  { key: "coaching_institute", label: "Coaching Institute", products: ["elite_sis_ci", "elite_sis_learn"], prefixes: ["Aakash", "Allen Career", "FIITJEE", "Resonance", "Vibrant", "Narayana", "Sri Chaitanya", "Career Point", "Bansal", "Vidyamandir", "Motion", "PACE"], suffixes: ["Coaching Institute", "Career Institute", "Tutorials"] },
  { key: "tuition_centre", label: "Tuition Centre", products: ["elite_sis_ci", "elite_sis_learn"], prefixes: ["Genius", "ScholarHub", "BrainWave", "TopRankers", "Edu Excel", "Concept", "Achievers", "Pinnacle", "Mastermind", "Cambridge"], suffixes: ["Tuition Centre", "Learning Hub", "Study Circle"] },
  { key: "professional_studies", label: "Professional Studies Institution", products: ["elite_sis_pi", "elite_sis_learn"], prefixes: ["NIIT", "Aptech", "ICAI Study", "Frankfinn", "Jetking", "IMS", "TIME", "Career Launcher", "ZICA", "Arena Animation"], suffixes: ["Professional Institute", "Institute of Professional Studies", "Academy"] },
  { key: "vocational_college", label: "Vocational Study College", products: ["elite_sis_pi", "elite_sis_learn"], prefixes: ["Industrial", "Skill India", "Govt. Polytechnic", "ITI", "Vocational Skills", "Don Bosco Tech", "NSDC", "TechnoSkill", "CraftEdge", "Apex Skills"], suffixes: ["Polytechnic", "Vocational College", "Skill Development College"] }
];

const CITIES = ["Noida", "New Delhi", "Gurugram", "Mumbai", "Bengaluru", "Hyderabad", "Pune", "Chennai", "Kolkata", "Ahmedabad", "Jaipur", "Lucknow", "Chandigarh", "Indore", "Bhopal", "Nagpur", "Kochi", "Coimbatore", "Patna", "Surat"];
const FIRST_NAMES = ["Aarav", "Vivaan", "Aditya", "Priya", "Ananya", "Diya", "Rohan", "Ishaan", "Kavya", "Riya", "Arjun", "Sneha", "Karan", "Pooja", "Rahul", "Neha", "Amit", "Sunita", "Vikram", "Meera"];
const LAST_NAMES = ["Sharma", "Verma", "Gupta", "Singh", "Patel", "Reddy", "Nair", "Iyer", "Banerjee", "Chopra", "Mehta", "Joshi", "Rao", "Desai", "Kapoor"];
const STATUS_KEYS = ["new", "working", "qualified", "nurturing"];
const SOURCE_KEYS = ["website", "campaign", "partner", "referral", "outbound"];
const OPP_STAGE_KEYS = ["discovery", "qualification", "proposal", "negotiation"];

const PER_SEGMENT = 27; // 8 * 27 = 216 leads

function pick(arr, i) {
  return arr[i % arr.length];
}
function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function loadOptionMap(client, tenantId, setKey) {
  const result = await client.query(
    `SELECT tov.value_key, tov.id
       FROM tenant_option_values tov
       JOIN tenant_option_sets tos ON tos.id = tov.option_set_id AND tos.tenant_id = tov.tenant_id
      WHERE tos.tenant_id = $1 AND tos.set_key = $2 AND tov.deleted_at IS NULL AND tos.deleted_at IS NULL`,
    [tenantId, setKey]
  );
  const map = new Map();
  for (const row of result.rows) {
    map.set(row.value_key, row.id);
  }
  if (map.size === 0) {
    throw new Error(`Option set "${setKey}" has no values for tenant ${tenantId}. Run "npm run db:seed" first.`);
  }
  return map;
}

function optionId(map, key) {
  return map.get(key) ?? map.values().next().value;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }
  const tenantSlug = process.env.DEFAULT_TENANT_SLUG ?? "sample-tenant";
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    const tenantRow = await client.query(`SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`, [tenantSlug]);
    const tenantId = tenantRow.rows[0]?.id;
    if (!tenantId) throw new Error(`Tenant "${tenantSlug}" not found. Run "npm run db:seed" first.`);

    const adminRow = await client.query(
      `SELECT id FROM users WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`,
      [tenantId]
    );
    const ownerId = adminRow.rows[0]?.id ?? null;

    const leadStatus = await loadOptionMap(client, tenantId, "lead-status");
    const leadSource = await loadOptionMap(client, tenantId, "lead-source");
    const oppStage = await loadOptionMap(client, tenantId, "opportunity-pipeline");
    const oppSource = await loadOptionMap(client, tenantId, "opportunity-source");
    const oppOutcome = await loadOptionMap(client, tenantId, "opportunity-outcome-status");

    await client.query("BEGIN");

    // Idempotency: remove the previous education-demo batch.
    await client.query(`DELETE FROM opportunities WHERE tenant_id = $1 AND metadata->>'seedBatch' = $2`, [tenantId, SEED_BATCH]);
    await client.query(`DELETE FROM accounts WHERE tenant_id = $1 AND metadata->>'seedBatch' = $2`, [tenantId, SEED_BATCH]);
    await client.query(`DELETE FROM leads WHERE tenant_id = $1 AND metadata->>'seedBatch' = $2`, [tenantId, SEED_BATCH]);

    let leadCount = 0;
    let accountCount = 0;
    let oppCount = 0;
    const usedNames = new Set();

    for (const segment of SEGMENTS) {
      for (let i = 0; i < PER_SEGMENT; i += 1) {
        const city = pick(CITIES, i + segment.key.length);
        let baseName = `${pick(segment.prefixes, i)} ${pick(segment.suffixes, i + 1)}`;
        let companyName = `${baseName}, ${city}`;
        // ensure uniqueness of the display name
        let dedupe = 1;
        while (usedNames.has(companyName)) {
          companyName = `${baseName}, ${city} ${++dedupe}`;
        }
        usedNames.add(companyName);

        const firstName = rand(FIRST_NAMES);
        const lastName = rand(LAST_NAMES);
        const metadata = {
          seedBatch: SEED_BATCH,
          leadFor: "product",
          products: segment.products,
          segment: segment.key,
          segmentLabel: segment.label,
          city
        };

        const leadResult = await client.query(
          `INSERT INTO leads (tenant_id, owner_id, first_name, last_name, company_name, email, phone, status_option_id, source_option_id, score, metadata, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $2, $2) RETURNING id`,
          [
            tenantId,
            ownerId,
            firstName,
            lastName,
            companyName,
            `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${segment.key.replace(/_/g, "")}${i}.edu.in`,
            `+91-9${String(100000000 + Math.floor(Math.random() * 899999999))}`,
            optionId(leadStatus, pick(STATUS_KEYS, i)),
            optionId(leadSource, pick(SOURCE_KEYS, i)),
            40 + ((i * 7) % 60),
            JSON.stringify(metadata)
          ]
        );
        leadCount += 1;

        // Convert ~1 in 9 leads into an account + opportunity to show the pipeline.
        if (i % 9 === 0) {
          const accountResult = await client.query(
            `INSERT INTO accounts (tenant_id, owner_id, name, metadata, created_by, updated_by)
             VALUES ($1, $2, $3, $4::jsonb, $2, $2) RETURNING id`,
            [tenantId, ownerId, baseName, JSON.stringify({ seedBatch: SEED_BATCH, segment: segment.key, city, products: segment.products })]
          );
          accountCount += 1;
          const accountId = accountResult.rows[0].id;
          const amount = (250000 + ((i * 13) % 40) * 50000).toFixed(2);
          await client.query(
            `INSERT INTO opportunities (tenant_id, owner_id, account_id, name, amount, expected_close_date, stage_option_id, source_option_id, outcome_status_option_id, metadata, created_by, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $2, $2)`,
            [
              tenantId,
              ownerId,
              accountId,
              `${baseName} — ${pick(segment.products, 0)} rollout`,
              amount,
              new Date(Date.now() + (30 + (i % 90)) * 86400000).toISOString().slice(0, 10),
              optionId(oppStage, pick(OPP_STAGE_KEYS, i)),
              optionId(oppSource, "partner"),
              optionId(oppOutcome, "open"),
              JSON.stringify({ seedBatch: SEED_BATCH, leadFor: "product", products: segment.products, segment: segment.key })
            ]
          );
          oppCount += 1;
        }
      }
    }

    await client.query("COMMIT");
    console.log(`Education demo data seeded for tenant "${tenantSlug}":`);
    console.log(`  leads:         ${leadCount}`);
    console.log(`  accounts:      ${accountCount}`);
    console.log(`  opportunities: ${oppCount}`);
    console.log(`  products covered: elite_sis_k12, elite_sis_learn, elite_sis_higher_ed, elite_sis_ci, elite_sis_pi`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Education seed failed:", error.message);
  process.exit(1);
});
