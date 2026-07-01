"use client";

import { useEffect } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

async function sendSubscriptionToServer(sub: PushSubscription) {
  const json = sub.toJSON();
  await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    }),
  });
}

export default function PushProvider() {
  useEffect(() => {
    async function subscribe() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      if (Notification.permission === "denied") return;

      const registration = await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await sendSubscriptionToServer(existing);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      await sendSubscriptionToServer(subscription);
    }

    subscribe().catch(console.error);
  }, []);

  return null;
}
