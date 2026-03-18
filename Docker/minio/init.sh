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

echo "Uploading company logos from seed..."
upload_file_if_exists "/seed/companies/WebCanape/logo.jpg" "company-logos/webcanape/logo.jpg"
upload_file_if_exists "/seed/companies/Coalla/logo.jpg" "company-logos/coalla/logo.jpg"
upload_file_if_exists "/seed/companies/ProstyeResheniya/logo.jpg" "company-logos/prostyeresheniya/logo.jpg"

echo "Uploading generated placeholders for companies without source logos..."
upload_inline_svg "company-logos/yandex/logo.svg" "YA" "#ffcc00"
upload_inline_svg "company-logos/vk/logo.svg" "VK" "#0077ff"
upload_inline_svg "company-logos/ozon-tech/logo.svg" "OZ" "#005bff"
upload_inline_svg "company-logos/t-bank/logo.svg" "TB" "#333333"
upload_inline_svg "company-logos/2gis/logo.svg" "2G" "#00a651"
upload_inline_svg "company-logos/kaspersky/logo.svg" "KA" "#006d5b"
upload_inline_svg "company-logos/sber/logo.svg" "SB" "#21a038"

echo "Uploading system user avatars..."
upload_inline_svg "user-avatars/system/admin.svg" "AD" "#1f2937"
upload_inline_svg "user-avatars/system/employer.svg" "EM" "#0f766e"
upload_inline_svg "user-avatars/system/seeker.svg" "SE" "#1d4ed8"

echo "MinIO init completed."
