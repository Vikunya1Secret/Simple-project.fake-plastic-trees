import { Request, Response } from 'express';
import { JwtPayload, AuthUserDocument, LoginRequest } from '../types';
import { User } from '../models/User';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { redisClient } from '../app';

interface AuthRequest extends Request {
  user?: JwtPayload | AuthUserDocument;
}

export const login = async (req: Request<{}, {}, LoginRequest>, res: Response) => {
  try {
    const { email, password } = req.body;

    // Валидация входных данных
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Поиск пользователя с паролем
    const user = await User.findOne({ email, isActive: true })
      .select('+password')
      .populate('coffeeShop');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Проверка пароля
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Генерация токенов
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      coffeeShop: user.coffeeShop ? (user.coffeeShop as any).id : null
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Сохранение refresh token в Redis (24 часа)
    await redisClient.setEx(
      `refresh:${user.id}`, // Используем user.id
      24 * 60 * 60,
      refreshToken
    );

    // Убираем пароль из ответа
    const userResponse = {
      id: user.id, // Используем user.id
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      coffeeShop: user.coffeeShop,
      hourlyRate: user.hourlyRate,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    
    // Проверка refresh token в Redis
    const storedRefreshToken = await redisClient.get(`refresh:${decoded.userId}`);
    if (!storedRefreshToken || storedRefreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Генерация нового access token
    const newToken = generateToken({
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      coffeeShop: decoded.coffeeShop
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken
      }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const userId = req.user?.userId; // Используем .id

    if (token) {
      // Добавление токена в blacklist (15 минут - время жизни оригинального токена)
      await redisClient.setEx(`blacklist:${token}`, 15 * 60, 'true');
    }

    if (userId) {
      // Удаление refresh token
      await redisClient.del(`refresh:${userId}`);
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout'
    });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.userId) // Используем .id
      .select('-password')
      .populate('coffeeShop');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Формируем ответ с id вместо _id
    const userResponse = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      coffeeShop: user.coffeeShop,
      hourlyRate: user.hourlyRate,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json({
      success: true,
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};