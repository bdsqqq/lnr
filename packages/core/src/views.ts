import type { LinearClient } from "@linear/sdk";
import type { CustomView, CreateCustomViewInput, UpdateCustomViewInput } from "./types";

export async function listViews(client: LinearClient): Promise<CustomView[]> {
  try {
    const connection = await client.customViews();
    return connection.nodes.map((v) => ({
      id: v.id,
      name: v.name,
      description: v.description,
      icon: v.icon,
      color: v.color,
      filterData: v.filterData as Record<string, unknown>,
      shared: v.shared,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));
  } catch {
    return [];
  }
}

export async function getView(
  client: LinearClient,
  nameOrId: string
): Promise<CustomView | null> {
  try {
    const views = await listViews(client);
    const normalizedInput = nameOrId.toLowerCase();

    const match = views.find(
      (v) => v.name.toLowerCase() === normalizedInput || v.id === nameOrId
    );

    return match ?? null;
  } catch {
    return null;
  }
}

export async function getViewById(
  client: LinearClient,
  viewId: string
): Promise<CustomView | null> {
  try {
    const view = await client.customView(viewId);

    if (!view) {
      return null;
    }

    return {
      id: view.id,
      name: view.name,
      description: view.description,
      icon: view.icon,
      color: view.color,
      filterData: view.filterData as Record<string, unknown>,
      shared: view.shared,
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function createView(
  client: LinearClient,
  input: CreateCustomViewInput
): Promise<CustomView | null> {
  try {
    const payload = await client.createCustomView({
      name: input.name,
      description: input.description,
      icon: input.icon,
      color: input.color,
      filterData: input.filterData,
      shared: input.shared,
    });

    const view = await payload.customView;

    if (!view) {
      return null;
    }

    return {
      id: view.id,
      name: view.name,
      description: view.description,
      icon: view.icon,
      color: view.color,
      filterData: view.filterData as Record<string, unknown>,
      shared: view.shared,
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function updateView(
  client: LinearClient,
  viewId: string,
  input: UpdateCustomViewInput
): Promise<boolean> {
  try {
    const payload = await client.updateCustomView(viewId, {
      name: input.name,
      description: input.description,
      icon: input.icon,
      color: input.color,
      filterData: input.filterData,
      shared: input.shared,
    });

    return payload.success;
  } catch {
    return false;
  }
}

export async function deleteView(
  client: LinearClient,
  viewId: string
): Promise<boolean> {
  try {
    const payload = await client.deleteCustomView(viewId);
    return payload.success;
  } catch {
    return false;
  }
}
