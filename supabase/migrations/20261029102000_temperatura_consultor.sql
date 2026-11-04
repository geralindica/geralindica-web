-- Temperatura do consultor (reputação pública, de 0 a 100).
-- É ela que faz o consultor registrar as vendas e pagar os indicadores: temperatura baixa = ninguém se filia.
-- O cálculo fica SÓ em private.calcular_temperatura(). Para trocar a fórmula, mude apenas essa função
-- (e rode "select private.recalc_consultor(id) from public.consultores" para atualizar todo mundo).

alter table public.consultores add column temperatura int not null default 0 check (temperatura between 0 and 100);

-- ============================================================================================
-- FÓRMULA PROVISÓRIA (29/10/2026). Eduardo e Luis ainda vão decidir a fórmula oficial.
-- Usa só o que a plataforma já tem:
--   • até 40 pontos pelas vendas aprovadas registradas (40 com 50 vendas ou mais)
--   • até 30 pontos pela nota média das avaliações dos indicadores (1★ = 0, 5★ = 30; sem avaliação = 15)
--   • até 30 pontos pelas vendas aprovadas nos últimos 30 dias (30 com 5 ou mais = "Em alta")
-- ============================================================================================
create or replace function private.calcular_temperatura(p uuid) returns int
language sql stable security definer set search_path = public as $$
  with base as (
    select
      (select count(*) from public.vendas where consultor_id = p and status = 'aprovado') as vendas,
      (select count(*) from public.vendas where consultor_id = p and status = 'aprovado' and data_venda > current_date - 30) as vendas_30d,
      (select avg(estrelas) from public.avaliacoes where consultor_id = p) as media
  )
  select least(100, greatest(0, round(
      40 * least(vendas, 50) / 50.0
    + coalesce(30 * (media - 1) / 4.0, 15)
    + 30 * least(vendas_30d, 5) / 5.0
  )))::int
  from base;
$$;

create or replace function private.recalc_consultor(p uuid) returns void
language sql security definer set search_path = public as $$
  update public.consultores c set
    vendas      = (select count(*) from public.vendas where consultor_id = p and status = 'aprovado'),
    leads_total = (select count(*) from public.leads where consultor_id = p),
    vendas_30d  = (select count(*) from public.vendas where consultor_id = p and status = 'aprovado' and data_venda > current_date - 30),
    ocupacao    = (select count(*) from public.indicadores where consultor_id = p),
    temperatura = private.calcular_temperatura(p)
  where c.id = p;
$$;

-- Avaliação nova (ou apagada) muda a temperatura.
create or replace function private.tg_avaliacao_temperatura() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.recalc_consultor(coalesce(new.consultor_id, old.consultor_id));
  return null;
end $$;
create trigger avaliacao_temperatura after insert or delete on public.avaliacoes
  for each row execute function private.tg_avaliacao_temperatura();

revoke all on function private.calcular_temperatura(uuid), private.recalc_consultor(uuid), private.tg_avaliacao_temperatura() from public, anon, authenticated;

-- Atualiza todos os consultores com as vendas migradas e a temperatura.
select private.recalc_consultor(id) from public.consultores;
