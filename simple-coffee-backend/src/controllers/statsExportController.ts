import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { getDashboardSummary, getUserSummary } from './statsController';

// ===== Функция помощник: отправка Excel =====
const sendWorkbook = async (res: Response, workbook: ExcelJS.Workbook, fileName: string) => {
    // Очищаем заголовки, если они были установлены ранее (например, через json)
    res.removeHeader('Content-Type');
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
};

// ===== DASHBOARD EXPORT =====
export const exportDashboardSummary = async (req: Request, res: Response) => {
    try {
        let statsData: any = null;

        // Изолированный mock объект
        const mockRes: any = {
            status() { return this; },
            json(payload: any) {
                statsData = payload.data;
                return this;
            }
        };
        
        // Вызываем контроллер
        await getDashboardSummary(req, mockRes);

        if (!statsData) {
            return res.status(404).json({ success: false, message: 'Статистика не найдена' });
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Dashboard Summary');

        sheet.columns = [
            { header: 'Метрика', key: 'metric', width: 35 },
            { header: 'Значение', key: 'value', width: 20 },
        ];

        // Превращаем JSON в строки таблицы
        const rows = [
            { metric: 'Всего смен', value: statsData.totalShifts },
            { metric: 'Общее кол-во часов', value: statsData.totalShiftHours },
            { metric: 'Пожеланий в ожидании', value: statsData.pendingWishesCount },
            { metric: 'Активных бариста', value: statsData.activeBaristasCount },
            { metric: 'ФОТ (Payroll)', value: statsData.totalPayroll },
            { metric: 'Штрафы', value: statsData.totalPenaltiesInPeriod },
            { metric: 'Чистые затраты', value: statsData.netLaborCost }
        ];

        sheet.addRows(rows);
        sheet.getRow(1).font = { bold: true };

        await sendWorkbook(res, workbook, 'dashboard_stats.xlsx');

    } catch (err) {
        console.error('exportDashboardSummary error:', err);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Ошибка генерации Excel' });
        }
    }
};

// ===== USER EXPORT =====
export const exportUserSummary = async (req: Request, res: Response) => {
    try {
        let statsData: any = null;

        const mockRes: any = {
            status() { return this; },
            json(payload: any) {
                statsData = payload.data;
                return this;
            }
        };

        await getUserSummary(req, mockRes);

        if (!statsData) {
            return res.status(404).json({ success: false, message: 'Статистика пользователя не найдена' });
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('User Stats');

        sheet.columns = [
            { header: 'Параметр', key: 'metric', width: 35 },
            { header: 'Значение', key: 'value', width: 20 },
        ];

        const rows = [
            { metric: 'ID Пользователя', value: statsData.userId },
            { metric: 'Смен в периоде', value: statsData.totalShiftsInPeriod },
            { metric: 'Часов отработано', value: statsData.totalHoursInPeriod },
            { metric: 'Подано пожеланий', value: statsData.wishesSubmitted },
            { metric: 'Ставка (час)', value: statsData.hourlyRate },
            { metric: 'Начислено', value: statsData.totalIncome },
            { metric: 'Штрафов (сумма)', value: statsData.totalPenaltiesAmount },
            { metric: 'К выплате', value: statsData.netEarnings }
        ];

        sheet.addRows(rows);
        sheet.getRow(1).font = { bold: true };

        await sendWorkbook(res, workbook, `user_stats_${statsData.userId}.xlsx`);

    } catch (err) {
        console.error('exportUserSummary error:', err);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Ошибка формирования файла' });
        }
    }
};