import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isMissingAuthUser = (error: { status?: number; message?: string } | null) =>
  Boolean(error && (error.status === 404 || error.message?.toLowerCase().includes("user not found")));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secretKey = Deno.env.get("SUPABASE_SECRET_KEY");
    const authorization = req.headers.get("Authorization");

    if (!supabaseUrl || !secretKey || !authorization?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const token = authorization.slice("Bearer ".length);
    const { data: authData, error: authError } = await admin.auth.getUser(token);

    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: caller, error: callerError } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (callerError || caller?.role !== "devcom_head") {
      return new Response(JSON.stringify({ error: "FORBIDDEN" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (authData.user.app_metadata?.role !== "devcom_head") {
      return new Response(JSON.stringify({ error: "FORBIDDEN" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const userId = typeof body?.userId === "string" ? body.userId : "";
    if (!UUID_RE.test(userId) || userId === authData.user.id) {
      return new Response(JSON.stringify({ error: "INVALID_TARGET" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: tombstoneError } = await admin
      .from("account_deletion_tombstones")
      .upsert({ user_id: userId, deleted_by: authData.user.id }, { onConflict: "user_id" });
    if (tombstoneError) throw tombstoneError;

    const lockId = crypto.randomUUID();
    const { data: lockedTombstone, error: lockError } = await admin
      .from("account_deletion_tombstones")
      .update({ lock_id: lockId, lock_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() })
      .eq("user_id", userId)
      .or(`lock_id.is.null,lock_expires_at.lt.${new Date().toISOString()}`)
      .select("user_id")
      .maybeSingle();
    if (lockError) throw lockError;
    if (!lockedTombstone) throw new Error("DELETION_ALREADY_IN_PROGRESS");
    const renewLock = async () => {
      const { data, error } = await admin
        .from("account_deletion_tombstones")
        .update({ lock_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() })
        .eq("user_id", userId)
        .eq("lock_id", lockId)
        .select("user_id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("DELETION_LOCK_LOST");
    };

    const { data: tombstone, error: tombstoneReadError } = await admin
      .from("account_deletion_tombstones")
      .select("storage_deleted, public_data_deleted, auth_deleted, storage_paths, target_email")
      .eq("user_id", userId)
      .single();
    if (tombstoneReadError) throw tombstoneReadError;

    const { data: targetProfile, error: targetProfileError } = await admin
      .from("profiles")
      .select("id, email")
      .eq("id", userId)
      .maybeSingle();
    if (targetProfileError) throw targetProfileError;
    const { data: existingAuth, error: lookupError } = await admin.auth.admin.getUserById(userId);
    if (lookupError && !isMissingAuthUser(lookupError)) throw lookupError;
    const targetEmail = targetProfile?.email || existingAuth?.user?.email || tombstone.target_email;
    if (targetEmail && !tombstone.target_email) {
      const { error: emailStateError } = await admin
        .from("account_deletion_tombstones")
        .update({ target_email: targetEmail })
        .eq("user_id", userId);
      if (emailStateError) throw emailStateError;
    }

    if (!tombstone.storage_deleted) {
      await renewLock();
      let galleryPaths = tombstone.storage_paths || [];
      if (!galleryPaths.length) {
        const { data: galleryItems, error: galleryError } = await admin
          .from("gallery_items")
          .select("image_url, thumbnails")
          .eq("profile_id", userId);
        if (galleryError) throw galleryError;

        const galleryPrefixes = [
          "/storage/v1/object/public/gallery-images/",
          "/storage/v1/object/sign/gallery-images/",
        ];
        galleryPaths = (galleryItems || []).flatMap((item) =>
          [item.image_url, ...(item.thumbnails || [])].flatMap((url) => {
            const prefix = galleryPrefixes.find((candidate) => url.includes(candidate));
            const index = prefix ? url.indexOf(prefix) : -1;
            return prefix && index >= 0
              ? [decodeURIComponent(url.slice(index + prefix.length).split('?')[0])]
              : [];
          })
        );
        const { error: pathError } = await admin
          .from("account_deletion_tombstones")
          .update({ storage_paths: galleryPaths })
          .eq("user_id", userId);
        if (pathError) throw pathError;
      }

      if (galleryPaths.length) {
        const { error: storageError } = await admin.storage.from("gallery-images").remove(galleryPaths);
        if (storageError) throw storageError;

        for (const path of galleryPaths) {
          const separator = path.lastIndexOf('/');
          const folder = separator >= 0 ? path.slice(0, separator) : '';
          const fileName = separator >= 0 ? path.slice(separator + 1) : path;
          const { data: remainingObjects, error: storageCheckError } = await admin.storage
            .from("gallery-images")
            .list(folder, { search: fileName, limit: 10 });
          if (storageCheckError) throw storageCheckError;
          if (remainingObjects?.some((object) => object.name === fileName)) {
            throw new Error("STORAGE_OBJECT_REMAINS");
          }
        }
      }

      const { error: galleryDeleteError } = await admin
        .from("gallery_items")
        .delete()
        .eq("profile_id", userId);
      if (galleryDeleteError) throw galleryDeleteError;

      const { error: storageStateError } = await admin
        .from("account_deletion_tombstones")
        .update({ storage_deleted: true })
        .eq("user_id", userId);
      if (storageStateError) throw storageStateError;
    }

    if (targetEmail && !tombstone.public_data_deleted) {
      await renewLock();
      const { error: queuedEmailError } = await admin
        .from("email_queue")
        .delete()
        .eq("recipient_email", targetEmail);
      if (queuedEmailError) throw queuedEmailError;
    }

    if (!tombstone.public_data_deleted) {
      await renewLock();
      const { error: profileError } = await admin
        .from("profiles")
        .delete()
        .eq("id", userId)
        .select("id");
      if (profileError) throw profileError;

      const { data: remainingProfile, error: profileCheckError } = await admin
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      if (profileCheckError) throw profileCheckError;
      if (remainingProfile) throw new Error("PUBLIC_ACCOUNT_DATA_REMAINS");

      const { error: publicStateError } = await admin
        .from("account_deletion_tombstones")
        .update({ public_data_deleted: true })
        .eq("user_id", userId);
      if (publicStateError) throw publicStateError;
    }

    if (!tombstone.auth_deleted) {
      await renewLock();
      if (existingAuth?.user) {
        const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
        if (deleteAuthError && !isMissingAuthUser(deleteAuthError)) throw deleteAuthError;
      }

      const { data: remainingAuth, error: remainingAuthError } = await admin.auth.admin.getUserById(userId);
      if (remainingAuthError && !isMissingAuthUser(remainingAuthError)) throw remainingAuthError;
      if (remainingAuth?.user) throw new Error("AUTH_ACCOUNT_REMAINS");

      const { error: authStateError } = await admin
        .from("account_deletion_tombstones")
        .update({ auth_deleted: true })
        .eq("user_id", userId);
      if (authStateError) throw authStateError;
    }

    if (targetEmail) {
      const { count: queuedEmailCount, error: queuedEmailCheckError } = await admin
        .from("email_queue")
        .select("id", { count: "exact", head: true })
        .eq("recipient_email", targetEmail);
      if (queuedEmailCheckError) throw queuedEmailCheckError;
      if (queuedEmailCount) throw new Error("EMAIL_QUEUE_DATA_REMAINS");
    }

    for (const [table, column] of [
      ["profiles", "id"],
      ["event_registrations", "profile_id"],
      ["conversations", "profile_id"],
      ["concerns", "profile_id"],
      ["gallery_items", "profile_id"],
      ["messages", "student_id"],
      ["messages", "sender_id"],
    ] as const) {
      const { count, error: relatedError } = await admin
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq(column, userId);
      if (relatedError) throw relatedError;
      if (count) throw new Error("PUBLIC_ACCOUNT_DATA_REMAINS");
    }

    const { data: finalState, error: finalStateError } = await admin
      .from("account_deletion_tombstones")
      .select("storage_deleted, public_data_deleted, auth_deleted")
      .eq("user_id", userId)
      .single();
    if (finalStateError) throw finalStateError;
    if (!finalState.storage_deleted || !finalState.public_data_deleted || !finalState.auth_deleted) {
      throw new Error("DELETION_INCOMPLETE");
    }

    const { error: unlockError } = await admin
      .from("account_deletion_tombstones")
      .update({ lock_id: null, lock_expires_at: null })
      .eq("user_id", userId)
      .eq("lock_id", lockId);
    if (unlockError) throw unlockError;

    return new Response(JSON.stringify({ deleted: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Account deletion failed:", error);
    return new Response(JSON.stringify({ error: "DELETION_FAILED" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
