-- Таблица комментариев для One1Game (гостевые, без авторизации)
CREATE TABLE IF NOT EXISTS public.comments (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_url    text NOT NULL,
  author_name text NOT NULL DEFAULT 'Гость',
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Индекс для быстрой выборки по странице
CREATE INDEX IF NOT EXISTS idx_comments_page_url ON public.comments (page_url, created_at DESC);

-- RLS отключён — таблица публичная (anon key имеет доступ на чтение и запись)
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_can_read_comments"  ON public.comments FOR SELECT USING (true);
CREATE POLICY "anon_can_insert_comments" ON public.comments FOR INSERT WITH CHECK (true);
