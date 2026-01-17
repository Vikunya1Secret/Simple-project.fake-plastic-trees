import { Router } from 'express';
import { 
  getUsers, 
  getUserById, 
  createUser, 
  updateUser, 
  deleteUser, 
  //activateUser 
} from '../controllers/userController';
import { requireRole } from '../middleware/auth';
import { 
  validateBody, 
  validateParams, 
  validateQuery 
} from '../middleware/validation';
import { 
  createUserSchema, 
  updateUserSchema, 
  userIdSchema, 
  queryUsersSchema 
} from '../validation/userSchemas';

const router = Router();

// Все роуты требуют прав администратора
router.use(requireRole(['admin']));

// GET /api/users - список пользователей с фильтрацией и пагинацией
router.get('/', validateQuery(queryUsersSchema), getUsers);

// GET /api/users/:id - получить пользователя по ID
router.get('/:id', validateParams(userIdSchema), getUserById);

// POST /api/users - создать нового пользователя
router.post('/', validateBody(createUserSchema), createUser);

// PUT /api/users/:id - обновить пользователя
router.put('/:id', validateParams(userIdSchema), validateBody(updateUserSchema), updateUser);

// DELETE /api/users/:id - деактивировать пользователя
router.delete('/:id', validateParams(userIdSchema), deleteUser);

// // PATCH /api/users/:id/activate - активировать пользователя
// router.patch('/:id/activate', validateParams(userIdSchema), activateUser);

export default router;