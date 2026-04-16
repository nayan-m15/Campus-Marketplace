# Delete account setup

The settings page now calls the SQL function `public.delete_my_account()`.

Run this in the Supabase SQL editor:

```sql
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.wishlists
  where listing_id in (
    select id from public.listings where user_id = current_user_id
  );

  delete from public.ratings
  where listing_id in (
    select id from public.listings where user_id = current_user_id
  );

  delete from public.wishlists where user_id = current_user_id;
  delete from public.ratings where rater_id = current_user_id or rated_id = current_user_id;
  delete from public.messages where sender_id = current_user_id or receiver_id = current_user_id;
  delete from public.listings where user_id = current_user_id;
  delete from public.profiles where id = current_user_id;
  delete from auth.users where id = current_user_id;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
```

What it deletes:

- the user's listings
- wishlists tied to those listings
- ratings tied to those listings
- the user's own wishlists
- the user's ratings
- the user's messages
- the user's profile
- the user's auth account

Note:

- This SQL version does not remove files from Supabase Storage buckets. It deletes the database rows and auth user.
