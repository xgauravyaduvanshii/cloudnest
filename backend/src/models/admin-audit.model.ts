import { query } from '../config/database.config';

const AdminAuditModel = {
  async create(data: {
    adminUserId?: string | null;
    targetUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    await query(
      `INSERT INTO admin_audit_logs (
        admin_user_id,
        target_user_id,
        action,
        entity_type,
        entity_id,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        data.adminUserId || null,
        data.targetUserId || null,
        data.action,
        data.entityType,
        data.entityId || null,
        JSON.stringify(data.metadata || {}),
      ],
    );
  },
};

export default AdminAuditModel;
