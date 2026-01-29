#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"
cd "$API_DIR"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Check for required env vars
check_env() {
    if [ -z "$SUPABASE_PROJECT_REF" ]; then
        echo -e "${RED}Error: SUPABASE_PROJECT_REF not set in .env${NC}"
        echo "Add: SUPABASE_PROJECT_REF=your-project-ref"
        exit 1
    fi
}

# Ensure project is linked
ensure_linked() {
    if [ ! -f "$API_DIR/supabase/.temp/project-ref" ]; then
        echo -e "${YELLOW}Linking to Supabase project...${NC}"
        npx supabase link --project-ref "$SUPABASE_PROJECT_REF"
    fi
}

# Print usage
usage() {
    echo -e "${BLUE}Supabase Deployment Script${NC}"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  ${GREEN}all${NC}              Run migrations, deploy functions, and generate types"
    echo "  ${GREEN}migrate${NC}          Push database migrations to Supabase"
    echo "  ${GREEN}functions${NC}        Deploy all edge functions"
    echo "  ${GREEN}function${NC} <name>  Deploy a specific edge function"
    echo "  ${GREEN}types${NC}            Generate TypeScript types from database"
    echo "  ${GREEN}status${NC}           Show migration and function status"
    echo "  ${GREEN}secrets${NC}          Set edge function secrets from .env"
    echo ""
    echo "Examples:"
    echo "  $0 all                    # Full deployment"
    echo "  $0 migrate                # Just run migrations"
    echo "  $0 function chat          # Deploy only chat function"
    echo "  $0 types                  # Regenerate types"
    echo ""
}

# Run migrations
run_migrations() {
    echo -e "${BLUE}Checking database migrations...${NC}"
    ensure_linked

    # Check if there are pending migrations
    PENDING=$(npx supabase migration list 2>/dev/null | grep -c "not applied" || true)

    if [ "$PENDING" -gt 0 ]; then
        echo -e "  ${YELLOW}$PENDING pending migration(s) found${NC}"
        npx supabase db push
        echo -e "${GREEN}✓ Migrations applied${NC}"
    else
        echo -e "${GREEN}✓ All migrations already applied${NC}"
    fi
}

# Deploy all functions
deploy_functions() {
    echo -e "${BLUE}Deploying edge functions...${NC}"
    ensure_linked

    # Find all function directories
    FUNCTIONS_DIR="$API_DIR/supabase/functions"

    for func_dir in "$FUNCTIONS_DIR"/*/; do
        if [ -d "$func_dir" ]; then
            func_name=$(basename "$func_dir")
            # Skip _shared directory
            if [ "$func_name" != "_shared" ] && [ "$func_name" != ".vscode" ]; then
                echo -e "  Deploying ${YELLOW}$func_name${NC}..."
                npx supabase functions deploy "$func_name" --no-verify-jwt
            fi
        fi
    done

    echo -e "${GREEN}✓ All functions deployed${NC}"
}

# Deploy a specific function
deploy_function() {
    local func_name=$1
    if [ -z "$func_name" ]; then
        echo -e "${RED}Error: Function name required${NC}"
        echo "Usage: $0 function <name>"
        exit 1
    fi

    ensure_linked
    echo -e "${BLUE}Deploying function: ${YELLOW}$func_name${NC}"
    npx supabase functions deploy "$func_name" --no-verify-jwt
    echo -e "${GREEN}✓ Function $func_name deployed${NC}"
}

# Generate types
generate_types() {
    echo -e "${BLUE}Generating TypeScript types...${NC}"

    # Generate for Node.js usage (src/types)
    mkdir -p "$API_DIR/src/types"
    npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" > "$API_DIR/src/types/database.ts"
    echo -e "  ${GREEN}✓${NC} Generated src/types/database.ts"

    # Generate for Edge Functions (_shared)
    mkdir -p "$API_DIR/supabase/functions/_shared"
    npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" > "$API_DIR/supabase/functions/_shared/database.types.ts"
    echo -e "  ${GREEN}✓${NC} Generated supabase/functions/_shared/database.types.ts"

    echo -e "${GREEN}✓ Types generated${NC}"
}

# Show status
show_status() {
    ensure_linked
    echo -e "${BLUE}Migration Status:${NC}"
    npx supabase migration list 2>/dev/null || echo "  (Could not fetch migration status)"

    echo ""
    echo -e "${BLUE}Edge Functions:${NC}"
    FUNCTIONS_DIR="$API_DIR/supabase/functions"
    for func_dir in "$FUNCTIONS_DIR"/*/; do
        if [ -d "$func_dir" ]; then
            func_name=$(basename "$func_dir")
            if [ "$func_name" != "_shared" ] && [ "$func_name" != ".vscode" ]; then
                echo -e "  • $func_name"
            fi
        fi
    done
}

# Set secrets for edge functions
set_secrets() {
    echo -e "${BLUE}Setting edge function secrets...${NC}"

    # Read secrets from .env
    if [ -f .env ]; then
        # Extract relevant secrets
        ANTHROPIC_KEY=$(grep "^ANTHROPIC_API_KEY=" .env | cut -d '=' -f2)

        if [ -n "$ANTHROPIC_KEY" ]; then
            echo "ANTHROPIC_API_KEY=$ANTHROPIC_KEY" | npx supabase secrets set --env-file /dev/stdin
            echo -e "  ${GREEN}✓${NC} ANTHROPIC_API_KEY set"
        fi

        echo -e "${GREEN}✓ Secrets configured${NC}"
    else
        echo -e "${RED}No .env file found${NC}"
        exit 1
    fi
}

# Full deployment
deploy_all() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}   Full Supabase Deployment${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""

    run_migrations
    echo ""
    deploy_functions
    echo ""
    generate_types

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}   Deployment Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
}

# Main
check_env

case "${1:-}" in
    all)
        deploy_all
        ;;
    migrate)
        run_migrations
        ;;
    functions)
        deploy_functions
        ;;
    function)
        deploy_function "$2"
        ;;
    types)
        generate_types
        ;;
    status)
        show_status
        ;;
    secrets)
        set_secrets
        ;;
    *)
        usage
        ;;
esac
