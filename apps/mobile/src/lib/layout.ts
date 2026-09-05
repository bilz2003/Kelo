// Shared layout constant — see RootNavigator.tsx's MinimizedSessionBanner
// for where this number actually comes from (tab bar height + safe-area
// bottom + its own gap and card height). Real bug this audit found: any
// screen with its own bottom-sticky primary action (Charger Detail's
// "Book this charger", Booking Flow's "Confirm booking") rendered that
// button directly underneath where the banner sits once a session is
// minimized — not just visually crowded, but genuinely unclickable, since
// the banner's own Pressable physically overlapped the same pixels and
// intercepted the tap. Screens with an absolutely-positioned bottom CTA
// add this much extra bottom clearance whenever `session.active &&
// !session.visible` is true, so the two never occupy the same space.
export const MINIMIZED_BANNER_CLEARANCE = 164;
