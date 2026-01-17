import Joi from 'joi';

// Регулярное выражение для формата времени HH:MM (00:00 - 23:59)
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

// --- Схемы для Смен (Shift) ---

// Базовая схема для ID Mongoose
const objectIdSchema = Joi.string()
    .hex()
    .length(24)
    .messages({
        'string.hex': 'ID должен быть в hex формате',
        'string.length': 'ID должен содержать 24 символа'
    });

// Схема для создания смены
export const createShiftSchema = Joi.object({
    // Обязательные поля
    user: objectIdSchema.required().messages({
        'any.required': 'ID бариста обязателен'
    }),
    coffeeShop: objectIdSchema.required().messages({
        'any.required': 'ID кофейни обязателен'
    }),
    date: Joi.date().iso().required().messages({
        'date.base': 'Дата должна быть в формате ISO 8601',
        'any.required': 'Дата обязательна'
    }),
    
    type: Joi.string()
        .valid('work', 'sick_leave', 'vacation', 'day_off')
        .default('work')
        .required()
        .messages({
            'any.only': 'Тип смены должен быть: work, sick_leave, day_off или vacation'
        }),
    
    // Условная валидация: startTime и endTime требуются, только если type == 'work'
    startTime: Joi.string()
        .when('type', {
            is: 'work',
            then: Joi.string().regex(timeRegex).required().messages({
                'any.required': 'Время начала обязательно для рабочих смен',
                'string.pattern.base': 'Время начала должно быть в формате HH:MM'
            }),
            otherwise: Joi.string().optional().allow(null, '') // Разрешаем пустое, если это не 'work'
        }),
    
    endTime: Joi.string()
        .when('type', {
            is: 'work',
            then: Joi.string().regex(timeRegex).required().messages({
                'any.required': 'Время окончания обязательно для рабочих смен',
                'string.pattern.base': 'Время окончания должно быть в формате HH:MM'
            }),
            otherwise: Joi.string().optional().allow(null, '')
        }),

    // Поля, которые обычно устанавливаются системой, но могут быть полезны при создании для тестирования/админа
    hourlyRate: Joi.number().min(0).optional(),
    isPublished: Joi.boolean().optional(),
    
    // createdBy не требуется, так как будет извлечен из req.user
}).min(4).messages({ 'object.min': 'Необходимо указать минимум 4 поля' });


// Схема для обновления смены
export const updateShiftSchema = Joi.object({
    user: objectIdSchema.optional(),
    coffeeShop: objectIdSchema.optional(),
    date: Joi.date().iso().optional().messages({
        'date.base': 'Дата должна быть в формате ISO 8601'
    }),
    
    type: Joi.string()
        .valid('work', 'sick_leave', 'vacation', 'day_off')
        .optional()
        .messages({
            'any.only': 'Тип смены должен быть: work, sick_leave, day_off или vacation'
        }),

    // При обновлении, валидация должна быть гибкой, но логичной
    startTime: Joi.string().regex(timeRegex).optional().allow(null, ''),
    endTime: Joi.string().regex(timeRegex).optional().allow(null, ''),
    
    isPublished: Joi.boolean().optional(),
    hourlyRate: Joi.number().min(0).optional(),
    // createdBy нельзя обновлять
}).min(1).messages({ 'object.min': 'Необходимо указать хотя бы одно поле для обновления' });


// Схема для пагинации и фильтрации смен
export const queryShiftsSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    coffeeShop: objectIdSchema.optional(),
    user: objectIdSchema.optional(),
    dateFrom: Joi.date().iso().optional(),
    dateTo: Joi.date().iso().optional(),
    type: Joi.string().valid('work', 'sick_leave', 'vacation').optional(),
    isPublished: Joi.boolean().optional()
});

// --- Схемы для Пожеланий (Wish) ---

// Схема для создания пожелания
export const createWishSchema = Joi.object({
    // user и coffeeShop будут браться из req.user для баристы
    date: Joi.date().iso().required().messages({
        'date.base': 'Дата должна быть в формате ISO 8601',
        'any.required': 'Дата обязательна'
    }),
    startTime: Joi.string().regex(timeRegex).required().messages({
        'any.required': 'Время начала обязательно',
        'string.pattern.base': 'Время начала должно быть в формате HH:MM'
    }),
    endTime: Joi.string().regex(timeRegex).required().messages({
        'any.required': 'Время окончания обязательно',
        'string.pattern.base': 'Время окончания должно быть в формате HH:MM'
    }),
    type: Joi.string()
        .valid('work' , 'sick_leave' , 'vacation' , 'day_off' , 'swap')
        .required()
        .messages({
            'any.only': 'Тип пожелания должен быть: work, sick_leave, vacation, day_off или swap',
            'any.required': 'Тип пожелания обязателен'
        }),
    isRecurring: Joi.boolean().optional().default(false)
});

// Схема для обновления пожелания
export const updateWishSchema = Joi.object({
    date: Joi.date().iso().optional(),
    startTime: Joi.string().regex(timeRegex).optional(),
    endTime: Joi.string().regex(timeRegex).optional(),
    type: Joi.string().valid('available', 'unavailable').optional(),
    isRecurring: Joi.boolean().optional()
}).min(1).messages({ 'object.min': 'Необходимо указать хотя бы одно поле для обновления' });

// Схема для пагинации и фильтрации пожеланий
export const queryWishesSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    coffeeShop: objectIdSchema.optional(),
    user: objectIdSchema.optional(),
    dateFrom: Joi.date().iso().optional(),
    dateTo: Joi.date().iso().optional(),
    type: Joi.string().valid('available', 'unavailable').optional()
});