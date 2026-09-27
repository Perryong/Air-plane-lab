#!/bin/sh
# Raw Blender export (~56 MB PNG) -> web GLB (Draco mesh + WEBP 2K textures).
set -e
cd "$(dirname "$0")/.."
npx -y @gltf-transform/cli@4 optimize blender/f16_raw.glb public/f16.glb \
  --compress draco --texture-compress webp --texture-size 2048 --simplify false --join false --flatten false --instance false --palette false
