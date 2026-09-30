import { AdminRole } from '@prisma/client';
import type { Permission } from '@lumea/types';

const ALL_PERMISSIONS: Permission[] = [
  'products.read',
  'products.create',
  'products.update',
  'products.delete',
  'orders.read',
  'orders.update',
  'customers.read',
  'customers.update',
  'inventory.read',
  'inventory.update',
  'content.read',
  'content.create',
  'content.update',
  'analytics.read',
  'coupons.read',
  'coupons.create',
  'coupons.update',
  'coupons.delete',
  'tickets.read',
  'tickets.update',
];

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  [AdminRole.SUPER_ADMIN]: ALL_PERMISSIONS,
  [AdminRole.ADMIN]: ALL_PERMISSIONS.filter((p) => !p.startsWith('products.delete')),
  [AdminRole.MANAGER]: [
    'products.read',
    'products.create',
    'products.update',
    'orders.read',
    'orders.update',
    'customers.read',
    'customers.update',
    'inventory.read',
    'inventory.update',
    'analytics.read',
    'coupons.read',
    'coupons.create',
    'coupons.update',
    'tickets.read',
    'tickets.update',
  ],
  [AdminRole.EDITOR]: ['content.read', 'content.create', 'content.update', 'products.read'],
};

export function permissionsForRole(role: AdminRole | null | undefined): Permission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] ?? [];
}
