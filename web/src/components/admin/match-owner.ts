export function matchesOwnerSearch(
  owner: { email: string; dogs: readonly string[] },
  query: string,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (owner.email.toLowerCase().includes(needle)) return true;
  return owner.dogs.some((dog) => dog.toLowerCase().includes(needle));
}
