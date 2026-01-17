import { Router } from 'express';
import Joi from 'joi';
import { authMiddleware, requireRole } from '../middleware/auth';
import { validateQuery, validateParams } from '../middleware/validation';
import { getDashboardSummary, getUserSummary } from '../controllers/statsController'; // Импортируем новый контроллер
import { exportDashboardSummary, exportUserSummary } from '../controllers/statsExportController';

const router = Router();

// Схема для параметра :userId (ObjectId)
const userIdParamSchema = Joi.object({
    userId: Joi.string().hex().length(24).required().description('ID пользователя')
});

// Схема валидации для квери-параметров дашборда (Общая статистика)
const queryDashboardSummarySchema = Joi.object({
    dateFrom: Joi.date().iso().optional().description('Начальная дата диапазона (ISO)'),
    dateTo: Joi.date().iso().optional().description('Конечная дата диапазона (ISO)'),
    coffeeShopId: Joi.string().hex().length(24).optional().description('ID кофейни (только для Admin)'),
});

// Схема валидации для квери-параметров статистики пользователя
const queryUserSummarySchema = Joi.object({
    dateFrom: Joi.date().iso().optional().description('Начальная дата диапазона (ISO)'),
    dateTo: Joi.date().iso().optional().description('Конечная дата диапазона (ISO)'),
});


/* ===========================
        STATS ROUTES
============================ */

// GET /api/stats/dashboard-summary — ключевые метрики для дашборда кофейни
router.get(
    '/dashboard-summary',
    authMiddleware,
    requireRole(['admin', 'manager']),
    validateQuery(queryDashboardSummarySchema),
    (req, res, next) => {
        req.validatedQuery = req.query;
        next();
    },
    getDashboardSummary
);

// GET /api/stats/user-summary/:userId — статистика по конкретному пользователю
router.get(
    '/user-summary/:userId',
    authMiddleware,
    // Barista может смотреть только СВОЮ статистику (проверка в контроллере)
    requireRole(['admin', 'manager', 'barista']), 
    validateParams(userIdParamSchema),
    validateQuery(queryUserSummarySchema),
    (req, res, next) => {
        req.validatedQuery = req.query;
        next();
    },
    getUserSummary
);

router.get(
    '/dashboard-summary/export',
    authMiddleware,
    requireRole(['admin', 'manager']),
    validateQuery(queryDashboardSummarySchema),
    (req, res, next) => { req.validatedQuery = req.query; next(); },
    exportDashboardSummary
);

// EXPORT: USER SUMMARY → Excel
router.get(
    '/user-summary/:userId/export',
    authMiddleware,
    requireRole(['admin', 'manager', 'barista']),
    validateParams(userIdParamSchema),
    validateQuery(queryUserSummarySchema),
    (req, res, next) => { req.validatedQuery = req.query; next(); },
    exportUserSummary
);


export default router;