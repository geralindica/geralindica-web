// Confere se o seed.sql (contas de demonstração) roda depois de todas as migrações, num Postgres local
// (PGlite, sem tocar no Supabase). Uso: npm run test:seed
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const base = join(import.meta.dirname, '..')
const db = new PGlite({ extensions: { pgcrypto } })

await db.exec(`
create extension pgcrypto; create schema extensions;
create role anon nologin; create role authenticated nologin; create role service_role nologin;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create table auth.users (instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
  confirmation_token text, recovery_token text, email_change_token_new text, email_change text);
create table auth.identities (id uuid primary key, user_id uuid, provider_id text, identity_data jsonb, provider text,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
create schema cron;
create function cron.schedule(a text, b text, c text) returns bigint language sql as $$ select 1::bigint $$;
create function cron.unschedule(a text) returns boolean language sql as $$ select true $$;
`)

for (const f of readdirSync(join(base, 'migrations')).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(base, 'migrations', f), 'utf8').replace(/create extension if not exists pg_cron;/g, ''))
}
try {
  await db.exec(`set seed.demo_senha = 'senha-de-teste'; ${readFileSync(join(base, 'seed.sql'), 'utf8')}`)
} catch (e) {
  console.log(`FALHOU o seed: ${e.message}`)
  process.exit(1)
}
const n = async (sql) => (await db.query(sql)).rows[0].n
const r = {
  consultores: await n(`select count(*)::int n from public.consultores`),
  indicadores: await n(`select count(*)::int n from public.indicadores`),
  leads: await n(`select count(*)::int n from public.leads`),
  vendas: await n(`select count(*)::int n from public.vendas`),
  emails_antigos: await n(`select count(*)::int n from auth.users where email like '%indikei%'`),
  temperatura_max: await n(`select max(temperatura) n from public.consultores`),
}
console.log(r)
const ok = r.consultores === 8 && r.vendas > 0 && r.emails_antigos === 0 && r.temperatura_max > 0
console.log(ok ? 'Seed ok' : 'Seed com problema')
process.exit(ok ? 0 : 1)
