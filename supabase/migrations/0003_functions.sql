-- Benjamin PMS — Functions / Triggers / Hook (เฟส B)

-- ══ 1. Custom Access Token Hook ═══════════════════════════════════════
-- ใส่ role + dealer_code จาก profiles เข้า JWT claim → RLS อ่านค่านี้
-- ต้องเปิดใช้ที่ Dashboard: Authentication → Hooks → Customize Access Token = public.custom_access_token_hook
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare
  claims jsonb := event -> 'claims';
  p record;
begin
  select role, dealer_code into p from public.profiles where id = (event ->> 'user_id')::uuid;
  if found then
    claims := jsonb_set(claims, '{user_role}',   to_jsonb(p.role::text));
    claims := jsonb_set(claims, '{dealer_code}', to_jsonb(p.dealer_code));
  end if;
  return jsonb_set(event, '{claims}', claims);
end $$;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;

-- ══ 2. เลขที่ใบเสนอราคาต่อสาขา (กันเลขชนเมื่อออกพร้อมกัน) ══════════════
create table if not exists quote_counters (
  dealer_code text primary key,
  next_no integer not null default 1
);
create or replace function public.next_quote_no(p_dealer text, p_prefix text default 'Q-2026-')
returns text language plpgsql as $$
declare n integer;
begin
  insert into quote_counters(dealer_code, next_no) values (p_dealer, 2)
    on conflict (dealer_code) do update set next_no = quote_counters.next_no + 1
    returning next_no - 1 into n;
  return p_prefix || lpad(n::text, 4, '0');
end $$;

-- ══ 3. ปิดการขาย → สร้าง/อัปเดตลูกค้าอัตโนมัติ (atomic) ════════════════
-- เมื่อ quotations.status เปลี่ยนเป็น 'won' และยังไม่มีลูกค้าผูก → upsert ลง customers
create or replace function public.on_quote_won()
returns trigger language plpgsql as $$
begin
  if new.status = 'won' and (old.status is distinct from 'won') then
    insert into customers(id, dealer_code, company, province, total_value, status)
    values (coalesce(new.customer_id, new.deal_id, new.id::bigint),
            new.dealer_code, new.customer, new.province, new.total_value, 'active')
    on conflict (id) do update set total_value = customers.total_value + excluded.total_value;
  end if;
  return new;
end $$;
create trigger trg_quote_won after update on quotations
  for each row execute function public.on_quote_won();

-- ══ 4. Audit อัตโนมัติเมื่อ HQ แก้ตารางนโยบาย (ตัวอย่าง master_catalog) ══
create or replace function public.log_catalog_change()
returns trigger language plpgsql as $$
begin
  insert into audit_log("user", role, action, target)
  values (coalesce(auth.jwt() ->> 'email','system'), auth_role(),
          tg_op || ' แคตตาล็อก', coalesce(new.name, old.name));
  return coalesce(new, old);
end $$;
create trigger trg_catalog_audit after insert or update or delete on master_catalog
  for each row execute function public.log_catalog_change();
