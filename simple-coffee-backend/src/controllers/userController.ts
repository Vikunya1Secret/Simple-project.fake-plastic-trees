import { Request, Response } from 'express';
import { User } from '../models/User';
import { CoffeeShop } from '../models/CoffeeShop';
import { JwtPayload, AuthUserDocument } from '../types';

interface AuthRequest extends Request {
  // Поля, добавленные middleware аутентификации
  user?: JwtPayload | AuthUserDocument;
  
  // Поля, добавленные middleware валидации (Joi/Celebrate)
  validatedBody?: any;
  validatedQuery?: any;
  validatedParams?: any;
}

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      coffeeShop,
      isActive,
      search
    } = req.validatedQuery;

    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    // Построение фильтра
    const filter: any = {};

    if (role) filter.role = role;
    if (coffeeShop) filter.coffeeShop = coffeeShop;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Получение пользователей с пагинацией
    const users = await User.find(filter)
      .select('-password')
      .populate('coffeeShop' , 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber);

    // Получение общего количества для пагинации
    const total = await User.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNumber);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages,
          hasNext: pageNumber < totalPages,
          hasPrev: pageNumber > 1
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении списка пользователей'
    });
  }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select('-password')
      .populate('coffeeShop');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    res.json({
      success: true,
      data: {
        user
      }
    });

  } catch (error) {
    console.error('Get user by id error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении пользователя'
    });
  }
};

export const createUser = async (req: Request, res: Response) => {
  
  try {

    const { email, password, fullName, role, coffeeShop, hourlyRate } = req.body;

    // Проверка существования пользователя с таким email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Пользователь с таким email уже существует'
      });
    }

    // Проверка существования кофейни
    const coffeeShopExists = await CoffeeShop.findById(coffeeShop);
    if (!coffeeShopExists) {
      return res.status(404).json({
        success: false,
        message: 'Кофейня не найдена'
      });
    }

    // Создание пользователя
    const user = new User({
      email,
      password,
      fullName,
      role,
      coffeeShop: coffeeShop || null,
      hourlyRate
    });

    await user.save();

    // Если пользователь - управляющий, обновляем кофейню
    if (role === 'manager' && coffeeShop) {
      await CoffeeShop.findByIdAndUpdate(coffeeShop, {
        $addToSet: { managers: user._id } // $addToSet предотвращает дублирование ID
      });
    }

    // Получаем созданного пользователя без пароля
    const createdUser = await User.findById(user._id)
      .select('-password')
      .populate('coffeeShop');

    res.status(201).json({
      success: true,
      message: 'Пользователь успешно создан',
      data: {
        user: createdUser
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании пользователя'
    });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {

    const { id } = req.params;
    const updateData = { ...req.body };

    // Если передается пароль, он автоматически хэшируется в pre-save хуке
    // Если не передается пароль, удаляем его из updateData чтобы не перезаписать
    if (!updateData.password) {
      delete updateData.password;
    }

    // Поиск пользователя
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    // Проверка email на уникальность (исключая текущего пользователя)
    if (updateData.email && updateData.email !== existingUser.email) {
      const userWithEmail = await User.findOne({ 
        email: updateData.email,
        _id: { $ne: id }
      });
      
      if (userWithEmail) {
        return res.status(409).json({
          success: false,
          message: 'Пользователь с таким email уже существует'
        });
      }
    }

    // Проверка кофейни на существование
    if (updateData.coffeeShop) {
       const shopExists = await CoffeeShop.findById(updateData.coffeeShop);
       if (!shopExists) {
         return res.status(404).json({ success: false, message: 'Кофейня не найдена' });
       }
    }

    // Обновление пользователя
    if (updateData.email) existingUser.email = updateData.email;
    if (updateData.fullName) existingUser.fullName = updateData.fullName;
    
    // Если меняется роль или кофейня, может понадобиться обновить кофейню (см. ниже)
    const oldRole = existingUser.role;
    const oldCoffeeShopId = existingUser.coffeeShop ? existingUser.coffeeShop.toString() : null;
    
    if (updateData.role) existingUser.role = updateData.role;
    if (updateData.coffeeShop) existingUser.coffeeShop = updateData.coffeeShop;
    if (updateData.coffeeShop !== undefined) existingUser.coffeeShop = updateData.coffeeShop;
    if (updateData.hourlyRate !== undefined) existingUser.hourlyRate = updateData.hourlyRate;
    
    if (updateData.password) {
      existingUser.password = updateData.password;
    }

    await existingUser.save();

    const newRole = existingUser.role;
    const newCoffeeShopId = existingUser.coffeeShop ? existingUser.coffeeShop.toString() : null;

    if (oldRole === 'manager' && oldCoffeeShopId) {
        const hasLeftShop = oldCoffeeShopId !== newCoffeeShopId; // Сменил ID кофейни
        const isNoLongerManager = newRole !== 'manager';         // Сменил роль
        
        if (hasLeftShop || isNoLongerManager) {
            await CoffeeShop.findByIdAndUpdate(oldCoffeeShopId, {
                $pull: { managers: existingUser._id }
            });
        }
    }

    if (newRole === 'manager' && newCoffeeShopId) {
        const isNewShop = oldCoffeeShopId !== newCoffeeShopId;
        const becameManager = oldRole !== 'manager';

        if (isNewShop || becameManager) {
            await CoffeeShop.findByIdAndUpdate(newCoffeeShopId, {
                $addToSet: { managers: existingUser._id }
            });
        }
    }

    const updatedUser = await User.findById(existingUser._id)
      .select('-password')
      .populate('coffeeShop');

    res.json({
      success: true,
      message: 'Пользователь успешно обновлен',
      data: {
        user: updatedUser
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении пользователя'
    });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Проверка
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    if (req.user && req.user.userId === id) {
      return res.status(400).json({ success: false, message: 'Нельзя удалить собственный аккаунт' });
    }

    // 1. Если пользователь был менеджером, убираем его из кофейни
    if (user.role === 'manager' && user.coffeeShop) {
      await CoffeeShop.findByIdAndUpdate(user.coffeeShop, {
        $pull: { managers: id }
      });
    }

    // 2. Полное удаление (Hard Delete)
    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Пользователь полностью удален',
      data: { id }
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Ошибка при удалении пользователя' });
  }
};

// Оставляем activateUser для совместимости роутера, но он может быть не нужен при полном удалении.
// Либо можно использовать его для разблокировки, если вы оставите поле isActive.
export const activateUser = async (req: Request, res: Response) => {
    // Реализация старая, либо просто заглушка, если активация не нужна
    try {
        const { id } = req.params;
        const user = await User.findByIdAndUpdate(id, { isActive: true }, { new: true });
        res.json({ success: true, data: { user } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error' });
    }
};

// // DELETE /api/users/:id (Деактивация)
// export const deleteUser = async (req: AuthRequest, res: Response) => {
//   try {
//     const { id } = req.params;

//     // Проверка существования пользователя
//     const user = await User.findById(id);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'Пользователь не найден'
//       });
//     }

//     // Нельзя удалить самого себя
//     if (req.user && req.user.userId === id) {
//       return res.status(400).json({
//         success: false,
//         message: 'Нельзя удалить собственный аккаунт'
//       });
//     }

//     // Мягкое удаление (деактивация)
//     const deletedUser = await User.findByIdAndUpdate(
//       id,
//       { isActive: false },
//       { 
//         new: true
//       }
//     ).select('-password').populate('coffeeShop');

//     // Если пользователь был управляющим, удаляем его из кофейни
//     if (user.role === 'manager') {
//       await CoffeeShop.updateOne(
//         { _id: user.coffeeShop, manager: id },
//         { $unset: { manager: 1 } }
//       );
//     }

//     res.json({
//       success: true,
//       message: 'Пользователь успешно деактивирован',
//       data: {
//         user: deletedUser
//       }
//     });

//   } catch (error) {
//     console.error('Delete user error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Ошибка при деактивации пользователя'
//     });
//   }
// };

// export const activateUser = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;

//     const user = await User.findByIdAndUpdate(
//       id,
//       { isActive: true },
//       { new: true }
//     ).select('-password').populate('coffeeShop');

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'Пользователь не найден'
//       });
//     }

//     res.json({
//       success: true,
//       message: 'Пользователь успешно активирован',
//       data: {
//         user
//       }
//     });

//   } catch (error) {
//     console.error('Activate user error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Ошибка при активации пользователя'
//     });
//   }
// };