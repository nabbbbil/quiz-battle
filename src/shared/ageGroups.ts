// The host picks one when creating a room. Everyone in the room gets the same
// questions, pitched at that age group.
export const AGE_GROUPS = [
  {
    id: "7-8",
    label: "Ages 7–8",
    topics: "Adding and subtracting up to 100, then the 2, 5 and 10 times tables",
  },
  {
    id: "9-10",
    label: "Ages 9–10",
    topics: "Times tables 2 to 10, dividing, missing numbers, sums up to 1,000",
  },
  {
    id: "11-12",
    label: "Ages 11–12",
    topics: "Times tables to 12, bigger multiplying and dividing, fractions, percentages, order of operations",
  },
] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number]["id"];

export const DEFAULT_AGE_GROUP: AgeGroup = "9-10";

/** Use on the server to check the `ageGroup` a client sends when creating a room. */
export function isAgeGroup(value: unknown): value is AgeGroup {
  return AGE_GROUPS.some((g) => g.id === value);
}

export function ageGroupLabel(id: AgeGroup): string {
  return AGE_GROUPS.find((g) => g.id === id)!.label;
}
