import { v4 as uuidv4 } from 'uuid';
import { DatabaseService, DbVendor } from '../../database/db.service.ts';
import { AuthenticatedUser, Role, VendorStatus, OutboxStatus } from '../../common/types.ts';
import { AppError } from '../../common/response.dto.ts';
import { checkOrgBoundary } from '../../common/auth.guard.ts';

export interface CreateVendorDto {
  vendor_code: string;
  legal_name: string;
  tax_id: string;
  address: string;
  contact_email: string;
  organization_id?: string;
}

export interface UpdateVendorDto {
  legal_name?: string;
  tax_id?: string;
  address?: string;
  contact_email?: string;
  status?: VendorStatus;
}

export interface VendorFilterQuery {
  search?: string;
  status?: VendorStatus;
  page?: number;
  limit?: number;
}

export class VendorsService {
  private db = DatabaseService.getInstance();

  async createVendor(dto: CreateVendorDto, currentUser: AuthenticatedUser): Promise<DbVendor> {
    if (!dto.vendor_code || !dto.legal_name || !dto.tax_id || !dto.address || !dto.contact_email) {
      throw new AppError('VALIDATION_ERROR', 'All vendor fields are required');
    }

    const orgId = currentUser.role === Role.ADMIN && dto.organization_id ? dto.organization_id : currentUser.organizationId;

    // Check duplicate vendor code within the target organization
    for (const v of this.db.vendors.values()) {
      if (v.organization_id === orgId && v.vendor_code.toUpperCase() === dto.vendor_code.trim().toUpperCase()) {
        throw new AppError('DUPLICATE_VENDOR_CODE', `Vendor code '${dto.vendor_code}' already exists in this organization`, 409);
      }
    }

    const newVendor: DbVendor = {
      id: uuidv4(),
      vendor_code: dto.vendor_code.trim().toUpperCase(),
      legal_name: dto.legal_name.trim(),
      tax_id: dto.tax_id.trim(),
      address: dto.address.trim(),
      contact_email: dto.contact_email.trim().toLowerCase(),
      organization_id: orgId,
      status: VendorStatus.ACTIVE,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Atomic DB write: Vendor record + Outbox event
    this.db.vendors.set(newVendor.id, newVendor);

    const outboxEventId = uuidv4();
    this.db.application_events.set(outboxEventId, {
      id: outboxEventId,
      event_type: 'VENDOR_CREATED',
      entity_id: newVendor.id,
      entity_type: 'VENDOR',
      actor_id: currentUser.id,
      organization_id: orgId,
      payload: {
        vendor_code: newVendor.vendor_code,
        legal_name: newVendor.legal_name,
        tax_id: newVendor.tax_id,
      },
      status: OutboxStatus.PENDING,
      attempt_count: 0,
      last_error: null,
      created_at: new Date(),
      processed_at: null,
    });

    return newVendor;
  }

  async getVendors(query: VendorFilterQuery, currentUser: AuthenticatedUser) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

    let items = Array.from(this.db.vendors.values());

    // Role & Organization boundary filtering
    if (currentUser.role !== Role.ADMIN) {
      items = items.filter((v) => v.organization_id === currentUser.organizationId);
    }

    // Search query filtering
    if (query.search) {
      const q = query.search.toLowerCase();
      items = items.filter(
        (v) =>
          v.vendor_code.toLowerCase().includes(q) ||
          v.legal_name.toLowerCase().includes(q) ||
          v.tax_id.toLowerCase().includes(q) ||
          v.contact_email.toLowerCase().includes(q)
      );
    }

    // Status filtering
    if (query.status) {
      items = items.filter((v) => v.status === query.status);
    }

    // Sort descending by creation date
    items.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    const total = items.length;
    const paginatedItems = items.slice((page - 1) * limit, page * limit);

    return {
      items: paginatedItems,
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async getVendorById(id: string, currentUser: AuthenticatedUser): Promise<DbVendor> {
    const vendor = this.db.vendors.get(id);
    if (!vendor) {
      throw new AppError('VENDOR_NOT_FOUND', `Vendor with ID '${id}' not found`, 404);
    }

    if (!checkOrgBoundary(currentUser, vendor.organization_id)) {
      throw new AppError('FORBIDDEN', 'Access denied to vendor belonging to another organization', 403);
    }

    return vendor;
  }

  async updateVendor(id: string, dto: UpdateVendorDto, currentUser: AuthenticatedUser): Promise<DbVendor> {
    const vendor = await this.getVendorById(id, currentUser);

    if (dto.legal_name !== undefined) vendor.legal_name = dto.legal_name.trim();
    if (dto.tax_id !== undefined) vendor.tax_id = dto.tax_id.trim();
    if (dto.address !== undefined) vendor.address = dto.address.trim();
    if (dto.contact_email !== undefined) vendor.contact_email = dto.contact_email.trim().toLowerCase();
    if (dto.status !== undefined) vendor.status = dto.status;

    vendor.updated_at = new Date();
    this.db.vendors.set(vendor.id, vendor);

    // Audit outbox event
    const outboxEventId = uuidv4();
    this.db.application_events.set(outboxEventId, {
      id: outboxEventId,
      event_type: 'VENDOR_UPDATED',
      entity_id: vendor.id,
      entity_type: 'VENDOR',
      actor_id: currentUser.id,
      organization_id: vendor.organization_id,
      payload: {
        updated_fields: Object.keys(dto),
        current_status: vendor.status,
      },
      status: OutboxStatus.PENDING,
      attempt_count: 0,
      last_error: null,
      created_at: new Date(),
      processed_at: null,
    });

    return vendor;
  }
}
