-- Create the second database (serhafen_chile) as serhafen_common is created by default
CREATE DATABASE serhafen_chile;

-- Connect to serhafen_common database and create schemas
\c serhafen_common;

-- Create schemas for US and AG
CREATE SCHEMA IF NOT EXISTS us;
CREATE SCHEMA IF NOT EXISTS ag;

-- Grant permissions to postgres user
GRANT ALL PRIVILEGES ON SCHEMA us TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA ag TO postgres;
GRANT USAGE ON SCHEMA us TO postgres;
GRANT USAGE ON SCHEMA ag TO postgres;

-- Connect to serhafen_chile database and create schema
\c serhafen_chile;

-- Create schema for CL
CREATE SCHEMA IF NOT EXISTS cl;

-- Grant permissions to postgres user
GRANT ALL PRIVILEGES ON SCHEMA cl TO postgres;
GRANT USAGE ON SCHEMA cl TO postgres;

-- Switch back to serhafen_common as default
\c serhafen_common;
