export function cleanLiveWorkingChunk(text: string): string {
  if (!text) return '';

  const collapsedWhitespace = text.replace(/\s+/g, ' ').trim();
  if (!collapsedWhitespace) return '';

  const words = collapsedWhitespace.split(' ');
  const cleaned: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const current = words[i];
    const prev = cleaned[cleaned.length - 1];
    if (prev && prev.toLowerCase() === current.toLowerCase()) continue;
    cleaned.push(current);
  }

  return cleaned.join(' ').trim();
}
