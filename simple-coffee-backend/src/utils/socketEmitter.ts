import { Server as SocketServer } from 'socket.io';
import { Types } from 'mongoose';

let ioInstance: SocketServer;

/**
 * Вспомогательная функция для приведения любого ID к строке.
 * Помогает избежать ошибок, если передается объект из populate.
 */
const stringifyId = (id: any): string => {
    if (!id) return '';
    if (typeof id === 'string') return id;
    return id._id ? id._id.toString() : id.toString();
};

export const setIoInstance = (io: SocketServer) => {
    ioInstance = io;
};

export const getIo = (): SocketServer => {
    if (!ioInstance) {
        throw new Error('Socket.IO не инициализирован.');
    }
    return ioInstance;
};

/**
 * Уведомление об изменениях смен.
 * Теперь принимает coffeeShopId, который может быть объектом.
 */
export const emitShiftUpdate = (coffeeShopId: any, userId: any, action: 'created' | 'updated' | 'deleted', shift: any) => {
    const io = getIo();
    const shopRoom = `coffeeshop:${stringifyId(coffeeShopId)}`;
    const userRoom = `user:${stringifyId(userId)}`;

    // Отправляем в комнату кофейни (видят все сотрудники этой точки)
    io.to(shopRoom).emit('shifts:updated', { action, shift });
    
    // Дублируем лично пользователю (полезно для уведомлений в приложении)
    io.to(userRoom).emit('shifts:updated', { action, shift });
    
    console.log(`[Socket] Shift ${action} emitted to rooms: ${shopRoom}, ${userRoom}`);
};

/**
 * Уведомление об изменениях пожеланий (Wishes).
 */
export const emitWishUpdate = (coffeeShopId: any, action: 'created' | 'updated' | 'deleted', wish: any) => {
    const io = getIo();
    const shopRoom = `coffeeshop:${stringifyId(coffeeShopId)}`;

    // Менеджеры и бариста кофейни следят за обновлениями заявок
    io.to(shopRoom).emit('wishes:updated', { action, wish });
    
    console.log(`[Socket] Wish ${action} emitted to room: ${shopRoom}`);
};

/**
 * Специальное событие для публикации расписания
 */
export const emitSchedulePublished = (coffeeShopId: any, data: { date: string, modifiedCount: number }) => {
    const io = getIo();
    const shopRoom = `coffeeshop:${stringifyId(coffeeShopId)}`;
    
    io.to(shopRoom).emit('shifts:published', data);
    console.log(`[Socket] Schedule published for shop: ${shopRoom}`);
};