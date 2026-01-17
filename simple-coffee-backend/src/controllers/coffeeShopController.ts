import { Request, Response } from 'express';
import { CoffeeShop, ICoffeeShop } from '../models/CoffeeShop';
import { User, IUser } from '../models/User';
import mongoose, { Types } from 'mongoose';
import { JwtPayload, AuthUserDocument } from '../types'; 

// Расширяем стандартный тип Request
interface AuthRequest extends Request {
  user?: JwtPayload | AuthUserDocument;
  validatedQuery?: any;
  validatedBody?: any;
  validatedParams?: any;
}

// GET /api/coffee-shops
export const getCoffeeShops = async (req: AuthRequest, res: Response) => {
	// Транзакции не нужны: только операции чтения
	try {
		const {
			page = 1,
			limit = 10,
			isActive,
			search
		} = req.validatedQuery;

		const pageNumber = parseInt(page as string);
		const limitNumber = parseInt(limit as string);
		const skip = (pageNumber - 1) * limitNumber;

		const filter: any = {};

		if (isActive !== undefined) {
			filter.isActive = isActive === 'true';
		}

		if (search) {
			filter.$or = [
				{ name: { $regex: search, $options: 'i' } },
				{ address: { $regex: search, $options: 'i' } }
			];
		}

		const coffeeShops = await CoffeeShop.find(filter)
			.populate('managers', 'fullName email') // Показываем только ФИО и email менеджера
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limitNumber);

		const total = await CoffeeShop.countDocuments(filter);
		const totalPages = Math.ceil(total / limitNumber);

		res.json({
			success: true,
			data: {
				coffeeShops,
				pagination: { page: pageNumber, limit: limitNumber, total, totalPages }
			}
		});

	} catch (error) {
		console.error('Get coffee shops error:', error);
		res.status(500).json({ success: false, message: 'Ошибка при получении списка кофеен' });
	}
};

// GET /api/coffee-shops/:id
export const getCoffeeShopById = async (req: AuthRequest, res: Response) => {
	// Транзакции не нужны: только операции чтения
	try {
		const { id } = req.params;

		const coffeeShop = await CoffeeShop.findById(id).populate('manager', 'fullName email');

		if (!coffeeShop) {
			return res.status(404).json({ success: false, message: 'Кофейня не найдена' });
		}

		res.json({ success: true, data: { coffeeShop } });
	} catch (error) {
		console.error('Get coffee shop by id error:', error);
		res.status(500).json({ success: false, message: 'Ошибка при получении кофейни' });
	}
};

// POST /api/coffee-shops
export const createCoffeeShop = async (req: AuthRequest, res: Response) => {
	try {
		const shopData = req.body;

		delete shopData.manager;
		delete shopData.managers;

		const newCoffeeShop = new CoffeeShop(shopData);
		await newCoffeeShop.save();

		res.status(201).json({
			success: true,
			message: 'Кофейня успешно создана',
			data: { coffeeShop: newCoffeeShop }
		});

	} catch (error) {
		console.error('Create coffee shop error:', error);
		res.status(400).json({ 
			success: false, 
			message: (error instanceof Error) ? error.message : 'Ошибка при создании кофейни' 
		});
	}
};

// PUT /api/coffee-shops/:id
export const updateCoffeeShop = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;
		const updateData = req.body;

		// Запрещаем обновлять менеджеров через этот контроллер
		delete updateData.manager;
		delete updateData.managers;

		const updatedShop = await CoffeeShop.findByIdAndUpdate(
			id,
			updateData,
			{ new: true, runValidators: true }
		).populate('managers', 'fullName email');

		if (!updatedShop) {
			return res.status(404).json({ success: false, message: 'Кофейня не найдена' });
		}

		res.json({
			success: true,
			message: 'Кофейня успешно обновлена',
			data: { coffeeShop: updatedShop }
		});

	} catch (error) {
		console.error('Update coffee shop error:', error);
		res.status(400).json({ 
			success: false, 
			message: (error instanceof Error) ? error.message : 'Ошибка при обновлении кофейни' 
		});
	}
};

export const deleteCoffeeShop = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;

		// 1. Полное удаление кофейни из БД
		const deletedShop = await CoffeeShop.findByIdAndDelete(id);

		if (!deletedShop) {
			return res.status(404).json({ success: false, message: 'Кофейня не найдена' });
		}

		// 2. Отвязываем пользователей от удаленной кофейни
        // Мы не удаляем пользователей, а просто обнуляем у них поле coffeeShop
		await User.updateMany(
			{ coffeeShop: id },
			{ coffeeShop: null }
		);

		res.json({
			success: true,
			message: 'Кофейня полностью удалена, сотрудники отвязаны',
			data: { id }
		});

	} catch (error) {
		console.error('Delete coffee shop error:', error);
		res.status(500).json({ 
			success: false, 
			message: 'Ошибка при удалении кофейни' 
		});
	}
};

// // DELETE /api/coffee-shops/:id (Архивирование)
// export const deleteCoffeeShop = async (req: AuthRequest, res: Response) => {
// 	try {
// 		const { id } = req.params;

// 		// 1. Архивация кофейни
// 		const deletedShop = await CoffeeShop.findByIdAndUpdate(
// 			id,
// 			{ isActive: false },
// 			{ new: true }
// 		);

// 		if (!deletedShop) {
// 			throw new Error('Кофейня не найдена');
// 		}

// 		// 2. Деактивация всех пользователей, привязанных к этой кофейне (мягкое удаление)
// 		// Сброс роли менеджера и привязки у всех пользователей
// 		await User.updateMany(
// 			{ coffeeShop: id },
// 			{ isActive: false, role: 'barista', coffeeShop: null }
// 		);

// 		// 3. Очистка ссылки на менеджера в самой кофейне
// 		const finalDeletedShop = await CoffeeShop.findByIdAndUpdate(
// 			id,
// 			{ manager: null },
// 			{ new: true }
// 		);
		

// 		// 4. ИСПРАВЛЕНИЕ: Финальное чтение *ВНУТРИ* транзакции
// 		const finalShop = await CoffeeShop.findById(finalDeletedShop?._id)
// 			.populate('manager', 'fullName email');

// 		res.json({
// 			success: true,
// 			message: 'Кофейня успешно архивирована (деактивирована)',
// 			data: { coffeeShop: finalShop }
// 		});

// 	} catch (error) {
// 		console.error('Delete coffee shop error:', error);
// 		// Улучшенная обработка ошибок
// 		res.status(400).json({ 
// 			success: false, 
// 			message: (error instanceof Error) ? error.message : 'Ошибка при архивации кофейни' 
// 		});
// 	}
// };

// // POST /api/coffee-shops/:id/activate
// export const activateCoffeeShop = async (req: AuthRequest, res: Response) => {
// 	try {

// 		const { id } = req.params;
// 		const { manager: newManagerId } = req.body;

// 		if (!newManagerId) {
// 			throw new Error('Для активации кофейни необходимо назначить менеджера.');
// 		}

// 		// 1. Проверяем, существует ли новый менеджер
// 		const managerUser = await User.findById(newManagerId);
// 		if (!managerUser) {
// 			throw new Error('Указанный менеджер не найден');
// 		}

// 		// 2. Проверяем, не управляет ли уже этот пользователь другой активной кофейней
// 		const existingShopWithManager = await CoffeeShop.findOne({ manager: newManagerId, isActive: true, _id: { $ne: id } });
// 		if (existingShopWithManager) {
// 			throw new Error('Новый менеджер уже управляет активной кофейней: ' + existingShopWithManager.name);
// 		}


// 		// 3. Активация кофейни и назначение менеджера
// 		const activatedShop = await CoffeeShop.findByIdAndUpdate(
// 			id,
// 			{ 
// 				isActive: true, 
// 				manager: new Types.ObjectId(newManagerId) 
// 			},
// 			{ new: true, runValidators: true }
// 		);

// 		if (!activatedShop) {
// 			throw new Error('Кофейня не найдена');
// 		}

// 		// 4. Сброс роли у ПРЕДЫДУЩЕГО менеджера этой кофейни
// 		if (activatedShop.manager && activatedShop.manager.toString() !== newManagerId) {
// 			await User.updateOne(
// 				{ _id: activatedShop.manager },
// 				{ role: 'barista', coffeeShop: null }
// 			);
// 		}
		
// 		// 5. Назначаем нового менеджера
// 		if (managerUser.role !== 'admin') {
// 			managerUser.role = 'manager';
// 		}
// 		managerUser.coffeeShop = activatedShop._id as any;
// 		managerUser.isActive = true; // Активируем менеджера
// 		await managerUser.save();
		
// 		// 6. Опционально: Активируем всех бариста, привязанных к этой кофейне
// 		await User.updateMany(
// 			{ coffeeShop: id, isActive: false },
// 			{ isActive: true }
// 		);

// 		// 7. ИСПРАВЛЕНИЕ: Финальное чтение *ВНУТРИ* транзакции
// 		const finalShop = await CoffeeShop.findById(activatedShop._id)
// 			.populate('manager', 'fullName email');

// 		res.json({
// 			success: true,
// 			message: `Кофейня ${finalShop?.name} успешно активирована и назначен менеджер ${managerUser.fullName}`,
// 			data: { coffeeShop: finalShop }
// 		});

// 	} catch (error) {
// 		console.error('Activate coffee shop error:', error);
// 		res.status(400).json({ 
// 			success: false, 
// 			message: (error instanceof Error) ? error.message : 'Ошибка при активации кофейни' 
// 		});
// 	}
// };