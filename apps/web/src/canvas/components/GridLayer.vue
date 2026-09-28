<script setup lang="ts">
import {
  WORLD_PLANE_ORIGIN,
  WORLD_PLANE_SIZE,
} from '../constants/worldPlane'

const GRID_SIZE = 40
</script>

<template>
  <div
    class="grid-layer"
    :style="{
      left: `${WORLD_PLANE_ORIGIN}px`,
      top: `${WORLD_PLANE_ORIGIN}px`,
      width: `${WORLD_PLANE_SIZE}px`,
      height: `${WORLD_PLANE_SIZE}px`,
      backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
    }"
  />
</template>

<style scoped>
.grid-layer {
  position: absolute;
  pointer-events: none;
  z-index: 1;

  /*
    Gua balikin rumus asli linear-gradient kepunyaan lu biar ga ngebug,
    tapi isinya gua ganti ke warna biru blueprint tipis (rgba 63, 131, 248, 0.04)
  */
  background-image:
    linear-gradient(
      rgba(63, 131, 248, 0.04) 1px,
      transparent 1px
    ),
    linear-gradient(
      90deg,
      rgba(63, 131, 248, 0.04) 1px,
      transparent 1px
    );
}
</style>
