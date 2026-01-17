import mongoose, { Document, Schema, Types, PopulatedDoc } from 'mongoose';
import { IUser } from './User';

export interface ICoffeeShop extends Document {
	id: string;
	name: string;
	address: string;
	phone: string;
	managers: PopulatedDoc<IUser & Document>[] | Types.ObjectId[];
	openTime: string;
	closeTime: string;
	timezone: string;
	maxBaristasPerShift: number;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

const coffeeShopSchema = new Schema<ICoffeeShop>(
	{
		name: {
			type: String,
			required: [true, 'Coffee shop name is required'],
			trim: true
		},
		address: {
			type: String,
			required: [true, 'Address is required'],
			trim: true
		},
		phone: {
			type: String,
			required: [true, 'Phone number is required'],
			trim: true
		},
		managers: [{
			type: Schema.Types.ObjectId,
			ref: 'User'
		}],
		openTime: {
			type: String,
			default: '08:00',
			match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format (00:00-23:59)']
		},
		closeTime: {
			type: String,
			default: '22:00',
			match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format (00:00-23:59)']
		},
		timezone: {
			type: String,
			default: 'Europe/Moscow'
		},
		maxBaristasPerShift: {
			type: Number,
			required: [true, 'Max baristas per shift is required'],
			min: [1, 'Must have at least one barista per shift'],
			default: 2
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

coffeeShopSchema.virtual('id').get(function(this: ICoffeeShop & { _id: Types.ObjectId }) {
	return this._id.toHexString();
});

export const CoffeeShop = mongoose.model<ICoffeeShop>('CoffeeShop', coffeeShopSchema);