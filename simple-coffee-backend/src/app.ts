import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createClient } from 'redis';
import { config } from 'dotenv';

// Роуты
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import coffeeShopRoutes from './routes/coffeeShop';
import shiftRoutes from './routes/shift'
import wishRoutes from './routes/wish'
import statsRoutes from './routes/stats';
import penaltyRoutes from './routes/penalty';

// Middleware
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

// Сокеты
import { setupSocketHandlers } from './sockets';
import { setIoInstance } from './utils/socketEmitter';

// Загрузка переменных окружения
config();

const app = express();
const server = createServer(app);

// Redis клиент
export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Socket.IO сервер
export const io = new SocketServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

setIoInstance(io);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 15 минут
  max: 100 // максимум 100 запросов с одного IP
});
app.use(limiter);

// Подключение к Redis
redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Асинхронная функция для подключения
const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis successfully');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
};

connectRedis();

// Базовая проверка здоровья
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/coffee-shops', authMiddleware, coffeeShopRoutes);
app.use('/api/shifts', authMiddleware, shiftRoutes);
app.use("/api/wishes", authMiddleware, wishRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/penalties', penaltyRoutes);


// Обработка 404
app.use((req, res, next) => {
  if (req.accepts('json')) {
    res.status(404).json({ 
      success: false, 
      message: 'API endpoint not found',
      path: req.originalUrl
    });
  } else {
    res.status(404).type('txt').send('Not found');
  }
});

// Обработчик ошибок
app.use(errorHandler);

// Настройка сокетов
setupSocketHandlers(io);

export default server;