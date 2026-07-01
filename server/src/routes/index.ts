import { Router } from 'express'
import { dishesRouter } from './dishes.js'
import { tablesRouter } from './tables.js'
import { ordersRouter } from './orders.js'
import { authRouter } from './auth.js'
import { adminRouter } from './admin.js'
import { restaurantRouter } from './restaurant.js'

export const apiRouter = Router()

// Public API routes
apiRouter.use('/dishes', dishesRouter)
apiRouter.use('/tables', tablesRouter)
apiRouter.use('/orders', ordersRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/restaurant-info', restaurantRouter)

// Admin API routes
apiRouter.use('/admin', adminRouter)
