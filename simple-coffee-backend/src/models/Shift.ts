import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './User'; 
import { ICoffeeShop } from './CoffeeShop';

// Типы смен
export type ShiftType = 'work' | 'sick_leave' | 'vacation' | 'day_off';

export interface IShift extends Document {
    user: Types.ObjectId | IUser;
    coffeeShop: Types.ObjectId | ICoffeeShop;
    date: Date;
    type: ShiftType;
    startTime?: string;
    endTime?: string;
    durationHours: number;
    hourlyRate: number;
    createdBy: Types.ObjectId | IUser;
    comment?: string;
    createdAt: Date;
    updatedAt: Date;
}

const ShiftSchema: Schema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    coffeeShop: { type: Schema.Types.ObjectId, ref: 'CoffeeShop', required: true, index: true },
    date: { type: Date, required: true, index: true },
    type: { 
        type: String, 
        enum: ['work','sick_leave','vacation','day_off'], 
        required: true,
        default: 'work'
    },
    startTime: { 
        type: String, 
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 
        required: function(this: IShift) { return this.type === 'work'; } 
    },
    endTime: { 
        type: String, 
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 
        required: function(this: IShift) { return this.type === 'work'; } 
    },
    durationHours: { type: Number, required: true, default: 0 },
    hourlyRate: { type: Number, required: true, min: 0 },
    // isPublished убрано, смены видны сразу
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: String }
}, { timestamps: true });

// Автоматический расчет длительности смены (только для work)
ShiftSchema.pre('save', function(this: IShift, next) {
    if (this.isModified('startTime') || this.isModified('endTime') || this.isNew) {
        if (this.type === 'work' && this.startTime && this.endTime) {
            const [startH, startM] = this.startTime.split(':').map(Number);
            const [endH, endM] = this.endTime.split(':').map(Number);

            let startMinutes = startH * 60 + startM;
            let endMinutes = endH * 60 + endM;
            if (endMinutes < startMinutes) endMinutes += 24 * 60;

            this.durationHours = parseFloat(((endMinutes - startMinutes) / 60).toFixed(2));
        } else {
            this.durationHours = 0;
        }
    }
    next();
});

// Индексы для быстрого поиска
ShiftSchema.index({ user: 1, date: 1 });
ShiftSchema.index({ coffeeShop: 1, date: 1 });
// Уникальный индекс: один тип смены в день для одного юзера (чтобы не было дублей)
ShiftSchema.index({ user: 1, date: 1, type: 1 }, { unique: true, sparse: true });

export const Shift = mongoose.model<IShift>('Shift', ShiftSchema);