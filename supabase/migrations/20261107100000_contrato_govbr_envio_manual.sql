-- Contrato pelo Gov.br, opção A (grátis): a pessoa baixa o PDF, assina em assinador.iti.br com a conta Gov.br
-- e envia o PDF assinado pelo site. O admin confere e só então o contrato conta como assinado.
-- Antes a etapa era simulada e o próprio cadastro gravava "assinado"; agora só o admin marca.

alter table public.profiles
  add column contrato_arquivo text,
  add column contrato_enviado_em timestamptz;
comment on column public.profiles.contrato_arquivo is 'Caminho do PDF assinado no bucket "contratos" (pasta = id do usuário).';
comment on column public.profiles.contrato_enviado_em is 'Quando a pessoa enviou o PDF assinado. contrato_assinado_em só é preenchido quando o admin confere.';

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
  v_cons uuid; v_max int; v_ocup int;
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
      select max_indicadores, ocupacao into v_max, v_ocup from public.consultores where id = v_cons;
      if v_max is null or v_ocup >= v_max then v_cons := null; end if;
    end if;
    insert into public.indicadores (id, consultor_id, perfil) values (new.id, v_cons, nullif(m->>'perfil', ''));
    insert into public.canais (indicador_id, nome) values (new.id, 'Carro · capa de encosto');
  end if;
  return new;
end $function$;

-- PDFs assinados: bucket privado, cada um na própria pasta; o admin lê todos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contratos', 'contratos', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "contrato: envia na propria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'contratos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "contrato: le propria pasta ou admin" on storage.objects for select to authenticated
  using (bucket_id = 'contratos' and ((storage.foldername(name))[1] = auth.uid()::text or private.is_admin()));

create function public.enviar_contrato(p_arquivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para enviar o contrato'; end if;
  if split_part(coalesce(p_arquivo, ''), '/', 1) <> auth.uid()::text or lower(p_arquivo) !~ '\.pdf$' then
    raise exception 'Arquivo inválido: envie o PDF do contrato assinado';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and contrato_assinado_em is not null) then
    raise exception 'Seu contrato já foi conferido';
  end if;
  update public.profiles set contrato_arquivo = p_arquivo, contrato_enviado_em = now() where id = auth.uid();
end $$;

create function public.admin_conferir_contrato(p_usuario uuid, p_aprovado boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  if p_aprovado then
    update public.profiles set contrato_assinado_em = now() where id = p_usuario and contrato_arquivo is not null;
    if not found then raise exception 'Essa pessoa ainda não enviou o contrato assinado'; end if;
  else
    -- Recusado: a pessoa volta a ver o passo a passo e envia de novo.
    update public.profiles set contrato_arquivo = null, contrato_enviado_em = null, contrato_assinado_em = null where id = p_usuario;
  end if;
end $$;

drop function public.admin_indicadores();
create function public.admin_indicadores()
returns table (id uuid, nome text, perfil text, tipo_pessoa text, consultor text, contrato_assinado_em timestamptz,
  contrato_enviado_em timestamptz, contrato_arquivo text, canais bigint, ativo boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  return query
  select i.id, p.nome, i.perfil, p.tipo_pessoa, c.nome_exibicao, p.contrato_assinado_em, p.contrato_enviado_em, p.contrato_arquivo,
    (select count(*) from public.canais x where x.indicador_id = i.id),
    exists (select 1 from public.leads l where l.indicador_id = i.id and l.created_at > now() - interval '90 days')
  from public.indicadores i join public.profiles p on p.id = i.id left join public.consultores c on c.id = i.consultor_id
  order by p.nome;
end $$;

revoke execute on function public.enviar_contrato(text), public.admin_conferir_contrato(uuid, boolean), public.admin_indicadores() from public, anon;
grant execute on function public.enviar_contrato(text), public.admin_conferir_contrato(uuid, boolean), public.admin_indicadores() to authenticated;
