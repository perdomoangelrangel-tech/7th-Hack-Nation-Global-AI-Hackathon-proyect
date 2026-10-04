-- 0016 · Nedamex · encrypt contact details at rest + harden public RPCs
-- APPLIED by head-brain via Supabase MCP on 2026-10-04 ~02:55 CDMX. Data lane: commit as
-- supabase/migrations/0016_nedamex_security_encryption.sql — do NOT re-apply.
-- Verified: anon cannot read proposals.contact / contact_enc, cannot execute read_proposal_contact;
-- encrypt→decrypt round-trip OK (self-test rolled back); 0 plaintext contacts remain.

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'nedamex_pii_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'nedamex_pii_key',
      'Symmetric key for encrypting contact details (proposals.contact_enc). Never expose.');
  end if;
end $$;

alter table public.proposals add column if not exists contact_enc bytea;

update public.proposals
   set contact_enc = extensions.pgp_sym_encrypt(contact, (select decrypted_secret from vault.decrypted_secrets where name = 'nedamex_pii_key')),
       contact = null
 where contact is not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'proposals_contact_plaintext_forbidden') then
    alter table public.proposals add constraint proposals_contact_plaintext_forbidden check (contact is null);
  end if;
end $$;

-- submit_proposal: same validation/rate limit as before; contact is stored ONLY encrypted.
create or replace function public.submit_proposal(p_kind text, p_title text, p_body text, p_persona text, p_disease text, p_entities text[], p_edges text[], p_contact text)
 returns uuid language plpgsql security definer set search_path to ''
as $function$
declare
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_body  text := btrim(coalesce(p_body, ''));
  v_contact text := nullif(btrim(coalesce(p_contact, '')), '');
begin
  if p_kind is null or p_kind not in ('hypothesis', 'collaboration', 'evidence') then
    raise exception 'p_kind must be hypothesis | collaboration | evidence' using errcode = '22023';
  end if;
  if char_length(v_title) not between 3 and 200 then raise exception 'title must be 3-200 characters' using errcode = '22023'; end if;
  if char_length(v_body) not between 1 and 4000 then raise exception 'body must be 1-4000 characters' using errcode = '22023'; end if;
  if char_length(coalesce(p_persona, '')) > 40 or char_length(coalesce(p_disease, '')) > 120 or char_length(coalesce(v_contact, '')) > 200 then
    raise exception 'persona/disease/contact too long' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_entities, '{}')) > 50 or cardinality(coalesce(p_edges, '{}')) > 100 then
    raise exception 'too many entities (max 50) or edges (max 100)' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(coalesce(p_entities, '{}') || coalesce(p_edges, '{}')) x where char_length(x) > 200) then
    raise exception 'entity/edge id too long' using errcode = '22023';
  end if;
  if (select count(*) from public.proposals where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'too many submissions, try again in a minute' using errcode = '54000';
  end if;
  insert into public.proposals (kind, title, body, persona, disease, entities, edges, contact, contact_enc)
  values (p_kind, v_title, v_body, nullif(btrim(p_persona), ''), nullif(btrim(p_disease), ''),
          coalesce(p_entities, '{}'), coalesce(p_edges, '{}'), null,
          case when v_contact is null then null
               else extensions.pgp_sym_encrypt(v_contact, (select decrypted_secret from vault.decrypted_secrets where name = 'nedamex_pii_key')) end)
  returning id into v_id;
  return v_id;
end $function$;

-- Server-side only (service_role): decrypt one contact.
create or replace function public.read_proposal_contact(p_id uuid)
 returns text language sql security definer set search_path to ''
as $$
  select extensions.pgp_sym_decrypt(p.contact_enc, (select decrypted_secret from vault.decrypted_secrets where name = 'nedamex_pii_key'))
    from public.proposals p where p.id = p_id and p.contact_enc is not null
$$;
revoke all on function public.read_proposal_contact(uuid) from public, anon, authenticated;
grant execute on function public.read_proposal_contact(uuid) to service_role;

-- submit_profile: adds array limits + rate limit (20/min).
create or replace function public.submit_profile(
  p_display_name text, p_role text, p_institution text, p_diseases text[],
  p_focus text, p_orcid text, p_link text, p_consent boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_consent is not true then raise exception 'consent required'; end if;
  if cardinality(coalesce(p_diseases, '{}')) > 40 then raise exception 'too many diseases (max 40)' using errcode = '22023'; end if;
  if exists (select 1 from unnest(coalesce(p_diseases, '{}')) x where char_length(x) > 120) then
    raise exception 'disease id too long' using errcode = '22023';
  end if;
  if (select count(*) from public.profile_submissions where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'too many submissions, try again in a minute' using errcode = '54000';
  end if;
  insert into public.profile_submissions (display_name, role, institution, diseases, focus, orcid, link)
  values (trim(p_display_name), p_role, nullif(trim(p_institution), ''), coalesce(p_diseases, '{}'),
          nullif(trim(p_focus), ''), nullif(trim(p_orcid), ''), nullif(trim(p_link), ''))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.submit_profile(text, text, text, text[], text, text, text, boolean) from public;
grant execute on function public.submit_profile(text, text, text, text[], text, text, text, boolean) to anon, authenticated;
