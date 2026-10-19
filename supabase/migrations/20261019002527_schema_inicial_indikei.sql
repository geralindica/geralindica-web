create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  papel text not null check (papel in ('indicador','consultor','admin')),
  nome text not null,
  tipo_pessoa text not null default 'PF' check (tipo_pessoa in ('PF','PJ')),
  documento text,
  telefone text,
  chave_pix text,
  created_at timestamptz not null default now()
);

create table public.consultores (
  id uuid primary key references public.profiles(id) on delete cascade,
  cidade text, susep text, bio text,
  especialidades text[] not null default '{}',
  foto_url text,
  max_indicadores int not null default 30 check (max_indicadores between 1 and 30),
  nota numeric(2,1),
  publicado boolean not null default true
);

create table public.indicadores (
  id uuid primary key references public.profiles(id) on delete cascade,
  consultor_id uuid references public.consultores(id),
  perfil text,
  consultor_desde timestamptz default now()
);

create table public.canais (
  id uuid primary key default gen_random_uuid(),
  indicador_id uuid not null references public.indicadores(id) on delete cascade,
  codigo text not null unique,
  nome text not null,
  escaneamentos int not null default 0,
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  consultor_id uuid not null references public.consultores(id),
  indicador_id uuid references public.indicadores(id),
  canal_id uuid references public.canais(id),
  nome text not null, cpf text, telefone text,
  plano text, valor_adesao numeric(12,2),
  etapa text not null default 'novo' check (etapa in ('novo','triagem','cotacao','negociacao','contrato','custodia','entrevista','aprovado','reprovado')),
  triagem jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transacoes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  bruto numeric(12,2) not null,
  aliquota numeric(5,2) not null default 27.5,
  pct_indicador numeric(5,2) not null default 50,
  status text not null default 'pendente' check (status in ('pendente','custodia','verdinho','repassado','estornado')),
  created_at timestamptz not null default now(),
  liberado_em timestamptz
);

create table public.config_split (
  id int primary key default 1 check (id = 1),
  aliquota_pf numeric(5,2) not null default 27.5,
  aliquota_pj numeric(5,2) not null default 6,
  pct_indicador numeric(5,2) not null default 50,
  pct_consultor_restante numeric(5,2) not null default 60
);
insert into public.config_split default values;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and papel = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.consultores enable row level security;
alter table public.indicadores enable row level security;
alter table public.canais enable row level security;
alter table public.leads enable row level security;
alter table public.transacoes enable row level security;
alter table public.config_split enable row level security;

create policy "perfil proprio ou admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "atualiza proprio perfil" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and papel <> 'admin');
create policy "cria proprio perfil" on public.profiles for insert with check (id = auth.uid() and papel in ('indicador','consultor'));

create policy "vitrine publica" on public.consultores for select using (publicado or id = auth.uid() or public.is_admin());
create policy "consultor edita proprio" on public.consultores for update using (id = auth.uid() or public.is_admin());
create policy "consultor cria proprio" on public.consultores for insert with check (id = auth.uid());

create policy "indicador ve proprio" on public.indicadores for select using (id = auth.uid() or consultor_id = auth.uid() or public.is_admin());
create policy "indicador cria proprio" on public.indicadores for insert with check (id = auth.uid());
create policy "indicador troca consultor" on public.indicadores for update using (id = auth.uid() or public.is_admin());

create policy "canais do indicador" on public.canais for all using (indicador_id = auth.uid() or public.is_admin()) with check (indicador_id = auth.uid() or public.is_admin());

-- LGPD: indicador NÃO acessa leads diretamente; só via função extrato_indicador()
create policy "leads do consultor" on public.leads for all using (consultor_id = auth.uid() or public.is_admin()) with check (consultor_id = auth.uid() or public.is_admin());

create policy "transacoes consultor ou admin" on public.transacoes for select using (public.is_admin() or exists (select 1 from public.leads l where l.id = lead_id and l.consultor_id = auth.uid()));
create policy "transacoes admin escreve" on public.transacoes for all using (public.is_admin()) with check (public.is_admin());

create policy "config leitura" on public.config_split for select using (auth.uid() is not null);
create policy "config admin" on public.config_split for update using (public.is_admin());

-- Extrato do indicador: só primeiro nome, data, canal, status e valores
create or replace function public.extrato_indicador()
returns table (transacao_id uuid, primeiro_nome text, data timestamptz, canal text, status text, bruto numeric, aliquota numeric, comissao numeric, cpf_final text, tel_final text)
language sql stable security definer set search_path = public as $$
  select t.id, split_part(l.nome, ' ', 1), t.created_at, c.codigo || ' · ' || c.nome, t.status, t.bruto, t.aliquota,
         round(t.bruto * (1 - t.aliquota/100) * t.pct_indicador/100, 2),
         right(regexp_replace(coalesce(l.cpf,''), '\D', '', 'g'), 2),
         right(regexp_replace(coalesce(l.telefone,''), '\D', '', 'g'), 4)
  from public.transacoes t
  join public.leads l on l.id = t.lead_id
  left join public.canais c on c.id = l.canal_id
  where l.indicador_id = auth.uid()
  order by t.created_at desc;
$$;

-- Liberar comissão: só quando status = verdinho
create or replace function public.liberar_comissao(p_transacao uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Apenas admin'; end if;
  update public.transacoes set status = 'repassado', liberado_em = now()
  where id = p_transacao and status = 'verdinho';
  if not found then raise exception 'Comissão só pode ser liberada com status Verdinho'; end if;
end $$;

revoke execute on function public.extrato_indicador() from anon;
revoke execute on function public.liberar_comissao(uuid) from anon;
