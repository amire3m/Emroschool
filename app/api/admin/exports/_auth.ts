import { getUserFromToken } from "@/lib/auth";
import { NextRequest } from "next/server";

const exportPermissions = new Set(["applications", "payments", "support"]);

export async function canExport(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  const user = authorization?.startsWith("Bearer ") ? await getUserFromToken(authorization.slice(7)) : null;
  if (!user) return false;
  if (user.role === "superadmin") return true;
  if (user.role !== "admin" || !user.permissions) return false;
  try {
    const permissions: unknown = JSON.parse(user.permissions);
    return Array.isArray(permissions) && permissions.some((permission) => typeof permission === "string" && exportPermissions.has(permission));
  } catch {
    return false;
  }
}
