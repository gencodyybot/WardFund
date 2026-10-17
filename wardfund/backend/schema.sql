-- WardFund Database Schema (PostgreSQL / Tiger Data compatible)

-- 1. Wards Table: Stores Toronto ward metadata and basic indicator summaries
CREATE TABLE IF NOT EXISTS wards (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    indicators JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Projects Table: Stores the illustrative project ideas for the $10,000 simulator
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL
);

-- 3. Allocations Table: Records user-submitted virtual budget distributions
CREATE TABLE IF NOT EXISTS allocations (
    id SERIAL PRIMARY KEY,
    ward_id VARCHAR(50) REFERENCES wards(id),
    allocations JSONB NOT NULL, -- Stores array of project allocations with amounts
    currency VARCHAR(10) DEFAULT 'CAD',
    simulation BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. 311 Service Requests Table (Optimized for Tiger Data / TimescaleDB time-series analysis)
CREATE TABLE IF NOT EXISTS service_requests_311 (
    id SERIAL PRIMARY KEY,
    ward_id VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    status VARCHAR(50),
    requested_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}'
);

-- Optional: Convert service_requests_311 into a TimescaleDB hypertable if Tiger Data is fully integrated
-- SELECT create_hypertable('service_requests_311', 'requested_at', if_not_exists => TRUE);

-- Seed initial default data matching main.py
INSERT INTO wards (id, name, indicators) VALUES 
('ward-14', 'Toronto-Danforth (Ward 14)', '{"311_requests_total": 1420, "top_category": "Waste Overflow"}'),
('ward-4', 'Parkdale-High Park (Ward 4)', '{"311_requests_total": 980, "top_category": "Road Maintenance"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, name, description) VALUES 
('greener-neighbourhoods', 'Greener Neighbourhoods', 'Trees, parks, and public green space.'),
('cleaner-streets', 'Cleaner and Safer Streets', 'Waste collection, cleanup initiatives, and related public-realm improvements.'),
('community-programs', 'Youth and Community Programs', 'Recreation, community programming, and shared spaces.')
ON CONFLICT (id) DO NOTHING;