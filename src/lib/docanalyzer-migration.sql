-- Document Analyzer Module - Database Migration
-- Tables for storing document analysis sessions and uploaded files

-- doc_analysis_sessions: Stores analysis sessions per user
CREATE TABLE IF NOT EXISTS doc_analysis_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(255),
    prompt TEXT NOT NULL,
    model VARCHAR(100) DEFAULT 'gemini-2.5-flash',
    response LONGTEXT,
    status ENUM('pending', 'processing', 'completed', 'error') DEFAULT 'pending',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- doc_analysis_files: Stores uploaded file metadata
CREATE TABLE IF NOT EXISTS doc_analysis_files (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    s3_key VARCHAR(512) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES doc_analysis_sessions(id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX idx_doc_sessions_user ON doc_analysis_sessions(user_id);
CREATE INDEX idx_doc_sessions_status ON doc_analysis_sessions(status);
CREATE INDEX idx_doc_sessions_created ON doc_analysis_sessions(created_at);
CREATE INDEX idx_doc_files_session ON doc_analysis_files(session_id);

-- Migration: Add user_id column if table already exists without it
-- Run this if upgrading from previous version:
-- ALTER TABLE doc_analysis_sessions ADD COLUMN user_id VARCHAR(36) NOT NULL AFTER id;
-- ALTER TABLE doc_analysis_sessions ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
