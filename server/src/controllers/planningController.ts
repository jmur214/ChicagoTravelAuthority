import { Request, Response } from 'express';
import { SmartPlanningService } from '../services/SmartPlanningService';

const planner = new SmartPlanningService();

export const generatePlan = async (req: Request, res: Response) => {
    try {
        const { startLocation, startTime, vibes, neighborhoods, transportMode, budget, durationHours } = req.body;

        // Default constraints if missing
        const criteria = {
            startLocation: startLocation || { lat: 41.8781, lng: -87.6298 }, // Chicago Center default
            startTime: startTime ? new Date(startTime) : new Date(),
            durationHours: Number(durationHours) || 4,
            vibes: vibes || [],
            neighborhoods,
            transportMode: transportMode || 'drive',
            budget: Number(budget) || 2
        };

        const plan = await planner.generateItinerary(criteria);
        res.json(plan);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
