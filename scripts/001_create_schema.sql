-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Photos table: stores all uploaded photos
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  uploaded_by text not null,
  uploaded_at timestamp with time zone default now(),
  is_selected boolean default false,
  selected_at timestamp with time zone,
  selected_by uuid references auth.users(id)
);

-- Enable Row Level Security
alter table public.photos enable row level security;

-- Photos policies: anyone can view and insert, only authenticated (admin) can update/delete
create policy "Anyone can view photos" on public.photos for select using (true);
create policy "Anyone can upload photos" on public.photos for insert with check (true);
create policy "Authenticated users can update photos" on public.photos for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete photos" on public.photos for delete using (auth.role() = 'authenticated');

-- Create indexes for better performance
create index if not exists idx_photos_uploaded_at on public.photos(uploaded_at desc);
create index if not exists idx_photos_is_selected on public.photos(is_selected);
