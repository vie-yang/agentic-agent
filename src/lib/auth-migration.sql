-- =============================================
-- AgentForge AI - Authentication Migration
-- =============================================

-- 1. Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_system BOOLEAN DEFAULT false,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    description VARCHAR(255)
);

-- 3. Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id VARCHAR(36) NOT NULL,
    permission_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- 4. Create users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role_id VARCHAR(36),
    is_active BOOLEAN DEFAULT true,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
);

-- =============================================
-- Insert default data
-- =============================================

-- Insert default roles
INSERT IGNORE INTO roles (id, name, description, is_system) VALUES
('role-superadmin', 'Superadmin', 'Full system access - can manage users, roles, and all settings', true),
('role-manager', 'Agent Manager', 'Can create, edit, and manage AI agents', false),
('role-user', 'User', 'Can view agents and use chat features', false);

-- Insert default permissions
INSERT IGNORE INTO permissions (id, code, name, category, description) VALUES
('perm-users-view', 'users.view', 'View Users', 'Users', 'View user list and details'),
('perm-users-manage', 'users.manage', 'Manage Users', 'Users', 'Create, edit, delete users'),
('perm-roles-view', 'roles.view', 'View Roles', 'Roles', 'View roles and permissions'),
('perm-roles-manage', 'roles.manage', 'Manage Roles', 'Roles', 'Create, edit, delete roles'),
('perm-agents-view', 'agents.view', 'View Agents', 'Agents', 'View agent list and details'),
('perm-agents-create', 'agents.create', 'Create Agents', 'Agents', 'Create new AI agents'),
('perm-agents-edit', 'agents.edit', 'Edit Agents', 'Agents', 'Edit existing agents'),
('perm-agents-delete', 'agents.delete', 'Delete Agents', 'Agents', 'Delete agents'),
('perm-history-view', 'history.view', 'View History', 'History', 'View chat history'),
('perm-settings-manage', 'settings.manage', 'Manage Settings', 'Settings', 'Manage application settings');

-- Assign all permissions to Superadmin
INSERT IGNORE INTO role_permissions (role_id, permission_id) 
SELECT 'role-superadmin', id FROM permissions;

-- Assign Agent Manager permissions
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-manager', 'perm-agents-view'),
('role-manager', 'perm-agents-create'),
('role-manager', 'perm-agents-edit'),
('role-manager', 'perm-agents-delete'),
('role-manager', 'perm-history-view');

-- Assign User permissions
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-user', 'perm-agents-view'),
('role-user', 'perm-history-view');

-- Insert default admin user (password: admin123)
INSERT IGNORE INTO users (id, email, password_hash, name, role_id, is_active) VALUES
('user-admin', 'admin@agentforge.ai', '$2b$10$/Syg8go0Xtlfs07gxsoCKOEhFLucEWiXjdKOjX9FY6CCqL9dCDa6G', 'Administrator', 'role-superadmin', true);
