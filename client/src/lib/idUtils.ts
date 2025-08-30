/**
 * Utility functions for enhanced ID formatting to make them traceable in audit logs
 */

export type EntityType = 'courier' | 'user' | 'department' | 'branch' | 'vendor' | 'received_courier' | 'audit_log';

/**
 * Formats an ID with a prefix based on entity type for better audit trail tracking
 */
export function formatEntityId(id: number | string, entityType: EntityType): string {
  const prefixes: Record<EntityType, string> = {
    courier: 'COU',
    user: 'USR', 
    department: 'DEP',
    branch: 'BRA',
    vendor: 'VEN',
    received_courier: 'REC',
    audit_log: 'AUD'
  };

  return `${prefixes[entityType]}-${id}`;
}

/**
 * Extracts the numeric ID from a formatted entity ID
 */
export function extractEntityId(formattedId: string): number {
  const parts = formattedId.split('-');
  return parseInt(parts[parts.length - 1]);
}

/**
 * Gets the entity type from a formatted ID
 */
export function getEntityType(formattedId: string): EntityType | null {
  const typeMap: Record<string, EntityType> = {
    'COU': 'courier',
    'USR': 'user',
    'DEP': 'department', 
    'BRA': 'branch',
    'VEN': 'vendor',
    'REC': 'received_courier',
    'AUD': 'audit_log'
  };

  const prefix = formattedId.split('-')[0];
  return typeMap[prefix] || null;
}