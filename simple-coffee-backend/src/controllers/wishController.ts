import { Request, Response } from 'express';
import { Wish, IWish } from '../models/Wish';
import { Shift } from '../models/Shift'; // Импортируем Shift для создания смен
import { User } from '../models/User';
import { AuthUserDocument } from '../types';
import { getIo, emitWishUpdate, emitShiftUpdate } from '../utils/socketEmitter';
import { Types } from 'mongoose';

export const compareObjectIds = (a: any, b: any): boolean => {
    if (!a || !b) return false;

    const extractId = (val: any): string => {
        if (val instanceof Types.ObjectId) return val.toHexString();
        if (typeof val === 'string') return val;
        if (typeof val === 'object') {
            // Проверяем наличие _id (Mongoose Document) или id
            const id = val._id || val.id;
            return id ? id.toString() : '';
        }
        return String(val);
    };

    const idA = extractId(a);
    const idB = extractId(b);

    return idA !== '' && idB !== '' && idA === idB;
};
// --- CRUD операции ---

// GET /api/wishes
export const getWishes = async (req: Request, res: Response) => {
    try {
        const {
            page = 1,
            limit = 20,
            coffeeShop: filterCoffeeShop,
            user: filterUser,
            dateFrom,
            dateTo,
            type,
            status // Добавлен фильтр по статусу
        } = req.validatedQuery;

        const pageNumber = parseInt(page as string);
        const limitNumber = parseInt(limit as string);
        const skip = (pageNumber - 1) * limitNumber;

        const filter: any = {};
        
        if (req.user?.role === 'barista') {
            filter.user = req.user.userId;
        } else if (req.user?.role === 'manager') {
            filter.coffeeShop = req.user.coffeeShop;
        }

        if (req.user?.role !== 'barista') {
            if (filterCoffeeShop) filter.coffeeShop = filterCoffeeShop;
            if (filterUser) filter.user = filterUser;
        }
        
        if (type) filter.type = type;
        if (status) filter.status = status;

        if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) filter.date.$gte = new Date(dateFrom);
            if (dateTo) filter.date.$lte = new Date(dateTo);
        }

        const wishes = await Wish.find(filter)
            .populate('user', 'fullName')
            .populate('swapWithUser', 'fullName') // Подгружаем имя для обмена
            .populate('coffeeShop', 'name')
            .sort({ date: 1, createdAt: -1 })
            .skip(skip)
            .limit(limitNumber);

        const total = await Wish.countDocuments(filter);
        const totalPages = Math.ceil(total / limitNumber);

        res.json({
            success: true,
            data: {
                wishes,
                pagination: { page: pageNumber, limit: limitNumber, total, totalPages }
            }
        });

    } catch (error) {
        console.error('Get wishes error:', error);
        res.status(500).json({ success: false, message: 'Ошибка при получении списка пожеланий' });
    }
};

// GET /api/wishes/:id
export const getWishById = async (req: Request, res: Response) => {
    // Без изменений, логика стандартная
    try {
        const { id } = req.params;
        const wish = await Wish.findById(id)
            .populate('user', 'fullName')
            .populate('swapWithUser', 'fullName')
            .populate('coffeeShop', 'name');

        if (!wish) {
            return res.status(404).json({ success: false, message: 'Пожелание не найдено' });
        }
        
        if (req.user?.role === 'barista' && wish.user.toString() !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'Нет прав' });
        }
        
        if (req.user?.role === 'manager' &&  (!compareObjectIds(wish.coffeeShop, req.user.coffeeShop))) {
             return res.status(403).json({ success: false, message: 'Нет прав' });
        }

        res.json({ success: true, data: { wish } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Ошибка' });
    }
};

// POST /api/wishes
export const createWish = async (req: Request, res: Response) => {
    try {
        const wishData = req.validatedBody;
        const authUser = req.user!;
        
        if (authUser.role !== 'barista') {
             return res.status(403).json({ success: false, message: 'Только бариста может создавать пожелания' });
        }

        // Проверка для обмена сменами
        if (wishData.type === 'swap') {
            if (!wishData.swapWithUser) {
                return res.status(400).json({ success: false, message: 'Для обмена нужно указать бариста (swapWithUser).' });
            }
            
            const targetUser = await User.findById(wishData.swapWithUser);
            
            // ИСПРАВЛЕНО: Используем compareObjectIds для сравнения кофейни бариста
            if (!targetUser || !compareObjectIds(targetUser.coffeeShop, authUser.coffeeShop)) {
                return res.status(400).json({ success: false, message: 'Бариста для обмена должен быть из этой же кофейни.' });
            }
        }

        const newWish = new Wish({
            ...wishData,
            user: authUser.userId,
            coffeeShop: authUser.coffeeShop,
            status: 'pending'
        });
        await newWish.save();

        const createdWish = await Wish.findById(newWish._id)
            .populate('user', 'fullName')
            .populate('swapWithUser', 'fullName')
            .populate('coffeeShop', 'name');

        emitWishUpdate(createdWish!.coffeeShop.id.toString(), 'created', createdWish);    
        
        res.status(201).json({
            success: true,
            message: 'Запрос отправлен',
            data: { wish: createdWish }
        });

    } catch (error) {
        console.error('Create wish error:', error);
        res.status(400).json({ success: false, message: (error instanceof Error) ? error.message : 'Ошибка' });
    }
};

// PUT /api/wishes/:id/status (Одобрение/Отклонение менеджером)
export const updateWishStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'approved' | 'rejected'
        const authUser = req.user!;

        if (authUser.role === 'barista') {
            return res.status(403).json({ success: false, message: 'Бариста не может менять статус заявки.' });
        }

        const wish = await Wish.findById(id);
        if (!wish) return res.status(404).json({ success: false, message: 'Заявка не найдена' });

        if (authUser.role === 'manager' && !compareObjectIds(wish.coffeeShop, authUser.coffeeShop)) {
            return res.status(403).json({ success: false, message: 'Нет прав доступа к этой заявке' });
        }

        if (wish.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Заявка уже обработана.' });
        }

        // Логика ОДОБРЕНИЯ
        if (status === 'approved') {
            
            // 1. Обработка типа WORK (Просьба поставить смену)
            if (wish.type === 'work') {
                const existingShift = await Shift.findOne({ user: wish.user, date: wish.date, type: 'work' });
                if (existingShift) throw new Error('У сотрудника уже есть рабочая смена в этот день.');

                // Создаем смену
                const newShift = new Shift({
                    user: wish.user,
                    coffeeShop: wish.coffeeShop,
                    date: wish.date,
                    type: 'work',
                    startTime: wish.startTime,
                    endTime: wish.endTime,
                    createdBy: authUser.userId,
                    hourlyRate: 0, // Нужно подтянуть из юзера, но для скорости оставим 0, User model нужен
                    comment: wish.comment
                });
                
                // Подтягиваем ставку (оптимизация: можно вынести)
                const u = await User.findById(wish.user);
                if (u) newShift.hourlyRate = u.hourlyRate;
                
                await newShift.save();
                
                // Отправляем сокет о новой смене
                const populatedShift = await Shift.findById(newShift._id).populate('user', 'fullName').populate('coffeeShop', 'name');
                emitShiftUpdate(wish.coffeeShop.toString(), wish.user.toString(), 'created', populatedShift);
            }

            // 2. Обработка SICK_LEAVE / VACATION / DAY_OFF (Просьба отсутствовать)
            else if (['sick_leave', 'vacation', 'day_off'].includes(wish.type)) {
                // Если есть рабочая смена в этот день - удаляем её (или меняем тип)
                const conflictingShift = await Shift.findOne({ user: wish.user, date: wish.date, type: 'work' });
                
                if (conflictingShift) {
                    await Shift.findByIdAndDelete(conflictingShift._id);
                    emitShiftUpdate(wish.coffeeShop.toString(), wish.user.toString(), 'deleted', { id: conflictingShift._id });
                }

                // Создаем запись об отсутствии
                const newShift = new Shift({
                    user: wish.user,
                    coffeeShop: wish.coffeeShop,
                    date: wish.date,
                    type: wish.type, // 'sick_leave' и т.д.
                    durationHours: 0,
                    hourlyRate: 0,
                    createdBy: authUser.userId,
                    comment: wish.comment
                });
                await newShift.save();

                const populatedShift = await Shift.findById(newShift._id).populate('user', 'fullName').populate('coffeeShop', 'name');
                emitShiftUpdate(wish.coffeeShop.toString(), wish.user.toString(), 'created', populatedShift);
            }

            // 3. Обработка SWAP (Обмен сменами)
            else if (wish.type === 'swap' && wish.swapWithUser) {
                // Ищем смену инициатора в этот день
                const initiatorShift = await Shift.findOne({ user: wish.user, date: wish.date, type: 'work' });
                
                if (!initiatorShift) {
                    return res.status(400).json({ success: false, message: 'Нет смены для обмена на эту дату.' });
                }

                // Обновляем владельца смены
                initiatorShift.user = wish.swapWithUser;
                // При обмене ставку нужно обновить на ставку нового сотрудника? 
                // Обычно да.
                const targetUserDoc = await User.findById(wish.swapWithUser);
                if (targetUserDoc) initiatorShift.hourlyRate = targetUserDoc.hourlyRate;

                await initiatorShift.save();

                const populatedShift = await Shift.findById(initiatorShift._id).populate('user', 'fullName').populate('coffeeShop', 'name');
                emitShiftUpdate(wish.coffeeShop.toString(), wish.user.toString(), 'updated', populatedShift);
                // Также уведомляем нового владельца (через общий канал кофейни он увидит)
            }
        }

        // Обновляем статус Wish
        wish.status = status;
        await wish.save();

        const updatedWish = await Wish.findById(wish._id)
            .populate('user', 'fullName')
            .populate('swapWithUser', 'fullName')
            .populate('coffeeShop', 'name');

        emitWishUpdate(updatedWish!.coffeeShop.id.toString(), 'updated', updatedWish);

        res.json({
            success: true,
            message: `Заявка ${status === 'approved' ? 'одобрена' : 'отклонена'}`,
            data: { wish: updatedWish }
        });

    } catch (error) {
        console.error('Update wish status error:', error);
        res.status(500).json({ success: false, message: 'Ошибка при обновлении статуса' });
    }
};

// PUT /api/wishes/:id (Редактирование самой заявки баристой)
export const updateWish = async (req: Request, res: Response) => {
    // Разрешаем редактировать только если статус pending
    try {
        const { id } = req.params;
        const updateData = req.validatedBody;
        const authUser = req.user!;
        
        const existingWish = await Wish.findById(id);
        if (!existingWish) return res.status(404).json({ success: false, message: 'Не найдено' });

        if (existingWish.user.toString() !== authUser.userId) {
             return res.status(403).json({ success: false, message: 'Нет прав' });
        }

        if (existingWish.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Нельзя изменить уже обработанную заявку' });
        }

        const updatedWish = await Wish.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('user', 'fullName').populate('swapWithUser', 'fullName');

        emitWishUpdate(updatedWish!.coffeeShop.toString(), 'updated', updatedWish);

        res.json({ success: true, data: { wish: updatedWish } });

    } catch (error) {
        res.status(400).json({ success: false, message: 'Ошибка обновления' });
    }
};

// DELETE /api/wishes/:id
export const deleteWish = async (req: Request, res: Response) => {
     try {
        const { id } = req.params;
        const authUser = req.user!;
        
        const existingWish = await Wish.findById(id);
        if (!existingWish) return res.status(404).json({ success: false, message: 'Не найдено' });

        // Бариста может удалять свои, Менеджер может удалять любые в своей кофейне
        const isOwner = existingWish.user.toString() === authUser.userId;
        const isManager = authUser.role === 'manager' && compareObjectIds(existingWish.coffeeShop, authUser.coffeeShop);
        const isAdmin = authUser.role === 'admin';

        if (!isOwner && !isManager && !isAdmin) {
             return res.status(403).json({ success: false, message: 'Нет прав' });
        }
        
        await Wish.findByIdAndDelete(id);

        const io = getIo();
        io.to(`coffeeshop:${existingWish.coffeeShop.toString()}`).emit('wishes:deleted', { 
            id: id, 
            message: 'Заявка удалена.'
        });

        res.json({ success: true, message: 'Удалено' });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Ошибка удаления' });
    }
};