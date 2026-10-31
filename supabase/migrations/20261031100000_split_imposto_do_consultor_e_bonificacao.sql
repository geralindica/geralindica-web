-- Split definido pelo Eduardo em 31/10/2026 (o dinheiro continua todo com o consultor; aqui só a conta).
-- Exemplo, consultor PF, adesão de R$ 400 e bonificação de 100%:
--   1. Imposto É DO CONSULTOR (PF 27,5%; PJ 6% ou 15,5%): 400 − 27,5% = 290 de líquido.
--   2. Do líquido, 50% para o indicador: 145 (o consultor faz o Pix).
--   3. Depois do Verdinho a operadora paga a bonificação ao consultor: 100% de 400, menos o imposto = 290.
--   4. Bolo = parte do consultor na adesão (145) + bonificação (290) = 435, dividido 50/50:
--      217,50 para o consultor e 217,50 para a Geralindica (Pix do consultor).
-- Também: o QR Code passa a abrir o WhatsApp do consultor do indicador (o número geral fica de reserva).

-- ---------- Configuração ----------
alter table public.config_split
  add column aliquota_pj_2 numeric(5,2) check (aliquota_pj_2 is null or aliquota_pj_2 between 0 and 100),
  add column bonificacao_padrao numeric(6,2) check (bonificacao_padrao is null or bonificacao_padrao between 0 and 1000);
comment on column public.config_split.aliquota_pf is 'Imposto do consultor pessoa física (%)';
comment on column public.config_split.aliquota_pj is 'Imposto do consultor PJ, faixa 1 (%)';
comment on column public.config_split.aliquota_pj_2 is 'Imposto do consultor PJ, faixa 2 (%)';
comment on column public.config_split.pct_consultor_restante is 'Do bolo (parte do consultor na adesão + bonificação líquida), % que fica com o consultor; o resto é da Geralindica';
comment on column public.config_split.bonificacao_padrao is 'Bonificação da operadora sugerida ao registrar venda aprovada (% do valor da adesão)';
grant update (aliquota_pj_2, bonificacao_padrao) on public.config_split to authenticated;

update public.config_split set aliquota_pf = 27.5, aliquota_pj = 6, aliquota_pj_2 = 15.5,
  pct_indicador = 50, pct_consultor_restante = 50, bonificacao_padrao = 100
where id = 1;

-- Consultor PJ escolhe a faixa de imposto (1 = aliquota_pj, 2 = aliquota_pj_2). PF/PJ continua em profiles.tipo_pessoa.
alter table public.consultores add column faixa_pj smallint not null default 1 check (faixa_pj in (1, 2));
grant update (faixa_pj) on public.consultores to authenticated;

-- Imposto do consultor hoje, pela configuração.
create or replace function private.aliquota_consultor(p uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select case when pr.tipo_pessoa = 'PJ' then case when k.faixa_pj = 2 then c.aliquota_pj_2 else c.aliquota_pj end else c.aliquota_pf end
  from public.consultores k join public.profiles pr on pr.id = k.id cross join public.config_split c
  where k.id = p and c.id = 1;
$$;

-- A conta inteira, num lugar só (a mesma de calcularSplit() em src/lib/negocio.ts). Imposto vazio conta como zero;
-- divisão consultor x Geralindica vazia devolve null nessas duas partes.
create or replace function private.split_venda(p_valor numeric, p_aliquota numeric, p_bonificacao numeric)
returns table (liquido numeric, indicador numeric, bonificacao numeric, consultor numeric, geralindica numeric)
language sql stable security definer set search_path = public as $$
  with c as (select pct_indicador, pct_consultor_restante from public.config_split where id = 1),
  a as (
    select c.*, round(p_valor * (1 - coalesce(p_aliquota, 0) / 100), 2) as liq,
      round(p_valor * coalesce(p_bonificacao, 0) / 100 * (1 - coalesce(p_aliquota, 0) / 100), 2) as bon
    from c
  ),
  b as (select a.*, round(liq * pct_indicador / 100, 2) as ind from a),
  d as (select b.*, case when pct_consultor_restante is null then null
                    else round((liq - ind + bon) * pct_consultor_restante / 100, 2) end as con from b)
  select liq, ind, bon, con, (liq - ind + bon) - con from d;
$$;

-- ---------- Vendas guardam o imposto e a bonificação ----------
alter table public.vendas
  add column aliquota numeric(5,2) not null default 0 check (aliquota between 0 and 100),
  add column bonificacao_pct numeric(6,2) check (bonificacao_pct is null or bonificacao_pct between 0 and 1000);
update public.vendas set aliquota = coalesce(private.aliquota_consultor(consultor_id), 0),
  bonificacao_pct = case when status = 'aprovado' then 100 end;

drop function if exists public.registrar_venda(uuid, text, text, numeric, date, text);
create function public.registrar_venda(p_lead uuid, p_cliente text, p_codigo text, p_valor numeric, p_data date, p_status text, p_bonificacao numeric default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_lead public.leads; v_canal public.canais; v_id uuid; v_bonif numeric := p_bonificacao;
  v_aliq numeric := coalesce(private.aliquota_consultor(auth.uid()), 0);
begin
  select * into v_lead from public.leads where id = p_lead and consultor_id = auth.uid() for update;
  if not found then raise exception 'Lead não encontrado'; end if;
  if p_status not in ('aguardando_entrevista','aprovado','reprovado') then raise exception 'Status inválido' using errcode = 'P0001'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe o valor da adesão' using errcode = 'P0001'; end if;
  -- +1 dia de folga para o fuso: o servidor roda em UTC, o consultor no horário de Brasília.
  if p_data is null or p_data > current_date + 1 then raise exception 'Informe a data da venda (não pode ser no futuro)' using errcode = 'P0001'; end if;
  if char_length(trim(coalesce(p_cliente, ''))) < 1 then raise exception 'Informe o primeiro nome do cliente' using errcode = 'P0001'; end if;
  if p_status = 'aprovado' and v_bonif is null then select bonificacao_padrao into v_bonif from public.config_split where id = 1; end if;
  if v_bonif is not null and (v_bonif < 0 or v_bonif > 1000) then raise exception 'A bonificação vai de 0 a 1000%%' using errcode = 'P0001'; end if;
  if nullif(trim(coalesce(p_codigo, '')), '') is not null then
    select * into v_canal from public.canais where codigo = upper(trim(p_codigo));
    if not found then raise exception 'Código do indicador não encontrado' using errcode = 'P0001'; end if;
    if not exists (select 1 from public.indicadores i where i.id = v_canal.indicador_id and i.consultor_id = auth.uid()) then
      raise exception 'Este código é de um indicador de outro consultor' using errcode = 'P0001';
    end if;
  end if;

  insert into public.vendas (consultor_id, lead_id, indicador_id, canal_id, cliente, valor_adesao, data_venda, status, aliquota, bonificacao_pct)
  values (auth.uid(), p_lead, v_canal.indicador_id, v_canal.id, left(split_part(trim(p_cliente), ' ', 1), 60), p_valor, p_data, p_status, v_aliq, v_bonif)
  on conflict (lead_id) do update set indicador_id = excluded.indicador_id, canal_id = excluded.canal_id, cliente = excluded.cliente,
    valor_adesao = excluded.valor_adesao, data_venda = excluded.data_venda, status = excluded.status,
    aliquota = excluded.aliquota, bonificacao_pct = excluded.bonificacao_pct, updated_at = now()
  returning id into v_id;

  update public.leads set
    canal_id = coalesce(v_canal.id, canal_id), indicador_id = coalesce(v_canal.indicador_id, indicador_id), valor_adesao = p_valor,
    etapa = case p_status when 'aprovado' then 'aprovado' when 'reprovado' then 'reprovado' else 'entrevista' end
  where id = p_lead;
  insert into public.lead_eventos (lead_id, tipo, texto) values (p_lead, 'consultor',
    'Venda registrada: ' || case p_status when 'aprovado' then 'aprovada no Verdinho' when 'reprovado' then 'reprovada e devolvida ao cliente' else 'aguardando entrevista' end);
  perform private.recalc_consultor(auth.uid());
  return v_id;
end $$;

-- ---------- Leituras com a conta nova ----------
create or replace function public.vendas_indicador()
returns table (venda_id uuid, cliente text, data_venda date, canal text, consultor text, status text, valor_adesao numeric, estimativa numeric)
language sql stable security definer set search_path = public as $$
  select v.id, v.cliente, v.data_venda, 'Canal ' || lpad(c.numero::text, 2, '0') || ' · ' || c.nome, k.nome_exibicao, v.status, v.valor_adesao,
    case when v.status = 'reprovado' then 0 else s.indicador end
  from public.vendas v
  cross join lateral private.split_venda(v.valor_adesao, v.aliquota, v.bonificacao_pct) s
  left join public.canais c on c.id = v.canal_id
  join public.consultores k on k.id = v.consultor_id
  where v.indicador_id = auth.uid()
  order by v.data_venda desc, v.created_at desc;
$$;

create or replace function public.meus_indicadores()
returns table (id uuid, nome text, perfil text, tipo_pessoa text, canais text[], leads bigint, aprovados bigint, a_repassar numeric, consultor_desde timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, p.nome, i.perfil, p.tipo_pessoa,
    coalesce((select array_agg('CANAL ' || lpad(c.numero::text, 2, '0') order by c.numero) from public.canais c where c.indicador_id = i.id), '{}'),
    (select count(*) from public.leads l where l.indicador_id = i.id and l.consultor_id = auth.uid()),
    (select count(*) from public.vendas v where v.indicador_id = i.id and v.consultor_id = auth.uid() and v.status = 'aprovado'),
    (select coalesce(sum(s.indicador), 0) from public.vendas v cross join lateral private.split_venda(v.valor_adesao, v.aliquota, v.bonificacao_pct) s
       where v.indicador_id = i.id and v.consultor_id = auth.uid() and v.status = 'aprovado'),
    i.consultor_desde
  from public.indicadores i join public.profiles p on p.id = i.id
  where i.consultor_id = auth.uid()
  order by 7 desc;
$$;

-- Admin: quanto cada venda rende ao indicador e à Geralindica (a parte da Geralindica só vale depois do Verdinho).
drop function if exists public.admin_vendas();
create function public.admin_vendas()
returns table (id uuid, data_venda date, created_at timestamptz, cliente text, consultor text, indicador text, valor_adesao numeric,
  aliquota numeric, bonificacao_pct numeric, estimativa_indicador numeric, estimativa_geralindica numeric, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  return query
  select v.id, v.data_venda, v.created_at, v.cliente, k.nome_exibicao, coalesce(p.nome, 'Sem indicador'), v.valor_adesao,
    v.aliquota, v.bonificacao_pct,
    case when v.status = 'reprovado' then 0::numeric else s.indicador end,
    case when v.status = 'aprovado' then s.geralindica else 0::numeric end,
    v.status
  from public.vendas v
  cross join lateral private.split_venda(v.valor_adesao, v.aliquota, v.bonificacao_pct) s
  join public.consultores k on k.id = v.consultor_id
  left join public.profiles p on p.id = v.indicador_id
  order by v.data_venda desc, v.created_at desc limit 1000;
end $$;

drop function if exists private.estimativa_indicador(numeric, uuid);

-- ---------- QR Code → WhatsApp do consultor do indicador ----------
-- Sem telefone válido no perfil do consultor (ou indicador sem consultor), usa o número geral de Admin → Split.
create or replace function private.whatsapp_do_consultor(p_consultor uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when length(d) in (10, 11) then '55' || d
    when length(d) in (12, 13) and d like '55%' then d
  end
  from (select regexp_replace(coalesce(telefone, ''), '\D', '', 'g') as d from public.profiles where id = p_consultor) t;
$$;

create or replace function public.registrar_escaneamento(p_codigo text)
returns table (whatsapp text, mensagem text)
language plpgsql security definer set search_path = public as $$
declare v_canal public.canais; v_zap text;
begin
  update public.canais set escaneamentos = escaneamentos + 1 where codigo = upper(trim(p_codigo)) returning * into v_canal;
  if not found then return; end if;
  select private.whatsapp_do_consultor(i.consultor_id) into v_zap from public.indicadores i where i.id = v_canal.indicador_id;
  return query select coalesce(v_zap, c.whatsapp_numero),
    'Gostaria de uma simulação referente a plano de saúde (canal ' || lpad(v_canal.numero::text, 2, '0') || ' · ' || v_canal.codigo || ')'
  from public.config_split c where c.id = 1;
end $$;

-- Indicador fala com o próprio consultor (botão "Falar no WhatsApp" em Meu consultor).
create or replace function public.whatsapp_meu_consultor() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(private.whatsapp_do_consultor(i.consultor_id), (select whatsapp_numero from public.config_split where id = 1))
  from public.indicadores i where i.id = auth.uid();
$$;

-- ---------- Permissões ----------
revoke all on function private.aliquota_consultor(uuid), private.split_venda(numeric, numeric, numeric), private.whatsapp_do_consultor(uuid) from public, anon, authenticated;
revoke all on function public.registrar_venda(uuid, text, text, numeric, date, text, numeric), public.admin_vendas(), public.whatsapp_meu_consultor() from public, anon;
grant execute on function public.registrar_venda(uuid, text, text, numeric, date, text, numeric), public.admin_vendas(), public.whatsapp_meu_consultor() to authenticated;
grant execute on function public.registrar_escaneamento(text) to anon, authenticated;
