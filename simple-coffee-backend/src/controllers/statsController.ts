import { Request, Response } from 'express';
import { Shift } from '../models/Shift';
import { Wish } from '../models/Wish';
import { User } from '../models/User';
import { Penalty } from '../models/Penalty'; 
import { AuthUserDocument } from '../types';
import { Types } from 'mongoose';

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

/**
 * ИСПРАВЛЕНО: Функция для гарантированного получения ObjectId.
 * Агрегации MongoDB требуют именно Types.ObjectId для корректной фильтрации.
 */
const toObjectId = (id: any): Types.ObjectId | null => {
    if (!id) return null;
    try {
        const stringId = typeof id === 'object' ? (id._id?.toString() || id.id?.toString()) : id;
        return new Types.ObjectId(stringId);
    } catch (e) {
        return null;
    }
};

const normalizeDate = (dateString: string, endOfDay: boolean = false): Date => {
    const date = new Date(dateString);
    if (endOfDay) {
        date.setHours(23, 59, 59, 999);
    } else {
        date.setHours(0, 0, 0, 0);
    }
    return date;
};

const getCoffeeShopFilter = (authUser: AuthUserDocument, coffeeShopId?: string): any => {
    const filter: any = {};
    let targetId: Types.ObjectId | null = null;

    if (authUser.role === 'manager' && authUser.coffeeShop) {
        targetId = toObjectId(authUser.coffeeShop);
    } else if (authUser.role === 'admin' && coffeeShopId) {
        targetId = toObjectId(coffeeShopId);
    }

    if (targetId) {
        filter.coffeeShop = targetId;
    }
    return filter;
};

// --- КОНТРОЛЛЕРЫ ---

export const getDashboardSummary = async (req: Request, res: Response) => {
    try {
        const authUser = req.user as AuthUserDocument;
        const { dateFrom, dateTo, coffeeShopId } = req.validatedQuery;

        const dateFilter: any = {};
        if (dateFrom) dateFilter.$gte = normalizeDate(dateFrom);
        if (dateTo) dateFilter.$lte = normalizeDate(dateTo, true);

        const coffeeShopFilter = getCoffeeShopFilter(authUser, coffeeShopId);
        
        // 1. Считаем смены
        const shiftAggregation = await Shift.aggregate([
            { $match: { ...coffeeShopFilter, date: dateFilter } }, 
            {
                $group: {
                    _id: null,
                    totalShifts: { $sum: 1 },
                    totalShiftHours: { $sum: '$durationHours' } 
                }
            }
        ]);

        // 2. Расчет ФОТ
        const payrollAggregation = await Shift.aggregate([
            { $match: { ...coffeeShopFilter, date: dateFilter } },
            { $lookup: {
                from: 'users', 
                localField: 'user',
                foreignField: '_id',
                as: 'userInfo'
            }},
            { $unwind: '$userInfo' },
            { $addFields: {
                shiftIncome: { $multiply: ['$durationHours', '$userInfo.hourlyRate'] }
            }},
            { $group: {
                _id: null,
                totalPayroll: { $sum: '$shiftIncome' }
            }}
        ]);

        const [shiftStats] = shiftAggregation;
        const [payrollStats] = payrollAggregation;
            
        const pendingWishesCount = await Wish.countDocuments({
            ...coffeeShopFilter,
            ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
            status: 'pending' // ИСПРАВЛЕНО: фильтруем по полю status, а не isApproved
        });
        
        let activeBaristasCount = await User.countDocuments({
            role: 'barista',
            isActive: true,
            ...coffeeShopFilter,
        });

        const penaltySummary = await Penalty.aggregate([
            { $match: { ...coffeeShopFilter, date: dateFilter }},
            { $group: { _id: null, totalPenalties: { $sum: '$amount' } } }
        ]);

        const totalPayroll = payrollStats?.totalPayroll || 0;
        const totalPenalties = penaltySummary[0]?.totalPenalties || 0;

        res.json({
            success: true,
            data: {
                totalShifts: shiftStats?.totalShifts || 0,
                totalShiftHours: parseFloat((shiftStats?.totalShiftHours || 0).toFixed(2)),
                pendingWishesCount,
                activeBaristasCount,
                totalPayroll: parseFloat(totalPayroll.toFixed(2)),
                totalPenaltiesInPeriod: parseFloat(totalPenalties.toFixed(2)),
                netLaborCost: parseFloat((totalPayroll - totalPenalties).toFixed(2)),
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Ошибка сводки дашборда' });
    }
};

export const getUserSummary = async (req: Request, res: Response) => {
    try {
        const authUser = req.user as AuthUserDocument;
        const { userId } = req.params;
        const { dateFrom, dateTo } = req.validatedQuery;

        // Проверка прав
        if (authUser.role === 'barista' && authUser.userId !== userId) {
            return res.status(403).json({ success: false, message: 'Нет прав' });
        }
        
        // ВАЖНО: Превращаем строку в ObjectId для агрегации
        const targetUserId = toObjectId(userId);
        const targetUser = await User.findById(userId).select('hourlyRate');
        
        if (!targetUser || !targetUserId) {
            return res.status(404).json({ success: false, message: 'Пользователь не найден' });
        }

        const rangeDateFilter: any = {};
        if (dateFrom) rangeDateFilter.$gte = normalizeDate(dateFrom);
        if (dateTo) rangeDateFilter.$lte = normalizeDate(dateTo, true);
        
        const today = normalizeDate(new Date().toISOString());

        // АГРЕГАЦИЯ
        const statsResult = await Shift.aggregate([
            { 
                $match: { 
                    user: targetUserId, // Используем ObjectId
                    ...(Object.keys(rangeDateFilter).length > 0 ? { date: rangeDateFilter } : {}) 
                    // УБРАНО: isPublished: true (чтобы статистика видела текущие смены)
                } 
            },
            { 
                $group: {
                    _id: null,
                    totalShiftsInPeriod: { $sum: 1 },
                    totalHoursInPeriod: { $sum: '$durationHours' },
                    // Считаем прошедшие
                    pastShiftsCount: { 
                        $sum: { $cond: [{ $lt: ['$date', today] }, 1, 0] } 
                    },
                    // Считаем будущие (теперь считаем все, не только опубликованные)
                    futureShiftsCount: { 
                        $sum: { $cond: [{ $gte: ['$date', today] }, 1, 0] } 
                    },
                    pastShiftHours: { 
                        $sum: { $cond: [{ $lt: ['$date', today] }, '$durationHours', 0] } 
                    },
                    futureShiftHours: { 
                        $sum: { $cond: [{ $gte: ['$date', today] }, '$durationHours', 0] } 
                    }
                }
            }
        ]);

        const userShiftStats = statsResult[0] || {};

        const totalHours = userShiftStats.totalHoursInPeriod || 0;
        
        // Пожелания считаем отдельно через countDocuments (он менее капризный к типам)
        const totalWishes = await Wish.countDocuments({
            user: targetUserId,
            ...(Object.keys(rangeDateFilter).length > 0 ? { date: rangeDateFilter } : {})
        });

        // Штрафы
        const penaltySummary = await Penalty.aggregate([
            { 
                $match: { 
                    user: targetUserId, 
                    ...(Object.keys(rangeDateFilter).length > 0 ? { date: rangeDateFilter } : {}) 
                } 
            },
            { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
        ]);

        const totalPenalties = penaltySummary[0]?.totalAmount || 0;
        const hourlyRate = targetUser.hourlyRate || 0;
        const totalIncome = totalHours * hourlyRate;

        res.json({
            success: true,
            data: {
                userId,
                totalShiftsInPeriod: userShiftStats.totalShiftsInPeriod || 0,
                totalHoursInPeriod: parseFloat(totalHours.toFixed(2)),
                wishesSubmitted: totalWishes,
                totalIncome: parseFloat(totalIncome.toFixed(2)),
                totalPenaltiesAmount: parseFloat(totalPenalties.toFixed(2)),
                netEarnings: parseFloat((totalIncome - totalPenalties).toFixed(2)),
                pastShiftsCount: userShiftStats.pastShiftsCount || 0,
                futurePublishedShiftsCount: userShiftStats.futureShiftsCount || 0 // Для совместимости фронта
            }
        });
    } catch (error) {
        console.error('getUserSummary error:', error);
        res.status(500).json({ success: false, message: 'Ошибка статистики пользователя' });
    }
};