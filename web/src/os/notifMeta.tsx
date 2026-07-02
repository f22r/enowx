import { Bell, MessageSquare, ChevronUp, Smile, AtSign, Handshake, ShieldCheck, Truck, ShoppingCart, CircleDollarSign } from "lucide-react";
import type { Notification } from "../lib/api";
import { navigateToNotif } from "./notifNav";

// Shared icon/verb maps + click routing for notifications, used by both the
// top-bar bell and the macOS-style banner so they stay in sync.
export const NOTIF_ICON: Record<string, typeof Bell> = {
  reply: MessageSquare,
  upvote: ChevronUp,
  reaction: Smile,
  mention: AtSign,
  deal: Handshake,
  middleman: ShieldCheck,
  shipped: Truck,
  purchase: ShoppingCart,
  released: CircleDollarSign,
};

export const NOTIF_VERB: Record<string, string> = {
  reply: "replied",
  upvote: "upvoted",
  reaction: "reacted",
  mention: "mentioned you",
  deal: "wants to deal",
  middleman: "needs you as middleman",
  shipped: "shipped your item",
  purchase: "— your order is ready",
  released: "released the funds",
};

// routeNotif opens the right context for a notification click. It hands off to
// the desktop via notifNav (which owns view/app state); routing is by ref_type:
// post/comment → open the post, chat → chat view, rekber → marketplace deal,
// order → orders. Desktop does the actual switch.
export function routeNotif(n: Notification) {
  navigateToNotif(n);
}
