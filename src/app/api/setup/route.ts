import { NextRequest, NextResponse } from 'next/server';
import { createConnection, initializeDatabase, query } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'test-db') {
            const { host, port, user, password, database } = body.config;

            try {
                // 1. Validasi config dasar
                if (!host || !port || !user || !database) {
                    throw new Error('All fields are required');
                }

                // 2. Coba koneksi TANPA nama database dulu untuk cek credential
                const connection = await createConnection({
                    host,
                    port: parseInt(port),
                    user,
                    password,
                    ssl: (host !== 'localhost' && host !== '127.0.0.1') ? { rejectUnauthorized: true } : undefined
                });

                // 3. Create database if not exists
                // Gunakan escapeId untu mencegah SQL Injection pada nama database (meski mysql2 biasanya handle di params, identifier beda)
                // Kita validasi nama database alphanumeric saja biar aman
                if (!/^[a-zA-Z0-9_]+$/.test(database)) {
                    await connection.end();
                    throw new Error('Database name should only contain letters, numbers, and underscores');
                }

                await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);

                // 4. Switch ke database tersebut
                await connection.changeUser({ database });

                // 5. Cek apakah database kosong
                const [tables]: any = await connection.query('SHOW TABLES');

                await connection.end();

                if (Array.isArray(tables) && tables.length > 0) {
                    return NextResponse.json({
                        success: false,
                        error: `Database '${database}' already exists and is NOT empty. Please use a fresh database.`
                    }, { status: 400 });
                }

                return NextResponse.json({ success: true, message: 'Connection successful. Database created/verified.' });
            } catch (error) {
                console.error('DB Connection Test Error:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
            }
        }

        if (action === 'install') {
            const { projectConfig, dbConfig, adminConfig } = body;

            // 1. Prepare new config
            const newConfig: Record<string, string> = {
                NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
                NEXTAUTH_URL: 'http://localhost:3000',
                NEXTAUTH_SECRET: uuidv4(),

                // Database
                DB_HOST: dbConfig.host,
                DB_PORT: dbConfig.port,
                DB_USER: dbConfig.user,
                DB_PASSWORD: dbConfig.password,
                DB_NAME: dbConfig.database,

                // App Info
                DB_SSL: (dbConfig.host !== 'localhost' && dbConfig.host !== '127.0.0.1') ? 'true' : 'false',
                NEXT_PUBLIC_APP_NAME: projectConfig.name,

                // Setup Flag
                SETUP_COMPLETED: 'true'
            };

            // 2. Read existing .env.local to resolve conflicts/overrides
            const envPath = path.join(process.cwd(), '.env.local');
            let envContent = '';

            if (fs.existsSync(envPath)) {
                envContent = fs.readFileSync(envPath, 'utf-8');
            }

            // 3. Update or Append keys
            Object.entries(newConfig).forEach(([key, value]) => {
                const regex = new RegExp(`^${key}=.*`, 'm');
                if (regex.test(envContent)) {
                    envContent = envContent.replace(regex, `${key}=${value}`);
                } else {
                    envContent += `\n${key}=${value}`;
                }
            });

            // Ensure we have a newline at end
            if (!envContent.endsWith('\n')) envContent += '\n';

            // 4. Write to .env.local (This guarantees priority over .env and persistence)
            fs.writeFileSync(envPath, envContent.trim() + '\n');

            // Also try to delete .env to avoid confusion if it exists
            const dotEnvPath = path.join(process.cwd(), '.env');
            if (fs.existsSync(dotEnvPath)) {
                try {
                    fs.unlinkSync(dotEnvPath);
                } catch (e) {
                    // Ignore error if can't delete
                }
            }

            // 5. Initialize Database Tables
            // We need to reload the DB config essentially, but since the process hasn't restarted,
            // the global 'pool' in lib/db.ts will still use old env vars.
            // However, we can use a fresh connection for initialization based on the passed config.

            // Note: reusing initializeDatabase() is tricky because it imports 'pool' from module scope.
            // For now, we manually execute the SQL or relies on the user restarting.
            // BUT, user wants "without repot merubah file".
            // So we really should try to run the init sql here using the new config.

            try {
                const connection = await createConnection({
                    host: dbConfig.host,
                    port: parseInt(dbConfig.port),
                    user: dbConfig.user,
                    password: dbConfig.password,
                    database: dbConfig.database,
                    multipleStatements: true, // Important for running multiple queries
                    ssl: (dbConfig.host !== 'localhost' && dbConfig.host !== '127.0.0.1') ? { rejectUnauthorized: true } : undefined
                });

                // Read the schema creation logic? 
                // It's hardcoded in lib/db.ts. 
                // To avoid code duplication, we'll try to use the raw connection to run the same queries.
                // Or better, we just tell the user to restart? 
                // No, prompt asked for "Setup Project" feature. 
                // Let's implement the schema creation here directly or refactor lib/db.ts to accept a pool.
                // Refactoring lib/db.ts to export `initDb(pool)` would be cleaner, but I can't easily change that right now without breaking 
                // other imports if I'm significant refactoring.
                // I will duplicate the init logic slightly or assume the user accepts a restart, 
                // BUT better yet, I will execute the critical tables creation here.

                // Initialize tables from schema.sql
                const schemaPath = path.join(process.cwd(), 'src/lib/schema.sql');
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
                        // Use .query instead of .execute for DDL (CREATE TABLE/INDEX) 
                        // as .execute uses prepared statements which some MySQL versions don't support for DDL
                        await connection.query(sql);
                    } catch (err) {
                        console.warn(`Warning executing schema query: ${sql.substring(0, 50)}...`, err);
                    }
                }

                // 3. Create Superadmin Role & User
                const superAdminRoleId = uuidv4();

                // Check if role exists
                const [roles] = await connection.execute('SELECT id FROM roles WHERE name = ?', ['Superadmin']);
                let finalRoleId = superAdminRoleId;

                if (Array.isArray(roles) && roles.length > 0) {
                    // @ts-ignore
                    finalRoleId = roles[0].id;
                } else {
                    await connection.execute(
                        'INSERT INTO roles (id, name, description, is_system) VALUES (?, ?, ?, ?)',
                        [superAdminRoleId, 'Superadmin', 'Full system access', true]
                    );
                }

                // 4. Seed Permissions & Assign to Superadmin
                const permissions = [
                    { code: 'users.view', name: 'View Users', category: 'Users', description: 'Can view user list' },
                    { code: 'users.manage', name: 'Manage Users', category: 'Users', description: 'Can create, edit, delete users' },
                    { code: 'roles.view', name: 'View Roles', category: 'Roles', description: 'Can view roles' },
                    { code: 'roles.manage', name: 'Manage Roles', category: 'Roles', description: 'Can manage roles and permissions' },
                    { code: 'agents.view', name: 'View Agents', category: 'Agents', description: 'Can view agents' },
                    { code: 'agents.manage', name: 'Manage Agents', category: 'Agents', description: 'Can manage agents' },
                    { code: 'settings.view', name: 'View Settings', category: 'Settings', description: 'Can view settings' },
                    { code: 'settings.manage', name: 'Manage Settings', category: 'Settings', description: 'Can update settings' },
                ];

                for (const p of permissions) {
                    const pId = uuidv4();

                    // Check existence
                    const [existing] = await connection.execute('SELECT id FROM permissions WHERE code = ?', [p.code]);
                    let permId = pId;

                    if (Array.isArray(existing) && existing.length > 0) {
                        // @ts-ignore
                        permId = existing[0].id;
                    } else {
                        await connection.execute(
                            'INSERT INTO permissions (id, code, name, category, description) VALUES (?, ?, ?, ?, ?)',
                            [pId, p.code, p.name, p.category, p.description]
                        );
                    }

                    // Assign to Superadmin (using IGNORE to prevent duplicate errors if re-running)
                    // Note: 'INSERT IGNORE' isMySQL specific.
                    await connection.execute(
                        'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
                        [finalRoleId, permId]
                    );
                }

                // Create User
                const userId = uuidv4();
                const hashedPassword = await bcrypt.hash(adminConfig.password, 10);

                // Check if user exists check
                const [users] = await connection.execute('SELECT id FROM users WHERE email = ?', [adminConfig.email]);

                if (Array.isArray(users) && users.length === 0) {
                    await connection.execute(
                        'INSERT INTO users (id, email, password_hash, name, role_id, is_active) VALUES (?, ?, ?, ?, ?, ?)',
                        [userId, adminConfig.email, hashedPassword, adminConfig.name, finalRoleId, true]
                    );
                }

                await connection.end();

                return NextResponse.json({ success: true, message: 'Installation successful' });

            } catch (dbError) {
                console.error('Installation DB Error:', dbError);
                const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
                return NextResponse.json({ success: false, error: 'Database Init Failed: ' + errorMessage }, { status: 500 });
            }
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Setup API Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
