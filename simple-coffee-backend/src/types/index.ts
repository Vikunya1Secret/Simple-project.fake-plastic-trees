import { Request } from 'express';
import { IUser } from '../models/User';
import { Document, Types } from 'mongoose';


// Интерфейс для JWT-payload, который будет декодирован
export interface JwtPayload {
  userId: string;
  email: string;
  role: 'barista' | 'manager' | 'admin';
  coffeeShop: string | undefined; // ID кофейни, если есть
}

export interface AuthUserDocument {
  id: string;
  userId: string;

  email: string;
  role: string;
  isActive: boolean;

  coffeeShop?: any; // если есть
}


export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: Omit<IUser, 'password'>;
    token: string;
    refreshToken: string;
  };
}

export interface SocketUser {
  id: string;
  email: string;
  role: string;
  coffeeShop: string;
  fullName: string;
}