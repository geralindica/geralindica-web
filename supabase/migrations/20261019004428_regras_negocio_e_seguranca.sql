-- ===== Helpers fora da API =====
create schema if not exists private;
alter function public.is_admin() set schema private;
grant usage on schema private to authenticated, anon;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

-- ===== Colunas novas =====
alter table public.profiles add column email text, add column contrato_assinado_em timestamptz;

alter table public.consultores
  add column nome_exibicao text not null default '',
  add column administradora text,
  add column vendas int not null default 0,
  add column leads_total int not null default 0,
  add column vendas_30d int not null default 0,
  add column ocupacao int not null default 0;

alter table public.canais add column numero int not null default 1;

alter table public.leads
  add column triagem_passo int not null default 0,
  add column abandonou_em timestamptz,
  add column reengajado_em timestamptz,
  add column desconto_pct int check (desconto_pct between 15 and 50),
  add column desconto_status text check (desconto_status in ('solicitado','aprovado','recusado'));

alter table public.config_split add column whatsapp_numero text not null default '5519900000000';

create table public.lead_eventos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  tipo text not null default 'nota' check (tipo in ('robo','pdf','consultor','cliente','sistema','nota')),
  texto text not null,
  created_at timestamptz not null default now()
);

create table public.saques (
  id uuid primary key default gen_random_uuid(),
  indicador_id uuid not null references public.indicadores(id) on delete cascade,
  valor numeric(12,2) not null,
  qtd int not null,
  created_at timestamptz not null default now()
);
alter table public.transacoes add column saque_id uuid references public.saques(id);

create table public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  consultor_id uuid not null references public.consultores(id) on delete cascade,
  indicador_id uuid references public.indicadores(id) on delete set null,
  autor text not null,
  estrelas int not null check (estrelas between 1 and 5),
  texto text not null check (char_length(texto) <= 400),
  created_at timestamptz not null default now()
);

create table public.produtos (
  id text primary key,
  nome text not null,
  descricao text not null,
  icone text not null,
  status text not null default 'em_breve' check (status in ('ativo','em_breve')),
  previsao text,
  lista_espera boolean not null default false,
  ordem int not null default 0
);

create index on public.leads (consultor_id, etapa);
create index on public.leads (indicador_id);
create index on public.indicadores (consultor_id);
create index on public.canais (indicador_id);
create index on public.lead_eventos (lead_id, created_at);
create index on public.transacoes (status);

-- ===== RLS das tabelas novas =====
alter table public.lead_eventos enable row level security;
alter table public.saques enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.produtos enable row level security;

create policy "eventos do lead do consultor" on public.lead_eventos for select
  using (private.is_admin() or exists (select 1 from public.leads l where l.id = lead_id and l.consultor_id = auth.uid()));
create policy "consultor registra evento" on public.lead_eventos for insert
  with check (exists (select 1 from public.leads l where l.id = lead_id and l.consultor_id = auth.uid()));

create policy "saques proprios" on public.saques for select using (indicador_id = auth.uid() or private.is_admin());

create policy "avaliacoes publicas" on public.avaliacoes for select using (true);
create policy "indicador avalia seu consultor" on public.avaliacoes for insert
  with check (indicador_id = auth.uid() and exists (select 1 from public.indicadores i where i.id = auth.uid() and i.consultor_id = consultor_id));

create policy "catalogo publico" on public.produtos for select using (true);
create policy "admin edita catalogo" on public.produtos for update using (private.is_admin());

-- consultor enxerga o perfil dos seus indicadores
create policy "consultor ve seus indicadores" on public.profiles for select
  using (exists (select 1 from public.indicadores i where i.id = profiles.id and i.consultor_id = auth.uid()));

-- transações: só leitura via API; escrita só por triggers/funções
drop policy "transacoes admin escreve" on public.transacoes;

-- ===== Privilégios por coluna (ninguém mexe em métricas, papel ou atribuição) =====
revoke insert, update, delete on public.profiles, public.consultores, public.indicadores, public.canais, public.leads, public.transacoes, public.config_split, public.saques, public.avaliacoes, public.produtos, public.lead_eventos from anon, authenticated;
revoke select on public.profiles, public.indicadores, public.canais, public.leads, public.transacoes, public.config_split, public.saques, public.lead_eventos from anon;

grant update (nome, tipo_pessoa, documento, telefone, chave_pix) on public.profiles to authenticated;
grant update (nome_exibicao, cidade, bio, especialidades, foto_url, publicado) on public.consultores to authenticated;
grant update (consultor_id, perfil) on public.indicadores to authenticated;
grant insert (indicador_id, nome) on public.canais to authenticated;
grant update (nome) on public.canais to authenticated;
grant delete on public.canais to authenticated;
grant update (etapa, nome, plano, valor_adesao, triagem, reengajado_em, desconto_pct, desconto_status) on public.leads to authenticated;
grant insert (lead_id, tipo, texto) on public.lead_eventos to authenticated;
grant insert (consultor_id, indicador_id, estrelas, texto, autor) on public.avaliacoes to authenticated;
grant update (aliquota_pf, aliquota_pj, pct_indicador, pct_consultor_restante, whatsapp_numero) on public.config_split to authenticated;
grant update (lista_espera) on public.produtos to authenticated;
drop policy "cria proprio perfil" on public.profiles;
drop policy "consultor cria proprio" on public.consultores;
drop policy "indicador cria proprio" on public.indicadores;
drop policy "canais do indicador" on public.canais;
create policy "canais: ler" on public.canais for select using (indicador_id = auth.uid() or private.is_admin()
  or exists (select 1 from public.indicadores i where i.id = canais.indicador_id and i.consultor_id = auth.uid()));
create policy "canais: criar" on public.canais for insert with check (indicador_id = auth.uid());
create policy "canais: editar" on public.canais for update using (indicador_id = auth.uid());
create policy "canais: apagar" on public.canais for delete using (indicador_id = auth.uid());
drop policy "leads do consultor" on public.leads;
create policy "leads: consultor le" on public.leads for select using (consultor_id = auth.uid() or private.is_admin());
create policy "leads: consultor edita" on public.leads for update using (consultor_id = auth.uid()) with check (consultor_id = auth.uid());
drop policy "atualiza proprio perfil" on public.profiles;
create policy "atualiza proprio perfil" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ===== Funções internas =====
create or replace function private.novo_codigo() returns text language sql volatile as $$
  select 'IDK' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
$$;

create or replace function private.recalc_consultor(p uuid) returns void
language sql security definer set search_path = public as $$
  update public.consultores c set
    vendas      = (select count(*) from public.leads where consultor_id = p and etapa = 'aprovado'),
    leads_total = (select count(*) from public.leads where consultor_id = p),
    vendas_30d  = (select count(*) from public.leads where consultor_id = p and etapa = 'aprovado' and updated_at > now() - interval '30 days'),
    ocupacao    = (select count(*) from public.indicadores where consultor_id = p)
  where c.id = p;
$$;

-- canal: código único e número sequencial
create or replace function private.tg_canal_codigo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.codigo := private.novo_codigo();
  new.numero := coalesce((select max(numero) from public.canais where indicador_id = new.indicador_id), 0) + 1;
  new.escaneamentos := 0;
  return new;
end $$;
create trigger canal_codigo before insert on public.canais for each row execute function private.tg_canal_codigo();

-- vagas: consultor não passa do limite (portabilidade só para quem tem vaga)
create or replace function private.tg_indicador_vaga() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_max int; v_ocup int;
begin
  if new.consultor_id is not null and (tg_op = 'INSERT' or new.consultor_id is distinct from old.consultor_id) then
    select max_indicadores into v_max from public.consultores where id = new.consultor_id for update;
    select count(*) into v_ocup from public.indicadores where consultor_id = new.consultor_id;
    if v_ocup >= v_max then raise exception 'Este consultor não tem vagas disponíveis' using errcode = 'P0001'; end if;
    new.consultor_desde := now();
  end if;
  return new;
end $$;
create trigger indicador_vaga before insert or update of consultor_id on public.indicadores for each row execute function private.tg_indicador_vaga();

create or replace function private.tg_indicador_metricas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT','UPDATE') and new.consultor_id is not null then perform private.recalc_consultor(new.consultor_id); end if;
  if tg_op in ('UPDATE','DELETE') and old.consultor_id is not null and (tg_op = 'DELETE' or old.consultor_id is distinct from new.consultor_id) then perform private.recalc_consultor(old.consultor_id); end if;
  return null;
end $$;
create trigger indicador_metricas after insert or update or delete on public.indicadores for each row execute function private.tg_indicador_metricas();

-- leads: updated_at, regra do verdinho e histórico
create or replace function private.tg_lead_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if new.etapa is distinct from old.etapa then
    select status into v_status from public.transacoes where lead_id = new.id;
    if v_status = 'repassado' and new.etapa <> 'aprovado' then
      raise exception 'A comissão deste lead já foi repassada; a etapa não pode mais mudar' using errcode = 'P0001';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger lead_antes before update on public.leads for each row execute function private.tg_lead_antes();

create or replace function private.tg_lead_depois() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cfg public.config_split; v_tp text; v_aliq numeric; v_status text;
  v_nomes jsonb := '{"novo":"Novo","triagem":"Em triagem (robô)","cotacao":"Cotação enviada","negociacao":"Negociação","contrato":"Contrato emitido","custodia":"Pagamento em custódia","entrevista":"Entrevista de saúde","aprovado":"Aprovado (Verdinho)","reprovado":"Reprovado (estornado)"}';
begin
  if tg_op = 'INSERT' or new.etapa is distinct from old.etapa then
    select * into v_cfg from public.config_split where id = 1;
    select p.tipo_pessoa into v_tp from public.profiles p where p.id = new.indicador_id;
    v_aliq := case when v_tp = 'PJ' then v_cfg.aliquota_pj else v_cfg.aliquota_pf end;
    select status into v_status from public.transacoes where lead_id = new.id;

    if new.etapa in ('contrato','custodia','entrevista','aprovado') and v_status is null then
      insert into public.transacoes (lead_id, bruto, aliquota, pct_indicador, status, created_at)
      values (new.id, coalesce(new.valor_adesao, 0), v_aliq, v_cfg.pct_indicador, 'pendente', coalesce(new.updated_at, now()));
      v_status := 'pendente';
    end if;

    if v_status is not null and v_status <> 'repassado' then
      update public.transacoes set
        status = case
          when new.etapa = 'aprovado' then 'verdinho'
          when new.etapa = 'reprovado' then 'estornado'
          when new.etapa in ('custodia','entrevista') then 'custodia'
          else 'pendente' end,
        bruto = coalesce(new.valor_adesao, bruto)
      where lead_id = new.id;
    end if;

    if tg_op = 'UPDATE' then
      insert into public.lead_eventos (lead_id, tipo, texto) values (new.id, 'sistema', 'Movido para ' || (v_nomes ->> new.etapa));
    end if;
  end if;

  perform private.recalc_consultor(new.consultor_id);
  if tg_op = 'UPDATE' and old.consultor_id is distinct from new.consultor_id then perform private.recalc_consultor(old.consultor_id); end if;
  return null;
end $$;
create trigger lead_depois after insert or update on public.leads for each row execute function private.tg_lead_depois();

-- novo usuário: cria perfil, papel e primeiro QR Code
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}');
  v_papel text := case when m->>'papel' = 'consultor' then 'consultor' else 'indicador' end;
  v_nome text := coalesce(nullif(trim(m->>'nome'), ''), split_part(new.email, '@', 1));
  v_cons uuid; v_max int; v_ocup int; v_assinado timestamptz;
begin
  begin v_assinado := nullif(m->>'contrato_assinado_em', '')::timestamptz; exception when others then v_assinado := null; end;
  insert into public.profiles (id, papel, nome, tipo_pessoa, documento, telefone, email, contrato_assinado_em)
  values (new.id, v_papel, v_nome, case when m->>'tipo_pessoa' = 'PJ' then 'PJ' else 'PF' end, m->>'documento', m->>'telefone', new.email, v_assinado);

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
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

-- avaliações: autor = primeiro nome + perfil do indicador
create or replace function private.tg_avaliacao_autor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.indicador_id is not null then
    select split_part(p.nome, ' ', 1) || coalesce(', ' || lower(i.perfil), '') into new.autor
    from public.profiles p left join public.indicadores i on i.id = p.id where p.id = new.indicador_id;
  end if;
  return new;
end $$;
create trigger avaliacao_autor before insert on public.avaliacoes for each row execute function private.tg_avaliacao_autor();

-- ===== RPCs públicas da API =====
-- QR Code escaneado: conta o acesso e devolve o link do WhatsApp (sem login, de propósito)
create or replace function public.registrar_escaneamento(p_codigo text)
returns table (whatsapp text, mensagem text)
language plpgsql security definer set search_path = public as $$
declare v_num int;
begin
  update public.canais set escaneamentos = escaneamentos + 1 where codigo = upper(p_codigo) returning numero into v_num;
  if not found then return; end if;
  return query select c.whatsapp_numero,
    'Gostaria de uma simulação referente a plano de saúde (canal ' || lpad(v_num::text, 2, '0') || ' · ' || upper(p_codigo) || ')'
  from public.config_split c where c.id = 1;
end $$;

-- funil do indicador (só contagens, sem dado pessoal)
create or replace function public.funil_indicador()
returns table (escaneamentos bigint, conversas bigint, cotacoes bigint, fechados bigint, aprovados bigint, leads_andamento bigint)
language sql stable security definer set search_path = public as $$
  select
    (select coalesce(sum(escaneamentos), 0) from public.canais where indicador_id = auth.uid()),
    count(*),
    count(*) filter (where etapa in ('cotacao','negociacao','contrato','custodia','entrevista','aprovado','reprovado')),
    count(*) filter (where etapa in ('contrato','custodia','entrevista','aprovado','reprovado')),
    count(*) filter (where etapa = 'aprovado'),
    count(*) filter (where etapa not in ('aprovado','reprovado'))
  from public.leads where indicador_id = auth.uid();
$$;

-- leads por canal do indicador (contagens)
create or replace function public.canais_resumo()
returns table (canal_id uuid, fechados bigint, aprovados bigint)
language sql stable security definer set search_path = public as $$
  select c.id,
    count(l.*) filter (where l.etapa in ('contrato','custodia','entrevista','aprovado','reprovado')),
    count(l.*) filter (where l.etapa = 'aprovado')
  from public.canais c left join public.leads l on l.canal_id = c.id
  where c.indicador_id = auth.uid() group by c.id;
$$;

-- saque via Pix (integração de pagamento simulada: repasse imediato)
create or replace function public.solicitar_saque()
returns public.saques language plpgsql security definer set search_path = public as $$
declare v_saque public.saques; v_total numeric; v_qtd int;
begin
  if auth.uid() is null then raise exception 'Faça login'; end if;
  if (select chave_pix from public.profiles where id = auth.uid()) is null then
    raise exception 'Cadastre sua chave Pix antes de sacar' using errcode = 'P0001';
  end if;
  select coalesce(sum(round(t.bruto * (1 - t.aliquota/100) * t.pct_indicador/100, 2)), 0), count(*)
    into v_total, v_qtd
  from public.transacoes t join public.leads l on l.id = t.lead_id
  where l.indicador_id = auth.uid() and t.status = 'verdinho';
  if v_qtd = 0 then raise exception 'Nenhuma comissão liberada para saque' using errcode = 'P0001'; end if;
  insert into public.saques (indicador_id, valor, qtd) values (auth.uid(), v_total, v_qtd) returning * into v_saque;
  update public.transacoes t set status = 'repassado', liberado_em = now(), saque_id = v_saque.id
  from public.leads l where l.id = t.lead_id and l.indicador_id = auth.uid() and t.status = 'verdinho';
  return v_saque;
end $$;

-- admin libera uma comissão (só Verdinho)
create or replace function public.liberar_comissao(p_transacao uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_ind uuid; v_valor numeric; v_saque uuid;
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  select l.indicador_id, round(t.bruto * (1 - t.aliquota/100) * t.pct_indicador/100, 2) into v_ind, v_valor
  from public.transacoes t join public.leads l on l.id = t.lead_id where t.id = p_transacao and t.status = 'verdinho';
  if not found then raise exception 'Comissão só pode ser liberada com status Verdinho' using errcode = 'P0001'; end if;
  if v_ind is not null then
    insert into public.saques (indicador_id, valor, qtd) values (v_ind, v_valor, 1) returning id into v_saque;
  end if;
  update public.transacoes set status = 'repassado', liberado_em = now(), saque_id = v_saque where id = p_transacao;
end $$;

-- admin ajusta limite de vagas (nunca abaixo da ocupação, nunca acima de 30)
create or replace function public.definir_limite_vagas(p_consultor uuid, p_max int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  update public.consultores set max_indicadores = least(30, greatest(ocupacao, greatest(1, p_max))) where id = p_consultor;
end $$;

-- consultor confirma atribuição pelo código impresso no material
create or replace function public.confirmar_atribuicao(p_lead uuid, p_codigo text) returns text
language plpgsql security definer set search_path = public as $$
declare v_canal public.canais; v_nome text;
begin
  if not exists (select 1 from public.leads where id = p_lead and consultor_id = auth.uid()) then raise exception 'Lead não encontrado'; end if;
  select * into v_canal from public.canais where codigo = upper(trim(p_codigo));
  if not found then raise exception 'Código não encontrado' using errcode = 'P0001'; end if;
  update public.leads set canal_id = v_canal.id, indicador_id = v_canal.indicador_id where id = p_lead;
  select nome into v_nome from public.profiles where id = v_canal.indicador_id;
  insert into public.lead_eventos (lead_id, tipo, texto) values (p_lead, 'consultor', 'Atribuição confirmada: ' || v_canal.codigo || ' · ' || v_nome);
  return v_nome;
end $$;

-- ponto de encaixe do robô do WhatsApp: cria o lead a partir do código do canal.
-- Em produção quem chama é o webhook do robô (service role); aqui o consultor/admin pode simular.
create or replace function public.registrar_lead_whatsapp(p_codigo text, p_nome text, p_telefone text, p_plano text default null, p_valor numeric default null, p_consultor uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_canal public.canais; v_cons uuid; v_lead uuid;
begin
  if not (private.is_admin() or exists (select 1 from public.consultores where id = auth.uid())) then raise exception 'Sem permissão'; end if;
  select * into v_canal from public.canais where codigo = upper(trim(coalesce(p_codigo, '')));
  if found then select consultor_id into v_cons from public.indicadores where id = v_canal.indicador_id; end if;
  v_cons := coalesce(v_cons, p_consultor, auth.uid());
  if not private.is_admin() and v_cons <> auth.uid() then
    raise exception 'Esse código pertence a um indicador de outro consultor' using errcode = 'P0001';
  end if;
  insert into public.leads (consultor_id, indicador_id, canal_id, nome, telefone, plano, valor_adesao, etapa)
  values (v_cons, v_canal.indicador_id, v_canal.id, p_nome, p_telefone, p_plano, p_valor, 'novo') returning id into v_lead;
  insert into public.lead_eventos (lead_id, tipo, texto) values
    (v_lead, 'robo', case when v_canal.id is null then 'Cliente iniciou conversa sem código de canal' else 'Cliente escaneou ' || v_canal.codigo || ' e iniciou conversa' end);
  return v_lead;
end $$;

-- painel do consultor: nome dos indicadores + contagens
create or replace function public.meus_indicadores()
returns table (id uuid, nome text, perfil text, tipo_pessoa text, canais text[], leads bigint, aprovados bigint, comissao numeric, consultor_desde timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, p.nome, i.perfil, p.tipo_pessoa,
    coalesce((select array_agg('CANAL ' || lpad(c.numero::text, 2, '0') order by c.numero) from public.canais c where c.indicador_id = i.id), '{}'),
    (select count(*) from public.leads l where l.indicador_id = i.id and l.consultor_id = auth.uid()),
    (select count(*) from public.leads l where l.indicador_id = i.id and l.consultor_id = auth.uid() and l.etapa = 'aprovado'),
    (select coalesce(sum(round(t.bruto * (1 - t.aliquota/100) * t.pct_indicador/100, 2)), 0) from public.transacoes t join public.leads l on l.id = t.lead_id
       where l.indicador_id = i.id and l.consultor_id = auth.uid() and t.status in ('verdinho','repassado')),
    i.consultor_desde
  from public.indicadores i join public.profiles p on p.id = i.id
  where i.consultor_id = auth.uid()
  order by 7 desc;
$$;

-- admin: transações com nomes (cliente abreviado)
create or replace function public.admin_transacoes()
returns table (id uuid, created_at timestamptz, cliente text, consultor text, indicador text, bruto numeric, comissao numeric, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  return query
  select t.id, t.created_at,
    split_part(l.nome, ' ', 1) || coalesce(' ' || left(nullif(split_part(l.nome, ' ', 2), ''), 1) || '.', ''),
    c.nome_exibicao, coalesce(p.nome, 'Atribuição pendente'),
    t.bruto, round(t.bruto * (1 - t.aliquota/100) * t.pct_indicador/100, 2), t.status
  from public.transacoes t join public.leads l on l.id = t.lead_id
  join public.consultores c on c.id = l.consultor_id
  left join public.profiles p on p.id = l.indicador_id
  order by t.created_at desc limit 500;
end $$;

-- admin: indicadores com consultor e canais
create or replace function public.admin_indicadores()
returns table (id uuid, nome text, perfil text, tipo_pessoa text, consultor text, contrato_assinado_em timestamptz, canais bigint, ativo boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Apenas admin'; end if;
  return query
  select i.id, p.nome, i.perfil, p.tipo_pessoa, c.nome_exibicao, p.contrato_assinado_em,
    (select count(*) from public.canais x where x.indicador_id = i.id),
    exists (select 1 from public.leads l where l.indicador_id = i.id and l.created_at > now() - interval '90 days')
  from public.indicadores i join public.profiles p on p.id = i.id left join public.consultores c on c.id = i.consultor_id
  order by p.nome;
end $$;

-- ===== Permissões de execução =====
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function public.registrar_escaneamento(text) to anon, authenticated;
grant execute on function public.extrato_indicador(), public.funil_indicador(), public.canais_resumo(), public.solicitar_saque(),
  public.liberar_comissao(uuid), public.definir_limite_vagas(uuid, int), public.confirmar_atribuicao(uuid, text),
  public.registrar_lead_whatsapp(text, text, text, text, numeric, uuid), public.meus_indicadores(), public.admin_transacoes(), public.admin_indicadores()
  to authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

-- catálogo inicial
insert into public.produtos (id, nome, descricao, icone, status, previsao, ordem) values
  ('saude', 'Plano de Saúde', 'Custódia até entrevista · split 50/50 sobre o líquido', 'health', 'ativo', null, 0),
  ('odonto', 'Odonto', 'Planos odontológicos individuais e familiares, sem carência para limpeza.', 'odonto', 'em_breve', '1º tri/2027', 1),
  ('estetica', 'Estética', 'Pacotes em clínicas parceiras com comissão por procedimento.', 'estetica', 'em_breve', '2º tri/2027', 2),
  ('suplementos', 'Suplementos', 'Indicação de produtos com cupom rastreado por canal.', 'suplementos', 'em_breve', '2º tri/2027', 3),
  ('convenios', 'Convênios locais', 'Descontos em farmácias, academias e laboratórios da cidade.', 'convenios', 'em_breve', 'A definir', 4);

-- anon precisa avaliar is_admin() nas políticas públicas (vitrine)
grant execute on function private.is_admin() to anon;
