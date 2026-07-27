-- Benjamin PMS — M9 Phase 1 (ต่อ): aggregate ใบเสนอราคา "ตามช่วงวันที่" รายสาขา
--
-- ป้อน Scorecard (ผลรวมทั้งเครือ) + สถิติรายตัวแทนในช่วง (dealerStats/rankedWin) ของ /hq/dashboard
-- ด้วย RPC เดียว → เอา 2 การรวมยอดฝั่ง client (winQuotes-derived) ออก
--
-- parity กับ client เป๊ะ:
--   ช่วงเวลา: client กรอง q ด้วย parseThaiDate(fmtISOToThai(q.date)) ∈ [start,end]
--             = วันของ q.date (y/m/d) · ขอบทั้งสองด้าน inclusive (start/end เป็น startOfDay)
--             → SQL เทียบ substring(date,1,10)::date between p_start and p_end
--   มูลค่า: valueNum = total_value · won/lost ตามสถานะ
--   p_dealer: ถ้าระบุ = ดูตัวแทนรายตัว (selDealer) · null = ทั้งเครือ (RLS คุม scope อยู่แล้ว)
--
-- SECURITY INVOKER: อ่านด้วยสิทธิ์ผู้เรียก → RLS ให้ HQ เห็นทั้งเครือ · ตัวแทนเห็นเฉพาะตน
create or replace function network_quote_range(
  p_start   date,
  p_end     date,
  p_dealer  text default null
)
returns table (
  dealer_code text,
  quotes      bigint,
  won         bigint,
  lost        bigint,
  won_val     numeric,
  quote_val   numeric
)
language sql
stable
as $$
  select
    coalesce(dealer_code, 'CNX')                                   as dealer_code,
    count(*)                                                       as quotes,
    count(*) filter (where status = 'won')                        as won,
    count(*) filter (where status = 'lost')                       as lost,
    coalesce(sum(total_value) filter (where status = 'won'), 0)   as won_val,
    coalesce(sum(total_value), 0)                                 as quote_val
  from quotations
  where date ~ '^\d{4}-\d{2}-\d{2}'
    and substring(date, 1, 10)::date between p_start and p_end
    and (p_dealer is null or coalesce(dealer_code, 'CNX') = p_dealer)
  group by coalesce(dealer_code, 'CNX');
$$;
