import webpush from "web-push";
import { createClient } from "@/lib/supabase/service";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export async function sendPushToProfile(profileId: string, payload: PushPayload) {
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
