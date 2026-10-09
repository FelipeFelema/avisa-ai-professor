/** Keep the CLI URL and every other connection parameter byte-for-byte intact. */
export function runtimeConnectionString(connectionString: string): string {
  const queryStart = connectionString.indexOf('?');
  const fragmentStart = connectionString.indexOf('#');
  if (
    queryStart === -1 ||
    (fragmentStart !== -1 && fragmentStart < queryStart)
  ) {
    return connectionString;
  }

  const queryEnd =
    fragmentStart === -1 ? connectionString.length : fragmentStart;
  const query = connectionString
    .slice(queryStart + 1, queryEnd)
    .replace(/(^|&)sslmode=require(?=&|$)/g, '$1sslmode=verify-full');

  return (
    connectionString.slice(0, queryStart + 1) +
    query +
    connectionString.slice(queryEnd)
  );
}
