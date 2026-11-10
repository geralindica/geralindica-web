-- Contratos do Luis (08/11/2026): o site se adapta aos contratos, e não o contrário.
-- • Indicador: "Instrumento particular de parceria comercial de indicação de leads". CONTRATANTE = o consultor
--   da carteira; PARCEIRO = o indicador; 2 testemunhas (configuradas pelo admin). Trocou de consultor, contrato novo.
-- • Consultor: "Instrumento particular de parceria comercial e gestão de leads". CONTRATANTE = Geralindica.
-- Cada PDF sai preenchido com os dados do cadastro (gerado no navegador) e é assinado no Gov.br
-- (assinador.iti.br) na ordem: parte → consultor (só no do indicador) → Geralindica (testemunhas/contratante).

-- ---------- Dados que os contratos pedem ----------
alter table public.profiles
  add column rg text check (rg is null or char_length(rg) <= 30),
  add column endereco text check (endereco is null or char_length(endereco) <= 300),
  -- Cláusula 2.3 do consultor: declaração/comprovante de habilitação ou vínculo com corretora.
  add column habilitacao_arquivo text,
  add column habilitacao_enviada_em timestamptz,
  -- Removido do site (ex.: regra do chat, cláusula 6.4 do indicador).
  add column suspenso_em timestamptz,
  add column suspenso_motivo text;
grant update (rg, endereco) on public.profiles to authenticated;

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
  insert into public.profiles (id, papel, nome, tipo_pessoa, documento, telefone, email, rg, endereco)
  values (new.id, v_papel, v_nome, case when m->>'tipo_pessoa' = 'PJ' then 'PJ' else 'PF' end, m->>'documento', m->>'telefone', new.email,
    left(nullif(trim(m->>'rg'), ''), 30), left(nullif(trim(m->>'endereco'), ''), 300));

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

-- ---------- Testemunhas (cláusula 12.1 do indicador) ----------
create table public.config_contrato (
  id int primary key default 1 check (id = 1),
  testemunha1_nome text, testemunha1_cpf text, testemunha1_email text,
  testemunha2_nome text, testemunha2_cpf text, testemunha2_email text,
  updated_at timestamptz not null default now()
);
insert into public.config_contrato (id) values (1);
alter table public.config_contrato enable row level security;
create policy "config_contrato: admin le" on public.config_contrato for select using ((select private.is_admin()));
create policy "config_contrato: admin edita" on public.config_contrato for update using ((select private.is_admin()));
revoke all on public.config_contrato from anon, authenticated;
grant select on public.config_contrato to authenticated;
grant update (testemunha1_nome, testemunha1_cpf, testemunha1_email, testemunha2_nome, testemunha2_cpf, testemunha2_email) on public.config_contrato to authenticated;

-- ---------- Contratos e etapas de assinatura ----------
create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('indicador','consultor')),
  parte_id uuid not null references public.profiles(id) on delete cascade,
  consultor_id uuid not null references public.consultores(id) on delete cascade,
  versao text not null default '2 · 10/11/2026',
  -- parte: falta a parte assinar · consultor: falta o consultor (contratante do indicador) · geralindica: falta a Geralindica
  etapa text not null default 'parte' check (etapa in ('parte','consultor','geralindica','vigente','encerrado')),
  arquivo text,
  observacao text,
  created_at timestamptz not null default now(),
  parte_assinou_em timestamptz,
  consultor_assinou_em timestamptz,
  vigente_em timestamptz,
  encerrado_em timestamptz,
  motivo_encerramento text
);
create unique index contratos_um_ativo_por_pessoa on public.contratos (parte_id) where etapa <> 'encerrado';
create index contratos_consultor_idx on public.contratos (consultor_id, etapa);
alter table public.contratos enable row level security;
create policy "contratos: partes e admin leem" on public.contratos for select
  using (parte_id = (select auth.uid()) or consultor_id = (select auth.uid()) or (select private.is_admin()));
revoke all on public.contratos from anon, authenticated;
grant select on public.contratos to authenticated;

create function private.encerrar_contratos(p_parte uuid, p_motivo text) returns void
language sql security definer set search_path = public as $$
  update public.contratos set etapa = 'encerrado', encerrado_em = now(), motivo_encerramento = p_motivo
  where parte_id = p_parte and etapa <> 'encerrado';
  update public.profiles set contrato_assinado_em = null where id = p_parte;
$$;

create function private.tg_contrato_consultor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.contratos (tipo, parte_id, consultor_id) values ('consultor', new.id, new.id);
  return null;
end $$;
create trigger contrato_do_consultor after insert on public.consultores for each row execute function private.tg_contrato_consultor();

-- Indicador: o contrato é com o consultor da carteira. Trocou de consultor (ou saiu), o anterior se encerra.
create function private.tg_contrato_indicador() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.consultor_id is not distinct from old.consultor_id then return null; end if;
    perform private.encerrar_contratos(new.id, case when new.consultor_id is null then 'Saiu da carteira do consultor' else 'Trocou de consultor' end);
  end if;
  if new.consultor_id is not null then
    insert into public.contratos (tipo, parte_id, consultor_id) values ('indicador', new.id, new.consultor_id);
  end if;
  return null;
end $$;
create trigger contrato_do_indicador after insert or update of consultor_id on public.indicadores
  for each row execute function private.tg_contrato_indicador();

-- Tudo o que o PDF precisa: qualificação das partes (cadastro) e testemunhas. Só para as partes e o admin.
create function public.contrato_dados(p_contrato uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.contratos; t public.config_contrato;
begin
  select * into c from public.contratos where id = p_contrato;
  if not found or not (auth.uid() in (c.parte_id, c.consultor_id) or private.is_admin()) then
    raise exception 'Contrato não encontrado' using errcode = 'P0001';
  end if;
  select * into t from public.config_contrato where id = 1;
  return jsonb_build_object(
    'id', c.id, 'tipo', c.tipo, 'etapa', c.etapa, 'versao', c.versao, 'arquivo', c.arquivo, 'observacao', c.observacao,
    'created_at', c.created_at, 'parte_assinou_em', c.parte_assinou_em, 'consultor_assinou_em', c.consultor_assinou_em, 'vigente_em', c.vigente_em,
    'parte', (select jsonb_build_object('nome', p.nome, 'tipo_pessoa', p.tipo_pessoa, 'documento', p.documento, 'rg', p.rg, 'endereco', p.endereco,
              'email', p.email, 'telefone', p.telefone) from public.profiles p where p.id = c.parte_id),
    'consultor', (select jsonb_build_object('nome', p.nome, 'tipo_pessoa', p.tipo_pessoa, 'documento', p.documento, 'rg', p.rg, 'endereco', p.endereco,
              'email', p.email, 'telefone', p.telefone) from public.profiles p where p.id = c.consultor_id),
    'testemunhas', jsonb_build_array(
      jsonb_build_object('nome', t.testemunha1_nome, 'cpf', t.testemunha1_cpf, 'email', t.testemunha1_email),
      jsonb_build_object('nome', t.testemunha2_nome, 'cpf', t.testemunha2_cpf, 'email', t.testemunha2_email))
  );
end $$;

create function public.meu_contrato() returns jsonb
language sql stable security definer set search_path = public as $$
  select public.contrato_dados(id) from public.contratos where parte_id = auth.uid() and etapa <> 'encerrado';
$$;

-- Consultor: contratos dos indicadores da carteira (ele é o CONTRATANTE e assina depois do indicador).
create function public.contratos_da_carteira()
returns table (id uuid, indicador_id uuid, indicador text, etapa text, arquivo text, parte_assinou_em timestamptz, vigente_em timestamptz, observacao text)
language sql stable security definer set search_path = public as $$
  select c.id, c.parte_id, p.nome, c.etapa, c.arquivo, c.parte_assinou_em, c.vigente_em, c.observacao
  from public.contratos c join public.profiles p on p.id = c.parte_id
  where c.consultor_id = auth.uid() and c.tipo = 'indicador' and c.etapa <> 'encerrado'
  order by (c.etapa = 'consultor') desc, p.nome;
$$;

create function public.contrato_enviar(p_contrato uuid, p_arquivo text) returns text
language plpgsql security definer set search_path = public as $$
declare c public.contratos; v_uid uuid := auth.uid();
begin
  select * into c from public.contratos where id = p_contrato for update;
  if not found or v_uid not in (c.parte_id, c.consultor_id) then raise exception 'Contrato não encontrado' using errcode = 'P0001'; end if;
  if split_part(coalesce(p_arquivo, ''), '/', 1) <> v_uid::text or lower(p_arquivo) !~ '\.pdf$' then
    raise exception 'Arquivo inválido: envie o PDF do contrato assinado' using errcode = 'P0001';
  end if;
  if c.etapa in ('vigente', 'encerrado') then raise exception 'Este contrato já foi conferido' using errcode = 'P0001'; end if;

  if v_uid = c.parte_id and (c.etapa = 'parte' or (c.etapa = 'consultor') or (c.etapa = 'geralindica' and c.tipo = 'consultor')) then
    -- Primeira assinatura (ou reenvio enquanto ninguém assinou depois).
    update public.contratos set arquivo = p_arquivo, parte_assinou_em = now(), observacao = null,
      etapa = case when tipo = 'indicador' then 'consultor' else 'geralindica' end
    where id = c.id returning etapa into c.etapa;
  elsif v_uid = c.consultor_id and c.tipo = 'indicador' and c.etapa in ('consultor', 'geralindica') then
    update public.contratos set arquivo = p_arquivo, consultor_assinou_em = now(), observacao = null, etapa = 'geralindica'
    where id = c.id returning etapa into c.etapa;
  elsif c.etapa = 'parte' then
    raise exception 'O indicador ainda não assinou este contrato' using errcode = 'P0001';
  else
    raise exception 'Agora não é a sua vez de assinar este contrato' using errcode = 'P0001';
  end if;
  return c.etapa;
end $$;

-- Consultor (no contrato do indicador) ou admin devolvem para a parte assinar de novo.
create function public.contrato_recusar(p_contrato uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.contratos;
begin
  select * into c from public.contratos where id = p_contrato for update;
  if not found then raise exception 'Contrato não encontrado' using errcode = 'P0001'; end if;
  if not (private.is_admin() and c.etapa in ('consultor', 'geralindica'))
     and not (auth.uid() = c.consultor_id and c.tipo = 'indicador' and c.etapa = 'consultor') then
    raise exception 'Você não pode devolver este contrato agora' using errcode = 'P0001';
  end if;
  update public.contratos set etapa = 'parte', arquivo = null, parte_assinou_em = null, consultor_assinou_em = null,
    observacao = coalesce(nullif(trim(p_motivo), ''), 'Assine e envie de novo, por favor.')
  where id = c.id;
end $$;

-- Admin: última etapa. Pode trocar o arquivo pela versão com as testemunhas / assinatura da Geralindica.
create function public.admin_concluir_contrato(p_contrato uuid, p_arquivo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c public.contratos;
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  select * into c from public.contratos where id = p_contrato for update;
  if not found then raise exception 'Contrato não encontrado' using errcode = 'P0001'; end if;
  if c.etapa <> 'geralindica' then raise exception 'Este contrato ainda não está pronto para a Geralindica' using errcode = 'P0001'; end if;
  if p_arquivo is not null and (split_part(p_arquivo, '/', 1) <> auth.uid()::text or lower(p_arquivo) !~ '\.pdf$') then
    raise exception 'Arquivo inválido: envie o PDF do contrato assinado' using errcode = 'P0001';
  end if;
  update public.contratos set etapa = 'vigente', vigente_em = now(), arquivo = coalesce(p_arquivo, arquivo), observacao = null where id = c.id;
  update public.profiles set contrato_assinado_em = now() where id = c.parte_id;
end $$;

create function public.admin_contratos()
returns table (id uuid, tipo text, etapa text, parte_id uuid, parte text, consultor text, arquivo text, observacao text,
  created_at timestamptz, parte_assinou_em timestamptz, consultor_assinou_em timestamptz, vigente_em timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  return query
  select c.id, c.tipo, c.etapa, c.parte_id, p.nome, k.nome_exibicao, c.arquivo, c.observacao, c.created_at, c.parte_assinou_em, c.consultor_assinou_em, c.vigente_em
  from public.contratos c join public.profiles p on p.id = c.parte_id join public.consultores k on k.id = c.consultor_id
  where c.etapa <> 'encerrado'
  order by (c.etapa = 'geralindica') desc, c.created_at desc;
end $$;

create function public.enviar_habilitacao(p_arquivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.consultores where id = auth.uid()) then raise exception 'Apenas consultores' using errcode = 'P0001'; end if;
  if split_part(coalesce(p_arquivo, ''), '/', 1) <> auth.uid()::text or lower(p_arquivo) !~ '\.(pdf|jpe?g|png)$' then
    raise exception 'Arquivo inválido: envie PDF, JPG ou PNG' using errcode = 'P0001';
  end if;
  update public.profiles set habilitacao_arquivo = p_arquivo, habilitacao_enviada_em = now() where id = auth.uid();
end $$;

-- ---------- Arquivos ----------
update storage.buckets set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'] where id = 'contratos';
-- O consultor lê o PDF que o indicador assinou (para assinar por cima) e a parte lê a versão final.
create policy "contrato: partes leem o arquivo do contrato" on storage.objects for select to authenticated
  using (bucket_id = 'contratos' and exists (
    select 1 from public.contratos c where c.arquivo = storage.objects.name and (c.parte_id = (select auth.uid()) or c.consultor_id = (select auth.uid()))));

-- ---------- Sai o envio antigo (um PDF por pessoa, sem etapas) ----------
drop function public.enviar_contrato(text);
drop function public.admin_conferir_contrato(uuid, boolean);
drop function public.admin_indicadores();
alter table public.profiles drop column contrato_arquivo, drop column contrato_enviado_em;

create function public.admin_indicadores()
returns table (id uuid, nome text, perfil text, tipo_pessoa text, consultor text, contrato_assinado_em timestamptz,
  contrato_etapa text, canais bigint, ativo boolean, suspenso_em timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  return query
  select i.id, p.nome, i.perfil, p.tipo_pessoa, c.nome_exibicao, p.contrato_assinado_em,
    (select x.etapa from public.contratos x where x.parte_id = i.id and x.etapa <> 'encerrado'),
    (select count(*) from public.canais x where x.indicador_id = i.id),
    exists (select 1 from public.leads l where l.indicador_id = i.id and l.created_at > now() - interval '90 days'),
    p.suspenso_em
  from public.indicadores i join public.profiles p on p.id = i.id left join public.consultores c on c.id = i.consultor_id
  order by p.nome;
end $$;

revoke execute on function private.encerrar_contratos(uuid, text), private.tg_contrato_consultor(), private.tg_contrato_indicador() from public, anon, authenticated;
revoke execute on function public.contrato_dados(uuid), public.meu_contrato(), public.contratos_da_carteira(), public.contrato_enviar(uuid, text),
  public.contrato_recusar(uuid, text), public.admin_concluir_contrato(uuid, text), public.admin_contratos(), public.enviar_habilitacao(text),
  public.admin_indicadores() from public, anon;
grant execute on function public.contrato_dados(uuid), public.meu_contrato(), public.contratos_da_carteira(), public.contrato_enviar(uuid, text),
  public.contrato_recusar(uuid, text), public.admin_concluir_contrato(uuid, text), public.admin_contratos(), public.enviar_habilitacao(text),
  public.admin_indicadores() to authenticated;
