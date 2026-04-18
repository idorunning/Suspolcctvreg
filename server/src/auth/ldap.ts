import { Client } from 'ldapts';
import { config } from '../config.js';

export interface LdapUser {
  dn: string;
  email: string;
  displayName?: string;
  groupDns: string[];
}

export async function ldapAuthenticate(email: string, password: string): Promise<LdapUser | null> {
  const client = new Client({ url: config.ldap.url });
  try {
    // Bind as the service account so we can locate the user's DN.
    await client.bind(config.ldap.bindDn, config.ldap.bindPassword);

    const filter = config.ldap.searchFilter.replace(/\{\{email\}\}/g, escapeLdap(email));
    const { searchEntries } = await client.search(config.ldap.searchBase, {
      filter,
      scope: 'sub',
      attributes: ['dn', 'mail', 'userPrincipalName', 'displayName', 'memberOf'],
      sizeLimit: 2,
    });

    if (searchEntries.length !== 1) return null;
    const entry = searchEntries[0];
    const userDn = String(entry.dn);

    // Re-bind as the user to validate the password.
    await client.unbind();
    await client.bind(userDn, password);

    const resolvedEmail =
      (entry.mail as string | undefined) ||
      (entry.userPrincipalName as string | undefined) ||
      email;
    const displayName = entry.displayName as string | undefined;
    const memberOf = toArray(entry.memberOf);

    return {
      dn: userDn,
      email: resolvedEmail.toLowerCase(),
      displayName,
      groupDns: memberOf,
    };
  } catch {
    return null;
  } finally {
    try {
      await client.unbind();
    } catch {
      // ignore unbind errors
    }
  }
}

function toArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

function escapeLdap(input: string): string {
  return input.replace(/[\\\0()*]/g, (ch) => {
    switch (ch) {
      case '\\':
        return '\\5c';
      case '\0':
        return '\\00';
      case '(':
        return '\\28';
      case ')':
        return '\\29';
      case '*':
        return '\\2a';
      default:
        return ch;
    }
  });
}
