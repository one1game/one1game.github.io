import type { APIRoute } from 'astro';
import { historyByDay } from '../data/gaming-history';

export const prerender = true;

// Тот же набор, что рендерится в информере на сервере.
// Нужен, чтобы клиент показал событие текущего дня, если сборка была раньше.
export const GET: APIRoute = () =>
  new Response(JSON.stringify(historyByDay), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
