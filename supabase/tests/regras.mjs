// Roda todas as migrações num Postgres local (PGlite, sem tocar no Supabase) e testa as regras de dinheiro,
// atribuição e PJ da auditoria de 23/10/2026. Uso: npm run test:banco
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const migDir = join(import.meta.dirname, '..', 'migrations')
const ateArg = process.argv[2]
const db = new PGlite()

await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create schema auth; grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
create schema storage; grant usage on schema storage to authenticated;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
create schema cron; create function cron.schedule(a text, b text, c text) returns bigint language sql as $$ select 1::bigint $$;
`)

const ate = ateArg ?? 'zzzz'
for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
  if (f > ate) continue
  let sql = readFileSync(join(migDir, f), 'utf8').replace(/create extension if not exists pg_cron;/g, '')
  try { await db.exec(sql) } catch (e) { console.log(`FALHOU migração ${f}: ${e.message}`); process.exit(1) }
  console.log(`ok migração ${f}`)
}

const u = {}
async function criar(nome, meta) {
  const r = await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [`${nome}@t.st`, meta])
  u[nome] = r.rows[0].id
}
await criar('admin', {})
await db.query(`update public.profiles set papel = 'admin' where id = $1`, [u.admin])
await criar('c1', { papel: 'consultor', nome: 'Cons 1' })
await criar('c2', { papel: 'consultor', nome: 'Cons 2' })
await criar('i1', { nome: 'Ind 1', consultor_id: u.c1 })
await criar('i2', { nome: 'Ind 2', consultor_id: u.c2 })
await criar('ipj', { nome: 'Ind PJ', consultor_id: u.c1, tipo_pessoa: 'PJ', documento: '123' })
const canal = async (ind) => (await db.query(`select id, codigo from public.canais where indicador_id = $1`, [ind])).rows[0]
const k1 = await canal(u.i1), k2 = await canal(u.i2)
const lead = async (valor, etapa = 'novo') => (await db.query(
  `insert into public.leads (consultor_id, indicador_id, canal_id, nome, valor_adesao, etapa) values ($1,$2,$3,'Cliente Teste',$4,$5) returning id`,
  [u.c1, u.i1, k1.id, valor, etapa])).rows[0].id

let falhas = 0
const lit = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
async function como(quem, sql, params = []) {
  const texto = sql.replace(/\$(\d+)/g, (_, i) => lit(params[Number(i) - 1]))
  const prefixo = `select set_config('request.jwt.claim.sub', '${quem ? u[quem] : ''}', false); select set_config('request.jwt.claim.role', '${quem ? 'authenticated' : ''}', false);${quem ? ' set role authenticated;' : ''}`
  try { const r = await db.exec(`${prefixo} ${texto};`); return { ok: true, rows: r.at(-1).rows } }
  catch (e) { return { ok: false, erro: e.message } }
  finally { await db.exec('reset role') }
}
function espera(nome, r, deveDarCerto, trecho) {
  const passou = r.ok === deveDarCerto && (!trecho || (r.erro ?? '').includes(trecho))
  if (!passou) falhas++
  console.log(`${passou ? 'PASSOU' : 'FALHOU'} · ${nome}${r.ok ? '' : ` → "${r.erro}"`}`)
}
const status = async (lead) => (await db.query(`select status from public.transacoes where lead_id = $1`, [lead])).rows[0]?.status
const tx = async (lead) => (await db.query(`select id from public.transacoes where lead_id = $1`, [lead])).rows[0]?.id

// --- Consultor não aprova sozinho e valor trava ---
const semValor = await lead(null)
espera('contrato sem valor é bloqueado', await como('c1', `update public.leads set etapa='contrato' where id=$1`, [semValor]), false, 'valor da adesão')
const L = await lead(1000)
espera('consultor emite contrato', await como('c1', `update public.leads set etapa='contrato' where id=$1`, [L]), true)
espera('consultor não muda valor depois do contrato', await como('c1', `update public.leads set valor_adesao=5000 where id=$1`, [L]), false, 'trava')
espera('consultor move para custódia', await como('c1', `update public.leads set etapa='custodia' where id=$1`, [L]), true)
espera('consultor move para entrevista', await como('c1', `update public.leads set etapa='entrevista' where id=$1`, [L]), true)
espera('consultor NÃO marca Verdinho', await como('c1', `update public.leads set etapa='aprovado' where id=$1`, [L]), false, 'Só o admin')
espera('consultor NÃO reprova', await como('c1', `update public.leads set etapa='reprovado' where id=$1`, [L]), false, 'Só o admin')
espera('consultor NÃO encerra lead em custódia', await como('c1', `update public.leads set etapa='perdido' where id=$1`, [L]), false, 'custódia')
espera('indicador não chama função de admin', await como('i1', `select public.admin_resultado_entrevista($1, true)`, [await tx(L)]), false, 'Apenas admin')
espera('admin corrige valor antes do Verdinho', await como('admin', `select public.admin_corrigir_valor($1, 1200)`, [L]), true)
const bruto = (await db.query(`select bruto from public.transacoes where lead_id=$1`, [L])).rows[0].bruto
espera(`bruto acompanha a correção (${bruto})`, { ok: Number(bruto) === 1200 }, true)
espera('admin marca Verdinho', await como('admin', `select public.admin_resultado_entrevista($1, true)`, [await tx(L)]), true)
espera(`status virou verdinho (${await status(L)})`, { ok: (await status(L)) === 'verdinho' }, true)
espera('consultor não tira do Verdinho', await como('c1', `update public.leads set etapa='negociacao' where id=$1`, [L]), false, 'Só o admin')

// --- Saque passa pelo admin e não sai em dobro ---
espera('saque sem chave Pix é bloqueado', await como('i1', `select * from public.solicitar_saque()`), false, 'chave Pix')
await como('i1', `update public.profiles set chave_pix='i1@pix' where id=auth.uid()`)
const s1 = await como('i1', `select * from public.solicitar_saque()`)
espera(`indicador solicita saque (valor ${s1.rows?.[0]?.valor}, status ${s1.rows?.[0]?.status})`, s1, true)
espera('saque nasce "solicitado"', { ok: s1.rows?.[0]?.status === 'solicitado' }, true)
espera(`comissão fica em_saque (${await status(L)})`, { ok: (await status(L)) === 'em_saque' }, true)
espera('segundo pedido não acha nada (sem saque em dobro)', await como('i1', `select * from public.solicitar_saque()`), false, 'Nenhuma comissão')
const qtdSaques = (await db.query(`select count(*)::int n from public.saques where indicador_id=$1`, [u.i1])).rows[0].n
espera(`só existe 1 saque (${qtdSaques})`, { ok: qtdSaques === 1 }, true)
espera('indicador não paga o próprio saque', await como('i1', `select public.admin_pagar_saque($1)`, [s1.rows[0].id]), false, 'Apenas admin')
espera('indicador não altera saque direto na tabela', await como('i1', `update public.saques set status='pago' where id=$1`, [s1.rows[0].id]), false)
espera('admin vê o saque na lista', await como('admin', `select * from public.admin_saques()`), true)
espera('recusa sem motivo é bloqueada', await como('admin', `select public.admin_recusar_saque($1, '')`, [s1.rows[0].id]), false, 'motivo')
espera('admin recusa o saque', await como('admin', `select public.admin_recusar_saque($1, 'Chave Pix errada')`, [s1.rows[0].id]), true)
espera(`comissão volta a verdinho (${await status(L)})`, { ok: (await status(L)) === 'verdinho' }, true)
const s2 = await como('i1', `select * from public.solicitar_saque()`)
espera('indicador pede de novo', s2, true)
espera('admin paga', await como('admin', `select public.admin_pagar_saque($1)`, [s2.rows[0].id]), true)
espera(`comissão repassada (${await status(L)})`, { ok: (await status(L)) === 'repassado' }, true)
espera('pagar duas vezes é bloqueado', await como('admin', `select public.admin_pagar_saque($1)`, [s2.rows[0].id]), false, 'não está aguardando')
espera('consultor não mexe em lead já pago', await como('c1', `update public.leads set etapa='entrevista' where id=$1`, [L]), false)
espera('admin não corrige valor de lead já pago', await como('admin', `select public.admin_corrigir_valor($1, 9999)`, [L]), false, 'sacada')

// --- Pagamento direto pelo admin (liberar_comissao) ---
const L2 = await lead(800, 'novo')
await como('c1', `update public.leads set etapa='entrevista' where id=$1`, [L2])
await como('admin', `select public.admin_resultado_entrevista($1, true)`, [await tx(L2)])
espera('admin paga direto (liberar_comissao)', await como('admin', `select public.liberar_comissao($1)`, [await tx(L2)]), true)
const st2 = (await db.query(`select s.status from public.saques s join public.transacoes t on t.saque_id = s.id where t.lead_id=$1`, [L2])).rows[0]?.status
espera(`saque direto já nasce pago (${st2})`, { ok: st2 === 'pago' }, true)
espera('admin reprova outro lead', await (async () => { const L3 = await lead(500); await como('c1', `update public.leads set etapa='custodia' where id=$1`, [L3]); return como('admin', `select public.admin_resultado_entrevista($1, false)`, [await tx(L3)]) })(), true)

// --- Atribuição e PJ ---
const L4 = (await db.query(`insert into public.leads (consultor_id, nome) values ($1, 'Sem Codigo') returning id`, [u.c1])).rows[0].id
espera('consultor não atribui a indicador de outro consultor', await como('c1', `select public.confirmar_atribuicao($1, $2)`, [L4, k2.codigo]), false, 'outro consultor')
espera('consultor atribui a indicador próprio', await como('c1', `select public.confirmar_atribuicao($1, $2)`, [L4, k1.codigo]), true)
espera('admin atribui a qualquer indicador', await como('admin', `select public.confirmar_atribuicao($1, $2)`, [L4, k2.codigo]), true)
espera('consultor não mexe em lead de outro consultor', await como('c2', `select public.confirmar_atribuicao($1, $2)`, [L, k2.codigo]), false, 'não encontrado')
const tpj = (await db.query(`select tipo_pessoa from public.profiles where id=$1`, [u.ipj])).rows[0].tipo_pessoa
espera(`cadastro PJ com CNPJ inválido entra como PF (${tpj})`, { ok: tpj === 'PF' }, true)
espera('indicador não vira PJ sem CNPJ', await como('i1', `update public.profiles set tipo_pessoa='PJ' where id=auth.uid()`), false, 'CNPJ válido')
espera('CNPJ com dígito errado é recusado', await como('i1', `update public.profiles set tipo_pessoa='PJ', documento='11.222.333/0001-82' where id=auth.uid()`), false, 'CNPJ válido')
espera('indicador vira PJ com CNPJ válido', await como('i1', `update public.profiles set tipo_pessoa='PJ', documento='11.222.333/0001-81' where id=auth.uid()`), true)
espera('PJ não troca o CNPJ por um inválido', await como('i1', `update public.profiles set documento='123' where id=auth.uid()`), false, 'CNPJ válido')
espera('indicador volta para PF livremente', await como('i1', `update public.profiles set tipo_pessoa='PF' where id=auth.uid()`), true)
espera('indicador continua sem poder se promover a admin', await como('i1', `update public.profiles set papel='admin' where id=auth.uid()`), false)

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\nTodos os testes passaram')
process.exit(falhas ? 1 : 0)
