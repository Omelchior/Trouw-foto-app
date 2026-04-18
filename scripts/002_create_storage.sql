-- Create storage bucket for wedding photos
insert into storage.buckets (id, name, public)
values ('wedding-photos', 'wedding-photos', true)
on conflict (id) do nothing;

-- Allow anyone to upload photos
create policy "Anyone can upload photos" on storage.objects
for insert with check (bucket_id = 'wedding-photos');

-- Allow anyone to view photos
create policy "Anyone can view photos" on storage.objects
for select using (bucket_id = 'wedding-photos');

-- Allow authenticated users (admin) to delete photos
create policy "Authenticated can delete photos" on storage.objects
for delete using (bucket_id = 'wedding-photos' and auth.role() = 'authenticated');
