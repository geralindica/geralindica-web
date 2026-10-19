alter table public.leads drop constraint leads_etapa_check;
alter table public.leads add constraint leads_etapa_check check (etapa in ('novo','triagem','cotacao','negociacao','contrato','custodia','entrevista','aprovado','reprovado','perdido'));

create or replace function private.tg_lead_depois() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cfg public.config_split; v_tp text; v_aliq numeric; v_status text;
  v_nomes jsonb := '{"novo":"Novo","triagem":"Em triagem (robô)","cotacao":"Cotação enviada","negociacao":"Negociação","contrato":"Contrato emitido","custodia":"Pagamento em custódia","entrevista":"Entrevista de saúde","aprovado":"Aprovado (Verdinho)","reprovado":"Reprovado (estornado)","perdido":"Perdido (desistiu)"}';
begin
  if tg_op = 'INSERT' or new.etapa is distinct from old.etapa then
    select * into v_cfg from public.config_split where id = 1;
    select p.tipo_pessoa into v_tp from public.profiles p where p.id = new.indicador_id;
    v_aliq := case when v_tp = 'PJ' then v_cfg.aliquota_pj else v_cfg.aliquota_pf end;
    select status into v_status from public.transacoes where lead_id = new.id;

    if new.etapa in ('contrato','custodia','entrevista','aprovado') and v_status is null then
      insert into public.transacoes (lead_id, bruto, aliquota, pct_indicador, status, created_at)
      values (new.id, coalesce(new.valor_adesao, 0), v_aliq, v_cfg.pct_indicador, 'pendente', coalesce(new.updated_at, now()));
      v_status := 'pendente';
    end if;

    if v_status is not null and v_status <> 'repassado' then
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

    if tg_op = 'UPDATE' then
      insert into public.lead_eventos (lead_id, tipo, texto) values (new.id, 'sistema', 'Movido para ' || (v_nomes ->> new.etapa));
    end if;
  end if;

  perform private.recalc_consultor(new.consultor_id);
  if tg_op = 'UPDATE' and old.consultor_id is distinct from new.consultor_id then perform private.recalc_consultor(old.consultor_id); end if;
  return null;
end $$;
revoke execute on function private.tg_lead_depois() from public, anon;
