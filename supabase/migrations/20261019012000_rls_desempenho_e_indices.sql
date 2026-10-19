-- Aplicada no projeto como "rls_desempenho_e_indices".
-- (1) search_path fixo; (2) índices das FKs; (3) políticas com (select auth.uid()) para avaliar uma vez por consulta;
-- (4) corrige "indicador avalia seu consultor", que comparava consultor_id com ele mesmo.
alter function private.novo_codigo() set search_path = public;

create index if not exists avaliacoes_consultor_idx on public.avaliacoes (consultor_id, created_at desc);
create index if not exists avaliacoes_indicador_idx on public.avaliacoes (indicador_id);
create index if not exists leads_canal_idx on public.leads (canal_id);
create index if not exists saques_indicador_idx on public.saques (indicador_id, created_at desc);
create index if not exists transacoes_saque_idx on public.transacoes (saque_id);

drop policy "perfil proprio ou admin" on public.profiles;
drop policy "consultor ve seus indicadores" on public.profiles;
drop policy "atualiza proprio perfil" on public.profiles;
create policy "profiles: ler" on public.profiles for select using (
  id = (select auth.uid()) or (select private.is_admin())
  or exists (select 1 from public.indicadores i where i.id = profiles.id and i.consultor_id = (select auth.uid())));
create policy "profiles: editar o proprio" on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy "vitrine publica" on public.consultores;
drop policy "consultor edita proprio" on public.consultores;
create policy "consultores: vitrine publica" on public.consultores for select using (publicado or id = (select auth.uid()) or (select private.is_admin()));
create policy "consultores: edita o proprio" on public.consultores for update using (id = (select auth.uid()) or (select private.is_admin()));

drop policy "indicador ve proprio" on public.indicadores;
drop policy "indicador troca consultor" on public.indicadores;
create policy "indicadores: ler" on public.indicadores for select using (id = (select auth.uid()) or consultor_id = (select auth.uid()) or (select private.is_admin()));
create policy "indicadores: trocar consultor" on public.indicadores for update using (id = (select auth.uid()) or (select private.is_admin()));

drop policy "canais: ler" on public.canais;
drop policy "canais: criar" on public.canais;
drop policy "canais: editar" on public.canais;
drop policy "canais: apagar" on public.canais;
create policy "canais: ler" on public.canais for select using (indicador_id = (select auth.uid()) or (select private.is_admin())
  or exists (select 1 from public.indicadores i where i.id = canais.indicador_id and i.consultor_id = (select auth.uid())));
create policy "canais: criar" on public.canais for insert with check (indicador_id = (select auth.uid()));
create policy "canais: editar" on public.canais for update using (indicador_id = (select auth.uid()));
create policy "canais: apagar" on public.canais for delete using (indicador_id = (select auth.uid()));

drop policy "leads: consultor le" on public.leads;
drop policy "leads: consultor edita" on public.leads;
create policy "leads: consultor le" on public.leads for select using (consultor_id = (select auth.uid()) or (select private.is_admin()));
create policy "leads: consultor edita" on public.leads for update using (consultor_id = (select auth.uid())) with check (consultor_id = (select auth.uid()));

drop policy "transacoes consultor ou admin" on public.transacoes;
create policy "transacoes: consultor ou admin" on public.transacoes for select using ((select private.is_admin())
  or exists (select 1 from public.leads l where l.id = lead_id and l.consultor_id = (select auth.uid())));

drop policy "config leitura" on public.config_split;
drop policy "config admin" on public.config_split;
create policy "config: leitura logado" on public.config_split for select using ((select auth.uid()) is not null);
create policy "config: admin edita" on public.config_split for update using ((select private.is_admin()));

drop policy "eventos do lead do consultor" on public.lead_eventos;
drop policy "consultor registra evento" on public.lead_eventos;
create policy "eventos: ler" on public.lead_eventos for select using ((select private.is_admin())
  or exists (select 1 from public.leads l where l.id = lead_id and l.consultor_id = (select auth.uid())));
create policy "eventos: consultor registra" on public.lead_eventos for insert
  with check (exists (select 1 from public.leads l where l.id = lead_id and l.consultor_id = (select auth.uid())));

drop policy "saques proprios" on public.saques;
create policy "saques: proprios" on public.saques for select using (indicador_id = (select auth.uid()) or (select private.is_admin()));

drop policy "indicador avalia seu consultor" on public.avaliacoes;
create policy "avaliacoes: indicador avalia seu consultor" on public.avaliacoes for insert
  with check (indicador_id = (select auth.uid()) and exists (select 1 from public.indicadores i where i.id = (select auth.uid()) and i.consultor_id = avaliacoes.consultor_id));

drop policy "admin edita catalogo" on public.produtos;
create policy "produtos: admin edita" on public.produtos for update using ((select private.is_admin()));
