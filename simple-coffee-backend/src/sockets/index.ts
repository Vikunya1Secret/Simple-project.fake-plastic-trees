import { Server as SocketServer } from 'socket.io';
import { authMiddleware } from './authMiddleware';

export const setupSocketHandlers = (io: SocketServer) => {
  // Middleware аутентификации для сокетов
  io.use(authMiddleware);

  io.on('connection', (socket) => {
    console.log(`User ${socket.data.user.id} connected`);

    // Подписка на комнаты
    socket.join(`coffeeshop:${socket.data.user.coffeeShop}`);
    socket.join(`user:${socket.data.user.id}`);

    socket.emit('auth:success', {
        user: socket.data.user,
        message: 'Authentication successful and rooms joined'
    });

    if (socket.data.user.role === 'manager') {
      socket.join(`manager:${socket.data.user.coffeeShop}`);
    }

    if (socket.data.user.role === 'admin') {
      socket.join(`admin:coffeeshop:${socket.data.user.coffeeShop}`);
    }

    socket.on('disconnect', () => {
      console.log(`User ${socket.data.user.id} disconnected`);
    });
  });
};