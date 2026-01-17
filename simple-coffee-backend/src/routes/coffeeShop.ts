import { Router } from 'express';
import { 
    getCoffeeShops, 
    getCoffeeShopById, 
    createCoffeeShop, 
    updateCoffeeShop, 
    deleteCoffeeShop,
	//activateCoffeeShop
} from '../controllers/coffeeShopController';
import { requireRole } from '../middleware/auth';
import { 
    validateBody, 
    validateParams, 
    validateQuery 
} from '../middleware/validation';
import { 
    coffeeShopIdSchema, 
    createCoffeeShopSchema, 
    updateCoffeeShopSchema, 
    queryCoffeeShopsSchema,
    activateCoffeeShopSchema 
} from '../validation/coffeeShopSchemas';

const router = Router();

// Все роуты требуют прав администратора
router.use(requireRole(['admin']));

// GET /api/coffee-shops - список кофеен с фильтрацией и пагинацией
router.get('/', validateQuery(queryCoffeeShopsSchema), getCoffeeShops);

// GET /api/coffee-shops/:id - получить кофейню по ID
router.get('/:id', validateParams(coffeeShopIdSchema), getCoffeeShopById);

// POST /api/coffee-shops - создать новую кофейню
router.post('/', validateBody(createCoffeeShopSchema), createCoffeeShop);

// PUT /api/coffee-shops/:id - обновить кофейню
router.put(
    '/:id', 
    validateParams(coffeeShopIdSchema), 
    validateBody(updateCoffeeShopSchema), 
    updateCoffeeShop
);

// // DELETE /api/coffee-shops/:id - архивировать (деактивировать) кофейню
router.delete('/:id', validateParams(coffeeShopIdSchema), deleteCoffeeShop);

// // POST /api/coffee-shops/:id/activate - Активация кофейни
// router.post(
// 	'/:id/activate', 
// 	validateParams(coffeeShopIdSchema), 
// 	validateBody(activateCoffeeShopSchema), 
// 	activateCoffeeShop
// );

export default router;