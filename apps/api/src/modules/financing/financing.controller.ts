import { Request, Response, NextFunction } from 'express';
import { FinancingSimulationSchema } from '@bot-sales/shared';
import { calculateFinancing } from './financing.service';
import { prisma } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';

export async function simulate(req: Request, res: Response, next: NextFunction) {
  try {
    const data = FinancingSimulationSchema.parse(req.body);
    const result = await calculateFinancing(data);
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getMotorcyclePlans(req: Request, res: Response, next: NextFunction) {
  try {
    const { motorcycleId } = req.params;
    const motor = await prisma.motorcycle.findUnique({
      where: { id: motorcycleId },
      include: { financingPlans: { where: { isActive: true } } }
    });

    if (!motor) {
      throw new AppError('Motor tidak ditemukan', 404);
    }

    return res.json({ success: true, data: motor.financingPlans });
  } catch (err) {
    next(err);
  }
}

export async function createFinancingPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const { motorcycleId } = req.params;
    const { name, dpMin, dpMax, tenorMonths, interestRate, adminFee, insuranceFee } = req.body;

    const plan = await prisma.financingPlan.create({
      data: {
        motorcycleId,
        name,
        dpMin: parseFloat(dpMin),
        dpMax: dpMax ? parseFloat(dpMax) : null,
        tenorMonths: parseInt(tenorMonths, 10),
        interestRate: parseFloat(interestRate),
        adminFee: adminFee ? parseFloat(adminFee) : 500000,
        insuranceFee: insuranceFee ? parseFloat(insuranceFee) : 350000
      }
    });

    return res.status(201).json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
}
