-- Regras de dinheiro dos contratos do Luis (08/11/2026). A plataforma continua sem movimentar dinheiro:
-- só registra e mostra o que cada um deve pagar por fora.
-- • Sem prazo de validade do lead e sem estorno (decisão do Eduardo, 10/11/2026): o dinheiro fica com o consultor
--   até o Verdinho; reprovado, ele devolve ao cliente e ninguém recebe. Depois do Verdinho não há volta.
-- • Troca de plano em até 10 anos (consultor 3.5): o cliente troca de plano, o consultor paga de novo indicador e site.
-- • Comissões recorrentes e bonificações seguintes (consultor 4.2 b): 50% do lucro líquido para a Geralindica.
-- • Fechamento mensal com a Geralindica até o dia 5 do mês seguinte, juros de 1% ao dia (consultor 3.3 e 4.4).
-- • Relatório mensal ao indicador (indicador 8.1).

alter table public.vendas drop constraint vendas_lead_id_key;
alter table public.vendas
  add column tipo text not null default 'nova' check (tipo in ('nova','troca_plano')),
  add column venda_origem uuid references public.vendas(id) on delete cascade,
  add column aprovado_em timestamptz,
  add column indicador_pago_em date;
alter table public.vendas add constraint vendas_troca_tem_origem check ((tipo = 'troca_plano') = (venda_origem is not null));
create unique index vendas_uma_nova_por_lead on public.vendas (lead_id) where tipo = 'nova';
create index vendas_origem_idx on public.vendas (venda_origem);
comment on column public.vendas.aprovado_em is 'Quando virou Verdinho. Define o mês do fechamento com a Geralindica.';

-- Parte da Geralindica num recebimento recorrente: 50% do líquido (sem indicador, que só ganha na 1ª parcela).
create function private.geralindica_recebimento(p_valor numeric, p_aliquota numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select case when c.pct_consultor_restante is null then null
    else round(round(p_valor * (1 - coalesce(p_aliquota, 0) / 100), 2) * (100 - c.pct_consultor_restante) / 100, 2) end
  from public.config_split c where c.id = 1;
$$;

create function private.hoje_br() returns date language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- Métricas e temperatura contam clientes novos (troca de plano não é venda nova).
create or replace function private.recalc_consultor(p uuid)
 returns void language sql security definer set search_path to 'public'
as $function$
  update public.consultores c set
    vendas      = (select count(*) from public.vendas where consultor_id = p and status = 'aprovado' and tipo = 'nova'),
    leads_total = (select count(*) from public.leads where consultor_id = p),
    vendas_30d  = (select count(*) from public.vendas where consultor_id = p and status = 'aprovado' and tipo = 'nova' and data_venda > current_date - 30),
    ocupacao    = (select count(*) from public.indicadores where consultor_id = p),
    temperatura = private.calcular_temperatura(p)
  where c.id = p;
$function$;

create or replace function private.calcular_temperatura(p uuid)
 returns integer language sql stable security definer set search_path to 'public'
as $function$
  with base as (
    select
      (select count(*) from public.vendas where consultor_id = p and status = 'aprovado' and tipo = 'nova') as vendas,
      (select count(*) from public.vendas where consultor_id = p and status = 'aprovado' and tipo = 'nova' and data_venda > current_date - 30) as vendas_30d,
      (select avg(estrelas) from public.avaliacoes where consultor_id = p) as media
  )
  select least(100, greatest(0, round(
      40 * least(vendas, 50) / 50.0
    + coalesce(30 * (media - 1) / 4.0, 15)
    + 30 * least(vendas_30d, 5) / 5.0
  )))::int
  from base;
$function$;

create or replace function public.registrar_venda(p_lead uuid, p_cliente text, p_codigo text, p_valor numeric, p_data date, p_status text, p_bonificacao numeric default null)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
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
  insert into public.vendas (consultor_id, lead_id, indicador_id, canal_id, cliente, valor_adesao, data_venda, status, aliquota, bonificacao_pct,
    aprovado_em)
  values (auth.uid(), p_lead, v_canal.indicador_id, v_canal.id, left(split_part(trim(p_cliente), ' ', 1), 60), p_valor, p_data, p_status, v_aliq, v_bonif,
    case when p_status = 'aprovado' then now() end)
  on conflict (lead_id) where tipo = 'nova' do update set indicador_id = excluded.indicador_id, canal_id = excluded.canal_id, cliente = excluded.cliente,
    valor_adesao = excluded.valor_adesao, data_venda = excluded.data_venda, status = excluded.status,
    aliquota = excluded.aliquota, bonificacao_pct = excluded.bonificacao_pct,
    aprovado_em = case when excluded.status = 'aprovado' then coalesce(public.vendas.aprovado_em, now()) end,
    updated_at = now()
  returning id into v_id;

  update public.leads set
    canal_id = coalesce(v_canal.id, canal_id), indicador_id = coalesce(v_canal.indicador_id, indicador_id), valor_adesao = p_valor,
    etapa = case p_status when 'aprovado' then 'aprovado' when 'reprovado' then 'reprovado' else 'entrevista' end
  where id = p_lead;
  insert into public.lead_eventos (lead_id, tipo, texto) values (p_lead, 'consultor',
    'Venda registrada: ' || case p_status when 'aprovado' then 'aprovada no Verdinho' when 'reprovado' then 'reprovada e devolvida ao cliente' else 'aguardando entrevista' end);
  perform private.recalc_consultor(auth.uid());
  return v_id;
end $function$;

-- Cliente trocou de plano (cláusula 3.5 do consultor): nova venda ligada à original, com indicador e Geralindica.
create function public.registrar_troca_plano(p_venda_origem uuid, p_valor numeric, p_data date, p_status text, p_bonificacao numeric default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare o public.vendas; v_id uuid; v_bonif numeric := p_bonificacao;
begin
  select * into o from public.vendas where id = p_venda_origem and consultor_id = auth.uid();
  if not found then raise exception 'Venda não encontrada' using errcode = 'P0001'; end if;
  if o.tipo = 'troca_plano' then select * into o from public.vendas where id = o.venda_origem; end if;
  if o.status <> 'aprovado' then raise exception 'Só dá para registrar troca de plano de uma venda aprovada' using errcode = 'P0001'; end if;
  if p_status not in ('aguardando_entrevista','aprovado','reprovado') then raise exception 'Status inválido' using errcode = 'P0001'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe o valor da adesão' using errcode = 'P0001'; end if;
  if p_data is null or p_data > current_date + 1 then raise exception 'Informe a data da troca (não pode ser no futuro)' using errcode = 'P0001'; end if;
  if p_data < o.data_venda then raise exception 'A troca não pode ser antes da venda original' using errcode = 'P0001'; end if;
  if p_data > o.data_venda + interval '10 years' then raise exception 'Passaram 10 anos da venda original: a troca não entra mais no acordo' using errcode = 'P0001'; end if;
  if p_status = 'aprovado' and v_bonif is null then select bonificacao_padrao into v_bonif from public.config_split where id = 1; end if;
  if v_bonif is not null and (v_bonif < 0 or v_bonif > 1000) then raise exception 'A bonificação vai de 0 a 1000%%' using errcode = 'P0001'; end if;

  insert into public.vendas (consultor_id, lead_id, indicador_id, canal_id, cliente, valor_adesao, data_venda, status, aliquota, bonificacao_pct,
    tipo, venda_origem, aprovado_em)
  values (auth.uid(), o.lead_id, o.indicador_id, o.canal_id, o.cliente, p_valor, p_data, p_status, coalesce(private.aliquota_consultor(auth.uid()), 0), v_bonif,
    'troca_plano', o.id, case when p_status = 'aprovado' then now() end)
  returning id into v_id;
  if o.lead_id is not null then
    insert into public.lead_eventos (lead_id, tipo, texto) values (o.lead_id, 'consultor', 'Troca de plano registrada (cláusula de 10 anos)');
  end if;
  return v_id;
end $$;

-- Atualiza o status de uma troca de plano (a venda nova continua pelo registrar_venda).
create function public.atualizar_troca_plano(p_venda uuid, p_status text, p_bonificacao numeric default null) returns void
language plpgsql security definer set search_path = public as $$
declare v public.vendas; v_bonif numeric := p_bonificacao;
begin
  select * into v from public.vendas where id = p_venda and consultor_id = auth.uid() and tipo = 'troca_plano' for update;
  if not found then raise exception 'Troca de plano não encontrada' using errcode = 'P0001'; end if;
  if p_status not in ('aguardando_entrevista','aprovado','reprovado') then raise exception 'Status inválido' using errcode = 'P0001'; end if;
  if p_status = 'aprovado' and v_bonif is null then v_bonif := coalesce(v.bonificacao_pct, (select bonificacao_padrao from public.config_split where id = 1)); end if;
  if v_bonif is not null and (v_bonif < 0 or v_bonif > 1000) then raise exception 'A bonificação vai de 0 a 1000%%' using errcode = 'P0001'; end if;
  update public.vendas set status = p_status, bonificacao_pct = v_bonif, updated_at = now(),
    aprovado_em = case when p_status = 'aprovado' then coalesce(aprovado_em, now()) end
  where id = v.id;
end $$;

-- O consultor marca que já fez o Pix do indicador (cláusula 3.4: até 5 dias úteis depois de receber).
create function public.marcar_indicador_pago(p_venda uuid, p_pago boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.vendas set indicador_pago_em = case when p_pago then private.hoje_br() end, updated_at = now()
  where id = p_venda and consultor_id = auth.uid() and indicador_id is not null and status = 'aprovado';
  if not found then raise exception 'Venda não encontrada ou ainda não aprovada' using errcode = 'P0001'; end if;
end $$;

-- ---------- Recebimentos recorrentes (consultor 4.2 b) ----------
create table public.venda_recebimentos (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete cascade,
  consultor_id uuid not null references public.consultores(id) on delete cascade,
  valor numeric(12,2) not null check (valor > 0),
  aliquota numeric not null default 0,
  recebido_em date not null,
  descricao text check (descricao is null or char_length(descricao) <= 120),
  created_at timestamptz not null default now()
);
create index venda_recebimentos_venda_idx on public.venda_recebimentos (venda_id);
create index venda_recebimentos_consultor_idx on public.venda_recebimentos (consultor_id, recebido_em);
alter table public.venda_recebimentos enable row level security;
create policy "recebimentos: consultor ou admin le" on public.venda_recebimentos for select
  using (consultor_id = (select auth.uid()) or (select private.is_admin()));
revoke all on public.venda_recebimentos from anon, authenticated;
grant select on public.venda_recebimentos to authenticated;

create function public.registrar_recebimento(p_venda uuid, p_valor numeric, p_data date, p_descricao text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.vendas where id = p_venda and consultor_id = auth.uid() and status = 'aprovado') then
    raise exception 'Só dá para registrar recebimento de venda aprovada' using errcode = 'P0001';
  end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe o valor recebido' using errcode = 'P0001'; end if;
  if p_data is null or p_data > current_date + 1 then raise exception 'Informe a data (não pode ser no futuro)' using errcode = 'P0001'; end if;
  insert into public.venda_recebimentos (venda_id, consultor_id, valor, aliquota, recebido_em, descricao)
  values (p_venda, auth.uid(), p_valor, coalesce(private.aliquota_consultor(auth.uid()), 0), p_data, left(nullif(trim(coalesce(p_descricao, '')), ''), 120))
  returning id into v_id;
  return v_id;
end $$;

create function public.apagar_recebimento(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.venda_recebimentos where id = p_id and consultor_id = auth.uid();
  if not found then raise exception 'Recebimento não encontrado' using errcode = 'P0001'; end if;
end $$;

-- ---------- Fechamento mensal com a Geralindica (consultor 3.3 e 4.4) ----------
create table public.fechamentos (
  consultor_id uuid not null references public.consultores(id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  pago_em date not null,
  valor_pago numeric(12,2) not null check (valor_pago >= 0),
  registrado_em timestamptz not null default now(),
  primary key (consultor_id, mes)
);
alter table public.fechamentos enable row level security;
create policy "fechamentos: consultor ou admin le" on public.fechamentos for select
  using (consultor_id = (select auth.uid()) or (select private.is_admin()));
revoke all on public.fechamentos from anon, authenticated;
grant select on public.fechamentos to authenticated;

-- Mês = quando o consultor recebeu (Verdinho / recebimento).
-- Vence no dia 5 do mês seguinte; atraso = 1% ao dia sobre o valor.
create function public.fechamentos(p_consultor uuid default null)
returns table (consultor_id uuid, consultor text, mes date, vencimento date, valor numeric, pago_em date, valor_pago numeric, dias_atraso int, juros numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_filtro uuid := p_consultor;
begin
  if not private.is_admin() then
    if not exists (select 1 from public.consultores k where k.id = auth.uid()) then raise exception 'Apenas consultores' using errcode = 'P0001'; end if;
    v_filtro := auth.uid();
  end if;
  return query
  with mov as (
    select v.consultor_id c, date_trunc('month', v.aprovado_em at time zone 'America/Sao_Paulo')::date m, s.geralindica val
    from public.vendas v cross join lateral private.split_venda(v.valor_adesao, v.aliquota, v.bonificacao_pct) s
    where v.aprovado_em is not null and v.status = 'aprovado'
    union all
    select r.consultor_id, date_trunc('month', r.recebido_em)::date, private.geralindica_recebimento(r.valor, r.aliquota)
    from public.venda_recebimentos r
  ),
  t as (
    select mov.c, mov.m, round(sum(coalesce(mov.val, 0)), 2) as val, (mov.m + interval '1 month' + interval '4 days')::date as venc
    from mov where v_filtro is null or mov.c = v_filtro group by mov.c, mov.m
  )
  select t.c, k.nome_exibicao, t.m, t.venc, t.val, f.pago_em, f.valor_pago,
    greatest(0, coalesce(f.pago_em, private.hoje_br()) - t.venc)::int,
    case when t.val > 0 then round(t.val * 0.01 * greatest(0, coalesce(f.pago_em, private.hoje_br()) - t.venc), 2) else 0::numeric end
  from t join public.consultores k on k.id = t.c
  left join public.fechamentos f on f.consultor_id = t.c and f.mes = t.m
  order by t.m desc, k.nome_exibicao;
end $$;

create function public.admin_registrar_fechamento(p_consultor uuid, p_mes date, p_pago_em date, p_valor numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  if p_pago_em is null then
    delete from public.fechamentos where consultor_id = p_consultor and mes = date_trunc('month', p_mes)::date;
    return;
  end if;
  if p_valor is null or p_valor < 0 then raise exception 'Informe o valor recebido' using errcode = 'P0001'; end if;
  insert into public.fechamentos (consultor_id, mes, pago_em, valor_pago) values (p_consultor, date_trunc('month', p_mes)::date, p_pago_em, p_valor)
  on conflict (consultor_id, mes) do update set pago_em = excluded.pago_em, valor_pago = excluded.valor_pago, registrado_em = now();
end $$;

-- ---------- O que o indicador e o admin veem ----------
drop function public.vendas_indicador();
create function public.vendas_indicador()
returns table (venda_id uuid, cliente text, data_venda date, canal text, consultor text, status text, valor_adesao numeric, estimativa numeric,
  tipo text, aprovado_em timestamptz, indicador_pago_em date)
language sql stable security definer set search_path = public as $$
  select v.id, v.cliente, v.data_venda, 'Canal ' || lpad(c.numero::text, 2, '0') || ' · ' || c.nome, k.nome_exibicao, v.status, v.valor_adesao,
    case when v.status = 'reprovado' then 0 else s.indicador end,
    v.tipo, v.aprovado_em, v.indicador_pago_em
  from public.vendas v
  cross join lateral private.split_venda(v.valor_adesao, v.aliquota, v.bonificacao_pct) s
  left join public.canais c on c.id = v.canal_id
  join public.consultores k on k.id = v.consultor_id
  where v.indicador_id = auth.uid()
  order by v.data_venda desc, v.created_at desc;
$$;

-- Relatório mensal (cláusula 8.1): status das indicações por mês de registro, sem dado de cliente.
create function public.relatorio_indicador()
returns table (mes date, pendentes bigint, em_atendimento bigint, convertidas bigint, canceladas bigint)
language sql stable security definer set search_path = public as $$
  select date_trunc('month', l.created_at at time zone 'America/Sao_Paulo')::date,
    count(*) filter (where l.etapa in ('novo','triagem')),
    count(*) filter (where l.etapa in ('cotacao','negociacao','contrato','custodia','entrevista')),
    count(*) filter (where l.etapa = 'aprovado'),
    count(*) filter (where l.etapa in ('reprovado','perdido'))
  from public.leads l where l.indicador_id = auth.uid()
  group by 1 order by 1 desc limit 24;
$$;

drop function public.meus_indicadores();
create function public.meus_indicadores()
returns table (id uuid, nome text, perfil text, tipo_pessoa text, canais text[], leads bigint, aprovados bigint, a_repassar numeric, consultor_desde timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, p.nome, i.perfil, p.tipo_pessoa,
    coalesce((select array_agg('CANAL ' || lpad(c.numero::text, 2, '0') order by c.numero) from public.canais c where c.indicador_id = i.id), '{}'),
    (select count(*) from public.leads l where l.indicador_id = i.id and l.consultor_id = auth.uid()),
    (select count(*) from public.vendas v where v.indicador_id = i.id and v.consultor_id = auth.uid() and v.status = 'aprovado'),
    -- Ainda falta pagar: aprovadas e sem o Pix marcado.
    (select coalesce(sum(s.indicador), 0) from public.vendas v cross join lateral private.split_venda(v.valor_adesao, v.aliquota, v.bonificacao_pct) s
       where v.indicador_id = i.id and v.consultor_id = auth.uid() and v.status = 'aprovado' and v.indicador_pago_em is null),
    i.consultor_desde
  from public.indicadores i join public.profiles p on p.id = i.id
  where i.consultor_id = auth.uid()
  order by 7 desc;
$$;

drop function public.admin_vendas();
create function public.admin_vendas()
returns table (id uuid, data_venda date, created_at timestamptz, cliente text, consultor text, indicador text, valor_adesao numeric, aliquota numeric,
  bonificacao_pct numeric, estimativa_indicador numeric, estimativa_geralindica numeric, status text, tipo text, indicador_pago_em date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  return query
  select v.id, v.data_venda, v.created_at, v.cliente, k.nome_exibicao, coalesce(p.nome, 'Sem indicador'), v.valor_adesao,
    v.aliquota, v.bonificacao_pct,
    case when v.status = 'reprovado' then 0::numeric else s.indicador end,
    case when v.status = 'aprovado' then s.geralindica else 0::numeric end,
    v.status, v.tipo, v.indicador_pago_em
  from public.vendas v
  cross join lateral private.split_venda(v.valor_adesao, v.aliquota, v.bonificacao_pct) s
  join public.consultores k on k.id = v.consultor_id
  left join public.profiles p on p.id = v.indicador_id
  order by v.data_venda desc, v.created_at desc limit 1000;
end $$;

create or replace function public.admin_contagens()
 returns table(consultores bigint, indicadores bigint, adesoes bigint)
 language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  return query select
    (select count(*) from public.consultores),
    (select count(*) from public.indicadores),
    (select count(*) from public.vendas where status = 'aprovado' and tipo = 'nova');
end $function$;

revoke all on function private.geralindica_recebimento(numeric, numeric), private.hoje_br() from public, anon, authenticated;
revoke execute on function public.registrar_troca_plano(uuid, numeric, date, text, numeric), public.atualizar_troca_plano(uuid, text, numeric),
  public.marcar_indicador_pago(uuid, boolean), public.registrar_recebimento(uuid, numeric, date, text),
  public.apagar_recebimento(uuid), public.fechamentos(uuid), public.admin_registrar_fechamento(uuid, date, date, numeric),
  public.vendas_indicador(), public.relatorio_indicador(), public.meus_indicadores(), public.admin_vendas() from public, anon;
grant execute on function public.registrar_troca_plano(uuid, numeric, date, text, numeric), public.atualizar_troca_plano(uuid, text, numeric),
  public.marcar_indicador_pago(uuid, boolean), public.registrar_recebimento(uuid, numeric, date, text),
  public.apagar_recebimento(uuid), public.fechamentos(uuid), public.admin_registrar_fechamento(uuid, date, date, numeric),
  public.vendas_indicador(), public.relatorio_indicador(), public.meus_indicadores(), public.admin_vendas() to authenticated;
