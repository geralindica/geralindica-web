-- Consultor novo só aparece na vitrine e só recebe indicadores depois que o admin aprovar (Admin → Usuários).
-- "publicado" continua sendo do consultor (ele pode se esconder); "aprovado" é só do admin.

alter table public.consultores add column aprovado boolean not null default false;
comment on column public.consultores.aprovado is 'Liberado pelo admin. Sem isso o consultor não aparece na vitrine nem recebe indicadores.';

drop policy "consultores: vitrine publica" on public.consultores;
create policy "consultores: vitrine publica" on public.consultores for select
  using ((publicado and aprovado) or id = (select auth.uid()) or (select private.is_admin()));

-- Indicador só entra na carteira de consultor aprovado e com vaga.
create or replace function private.tg_indicador_vaga() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_max int; v_ocup int; v_aprovado boolean;
begin
  if new.consultor_id is not null and (tg_op = 'INSERT' or new.consultor_id is distinct from old.consultor_id) then
    select max_indicadores, aprovado into v_max, v_aprovado from public.consultores where id = new.consultor_id for update;
    if not coalesce(v_aprovado, false) then raise exception 'Este consultor ainda não foi aprovado pela Geralindica' using errcode = 'P0001'; end if;
    select count(*) into v_ocup from public.indicadores where consultor_id = new.consultor_id;
    if v_ocup >= v_max then raise exception 'Este consultor não tem vagas disponíveis' using errcode = 'P0001'; end if;
    new.consultor_desde := now();
  end if;
  return new;
end $$;

-- No cadastro, consultor não aprovado (ou sem vaga) é ignorado: o indicador entra sem consultor e escolhe depois.
create or replace function private.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}');
  v_papel text := case when m->>'papel' = 'consultor' then 'consultor' else 'indicador' end;
  v_nome text := coalesce(nullif(trim(m->>'nome'), ''), split_part(new.email, '@', 1));
  v_cons uuid; v_max int; v_ocup int; v_aprovado boolean;
begin
  -- contrato_assinado_em fica vazio: quem marca é o admin, depois de conferir o PDF assinado.
  insert into public.profiles (id, papel, nome, tipo_pessoa, documento, telefone, email)
  values (new.id, v_papel, v_nome, case when m->>'tipo_pessoa' = 'PJ' then 'PJ' else 'PF' end, m->>'documento', m->>'telefone', new.email);

  if v_papel = 'consultor' then
    begin v_max := least(30, greatest(1, coalesce((m->>'max_indicadores')::int, 30))); exception when others then v_max := 30; end;
    insert into public.consultores (id, nome_exibicao, cidade, susep, administradora, max_indicadores, bio)
    values (new.id, v_nome, m->>'cidade', m->>'susep', m->>'administradora', v_max, nullif(m->>'bio', ''));
  else
    begin v_cons := nullif(m->>'consultor_id', '')::uuid; exception when others then v_cons := null; end;
    if v_cons is not null then
      select max_indicadores, ocupacao, aprovado into v_max, v_ocup, v_aprovado from public.consultores where id = v_cons;
      if v_max is null or v_ocup >= v_max or not v_aprovado then v_cons := null; end if;
    end if;
    insert into public.indicadores (id, consultor_id, perfil) values (new.id, v_cons, nullif(m->>'perfil', ''));
    insert into public.canais (indicador_id, nome) values (new.id, 'Carro · capa de encosto');
  end if;
  return new;
end $function$;

create function public.admin_aprovar_consultor(p_consultor uuid, p_aprovado boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  update public.consultores set aprovado = p_aprovado where id = p_consultor;
  if not found then raise exception 'Consultor não encontrado'; end if;
end $$;
revoke execute on function public.admin_aprovar_consultor(uuid, boolean) from public, anon;
grant execute on function public.admin_aprovar_consultor(uuid, boolean) to authenticated;
