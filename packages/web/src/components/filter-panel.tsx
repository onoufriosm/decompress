import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Filter, ChevronDown, ChevronUp } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface FilterPanelProps {
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  entityType: "video" | "channel";
}

export function FilterPanel({
  selectedCategories,
  onCategoriesChange,
  entityType,
}: FilterPanelProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchFilters() {
      setLoading(true);

      // Fetch categories that are actually used
      const categoriesTable =
        entityType === "video" ? "video_categories" : "source_categories";

      const { data: usedCategoryIds } = await supabase
        .from(categoriesTable)
        .select("category_id");

      const uniqueCategoryIds = [
        ...new Set(usedCategoryIds?.map((c) => c.category_id) || []),
      ];

      if (uniqueCategoryIds.length > 0) {
        const { data: categoriesData } = await supabase
          .from("categories")
          .select("id, name, slug")
          .in("id", uniqueCategoryIds)
          .order("name");

        setCategories(categoriesData || []);
      }

      setLoading(false);
    }

    fetchFilters();
  }, [entityType]);

  const toggleCategory = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      onCategoriesChange(selectedCategories.filter((id) => id !== categoryId));
    } else {
      onCategoriesChange([...selectedCategories, categoryId]);
    }
  };

  const clearAll = () => {
    onCategoriesChange([]);
  };

  const hasFilters = selectedCategories.length > 0;
  const hasAnyFilters = categories.length > 0;

  if (loading) {
    return (
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-16" />
      </div>
    );
  }

  if (!hasAnyFilters) {
    return null;
  }

  return (
    <div className="mb-4">
      {/* Filter toggle button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="mb-2"
      >
        <Filter className="h-4 w-4 mr-2" />
        Filters
        {hasFilters && (
          <Badge variant="secondary" className="ml-2">
            {selectedCategories.length}
          </Badge>
        )}
        {expanded ? (
          <ChevronUp className="h-4 w-4 ml-2" />
        ) : (
          <ChevronDown className="h-4 w-4 ml-2" />
        )}
      </Button>

      {/* Selected filters (always visible when there are selections) */}
      {hasFilters && !expanded && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedCategories.map((categoryId) => {
            const category = categories.find((c) => c.id === categoryId);
            return category ? (
              <Badge
                key={category.id}
                variant="default"
                className="cursor-pointer"
                onClick={() => toggleCategory(category.id)}
              >
                {category.name}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ) : null;
          })}
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear all
          </Button>
        </div>
      )}

      {/* Expanded filter panel */}
      {expanded && (
        <div className="border rounded-lg p-4 mt-2 space-y-4">
          {/* Categories section */}
          {categories.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Categories</h4>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Badge
                    key={category.id}
                    variant={
                      selectedCategories.includes(category.id)
                        ? "default"
                        : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() => toggleCategory(category.id)}
                  >
                    {category.name}
                    {selectedCategories.includes(category.id) && (
                      <X className="h-3 w-3 ml-1" />
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Clear all button */}
          {hasFilters && (
            <div className="pt-2 border-t">
              <Button variant="outline" size="sm" onClick={clearAll}>
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
