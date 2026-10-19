create extension if not exists pg_cron;

-- Fila de recuperação: depois de 48h sem resposta, o robô manda a mensagem de reengajamento.
-- Hoje registra no histórico (integração simulada); com o WhatsApp ligado, o webhook dispara o template.
create or replace function private.reengajar_vencidos() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  with vencidos as (
    update public.leads set reengajado_em = now()
    where abandonou_em is not null and reengajado_em is null
      and etapa in ('novo','triagem') and abandonou_em <= now() - interval '48 hours'
    returning id
  )
  insert into public.lead_eventos (lead_id, tipo, texto)
  select id, 'robo', 'Mensagem automática de reengajamento enviada (48h após o abandono da triagem)' from vencidos;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function private.reengajar_vencidos() from public, anon, authenticated;

select cron.schedule('indikei-reengajamento-48h', '*/15 * * * *', $$select private.reengajar_vencidos()$$);
