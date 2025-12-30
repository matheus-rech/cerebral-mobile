/**
 * Server Routes Index
 * Registers all API routes
 */

import { Router } from 'express';
import analyzeMriRouter from './analyze-mri';
import mlProxyRouter from './ml-proxy';
import replicateProxyRouter from './replicate-proxy';

const router = Router();

// Register routes
router.use(analyzeMriRouter);
router.use(mlProxyRouter);
router.use(replicateProxyRouter);

export default router;
