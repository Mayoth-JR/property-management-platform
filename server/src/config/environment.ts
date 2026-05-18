import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  server: {
    port: parseInt(process.env.PORT || '5000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    apiVersion: 'v1',
  },

  // Database
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'property_management_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      max: parseInt(process.env.DB_POOL_MAX || '10'),
    },
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },

  // JWT
  jwt: {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'your-access-secret-key-change-in-production',
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  // CORS
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(','),
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },

  // Payment APIs
  payment: {
    mpesa: {
      consumerKey: process.env.MPESA_CONSUMER_KEY || '',
      consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
      shortCode: process.env.MPESA_SHORT_CODE || '',
      passkey: process.env.MPESA_PASSKEY || '',
      initiatorName: process.env.MPESA_INITIATOR_NAME || '',
      initiatorPassword: process.env.MPESA_INITIATOR_PASSWORD || '',
      baseUrl: process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke',
    },
    airtel: {
      clientId: process.env.AIRTEL_CLIENT_ID || '',
      clientSecret: process.env.AIRTEL_CLIENT_SECRET || '',
      businessCode: process.env.AIRTEL_BUSINESS_CODE || '',
      baseUrl: process.env.AIRTEL_BASE_URL || 'https://sandbox.airtel.africa',
    },
    tigo: {
      apiKey: process.env.TIGO_API_KEY || '',
      merchantId: process.env.TIGO_MERCHANT_ID || '',
      baseUrl: process.env.TIGO_BASE_URL || 'https://pesa.tigo.com/api',
    },
    crdb: {
      apiKey: process.env.CRDB_API_KEY || '',
      merchantId: process.env.CRDB_MERCHANT_ID || '',
      baseUrl: process.env.CRDB_BASE_URL || 'https://api.crdbbank.com',
    },
  },

  // SMS Gateway
  sms: {
    provider: process.env.SMS_PROVIDER || 'africas-talking', // 'africas-talking' or 'twilio'
    africasTalking: {
      apiKey: process.env.AFRICAS_TALKING_API_KEY || '',
      username: process.env.AFRICAS_TALKING_USERNAME || '',
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    },
  },

  // Email
  email: {
    provider: process.env.EMAIL_PROVIDER || 'sendgrid', // 'sendgrid' or 'smtp'
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY || '',
      fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@property-app.com',
    },
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      user: process.env.SMTP_USER || '',
      password: process.env.SMTP_PASSWORD || '',
      from: process.env.SMTP_FROM_EMAIL || 'noreply@property-app.com',
    },
  },

  // File Storage
  storage: {
    type: process.env.STORAGE_TYPE || 'local', // 'local' or 's3'
    local: {
      uploadDir: process.env.LOCAL_UPLOAD_DIR || './uploads',
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB
    },
    s3: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_REGION || 'us-east-1',
      bucketName: process.env.AWS_S3_BUCKET || '',
      bucketUrl: process.env.AWS_S3_URL || '',
    },
  },

  // OTP
  otp: {
    length: parseInt(process.env.OTP_LENGTH || '6'),
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10'),
  },

  // Application
  app: {
    name: 'Property Management Platform',
    version: '1.0.0',
    logo: process.env.APP_LOGO_URL || 'https://example.com/logo.png',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@property-app.com',
    supportPhone: process.env.SUPPORT_PHONE || '+255712345678',
  },

  // Feature Flags
  features: {
    enableEmailVerification: process.env.ENABLE_EMAIL_VERIFICATION === 'true',
    enablePhoneVerification: process.env.ENABLE_PHONE_VERIFICATION === 'true',
    enableSMSNotifications: process.env.ENABLE_SMS_NOTIFICATIONS === 'true',
    enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
    enableAutoApproval: process.env.ENABLE_AUTO_APPROVAL === 'true',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },
};

// Validation
const requiredVars = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

if (config.server.nodeEnv === 'production') {
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export default config;
