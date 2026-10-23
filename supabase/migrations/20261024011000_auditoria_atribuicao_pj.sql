-- Auditoria de segurança de 23/10/2026 · correções antes do lançamento
-- 1. confirmar_atribuicao só aceita códigos de indicadores do próprio consultor (o admin pode atribuir qualquer um).
-- 2. Indicador só vira PJ com CNPJ válido (muda a alíquota do split).

create or replace function public.confirmar_atribuicao(p_lead uuid, p_codigo text) returns text
language plpgsql security definer set search_path = public as $$
declare v_canal public.canais; v_nome text; v_lead public.leads; v_admin boolean := private.is_admin();
begin
  select * into v_lead from public.leads where id = p_lead and (consultor_id = auth.uid() or v_admin) for update;
  if not found then raise exception 'Lead não encontrado'; end if;
  select * into v_canal from public.canais where codigo = upper(trim(p_codigo));
  if not found then raise exception 'Código não encontrado' using errcode = 'P0001'; end if;
  if not v_admin then
    if not exists (select 1 from public.indicadores i where i.id = v_canal.indicador_id and i.consultor_id = v_lead.consultor_id) then
      raise exception 'Este código é de um indicador de outro consultor. Peça ao admin para fazer a atribuição' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.transacoes where lead_id = p_lead and status in ('verdinho','em_saque','repassado')) then
      raise exception 'A comissão deste lead já foi liberada; só o admin pode mudar o indicador' using errcode = 'P0001';
    end if;
  end if;
  update public.leads set canal_id = v_canal.id, indicador_id = v_canal.indicador_id where id = p_lead;
  select nome into v_nome from public.profiles where id = v_canal.indicador_id;
  insert into public.lead_eventos (lead_id, tipo, texto)
  values (p_lead, case when v_admin then 'sistema' else 'consultor' end,
    'Atribuição confirmada' || case when v_admin then ' pelo admin' else '' end || ': ' || v_canal.codigo || ' · ' || v_nome);
  return v_nome;
end $$;

-- CNPJ com 14 dígitos e dígitos verificadores corretos.
create or replace function private.cnpj_valido(p text) returns boolean
language plpgsql immutable set search_path = public as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g'); s int; r int; i int;
  p1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2]; p2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
begin
  if length(d) <> 14 or d ~ '^(\d)\1{13}$' then return false; end if;
  s := 0; for i in 1..12 loop s := s + substr(d, i, 1)::int * p1[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  if r <> substr(d, 13, 1)::int then return false; end if;
  s := 0; for i in 1..13 loop s := s + substr(d, i, 1)::int * p2[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  return r = substr(d, 14, 1)::int;
end $$;

create or replace function private.tg_profile_pj() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tipo_pessoa = 'PJ' and not private.cnpj_valido(new.documento) then
    if tg_op = 'INSERT' then
      new.tipo_pessoa := 'PF';  -- cadastro com CNPJ inválido entra como PF (alíquota maior) até corrigir
    elsif not private.pode_decidir() then
      raise exception 'Para receber como PJ, informe um CNPJ válido no campo documento' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profile_pj on public.profiles;
create trigger profile_pj before insert or update of tipo_pessoa, documento on public.profiles
  for each row execute function private.tg_profile_pj();

revoke all on function private.cnpj_valido(text), private.tg_profile_pj() from public, anon, authenticated;
