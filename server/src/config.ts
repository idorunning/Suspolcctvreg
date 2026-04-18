const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
};

const optional = (key: string, fallback = ''): string => process.env[key] ?? fallback;

export const config = {
  port: Number(process.env.PORT || 4000),
  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:3000'),

  databaseUrl: required('DATABASE_URL'),

  jwtSecret: required('JWT_SECRET'),
  jwtTtlSeconds: Number(process.env.JWT_TTL_SECONDS || 28800),

  ldap: {
    url: required('LDAP_URL'),
    bindDn: required('LDAP_BIND_DN'),
    bindPassword: required('LDAP_BIND_PASSWORD'),
    searchBase: required('LDAP_SEARCH_BASE'),
    searchFilter: optional('LDAP_SEARCH_FILTER', '(mail={{email}})'),
    userGroupDns: optional('LDAP_USER_GROUP_DNS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  adminBootstrapEmail: optional('ADMIN_BOOTSTRAP_EMAIL').toLowerCase(),
};

export type AppConfig = typeof config;
