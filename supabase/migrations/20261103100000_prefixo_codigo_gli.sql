-- Código do indicador passa de "IDK" (nome antigo, Indikei) para "GLI" (Geralindica).
-- Só vale para códigos novos; os já impressos em QR Code continuam funcionando.
create or replace function private.novo_codigo() returns text language sql volatile as $$
  select 'GLI' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
$$;
