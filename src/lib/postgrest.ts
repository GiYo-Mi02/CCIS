const MAX_SEARCH_LENGTH = 200;

function quotePostgrestValue(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

export function postgrestIlike(value: string): string {
  const term = value.trim();
  if (term.length > MAX_SEARCH_LENGTH || term.includes('\0')) {
    throw new Error('Search value is invalid or too long.');
  }

  const pattern = `%${term.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
  return quotePostgrestValue(pattern);
}

export function postgrestEquals(value: string): string {
  if (value.includes('\0')) {
    throw new Error('Filter value is invalid.');
  }
  return quotePostgrestValue(value);
}
