-- Benjamin PMS — แก้บั๊กที่พบทันทีจากทดสอบ migration 0102: quotations.status เป็น enum type
-- (quotation_status) ไม่ใช่ text ธรรมดา — UPDATE ... set status = p_status (parameter เป็น text)
-- ล้มด้วย "column status is of type quotation_status but expression is of type text"
-- แก้: cast explicit p_status::quotation_status ตอน UPDATE
create or replace function public.set_quotation_status_reconciled(p_quote_id text, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q    quotations;
  cust customers;
  result jsonb;
begin
  if not can_write_sales() then
    raise exception 'forbidden: no permission to update quotation status';
  end if;

  update quotations set status = p_status::quotation_status
    where id = p_quote_id and dealer_code = auth_dealer()
    returning * into q;

  if not found then
    raise exception 'quotation % not found for dealer %', p_quote_id, auth_dealer();
  end if;

  if q.customer_id is not null and q.customer_id > 0 then
    cust := reconcile_customer_won_total(q.customer_id);
  end if;

  select jsonb_build_object('quotation', to_jsonb(q), 'customer', to_jsonb(cust)) into result;
  return result;
end $$;

revoke all on function public.set_quotation_status_reconciled(text, text) from public, anon;
grant execute on function public.set_quotation_status_reconciled(text, text) to authenticated;
