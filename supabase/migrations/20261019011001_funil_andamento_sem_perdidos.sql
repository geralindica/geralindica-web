create or replace function public.funil_indicador()
returns table (escaneamentos bigint, conversas bigint, cotacoes bigint, fechados bigint, aprovados bigint, leads_andamento bigint)
language sql stable security definer set search_path = public as $$
  select
    (select coalesce(sum(escaneamentos), 0) from public.canais where indicador_id = auth.uid()),
    count(*),
    count(*) filter (where etapa in ('cotacao','negociacao','contrato','custodia','entrevista','aprovado','reprovado')),
    count(*) filter (where etapa in ('contrato','custodia','entrevista','aprovado','reprovado')),
    count(*) filter (where etapa = 'aprovado'),
    count(*) filter (where etapa not in ('aprovado','reprovado','perdido'))
  from public.leads where indicador_id = auth.uid();
$$;
revoke execute on function public.funil_indicador() from public, anon;
grant execute on function public.funil_indicador() to authenticated;
