import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useFavorites } from "@/lib/use-favorites";
import { cn } from "@/lib/utils";
import { SignInDialog } from "@/components/auth/sign-in-dialog";

interface FavoriteButtonProps {
  sourceId: string;
  variant?: "icon" | "button";
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function FavoriteButton({
  sourceId,
  variant = "icon",
  size = "default",
  className,
}: FavoriteButtonProps) {
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [isLoading, setIsLoading] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  const favorited = isFavorite(sourceId);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      setShowSignIn(true);
      return;
    }

    setIsLoading(true);
    await toggleFavorite(sourceId);
    setIsLoading(false);
  };

  if (variant === "icon") {
    return (
      <>
        <button
          onClick={handleClick}
          disabled={isLoading}
          className={cn(
            "p-1.5 rounded-full transition-colors",
            favorited
              ? "text-yellow-500 hover:text-yellow-600"
              : "text-muted-foreground hover:text-foreground",
            isLoading && "opacity-50 cursor-not-allowed",
            className
          )}
          title={favorited ? "Remove from favorites" : "Add to favorites"}
        >
          <Star
            className={cn(
              size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5",
              favorited && "fill-current"
            )}
          />
        </button>
        <SignInDialog open={showSignIn} onOpenChange={setShowSignIn} />
      </>
    );
  }

  return (
    <>
      <Button
        variant={favorited ? "default" : "outline"}
        size={size}
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          favorited && "bg-yellow-500 hover:bg-yellow-600 text-white",
          className
        )}
      >
        <Star
          className={cn(
            "h-4 w-4 mr-2",
            favorited && "fill-current"
          )}
        />
        {favorited ? "Favorited" : "Favorite"}
      </Button>
      <SignInDialog open={showSignIn} onOpenChange={setShowSignIn} />
    </>
  );
}
