import { Request, Response, NextFunction } from 'express';
import { JwtPayload, AuthUserDocument } from '../types'; 
import { verifyToken } from '../utils/jwt';
import { User, IUser } from '../models/User'; 
import { redisClient } from '../app';
// ДОБАВЛЕНЫ ИМПОРТЫ для Document и Types
import { Document, Types } from 'mongoose'; 

// Определяем AuthRequest для использования в этом файле
interface AuthRequest extends Request {
  user?: JwtPayload | AuthUserDocument;
}

// Вспомогательный тип, который гарантирует, что Document имеет известный _id
type UserDocument = IUser & Document & { _id: Types.ObjectId };


export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Проверка в blacklist Redis
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token has been invalidated'
      });
    }

    const decoded = verifyToken(token) as JwtPayload;
    
    // Получаем пользователя, явно приводя тип к UserDocument.
    // Это устраняет ошибку "user._id" относится к типу unknown (TS18046).
    const user = await User.findById(decoded.userId)
      .select('-password')
      .populate('coffeeShop') as UserDocument; 

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    const authUser = {
      ...user.toJSON(),
      userId: user._id.toString(), 
      id: user._id.toString(),
    } as AuthUserDocument; // Приведение типа для устранения TS2322

    req.user = authUser;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // req.user теперь гарантированно имеет поле 'role'
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};