#!/bin/sh
set -eu

echo "Waiting MinIO..."
until mc alias set local http://minio:9000 minioadmin minioadmin >/dev/null 2>&1; do
  sleep 2
done

echo "Creating bucket tramplin-media..."
mc mb -p local/tramplin-media >/dev/null 2>&1 || true

upload_file_if_exists() {
  local source_file="$1"
  local target_object="$2"
  if [ -f "$source_file" ]; then
    mc cp "$source_file" "local/tramplin-media/$target_object" >/dev/null
    echo "Uploaded: $target_object"
  fi
}

upload_inline_svg() {
  local target_object="$1"
  local text="$2"
  local bg="$3"
  local tmp="/tmp/avatar_$(date +%s%N).svg"
  cat > "$tmp" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="$bg" />
  <text x="256" y="278" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="72" font-weight="700">$text</text>
</svg>
SVG
  mc cp "$tmp" "local/tramplin-media/$target_object" >/dev/null
  rm -f "$tmp"
  echo "Uploaded: $target_object"
}

upload_company_logos() {
  local base="/seed/design-data/Компании"
  if [ ! -d "$base" ]; then
    echo "No company source directory found: $base"
    return
  fi

  echo "Uploading company logos from test data..."
  local idx=1
  find "$base" -mindepth 1 -maxdepth 1 -type d | sort | while IFS= read -r dir; do
    logo_file="$(find "$dir" -mindepth 1 -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.svg' -o -iname '*.webp' \) | sort | head -n 1 || true)"
    if [ -n "$logo_file" ]; then
      ext="${logo_file##*.}"
      ext="$(echo "$ext" | tr '[:upper:]' '[:lower:]')"
      key="$(printf 'company-logos/test-data/company-%02d.%s' "$idx" "$ext")"
      upload_file_if_exists "$logo_file" "$key"
    fi
    idx=$((idx + 1))
  done
}

upload_seeker_avatars() {
  local base="/seed/design-data/Соискатели/Аватарки"
  if [ ! -d "$base" ]; then
    echo "No avatar source directory found: $base"
    return
  fi

  echo "Uploading seeker avatars..."
  find "$base" -mindepth 1 -maxdepth 1 -type f \( -iname '*.svg' -o -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) | sort | while IFS= read -r file; do
    filename="$(basename "$file")"
    upload_file_if_exists "$file" "user-avatars/seekers/$filename"
  done
}

upload_portfolio_photos() {
  local base="/seed/design-data/Соискатели/Проекты"
  if [ ! -d "$base" ]; then
    echo "No portfolio photo source directory found: $base"
    return
  fi

  echo "Uploading portfolio project photos..."
  find "$base" -mindepth 1 -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) | sort | while IFS= read -r file; do
    filename="$(basename "$file")"
    upload_file_if_exists "$file" "portfolio-projects/test-data/$filename"
  done
}

upload_company_logos
upload_seeker_avatars
upload_portfolio_photos

echo "Uploading system user avatars..."
upload_inline_svg "user-avatars/system/admin.svg" "AD" "#1f2937"
upload_inline_svg "user-avatars/system/employer.svg" "EM" "#0f766e"
upload_inline_svg "user-avatars/system/seeker.svg" "SE" "#1d4ed8"

echo "MinIO init completed."
