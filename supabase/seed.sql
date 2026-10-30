-- Geralindica · dados de demonstração
-- Cria contas de teste, consultores da vitrine,
-- indicadores, histórico de leads e vendas registradas e os leads de exemplo do protótipo.
-- Modelo de 27/10/2026: sem robô, sem custódia e sem saque (o consultor registra as vendas).
-- Rodar uma vez num banco recém-migrado.
-- Antes, defina a senha das contas de teste na mesma sessão (não grave a senha aqui):
--   set seed.demo_senha = '<senha>';
-- e coloque a mesma senha em VITE_DEMO_SENHA no .env.local.
--
-- Contas principais:
--   admin@demo.geralindica.com.br          (Plataforma · admin)
--   juliana.prado@demo.geralindica.com.br  (Consultora #1)
--   carlos.mendes@demo.geralindica.com.br  (Indicador da Juliana)

create or replace function private.seed_user(p_email text, p_meta jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
    crypt(current_setting('seed.demo_senha'), gen_salt('bf', 6)), now(),
    '{"provider":"email","providers":["email"]}', p_meta, now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
  return v_id;
end $$;

do $$
declare
  c record; r record;
  v_id uuid; v_ind uuid; v_canal uuid; v_lead uuid;
  v_total int; v_d timestamptz; v_etapa text; v_n int := 0;
  firsts text[] := array['Ana','Bruno','Carla','Daniel','Eduarda','Fernando','Gabriela','Henrique','Isabela','João','Karina','Leonardo','Mariana','Nicolas','Olívia','Pedro','Rafaela','Samuel','Tânia','Valéria','William','Yasmin','Alice','Bernardo','Cecília','Davi','Elisa','Giovana','Hugo','Ingrid','Júlia','Kaique','Lívia','Matheus','Natália','Otávio','Regina','Sérgio','Vítor','Lorena'];
  lasts text[] := array['Silva','Santos','Oliveira','Souza','Lima','Pereira','Ferreira','Costa','Rodrigues','Almeida','Nascimento','Araújo','Carvalho','Gomes','Martins','Rocha','Ribeiro','Barbosa','Teixeira','Moreira','Cardoso','Freitas','Castro','Dias'];
  perfis text[] := array['Motorista de app','Comércio','Criador de conteúdo','Salão de beleza','Farmácia','Autônomo','Motorista de app','Comércio'];
  planos text[] := array['Amil S380 · PF','Unimed · Adesão','Hapvida Mix · PF','SulAmérica Direto · PME','Bradesco Efetivo · PF','Porto Saúde · PF','NotreDame Smart · PF'];
begin
  perform setseed(0.42);

  -- ===== Consultores =====
  create temp table s_cons (ordem int, nome text, cidade text, ph int, conv int, vendas int, ocup int, maxi int, nota numeric, susep text, bio text, tags text[], email text, recent int, gov boolean, id uuid) on commit drop;
  insert into s_cons values
    (1,'Juliana Prado','Campinas, SP',774909,38,142,24,30,4.9,'10.2211.0934-1','Especialista em planos PME e famílias. Atendimento rápido pelo WhatsApp.',array['PME','Famílias','Adesão'],'juliana.prado@demo.geralindica.com.br',8,true,null),
    (2,'Rafael Monteiro','São Paulo, SP',220453,34,128,28,30,4.8,'10.1987.3321-6','Corretor há 12 anos. Foco em MEIs e motoristas de aplicativo.',array['MEI','Coparticipação'],'rafael.monteiro@demo.geralindica.com.br',3,true,null),
    (3,'Camila Rocha','Belo Horizonte, MG',415829,41,97,30,30,5.0,'10.2455.8812-3','Planos com obstetrícia e atendimento para gestantes.',array['Obstetrícia','Famílias'],'camila.rocha@demo.geralindica.com.br',6,true,null),
    (4,'Thiago Almeida','Curitiba, PR',1222271,29,88,12,30,4.7,'10.3012.4410-9','Comparo operadoras lado a lado e explico cada carência.',array['PF','Seniores'],'thiago.almeida@demo.geralindica.com.br',2,true,null),
    (5,'Fernanda Lima','Recife, PE',1239291,32,76,22,30,4.8,'10.2766.1205-4','Atendo comércios locais e suas equipes, de 2 a 30 vidas.',array['PME','Comércio'],'fernanda.lima@demo.geralindica.com.br',3,true,null),
    (6,'Bruno Carvalho','Rio de Janeiro, RJ',2379004,27,64,9,20,4.6,'10.3190.7781-2','Planos regionais com bom custo-benefício na Zona Norte e Baixada.',array['Municipal','Coparticipação'],'bruno.carvalho@demo.geralindica.com.br',1,false,null),
    (7,'Patrícia Nunes','Salvador, BA',733872,31,59,25,30,4.9,'10.2840.6634-7','Indicadores motoristas são minha maior carteira. Respondo em até 1h.',array['Motoristas','PF'],'patricia.nunes@demo.geralindica.com.br',5,true,null),
    (8,'Diego Santos','Porto Alegre, RS',1681010,25,41,6,20,4.5,'10.3301.0098-5','Começando forte em Porto Alegre, com muita vaga para indicadores.',array['PF','Adesão'],'diego.santos@demo.geralindica.com.br',1,false,null);

  for c in select * from s_cons order by ordem loop
    v_id := private.seed_user(c.email, jsonb_build_object('papel','consultor','nome',c.nome,'cidade',c.cidade,'susep',c.susep,
      'max_indicadores',c.maxi,'bio',c.bio,'tipo_pessoa','PJ','administradora','Qualivida Administradora',
      'contrato_assinado_em', case when c.gov then '2026-03-01T12:00:00Z' end));
    update public.consultores set especialidades = c.tags, nota = c.nota,
      foto_url = 'https://images.pexels.com/photos/' || c.ph || '/pexels-photo-' || c.ph || '.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop'
    where id = v_id;
    update s_cons set id = v_id where ordem = c.ordem;
  end loop;

  -- ===== Admin =====
  v_id := private.seed_user('admin@demo.geralindica.com.br', '{"nome":"Renan Azevedo","contrato_assinado_em":"2026-01-10T12:00:00Z"}');
  delete from public.indicadores where id = v_id;
  update public.profiles set papel = 'admin' where id = v_id;

  -- ===== Indicadores nomeados =====
  create temp table s_ind (nome text, perfil text, tipo text, cons int, canais int, gov boolean, email text) on commit drop;
  insert into s_ind values
    ('Carlos Eduardo Mendes','Motorista de app','PF',1,3,true,'carlos.mendes@demo.geralindica.com.br'),
    ('Luciana Ferraz','Dona de padaria','PJ',1,1,true,'luciana.ferraz@demo.geralindica.com.br'),
    ('Anderson Silva','Motorista de app','PF',1,1,true,'anderson.silva@demo.geralindica.com.br'),
    ('Gabriel Torres','Criador de conteúdo','PF',1,2,true,'gabriel.torres@demo.geralindica.com.br'),
    ('Débora Lins','Farmácia','PJ',1,1,true,'debora.lins@demo.geralindica.com.br'),
    ('Marcelo Azevedo','Contador','PJ',1,1,true,'marcelo.azevedo@demo.geralindica.com.br'),
    ('Renata Campos','Salão de beleza','PF',1,1,false,'renata.campos@demo.geralindica.com.br'),
    ('Wellington Souza','Motorista de app','PF',1,1,true,'wellington.souza@demo.geralindica.com.br'),
    ('Paula Reis','Influenciadora','PJ',2,4,true,'paula.reis@demo.geralindica.com.br'),
    ('Joana Vieira','Farmácia','PJ',3,2,true,'joana.vieira@demo.geralindica.com.br'),
    ('Fábio Nunes','Motorista de app','PF',4,1,false,'fabio.nunes@demo.geralindica.com.br'),
    ('Rosa Pereira','Salão de beleza','PF',5,2,true,'rosa.pereira@demo.geralindica.com.br'),
    ('Edson Matos','Motorista de app','PF',7,1,true,'edson.matos@demo.geralindica.com.br');

  for r in select s_ind.*, s_cons.id as cons_id from s_ind join s_cons on s_cons.ordem = s_ind.cons loop
    v_id := private.seed_user(r.email, jsonb_build_object('papel','indicador','nome',r.nome,'perfil',r.perfil,'tipo_pessoa',r.tipo,
      'consultor_id',r.cons_id,'contrato_assinado_em', case when r.gov then '2026-03-14T12:00:00Z' end));
    for i in 2..r.canais loop
      insert into public.canais (indicador_id, nome) values (v_id, (array['Cartão de visita','Instagram · story','Banner da loja'])[least(i-1,3)]);
    end loop;
    update public.canais set escaneamentos = 20 + floor(random() * 200) where indicador_id = v_id;
  end loop;

  -- Carlos: dados de recebimento e escaneamentos do protótipo
  update public.profiles set documento = '412.887.093-12', telefone = '(19) 98871-4471'
  where email = 'carlos.mendes@demo.geralindica.com.br';
  update public.canais cn set escaneamentos = (array[312,64,36])[cn.numero]
  from public.profiles p where p.id = cn.indicador_id and p.email = 'carlos.mendes@demo.geralindica.com.br';

  -- ===== Indicadores de preenchimento (ocupação das carteiras) =====
  for c in select * from s_cons order by ordem loop
    while (select ocupacao from public.consultores where id = c.id) < c.ocup loop
      v_n := v_n + 1;
      v_id := private.seed_user('indicador' || v_n || '@demo.geralindica.com.br', jsonb_build_object('papel','indicador',
        'nome', firsts[1 + floor(random() * array_length(firsts,1))::int] || ' ' || lasts[1 + floor(random() * array_length(lasts,1))::int],
        'perfil', perfis[1 + floor(random() * array_length(perfis,1))::int],
        'tipo_pessoa', case when random() < 0.25 then 'PJ' else 'PF' end,
        'consultor_id', c.id, 'contrato_assinado_em', case when random() < 0.9 then '2026-04-02T12:00:00Z' end));
      update public.canais set escaneamentos = floor(random() * 120) where indicador_id = v_id;
    end loop;
  end loop;

  -- ===== Histórico de leads (gera vendas e conversão reais) =====
  for c in select * from s_cons order by ordem loop
    v_total := round(c.vendas * 100.0 / c.conv);
    for i in 1..v_total loop
      if i <= c.vendas then
        v_etapa := 'aprovado';
        v_d := case when i <= c.recent then now() - (random() * 25 + 1) * interval '1 day'
                    else now() - (35 + random() * 150) * interval '1 day' end;
      elsif i <= c.vendas + ceil(v_total * 0.05) then
        v_etapa := 'reprovado'; v_d := now() - (35 + random() * 150) * interval '1 day';
      else
        v_etapa := 'perdido'; v_d := now() - (8 + random() * 175) * interval '1 day';
      end if;
      select i2.id, (select x.id from public.canais x where x.indicador_id = i2.id order by x.numero limit 1)
        into v_ind, v_canal
      from public.indicadores i2 where i2.consultor_id = c.id order by random() limit 1;
      insert into public.leads (consultor_id, indicador_id, canal_id, nome, plano, valor_adesao, etapa, created_at, updated_at)
      values (c.id, v_ind, v_canal,
        firsts[1 + floor(random() * array_length(firsts,1))::int] || ' ' || lasts[1 + floor(random() * array_length(lasts,1))::int],
        planos[1 + floor(random() * array_length(planos,1))::int], 600 + floor(random() * 24) * 100,
        v_etapa, v_d - interval '6 days', v_d);
    end loop;
  end loop;

end $$;

-- ===== Leads de exemplo do protótipo (carteira da Juliana) =====
do $$
declare
  v_jul uuid := (select id from public.profiles where email = 'juliana.prado@demo.geralindica.com.br');
  r record; v_ind uuid; v_canal uuid; v_lead uuid;
  v_ordem text[] := array['novo','triagem','cotacao','negociacao','contrato','custodia','entrevista','aprovado','reprovado'];
begin
  create temp table s_leads (nome text, plano text, valor numeric, ind_email text, canal int, etapa text, parado interval, tipo text, idade int, prof text, cpf text, tel text, pago boolean) on commit drop;
  insert into s_leads values
    ('Marcos Vinícius Oliveira','Amil S380 · PF · Enfermaria',1240,'carlos.mendes',1,'negociacao','2 days','PF',34,'Motorista de app','318.455.902-17','(19) 99812-4137',false),
    ('Helena Costa Ribeiro','SulAmérica Direto · PME 4 vidas',2380,'luciana.ferraz',1,'cotacao','3 hours','PME',41,'Dona de padaria','335.120.448-20','(19) 99731-4274',false),
    ('José Augusto Lima','Bradesco Efetivo · PF',980,null,null,'novo','1 day','PF',52,'Eletricista','352.871.330-23','(19) 99644-4411',false),
    ('Rita de Cássia Moura','Hapvida Mix · PF',640,'anderson.silva',1,'triagem','12 minutes','PF',29,'Cabeleireira','369.004.512-26','(19) 99502-4548',false),
    ('Felipe Andrade','Porto Saúde · PME 3 vidas',1890,'gabriel.torres',2,'contrato','5 hours','PME',38,'Designer','386.553.871-29','(19) 99476-4685',false),
    ('Roberto Farias','Amil S450 · PF · Apartamento',1430,'carlos.mendes',1,'custodia','4 days','PF',46,'Contador','403.221.087-88','(19) 99308-2093',false),
    ('Vanessa Teixeira','Unimed Campinas · Adesão',1120,'luciana.ferraz',1,'entrevista','1 day','Adesão',31,'Professora','420.778.019-35','(19) 99287-4959',false),
    ('Ana Paula Siqueira','Amil S380 · PF',1000,'carlos.mendes',1,'aprovado','4 days','PF',27,'Enfermeira','437.019.664-12','(19) 99145-4471',false),
    ('Beatriz Nogueira','SulAmérica · Adesão',950,'carlos.mendes',1,'reprovado','18 days','Adesão',58,'Aposentada','454.660.203-71','(19) 99054-6610',false),
    ('Gustavo Pereira','NotreDame Smart · PF',720,'anderson.silva',1,'novo','40 minutes','PF',24,'Estudante','471.238.556-44','(19) 98969-5370',false),
    ('Larissa Melo','Unimed Campinas · PF',1310,'debora.lins',1,'triagem','2 hours','PF',33,'Advogada','488.901.775-47','(19) 98832-5507',false),
    ('Eduardo Ramos','Bradesco · PME 6 vidas',3150,'marcelo.azevedo',1,'cotacao','6 hours','PME',44,'Empresário','505.340.129-50','(19) 98715-5644',false),
    ('Cláudia Martins','Amil S380 · PF',1080,'anderson.silva',1,'negociacao','3 days','PF',39,'Vendedora','522.687.904-53','(19) 98694-5781',false),
    ('Lucas Freitas','Porto Saúde · PF',1210,'carlos.mendes',2,'aprovado','14 days','PF',30,'Mecânico','539.112.448-05','(19) 98577-3382',false),
    ('Tatiane Rocha','Hapvida · PF',590,'gabriel.torres',2,'custodia','2 days','PF',26,'Manicure','556.873.201-59','(19) 98436-6055',false),
    ('Sérgio Antunes','Unimed · Adesão',1460,'debora.lins',1,'entrevista','8 hours','Adesão',49,'Engenheiro','573.450.889-62','(19) 98319-6192',false),
    ('Priscila Gomes','SulAmérica · PME 2 vidas',2200,'marcelo.azevedo',1,'aprovado','1 day','PME',36,'Arquiteta','590.006.317-65','(19) 98278-6329',false),
    ('Mariana Alves','Amil S380 · PF',890,'carlos.mendes',3,'contrato','9 days','PF',28,'Fotógrafa','607.334.120-40','(19) 98141-7719',false),
    ('Paulo Henrique Dias','Bradesco Efetivo · PF',1100,'carlos.mendes',1,'aprovado','34 days','PF',45,'Taxista','624.982.553-33','(19) 98020-1048',true),
    ('Sônia Ribeiro','Unimed · PF',1000,'carlos.mendes',2,'aprovado','41 days','PF',61,'Comerciante','641.775.096-29','(19) 97913-5527',true);

  for r in select * from s_leads loop
    v_ind := null; v_canal := null;
    if r.ind_email is not null then
      select p.id, c.id into v_ind, v_canal from public.profiles p
      left join public.canais c on c.indicador_id = p.id and c.numero = r.canal
      where p.email = r.ind_email || '@demo.geralindica.com.br';
    end if;
    insert into public.leads (consultor_id, indicador_id, canal_id, nome, cpf, telefone, plano, valor_adesao, etapa, created_at, updated_at)
    values (v_jul, v_ind, v_canal, r.nome, r.cpf, r.tel, r.plano, r.valor,
      case when r.etapa = 'reprovado' then 'entrevista' else r.etapa end,
      now() - r.parado - interval '3 days', now() - r.parado)
    returning id into v_lead;
    if r.etapa = 'reprovado' then
      update public.leads set etapa = 'reprovado' where id = v_lead;
      update public.leads set updated_at = now() - r.parado where id = v_lead;
    end if;
    -- histórico resumido da conversa
    delete from public.lead_eventos where lead_id = v_lead;
    insert into public.lead_eventos (lead_id, tipo, texto, created_at) values
      (v_lead, 'cliente', case when v_canal is null then 'Cliente chamou no WhatsApp sem código de indicador' else 'Cliente escaneou o QR Code e chamou no WhatsApp com o código' end, now() - r.parado - interval '3 days');
    if array_position(v_ordem, r.etapa) >= 3 then
      insert into public.lead_eventos (lead_id, tipo, texto, created_at) values
        (v_lead, 'consultor', 'Triagem feita por telefone. Prefere ' || case when r.plano like '%Apartamento%' then 'apartamento' else 'enfermaria' end || ', orçamento até R$ ' || round(r.valor * 1.1)::int || '/mês', now() - r.parado - interval '3 days' + interval '6 minutes'),
        (v_lead, 'consultor', 'Cotação enviada com 3 opções', now() - r.parado - interval '3 days' + interval '7 minutes');
    end if;
    if array_position(v_ordem, r.etapa) >= 4 then
      insert into public.lead_eventos (lead_id, tipo, texto, created_at) values
        (v_lead, 'consultor', 'Você assumiu a conversa e explicou carências', now() - r.parado - interval '2 days'),
        (v_lead, 'cliente', 'Cliente achou caro e pediu algo mais em conta', now() - r.parado - interval '1 day');
    end if;
  end loop;

  -- avaliações públicas
  insert into public.avaliacoes (consultor_id, autor, estrelas, texto, created_at)
  select s.id, a.autor, a.estrelas, a.texto, a.d::timestamptz
  from (values
    ('juliana.prado','Anderson, motorista',5,'Meus passageiros sempre comentam que foram bem atendidos. Já tive 9 comissões aprovadas.','2026-09-14'),
    ('juliana.prado','Luciana, dona de padaria',5,'Responde rápido e me avisa quando alguém da minha loja está em negociação.','2026-09-02'),
    ('juliana.prado','Gabriel, criador de conteúdo',4,'Bom suporte com as artes. Gostaria de mais materiais para stories.','2026-08-21'),
    ('rafael.monteiro','Paula, influenciadora',5,'Explica tudo com paciência para os meus seguidores. Fechou rápido.','2026-09-20'),
    ('rafael.monteiro','Igor, motorista',4,'Atendimento bom, às vezes demora um pouco no fim de semana.','2026-08-30'),
    ('camila.rocha','Joana, farmácia',5,'As clientes gestantes saem super bem orientadas. Recomendo demais.','2026-09-25'),
    ('thiago.almeida','Fábio, motorista',5,'Mostra as carências de cada operadora sem enrolar.','2026-09-11'),
    ('fernanda.lima','Rosa, salão de beleza',5,'Fechou o plano da minha equipe inteira em dois dias.','2026-09-18'),
    ('bruno.carvalho','Márcio, comércio',4,'Bons planos regionais, preço justo.','2026-08-15'),
    ('patricia.nunes','Edson, motorista',5,'Responde em minutos mesmo. Já indiquei vários passageiros.','2026-09-28'),
    ('diego.santos','Tiago, autônomo',4,'Atencioso e organizado, ainda começando mas promete.','2026-09-05')
  ) a(email, autor, estrelas, texto, d)
  join public.profiles p on p.email = a.email || '@demo.geralindica.com.br'
  join public.consultores s on s.id = p.id;
end $$;

-- ===== Vendas registradas pelos consultores =====
-- Pagamento recebido / entrevista = aguardando entrevista; aprovado = Verdinho; reprovado = devolvido.
insert into public.vendas (consultor_id, lead_id, indicador_id, canal_id, cliente, valor_adesao, data_venda, status, created_at, updated_at)
select l.consultor_id, l.id, l.indicador_id, l.canal_id, split_part(l.nome, ' ', 1), l.valor_adesao, l.updated_at::date,
  case l.etapa when 'aprovado' then 'aprovado' when 'reprovado' then 'reprovado' else 'aguardando_entrevista' end, l.updated_at, l.updated_at
from public.leads l
where l.etapa in ('custodia','entrevista','aprovado','reprovado') and l.valor_adesao > 0;

select private.recalc_consultor(id) from public.consultores;

drop function private.seed_user(text, jsonb);
