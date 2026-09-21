import { Router } from 'express';
import { initializePayment, handlePaystackWebhook, verifyPayment} from '../controllers/payment.controller';
import { verifyPaystackSignature } from '../middleware/paystack.middleware';

const router = Router();

router.post('/initialize', initializePayment);
router.post('/webhook', verifyPaystackSignature, handlePaystackWebhook);
router.get('/verify/:reference', verifyPayment);

export default router;