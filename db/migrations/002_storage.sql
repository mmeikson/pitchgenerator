-- Avolor — Storage: Logo Bucket
-- Run in Supabase SQL Editor after 001_initial_schema.sql

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "Users can upload their own logo"
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Public logo read access"
  on storage.objects for select
  using (bucket_id = 'logos');

create policy "Users can update their own logo"
  on storage.objects for update
  using (
    bucket_id = 'logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own logo"
  on storage.objects for delete
  using (
    bucket_id = 'logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
