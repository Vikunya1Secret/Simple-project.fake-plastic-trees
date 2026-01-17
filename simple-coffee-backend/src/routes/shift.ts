import { Router } from 'express';
import {
    getShifts,
    getShiftById,
    createShift,
    updateShift,
    deleteShift
} from '../controllers/shiftController';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
    queryShiftsSchema,
    createShiftSchema,
    updateShiftSchema
} from '../validation/schedulingSchemas';
import {
    validateBody,
    validateParams,
    validateQuery
} from '../middleware/validation';
import Joi from 'joi';

const objectIdParamSchema = Joi.object({
    id: Joi.string().hex().length(24).required()
});

const router = Router();

// GET /api/shifts — список смен
router.get(
    '/',
    authMiddleware,
    validateQuery(queryShiftsSchema),
    (req, res, next) => {
        req.validatedQuery = req.query;
        next();
    },
    getShifts
);

// GET /api/shifts/:id — получение смены
router.get(
    '/:id',
    authMiddleware,
    validateParams(objectIdParamSchema),
    getShiftById
);

// POST /api/shifts — создание смены (Admin, Manager)
router.post(
    '/',
    authMiddleware,
    requireRole(['admin', 'manager']),
    validateBody(createShiftSchema),
    (req, res, next) => {
        req.validatedBody = req.body;
        next();
    },
    createShift
);

// PUT /api/shifts/:id — обновление смены (Admin, Manager)
router.put(
    '/:id',
    authMiddleware,
    requireRole(['admin', 'manager']),
    validateParams(objectIdParamSchema),
    validateBody(updateShiftSchema),
    (req, res, next) => {
        req.validatedBody = req.body;
        next();
    },
    updateShift
);

// DELETE /api/shifts/:id — удаление смены (Admin, Manager)
router.delete(
    '/:id',
    authMiddleware,
    requireRole(['admin', 'manager']),
    validateParams(objectIdParamSchema),
    deleteShift
);

export default router;