-- Runs once when the volume is first created: a separate database for integration tests.
CREATE DATABASE voice_agent_test;
\connect voice_agent
CREATE EXTENSION IF NOT EXISTS vector;
\connect voice_agent_test
CREATE EXTENSION IF NOT EXISTS vector;
