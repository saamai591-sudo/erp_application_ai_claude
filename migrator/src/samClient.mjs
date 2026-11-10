import sql from "mssql";

/**
 * اتصال فقط‌خواندنی به SQL Server سام. فقط SELECT/WITH پذیرفته می‌شود (قفل نرم‌افزاری علاوه بر دسترسی کاربر).
 * server می‌تواند «host\instance» باشد (نیاز به SQL Server Browser) یا host با port جدا.
 */
export async function connectSam({ server, port, database, user, password, encrypt = false, trustServerCertificate = true }) {
  let host = server;
  let instanceName;
  if (server.includes("\\")) [host, instanceName] = server.split("\\");
  const pool = await new sql.ConnectionPool({
    server: host,
    ...(instanceName ? {} : port ? { port: Number(port) } : {}),
    database,
    user,
    password,
    connectionTimeout: 30000,
    requestTimeout: 600000,
    options: { ...(instanceName ? { instanceName } : {}), encrypt, trustServerCertificate, readOnlyIntent: true },
  }).connect();

  return {
    async query(text, params = {}) {
      if (!/^\s*(SELECT|WITH)\b/i.test(text)) throw new Error("فقط کوئری خواندنی مجاز است");
      const req = pool.request();
      for (const [k, v] of Object.entries(params)) req.input(k, v);
      const r = await req.query(text);
      return r.recordset ?? [];
    },
    close: () => pool.close(),
  };
}
