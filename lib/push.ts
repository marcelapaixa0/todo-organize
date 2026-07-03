import webpush from "web-push";
import { createClient } from "@/lib/supabase/service";

// Configure VAPID lazily and defensively. If any env var is missing or
// malformed, web-push throws synchronously — and because this runs at module
// import time, that throw would crash every server action that imports this
// file (createTask, updateTask, etc.) with an uncatchable error. Guarding it
// keeps push optional instead of fatal.
const vapidSubject = process.env.VAPID_SUBJECT;
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

let pushConfigured = false;
if (vapidSubject && vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    pushConfigured = true;
  } catch (e) {
    console.error("[push] VAPID configuration invalid, push disabled:", e);
  }
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export async function sendPushToProfile(profileId: string, payload: PushPayload) {
  if (!pushConfigured) return;

  const supabase = createClient();

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("profile_id", profileId);

  if (!subs?.length) return;

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      const err = result.reason as { statusCode?: number };
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subs[i].endpoint);
      }
    }
  }
}
