-- Атомарный декремент (исправляет баг с гонкой DELETE/INSERT)
CREATE OR REPLACE FUNCTION public.decrement_reaction(
  p_page_url text,
  p_emoji text
) RETURNS integer AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE public.reactions
  SET count = count - 1
  WHERE page_url = p_page_url AND emoji = p_emoji AND count > 0
  RETURNING count INTO new_count;

  IF new_count IS NULL THEN
    RETURN 0;
  END IF;

  IF new_count <= 0 THEN
    DELETE FROM public.reactions WHERE page_url = p_page_url AND emoji = p_emoji;
    RETURN 0;
  END IF;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
