// Roda todas as migrações num Postgres local (PGlite, sem tocar no Supabase) e testa as regras do modelo
// de 27/10/2026: consultor cadastra lead e registra venda, filiação com limite de vagas, temperatura,
// LGPD do indicador e PJ com CNPJ válido. A plataforma não movimenta dinheiro. Uso: npm run test:banco
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
create schema cron;
create function cron.schedule(a text, b text, c text) returns bigint language sql as $$ select 1::bigint $$;
create function cron.unschedule(a text) returns boolean language sql as $$ select true $$;
`)

const ate = ateArg ?? 'zzzz'
for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
  if (f > ate) continue
  let sql = readFileSync(join(migDir, f), 'utf8').replace(/create extension if not exists pg_cron;/g, '')
  try { await db.exec(sql) } catch (e) { console.log(`FALHOU migração ${f}: ${e.message}`); process.exit(1) }
  console.log(`ok migração ${f}`)
}

const u = {}
const um0 = async (sql, params = []) => (await db.query(sql, params)).rows[0]
async function criar(nome, meta) {
  const r = await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [`${nome}@t.st`, meta])
  u[nome] = r.rows[0].id
}
await criar('admin', {})
await db.query(`update public.profiles set papel = 'admin' where id = $1`, [u.admin])
await criar('c1', { papel: 'consultor', nome: 'Cons 1' })
await criar('c2', { papel: 'consultor', nome: 'Cons 2' })
await criar('c3', { papel: 'consultor', nome: 'Cons 3 (não aprovado)' })
// Consultor novo nasce sem aprovação: sem ela não entra na vitrine nem recebe indicadores.
const aprovado0 = (await um0(`select aprovado from public.consultores where id = $1`, [u.c1])).aprovado
await db.query(`update public.consultores set aprovado = true where id in ($1, $2)`, [u.c1, u.c2])
await criar('i1', { nome: 'Ind 1', consultor_id: u.c1 })
await criar('i2', { nome: 'Ind 2', consultor_id: u.c2 })
await criar('ipj', { nome: 'Ind PJ', consultor_id: u.c1, tipo_pessoa: 'PJ', documento: '123' })
const canal = async (ind) => (await db.query(`select id, codigo from public.canais where indicador_id = $1`, [ind])).rows[0]
const k1 = await canal(u.i1), k2 = await canal(u.i2)

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
const sim = (cond) => ({ ok: !!cond })
const um = async (sql, params = []) => (await db.query(sql, params)).rows[0]
const hoje = (await um(`select current_date::text as d`)).d

// --- Nada de dinheiro, robô ou reengajamento no banco ---
const existe = async (nome) => (await um(`select to_regclass($1) as r`, [nome])).r
espera('tabela de saques não existe mais', sim(!(await existe('public.saques'))), true)
espera('tabela de transações (custódia) não existe mais', sim(!(await existe('public.transacoes'))), true)
const funcs = (await db.query(`select proname from pg_proc where proname in ('solicitar_saque','liberar_comissao','registrar_lead_whatsapp','reengajar_vencidos','extrato_indicador')`)).rows
espera(`funções de saque/comissão/robô removidas (${funcs.map((f) => f.proname).join(', ') || 'nenhuma'})`, sim(funcs.length === 0), true)
const colunas = (await db.query(`select column_name from information_schema.columns where (table_name = 'leads' and column_name in ('triagem','abandonou_em','reengajado_em','desconto_pct')) or (table_name = 'profiles' and column_name = 'chave_pix')`)).rows
espera('colunas de robô, recuperação, desconto e chave Pix removidas', sim(colunas.length === 0), true)

// --- Consultor cadastra lead ---
const novo = await como('c1', `select public.criar_lead('Cliente Teste da Silva', '(19) 99999-0000', $1) as id`, [k1.codigo])
espera('consultor cadastra lead com código do próprio indicador', novo, true)
const L = novo.rows?.[0]?.id
espera('consultor não cadastra lead com código de indicador de outro consultor', await como('c1', `select public.criar_lead('Outro', null, $1)`, [k2.codigo]), false, 'outro consultor')
espera('consultor cadastra lead sem código', await como('c1', `select public.criar_lead('Sem Codigo', null, null)`), true)
espera('indicador não cadastra lead', await como('i1', `select public.criar_lead('X', null, null)`), false, 'Apenas consultores')
espera('consultor move o lead livremente no CRM', await como('c1', `update public.leads set etapa = 'negociacao' where id = $1`, [L]), true)
const semCod = (await um(`select id from public.leads where nome = 'Sem Codigo'`)).id
espera('consultor não atribui lead a indicador de outro consultor', await como('c1', `select public.confirmar_atribuicao($1, $2)`, [semCod, k2.codigo]), false, 'outro consultor')
espera('consultor atribui lead a indicador próprio', await como('c1', `select public.confirmar_atribuicao($1, $2)`, [semCod, k1.codigo]), true)
espera('admin atribui a qualquer indicador', await como('admin', `select public.confirmar_atribuicao($1, $2)`, [semCod, k2.codigo]), true)

// --- Registrar venda ---
const t0 = (await um(`select temperatura from public.consultores where id = $1`, [u.c1])).temperatura
const reg = (status, valor = 1000, codigo = k1.codigo, quem = 'c1', lead = L, data = hoje, bonif = null) =>
  como(quem, `select public.registrar_venda($1, 'Cliente', $2, $3, $4::date, $5, $6) as id`, [lead, codigo, valor, data, status, bonif])
espera('venda sem valor é bloqueada', await reg('aguardando_entrevista', 0), false, 'valor')
espera('venda com data no futuro é bloqueada', await reg('aguardando_entrevista', 1000, k1.codigo, 'c1', L, '2999-01-01'), false, 'futuro')
espera('venda com status inválido é bloqueada', await reg('verdinho'), false, 'Status inválido')
espera('venda com código de outro consultor é bloqueada', await reg('aguardando_entrevista', 1000, k2.codigo), false, 'outro consultor')
espera('outro consultor não registra venda no lead', await reg('aguardando_entrevista', 1000, k2.codigo, 'c2'), false, 'não encontrado')
espera('indicador não registra venda', await reg('aprovado', 1000, k1.codigo, 'i1'), false, 'não encontrado')
espera('indicador não grava direto na tabela de vendas', await como('i1', `insert into public.vendas (consultor_id, cliente, valor_adesao, data_venda, status) values ($1, 'X', 1, current_date, 'aprovado')`, [u.c1]), false)
const r1 = await reg('aguardando_entrevista', 1000)
espera('consultor registra venda aguardando entrevista', r1, true)
const etapa = async () => (await um(`select etapa from public.leads where id = $1`, [L])).etapa
espera(`lead vai para Entrevista de saúde (${await etapa()})`, sim((await etapa()) === 'entrevista'), true)
espera('venda aguardando não conta como venda aprovada', sim((await um(`select vendas from public.consultores where id = $1`, [u.c1])).vendas === 0), true)
const r2 = await reg('aprovado', 1200)
espera('consultor atualiza a venda para aprovada no Verdinho', r2, true)
espera('continua uma venda só por lead', sim(r1.rows?.[0]?.id === r2.rows?.[0]?.id && (await um(`select count(*)::int n from public.vendas where lead_id = $1`, [L])).n === 1), true)
espera('lead vai para Aprovado', sim((await etapa()) === 'aprovado'), true)
const c1 = await um(`select vendas, vendas_30d, temperatura from public.consultores where id = $1`, [u.c1])
espera(`venda aprovada conta nas métricas (vendas ${c1.vendas}, 30d ${c1.vendas_30d})`, sim(c1.vendas === 1 && c1.vendas_30d === 1), true)
espera(`temperatura sobe com venda aprovada (${t0} → ${c1.temperatura})`, sim(c1.temperatura > t0), true)

// --- Indicador vê as vendas dele (LGPD) e a estimativa ---
const vi = await como('i1', `select * from public.vendas_indicador()`)
const v = vi.rows?.[0]
espera('indicador vê a venda registrada com o código dele', sim(vi.ok && vi.rows.length === 1 && v.status === 'aprovado'), true)
espera(`estimativa = (valor − imposto PF) × 50% (${v?.estimativa})`, sim(Number(v?.estimativa) === Math.round(1200 * (1 - 27.5 / 100) * 0.5 * 100) / 100), true)
espera('venda não traz telefone nem CPF do cliente', sim(v && !('telefone' in v) && !('cpf' in v) && v.cliente === 'Cliente'), true)
espera('outro indicador não vê essa venda', sim((await como('i2', `select * from public.vendas_indicador()`)).rows.length === 0), true)
espera('indicador não lê a tabela de leads', sim((await como('i1', `select * from public.leads`)).rows.length === 0), true)
espera('indicador não lê a tabela de vendas direto', sim((await como('i1', `select * from public.vendas`)).rows.length === 0), true)
espera('consultor vê quanto repassar a cada indicador', sim(Number((await como('c1', `select a_repassar from public.meus_indicadores() where id = $1`, [u.i1])).rows[0]?.a_repassar) === 435), true)
espera('venda aprovada sem bonificação usa a padrão (100%)', sim(Number((await um(`select bonificacao_pct from public.vendas where lead_id = $1`, [L])).bonificacao_pct) === 100), true)
await db.query(`update public.config_split set aliquota_pf = 10 where id = 1`)
const guardada = (await como('i1', `select estimativa from public.vendas_indicador()`)).rows[0].estimativa
espera(`mudar o imposto não muda venda já registrada (${guardada})`, sim(Number(guardada) === 435), true)
await db.query(`update public.config_split set aliquota_pf = 27.5 where id = 1`)
espera('bonificação acima de 1000% é bloqueada', await reg('aprovado', 1200, k1.codigo, 'c1', L, hoje, 2000), false, 'bonificação')

// --- Split do exemplo do Eduardo (31/10/2026) ---
// PF, R$ 400, bonificação 100%: líquido 290 → indicador 145; bolo 145 + 290 = 435 → consultor 217,50 e Geralindica 217,50.
await reg('aprovado', 400, k1.codigo, 'c1', L, hoje, 100)
const ex = (await como('admin', `select * from public.admin_vendas() where cliente = 'Cliente' and consultor = 'Cons 1'`)).rows?.[0]
espera(`exemplo PF R$ 400: indicador 145 e Geralindica 217,50 (${ex?.estimativa_indicador} / ${ex?.estimativa_geralindica})`,
  sim(Number(ex?.estimativa_indicador) === 145 && Number(ex?.estimativa_geralindica) === 217.5 && Number(ex?.aliquota) === 27.5), true)
const sp = await um(`select * from private.split_venda(400, 27.5, 100)`)
espera(`consultor fica com 217,50 (${sp.consultor})`, sim(Number(sp.consultor) === 217.5 && Number(sp.bonificacao) === 290), true)
const pj = await um(`select * from private.split_venda(400, 6, 100)`)
espera(`PJ 6%: indicador 188, consultor e Geralindica 282 cada (${pj.indicador} / ${pj.consultor} / ${pj.geralindica})`,
  sim(Number(pj.indicador) === 188 && Number(pj.consultor) === 282 && Number(pj.geralindica) === 282), true)
espera('consultor vira PJ com CNPJ válido', await como('c2', `update public.profiles set tipo_pessoa = 'PJ', documento = '11.222.333/0001-81' where id = auth.uid()`), true)
espera('consultor escolhe a faixa 2 do PJ', await como('c2', `update public.consultores set faixa_pj = 2 where id = auth.uid()`), true)
espera('consultor PJ faixa 2 paga 15,5%', sim(Number((await um(`select private.aliquota_consultor($1) a`, [u.c2])).a) === 15.5), true)
espera('faixa do PJ só 1 ou 2', await como('c2', `update public.consultores set faixa_pj = 3 where id = auth.uid()`), false)

// --- QR Code abre o WhatsApp do consultor ---
const zap = async () => (await como(null, `select * from public.registrar_escaneamento($1)`, [k1.codigo])).rows?.[0]?.whatsapp
const geral = (await um(`select whatsapp_numero from public.config_split where id = 1`)).whatsapp_numero
espera(`consultor sem telefone: QR usa o número geral (${await zap()})`, sim((await zap()) === geral), true)
await como('c1', `update public.profiles set telefone = '(19) 98888-7777' where id = auth.uid()`)
espera(`QR abre o WhatsApp do consultor (${await zap()})`, sim((await zap()) === '5519988887777'), true)
espera('indicador fala com o próprio consultor', sim((await como('i1', `select public.whatsapp_meu_consultor() z`)).rows?.[0]?.z === '5519988887777'), true)
espera('QR com código inexistente não abre nada', sim((await como(null, `select * from public.registrar_escaneamento('NAOEXISTE')`)).rows.length === 0), true)

await reg('reprovado', 1200)
espera('venda reprovada não gera valor a receber', sim(Number((await como('i1', `select estimativa from public.vendas_indicador()`)).rows[0].estimativa) === 0), true)
espera('venda reprovada sai das métricas', sim((await um(`select vendas from public.consultores where id = $1`, [u.c1])).vendas === 0), true)

// --- Admin só acompanha ---
espera('admin vê as vendas registradas', await como('admin', `select * from public.admin_vendas()`), true)
espera('consultor não usa a lista do admin', await como('c1', `select * from public.admin_vendas()`), false, 'Apenas admin')
espera('admin configura o split', await como('admin', `update public.config_split set aliquota_pf = 10, pct_consultor_restante = null where id = 1`), true)
espera('indicador não mexe no split', sim((await como('i1', `update public.config_split set pct_indicador = 90 where id = 1 returning id`)).rows?.length !== 1), true)

// --- Filiação e limite de vagas ---
espera('consultor não muda o próprio limite de vagas', await como('c2', `select public.definir_limite_vagas($1, 30)`, [u.c2]), false, 'Apenas admin')
espera('admin reduz o limite (nunca abaixo da ocupação)', await como('admin', `select public.definir_limite_vagas($1, 0)`, [u.c2]), true)
espera('limite ficou na ocupação (1)', sim((await um(`select max_indicadores from public.consultores where id = $1`, [u.c2])).max_indicadores === 1), true)
espera('indicador não se filia a consultor lotado', await como('i1', `update public.indicadores set consultor_id = $1 where id = auth.uid()`, [u.c2]), false, 'vagas')
await como('admin', `select public.definir_limite_vagas($1, 30)`, [u.c2])
espera('indicador se filia a consultor com vaga', await como('i1', `update public.indicadores set consultor_id = $1 where id = auth.uid()`, [u.c2]), true)
espera('ocupação acompanha a troca', sim((await um(`select ocupacao from public.consultores where id = $1`, [u.c2])).ocupacao === 2), true)
espera('indicador não mexe na temperatura do consultor', sim((await como('i1', `update public.consultores set temperatura = 100 where id = $1 returning id`, [u.c2])).ok === false), true)

// --- Temperatura pela avaliação ---
const antes = (await um(`select temperatura from public.consultores where id = $1`, [u.c2])).temperatura
espera('indicador avalia o seu consultor', await como('i1', `insert into public.avaliacoes (consultor_id, indicador_id, estrelas, texto, autor) values ($1, auth.uid(), 5, 'Ótimo', 'x')`, [u.c2]), true)
const depois = (await um(`select temperatura from public.consultores where id = $1`, [u.c2])).temperatura
espera(`avaliação 5★ esquenta a temperatura (${antes} → ${depois})`, sim(depois > antes), true)
espera('indicador não avalia consultor de outra carteira', await como('i1', `insert into public.avaliacoes (consultor_id, indicador_id, estrelas, texto, autor) values ($1, auth.uid(), 1, 'x', 'x')`, [u.c1]), false)
const faixa = (await db.query(`select min(temperatura) mn, max(temperatura) mx from public.consultores`)).rows[0]
espera(`temperatura sempre entre 0 e 100 (${faixa.mn}–${faixa.mx})`, sim(faixa.mn >= 0 && faixa.mx <= 100), true)

// --- PJ ---
const tpj = (await um(`select tipo_pessoa from public.profiles where id = $1`, [u.ipj])).tipo_pessoa
espera(`cadastro PJ com CNPJ inválido entra como PF (${tpj})`, sim(tpj === 'PF'), true)
espera('indicador não vira PJ sem CNPJ', await como('i2', `update public.profiles set tipo_pessoa = 'PJ' where id = auth.uid()`), false, 'CNPJ válido')
espera('CNPJ com dígito errado é recusado', await como('i2', `update public.profiles set tipo_pessoa = 'PJ', documento = '11.222.333/0001-82' where id = auth.uid()`), false, 'CNPJ válido')
espera('indicador vira PJ com CNPJ válido', await como('i2', `update public.profiles set tipo_pessoa = 'PJ', documento = '11.222.333/0001-81' where id = auth.uid()`), true)
espera('indicador volta para PF livremente', await como('i2', `update public.profiles set tipo_pessoa = 'PF' where id = auth.uid()`), true)
espera('indicador não se promove a admin', await como('i2', `update public.profiles set papel = 'admin' where id = auth.uid()`), false)

// --- Contratos do Luis: indicador assina com o consultor, consultor com a Geralindica (Gov.br, por etapas) ---
await criar('igov', { nome: 'Ind Gov', consultor_id: u.c1, contrato_assinado_em: '2026-11-07T10:00:00Z', rg: '12.345.678-9', endereco: 'Rua A, 1 - Rio de Janeiro/RJ' })
const ctr = async (quem) => um(`select * from public.contratos where parte_id = $1 and etapa <> 'encerrado'`, [u[quem]])
const cg = await ctr('igov')
espera('indicador com consultor nasce com contrato para assinar', sim(cg && cg.tipo === 'indicador' && cg.consultor_id === u.c1 && cg.etapa === 'parte'), true)
espera('cadastro grava RG e endereço', sim((await um(`select rg, endereco from public.profiles where id = $1`, [u.igov])).rg === '12.345.678-9'), true)
espera('cadastro não consegue se marcar como assinado', sim((await um(`select contrato_assinado_em from public.profiles where id = $1`, [u.igov])).contrato_assinado_em === null), true)
espera('ninguém marca o próprio contrato como assinado', await como('igov', `update public.profiles set contrato_assinado_em = now() where id = auth.uid()`), false)
const dados = await como('igov', `select public.meu_contrato() d`)
espera('PDF recebe os dados do consultor (contratante)', sim(dados.ok && dados.rows[0].d?.consultor?.nome === 'Cons 1' && dados.rows[0].d?.parte?.rg === '12.345.678-9'), true)
espera('outro indicador não lê os dados desse contrato', await como('i2', `select public.contrato_dados($1)`, [cg.id]), false, 'não encontrado')
espera('consultor não assina antes do indicador', await como('c1', `select public.contrato_enviar($1, $2)`, [cg.id, `${u.c1}/c.pdf`]), false, 'ainda não assinou')
espera('não envia contrato na pasta de outra pessoa', await como('igov', `select public.contrato_enviar($1, $2)`, [cg.id, `${u.i1}/c.pdf`]), false, 'Arquivo inválido')
espera('só aceita PDF', await como('igov', `select public.contrato_enviar($1, $2)`, [cg.id, `${u.igov}/c.png`]), false, 'Arquivo inválido')
espera('indicador envia o PDF assinado', await como('igov', `select public.contrato_enviar($1, $2)`, [cg.id, `${u.igov}/contrato.pdf`]), true)
espera('vai para o consultor assinar', sim((await ctr('igov')).etapa === 'consultor'), true)
espera('consultor vê o contrato para assinar', sim((await como('c1', `select * from public.contratos_da_carteira() where id = $1`, [cg.id])).rows?.[0]?.etapa === 'consultor'), true)
await db.query('grant select on storage.objects to authenticated')
await db.query(`insert into storage.objects (bucket_id, name) values ('contratos', $1)`, [`${u.igov}/contrato.pdf`])
espera('consultor lê o PDF que o indicador assinou', sim((await como('c1', `select name from storage.objects where name = $1`, [`${u.igov}/contrato.pdf`])).rows?.length === 1), true)
espera('outro consultor não lê esse PDF', sim((await como('c2', `select name from storage.objects where name = $1`, [`${u.igov}/contrato.pdf`])).rows?.length === 0), true)
espera('admin não conclui antes do consultor assinar', await como('admin', `select public.admin_concluir_contrato($1)`, [cg.id]), false, 'ainda não está pronto')
espera('consultor devolve para o indicador assinar de novo', await como('c1', `select public.contrato_recusar($1, 'Faltou a assinatura')`, [cg.id]), true)
espera('devolvido volta sem arquivo e com o motivo', sim((await ctr('igov')).etapa === 'parte' && (await ctr('igov')).observacao === 'Faltou a assinatura'), true)
await como('igov', `select public.contrato_enviar($1, $2)`, [cg.id, `${u.igov}/contrato-2.pdf`])
espera('consultor assina por cima', await como('c1', `select public.contrato_enviar($1, $2)`, [cg.id, `${u.c1}/contrato-igov.pdf`]), true)
espera('indicador não troca o arquivo depois que o consultor assinou', await como('igov', `select public.contrato_enviar($1, $2)`, [cg.id, `${u.igov}/x.pdf`]), false, 'não é a sua vez')
espera('indicador não conclui contrato', await como('igov', `select public.admin_concluir_contrato($1)`, [cg.id]), false, 'Apenas admin')
espera('admin conclui com a versão das testemunhas', await como('admin', `select public.admin_concluir_contrato($1, $2)`, [cg.id, `${u.admin}/final.pdf`]), true)
espera('contrato vigente e pessoa marcada como assinada', sim((await ctr('igov')).etapa === 'vigente' && (await um(`select contrato_assinado_em from public.profiles where id = $1`, [u.igov])).contrato_assinado_em), true)
espera('depois de vigente não troca o arquivo', await como('igov', `select public.contrato_enviar($1, $2)`, [cg.id, `${u.igov}/outro.pdf`]), false, 'já foi conferido')
const cc1 = await ctr('c1')
espera('consultor nasce com o contrato da Geralindica', sim(cc1 && cc1.tipo === 'consultor' && cc1.etapa === 'parte'), true)
await como('c1', `select public.contrato_enviar($1, $2)`, [cc1.id, `${u.c1}/meu.pdf`])
espera('contrato do consultor vai direto para a Geralindica', sim((await ctr('c1')).etapa === 'geralindica'), true)
espera('consultor envia comprovante de habilitação', await como('c1', `select public.enviar_habilitacao($1)`, [`${u.c1}/habilitacao.jpg`]), true)
espera('indicador não envia habilitação', await como('i1', `select public.enviar_habilitacao($1)`, [`${u.i1}/h.pdf`]), false, 'Apenas consultores')
espera('admin configura as testemunhas', await como('admin', `update public.config_contrato set testemunha1_nome = 'Testemunha Um' where id = 1`), true)
espera('indicador não lê a configuração das testemunhas direto', sim((await como('i1', `select * from public.config_contrato`)).rows?.length === 0), true)
espera('testemunha sai no PDF', sim((await como('igov', `select public.meu_contrato() d`)).rows[0].d?.testemunhas?.[0]?.nome === 'Testemunha Um'), true)
espera('lista do admin mostra a etapa do contrato', sim((await como('admin', `select contrato_etapa from public.admin_indicadores() where id = $1`, [u.igov])).rows[0]?.contrato_etapa === 'vigente'), true)
// Trocou de consultor: o contrato antigo se encerra e nasce outro, com o novo consultor.
await como('igov', `update public.indicadores set consultor_id = $1 where id = auth.uid()`, [u.c2])
const cg2 = await ctr('igov')
espera('troca de consultor gera contrato novo com o novo consultor', sim(cg2 && cg2.id !== cg.id && cg2.consultor_id === u.c2 && cg2.etapa === 'parte'), true)
espera('e a pessoa volta a ficar sem contrato assinado', sim((await um(`select contrato_assinado_em from public.profiles where id = $1`, [u.igov])).contrato_assinado_em === null), true)
espera('contrato antigo fica encerrado', sim((await um(`select etapa from public.contratos where id = $1`, [cg.id])).etapa === 'encerrado'), true)

// --- Regras de dinheiro dos contratos (o i1 já foi para o c2: aqui é o ipj, da carteira do c1) ---
const kpj = await canal(u.ipj)
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d))
await db.query(`update public.config_split set aliquota_pf = 27.5, pct_consultor_restante = 50 where id = 1`)
const Lv = (await como('c1', `select public.criar_lead('Lead Velho', null, $1) as id`, [kpj.codigo])).rows[0].id
await db.query(`update public.leads set created_at = now() - interval '120 days' where id = $1`, [Lv])
await como('c1', `select public.registrar_venda($1, 'Velho', $2, 1000, current_date, 'aprovado', 100)`, [Lv, kpj.codigo])
const vv = (await como('ipj', `select * from public.vendas_indicador() where cliente = 'Velho'`)).rows?.[0]
espera(`lead antigo (120 dias) continua pagando o indicador: sem prazo de validade (${vv?.estimativa})`, sim(vv && Number(vv.estimativa) === 362.5), true)
espera('vendas não têm mais status de estorno', await como('c1', `select public.registrar_venda($1, 'Velho', $2, 1000, current_date, 'estornado', 100)`, [Lv, kpj.codigo]), false, 'Status inválido')
const Ln = (await como('c1', `select public.criar_lead('Lead Novo', null, $1) as id`, [kpj.codigo])).rows[0].id
const vn = (await como('c1', `select public.registrar_venda($1, 'Novo', $2, 1000, current_date, 'aprovado', 100) as id`, [Ln, kpj.codigo])).rows[0].id
const exC = (await como('admin', `select estimativa_indicador i, estimativa_geralindica g from public.admin_vendas() where id = $1`, [vn])).rows[0]
espera(`exemplo do contrato: indicador 362,50 e Geralindica 543,75 (${exC.i} / ${exC.g})`, sim(Number(exC.i) === 362.5 && Number(exC.g) === 543.75), true)
espera('consultor marca o Pix do indicador', await como('c1', `select public.marcar_indicador_pago($1, true)`, [vn]), true)
espera('indicador vê que foi pago', sim((await como('ipj', `select indicador_pago_em from public.vendas_indicador() where venda_id = $1`, [vn])).rows[0].indicador_pago_em), true)
espera('outro consultor não marca pagamento', await como('c2', `select public.marcar_indicador_pago($1, true)`, [vn]), false, 'não encontrada')
espera('consultor registra comissão recorrente', await como('c1', `select public.registrar_recebimento($1, 200, current_date, 'Parcela 2')`, [vn]), true)
const mesAtual = (await como('c1', `select * from public.fechamentos()`)).rows?.[0]
// 543,75 (venda) + 543,75 (lead velho) + 200 × 72,5% × 50% = 72,50
espera(`fechamento do mês soma vendas e recorrentes (${mesAtual?.valor})`, sim(Number(mesAtual?.valor) === 543.75 + 543.75 + 72.5), true)
espera(`fechamento vence no dia 5 do mês seguinte (${iso(mesAtual?.vencimento)})`, sim(iso(mesAtual?.vencimento).endsWith('-05')), true)
espera('consultor não vê o fechamento de outro', sim((await como('c1', `select * from public.fechamentos($1)`, [u.c2])).rows.every((r) => r.consultor_id === u.c1)), true)
espera('indicador não vê fechamentos', await como('i1', `select * from public.fechamentos()`), false, 'Apenas consultores')
espera('troca de plano em até 10 anos', await como('c1', `select public.registrar_troca_plano($1, 800, current_date, 'aprovado', 100)`, [vn]), true)
const trocas = (await como('ipj', `select * from public.vendas_indicador() where tipo = 'troca_plano'`)).rows
espera(`indicador recebe de novo na troca de plano (${trocas[0]?.estimativa})`, sim(trocas.length === 1 && Number(trocas[0].estimativa) === 290), true)
espera('troca de plano não conta como venda nova na temperatura', sim((await um(`select vendas from public.consultores where id = $1`, [u.c1])).vendas === 2), true)
espera('troca depois de 10 anos é bloqueada', await como('c1', `select public.registrar_troca_plano($1, 800, (current_date + interval '11 years')::date, 'aprovado', 100)`, [vn]), false)
espera('não existe mais função de estorno', sim(!(await um(`select to_regproc('public.estornar_venda') r`)).r), true)
await db.query(`update public.vendas set aprovado_em = now() - interval '70 days' where id = $1`, [(await um(`select id from public.vendas where lead_id = $1`, [Lv])).id])
const atrasado = (await como('c1', `select * from public.fechamentos()`)).rows.find((r) => r.dias_atraso > 0)
espera(`mês vencido sem pagamento cobra 1% ao dia (${atrasado?.dias_atraso} dias, juros ${atrasado?.juros})`, sim(atrasado && Number(atrasado.valor) === 543.75 && Number(atrasado.juros) === Math.round(543.75 * 0.01 * atrasado.dias_atraso * 100) / 100), true)
espera('consultor não registra o próprio pagamento', await como('c1', `select public.admin_registrar_fechamento($1, $2, current_date, 543.75)`, [u.c1, iso(atrasado?.mes)]), false, 'Apenas admin')
espera('admin registra o pagamento do mês', await como('admin', `select public.admin_registrar_fechamento($1, $2, $3, 543.75)`, [u.c1, iso(atrasado?.mes), iso(atrasado?.vencimento)]), true)
espera('pago no dia não tem juros', sim(Number((await como('c1', `select juros from public.fechamentos() where mes = $1`, [iso(atrasado?.mes)])).rows[0].juros) === 0), true)
const rel = await como('ipj', `select * from public.relatorio_indicador()`)
espera('indicador vê o relatório mensal das indicações', sim(rel.ok && rel.rows.length >= 1), true)

// --- Chat interno com robô (cláusula 6.4) ---
const msg = (quem, ind, texto, cons = u.c1) => como(quem, `select public.enviar_mensagem($1, $2, $3) r`, [cons, ind, texto])
const r0 = await msg('ipj', u.ipj, 'Oi! Quando cai o Pix da venda da Ana?')
espera('indicador fala com o próprio consultor', sim(r0.ok && r0.rows[0].r.ok === true), true)
const conta = await msg('c1', u.ipj, 'Me passa banco, agência e conta: Banco 341, ag 1234, conta 56789-0')
espera('pode falar de conta corrente', sim(conta.ok && conta.rows[0].r.ok === true), true)
for (const [texto, motivo] of [
  ['me chama no (21) 98466-5584', 'telefone'], ['meu numero 21984665584', 'telefone'], ['nove oito quatro seis seis cinco cinco oito', 'telefone escrito por extenso'],
  ['manda no meu email joao@gmail.com', 'e-mail'], ['me segue no insta @joaosilva', 'rede social ou outro aplicativo'], ['chama no zap', 'rede social ou outro aplicativo'],
  ['eu sou motorista de uber', 'profissão'], ['eu divulgo no meu salão', 'como você faz as indicações'], ['olha www.site.com', 'link'],
]) {
  const r = await msg('ipj', u.ipj, texto)
  espera(`robô barra "${texto}" (${r.rows?.[0]?.r?.motivo ?? r.erro})`, sim(r.ok && r.rows[0].r.ok === false && r.rows[0].r.motivo === motivo), true)
}
espera('mensagem barrada não é entregue', sim((await um(`select count(*)::int n from public.mensagens where texto like '%98466%'`)).n === 0), true)
espera('mensagem barrada vira alerta para o admin', sim((await como('admin', `select * from public.admin_chat_alertas()`)).rows.length >= 9), true)
espera('indicador não lê alertas', await como('i1', `select * from public.admin_chat_alertas()`), false, 'Apenas admin')
espera('outro indicador não escreve nessa conversa', await msg('i2', u.ipj, 'oi'), false, 'não encontrada')
espera('outro indicador não lê a conversa', sim((await como('i2', `select * from public.mensagens where indicador_id = $1`, [u.ipj])).rows.length === 0), true)
espera('indicador não escreve para consultor de outra carteira', await msg('ipj', u.ipj, 'oi', u.c2), false, 'mesma carteira')
espera('indicador não grava direto na tabela', await como('i1', `insert into public.mensagens (consultor_id, indicador_id, autor_id, texto) values ($1, $2, $2, 'x')`, [u.c1, u.ipj]), false)
const convC = (await como('c1', `select * from public.minhas_conversas() where indicador_id = $1`, [u.ipj])).rows[0]
espera(`consultor vê a mensagem não lida (${convC?.nao_lidas})`, sim(Number(convC?.nao_lidas) === 1), true)
await como('c1', `select public.marcar_lidas($1, $2)`, [u.c1, u.ipj])
espera('lida zera o contador', sim(Number((await como('c1', `select nao_lidas from public.minhas_conversas() where indicador_id = $1`, [u.ipj])).rows[0].nao_lidas) === 0), true)
espera('consultor fala com a Geralindica (sem robô)', sim((await msg('c1', null, 'O cliente foi aprovado, me liga')).rows?.[0]?.r?.ok === true), true)
espera('admin responde na conversa da Geralindica', sim((await msg('admin', null, 'Recebido!')).rows?.[0]?.r?.ok === true), true)
const convAdm = (await como('admin', `select * from public.minhas_conversas() where indicador_id = $1`, [u.ipj])).rows[0]
espera('admin monitora a conversa do indicador, só leitura', sim(convAdm?.monitorada === true && convAdm?.pode_escrever === false), true)
espera('admin remove o indicador do site', await como('admin', `select public.admin_remover_usuario($1, 'Regras do chat')`, [u.i2]), true)
const i2 = await um(`select p.suspenso_em, i.consultor_id from public.profiles p join public.indicadores i on i.id = p.id where p.id = $1`, [u.i2])
espera('removido fica suspenso e sem consultor', sim(i2.suspenso_em && i2.consultor_id === null), true)
espera('suspenso não manda mensagem', await msg('i2', u.i2, 'oi', u.c2), false, 'suspensa')

// --- Aprovação do consultor pelo admin ---
espera('consultor novo nasce sem aprovação', sim(aprovado0 === false), true)
await criar('ic3', { nome: 'Ind do C3', consultor_id: u.c3 })
espera('cadastro com consultor não aprovado entra sem consultor', sim((await um(`select consultor_id from public.indicadores where id = $1`, [u.ic3])).consultor_id === null), true)
espera('indicador não entra na carteira de consultor não aprovado', await como('ic3', `update public.indicadores set consultor_id = $1 where id = auth.uid()`, [u.c3]), false, 'ainda não foi aprovado')
const vit = await como('i1', `select count(*)::int n from public.consultores where id = $1`, [u.c3])
espera('consultor não aprovado não aparece na vitrine', sim(vit.ok && vit.rows[0].n === 0), true)
espera('consultor não se aprova sozinho', await como('c3', `update public.consultores set aprovado = true where id = auth.uid()`), false)
espera('consultor não usa a função do admin', await como('c3', `select public.admin_aprovar_consultor(auth.uid(), true)`), false, 'Apenas admin')
espera('admin aprova o consultor', await como('admin', `select public.admin_aprovar_consultor($1, true)`, [u.c3]), true)
const vit2 = await como('i1', `select count(*)::int n from public.consultores where id = $1`, [u.c3])
espera('aprovado aparece na vitrine', sim(vit2.ok && vit2.rows[0].n === 1), true)
espera('indicador entra na carteira depois da aprovação', await como('ic3', `update public.indicadores set consultor_id = $1 where id = auth.uid()`, [u.c3]), true)

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\nTodos os testes passaram')
process.exit(falhas ? 1 : 0)
