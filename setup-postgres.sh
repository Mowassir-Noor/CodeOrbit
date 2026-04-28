#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CodeOrbit — PostgreSQL Setup Script
# Run once as a user with sudo access.
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "📦 Installing PostgreSQL..."
sudo apt-get update -qq
sudo apt-get install -y postgresql postgresql-client

echo "🚀 Starting PostgreSQL service..."
sudo systemctl enable postgresql
sudo systemctl start postgresql

echo "🗄️  Creating database and user..."
sudo -u postgres psql <<'SQL'
-- Create user (ignore error if already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'codeorbit_user') THEN
    CREATE USER codeorbit_user WITH PASSWORD 'codeorbit_pass';
  END IF;
END
$$;

-- Create database (ignore error if already exists)
SELECT 'CREATE DATABASE codeorbit OWNER codeorbit_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'codeorbit')\gexec

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE codeorbit TO codeorbit_user;
ALTER DATABASE codeorbit OWNER TO codeorbit_user;

\echo '✅ Database ready.'
SQL

echo ""
echo "✅ PostgreSQL setup complete!"
echo ""
echo "  Database : codeorbit"
echo "  User     : codeorbit_user"
echo "  Password : codeorbit_pass"
echo "  Port     : 5432"
echo ""
echo "▶  Now restart the Spring Boot backend:"
echo "   ./mvnw spring-boot:run"
