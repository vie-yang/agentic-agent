-- =============================================
-- NotulaFlow Module - Permissions Migration
-- Run this script to add NotulaFlow permissions
-- =============================================

-- Insert NotulaFlow permissions
INSERT IGNORE INTO permissions (id, code, name, category, description) VALUES
('perm-notulaflow-view', 'notulaflow.view', 'View NotulaFlow', 'NotulaFlow', 'Access NotulaFlow module and view meetings'),
('perm-notulaflow-record', 'notulaflow.record', 'Record Meetings', 'NotulaFlow', 'Record new meetings'),
('perm-notulaflow-manage', 'notulaflow.manage', 'Manage Meetings', 'NotulaFlow', 'Edit and delete meetings');

-- Assign NotulaFlow permissions to Superadmin
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-superadmin', 'perm-notulaflow-view'),
('role-superadmin', 'perm-notulaflow-record'),
('role-superadmin', 'perm-notulaflow-manage');

-- Assign view permission to Agent Manager
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-manager', 'perm-notulaflow-view'),
('role-manager', 'perm-notulaflow-record');

-- Assign view permission to User role
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-user', 'perm-notulaflow-view');

-- =============================================
-- Add summary_json column to nf_meetings
-- This stores AI-generated meeting analysis
-- =============================================
ALTER TABLE nf_meetings 
ADD COLUMN IF NOT EXISTS summary_json LONGTEXT 
COMMENT 'JSON containing AI-generated meeting summary, topics, action items';

-- =============================================
-- Verification Query (optional)
-- =============================================
-- SELECT r.name as role_name, p.code as permission_code, p.name as permission_name
-- FROM role_permissions rp
-- JOIN roles r ON rp.role_id = r.id
-- JOIN permissions p ON rp.permission_id = p.id
-- WHERE p.category = 'NotulaFlow'
-- ORDER BY r.name, p.code;

