#!/bin/sh
# Raw Blender export (~56 MB PNG) -> web GLB (Draco mesh + WEBP 2K textures).
set -e
cd "$(dirname "$0")/.."
npx -y @gltf-transform/cli@4 optimize blender/f16_raw.glb public/f16.glb \
  --compress draco --texture-compress webp --texture-size 2048 --simplify false --join false --flatten false --instance false --palette false

# Cockpit (~98 MB raw): 2K textures; fall back to 1K if the web GLB is over 20 MB.
# --prune false: pruning drops empty leaf nodes, i.e. the eye_captain marker.
npx -y @gltf-transform/cli@4 optimize blender/cockpit_raw.glb public/cockpit.glb \
  --compress draco --texture-compress webp --texture-size 2048 --simplify false \
  --join false --flatten false --instance false --palette false --prune false
if [ "$(wc -c < public/cockpit.glb)" -gt 20971520 ]; then
  npx -y @gltf-transform/cli@4 optimize blender/cockpit_raw.glb public/cockpit.glb \
    --compress draco --texture-compress webp --texture-size 1024 --simplify false \
    --join false --flatten false --instance false --palette false --prune false
fi
