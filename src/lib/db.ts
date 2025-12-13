import mysql from 'mysql2/promise';

// Create connection pool
// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'wisnu123',
  database: process.env.DB_NAME || 'fac_chat2',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
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
export async function queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
  const results = await query<T[]>(sql, params);
  return Array.isArray(results) && results.length > 0 ? results[0] : null;
}

// Initialize database tables
export async function initializeDatabase(): Promise<void> {
  const connection = await pool.getConnection();

  try {
    // Create agents table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        system_prompt TEXT,
        status ENUM('active', 'inactive', 'draft') DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create llm_configs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS llm_configs (
        id VARCHAR(36) PRIMARY KEY,
        agent_id VARCHAR(36) NOT NULL,
        provider VARCHAR(50) DEFAULT 'google',
        model VARCHAR(100) DEFAULT 'gemini-2.5-flash',
        temperature FLOAT DEFAULT 0.7,
        max_tokens INT DEFAULT 2048,
        agent_mode ENUM('simple', 'agentic') DEFAULT 'simple',
        max_iterations INT DEFAULT 10,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    // Create api_keys table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR(36) PRIMARY KEY,
        agent_id VARCHAR(36) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        api_key TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    // Create mcp_configs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS mcp_configs (
        id VARCHAR(36) PRIMARY KEY,
        agent_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        type ENUM('local', 'cloud') DEFAULT 'local',
        config_json TEXT,
        enabled BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    // Create rag_configs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS rag_configs (
        id VARCHAR(36) PRIMARY KEY,
        agent_id VARCHAR(36) NOT NULL,
        type VARCHAR(50) DEFAULT 'opensearch',
        connection_config TEXT,
        index_name VARCHAR(255),
        enabled BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    // Create file_search_stores table for Gemini File Search RAG
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS file_search_stores (
        id VARCHAR(36) PRIMARY KEY,
        agent_id VARCHAR(36) NOT NULL,
        store_name VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        enabled BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    // Create file_search_documents table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS file_search_documents (
        id VARCHAR(36) PRIMARY KEY,
        store_id VARCHAR(36) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        mime_type VARCHAR(100),
        file_size_bytes BIGINT,
        status ENUM('pending', 'processing', 'ready', 'error') DEFAULT 'pending',
        error_message TEXT,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES file_search_stores(id) ON DELETE CASCADE
      )
    `);

    // Create chat_sessions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id VARCHAR(36) PRIMARY KEY,
        agent_id VARCHAR(36) NOT NULL,
        session_source VARCHAR(100) DEFAULT 'widget',
        user_identifier VARCHAR(255),
        client_name VARCHAR(255),
        client_level VARCHAR(50),
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        message_count INT DEFAULT 0,
        tool_call_count INT DEFAULT 0,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    // Create chat_messages table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        role ENUM('user', 'assistant', 'system') NOT NULL,
        content TEXT NOT NULL,
        thoughts TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
      )
    `);

    // Create tool_calls table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tool_calls (
        id VARCHAR(36) PRIMARY KEY,
        message_id VARCHAR(36) NOT NULL,
        session_id VARCHAR(36) NOT NULL,
        tool_name VARCHAR(255) NOT NULL,
        tool_input TEXT,
        tool_output TEXT,
        execution_time_ms INT,
        status ENUM('success', 'error', 'pending') DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
      )
    `);

    // Create roles table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(255),
        is_system BOOLEAN DEFAULT false,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create permissions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS permissions (
        id VARCHAR(36) PRIMARY KEY,
        code VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50),
        description VARCHAR(255)
      )
    `);

    // Create role_permissions table (many-to-many)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id VARCHAR(36) NOT NULL,
        permission_id VARCHAR(36) NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      )
    `);

    // Create users table
    await connection.execute(`
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
      )
    `);

    // Create doc_analysis_sessions table
    await connection.execute(`
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
      )
    `);

    // Create doc_analysis_files table
    await connection.execute(`
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
      )
    `);

    console.log('Database tables initialized successfully');
  } finally {
    connection.release();
  }
}

export default pool;
