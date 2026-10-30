-- Modelo novo (27/10/2026): a plataforma NÃO recebe, NÃO guarda e NÃO paga dinheiro.
-- O consultor recebe do cliente, segura até a entrevista de saúde (Verdinho), devolve se reprovado e,
-- se aprovado, manda o Pix ao indicador e à Geralindica por fora. Aqui ele só REGISTRA a venda.
-- 1. Nova tabela vendas (registradas pelo consultor) com os dados das transações antigas que eram vendas.
-- 2. Apaga custódia, saque e liberação de comissão: tabelas saques e transacoes, chave Pix e funções.
-- 3. Lead: a etapa muda livremente (sem trava de comissão); só histórico e métricas.
-- 4. Split só como configuração do admin (sem valores fixos no código). Valor do indicador = estimativa.
-- 5. PJ só com CNPJ válido (auditoria 23/10/2026: muda o imposto da estimativa).

-- ---------- 1. Vendas ----------
create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  consultor_id uuid not null references public.consultores(id) on delete cascade,
  lead_id uuid unique references public.leads(id) on delete set null,
  indicador_id uuid references public.indicadores(id) on delete set null,
  canal_id uuid references public.canais(id) on delete set null,
  cliente text not null check (char_length(cliente) between 1 and 60),  -- só o primeiro nome (LGPD)
  valor_adesao numeric(12,2) not null check (valor_adesao > 0),
  data_venda date not null,
  status text not null check (status in ('aguardando_entrevista','aprovado','reprovado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vendas_consultor_idx on public.vendas (consultor_id, data_venda desc);
create index vendas_indicador_idx on public.vendas (indicador_id, data_venda desc);
create index vendas_canal_idx on public.vendas (canal_id);

alter table public.vendas enable row level security;
create policy "vendas: consultor ou admin le" on public.vendas for select
  using (consultor_id = (select auth.uid()) or (select private.is_admin()));
-- Escrita só por registrar_venda(). O indicador lê pelas funções (sem dado pessoal do cliente).
revoke all on public.vendas from anon, authenticated;
grant select on public.vendas to authenticated;

-- Transações antigas que já eram venda (pagamento com o consultor, Verdinho ou reprovação).
insert into public.vendas (consultor_id, lead_id, indicador_id, canal_id, cliente, valor_adesao, data_venda, status, created_at, updated_at)
select l.consultor_id, l.id, l.indicador_id, l.canal_id, left(split_part(trim(l.nome), ' ', 1), 60), t.bruto, t.created_at::date,
  case when t.status in ('verdinho','repassado') then 'aprovado' when l.etapa = 'reprovado' then 'reprovado' else 'aguardando_entrevista' end,
  t.created_at, coalesce(t.liberado_em, t.created_at)
from public.transacoes t join public.leads l on l.id = t.lead_id
where t.bruto > 0 and (t.status in ('custodia','verdinho','repassado') or (t.status = 'estornado' and l.etapa = 'reprovado'));

-- ---------- 2. Custódia, saque e liberação de comissão ----------
drop function if exists public.solicitar_saque();
drop function if exists public.liberar_comissao(uuid);
drop function if exists public.extrato_indicador();
drop function if exists public.admin_transacoes();
drop function if exists public.admin_totais();
drop table public.transacoes;
drop table public.saques;
alter table public.profiles drop column chave_pix;

-- ---------- 3. Lead ----------
create or replace function private.tg_lead_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.etapa is distinct from old.etapa then new.updated_at := now(); end if;
  return new;
end $$;

create or replace function private.tg_lead_depois() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nomes jsonb := '{"novo":"Novo","triagem":"Em triagem","cotacao":"Cotação enviada","negociacao":"Negociação","contrato":"Contrato emitido","custodia":"Pagamento recebido","entrevista":"Entrevista de saúde","aprovado":"Aprovado (Verdinho)","reprovado":"Reprovado (devolvido)","perdido":"Perdido (desistiu)"}';
begin
  if tg_op = 'UPDATE' and new.etapa is distinct from old.etapa then
    insert into public.lead_eventos (lead_id, tipo, texto) values (new.id, 'sistema', 'Movido para ' || (v_nomes ->> new.etapa));
  end if;
  perform private.recalc_consultor(new.consultor_id);
  if tg_op = 'UPDATE' and old.consultor_id is distinct from new.consultor_id then perform private.recalc_consultor(old.consultor_id); end if;
  return null;
end $$;

-- Métricas do consultor: "vendas" agora são as vendas aprovadas que ele registrou.
create or replace function private.recalc_consultor(p uuid) returns void
language sql security definer set search_path = public as $$
  update public.consultores c set
    vendas      = (select count(*) from public.vendas where consultor_id = p and status = 'aprovado'),
    leads_total = (select count(*) from public.leads where consultor_id = p),
    vendas_30d  = (select count(*) from public.vendas where consultor_id = p and status = 'aprovado' and data_venda > current_date - 30),
    ocupacao    = (select count(*) from public.indicadores where consultor_id = p)
  where c.id = p;
$$;

-- ---------- 4. Split: só configuração ----------
-- Decidido: 50% do líquido para o indicador. Ainda em aberto: imposto e a divisão consultor x Geralindica.
-- Nada de valor padrão escrito aqui: o admin preenche em Admin → Split (vazio = "a definir").
alter table public.config_split
  alter column aliquota_pf drop default, alter column aliquota_pf drop not null,
  alter column aliquota_pj drop default, alter column aliquota_pj drop not null,
  alter column pct_indicador drop default,
  alter column pct_consultor_restante drop default, alter column pct_consultor_restante drop not null;
alter table public.config_split
  add constraint config_split_aliquotas_check check ((aliquota_pf is null or aliquota_pf between 0 and 100) and (aliquota_pj is null or aliquota_pj between 0 and 100)),
  add constraint config_split_pcts_check check (pct_indicador between 0 and 100 and (pct_consultor_restante is null or pct_consultor_restante between 0 and 100));

-- O simulador da página inicial (sem login) usa os mesmos percentuais. Não há nada sigiloso aqui.
drop policy if exists "config: leitura logado" on public.config_split;
create policy "config: leitura publica" on public.config_split for select using (true);
grant select on public.config_split to anon;

-- Quanto o indicador deve receber do consultor numa venda: (valor − imposto) × % do indicador.
-- É SÓ INFORMATIVO: quem paga é o consultor, por fora. Sem imposto configurado, conta como zero (a tela avisa).
create or replace function private.estimativa_indicador(p_valor numeric, p_indicador uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select round(p_valor * (1 - coalesce(case when p.tipo_pessoa = 'PJ' then c.aliquota_pj else c.aliquota_pf end, 0) / 100) * c.pct_indicador / 100, 2)
  from public.config_split c left join public.profiles p on p.id = p_indicador
  where c.id = 1;
$$;

-- ---------- Registrar venda (consultor) ----------
-- Uma venda por lead: chamar de novo atualiza (ex.: aguardando entrevista → aprovado no Verdinho).
create or replace function public.registrar_venda(p_lead uuid, p_cliente text, p_codigo text, p_valor numeric, p_data date, p_status text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_lead public.leads; v_canal public.canais; v_id uuid;
begin
  select * into v_lead from public.leads where id = p_lead and consultor_id = auth.uid() for update;
  if not found then raise exception 'Lead não encontrado'; end if;
  if p_status not in ('aguardando_entrevista','aprovado','reprovado') then raise exception 'Status inválido' using errcode = 'P0001'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe o valor da adesão' using errcode = 'P0001'; end if;
  -- +1 dia de folga para o fuso: o servidor roda em UTC, o consultor no horário de Brasília.
  if p_data is null or p_data > current_date + 1 then raise exception 'Informe a data da venda (não pode ser no futuro)' using errcode = 'P0001'; end if;
  if char_length(trim(coalesce(p_cliente, ''))) < 1 then raise exception 'Informe o primeiro nome do cliente' using errcode = 'P0001'; end if;
  if nullif(trim(coalesce(p_codigo, '')), '') is not null then
    select * into v_canal from public.canais where codigo = upper(trim(p_codigo));
    if not found then raise exception 'Código do indicador não encontrado' using errcode = 'P0001'; end if;
    if not exists (select 1 from public.indicadores i where i.id = v_canal.indicador_id and i.consultor_id = auth.uid()) then
      raise exception 'Este código é de um indicador de outro consultor' using errcode = 'P0001';
    end if;
  end if;

  insert into public.vendas (consultor_id, lead_id, indicador_id, canal_id, cliente, valor_adesao, data_venda, status)
  values (auth.uid(), p_lead, v_canal.indicador_id, v_canal.id, left(split_part(trim(p_cliente), ' ', 1), 60), p_valor, p_data, p_status)
  on conflict (lead_id) do update set indicador_id = excluded.indicador_id, canal_id = excluded.canal_id, cliente = excluded.cliente,
    valor_adesao = excluded.valor_adesao, data_venda = excluded.data_venda, status = excluded.status, updated_at = now()
  returning id into v_id;

  -- O lead acompanha a venda: atribuição, valor e etapa no CRM.
  update public.leads set
    canal_id = coalesce(v_canal.id, canal_id), indicador_id = coalesce(v_canal.indicador_id, indicador_id), valor_adesao = p_valor,
    etapa = case p_status when 'aprovado' then 'aprovado' when 'reprovado' then 'reprovado' else 'entrevista' end
  where id = p_lead;
  insert into public.lead_eventos (lead_id, tipo, texto) values (p_lead, 'consultor',
    'Venda registrada: ' || case p_status when 'aprovado' then 'aprovada no Verdinho' when 'reprovado' then 'reprovada e devolvida ao cliente' else 'aguardando entrevista' end);
  perform private.recalc_consultor(auth.uid());
  return v_id;
end $$;

-- ---------- Leituras ----------
-- Indicador: vendas registradas com os códigos dele (só primeiro nome, data, canal, status, valores).
create or replace function public.vendas_indicador()
returns table (venda_id uuid, cliente text, data_venda date, canal text, consultor text, status text, valor_adesao numeric, estimativa numeric)
language sql stable security definer set search_path = public as $$
  select v.id, v.cliente, v.data_venda, 'Canal ' || lpad(c.numero::text, 2, '0') || ' · ' || c.nome, k.nome_exibicao, v.status, v.valor_adesao,
    case when v.status = 'reprovado' then 0 else private.estimativa_indicador(v.valor_adesao, v.indicador_id) end
  from public.vendas v
  left join public.canais c on c.id = v.canal_id
  join public.consultores k on k.id = v.consultor_id
  where v.indicador_id = auth.uid()
  order by v.data_venda desc, v.created_at desc;
$$;

-- Consultor: seus indicadores com contagens e quanto ele deve repassar a cada um (vendas aprovadas).
drop function if exists public.meus_indicadores();
create function public.meus_indicadores()
returns table (id uuid, nome text, perfil text, tipo_pessoa text, canais text[], leads bigint, aprovados bigint, a_repassar numeric, consultor_desde timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, p.nome, i.perfil, p.tipo_pessoa,
    coalesce((select array_agg('CANAL ' || lpad(c.numero::text, 2, '0') order by c.numero) from public.canais c where c.indicador_id = i.id), '{}'),
    (select count(*) from public.leads l where l.indicador_id = i.id and l.consultor_id = auth.uid()),
    (select count(*) from public.vendas v where v.indicador_id = i.id and v.consultor_id = auth.uid() and v.status = 'aprovado'),
    (select coalesce(sum(private.estimativa_indicador(v.valor_adesao, v.indicador_id)), 0) from public.vendas v
       where v.indicador_id = i.id and v.consultor_id = auth.uid() and v.status = 'aprovado'),
    i.consultor_desde
  from public.indicadores i join public.profiles p on p.id = i.id
  where i.consultor_id = auth.uid()
  order by 7 desc;
$$;

-- Admin: acompanhamento das vendas registradas (cliente só com primeiro nome).
create or replace function public.admin_vendas()
returns table (id uuid, data_venda date, created_at timestamptz, cliente text, consultor text, indicador text, valor_adesao numeric, estimativa_indicador numeric, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  return query
  select v.id, v.data_venda, v.created_at, v.cliente, k.nome_exibicao, coalesce(p.nome, 'Sem indicador'), v.valor_adesao,
    case when v.status = 'reprovado' then 0::numeric else private.estimativa_indicador(v.valor_adesao, v.indicador_id) end, v.status
  from public.vendas v join public.consultores k on k.id = v.consultor_id
  left join public.profiles p on p.id = v.indicador_id
  order by v.data_venda desc, v.created_at desc limit 1000;
end $$;

create or replace function public.admin_contagens() returns table (consultores bigint, indicadores bigint, adesoes bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  return query select
    (select count(*) from public.consultores),
    (select count(*) from public.indicadores),
    (select count(*) from public.vendas where status = 'aprovado');
end $$;

-- ---------- 5. PJ só com CNPJ válido ----------
create or replace function private.cnpj_valido(p text) returns boolean
language plpgsql immutable set search_path = public as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g'); s int; r int; i int;
  p1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2]; p2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
begin
  if length(d) <> 14 or d ~ '^(\d)\1{13}$' then return false; end if;
  s := 0; for i in 1..12 loop s := s + substr(d, i, 1)::int * p1[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  if r <> substr(d, 13, 1)::int then return false; end if;
  s := 0; for i in 1..13 loop s := s + substr(d, i, 1)::int * p2[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  return r = substr(d, 14, 1)::int;
end $$;

create or replace function private.tg_profile_pj() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tipo_pessoa = 'PJ' and not private.cnpj_valido(new.documento) then
    if tg_op = 'INSERT' then
      new.tipo_pessoa := 'PF';  -- cadastro com CNPJ inválido entra como PF até corrigir
    elsif not (private.is_admin() or auth.uid() is null) then
      raise exception 'Para ser PJ, informe um CNPJ válido no campo documento' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profile_pj on public.profiles;
create trigger profile_pj before insert or update of tipo_pessoa, documento on public.profiles
  for each row execute function private.tg_profile_pj();

-- Catálogo: o texto do plano de saúde falava de custódia.
update public.produtos set descricao = 'O consultor atende o cliente; o indicador recebe 50% do líquido via Pix do consultor' where id = 'saude';

-- ---------- Permissões ----------
revoke all on function private.estimativa_indicador(numeric, uuid), private.cnpj_valido(text), private.tg_profile_pj() from public, anon, authenticated;
revoke all on function public.registrar_venda(uuid, text, text, numeric, date, text), public.vendas_indicador(), public.meus_indicadores(),
  public.admin_vendas(), public.admin_contagens() from public, anon;
grant execute on function public.registrar_venda(uuid, text, text, numeric, date, text), public.vendas_indicador(), public.meus_indicadores(),
  public.admin_vendas(), public.admin_contagens() to authenticated;
