-- ==========================================================================
-- RPC Function: match_courses
-- Purpose: pgvector cosine similarity search for semantic search
-- Run this AFTER the main schema.sql in Supabase SQL Editor
-- ==========================================================================
CREATE OR REPLACE FUNCTION match_courses(
        query_embedding VECTOR(768),
        match_count INTEGER DEFAULT 20,
        similarity_threshold FLOAT DEFAULT 0.3
    ) RETURNS TABLE (
        id UUID,
        title TEXT,
        link TEXT,
        platform TEXT,
        category TEXT,
        institution TEXT,
        instructor TEXT,
        difficulty TEXT,
        duration TEXT,
        mode TEXT,
        format TEXT,
        cost TEXT,
        certification TEXT,
        cert_type TEXT,
        validation TEXT,
        job_available TEXT,
        job_country TEXT,
        job_salary TEXT,
        job_mode TEXT,
        language TEXT,
        rating_avg NUMERIC,
        rating_count INTEGER,
        extra_fields JSONB,
        status TEXT,
        last_verified TIMESTAMPTZ,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        similarity FLOAT
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT c.id,
    c.title,
    c.link,
    c.platform,
    c.category,
    c.institution,
    c.instructor,
    c.difficulty,
    c.duration,
    c.mode,
    c.format,
    c.cost,
    c.certification,
    c.cert_type,
    c.validation,
    c.job_available,
    c.job_country,
    c.job_salary,
    c.job_mode,
    c.language,
    c.rating_avg,
    c.rating_count,
    c.extra_fields,
    c.status,
    c.last_verified,
    c.created_at,
    c.updated_at,
    (1 - (c.embedding <=> query_embedding))::FLOAT AS similarity
FROM courses c
WHERE c.status = 'active'
    AND c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
ORDER BY c.embedding <=> query_embedding
LIMIT match_count;
END;
$$;