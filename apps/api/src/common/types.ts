export enum Role {
  ADMIN = 'ADMIN',
  VENDOR = 'VENDOR',
  PROCUREMENT_OFFICER = 'PROCUREMENT_OFFICER',
  PPK = 'PPK',
  FINANCE = 'FINANCE',
  AUTHORIZED_OFFICER = 'AUTHORIZED_OFFICER',
  PAYMENT_SYSTEM = 'PAYMENT_SYSTEM',
  AUDITOR = 'AUDITOR',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum VendorStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum POStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  RECEIVED = 'RECEIVED',
  VERIFIED = 'VERIFIED',
  CANCELLED = 'CANCELLED',
}

export enum OutboxStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

export enum BlockchainTxStatus {
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string;
  status: UserStatus;
}
