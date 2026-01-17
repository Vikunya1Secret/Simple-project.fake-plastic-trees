import Joi from 'joi';

// Схема для создания штрафа (POST)
export const createPenaltySchema = Joi.object({
    userId: Joi.string()
        .hex()
        .length(24)
        .required()
        .description('ID бариста, на которого налагается штраф'),

    coffeeShopId: Joi.string()
        .hex()
        .length(24)
        .optional()
        .description('ID кофейни (обязательно для Admin, опционально для Manager)'),
        
    amount: Joi.number()
        .min(0.01) // Минимальный штраф, чтобы избежать нулевых записей
        .required()
        .description('Сумма штрафа'),

    reason: Joi.string()
        .min(3)
        .max(255)
        .required()
        .description('Краткая причина штрафа (напр., "Опоздание")'),

    date: Joi.date()
        .iso()
        .required()
        .description('Дата инцидента (ISO формат)'),

    notes: Joi.string()
        .max(500)
        .optional()
        .description('Дополнительные комментарии для менеджера/админа')
});

// Схема для запроса списка штрафов (GET)
export const queryPenaltiesSchema = Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(10),
    userId: Joi.string().hex().length(24).optional().description('Фильтр по ID бариста'),
    coffeeShopId: Joi.string().hex().length(24).optional().description('Фильтр по ID кофейни'),
    dateFrom: Joi.date().iso().optional().description('Начальная дата инцидента'),
    dateTo: Joi.date().iso().optional().description('Конечная дата инцидента'),
});