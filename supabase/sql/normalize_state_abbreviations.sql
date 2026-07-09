-- One-time backfill: converts any full US state names already stored in
-- market_news_overrides / market_news_requests into 2-letter USPS abbreviations,
-- matching what the mobile app sends to get_market_news_override(). Rows saved
-- before app/dashboard/news/actions.ts started normalizing state on write (e.g.
-- "Texas" instead of "TX") would otherwise never match the app's lookup even
-- though they look correct in the admin UI.
--
-- Safe to run more than once — already-abbreviated rows are left untouched
-- since they won't match any key in the CASE expression below.
-- Run this once in the Supabase SQL editor.

do $$
declare
  v_table text;
begin
  foreach v_table in array array['market_news_overrides', 'market_news_requests']
  loop
    execute format($f$
      update %I
      set state = case lower(btrim(state))
        when 'alabama' then 'AL' when 'alaska' then 'AK' when 'arizona' then 'AZ'
        when 'arkansas' then 'AR' when 'california' then 'CA' when 'colorado' then 'CO'
        when 'connecticut' then 'CT' when 'delaware' then 'DE' when 'florida' then 'FL'
        when 'georgia' then 'GA' when 'hawaii' then 'HI' when 'idaho' then 'ID'
        when 'illinois' then 'IL' when 'indiana' then 'IN' when 'iowa' then 'IA'
        when 'kansas' then 'KS' when 'kentucky' then 'KY' when 'louisiana' then 'LA'
        when 'maine' then 'ME' when 'maryland' then 'MD' when 'massachusetts' then 'MA'
        when 'michigan' then 'MI' when 'minnesota' then 'MN' when 'mississippi' then 'MS'
        when 'missouri' then 'MO' when 'montana' then 'MT' when 'nebraska' then 'NE'
        when 'nevada' then 'NV' when 'new hampshire' then 'NH' when 'new jersey' then 'NJ'
        when 'new mexico' then 'NM' when 'new york' then 'NY' when 'north carolina' then 'NC'
        when 'north dakota' then 'ND' when 'ohio' then 'OH' when 'oklahoma' then 'OK'
        when 'oregon' then 'OR' when 'pennsylvania' then 'PA' when 'rhode island' then 'RI'
        when 'south carolina' then 'SC' when 'south dakota' then 'SD' when 'tennessee' then 'TN'
        when 'texas' then 'TX' when 'utah' then 'UT' when 'vermont' then 'VT'
        when 'virginia' then 'VA' when 'washington' then 'WA' when 'west virginia' then 'WV'
        when 'wisconsin' then 'WI' when 'wyoming' then 'WY'
        when 'district of columbia' then 'DC' when 'puerto rico' then 'PR'
        when 'guam' then 'GU' when 'virgin islands' then 'VI'
        when 'american samoa' then 'AS' when 'northern mariana islands' then 'MP'
        else state
      end
      where lower(btrim(state)) in (
        'alabama','alaska','arizona','arkansas','california','colorado','connecticut',
        'delaware','florida','georgia','hawaii','idaho','illinois','indiana','iowa',
        'kansas','kentucky','louisiana','maine','maryland','massachusetts','michigan',
        'minnesota','mississippi','missouri','montana','nebraska','nevada','new hampshire',
        'new jersey','new mexico','new york','north carolina','north dakota','ohio',
        'oklahoma','oregon','pennsylvania','rhode island','south carolina','south dakota',
        'tennessee','texas','utah','vermont','virginia','washington','west virginia',
        'wisconsin','wyoming','district of columbia','puerto rico','guam','virgin islands',
        'american samoa','northern mariana islands'
      );
    $f$, v_table);
  end loop;
end $$;
