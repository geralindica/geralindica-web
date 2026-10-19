create or replace function private.tg_lead_apagado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.recalc_consultor(old.consultor_id);
  return null;
end $$;
create trigger lead_apagado after delete on public.leads for each row execute function private.tg_lead_apagado();
revoke execute on function private.tg_lead_apagado() from public, anon;
