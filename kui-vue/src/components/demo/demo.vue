<template>
  <div class="k-demo">
    <div class="k-demo-main">
      <div class="k-content">
        <slot name="component"></slot>
      </div>
      <div class="k-desc">
        <div class="k-desc-content typo">
          <slot name="description"></slot>
        </div>
      </div>
      <div class="k-code-actions">
        <Tooltip title="Copy code">
          <Icon :type="CopyOutline" @click="copy" />
        </Tooltip>
        <Tooltip :title="expand?'Hide code':'Show code'">
          <Icon :type="'code'+(expand?'-working':'')" @click="expand=!expand" />
        </Tooltip>
      </div>
    </div>
    <transition @enter="enter" @leave="leave" @beforeEnter="beforeEnter">
      <div v-show="expand" class="k-code">
        <slot name="code"></slot>
      </div>
    </transition>
  </div>
</template>
<script>
import "./demo.less";
// import Code from '../code'
import Tooltip from "@/components/tooltip";
import Message from "@/components/message";
import { CopyOutline } from "kui-icons";
export default {
  components: { Tooltip },
  data() {
    return {
      CopyOutline,
      expand: false
    };
  },
  name: "Demo",
  props: {
    sourceCode: String,
  },
  methods: {
    copy() {
      this.$copyText(this.sourceCode).then(
        e => {
          this.$Message.success('Copied!')
        },
        function (e) {
          Message.error("复制代码失败，请手动复制");
        }
      );
    },
    beforeEnter(el) {
      el.style.height = 0;
      el.style.opacity = 0.1;
    },
    enter(el) {
      if (el.scrollHeight !== 0) {
        el.style.height = el.scrollHeight + "px";
        el.style.opacity = 1;
      } else {
        el.style.height = "";
        el.style.opacity = "";
      }
    },
    leave(el) {
      if (el.scrollHeight !== 0) {
        el.style.height = 0;
        el.style.opacity = 0.1;
      }
    },
  },
};
</script>
