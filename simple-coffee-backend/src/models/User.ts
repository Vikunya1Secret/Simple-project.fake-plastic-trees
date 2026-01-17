import mongoose, { Document, Schema, PopulatedDoc, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ICoffeeShop } from './CoffeeShop';

export interface IUser extends Document {
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: 'barista' | 'manager' | 'admin';
  coffeeShop: PopulatedDoc<ICoffeeShop & Document> | Types.ObjectId | null;
  hourlyRate: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    role: {
      type: String,
      enum: ['barista', 'manager', 'admin'],
      required: [true, 'Role is required']
    },
    coffeeShop: {
      type: Schema.Types.ObjectId,
      ref: 'CoffeeShop',
      required: [true, 'Coffee shop is required']
    },
    hourlyRate: {
      type: Number,
      required: [true, 'Hourly rate is required'],
      min: [0, 'Hourly rate cannot be negative']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Исправленный виртуальный геттер
userSchema.virtual('id').get(function(this: IUser & { _id: Types.ObjectId }) {
  return this._id.toHexString();
});

// Остальной код без изменений...
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.index({ email: 1 });
userSchema.index({ coffeeShop: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

export const User = mongoose.model<IUser>('User', userSchema);