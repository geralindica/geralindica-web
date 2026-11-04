-- Contas de demonstração: troca o domínio antigo demo.indikei.com.br por demo.geralindica.com.br
-- (login, identidade e perfil). Senhas e dados continuam os mesmos.
update auth.users set email = replace(email, '@demo.indikei.com.br', '@demo.geralindica.com.br')
where email like '%@demo.indikei.com.br';

do $$ begin
  if to_regclass('auth.identities') is not null then
    update auth.identities
      set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(replace(identity_data->>'email', '@demo.indikei.com.br', '@demo.geralindica.com.br')))
    where identity_data->>'email' like '%@demo.indikei.com.br';
  end if;
end $$;

update public.profiles set email = replace(email, '@demo.indikei.com.br', '@demo.geralindica.com.br')
where email like '%@demo.indikei.com.br';
