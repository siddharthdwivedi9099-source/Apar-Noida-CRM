import "dotenv/config";
import process from "node:process";
import pg from "pg";

// Idempotent role-based demo logins. Creates one active user per canonical
// seeded role and assigns that role, so each login demonstrates that role's
// RBAC permissions. Re-running resets the demo users (password + role) safely.
//
// Run with:  node scripts/seed-demo-users.mjs   (or: npm run db:seed:demo-users)
// Requires:  the core seed has run (roles exist) and DATABASE_URL is set.

const { Pool } = pg;
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "Demo@1234";

// Canonical role slugs (28). Each becomes <slug-with-dots>@<domain>.
const ROLE_SLUGS = [
  "super-admin",
  "crm-admin",
  "sales-manager",
  "sales-executive",
  "sales-head",
  "sales-leader",
  "sales-development-representative",
  "sdr-manager",
  "inside-sales-executive",
  "inside-sales-manager",
  "marketing-manager",
  "marketing-executive",
  "social-media-marketing-manager",
  "social-media-marketing-executive",
  "business-development-manager",
  "business-development-executive",
  "presales-manager",
  "presales-executive",
  "support-manager",
  "support-executive",
  "partner-manager",
  "reseller-manager",
  "customer-success-manager-onboarding",
  "customer-success-manager-scaled",
  "customer-success-manager-enterprise",
  "customer-success-head",
  "executive-leadership",
  "customer-portal-user"
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set.");
  const tenantSlug = process.env.DEFAULT_TENANT_SLUG ?? "sample-tenant";
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL ?? "admin@sample-tenant.local";
  const emailDomain = adminEmail.includes("@") ? adminEmail.split("@")[1] : "sample-tenant.local";

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
    const actorId = adminRow.rows[0]?.id ?? null;

    // Resolve role ids by slug.
    const roleRows = await client.query(
      `SELECT slug, name, id FROM roles WHERE tenant_id = $1 AND slug = ANY($2::text[]) AND deleted_at IS NULL`,
      [tenantId, ROLE_SLUGS]
    );
    const roleMap = new Map(roleRows.rows.map((row) => [row.slug, { id: row.id, name: row.name }]));

    await client.query("BEGIN");
    const created = [];

    for (const slug of ROLE_SLUGS) {
      const role = roleMap.get(slug);
      if (!role) {
        console.warn(`  ! role "${slug}" not found — skipped`);
        continue;
      }
      const localPart = slug.replace(/-/g, ".");
      const email = `${localPart}@${emailDomain}`;
      const normalizedEmail = email.toLowerCase();
      const firstName = role.name.split(" ")[0];
      const lastName = "Demo";
      const displayName = `${role.name} (Demo)`;

      const userResult = await client.query(
        `
          INSERT INTO users (tenant_id, email, normalized_email, first_name, last_name, display_name, password_hash, status, password_changed_at, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, crypt($7, gen_salt('bf', 12)), 'active', NOW(), jsonb_build_object('seeded', true, 'demoBatch', 'role-demo', 'roleSlug', $8::text))
          ON CONFLICT (tenant_id, normalized_email)
          DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            display_name = EXCLUDED.display_name,
            password_hash = crypt($7, gen_salt('bf', 12)),
            status = 'active',
            password_changed_at = NOW(),
            failed_login_attempts = 0,
            locked_until = NULL,
            deleted_at = NULL,
            updated_at = NOW(),
            metadata = users.metadata || jsonb_build_object('seeded', true, 'demoBatch', 'role-demo', 'roleSlug', $8::text)
          RETURNING id
        `,
        [tenantId, email, normalizedEmail, firstName, lastName, displayName, DEMO_PASSWORD, slug]
      );
      const userId = userResult.rows[0].id;

      await client.query(
        `
          INSERT INTO user_roles (tenant_id, user_id, role_id, created_by, updated_by, metadata)
          VALUES ($1, $2, $3, $4, $4, jsonb_build_object('seeded', true, 'demoBatch', 'role-demo'))
          ON CONFLICT (tenant_id, user_id, role_id) DO UPDATE SET deleted_at = NULL, updated_at = NOW()
        `,
        [tenantId, userId, role.id, actorId]
      );
      created.push({ role: role.name, email, userId, slug });
    }

    // The Customer Portal User needs an active portal profile (linked to an
    // account) before the customer portal is usable. Link the demo portal user
    // to a seeded account so the portal can be demoed end to end.
    const portalUser = created.find((entry) => entry.slug === "customer-portal-user");
    if (portalUser) {
      const accountRow = await client.query(
        `SELECT id FROM accounts WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`,
        [tenantId]
      );
      const accountId = accountRow.rows[0]?.id;
      if (accountId) {
        await client.query(
          `DELETE FROM customer_portal_profiles WHERE tenant_id = $1 AND user_id = $2`,
          [tenantId, portalUser.userId]
        );
        await client.query(
          `INSERT INTO customer_portal_profiles (tenant_id, user_id, account_id, status, portal_role, metadata)
           VALUES ($1, $2, $3, 'active', 'customer_admin', jsonb_build_object('seeded', true, 'demoBatch', 'role-demo'))`,
          [tenantId, portalUser.userId, accountId]
        );
        console.log(`  (portal profile linked: customer.portal.user -> account ${accountId})`);
      }
    }

    await client.query("COMMIT");

    console.log(`\nRole-based demo logins for tenant "${tenantSlug}" (password for all: ${DEMO_PASSWORD})\n`);
    const width = Math.max(...created.map((entry) => entry.role.length));
    for (const entry of created) {
      console.log(`  ${entry.role.padEnd(width)}  ${entry.email}`);
    }
    console.log(`\n  ${created.length} demo users ready. Sign in with tenant "${tenantSlug}".`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Demo-user seed failed:", error.message);
  process.exit(1);
});
