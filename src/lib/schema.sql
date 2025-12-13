-- AI Chat Agent Database Schema
-- Database: fac_chat2

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS fac_chat2;
USE fac_chat2;

-- Agents table - stores chat agent configurations
CREATE TABLE IF NOT EXISTS agents (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  system_prompt TEXT,
  status ENUM('active', 'inactive', 'draft') DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- LLM Configurations table - stores LLM settings per agent
CREATE TABLE IF NOT EXISTS llm_configs (
  id VARCHAR(36) PRIMARY KEY,
  agent_id VARCHAR(36) NOT NULL,
  provider VARCHAR(50) DEFAULT 'google',
  model VARCHAR(100) DEFAULT 'gemini-2.5-flash',
  temperature FLOAT DEFAULT 0.7,
  max_tokens INT DEFAULT 2048,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- API Keys table - stores API keys per agent/provider
CREATE TABLE IF NOT EXISTS api_keys (
  id VARCHAR(36) PRIMARY KEY,
  agent_id VARCHAR(36) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  api_key TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- MCP Configurations table - stores MCP server connections
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
);

-- RAG Configurations table - stores RAG/vector database settings
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
);

-- Indexes for better query performance
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_llm_configs_agent ON llm_configs(agent_id);
CREATE INDEX idx_api_keys_agent ON api_keys(agent_id);
CREATE INDEX idx_mcp_configs_agent ON mcp_configs(agent_id);
CREATE INDEX idx_rag_configs_agent ON rag_configs(agent_id);
