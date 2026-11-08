-- Chat interno (cláusula 6.4 do contrato do indicador e 5.2 do consultor), 08/11/2026.
-- • Indicador ↔ consultor da carteira: só para falar de ganhos e dados de conta. O robô barra telefone, e-mail,
--   redes sociais/links, profissão e "como você faz as indicações". Mensagem barrada não é entregue e vira alerta
--   para o admin, que pode cancelar os dois contratos e tirar os dois do site.
-- • Consultor ↔ Geralindica (indicador_id nulo): acertos, estornos e suporte. Sem robô.
-- O admin lê todas as conversas (monitoramento).

create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  consultor_id uuid not null references public.consultores(id) on delete cascade,
  indicador_id uuid references public.indicadores(id) on delete cascade,
  autor_id uuid references public.profiles(id) on delete set null,
  texto text not null check (char_length(texto) between 1 and 1000),
  created_at timestamptz not null default now(),
  lida_em timestamptz
);
comment on column public.mensagens.indicador_id is 'Nulo = conversa do consultor com a Geralindica.';
create index mensagens_conversa_idx on public.mensagens (consultor_id, indicador_id, created_at desc);
create index mensagens_indicador_idx on public.mensagens (indicador_id, created_at desc);
alter table public.mensagens enable row level security;
create policy "mensagens: participantes e admin leem" on public.mensagens for select
  using (consultor_id = (select auth.uid()) or indicador_id = (select auth.uid()) or (select private.is_admin()));
revoke all on public.mensagens from anon, authenticated;
grant select on public.mensagens to authenticated;

create table public.chat_alertas (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid references public.profiles(id) on delete cascade,
  consultor_id uuid references public.consultores(id) on delete cascade,
  indicador_id uuid references public.indicadores(id) on delete cascade,
  texto text not null,
  motivo text not null,
  created_at timestamptz not null default now(),
  resolvido_em timestamptz
);
create index chat_alertas_abertos_idx on public.chat_alertas (created_at desc) where resolvido_em is null;
alter table public.chat_alertas enable row level security;
create policy "chat_alertas: admin le" on public.chat_alertas for select using ((select private.is_admin()));
revoke all on public.chat_alertas from anon, authenticated;
grant select on public.chat_alertas to authenticated;

-- O robô: devolve o motivo do bloqueio, ou nulo se a mensagem pode ir.
-- Dados de conta corrente são permitidos (é para isso que o chat existe), então número perto de
-- "agência/conta/banco" só é barrado se tiver cara de telefone (DDD entre parênteses ou +55).
create function private.robo_chat(p_texto text) returns text
language plpgsql immutable set search_path = public as $$
declare
  t text := lower(coalesce(p_texto, ''));
  d text := regexp_replace(lower(coalesce(p_texto, '')), '[[:space:]().+/\-]', '', 'g');
  banco boolean;
  extenso int;
begin
  if t ~ '[a-z0-9._%+-]+[[:space:]]*@[[:space:]]*[a-z0-9-]+[[:space:]]*\.[[:space:]]*[a-z]{2,}'
     or t ~ '\m(arroba|gmail|hotmail|outlook|yahoo|icloud)\M' then
    return 'e-mail';
  end if;
  if t ~ '(https?://|www\.|wa\.me|bit\.ly|\.com\M|\.com\.br|\.net\M|\.org\M)' then return 'link'; end if;
  if t ~ '\m(instagram|insta|facebook|face|tiktok|telegram|whatsapp|whats|zap|zapzap|wpp|watts|linkedin|twitter|kwai|signal|discord|messenger|direct|dm)\M' then
    return 'rede social ou outro aplicativo';
  end if;
  if t ~ '(^|[[:space:]])@[a-z0-9_.]{3,}' then return 'perfil de rede social'; end if;
  if t ~ '\m(telefone|celular|cel|fone|me liga|me ligue|te ligo|liga pra mim|contato fora)\M' then return 'telefone'; end if;

  banco := t ~ '\m(ag|agência|agencia|conta|cc|banco|poupança|poupanca|corrente|operação|operacao)\M';
  if t ~ '\+[[:space:]]*55' or t ~ '\([[:space:]]*[1-9][0-9][[:space:]]*\)[[:space:]]*9?[[:space:]]*[0-9]{4}' then return 'telefone'; end if;
  if not banco and (t ~ '\m9?[0-9]{4}[[:space:].-]?[0-9]{4}\M' or d ~ '[0-9]{10,13}') then return 'telefone'; end if;
  select count(*) into extenso from regexp_matches(t, '\m(zero|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|meia|sete|oito|nove)\M', 'g');
  if extenso >= 7 then return 'telefone escrito por extenso'; end if;

  if t ~ '(minha profiss|qual (a |é a |e a )?sua profiss|trabalho (como|de|na|no|numa|num|em) |\msou (médic|medic|advogad|motorista|uber|taxista|dentista|enfermeir|professor|cabeleireir|manicure|barbeir|corretor|vendedor|vendedora|personal|nutricionista|fisioterapeuta|psicólog|psicolog|farmacêutic|farmaceutic|engenheir|contador|contadora|empresári|empresari|comerciante|policial|bombeir|militar|pastor|estudante|aposentad|autônom|autonom))' then
    return 'profissão';
  end if;
  if t ~ '(como (você |voce |vc |tu )?(divulga|indica|consegue (os |as )?(clientes|indicaç|indicac))|\meu divulgo|\mdivulgo (no|na|nos|nas|em|para|pra|com)|panflet|adesivo|capa de encosto|encosto do carro|grupo de (família|familia|amigos|trabalho|clientes)|minha loja|meu salão|meu salao|meu consultório|meu consultorio|minha clínica|minha clinica|minha academia|meu restaurante|meu comércio|meu comercio)' then
    return 'como você faz as indicações';
  end if;
  return null;
end $$;

create function public.enviar_mensagem(p_consultor uuid, p_indicador uuid, p_texto text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_txt text := trim(coalesce(p_texto, '')); v_motivo text; v_admin boolean := private.is_admin();
begin
  if v_uid is null then raise exception 'Entre na sua conta' using errcode = 'P0001'; end if;
  if char_length(v_txt) = 0 then raise exception 'Escreva a mensagem' using errcode = 'P0001'; end if;
  if char_length(v_txt) > 1000 then raise exception 'Mensagem muito longa (até 1000 letras)' using errcode = 'P0001'; end if;
  if exists (select 1 from public.profiles where id = v_uid and suspenso_em is not null) then raise exception 'Sua conta está suspensa' using errcode = 'P0001'; end if;

  if p_indicador is null then
    if not ((v_uid = p_consultor or v_admin) and exists (select 1 from public.consultores where id = p_consultor)) then
      raise exception 'Conversa não encontrada' using errcode = 'P0001';
    end if;
  else
    if v_uid not in (p_consultor, p_indicador) then raise exception 'Conversa não encontrada' using errcode = 'P0001'; end if;
    if not exists (select 1 from public.indicadores i where i.id = p_indicador and i.consultor_id = p_consultor) then
      raise exception 'Vocês não estão mais na mesma carteira' using errcode = 'P0001';
    end if;
    v_motivo := private.robo_chat(v_txt);
    if v_motivo is not null then
      insert into public.chat_alertas (autor_id, consultor_id, indicador_id, texto, motivo) values (v_uid, p_consultor, p_indicador, v_txt, v_motivo);
      return jsonb_build_object('ok', false, 'motivo', v_motivo);
    end if;
  end if;

  insert into public.mensagens (consultor_id, indicador_id, autor_id, texto) values (p_consultor, p_indicador, v_uid, v_txt);
  return jsonb_build_object('ok', true);
end $$;

create function public.marcar_lidas(p_consultor uuid, p_indicador uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if (p_indicador is null and (v_uid = p_consultor or private.is_admin())) or (p_indicador is not null and v_uid in (p_consultor, p_indicador)) then
    update public.mensagens set lida_em = now()
    where consultor_id = p_consultor and indicador_id is not distinct from p_indicador and lida_em is null
      and autor_id is distinct from v_uid
      -- Na conversa com a Geralindica, o admin só marca como lida a mensagem do consultor (e vice-versa).
      and (p_indicador is not null or (case when v_uid = p_consultor then autor_id <> p_consultor else autor_id = p_consultor end));
  end if;
end $$;

create function public.minhas_conversas()
returns table (consultor_id uuid, indicador_id uuid, titulo text, subtitulo text, ultima text, ultima_em timestamptz, nao_lidas bigint, monitorada boolean, pode_escrever boolean)
language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid(); v_admin boolean := private.is_admin();
begin
  return query
  with conv as (
    select k.id as c, null::uuid as i from public.consultores k where k.id = v or v_admin
    union
    select x.consultor_id, x.id from public.indicadores x where x.consultor_id is not null and (x.id = v or x.consultor_id = v)
    union
    select m.consultor_id, m.indicador_id from public.mensagens m where m.consultor_id = v or m.indicador_id = v or v_admin
  )
  select conv.c, conv.i,
    case when conv.i is null then (case when v = conv.c then 'Geralindica' else k.nome_exibicao end)
         when v = conv.i then k.nome_exibicao
         when v = conv.c then p.nome
         else p.nome || ' × ' || k.nome_exibicao end,
    case when conv.i is null then (case when v = conv.c then 'Acertos, estornos e suporte' else 'Consultor' end)
         when v = conv.i then 'Seu consultor'
         when v = conv.c then 'Indicador da sua carteira'
         else 'Monitorada pelo robô · só leitura' end,
    u.texto, u.created_at,
    (select count(*) from public.mensagens m where m.consultor_id = conv.c and m.indicador_id is not distinct from conv.i and m.lida_em is null
       and m.autor_id is distinct from v
       and ((conv.i is null and (v = conv.c or v_admin) and (case when v = conv.c then m.autor_id <> conv.c else m.autor_id = conv.c end))
            or (conv.i is not null and v in (conv.c, conv.i)))),
    v_admin and conv.i is not null,
    case when conv.i is null then (v = conv.c or v_admin)
         else v in (conv.c, conv.i) and exists (select 1 from public.indicadores x where x.id = conv.i and x.consultor_id = conv.c) end
  from conv
  join public.consultores k on k.id = conv.c
  left join public.profiles p on p.id = conv.i
  left join lateral (select m.texto, m.created_at from public.mensagens m where m.consultor_id = conv.c and m.indicador_id is not distinct from conv.i
                     order by m.created_at desc limit 1) u on true
  order by u.created_at desc nulls last, 3;
end $$;

-- Admin tira do site: suspende, encerra contratos, tira da vitrine e da carteira (os indicadores do consultor ficam sem consultor).
create function public.admin_remover_usuario(p_usuario uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_motivo text := coalesce(nullif(trim(p_motivo), ''), 'Removido pela Geralindica');
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  update public.profiles set suspenso_em = now(), suspenso_motivo = v_motivo where id = p_usuario and papel <> 'admin';
  if not found then raise exception 'Usuário não encontrado' using errcode = 'P0001'; end if;
  perform private.encerrar_contratos(p_usuario, v_motivo);
  update public.consultores set aprovado = false where id = p_usuario;
  update public.indicadores set consultor_id = null where id = p_usuario or consultor_id = p_usuario;
end $$;

create function public.admin_reativar_usuario(p_usuario uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  update public.profiles set suspenso_em = null, suspenso_motivo = null where id = p_usuario;
  if not found then raise exception 'Usuário não encontrado' using errcode = 'P0001'; end if;
  -- Consultor volta sem aprovação (o admin aprova de novo) e com contrato novo para assinar.
  if exists (select 1 from public.consultores where id = p_usuario) then
    insert into public.contratos (tipo, parte_id, consultor_id) values ('consultor', p_usuario, p_usuario);
  end if;
end $$;

create function public.admin_chat_alertas()
returns table (id uuid, created_at timestamptz, motivo text, texto text, autor text, autor_id uuid, consultor_id uuid, consultor text, indicador_id uuid, indicador text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  return query
  select a.id, a.created_at, a.motivo, a.texto, pa.nome, a.autor_id, a.consultor_id, k.nome_exibicao, a.indicador_id, pi.nome
  from public.chat_alertas a
  left join public.profiles pa on pa.id = a.autor_id
  left join public.consultores k on k.id = a.consultor_id
  left join public.profiles pi on pi.id = a.indicador_id
  where a.resolvido_em is null
  order by a.created_at desc limit 200;
end $$;

create function public.admin_resolver_alerta(p_alerta uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  update public.chat_alertas set resolvido_em = now() where id = p_alerta;
end $$;

-- Mensagem nova chega na hora (Realtime respeita o RLS acima).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.mensagens;
  end if;
end $$;

revoke execute on function private.robo_chat(text) from public, anon, authenticated;
revoke execute on function public.enviar_mensagem(uuid, uuid, text), public.marcar_lidas(uuid, uuid), public.minhas_conversas(),
  public.admin_remover_usuario(uuid, text), public.admin_reativar_usuario(uuid), public.admin_chat_alertas(), public.admin_resolver_alerta(uuid) from public, anon;
grant execute on function public.enviar_mensagem(uuid, uuid, text), public.marcar_lidas(uuid, uuid), public.minhas_conversas(),
  public.admin_remover_usuario(uuid, text), public.admin_reativar_usuario(uuid), public.admin_chat_alertas(), public.admin_resolver_alerta(uuid) to authenticated;
