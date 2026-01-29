-- ============================================================================
-- DECOMPRESS DATABASE SCHEMA
-- ============================================================================
-- This migration creates the initial schema for storing scraped podcast/video
-- data including sources (channels), videos, people, and taxonomy (tags/categories).
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- SOURCES (channels, podcasts, blogs, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE sources (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Type discrimination for future expansion
    type                VARCHAR(50) NOT NULL DEFAULT 'youtube_channel',

    -- Identifiers
    external_id         VARCHAR(255) NOT NULL,
    handle              VARCHAR(255),

    -- Display info
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    thumbnail_url       TEXT,
    banner_url          TEXT,

    -- Metadata
    subscriber_count    BIGINT,
    video_count         INTEGER,

    -- Scraping state
    last_scraped_at     TIMESTAMPTZ,
    scrape_frequency    VARCHAR(50) DEFAULT 'daily',
    is_active           BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT sources_type_external_id_key UNIQUE(type, external_id)
);

CREATE INDEX idx_sources_type ON sources(type);
CREATE INDEX idx_sources_handle ON sources(handle);
CREATE INDEX idx_sources_is_active ON sources(is_active);

-- -----------------------------------------------------------------------------
-- VIDEOS
-- -----------------------------------------------------------------------------
CREATE TABLE videos (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id               UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,

    -- Identifiers
    external_id             VARCHAR(255) NOT NULL,
    url                     TEXT NOT NULL,

    -- Core metadata
    title                   VARCHAR(500) NOT NULL,
    description             TEXT,

    -- Duration
    duration_seconds        INTEGER,
    duration_string         VARCHAR(20),

    -- Media
    thumbnail_url           TEXT,

    -- Dates
    published_at            TIMESTAMPTZ,
    upload_date             DATE,

    -- Engagement (optional)
    view_count              BIGINT,
    like_count              BIGINT,
    comment_count           BIGINT,

    -- Content
    transcript              TEXT,
    transcript_language     VARCHAR(10) DEFAULT 'en',
    has_transcript          BOOLEAN DEFAULT FALSE,

    -- Processing state
    metadata_scraped_at     TIMESTAMPTZ,
    transcript_scraped_at   TIMESTAMPTZ,

    -- Timestamps
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT videos_source_external_key UNIQUE(source_id, external_id)
);

CREATE INDEX idx_videos_source_id ON videos(source_id);
CREATE INDEX idx_videos_published_at ON videos(published_at DESC);
CREATE INDEX idx_videos_external_id ON videos(external_id);
CREATE INDEX idx_videos_has_transcript ON videos(has_transcript);

-- -----------------------------------------------------------------------------
-- PEOPLE
-- -----------------------------------------------------------------------------
CREATE TABLE people (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identity
    name                VARCHAR(255) NOT NULL,
    slug                VARCHAR(255) UNIQUE,

    -- Profile
    bio                 TEXT,
    photo_url           TEXT,

    -- External links (flexible JSON)
    social_links        JSONB DEFAULT '{}',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_people_name ON people(name);
CREATE INDEX idx_people_slug ON people(slug);

-- -----------------------------------------------------------------------------
-- SOURCE_PEOPLE (primary hosts/contributors for a channel)
-- -----------------------------------------------------------------------------
CREATE TABLE source_people (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id           UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    person_id           UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,

    -- Role info
    role                VARCHAR(50) NOT NULL DEFAULT 'host',
    is_primary          BOOLEAN DEFAULT FALSE,

    -- Validity period (for when hosts change)
    started_at          DATE,
    ended_at            DATE,

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT source_people_unique UNIQUE(source_id, person_id, role)
);

CREATE INDEX idx_source_people_source ON source_people(source_id);
CREATE INDEX idx_source_people_person ON source_people(person_id);
CREATE INDEX idx_source_people_is_primary ON source_people(is_primary);

-- -----------------------------------------------------------------------------
-- VIDEO_PEOPLE (appearances in specific videos)
-- -----------------------------------------------------------------------------
CREATE TABLE video_people (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id            UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    person_id           UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,

    -- Role in this specific video
    role                VARCHAR(50) NOT NULL,

    -- Optional ordering (for multiple guests)
    display_order       INTEGER DEFAULT 0,

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT video_people_unique UNIQUE(video_id, person_id, role)
);

CREATE INDEX idx_video_people_video ON video_people(video_id);
CREATE INDEX idx_video_people_person ON video_people(person_id);

-- ============================================================================
-- TAXONOMY TABLES (Tags & Categories)
-- ============================================================================

-- -----------------------------------------------------------------------------
-- TAGS (shared between sources and videos)
-- -----------------------------------------------------------------------------
CREATE TABLE tags (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name                VARCHAR(100) NOT NULL,
    slug                VARCHAR(100) NOT NULL UNIQUE,

    -- Optional: tag type for grouping
    type                VARCHAR(50) DEFAULT 'general',

    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tags_slug ON tags(slug);
CREATE INDEX idx_tags_type ON tags(type);

-- -----------------------------------------------------------------------------
-- VIDEO_TAGS (junction table)
-- -----------------------------------------------------------------------------
CREATE TABLE video_tags (
    video_id            UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    tag_id              UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,

    -- Where did this tag come from?
    source              VARCHAR(50) DEFAULT 'youtube',

    created_at          TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (video_id, tag_id)
);

CREATE INDEX idx_video_tags_tag ON video_tags(tag_id);

-- -----------------------------------------------------------------------------
-- SOURCE_TAGS (junction table)
-- -----------------------------------------------------------------------------
CREATE TABLE source_tags (
    source_id           UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    tag_id              UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,

    created_at          TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (source_id, tag_id)
);

CREATE INDEX idx_source_tags_tag ON source_tags(tag_id);

-- -----------------------------------------------------------------------------
-- CATEGORIES (hierarchical, shared)
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name                VARCHAR(100) NOT NULL,
    slug                VARCHAR(100) NOT NULL UNIQUE,

    -- Hierarchy support
    parent_id           UUID REFERENCES categories(id) ON DELETE SET NULL,

    -- Description
    description         TEXT,

    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- -----------------------------------------------------------------------------
-- VIDEO_CATEGORIES (junction table)
-- -----------------------------------------------------------------------------
CREATE TABLE video_categories (
    video_id            UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    category_id         UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,

    is_primary          BOOLEAN DEFAULT FALSE,

    PRIMARY KEY (video_id, category_id)
);

CREATE INDEX idx_video_categories_category ON video_categories(category_id);

-- -----------------------------------------------------------------------------
-- SOURCE_CATEGORIES (junction table)
-- -----------------------------------------------------------------------------
CREATE TABLE source_categories (
    source_id           UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    category_id         UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,

    is_primary          BOOLEAN DEFAULT FALSE,

    PRIMARY KEY (source_id, category_id)
);

CREATE INDEX idx_source_categories_category ON source_categories(category_id);

-- ============================================================================
-- OPERATIONAL TABLES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- SCRAPE_LOGS (track scraping history)
-- -----------------------------------------------------------------------------
CREATE TABLE scrape_logs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id           UUID REFERENCES sources(id) ON DELETE CASCADE,

    started_at          TIMESTAMPTZ NOT NULL,
    completed_at        TIMESTAMPTZ,

    status              VARCHAR(50) NOT NULL,

    videos_found        INTEGER DEFAULT 0,
    videos_new          INTEGER DEFAULT 0,
    videos_updated      INTEGER DEFAULT 0,
    transcripts_added   INTEGER DEFAULT 0,

    error_message       TEXT,

    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scrape_logs_source ON scrape_logs(source_id);
CREATE INDEX idx_scrape_logs_status ON scrape_logs(status);
CREATE INDEX idx_scrape_logs_started_at ON scrape_logs(started_at DESC);

-- -----------------------------------------------------------------------------
-- VIDEO_CHAPTERS (optional: chapter markers)
-- -----------------------------------------------------------------------------
CREATE TABLE video_chapters (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id            UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,

    title               VARCHAR(255) NOT NULL,
    start_seconds       INTEGER NOT NULL,
    end_seconds         INTEGER,

    display_order       INTEGER NOT NULL,

    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_chapters_video ON video_chapters(video_id);

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sources_updated_at
    BEFORE UPDATE ON sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_people_updated_at
    BEFORE UPDATE ON people
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS on all tables (policies can be added based on your auth needs)

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_chapters ENABLE ROW LEVEL SECURITY;

-- Public read access policies (adjust based on your needs)
CREATE POLICY "Public read access" ON sources FOR SELECT USING (true);
CREATE POLICY "Public read access" ON videos FOR SELECT USING (true);
CREATE POLICY "Public read access" ON people FOR SELECT USING (true);
CREATE POLICY "Public read access" ON source_people FOR SELECT USING (true);
CREATE POLICY "Public read access" ON video_people FOR SELECT USING (true);
CREATE POLICY "Public read access" ON tags FOR SELECT USING (true);
CREATE POLICY "Public read access" ON video_tags FOR SELECT USING (true);
CREATE POLICY "Public read access" ON source_tags FOR SELECT USING (true);
CREATE POLICY "Public read access" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read access" ON video_categories FOR SELECT USING (true);
CREATE POLICY "Public read access" ON source_categories FOR SELECT USING (true);
CREATE POLICY "Public read access" ON video_chapters FOR SELECT USING (true);

-- Service role has full access (for scraper and admin operations)
-- The service_role key bypasses RLS by default, so no explicit policy needed

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE sources IS 'Content sources (YouTube channels, podcasts, blogs, etc.)';
COMMENT ON TABLE videos IS 'Individual videos/episodes from sources';
COMMENT ON TABLE people IS 'People who appear in content (hosts, guests, etc.)';
COMMENT ON TABLE source_people IS 'Regular hosts/contributors for a source';
COMMENT ON TABLE video_people IS 'People appearing in specific videos';
COMMENT ON TABLE tags IS 'Shared tags for categorizing content';
COMMENT ON TABLE categories IS 'Hierarchical categories for content organization';
COMMENT ON TABLE scrape_logs IS 'Log of scraping operations for monitoring';
COMMENT ON TABLE video_chapters IS 'Chapter markers within videos';

COMMENT ON COLUMN sources.type IS 'Source type: youtube_channel, podcast_feed, blog, etc.';
COMMENT ON COLUMN source_people.is_primary IS 'Whether this is the primary host (e.g., Joe Rogan for JRE)';
COMMENT ON COLUMN source_people.started_at IS 'When this person joined (for tracking host changes)';
COMMENT ON COLUMN source_people.ended_at IS 'When this person left (NULL if still active)';
COMMENT ON COLUMN video_people.role IS 'Role in video: host, guest, co-host, interviewer, interviewee';
