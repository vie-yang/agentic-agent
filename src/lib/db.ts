import mysql from "mysql2/promise";
import fs from 'fs';
import path from 'path';

// Create connection pool
// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "fac_chat2",
  port: parseInt(process.env.DB_PORT || "3306"),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl:
    process.env.DB_SSL === "true"
      ? {
          rejectUnauthorized: true,
        }
      : undefined,
});

// Helper to create a standalone connection (for setup/testing)
export async function createConnection(config: mysql.ConnectionOptions) {
  return await mysql.createConnection(config);
}

// Helper function to execute queries
export async function query<T>(sql: string, params?: unknown[]): Promise<T> {
  const [results] = await pool.execute(sql, params);
  return results as T;
}

// Helper function to get a single row
export async function queryOne<T>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const results = await query<T[]>(sql, params);
  return Array.isArray(results) && results.length > 0 ? results[0] : null;
}

// Initialize database tables
export async function initializeDatabase(): Promise<void> {
  const connection = await pool.getConnection();

  try {
    // Read schema from schema.sql
    const schemaPath = path.join(process.cwd(), 'src/lib/schema.sql');
    if (!fs.existsSync(schemaPath)) {
        throw new Error(`Schema file not found at ${schemaPath}`);
    }
    
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const queries = schemaSql
        .split(';')
        .map(statement => {
            return statement
                .split('\n')
                .filter(line => !line.trim().startsWith('--')) // Remove comment lines
                .join('\n')
                .trim();
        })
        .filter(q => q.length > 0);

    for (const sql of queries) {
        try {
            await connection.query(sql);
        } catch (err) {
            console.warn(`Warning executing schema query: ${sql.substring(0, 50)}...`, err);
        }
    }



    // ==========================================
    // SEED INITIAL DATA
    // ==========================================

    // 1. Seed Permissions
    const permissions = [
      // Users Module
      {
        code: "users.view",
        name: "View Users",
        category: "Users",
        description: "Can view user list",
      },
      {
        code: "users.manage",
        name: "Manage Users",
        category: "Users",
        description: "Can create, edit, delete users",
      },

      // Roles Module
      {
        code: "roles.view",
        name: "View Roles",
        category: "Roles",
        description: "Can view roles",
      },
      {
        code: "roles.manage",
        name: "Manage Roles",
        category: "Roles",
        description: "Can create, edit, delete roles",
      },

      // Settings Module
      {
        code: "settings.view",
        name: "View Settings",
        category: "Settings",
        description: "Can view settings",
      },
      {
        code: "settings.manage",
        name: "Manage Settings",
        category: "Settings",
        description: "Can modify system settings",
      },

      // Agents Module
      {
        code: "agents.view",
        name: "View Agents",
        category: "Agents",
        description: "Can view agents",
      },
      {
        code: "agents.create",
        name: "Create Agents",
        category: "Agents",
        description: "Can create new agents",
      },
      {
        code: "agents.manage",
        name: "Manage Agents",
        category: "Agents",
        description: "Can edit and delete agents",
      },

    ];

    for (const perm of permissions) {
      await connection.execute(
        `INSERT IGNORE INTO permissions (id, code, name, category, description) 
         VALUES (UUID(), ?, ?, ?, ?)`,
        [perm.code, perm.name, perm.category, perm.description]
      );
    }

    // 2. Seed Roles
    // Superadmin
    await connection.execute(
      `INSERT IGNORE INTO roles (id, name, description, is_system) 
       VALUES ('11111111-1111-1111-1111-111111111111', 'Superadmin', 'Full system access', true)`
    );

    // User
    await connection.execute(
      `INSERT IGNORE INTO roles (id, name, description, is_system) 
       VALUES ('22222222-2222-2222-2222-222222222222', 'User', 'Standard user access', true)`
    );

    // 3. Assign All Permissions to Superadmin
    const [allPerms] = await connection.execute("SELECT id FROM permissions");
    const permRows = allPerms as { id: string }[];

    for (const perm of permRows) {
      await connection.execute(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) 
         VALUES ('11111111-1111-1111-1111-111111111111', ?)`,
        [perm.id]
      );
    }

    // 4. Assign Default Permissions to User (View only)
    const viewPerms = permissions.filter((p) => !p.code.includes(".manage"));
    for (const p of viewPerms) {
      // Get ID
      const [rows] = await connection.execute(
        "SELECT id FROM permissions WHERE code = ?",
        [p.code]
      );
      const found = (rows as { id: string }[])[0];
      if (found) {
        await connection.execute(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id) 
             VALUES ('22222222-2222-2222-2222-222222222222', ?)`,
          [found.id]
        );
      }
    }

    // 5. Seed Default App Settings
    const defaultSettings = [
      // General Settings
      {
        category: "general",
        key: "app_name",
        value: "AgentForge AI",
        type: "text",
        description: "Application display name",
      },
      {
        category: "general",
        key: "language",
        value: "id",
        type: "select",
        description: "Default language (id/en)",
      },
      {
        category: "general",
        key: "theme",
        value: "system",
        type: "select",
        description: "Theme preference (light/dark/system)",
      },

      // Agent Settings
      {
        category: "agent",
        key: "default_model",
        value: "gemini-2.5-flash",
        type: "select",
        description: "Default LLM model for new agents",
      },
      {
        category: "agent",
        key: "default_temperature",
        value: "0.7",
        type: "number",
        description: "Default temperature (0-1)",
      },
      {
        category: "agent",
        key: "default_max_tokens",
        value: "2048",
        type: "number",
        description: "Default max tokens",
      },
      {
        category: "agent",
        key: "default_system_prompt",
        value: "You are a helpful AI assistant.",
        type: "text",
        description: "Default system prompt template",
      },

    ];

    for (const setting of defaultSettings) {
      await connection.execute(
        `INSERT IGNORE INTO app_settings (id, category, setting_key, setting_value, value_type, description) 
         VALUES (UUID(), ?, ?, ?, ?, ?)`,
        [
          setting.category,
          setting.key,
          setting.value,
          setting.type,
          setting.description,
        ]
      );
    }

    console.log("Database tables and seed data initialized successfully");
  } finally {
    connection.release();
  }
}

export default pool;
