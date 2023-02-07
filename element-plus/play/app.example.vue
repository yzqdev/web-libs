<template>
  <div class="play-container">
    <el-icon color="#409EFC">
      <el-icon-check />
    </el-icon>
    <el-icon>
      <el-icon-menu />
    </el-icon>
    <el-button>test</el-button>
    <el-date-picker
      v-model="value1"
      type="week"
      format="[Week] ww"
      placeholder="Pick a week"
    />
    <div v-loading="true" />
  </div>
</template>

<script setup lang="ts">
// code here
import {ref} from "vue";

let value1=ref()
</script>

<style lang="scss">
html,
body {
  width: 100vw;
  height: 100vh;
  margin: 0;
  #play {
    height: 100%;
    width: 100%;
    .play-container {
      height: 100%;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
}
</style>
