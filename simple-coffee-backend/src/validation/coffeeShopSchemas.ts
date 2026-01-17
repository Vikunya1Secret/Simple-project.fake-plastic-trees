import Joi from 'joi';

// Регулярное выражение для формата времени HH:MM (00:00 - 23:59)
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

// Схема для ID кофейни
export const coffeeShopIdSchema = Joi.object({
    id: Joi.string()
        .hex()
        .length(24)
        .required()
        .messages({
            'string.hex': 'ID кофейни должен быть в hex формате',
            'string.length': 'ID кофейни должен содержать 24 символа',
            'any.required': 'ID кофейни обязателен'
    })
});

// Схема для создания кофейни
export const createCoffeeShopSchema = Joi.object({
    name: Joi.string().required().max(100).messages({
        'any.required': 'Название обязательно',
        'string.max': 'Название не должно превышать 100 символов'
    }),
    address: Joi.string().required().max(255).messages({
        'any.required': 'Адрес обязателен'
    }),
    phone: Joi.string().required().max(20).messages({
        'any.required': 'Телефон обязателен'
    }),
    manager: Joi.string()
        .hex()
        .length(24)
        .optional()
        .messages({
            'string.hex': 'ID менеджера должен быть в hex формате',
			'string.length': 'ID менеджера должен содержать 24 символа'
        }),
    openTime: Joi.string().regex(timeRegex).default('08:00').messages({
        'string.pattern.base': 'Время открытия должно быть в формате HH:MM'
    }),
    closeTime: Joi.string().regex(timeRegex).default('22:00').messages({
        'string.pattern.base': 'Время закрытия должно быть в формате HH:MM'
    }),
    timezone: Joi.string().default('Europe/Moscow'),
    maxBaristasPerShift: Joi.number().integer().min(1).default(2).required().messages({
        'any.required': 'Максимальное количество бариста обязательно',
        'number.min': 'Минимум 1 бариста в смене'
    }),
});

// Схема для обновления кофейни
export const updateCoffeeShopSchema = Joi.object({
    name: Joi.string().optional().max(100),
    address: Joi.string().optional().max(255),
    phone: Joi.string().optional().max(20),
    manager: Joi.string()
        .hex()
        .length(24)
        .optional(),
    openTime: Joi.string().regex(timeRegex).optional().messages({
        'string.pattern.base': 'Время открытия должно быть в формате HH:MM'
    }),
    closeTime: Joi.string().regex(timeRegex).optional().messages({
        'string.pattern.base': 'Время закрытия должно быть в формате HH:MM'
    }),
    timezone: Joi.string().optional(),
    maxBaristasPerShift: Joi.number().integer().min(1).optional().messages({
        'number.min': 'Минимум 1 бариста в смене'
    }),
    isActive: Joi.boolean().optional()
});

// Схема для пагинации и фильтрации кофеен
export const queryCoffeeShopsSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    isActive: Joi.boolean().optional(),
    search: Joi.string().optional().max(100)
});

// Схема для активации (требуется только manager ID)
export const activateCoffeeShopSchema = Joi.object({
	manager: Joi.string()
		.hex()
		.length(24)
		.required()
		.messages({
			'any.required': 'ID менеджера обязателен для активации кофейни',
			'string.hex': 'ID менеджера должен быть в hex формате',
			'string.length': 'ID менеджера должен содержать 24 символа'
		})
});