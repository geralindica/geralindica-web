-- O robô do WhatsApp (webhook com a chave service_role) também pode registrar leads,
-- informando o passo da triagem e se o cliente abandonou a conversa.
drop function public.registrar_lead_whatsapp(text, text, text, text, numeric, uuid);
create or replace function public.registrar_lead_whatsapp(
  p_codigo text, p_nome text, p_telefone text, p_plano text default null, p_valor numeric default null,
  p_consultor uuid default null, p_triagem jsonb default null, p_triagem_passo int default null, p_abandonou boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_canal public.canais; v_cons uuid; v_lead uuid; v_robo boolean := coalesce(auth.role(), '') = 'service_role';
begin
  if not (v_robo or private.is_admin() or exists (select 1 from public.consultores where id = auth.uid())) then raise exception 'Sem permissão'; end if;
  select * into v_canal from public.canais where codigo = upper(trim(coalesce(p_codigo, '')));
  if found then select consultor_id into v_cons from public.indicadores where id = v_canal.indicador_id; end if;
  v_cons := coalesce(v_cons, p_consultor, case when v_robo then null else auth.uid() end);
  if v_cons is null then raise exception 'Sem consultor para receber o lead (informe p_consultor)' using errcode = 'P0001'; end if;
  if not v_robo and not private.is_admin() and v_cons <> auth.uid() then
    raise exception 'Esse código pertence a um indicador de outro consultor' using errcode = 'P0001';
  end if;
  insert into public.leads (consultor_id, indicador_id, canal_id, nome, telefone, plano, valor_adesao, etapa, triagem, triagem_passo, abandonou_em)
  values (v_cons, v_canal.indicador_id, v_canal.id, p_nome, p_telefone, p_plano, p_valor,
    case when coalesce(p_triagem_passo, 0) >= 7 then 'cotacao' when coalesce(p_triagem_passo, 0) > 0 then 'triagem' else 'novo' end,
    coalesce(p_triagem, '{}'), coalesce(p_triagem_passo, 0), case when p_abandonou then now() end)
  returning id into v_lead;
  insert into public.lead_eventos (lead_id, tipo, texto) values
    (v_lead, 'robo', case when v_canal.id is null then 'Cliente iniciou conversa sem código de canal' else 'Cliente escaneou ' || v_canal.codigo || ' e iniciou conversa' end);
  return v_lead;
end $$;
revoke execute on function public.registrar_lead_whatsapp(text, text, text, text, numeric, uuid, jsonb, int, boolean) from public, anon;
grant execute on function public.registrar_lead_whatsapp(text, text, text, text, numeric, uuid, jsonb, int, boolean) to authenticated, service_role;
