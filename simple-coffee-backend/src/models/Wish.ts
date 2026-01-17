import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './User'; // для связей
import { ICoffeeShop } from './CoffeeShop'; // для связей

// Типы пожеланий
export type WishType = 'work' | 'sick_leave' | 'vacation' | 'day_off' | 'swap';
export type WishStatus = 'pending' | 'approved' | 'rejected';

// Интерфейс для документа Mongoose
export interface IWish extends Document {
    user: Types.ObjectId | IUser;
    coffeeShop: Types.ObjectId | ICoffeeShop;
    date: Date;
    startTime?: string; 
    endTime?: string;
    type: WishType;
    status: WishStatus; // Новое поле
    comment?: string;   // Комментарий баристы
    swapWithUser?: Types.ObjectId | IUser; // Для обмена сменами
    createdAt: Date;
    updatedAt: Date;
}

const WishSchema: Schema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    coffeeShop: { type: Schema.Types.ObjectId, ref: 'CoffeeShop', required: true },
    date: { type: Date, required: true, index: true },
    type: { 
        type: String, 
        enum: ['work', 'sick_leave', 'vacation', 'day_off', 'swap'], 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected'], 
        default: 'pending' 
    },
    startTime: { 
        type: String, 
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        required: function(this: IWish) { return this.type === 'work'; } 
    },
    endTime: { 
        type: String, 
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        required: function(this: IWish) { return this.type === 'work'; } 
    },
    comment: { type: String },
    swapWithUser: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Индекс для предотвращения дублирования пожеланий на одинаковый день и интервал
// Хотя логика приложения должна обрабатывать пересечения, этот индекс помогает
WishSchema.index({ user: 1, date: 1, type: 1, startTime: 1, endTime: 1 }, { unique: true });

export const Wish = mongoose.model<IWish>('Wish', WishSchema);