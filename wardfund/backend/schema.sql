-- WardFund database schema (PostgreSQL / Tiger Data compatible)

-- 1. Ward metadata (the current API still serves its ward data from main.py).
CREATE TABLE IF NOT EXISTS wards (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    indicators JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Project metadata (the current API still serves its project data from main.py).
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL
);

-- 3. Persistent allocation records (not yet used by the current API's in-memory ledger).
CREATE TABLE IF NOT EXISTS allocations (
    id SERIAL PRIMARY KEY,
    ward_id VARCHAR(50) REFERENCES wards(id),
    allocations JSONB NOT NULL,
    currency VARCHAR(10) DEFAULT 'CAD',
    simulation BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Toronto 311 service requests used by /api/wards/{ward_id}/trend.
CREATE TABLE IF NOT EXISTS service_requests_311 (
    id SERIAL PRIMARY KEY,
    ward_id VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    status VARCHAR(50),
    requested_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}'
);

-- The Tiger Data/TimescaleDB time_bucket() query works against this table.
-- Hypertable conversion is optional. Do not uncomment the command below as-is:
-- this table has PRIMARY KEY (id), while Timescale hypertables generally require
-- unique indexes/primary keys to include the time partitioning column.
-- SELECT create_hypertable('service_requests_311', 'requested_at', if_not_exists => TRUE);

INSERT INTO wards (id, name, indicators) VALUES
    ('ward-14', 'Toronto-Danforth (Ward 14)', '{"311_requests_total": 1420, "top_category": "Waste Overflow"}'),
    ('ward-4', 'Parkdale-High Park (Ward 4)', '{"311_requests_total": 980, "top_category": "Road Maintenance"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, name, description) VALUES
    ('greener-neighbourhoods', 'Greener Neighbourhoods', 'Trees, parks, and public green space.'),
    ('cleaner-streets', 'Cleaner and Safer Streets', 'Waste collection, cleanup initiatives, and related public-realm improvements.'),
    ('community-programs', 'Youth and Community Programs', 'Recreation, community programming, and shared spaces.')
ON CONFLICT (id) DO NOTHING;
