import { Router } from 'express';

export const notificationsRouter = Router();

notificationsRouter.get('/whatsapp/config', (_request, response) => {
  response.json({
    configured: false,
    provider: 'disabled',
  });
});

notificationsRouter.post('/whatsapp', (_request, response) => {
  response.status(410).json({ message: 'WhatsApp notifications are disabled.' });
});
