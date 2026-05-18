import { z } from 'zod';

// ============== AUTH SCHEMAS ==============
export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain lowercase letters')
    .regex(/[A-Z]/, 'Password must contain uppercase letters')
    .regex(/\d/, 'Password must contain numbers')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain special characters'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
  role: z.enum(['admin', 'landlord', 'tenant']),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const VerifyOTPSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export const ResendOTPSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
});

// ============== USER SCHEMAS ==============
export const UpdateProfileSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  nationalIdNumber: z.string().optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  occupation: z.string().optional(),
  employer: z.string().optional(),
  monthlyIncome: z.number().positive().optional(),
  bio: z.string().max(500).optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain lowercase letters')
    .regex(/[A-Z]/, 'Password must contain uppercase letters')
    .regex(/\d/, 'Password must contain numbers')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain special characters'),
});

// ============== PROPERTY SCHEMAS ==============
export const CreatePropertySchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  propertyType: z.enum(['studio', 'apartment', 'house', 'townhouse', 'villa', 'condo', 'commercial']),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().optional(),
  country: z.string().min(2),
  postalCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  bedrooms: z.number().int().positive(),
  bathrooms: z.number().positive(),
  area: z.number().positive('Area must be positive'),
  rentPrice: z.number().positive('Rent price must be positive'),
  depositAmount: z.number().positive('Deposit amount must be positive'),
  utilities: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  petFriendly: z.boolean().default(false),
  furnished: z.boolean().default(false),
  parking: z.boolean().default(false),
  securityFeatures: z.array(z.string()).optional(),
  rules: z.array(z.string()).optional(),
});

export const UpdatePropertySchema = CreatePropertySchema.partial();

export const PropertyFiltersSchema = z.object({
  search: z.string().optional(),
  propertyType: z.enum(['studio', 'apartment', 'house', 'townhouse', 'villa', 'condo', 'commercial']).optional(),
  city: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  bedrooms: z.number().int().optional(),
  furnished: z.boolean().optional(),
  petFriendly: z.boolean().optional(),
  parking: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['ASC', 'DESC']).default('ASC'),
});

// ============== APPLICATION SCHEMAS ==============
export const CreateApplicationSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  employmentStatus: z.enum(['employed', 'self_employed', 'unemployed', 'student']),
  monthlyIncome: z.number().positive('Monthly income must be positive'),
  employerName: z.string().optional(),
  yearsAtCurrentJob: z.number().int().nonnegative().optional(),
  previousRentals: z.number().int().nonnegative().optional(),
  creditScore: z.number().int().min(0).max(1000).optional(),
  referees: z.array(z.string()).optional(),
  criminalRecord: z.boolean().default(false),
});

export const ApproveApplicationSchema = z.object({
  approvalScore: z.number().int().min(0).max(100).optional(),
});

export const RejectApplicationSchema = z.object({
  rejectionReason: z.string().min(10, 'Rejection reason must be at least 10 characters'),
});

export const ApplicationFiltersSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'withdrawn']).optional(),
  tenantId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
});

// ============== LEASE SCHEMAS ==============
export const CreateLeaseSchema = z.object({
  applicationId: z.string().uuid('Invalid application ID'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  rentAmount: z.number().positive('Rent amount must be positive'),
  depositAmount: z.number().positive('Deposit amount must be positive'),
  paymentDueDay: z.number().int().min(1).max(31),
  terms: z.string().optional(),
  specialConditions: z.string().optional(),
}).refine((data) => new Date(data.endDate) > new Date(data.startDate), {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export const SignLeaseSchema = z.object({
  role: z.enum(['tenant', 'landlord']),
});

export const TerminateLeaseSchema = z.object({
  terminationReason: z.string().min(10),
});

// ============== PAYMENT SCHEMAS ==============
export const RecordPaymentSchema = z.object({
  leaseId: z.string().uuid('Invalid lease ID'),
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(['mpesa', 'airtel', 'tigo', 'bank', 'cash']),
  transactionReference: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  notes: z.string().optional(),
});

export const PaymentFiltersSchema = z.object({
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']).optional(),
  paymentMethod: z.enum(['mpesa', 'airtel', 'tigo', 'bank', 'cash']).optional(),
  tenantId: z.string().uuid().optional(),
  leaseId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
});

// ============== MAINTENANCE SCHEMAS ==============
export const CreateMaintenanceSchema = z.object({
  leaseId: z.string().uuid('Invalid lease ID'),
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  category: z.enum([
    'plumbing',
    'electrical',
    'hvac',
    'appliances',
    'flooring',
    'walls',
    'windows',
    'roofing',
    'landscaping',
    'other',
  ]),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  photoUrls: z.array(z.string().url()).optional(),
  estimatedCost: z.number().positive().optional(),
});

export const UpdateMaintenanceStatusSchema = z.object({
  status: z.enum(['pending', 'assigned', 'in_progress', 'completed', 'cancelled']),
  completionNotes: z.string().optional(),
  assignedToId: z.string().uuid().optional(),
});

export const MaintenanceFiltersSchema = z.object({
  status: z.enum(['pending', 'assigned', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  category: z.enum([
    'plumbing',
    'electrical',
    'hvac',
    'appliances',
    'flooring',
    'walls',
    'windows',
    'roofing',
    'landscaping',
    'other',
  ]).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
});

// ============== DISPUTE SCHEMAS ==============
export const CreateDisputeSchema = z.object({
  leaseId: z.string().uuid('Invalid lease ID'),
  category: z.enum([
    'rent_payment',
    'deposit',
    'maintenance',
    'property_damage',
    'lease_violation',
    'security',
    'other',
  ]),
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  claimedAmount: z.number().positive().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

export const ResolveDisputeSchema = z.object({
  status: z.enum(['resolved', 'closed', 'appealed']),
  settlementAmount: z.number().nonnegative().optional(),
  resolution: z.string().min(10),
});

export const DisputeFiltersSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'appealed']).optional(),
  category: z.enum([
    'rent_payment',
    'deposit',
    'maintenance',
    'property_damage',
    'lease_violation',
    'security',
    'other',
  ]).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
});

// ============== UTILITY SCHEMAS ==============
export const UUIDSchema = z.object({
  id: z.string().uuid('Invalid UUID'),
});

export const EmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const PhoneSchema = z.object({
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
});

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
});

// Type exports for autocomplete
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>;
export type CreateApplicationInput = z.infer<typeof CreateApplicationSchema>;
export type CreateLeaseInput = z.infer<typeof CreateLeaseSchema>;
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
export type CreateMaintenanceInput = z.infer<typeof CreateMaintenanceSchema>;
export type CreateDisputeInput = z.infer<typeof CreateDisputeSchema>;
