import { Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { User } from '../models/User';
import { redisClient } from '../app';
import { SocketUser } from '../types';

export const authMiddleware = async (socket: Socket, next: any) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication token is required'));
    }

    // Проверка в blacklist
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return next(new Error('Token has been invalidated'));
    }

    const decoded = verifyToken(token);
    
    const user = await User.findById(decoded.userId)
      .select('-password')
      .populate('coffeeShop');

    if (!user || !user.isActive) {
      return next(new Error('User not found or inactive'));
    }

    // Используем user.id вместо user._id
    const socketUser: SocketUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      coffeeShop: (user.coffeeShop as any).id, // Используем .id
      fullName: user.fullName
    };

    socket.data.user = socketUser;
    next();
  } catch (error) {
    console.error('Socket auth error:', error);
    next(new Error('Invalid authentication token'));
  }
};