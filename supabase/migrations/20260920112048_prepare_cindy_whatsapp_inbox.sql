-- Preparation only. No phone is configured and there is no outbound sender.
-- Filename aligned with the applied Supabase migration version.
create table public.meteoro_whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  phone_number_id text not null,
  sender_id text not null,
  mode text not null default 'automatic' check (mode in ('automatic','human','opted_out')),
  last_inbound_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (phone_number_id, sender_id)
);
create table public.meteoro_whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.meteoro_whatsapp_conversations(id),
  provider_message_id text not null unique,
  inbound_at timestamptz not null,
  incoming_text text not null,
  draft_reply text,
  reason text not null,
  review_status text not null default 'pending' check (review_status in ('pending','held','dismissed')),
  created_at timestamptz not null default now()
);
create index meteoro_whatsapp_messages_conversation_idx on public.meteoro_whatsapp_messages(conversation_id, created_at desc);
create index meteoro_whatsapp_messages_review_idx on public.meteoro_whatsapp_messages(created_at desc) where review_status='pending';
alter table public.meteoro_whatsapp_conversations enable row level security;
alter table public.meteoro_whatsapp_messages enable row level security;
revoke all on public.meteoro_whatsapp_conversations, public.meteoro_whatsapp_messages from public, anon, authenticated;
grant select, insert, update on public.meteoro_whatsapp_conversations, public.meteoro_whatsapp_messages to service_role;

-- Atomic deduplication and sticky human/opt-out states. Invoker only; no elevated RPC.
create function public.meteoro_whatsapp_receive(
  p_phone_id text, p_sender text, p_message_id text, p_inbound_at timestamptz,
  p_text text, p_reply text, p_reason text, p_mode text
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  c public.meteoro_whatsapp_conversations%rowtype;
  inserted_id uuid;
begin
  if p_mode not in ('automatic','human','opted_out') or p_inbound_at is null
    or length(p_phone_id)>100 or length(p_sender)>32 or length(p_message_id)>300
    or length(p_text)>2500 or length(p_reply)>3000 then
    raise exception 'Invalid inbound message';
  end if;
  insert into public.meteoro_whatsapp_conversations(phone_number_id,sender_id,last_inbound_at)
    values(p_phone_id,p_sender,p_inbound_at) on conflict(phone_number_id,sender_id) do nothing;
  select * into strict c from public.meteoro_whatsapp_conversations
    where phone_number_id=p_phone_id and sender_id=p_sender for update;
  insert into public.meteoro_whatsapp_messages(conversation_id,provider_message_id,inbound_at,incoming_text,draft_reply,reason,review_status)
    values(c.id,p_message_id,p_inbound_at,p_text,
      case when c.mode='automatic' and p_mode<>'opted_out' then nullif(p_reply,'') else null end,
      p_reason,case when c.mode='automatic' and p_mode='automatic' then 'pending' else 'held' end)
    on conflict(provider_message_id) do nothing returning id into inserted_id;
  if inserted_id is null then return jsonb_build_object('duplicate',true); end if;
  update public.meteoro_whatsapp_conversations set
    mode=case when c.mode='opted_out' or p_mode='opted_out' then 'opted_out'
      when c.mode='human' or p_mode='human' then 'human' else 'automatic' end,
    last_inbound_at=greatest(c.last_inbound_at,p_inbound_at),updated_at=now() where id=c.id;
  if c.mode<>'automatic' or p_mode<>'automatic' then
    update public.meteoro_whatsapp_messages set draft_reply=null,review_status='held'
      where conversation_id=c.id and review_status='pending';
  end if;
  return jsonb_build_object('duplicate',false,'message_id',inserted_id,'conversation_id',c.id);
end $$;
revoke all on function public.meteoro_whatsapp_receive(text,text,text,timestamptz,text,text,text,text) from public,anon,authenticated;
grant execute on function public.meteoro_whatsapp_receive(text,text,text,timestamptz,text,text,text,text) to service_role;
comment on table public.meteoro_whatsapp_messages is 'Private draft inbox. No outbound delivery is implemented or authorized by storing a draft.';

create function public.meteoro_whatsapp_hold(p_conversation_id uuid) returns text
language plpgsql security invoker set search_path = public as $$
declare current_mode text;
begin
  select mode into current_mode from public.meteoro_whatsapp_conversations where id=p_conversation_id for update;
  if not found then return null; end if;
  if current_mode<>'opted_out' then
    update public.meteoro_whatsapp_conversations set mode='human',updated_at=now() where id=p_conversation_id;
    current_mode:='human';
  end if;
  update public.meteoro_whatsapp_messages set draft_reply=null,review_status='held'
    where conversation_id=p_conversation_id and review_status='pending';
  return current_mode;
end $$;
revoke all on function public.meteoro_whatsapp_hold(uuid) from public,anon,authenticated;
grant execute on function public.meteoro_whatsapp_hold(uuid) to service_role;
