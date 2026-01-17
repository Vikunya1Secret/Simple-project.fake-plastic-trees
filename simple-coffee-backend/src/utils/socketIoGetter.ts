import { Server } from 'socket.io';
import { io } from '../app'; // Импортируем экспортированный экземпляр

/**
 * Возвращает экземпляр Socket.IO Server.
 * @returns Server
 */
export const getIo = (): Server => {
    if (!io) {
        throw new Error('Socket.IO instance is not initialized or exported correctly.');
    }
    return io;
};