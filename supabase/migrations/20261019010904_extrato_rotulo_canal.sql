create or replace function public.extrato_indicador()
returns table (transacao_id uuid, primeiro_nome text, data timestamptz, canal text, status text, bruto numeric, aliquota numeric, comissao numeric, cpf_final text, tel_final text)
language sql stable security definer set search_path = public as $$
  select t.id, split_part(l.nome, ' ', 1), t.created_at,
         'Canal ' || lpad(c.numero::text, 2, '0') || ' · ' || c.nome,
         t.status, t.bruto, t.aliquota,
         round(t.bruto * (1 - t.aliquota/100) * t.pct_indicador/100, 2),
         right(regexp_replace(coalesce(l.cpf,''), '\D', '', 'g'), 2),
         right(regexp_replace(coalesce(l.telefone,''), '\D', '', 'g'), 4)
  from public.transacoes t
  join public.leads l on l.id = t.lead_id
  left join public.canais c on c.id = l.canal_id
  where l.indicador_id = auth.uid()
  order by t.created_at desc;
$$;
revoke execute on function public.extrato_indicador() from public, anon;
grant execute on function public.extrato_indicador() to authenticated;
