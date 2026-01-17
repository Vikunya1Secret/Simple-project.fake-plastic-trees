import { Router } from 'express';
import Joi from 'joi';
import { authMiddleware, requireRole } from '../middleware/auth';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { 
    createPenalty, 
    getPenalties, 
    deletePenalty 
} from '../controllers/penaltyController';
import { 
    createPenaltySchema, 
    queryPenaltiesSchema 
} from '../validation/penaltySchemas';

const router = Router();

// Схема для параметра :id (ObjectId)
const objectIdParamSchema = Joi.object({
    id: Joi.string().hex().length(24).required()
});

/* ===========================
        PENALTY ROUTES
============================ */

// GET /api/penalties — Список всех штрафов (с фильтрами)
router.get(
    '/',
    authMiddleware,
    requireRole(['admin', 'manager']),
    validateQuery(queryPenaltiesSchema),
    (req, res, next) => {
        req.validatedQuery = req.query;
        next();
    },
    getPenalties
);

// POST /api/penalties — Создание нового штрафа (Admin/Manager)
router.post(
    '/',
    authMiddleware,
    requireRole(['admin', 'manager']),
    validateBody(createPenaltySchema),
    (req, res, next) => {
        req.validatedBody = req.body;
        next();
    },
    createPenalty
);

// DELETE /api/penalties/:id — Удаление штрафа (Admin/Manager)
router.delete(
    '/:id',
    authMiddleware,
    requireRole(['admin', 'manager']),
    validateParams(objectIdParamSchema),
    deletePenalty
);


export default router;