import Joi from 'joi';

export const createUserSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Некорректный формат email',
      'any.required': 'Email обязателен для заполнения'
    }),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Пароль должен содержать минимум 6 символов',
      'any.required': 'Пароль обязателен для заполнения'
    }),
  fullName: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'ФИО должно содержать минимум 2 символа',
      'string.max': 'ФИО должно содержать максимум 100 символов',
      'any.required': 'ФИО обязательно для заполнения'
    }),
  role: Joi.string()
    .valid('barista', 'manager', 'admin')
    .required()
    .messages({
      'any.only': 'Роль должна быть одной из: barista, manager, admin',
      'any.required': 'Роль обязательна для заполнения'
    }),
  coffeeShop: Joi.string()
    .hex()
    .length(24)
    .required()
    .messages({
      'string.hex': 'ID кофейни должен быть в hex формате',
      'string.length': 'ID кофейни должен содержать 24 символа',
      'any.required': 'Кофейня обязательна для заполнения'
    }),
  hourlyRate: Joi.number()
    .min(0)
    .required()
    .messages({
      'number.min': 'Почасовая ставка не может быть отрицательной',
      'any.required': 'Почасовая ставка обязательна для заполнения'
    })
});

export const updateUserSchema = Joi.object({
  email: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': 'Некорректный формат email'
    }),
  password: Joi.string()
    .min(6)
    .optional()
    .messages({
      'string.min': 'Пароль должен содержать минимум 6 символов'
    }),
  fullName: Joi.string()
    .min(2)
    .max(100)
    .optional()
    .messages({
      'string.min': 'ФИО должно содержать минимум 2 символа',
      'string.max': 'ФИО должно содержать максимум 100 символов'
    }),
  role: Joi.string()
    .valid('barista', 'manager', 'admin')
    .optional()
    .messages({
      'any.only': 'Роль должна быть одной из: barista, manager, admin'
    }),
  coffeeShop: Joi.string()
    .hex()
    .length(24)
    .optional()
    .messages({
      'string.hex': 'ID кофейни должен быть в hex формате',
      'string.length': 'ID кофейни должен содержать 24 символа'
    }),
  hourlyRate: Joi.number()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Почасовая ставка не может быть отрицательной'
    }),
  isActive: Joi.boolean()
    .optional()
});

export const userIdSchema = Joi.object({
  id: Joi.string()
    .hex()
    .length(24)
    .required()
    .messages({
      'string.hex': 'ID пользователя должен быть в hex формате',
      'string.length': 'ID пользователя должен содержать 24 символа',
      'any.required': 'ID пользователя обязателен'
    })
});

export const queryUsersSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.min': 'Номер страницы должен быть не менее 1'
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .messages({
      'number.min': 'Лимит должен быть не менее 1',
      'number.max': 'Лимит не может превышать 100'
    }),
  role: Joi.string()
    .valid('barista', 'manager', 'admin')
    .optional()
    .messages({
      'any.only': 'Роль должна быть одной из: barista, manager, admin'
    }),
  coffeeShop: Joi.string()
    .hex()
    .length(24)
    .optional()
    .messages({
      'string.hex': 'ID кофейни должен быть в hex формате',
      'string.length': 'ID кофейни должен содержать 24 символа'
    }),
  isActive: Joi.boolean()
    .optional(),
  search: Joi.string()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Поисковый запрос должен содержать минимум 1 символ',
      'string.max': 'Поисковый запрос должен содержать максимум 100 символов'
    })
});