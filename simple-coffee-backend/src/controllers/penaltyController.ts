import { Request, Response } from 'express';
import { Penalty, IPenalty } from '../models/Penalty';
import { User } from '../models/User';
import { AuthUserDocument } from '../types';
import { Types } from 'mongoose';

// GET /api/penalties — Получение списка штрафов
export const getPenalties = async (req: Request, res: Response) => {
    try {
        const authUser = req.user as AuthUserDocument;
        const { page = 1, limit = 10, userId, coffeeShopId, dateFrom, dateTo } = req.validatedQuery;

        const filter: any = {};
        
        // 1. Фильтр по кофейне
        if (authUser.role === 'manager' && authUser.coffeeShop) {
            // Менеджер видит штрафы только своей кофейни
            filter.coffeeShop = authUser.coffeeShop._id;
        } else if (coffeeShopId) {
            // Администратор может фильтровать по любой кофейне
            filter.coffeeShop = new Types.ObjectId(coffeeShopId);
        }

        // 2. Дополнительные фильтры
        if (userId) filter.user = new Types.ObjectId(userId);
        if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) filter.date.$gte = new Date(dateFrom);
            if (dateTo) {
                // Устанавливаем конец дня для dateTo
                const endOfDay = new Date(dateTo);
                endOfDay.setHours(23, 59, 59, 999);
                filter.date.$lte = endOfDay;
            }
        }
        
        const penalties = await Penalty.find(filter)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ date: -1 }) // Сортируем по дате инцидента
            .populate('user', 'firstName lastName') // Загружаем имя/фамилию бариста
            .populate('issuedBy', 'firstName lastName'); // Загружаем имя/фамилию менеджера/админа

        const count = await Penalty.countDocuments(filter);

        res.json({
            success: true,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalItems: count,
            data: penalties
        });

    } catch (error) {
        console.error('getPenalties error:', error);
        res.status(500).json({ success: false, message: 'Ошибка при получении списка штрафов' });
    }
};


// POST /api/penalties — Создание нового штрафа (Admin/Manager)
export const createPenalty = async (req: Request, res: Response) => {
    try {
        const authUser = req.user as AuthUserDocument;
        const { userId, coffeeShopId, amount, reason, date, notes } = req.validatedBody;

        // 1. Определяем целевую кофейню
        let targetCoffeeShopId: Types.ObjectId;

        if (authUser.role === 'manager' && authUser.coffeeShop) {
            // Менеджер штрафует только в своей кофейне
            targetCoffeeShopId = authUser.coffeeShop._id;
        } else if (authUser.role === 'admin' && coffeeShopId) {
            // Администратор должен указать кофейню
            targetCoffeeShopId = new Types.ObjectId(coffeeShopId);
        } else if (authUser.role === 'admin' && !coffeeShopId) {
             return res.status(400).json({ success: false, message: 'Администратору необходимо указать coffeeShopId' });
        } else {
            // Если менеджер, но без coffeeShop (не должно быть)
            return res.status(403).json({ success: false, message: 'Невозможно определить кофейню для наложения штрафа' });
        }

        // 2. Проверка, существует ли бариста и принадлежит ли он к этой кофейне
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'Бариста не найден' });
        }
        
        // Дополнительная проверка: менеджер не может штрафовать бариста не из своей кофейни
        if (authUser.role === 'manager' && targetUser.coffeeShop && targetUser.coffeeShop.toString() !== targetCoffeeShopId.toString()) {
             return res.status(403).json({ success: false, message: 'Менеджер может налагать штрафы только на сотрудников своей кофейни' });
        }


        // 3. Создание записи о штрафе
        const newPenalty = new Penalty({
            user: new Types.ObjectId(userId),
            coffeeShop: targetCoffeeShopId,
            amount,
            reason,
            date: new Date(date),
            issuedBy: new Types.ObjectId(authUser.userId),
            notes
        });

        await newPenalty.save();
        
        // 4. Загружаем информацию для ответа
        await newPenalty.populate('user', 'firstName lastName');
        await newPenalty.populate('issuedBy', 'firstName lastName');

        res.status(201).json({
            success: true,
            message: 'Штраф успешно наложен',
            data: newPenalty
        });

    } catch (error) {
        console.error('createPenalty error:', error);
        res.status(400).json({ 
            success: false, 
            message: (error instanceof Error) ? error.message : 'Ошибка при создании штрафа' 
        });
    }
};

// DELETE /api/penalties/:id — Удаление штрафа (Admin/Manager)
export const deletePenalty = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const authUser = req.user as AuthUserDocument;

        // 1. Находим существующий штраф
        const existingPenalty = await Penalty.findById(id);

        if (!existingPenalty) {
            return res.status(404).json({ success: false, message: 'Штраф не найден' });
        }

        // 2. Проверка прав: Менеджер может удалить штраф, только если он наложен в его кофейне
        if (authUser.role === 'manager' && authUser.coffeeShop && existingPenalty.coffeeShop.toString() !== authUser.coffeeShop._id.toString()) {
            return res.status(403).json({ success: false, message: 'Недостаточно прав для удаления штрафа, не относящегося к вашей кофейне' });
        }

        // 3. Удаление
        await Penalty.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Штраф успешно удален'
        });

    } catch (error) {
        console.error('deletePenalty error:', error);
        res.status(500).json({ success: false, message: 'Ошибка при удалении штрафа' });
    }
};