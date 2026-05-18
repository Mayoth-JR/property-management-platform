// User Types
export interface User {
  id: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  profileImage?: string;
  nationalId?: string;
  nationalIdImage?: string;
  kraPin?: string;
  dateOfBirth?: Date;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  lastLoginAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  LANDLORD = 'landlord',
  TENANT = 'tenant',
}

export interface UserProfile extends Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  monthlyIncome?: number;
  employmentStatus?: EmploymentStatus;
  employer?: string;
  designation?: string;
  creditScore?: number;
  numberOfDependents?: number;
  maritalStatus?: string;
  bio?: string;
}

export enum EmploymentStatus {
  EMPLOYED = 'employed',
  SELF_EMPLOYED = 'self-employed',
  UNEMPLOYED = 'unemployed',
  STUDENT = 'student',
  RETIRED = 'retired',
}

// Property Types
export interface Property {
  id: string;
  title: string;
  description: string;
  landlordId: string;
  propertyType: PropertyType;
  bedrooms: number;
  bathrooms: number;
  kitchens: number;
  livingRooms: number;
  rentPrice: number;
  depositAmount: number;
  currency: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  totalArea: number;
  areaUnit: string;
  yearBuilt?: number;
  status: PropertyStatus;
  amenities: string[];
  rules?: string[];
  images: PropertyImage[];
  documents: PropertyDocument[];
  createdAt: Date;
  updatedAt: Date;
}

export enum PropertyType {
  APARTMENT = 'apartment',
  HOUSE = 'house',
  STUDIO = 'studio',
  TOWNHOUSE = 'townhouse',
  DUPLEX = 'duplex',
  CONDO = 'condo',
  LAND = 'land',
}

export enum PropertyStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  MAINTENANCE = 'maintenance',
  UNAVAILABLE = 'unavailable',
}

export interface PropertyImage {
  id: string;
  propertyId: string;
  imageUrl: string;
  caption?: string;
  isPrimary: boolean;
  uploadedAt: Date;
}

export interface PropertyDocument {
  id: string;
  propertyId: string;
  documentUrl: string;
  documentType: string;
  uploadedAt: Date;
}

// Application Types
export interface Application {
  id: string;
  tenantId: string;
  propertyId: string;
  status: ApplicationStatus;
  approvalScore?: number;
  documents: ApplicationDocument[];
  employmentStatus?: EmploymentStatus;
  monthlyIncome?: number;
  creditScore?: number;
  numberOfDependents?: number;
  additionalInfo?: string;
  appliedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum ApplicationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}

export interface ApplicationDocument {
  id: string;
  applicationId: string;
  documentType: string;
  documentUrl: string;
  uploadedAt: Date;
}

// Lease Types
export interface Lease {
  id: string;
  tenantId: string;
  propertyId: string;
  landlordId: string;
  startDate: Date;
  endDate: Date;
  rentAmount: number;
  depositAmount: number;
  status: LeaseStatus;
  tenantSignature?: string;
  landlordSignature?: string;
  tenantSignedAt?: Date;
  landlordSignedAt?: Date;
  terms?: string;
  documents?: LeaseDocument[];
  createdAt: Date;
  updatedAt: Date;
}

export enum LeaseStatus {
  DRAFT = 'draft',
  PENDING_SIGNATURES = 'pending_signatures',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  TERMINATED = 'terminated',
}

export interface LeaseDocument {
  id: string;
  leaseId: string;
  documentUrl: string;
  uploadedAt: Date;
}

// Payment Types
export interface Payment {
  id: string;
  leaseId: string;
  tenantId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  status: PaymentStatus;
  paidAt: Date;
  dueDate: Date;
  notes?: string;
  receipt?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum PaymentMethod {
  MPESA = 'mpesa',
  AIRTEL = 'airtel',
  TIGO = 'tigo',
  BANK_TRANSFER = 'bank_transfer',
  CASH = 'cash',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// Maintenance Types
export interface MaintenanceRequest {
  id: string;
  leaseId: string;
  tenantId: string;
  landlordId: string;
  title: string;
  description: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  photos?: string[];
  assignedTechnicianId?: string;
  estimatedCost?: number;
  actualCost?: number;
  completedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum MaintenanceCategory {
  PLUMBING = 'plumbing',
  ELECTRICAL = 'electrical',
  HVAC = 'hvac',
  APPLIANCES = 'appliances',
  FLOORING = 'flooring',
  WALLS = 'walls',
  WINDOWS = 'windows',
  ROOFING = 'roofing',
  LANDSCAPING = 'landscaping',
  OTHER = 'other',
}

export enum MaintenancePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum MaintenanceStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// Dispute Types
export interface Dispute {
  id: string;
  leaseId: string;
  initiatorId: string;
  initiatorRole: UserRole;
  responderId: string;
  title: string;
  description: string;
  category: DisputeCategory;
  status: DisputeStatus;
  priority: DisputePriority;
  claimedAmount?: number;
  settledAmount?: number;
  resolutionNotes?: string;
  appealedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export enum DisputeCategory {
  RENT_PAYMENT = 'rent_payment',
  DEPOSIT = 'deposit',
  MAINTENANCE = 'maintenance',
  PROPERTY_DAMAGE = 'property_damage',
  LEASE_VIOLATION = 'lease_violation',
  SECURITY = 'security',
  OTHER = 'other',
}

export enum DisputeStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  APPEALED = 'appealed',
  CLOSED = 'closed',
}

export enum DisputePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  deliveryChannels: NotificationChannel[];
  createdAt: Date;
  readAt?: Date;
}

export enum NotificationType {
  RENT_REMINDER = 'rent_reminder',
  RENT_OVERDUE = 'rent_overdue',
  APPLICATION_UPDATE = 'application_update',
  LEASE_UPDATE = 'lease_update',
  MAINTENANCE_UPDATE = 'maintenance_update',
  DISPUTE_UPDATE = 'dispute_update',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  SYSTEM_ALERT = 'system_alert',
}

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  IN_APP = 'in_app',
  PUSH = 'push',
}

// Analytics Types
export interface RevenueDashboard {
  totalRevenue: number;
  totalProperties: number;
  occupiedProperties: number;
  occupancyRate: number;
  monthlyTrends: MonthlyTrend[];
  propertyPerformance: PropertyPerformance[];
  paymentCollectionRate: number;
}

export interface MonthlyTrend {
  month: string;
  revenue: number;
  count: number;
}

export interface PropertyPerformance {
  propertyId: string;
  title: string;
  revenue: number;
  occupancyRate: number;
}

export interface OccupancyDashboard {
  totalProperties: number;
  occupiedProperties: number;
  occupancyRate: number;
  byPropertyType: PropertyTypeOccupancy[];
  expiringLeases: ExpiringLease[];
}

export interface PropertyTypeOccupancy {
  type: PropertyType;
  total: number;
  occupied: number;
  rate: number;
}

export interface ExpiringLease {
  leaseId: string;
  propertyTitle: string;
  tenantName: string;
  expiryDate: Date;
  daysUntilExpiry: number;
}

export interface AdminDashboard {
  userStats: UserStats;
  propertyStats: PropertyStats;
  leaseStats: LeaseStats;
  paymentStats: PaymentStats;
  applicationStats: ApplicationStats;
  maintenanceStats: MaintenanceStats;
  disputeStats: DisputeStats;
}

export interface UserStats {
  totalUsers: number;
  adminCount: number;
  landlordCount: number;
  tenantCount: number;
  newUsersThisMonth: number;
}

export interface PropertyStats {
  totalProperties: number;
  availableProperties: number;
  occupiedProperties: number;
  maintenanceProperties: number;
}

export interface LeaseStats {
  totalLeases: number;
  activeLeases: number;
  expiredLeases: number;
  expiringNextMonth: number;
}

export interface PaymentStats {
  totalPayments: number;
  totalRevenue: number;
  averagePaymentAmount: number;
  pendingPayments: number;
  overduePayments: number;
}

export interface ApplicationStats {
  totalApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  pendingApplications: number;
  approvalRate: number;
}

export interface MaintenanceStats {
  totalRequests: number;
  completedRequests: number;
  pendingRequests: number;
  avgCompletionTime: number;
}

export interface DisputeStats {
  totalDisputes: number;
  resolvedDisputes: number;
  pendingDisputes: number;
  averageResolutionTime: number;
}

// Pagination Types
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
  error?: string;
}

// Query Filter Types
export interface PropertyFilters {
  type?: PropertyType;
  minRent?: number;
  maxRent?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  city?: string;
  status?: PropertyStatus;
  search?: string;
}

export interface ApplicationFilters {
  status?: ApplicationStatus;
  propertyId?: string;
  tenantId?: string;
  minScore?: number;
  maxScore?: number;
}

export interface PaymentFilters {
  status?: PaymentStatus;
  method?: PaymentMethod;
  startDate?: Date;
  endDate?: Date;
  leaseId?: string;
  tenantId?: string;
}
