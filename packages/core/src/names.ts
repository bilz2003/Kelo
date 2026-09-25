/**
 * A member's name is stored as two parts (User.firstName / User.lastName) so each
 * context can use the right one instead of parsing a joined string:
 *
 *  - the DEFAULT LISTING NAME uses the first name alone ("Grace's driveway");
 *  - AVATAR INITIALS use both parts ("GH");
 *  - the member's OWN account / dashboard, and a host seeing who booked, use the full name.
 *
 * lastName can legitimately be "" (a pre-split single-word name such as "Cher",
 * see the split_user_name migration) — every helper below tolerates that.
 */
export interface PersonName {
  firstName: string;
  lastName: string;
}

/** "Grace Hopper"; just "Cher" when there is no last name. */
export const fullName = (n: PersonName): string => [n.firstName, n.lastName].filter(Boolean).join(" ");

/** "GH"; "C" for a single-word name; "?" only if both parts are empty. */
export const initialsOf = (n: PersonName): string => (n.firstName.charAt(0) + n.lastName.charAt(0)).toUpperCase() || "?";

/** What a listing is called until its host names it: "{firstName}'s driveway". */
export const defaultListingName = (firstName: string): string => `${firstName}'s driveway`;
