-- Auditoria de segurança de 23/10/2026 · correções urgentes (dinheiro)
-- 1. Só o admin decide o resultado da entrevista (Verdinho ou reprovado); o consultor não aprova sozinho.
-- 2. O valor da adesão trava a partir do contrato emitido (só o admin corrige).
-- 3. Todo saque passa pelo admin: o indicador solicita, o admin marca como pago ou recusa.
-- 4. solicitar_saque não gera saque em dobro com cliques simultâneos.

-- Quem pode decidir sobre dinheiro: admin, a chave service_role (integração com a administradora) ou
-- o próprio banco (cron, SQL do painel), que roda sem usuário logado.
create or replace function private.pode_decidir() returns boolean
language sql stable security definer set search_path = public as $$
  select private.is_admin() or auth.uid() is null or coalesce(auth.role(), '') = 'service_role';
$$;
revoke all on function private.pode_decidir() from public, anon, authenticated;

-- ---------- Transações: novo status "em_saque" (saque solicitado, aguardando o admin) ----------
alter table public.transacoes drop constraint transacoes_status_check;
alter table public.transacoes add constraint transacoes_status_check
  check (status in ('pendente','custodia','verdinho','em_saque','repassado','estornado'));

-- ---------- Saques: status e quem decidiu ----------
alter table public.saques
  add column status text not null default 'solicitado',
  add column decidido_em timestamptz,
  add column decidido_por uuid references public.profiles(id),
  add column motivo text;
-- Saques antigos (Pix simulado) foram marcados como pagos na hora.
update public.saques set status = 'pago', decidido_em = created_at;
alter table public.saques add constraint saques_status_check check (status in ('solicitado','pago','recusado'));
create index if not exists saques_solicitados_idx on public.saques (created_at) where status = 'solicitado';

-- ---------- Regras do lead antes de gravar ----------
create or replace function private.tg_lead_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if new.etapa is distinct from old.etapa then
    select status into v_status from public.transacoes where lead_id = new.id;
    if v_status in ('em_saque','repassado') and new.etapa <> 'aprovado' then
      raise exception 'A comissão deste lead já foi sacada; a etapa não pode mais mudar' using errcode = 'P0001';
    end if;
    if not private.pode_decidir() then
      if new.etapa in ('aprovado','reprovado') or old.etapa in ('aprovado','reprovado') then
        raise exception 'Só o admin marca o resultado da entrevista (Verdinho ou reprovado)' using errcode = 'P0001';
      end if;
      if old.etapa in ('custodia','entrevista') and new.etapa = 'perdido' then
        raise exception 'Com pagamento em custódia, só o admin pode encerrar este lead' using errcode = 'P0001';
      end if;
    end if;
    new.updated_at := now();
  end if;

  if new.valor_adesao is distinct from old.valor_adesao and not private.pode_decidir()
     and exists (select 1 from public.transacoes where lead_id = new.id) then
    raise exception 'O valor da adesão trava depois do contrato emitido. Peça a correção ao admin' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- ---------- Depois de gravar: exige valor no contrato e não mexe em comissão que já está em saque ----------
create or replace function private.tg_lead_depois() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cfg public.config_split; v_tp text; v_aliq numeric; v_status text;
  v_nomes jsonb := '{"novo":"Novo","triagem":"Em triagem (robô)","cotacao":"Cotação enviada","negociacao":"Negociação","contrato":"Contrato emitido","custodia":"Pagamento em custódia","entrevista":"Entrevista de saúde","aprovado":"Aprovado (Verdinho)","reprovado":"Reprovado (estornado)","perdido":"Perdido (desistiu)"}';
begin
  if tg_op = 'INSERT' or new.etapa is distinct from old.etapa or new.valor_adesao is distinct from old.valor_adesao then
    select * into v_cfg from public.config_split where id = 1;
    select p.tipo_pessoa into v_tp from public.profiles p where p.id = new.indicador_id;
    v_aliq := case when v_tp = 'PJ' then v_cfg.aliquota_pj else v_cfg.aliquota_pf end;
    select status into v_status from public.transacoes where lead_id = new.id;

    if new.etapa in ('contrato','custodia','entrevista','aprovado') and v_status is null then
      if coalesce(new.valor_adesao, 0) <= 0 then
        raise exception 'Informe o valor da adesão antes de emitir o contrato' using errcode = 'P0001';
      end if;
      insert into public.transacoes (lead_id, bruto, aliquota, pct_indicador, status, created_at)
      values (new.id, new.valor_adesao, v_aliq, v_cfg.pct_indicador, 'pendente', coalesce(new.updated_at, now()));
      v_status := 'pendente';
    end if;

    if v_status is not null and v_status not in ('em_saque','repassado') then
      if new.etapa = 'perdido' and v_status = 'pendente' then
        delete from public.transacoes where lead_id = new.id;
      else
        update public.transacoes set
          status = case
            when new.etapa = 'aprovado' then 'verdinho'
            when new.etapa in ('reprovado','perdido') then 'estornado'
            when new.etapa in ('custodia','entrevista') then 'custodia'
            else 'pendente' end,
          bruto = coalesce(new.valor_adesao, bruto)
        where lead_id = new.id;
      end if;
    end if;

    if tg_op = 'UPDATE' and new.etapa is distinct from old.etapa then
      insert into public.lead_eventos (lead_id, tipo, texto) values (new.id, 'sistema', 'Movido para ' || (v_nomes ->> new.etapa));
    end if;
  end if;

  perform private.recalc_consultor(new.consultor_id);
  if tg_op = 'UPDATE' and old.consultor_id is distinct from new.consultor_id then perform private.recalc_consultor(old.consultor_id); end if;
  return null;
end $$;

-- ---------- Admin: resultado da entrevista e correção de valor ----------
create or replace function public.admin_resultado_entrevista(p_transacao uuid, p_aprovado boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_lead uuid; v_status text;
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  select lead_id, status into v_lead, v_status from public.transacoes where id = p_transacao for update;
  if not found then raise exception 'Transação não encontrada' using errcode = 'P0001'; end if;
  if v_status not in ('pendente','custodia') then
    raise exception 'Esta transação já tem resultado' using errcode = 'P0001';
  end if;
  update public.leads set etapa = case when p_aprovado then 'aprovado' else 'reprovado' end where id = v_lead;
  insert into public.lead_eventos (lead_id, tipo, texto)
  values (v_lead, 'sistema', case when p_aprovado then 'Admin confirmou a aprovação da entrevista (Verdinho)' else 'Admin registrou a reprovação na entrevista' end);
end $$;

create or replace function public.admin_corrigir_valor(p_lead uuid, p_valor numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Valor inválido' using errcode = 'P0001'; end if;
  if exists (select 1 from public.transacoes where lead_id = p_lead and status in ('em_saque','repassado')) then
    raise exception 'A comissão deste lead já foi sacada; o valor não pode mudar' using errcode = 'P0001';
  end if;
  update public.leads set valor_adesao = p_valor where id = p_lead;
  insert into public.lead_eventos (lead_id, tipo, texto) values (p_lead, 'sistema', 'Admin corrigiu o valor da adesão');
end $$;

-- ---------- Saque: o indicador só solicita; trava as comissões para não sacar em dobro ----------
create or replace function public.solicitar_saque() returns public.saques
language plpgsql security definer set search_path = public as $$
declare v_saque public.saques; v_total numeric; v_qtd int;
begin
  if auth.uid() is null then raise exception 'Faça login'; end if;
  -- Trava o perfil: pedidos simultâneos do mesmo indicador entram em fila, um de cada vez.
  perform 1 from public.profiles where id = auth.uid() for update;
  if (select chave_pix from public.profiles where id = auth.uid()) is null then
    raise exception 'Cadastre sua chave Pix antes de sacar' using errcode = 'P0001';
  end if;
  insert into public.saques (indicador_id, valor, qtd) values (auth.uid(), 0, 0) returning * into v_saque;
  -- O total sai só das linhas que esta chamada de fato mudou de verdinho para em_saque.
  with mudou as (
    update public.transacoes t set status = 'em_saque', saque_id = v_saque.id
    from public.leads l
    where l.id = t.lead_id and l.indicador_id = auth.uid() and t.status = 'verdinho'
    returning round(t.bruto * (1 - t.aliquota/100) * t.pct_indicador/100, 2) as comissao
  )
  select coalesce(sum(comissao), 0), count(*) into v_total, v_qtd from mudou;
  if v_qtd = 0 then raise exception 'Nenhuma comissão liberada para saque' using errcode = 'P0001'; end if;
  update public.saques set valor = v_total, qtd = v_qtd where id = v_saque.id returning * into v_saque;
  return v_saque;
end $$;

create or replace function public.admin_pagar_saque(p_saque uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  update public.saques set status = 'pago', decidido_em = now(), decidido_por = auth.uid()
  where id = p_saque and status = 'solicitado';
  if not found then raise exception 'Saque não está aguardando pagamento' using errcode = 'P0001'; end if;
  update public.transacoes set status = 'repassado', liberado_em = now() where saque_id = p_saque and status = 'em_saque';
end $$;

create or replace function public.admin_recusar_saque(p_saque uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Informe o motivo da recusa' using errcode = 'P0001'; end if;
  update public.saques set status = 'recusado', decidido_em = now(), decidido_por = auth.uid(), motivo = trim(p_motivo)
  where id = p_saque and status = 'solicitado';
  if not found then raise exception 'Saque não está aguardando pagamento' using errcode = 'P0001'; end if;
  -- As comissões voltam a ficar disponíveis (Verdinho) para um novo pedido.
  update public.transacoes set status = 'verdinho', saque_id = null where saque_id = p_saque and status = 'em_saque';
end $$;

-- Pagamento direto pelo admin (botão "Pagar" no Financeiro): o saque já nasce pago.
create or replace function public.liberar_comissao(p_transacao uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_ind uuid; v_valor numeric; v_saque uuid;
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  select l.indicador_id, round(t.bruto * (1 - t.aliquota/100) * t.pct_indicador/100, 2) into v_ind, v_valor
  from public.transacoes t join public.leads l on l.id = t.lead_id where t.id = p_transacao and t.status = 'verdinho'
  for update of t;
  if not found then raise exception 'Comissão só pode ser liberada com status Verdinho' using errcode = 'P0001'; end if;
  if v_ind is not null then
    insert into public.saques (indicador_id, valor, qtd, status, decidido_em, decidido_por)
    values (v_ind, v_valor, 1, 'pago', now(), auth.uid()) returning id into v_saque;
  end if;
  update public.transacoes set status = 'repassado', liberado_em = now(), saque_id = v_saque where id = p_transacao;
end $$;

-- Lista de saques para o admin (com a chave Pix para pagar).
create or replace function public.admin_saques() returns table (
  id uuid, created_at timestamptz, indicador text, chave_pix text, tipo_pessoa text,
  valor numeric, qtd int, status text, decidido_em timestamptz, motivo text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  return query
  select s.id, s.created_at, p.nome, p.chave_pix, p.tipo_pessoa, s.valor, s.qtd, s.status, s.decidido_em, s.motivo
  from public.saques s join public.profiles p on p.id = s.indicador_id
  order by (s.status = 'solicitado') desc, s.created_at desc limit 300;
end $$;

-- admin_transacoes passa a devolver o lead e a etapa (para os botões de resultado da entrevista).
drop function public.admin_transacoes();
create function public.admin_transacoes() returns table (
  id uuid, lead_id uuid, created_at timestamptz, cliente text, consultor text, indicador text,
  bruto numeric, comissao numeric, status text, etapa text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  return query
  select t.id, l.id, t.created_at,
    split_part(l.nome, ' ', 1) || coalesce(' ' || left(nullif(split_part(l.nome, ' ', 2), ''), 1) || '.', ''),
    c.nome_exibicao, coalesce(p.nome, 'Atribuição pendente'),
    t.bruto, round(t.bruto * (1 - t.aliquota/100) * t.pct_indicador/100, 2), t.status, l.etapa
  from public.transacoes t join public.leads l on l.id = t.lead_id
  join public.consultores c on c.id = l.consultor_id
  left join public.profiles p on p.id = l.indicador_id
  order by t.created_at desc limit 500;
end $$;

-- Métricas que contavam "verdinho + repassado" passam a contar também o que está em saque.
create or replace function public.admin_contagens() returns table (consultores bigint, indicadores bigint, adesoes bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  return query select
    (select count(*) from public.consultores),
    (select count(*) from public.indicadores),
    (select count(*) from public.transacoes where status in ('verdinho','em_saque','repassado'));
end $$;

create or replace function public.meus_indicadores() returns table (
  id uuid, nome text, perfil text, tipo_pessoa text, canais text[], leads bigint, aprovados bigint, comissao numeric, consultor_desde timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, p.nome, i.perfil, p.tipo_pessoa,
    coalesce((select array_agg('CANAL ' || lpad(c.numero::text, 2, '0') order by c.numero) from public.canais c where c.indicador_id = i.id), '{}'),
    (select count(*) from public.leads l where l.indicador_id = i.id and l.consultor_id = auth.uid()),
    (select count(*) from public.leads l where l.indicador_id = i.id and l.consultor_id = auth.uid() and l.etapa = 'aprovado'),
    (select coalesce(sum(round(t.bruto * (1 - t.aliquota/100) * t.pct_indicador/100, 2)), 0) from public.transacoes t join public.leads l on l.id = t.lead_id
       where l.indicador_id = i.id and l.consultor_id = auth.uid() and t.status in ('verdinho','em_saque','repassado')),
    i.consultor_desde
  from public.indicadores i join public.profiles p on p.id = i.id
  where i.consultor_id = auth.uid()
  order by 7 desc;
$$;

-- Permissões: funções de admin só para usuários logados (cada uma confere se é admin).
revoke all on function public.admin_resultado_entrevista(uuid, boolean), public.admin_corrigir_valor(uuid, numeric),
  public.admin_pagar_saque(uuid), public.admin_recusar_saque(uuid, text), public.admin_saques(), public.admin_transacoes()
  from public, anon;
grant execute on function public.admin_resultado_entrevista(uuid, boolean), public.admin_corrigir_valor(uuid, numeric),
  public.admin_pagar_saque(uuid), public.admin_recusar_saque(uuid, text), public.admin_saques(), public.admin_transacoes()
  to authenticated;
