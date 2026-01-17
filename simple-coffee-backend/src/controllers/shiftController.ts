import { Request, Response } from 'express';
import { Shift, IShift } from '../models/Shift';
import { User } from '../models/User';
import { AuthUserDocument } from '../types';
import { Types } from 'mongoose';
import { getIo, emitShiftUpdate } from '../utils/socketEmitter';

export const compareObjectIds = (a: any, b: any): boolean => {
    if (!a || !b) return false;

    // Функция для извлечения строкового ID из чего угодно
    const extractId = (val: any): string => {
        if (val instanceof Types.ObjectId) return val.toHexString();
        if (typeof val === 'string') return val;
        if (typeof val === 'object') {
            return val._id?.toString() || val.id?.toString() || '';
        }
        return String(val);
    };

    const idA = extractId(a);
    const idB = extractId(b);

    return idA !== '' && idB !== '' && idA === idB;
};

// Вспомогательная функция для расчета durationHours
const calculateDurationHours = (startTime: string, endTime: string): number => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    let startMinutes = (startH * 60) + startM;
    let endMinutes = (endH * 60) + endM;

    if (endMinutes < startMinutes) {
        endMinutes += 24 * 60; // Смены через полночь
    }
    
    const durationInMinutes = endMinutes - startMinutes;
    return parseFloat((durationInMinutes / 60).toFixed(2));
};

// GET /api/shifts (Фильтрация и пагинация)
export const getShifts = async (req: Request, res: Response) => {
    try {
        const {
            page = 1,
            limit = 50, // Увеличил лимит по умолчанию для отображения недели
            coffeeShop: filterCoffeeShop,
            user: filterUser,
            dateFrom,
            dateTo,
            type
        } = req.validatedQuery;
        
        const pageNumber = parseInt(page as string);
        const limitNumber = parseInt(limit as string);
        const skip = (pageNumber - 1) * limitNumber;

        const filter: any = {};
        const authUser = req.user!;

        // 1. Логика доступа к кофейне
        if (authUser.role === 'barista' || authUser.role === 'manager') {
            // Бариста и Менеджер видят смены ТОЛЬКО своей кофейни
            filter.coffeeShop = authUser.coffeeShop;
        } else if (authUser.role === 'admin' && filterCoffeeShop) {
            // Админ может фильтровать по кофейне
            filter.coffeeShop = filterCoffeeShop;
        }

        // 2. Фильтрация по конкретному юзеру (опционально)
        // Бариста может запросить только свои смены (для "My Schedule") или не указывать (для "Full Schedule")
        if (filterUser) {
            filter.user = filterUser;
        }

        if (type) {
            filter.type = type;
        }
        
        // 3. Фильтрация по дате
        if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) {
                const startOfDay = new Date(dateFrom);
                startOfDay.setHours(0, 0, 0, 0);
                filter.date.$gte = startOfDay;
            }
            if (dateTo) {
                const endOfDay = new Date(dateTo);
                endOfDay.setHours(23, 59, 59, 999);
                filter.date.$lte = endOfDay;
            }
        }

        const shifts = await Shift.find(filter)
            .populate('user', 'fullName email role hourlyRate')
            .populate('coffeeShop', 'name')
            .sort({ date: 1, startTime: 1 })
            .skip(skip)
            .limit(limitNumber);

        const total = await Shift.countDocuments(filter);
        const totalPages = Math.ceil(total / limitNumber);

        res.json({
            success: true,
            data: {
                shifts,
                pagination: { page: pageNumber, limit: limitNumber, total, totalPages }
            }
        });

    } catch (error) {
        console.error('Get shifts error:', error);
        res.status(500).json({ success: false, message: 'Ошибка при получении списка смен' });
    }
};

// GET /api/shifts/:id
export const getShiftById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const shift = await Shift.findById(id)
            .populate('user', 'fullName email role hourlyRate')
            .populate('coffeeShop', 'name');

        if (!shift) {
            return res.status(404).json({ success: false, message: 'Смена не найдена' });
        }
        
        // Проверка прав: Пользователь должен быть из той же кофейни
        if (req.user?.role !== 'admin') {
            if (!compareObjectIds(shift.coffeeShop, req.user!.coffeeShop)) {
                return res.status(403).json({ success: false, message: 'Недостаточно прав для просмотра этой смены' });
            }
        }

        res.json({ success: true, data: { shift } });
    } catch (error) {
        console.error('Get shift by id error:', error);
        res.status(500).json({ success: false, message: 'Ошибка при получении смены' });
    }
};

// POST /api/shifts
export const createShift = async (req: Request, res: Response) => {
    try {
        const shiftData = req.validatedBody;
        const authUser = req.user!;
        
        // 1. Проверка прав (Менеджер/Админ)
        if (authUser.role === 'manager' && !compareObjectIds(authUser.coffeeShop, shiftData.coffeeShop)) {
            throw new Error('Менеджер может создавать смены только для своей кофейни.');
        }

        // 2. Получение юзера
        const user = await User.findById(shiftData.user);
        if (!user || !user.isActive) {
            throw new Error('Указанный сотрудник не найден или не активен.');
        }

        // 3. Проверка дублей того же типа на ту же дату
        const existingShift = await Shift.findOne({
            user: shiftData.user,
            date: shiftData.date,
            type: shiftData.type,
        });

        if (existingShift) {
             throw new Error(`У этого сотрудника уже есть запись типа "${shiftData.type}" на эту дату.`);
        }

        // 4. Подготовка данных
        shiftData.hourlyRate = user.hourlyRate;
        shiftData.createdBy = authUser.userId;
        
        // Расчет часов только для рабочих смен
        if (shiftData.type === 'work' && shiftData.startTime && shiftData.endTime) {
            shiftData.durationHours = calculateDurationHours(shiftData.startTime, shiftData.endTime);
        } else {
            shiftData.durationHours = 0;
            // Для больничных и отпусков время не обязательно, но можно хранить нули
        }

        // 5. Создание
        const newShift = new Shift(shiftData);
        await newShift.save();

        const createdShift = await Shift.findById(newShift._id)
            .populate('user', 'fullName email role hourlyRate')
            .populate('coffeeShop', 'name');

        // 6. Сокеты (Отправляем всем в кофейне, т.к. расписание общее)
        emitShiftUpdate(
            createdShift!.coffeeShop.toString(), 
            createdShift!.user.id.toString(), 
            'created', 
            createdShift
        );
        
        res.status(201).json({
            success: true,
            message: 'Смена успешно создана',
            data: { shift: createdShift }
        });

    } catch (error) {    
        console.error('Create shift error:', error);
        res.status(400).json({
            success: false,
            message: (error instanceof Error) ? error.message : 'Ошибка при создании смены'
        });
    }
};

// PUT /api/shifts/:id
export const updateShift = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updateData = req.validatedBody;
        const authUser = req.user!;
        
        const existingShift = await Shift.findById(id);
        if (!existingShift) throw new Error('Смена не найдена');

        if (authUser.role === 'manager' && (!compareObjectIds(existingShift.coffeeShop, authUser.coffeeShop))) {
            throw new Error('Недостаточно прав для изменения этой смены');
        }
        
        // Логика пересчета времени
        let durationHours = existingShift.durationHours;
        const newType = updateData.type || existingShift.type;
        const newStartTime = updateData.startTime || existingShift.startTime;
        const newEndTime = updateData.endTime || existingShift.endTime;
        
        if (newType === 'work') {
            if (!newStartTime || !newEndTime) {
                throw new Error('Для рабочей смены необходимо указать время');
            }
            durationHours = calculateDurationHours(newStartTime, newEndTime);
        } else {
            durationHours = 0;
        }

        const updatedShift = await Shift.findByIdAndUpdate(
            id,
            { 
                ...updateData,
                durationHours,
                startTime: newType === 'work' ? newStartTime : undefined,
                endTime: newType === 'work' ? newEndTime : undefined
            },
            { new: true, runValidators: true }
        );

        const finalShift = await Shift.findById(updatedShift!._id)
            .populate('user', 'fullName email role hourlyRate')
            .populate('coffeeShop', 'name');

        emitShiftUpdate(
            finalShift!.coffeeShop.toString(), 
            finalShift!.user.id.toString(), 
            'updated', 
            finalShift
        );

        res.json({
            success: true,
            message: 'Смена успешно обновлена',
            data: { shift: finalShift }
        });

    } catch (error) {  
        console.error('Update shift error:', error);
        res.status(400).json({
            success: false,
            message: (error instanceof Error) ? error.message : 'Ошибка при обновлении смены'
        });
    }
};

// DELETE /api/shifts/:id
export const deleteShift = async (req: Request, res: Response) => {
     try {
        const { id } = req.params;
        const authUser = req.user!;
        
        const existingShift = await Shift.findById(id);
        if (!existingShift) return res.status(404).json({ success: false, message: 'Смена не найдена' });

        if (authUser.role === 'manager' && (!compareObjectIds(existingShift.coffeeShop, authUser.coffeeShop))) {
            return res.status(403).json({ success: false, message: 'Недостаточно прав' });
        }

        await Shift.findByIdAndDelete(id);

        const io = getIo();
        const coffeeShopId = existingShift!.coffeeShop.toString();

        io.to(`coffeeshop:${coffeeShopId}`).emit('shifts:deleted', { 
            id: id, 
            user: existingShift.user, // Чтобы клиент знал, чья смена удалена
            message: 'Смена была удалена.'
        });

        res.json({ success: true, message: 'Смена успешно удалена' });

    } catch (error) {
        console.error('Delete shift error:', error);
        res.status(500).json({ success: false, message: 'Ошибка при удалении смены' });
    }
};