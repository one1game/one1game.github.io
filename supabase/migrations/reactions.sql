-- Удаляем старую таблицу комментариев
DROP TABLE IF EXISTS public.comments CASCADE;

-- Таблица реакций (эмодзи-счётчики)
CREATE TABLE public.reactions (
  page_url text NOT NULL,
  emoji    text NOT NULL,
  count    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (page_url, emoji)
);

-- RLS: анон может читать
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_can_read_reactions"   ON public.reactions FOR SELECT USING (true);
CREATE POLICY "anon_can_insert_reactions" ON public.reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_can_update_reactions" ON public.reactions FOR UPDATE USING (true);

-- Функция для атомарного инкремента счётчика (upsert)
CREATE OR REPLACE FUNCTION public.increment_reaction(
  p_page_url text,
  p_emoji text
) RETURNS integer AS $$
DECLARE
  new_count integer;
BEGIN
  INSERT INTO public.reactions (page_url, emoji, count)
  VALUES (p_page_url, p_emoji, 1)
  ON CONFLICT (page_url, emoji)
  DO UPDATE SET count = reactions.count + 1
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
