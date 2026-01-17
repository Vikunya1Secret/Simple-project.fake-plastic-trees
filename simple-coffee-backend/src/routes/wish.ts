import { Router } from "express";
import Joi from "joi";
import {
    getWishes,
    getWishById,
    createWish,
    updateWish,
    deleteWish,
    updateWishStatus // Новый метод из контроллера
} from "../controllers/wishController";
import { authMiddleware, requireRole } from "../middleware/auth";
import {
    validateBody,
    validateQuery,
    validateParams
} from "../middleware/validation";

const objectIdParamSchema = Joi.object({
    id: Joi.string().hex().length(24).required()
});

// Обновленная схема фильтров
const queryWishesSchema = Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(10),
    coffeeShop: Joi.string().hex().length(24).optional(),
    user: Joi.string().hex().length(24).optional(),
    status: Joi.string().valid("pending", "approved", "rejected").optional(),
    dateFrom: Joi.date().iso().optional(),
    dateTo: Joi.date().iso().optional(),
    type: Joi.string().valid("work", "sick_leave", "vacation", "day_off", "swap").optional()
});

// Обновленная схема создания (с учетом swap)
const createWishSchema = Joi.object({
    date: Joi.date().iso().required(),
    type: Joi.string().valid("work", "sick_leave", "vacation", "day_off", "swap").required(),
    startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).when('type', { is: 'work', then: Joi.required(), otherwise: Joi.optional() }),
    endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).when('type', { is: 'work', then: Joi.required(), otherwise: Joi.optional() }),
    comment: Joi.string().allow('').optional(),
    swapWithUser: Joi.string().hex().length(24).when('type', { is: 'swap', then: Joi.required(), otherwise: Joi.forbidden() })
});

// Схема изменения статуса (для менеджеров)
const updateStatusSchema = Joi.object({
    status: Joi.string().valid("approved", "rejected").required()
});

const router = Router();

// GET /api/wishes — список
router.get(
    "/",
    authMiddleware,
    validateQuery(queryWishesSchema),
    (req, res, next) => {
        req.validatedQuery = req.query;
        next();
    },
    getWishes
);

// GET /api/wishes/:id — получить пожелание
router.get(
    "/:id",
    authMiddleware,
    validateParams(objectIdParamSchema),
    getWishById
);

// POST /api/wishes — создать пожелание (ТОЛЬКО BARISTA)
router.post(
    "/",
    authMiddleware,
    requireRole(["barista"]),
    validateBody(createWishSchema),
    (req, res, next) => {
        req.validatedBody = req.body;
        next();
    },
    createWish
);

// PATCH /api/wishes/:id/status — одобрить/отклонить (MANAGER, ADMIN)
router.patch(
    "/:id/status",
    authMiddleware,
    requireRole(["manager", "admin"]),
    validateParams(objectIdParamSchema),
    validateBody(updateStatusSchema),
    updateWishStatus
);

// PUT /api/wishes/:id — обновить текст/время (BARISTA, пока pending)
router.put(
    "/:id",
    authMiddleware,
    requireRole(["barista"]),
    validateParams(objectIdParamSchema),
    validateBody(createWishSchema.fork(['date', 'type'], (schema) => schema.optional())),
    (req, res, next) => {
        req.validatedBody = req.body;
        next();
    },
    updateWish
);

// DELETE /api/wishes/:id — удалить пожелание
router.delete(
    "/:id",
    authMiddleware,
    validateParams(objectIdParamSchema),
    deleteWish
);

export default router;