export function postgresConnectionOptions(databaseUrl, certificate) {
  const connectionString = new URL(databaseUrl);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(connectionString.hostname);
  const ca = certificate?.replaceAll("\\n", "\n");
  if (ca) connectionString.searchParams.delete("sslmode");

  return {
    connectionString: connectionString.toString(),
    ssl: ca || !local ? { rejectUnauthorized: true, ca } : undefined,
  };
}
