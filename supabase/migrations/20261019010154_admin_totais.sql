create or replace function public.admin_totais()
returns table (status text, qtd bigint, bruto numeric, comissao numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  return query
  select t.status, count(*), coalesce(sum(t.bruto), 0), coalesce(sum(round(t.bruto * (1 - t.aliquota/100) * t.pct_indicador/100, 2)), 0)
  from public.transacoes t group by t.status;
end $$;

create or replace function public.admin_contagens()
returns table (consultores bigint, indicadores bigint, adesoes bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  return query select
    (select count(*) from public.consultores),
    (select count(*) from public.indicadores),
    (select count(*) from public.transacoes where status in ('verdinho','repassado'));
end $$;

revoke execute on function public.admin_totais(), public.admin_contagens() from public, anon;
grant execute on function public.admin_totais(), public.admin_contagens() to authenticated;
