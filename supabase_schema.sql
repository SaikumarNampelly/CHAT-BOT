-- ============================================
-- Telugu AI Companion — Supabase Schema
-- Run this in your Supabase SQL editor
-- ============================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─────────────────────────────
-- 1. USERS
-- ─────────────────────────────
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

-- ─────────────────────────────
-- 2. COMPANIONS
-- Each user can create multiple named companions
-- ─────────────────────────────
create table if not exists companions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  companion_name text not null,           -- Name user gives (e.g. "Priya", "Arjun")
  role text not null,                     -- 'friend' | 'best_friend' | 'girlfriend' | 'boyfriend' | 'mentor' | 'study_buddy' | 'gaming_buddy' | 'motivator'
  scenario text default '',              -- Optional scenario context
  language text default 'telugu',        -- 'telugu' | 'english' | 'tanglish'
  created_at timestamptz default now()
);

-- ─────────────────────────────
-- 3. MESSAGES
-- ─────────────────────────────
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  companion_id uuid references companions(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  mood text default null,                -- optional mood tag: 'happy' | 'sad' | 'stressed' | 'romantic' | 'excited' | 'chill'
  created_at timestamptz default now()
);

-- ─────────────────────────────
-- Indexes for performance
-- ─────────────────────────────
create index if not exists idx_companions_user_id on companions(user_id);
create index if not exists idx_messages_companion_id on messages(companion_id);
create index if not exists idx_messages_created_at on messages(created_at);

-- ─────────────────────────────
-- Row Level Security (optional but recommended)
-- ─────────────────────────────
alter table users enable row level security;
alter table companions enable row level security;
alter table messages enable row level security;

-- Allow service role (backend) full access — your backend uses service_role key
-- so no additional policies needed for server-side access.
