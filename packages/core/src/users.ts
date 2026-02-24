import type { LinearClient } from "@linear/sdk";
import type { User } from "./types";

export async function listUsers(client: LinearClient): Promise<User[]> {
  const usersConnection = await client.users();
  return usersConnection.nodes.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    displayName: u.displayName,
    active: u.active,
    admin: u.admin,
  }));
}

export async function getUser(
  client: LinearClient,
  id: string
): Promise<User | null> {
  try {
    const user = await client.user(id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      displayName: user.displayName,
      active: user.active,
      admin: user.admin,
    };
  } catch {
    return null;
  }
}

export async function findUserByEmail(
  client: LinearClient,
  email: string
): Promise<User | null> {
  const users = await client.users({
    filter: { email: { eq: email.toLowerCase() } },
  });
  const user = users.nodes[0];

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    displayName: user.displayName,
    active: user.active,
    admin: user.admin,
  };
}

export async function findUserByNameOrEmail(
  client: LinearClient,
  nameOrEmail: string
): Promise<User | null> {
  const users = await client.users();
  const user = users.nodes.find(
    (u) =>
      u.email?.toLowerCase() === nameOrEmail.toLowerCase() ||
      u.name.toLowerCase() === nameOrEmail.toLowerCase()
  );

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    displayName: user.displayName,
    active: user.active,
    admin: user.admin,
  };
}
