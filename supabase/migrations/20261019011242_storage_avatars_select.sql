-- upload com upsert também precisa de leitura na própria pasta
create policy "avatar: le propria pasta" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
