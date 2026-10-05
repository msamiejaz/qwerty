-- Run this once in Supabase: SQL Editor > New query > paste > Run
create table if not exists contacts (
  id      bigint generated always as identity primary key,
  name    text not null check (char_length(name) between 1 and 100),
  email   text not null default '',
  phone   text not null default '',
  grp     text not null default 'Other' check (grp in ('Friends','Family','Work','Other')),
  notes   text not null default '',
  updated timestamptz not null default now()
);

create index if not exists idx_contacts_name on contacts (name);
create index if not exists idx_contacts_grp  on contacts (grp);

-- Block direct browser access. Only the Netlify function (service key) can read/write.
alter table contacts enable row level security;
