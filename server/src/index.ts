import express from 'express';
import { config } from './config/environment';
import { connectDatabase } from './config/database';
import { getRedisClient } from './config/redis';
import { errorMiddleware } from './middlewares/errorMiddleware';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import propertyRoutes from './routes/propertyRoutes';
import applicationRoutes from './routes/applicationRoutes';
import leaseRoutes from './routes/leaseRoutes';
import paymentRoutes from './routes/paymentRoutes';
import maintenanceRoutes from './routes/maintenanceRoutes';
import disputeRoutes from './routes/disputeRoutes';
import analyticsRoutes from './routes/analyticsRoutes';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', config.server.corsOrigin);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
const apiPrefix = '/api/v1';

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/users`, userRoutes);
app.use(`${apiPrefix}/properties`, propertyRoutes);
app.use(`${apiPrefix}/applications`, applicationRoutes);
app.use(`${apiPrefix}/leases`, leaseRoutes);
app.use(`${apiPrefix}/payments`, paymentRoutes);
app.use(`${apiPrefix}/maintenance`, maintenanceRoutes);
app.use(`${apiPrefix}/disputes`, disputeRoutes);
app.use(`${apiPrefix}/analytics`, analyticsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
  });
});

// Error handler
app.use(errorMiddleware);

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    
    // Test Redis connection
    const redis = getRedisClient();
    redis.ping((err, reply) => {
      if (err) {
        console.error('❌ Redis error:', err);
      } else {
        console.log('✅ Redis ping:', reply);
      }
    });

    // Start listening
    app.listen(config.server.port, () => {
      console.log(`
        ╔═══════════════════════════════════════════╗
        ║   🏠 Property Management Platform          ║
        ║   ✅ Server Started Successfully           ║
        ║   🚀 Running on port ${config.server.port}          ║
        ║   📝 Docs: http://localhost:${config.server.port}/api-docs ║
        ║   🌍 CORS Origin: ${config.server.corsOrigin}  ║
        ║   🔧 Environment: ${config.server.nodeEnv.toUpperCase()}      ║
        ╚═══════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
