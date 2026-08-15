export const universitySearchLimit = 200;

export function filterUniversityOptions(options: string[], query: string): string[] {
  const needle = query.trim();
  const matches = needle ? options.filter((name) => name.includes(needle)) : options;
  return matches.slice(0, universitySearchLimit);
}

export function commitUniversityValue({
  current,
  typed,
  selected,
}: {
  current: string;
  typed: string;
  selected: string;
}): string {
  if (selected) return selected;
  const manual = typed.trim();
  return manual || current;
}
