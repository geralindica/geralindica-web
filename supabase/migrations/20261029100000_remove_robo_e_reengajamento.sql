-- Modelo novo (27/10/2026): a plataforma não tem robô de WhatsApp, Cotaí nem reengajamento automático.
-- O consultor faz todo o atendimento. O QR Code continua levando o cliente direto ao WhatsApp do consultor.
-- 1. Desliga o cron de reengajamento de 48h e apaga a função.
-- 2. Apaga o ponto de encaixe do robô (registrar_lead_whatsapp).
-- 3. Tira das leads as colunas da triagem automática, da fila de recuperação e do pedido de desconto.
-- 4. Histórico do lead: "robô" e "PDF" viram "sistema" (o texto antigo fica guardado).
-- 5. Novo criar_lead(): o consultor cadastra o lead à mão, só com código de indicador da própria carteira.

-- ---------- 1. Reengajamento automático ----------
do $$ begin
  perform cron.unschedule('indikei-reengajamento-48h');
exception when others then null;  -- já não existe
end $$;
drop function if exists private.reengajar_vencidos();

-- ---------- 2. Robô do WhatsApp ----------
drop function if exists public.registrar_lead_whatsapp(text, text, text, text, numeric, uuid, jsonb, int, boolean);
drop function if exists public.registrar_lead_whatsapp(text, text, text, text, numeric, uuid);

-- ---------- 3. Colunas que só existiam para robô, recuperação e desconto ----------
alter table public.leads
  drop column if exists triagem,
  drop column if exists triagem_passo,
  drop column if exists abandonou_em,
  drop column if exists reengajado_em,
  drop column if exists desconto_pct,
  drop column if exists desconto_status;

-- ---------- 4. Histórico ----------
update public.lead_eventos set tipo = 'sistema' where tipo in ('robo', 'pdf');
alter table public.lead_eventos drop constraint if exists lead_eventos_tipo_check;
alter table public.lead_eventos add constraint lead_eventos_tipo_check check (tipo in ('consultor','cliente','sistema','nota'));

-- ---------- 5. Consultor cadastra o lead ----------
-- O código é opcional (cliente que chegou sem QR). Se vier, tem de ser de um indicador filiado a este consultor:
-- assim ninguém desvia o lead (e a comissão) para indicador de outra carteira.
create or replace function public.criar_lead(p_nome text, p_telefone text default null, p_codigo text default null, p_plano text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_canal public.canais; v_lead uuid;
begin
  if not exists (select 1 from public.consultores where id = auth.uid()) then raise exception 'Apenas consultores cadastram leads'; end if;
  if char_length(trim(coalesce(p_nome, ''))) < 2 then raise exception 'Informe o nome do cliente' using errcode = 'P0001'; end if;
  if nullif(trim(coalesce(p_codigo, '')), '') is not null then
    select * into v_canal from public.canais where codigo = upper(trim(p_codigo));
    if not found then raise exception 'Código não encontrado' using errcode = 'P0001'; end if;
    if not exists (select 1 from public.indicadores i where i.id = v_canal.indicador_id and i.consultor_id = auth.uid()) then
      raise exception 'Este código é de um indicador de outro consultor' using errcode = 'P0001';
    end if;
  end if;
  insert into public.leads (consultor_id, indicador_id, canal_id, nome, telefone, plano, etapa)
  values (auth.uid(), v_canal.indicador_id, v_canal.id, trim(p_nome), nullif(trim(coalesce(p_telefone, '')), ''), nullif(trim(coalesce(p_plano, '')), ''), 'novo')
  returning id into v_lead;
  insert into public.lead_eventos (lead_id, tipo, texto) values
    (v_lead, 'consultor', case when v_canal.id is null then 'Lead cadastrado pelo consultor (sem código de indicador)'
                               else 'Lead cadastrado pelo consultor · código ' || v_canal.codigo end);
  return v_lead;
end $$;

-- confirmar_atribuicao (auditoria 23/10/2026): só aceita códigos de indicadores do próprio consultor; o admin atribui qualquer um.
create or replace function public.confirmar_atribuicao(p_lead uuid, p_codigo text) returns text
language plpgsql security definer set search_path = public as $$
declare v_canal public.canais; v_nome text; v_lead public.leads; v_admin boolean := private.is_admin();
begin
  select * into v_lead from public.leads where id = p_lead and (consultor_id = auth.uid() or v_admin) for update;
  if not found then raise exception 'Lead não encontrado'; end if;
  select * into v_canal from public.canais where codigo = upper(trim(p_codigo));
  if not found then raise exception 'Código não encontrado' using errcode = 'P0001'; end if;
  if not v_admin and not exists (select 1 from public.indicadores i where i.id = v_canal.indicador_id and i.consultor_id = v_lead.consultor_id) then
    raise exception 'Este código é de um indicador de outro consultor. Peça ao admin para fazer a atribuição' using errcode = 'P0001';
  end if;
  update public.leads set canal_id = v_canal.id, indicador_id = v_canal.indicador_id where id = p_lead;
  select nome into v_nome from public.profiles where id = v_canal.indicador_id;
  insert into public.lead_eventos (lead_id, tipo, texto)
  values (p_lead, case when v_admin then 'sistema' else 'consultor' end,
    'Atribuição confirmada' || case when v_admin then ' pelo admin' else '' end || ': ' || v_canal.codigo || ' · ' || v_nome);
  return v_nome;
end $$;

revoke all on function public.criar_lead(text, text, text, text), public.confirmar_atribuicao(uuid, text) from public, anon;
grant execute on function public.criar_lead(text, text, text, text), public.confirmar_atribuicao(uuid, text) to authenticated;
