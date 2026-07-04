"use client";

import { useEffect, useState } from "react";

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

async function subscribeToPush(registration: ServiceWorkerRegistration) {
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
  });
  await sendSubscriptionToServer(subscription);
}

export default function PushProvider() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    async function checkExisting() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      if (Notification.permission === "denied") return;

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();

      if (existing) {
        await sendSubscriptionToServer(existing);
        return;
      }

      // iOS Safari (and Safari in general) only shows the permission dialog
      // when requestPermission() is called directly inside a user gesture —
      // calling it here on mount is silently ignored. Show a button instead.
      if (Notification.permission === "default") {
        setShowPrompt(true);
      }
    }

    checkExisting().catch(console.error);
  }, []);

  async function handleEnable() {
    setEnabling(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setShowPrompt(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      await subscribeToPush(registration);
      setShowPrompt(false);
    } catch (e) {
      console.error(e);
    } finally {
      setEnabling(false);
    }
  }

  if (!showPrompt) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-indigo-50 border-b border-indigo-100 text-sm">
      <span className="text-indigo-900">Ativar notificações de tarefas e eventos?</span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setShowPrompt(false)}
          className="px-3 py-1.5 text-indigo-700 text-xs font-medium"
        >
          Agora não
        </button>
        <button
          onClick={handleEnable}
          disabled={enabling}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-medium disabled:opacity-60"
        >
          {enabling ? "..." : "Ativar"}
        </button>
      </div>
    </div>
  );
}
