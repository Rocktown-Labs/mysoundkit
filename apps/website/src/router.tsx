import type { RouterAppContext } from './app/__root'
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createRouter({
    context: {} as RouterAppContext,
    notFoundMode: 'root',
    routeTree,
    scrollRestoration: true,
  })

  return router
}
