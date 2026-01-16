#!/usr/bin/env bash
# validate-frontmatter.sh - validate YAML frontmatter in SKILL.md files
# catches common issues: missing frontmatter, unquoted colons in values
set -euo pipefail

SKILL_FILE="${1:-SKILL.md}"
errors=0

if [[ ! -f "$SKILL_FILE" ]]; then
    echo "error: $SKILL_FILE not found"
    exit 1
fi

# extract frontmatter (between first two --- lines)
frontmatter=$(awk '/^---$/{if(++n==1)next; if(n==2)exit} n==1{print}' "$SKILL_FILE")

if [[ -z "$frontmatter" ]]; then
    echo "error: no YAML frontmatter found (must be between --- markers)"
    exit 1
fi

# validate each line
while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    
    # check for colon
    if [[ "$line" != *:* ]]; then
        echo "error: invalid frontmatter line (missing colon): $line"
        ((errors++))
        continue
    fi
    
    # extract value after first colon
    value="${line#*:}"
    value="${value# }"  # trim leading space
    
    # check for unquoted colons in value (common YAML gotcha)
    if [[ "$value" == *:* ]] && [[ "$value" != \"* ]] && [[ "$value" != \'* ]]; then
        echo "error: unquoted colon in value (wrap in quotes): $line"
        ((errors++))
    fi
done <<< "$frontmatter"

if [[ $errors -gt 0 ]]; then
    echo "validation failed with $errors error(s)"
    exit 1
fi

echo "✓ frontmatter valid: $SKILL_FILE"
exit 0
