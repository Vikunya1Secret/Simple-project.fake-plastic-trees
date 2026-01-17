import mongoose, { Document, Schema, Types } from 'mongoose';
import { IUser } from './User';
import { ICoffeeShop } from './CoffeeShop';

// Интерфейс для документа штрафа
export interface IPenalty extends Document {
    user: Types.ObjectId | IUser;
    coffeeShop: Types.ObjectId | ICoffeeShop;
    amount: number; // Сумма штрафа
    reason: string; // Причина штрафа (например, "Опоздание на 15 минут", "Невыход на смену")
    date: Date; // Дата, когда произошел инцидент / наложен штраф
    issuedBy: Types.ObjectId | IUser; // Менеджер/админ, который наложил штраф
    notes?: string; // Дополнительные комментарии
    createdAt: Date;
    updatedAt: Date;
}

const PenaltySchema: Schema = new Schema({
    user: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        index: true 
    },
    coffeeShop: { 
        type: Schema.Types.ObjectId, 
        ref: 'CoffeeShop', 
        required: true, 
        index: true
    },
    amount: { 
        type: Number, 
        required: true, 
        min: 0 
    },
    reason: { 
        type: String, 
        required: true, 
        trim: true 
    },
    date: { 
        type: Date, 
        required: true 
    },
    issuedBy: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    notes: { 
        type: String, 
        trim: true 
    }
}, {
    timestamps: true
});

export const Penalty = mongoose.model<IPenalty>('Penalty', PenaltySchema);