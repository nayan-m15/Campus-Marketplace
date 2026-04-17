import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase environment variables." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: authError?.message || "User not authenticated." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { data: userListings, error: listingsQueryError } = await adminClient
      .from("listings")
      .select("id")
      .eq("user_id", user.id);

    if (listingsQueryError) throw listingsQueryError;

    const listingIds = (userListings || []).map((listing) => listing.id).filter(Boolean);

    if (listingIds.length > 0) {
      const { error: wishlistListingDeleteError } = await adminClient
        .from("wishlists")
        .delete()
        .in("listing_id", listingIds);

      if (wishlistListingDeleteError) throw wishlistListingDeleteError;

      const { error: ratingsListingDeleteError } = await adminClient
        .from("ratings")
        .delete()
        .in("listing_id", listingIds);

      if (ratingsListingDeleteError) throw ratingsListingDeleteError;
    }

    const rowDeletes = [
      adminClient.from("wishlists").delete().eq("user_id", user.id),
      adminClient.from("ratings").delete().eq("rater_id", user.id),
      adminClient.from("ratings").delete().eq("rated_id", user.id),
      adminClient.from("messages").delete().eq("sender_id", user.id),
      adminClient.from("messages").delete().eq("receiver_id", user.id),
      adminClient.from("listings").delete().eq("user_id", user.id),
      adminClient.from("profiles").delete().eq("id", user.id),
    ];

    const deleteResults = await Promise.all(rowDeletes);
    const failedDelete = deleteResults.find((result) => result.error);
    if (failedDelete?.error) throw failedDelete.error;

    for (const bucket of ["avatars", "listing-images"]) {
      const { data: storageObjects, error: listError } = await adminClient.storage
        .from(bucket)
        .list(user.id, { limit: 1000 });

      if (listError && !listError.message?.toLowerCase().includes("not found")) {
        throw listError;
      }

      const objectPaths = (storageObjects || [])
        .filter((item) => item.name)
        .map((item) => `${user.id}/${item.name}`);

      if (objectPaths.length > 0) {
        const { error: removeError } = await adminClient.storage.from(bucket).remove(objectPaths);
        if (removeError) throw removeError;
      }
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteUserError) throw deleteUserError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete account.";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
