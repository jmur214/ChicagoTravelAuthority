import { Router } from 'express';
import multer from 'multer';
import { createLocation, updateLocation, deleteLocation, importKml, getLocations } from './controllers/importController';
import * as tagController from './controllers/tagController';
import * as categoryController from './controllers/categoryController'; // Added import for categoryController

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

import { generatePlan } from './controllers/planningController';

// Categories
router.get('/categories', categoryController.getCategories);
router.post('/categories', categoryController.createCategory);
router.put('/categories/:id', categoryController.updateCategory);
router.delete('/categories/:id', categoryController.deleteCategory);

// Import & Planning
router.post('/import', upload.single('file'), importKml);
router.post('/plan', generatePlan);

// Location CRUD
router.get('/locations', getLocations);
router.post('/locations', createLocation);
router.put('/locations/:id', updateLocation);
router.delete('/locations/:id', deleteLocation);

// Tag Routes
router.get('/tags', tagController.getTags);
router.post('/tags', tagController.createTag);
router.put('/tags/:id', tagController.updateTag);
router.delete('/tags/:id', tagController.deleteTag);
router.post('/tags/:id/categories', tagController.addCategoryToTag);
router.delete('/tags/:id/categories/:categoryId', tagController.removeCategoryFromTag);

// CTA Trains
import { ctaService } from './services/ctaService';
import { gtfsService } from './services/gtfsService';

router.get('/trains', (req, res) => {
    res.json(ctaService.getLatestSnapshot());
});

router.get('/gtfs/routes', (req, res) => {
    res.json(gtfsService.getRoutes());
});

export default router;
