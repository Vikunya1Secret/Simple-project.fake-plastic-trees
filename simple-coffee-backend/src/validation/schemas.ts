import Joi from "joi";

// Валидация параметров /:id
export const idParamSchema = Joi.object({
  id: Joi.string().required()
});

// Валидация тела запроса для /publish
export const publishSchema = Joi.object({
  date: Joi.string().required()
});

// Валидация query для списка
export const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional(),
  dateRange: Joi.string().optional(),
  status: Joi.string().optional(),
});