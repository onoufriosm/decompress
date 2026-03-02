import { supabase } from "./supabase";

const TECHNOLOGY_SLUG = "technology";

let cachedSourceIds: string[] | null = null;
let cachedCategoryId: string | null = null;

export async function getTechnologyCategoryId(): Promise<string | null> {
  if (cachedCategoryId) return cachedCategoryId;

  const { data: catData } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", TECHNOLOGY_SLUG)
    .single();

  if (!catData) return null;

  cachedCategoryId = catData.id;
  return cachedCategoryId;
}

export async function getTechnologySourceIds(): Promise<string[]> {
  if (cachedSourceIds) return cachedSourceIds;

  const categoryId = await getTechnologyCategoryId();

  if (!categoryId) return [];

  const { data } = await supabase
    .from("source_categories")
    .select("source_id")
    .eq("category_id", categoryId);

  cachedSourceIds = data?.map((r) => r.source_id) || [];
  return cachedSourceIds;
}
