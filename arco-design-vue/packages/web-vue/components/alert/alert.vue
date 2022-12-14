<template>
  <transition name="zoom-in-top" @after-leave="handleAfterLeave">
    <div v-if="visible" role="alert" :class="cls">
      <div v-if="showIcon" :class="`${prefixCls}-icon`">
        <slot name="icon">
          <icon-info-circle-fill v-if="type === 'info'" />
          <icon-check-circle-fill v-else-if="type === 'success'" />
          <icon-exclamation-circle-fill v-else-if="type === 'warning'" />
          <icon-close-circle-fill v-else-if="type === 'error'" />
        </slot>
      </div>
      <div :class="`${prefixCls}-body`">
        <div v-if="title || $slots.title" :class="`${prefixCls}-title`">
          <slot name="title">
            {{ title }}
          </slot>
        </div>
        <div :class="`${prefixCls}-content`">
          <slot />
        </div>
      </div>
      <div v-if="$slots.action" :class="`${prefixCls}-action`">
        <slot name="action" />
      </div>
      <div
        v-if="closable"
        tabindex="-1"
        role="button"
        aria-label="Close"
        :class="`${prefixCls}-close-btn`"
        @click="handleClose"
      >
        <slot name="close-element">
          <icon-hover>
            <icon-close />
          </icon-hover>
        </slot>
      </div>
    </div>
  </transition>
</template>

<script lang="ts">
import type { PropType } from 'vue';
import { computed, defineComponent, ref } from 'vue';
import { getPrefixCls } from '../_utils/global-config';
import { MessageType } from '../_utils/constant';
import IconHover from '../_components/icon-hover.vue';
import IconClose from '../icon/icon-close';
import IconInfoCircleFill from '../icon/icon-info-circle-fill';
import IconCheckCircleFill from '../icon/icon-check-circle-fill';
import IconExclamationCircleFill from '../icon/icon-exclamation-circle-fill';
import IconCloseCircleFill from '../icon/icon-close-circle-fill';

export default defineComponent({
  name: 'Alert',
  components: {
    IconHover,
    IconClose,
    IconInfoCircleFill,
    IconCheckCircleFill,
    IconExclamationCircleFill,
    IconCloseCircleFill,
  },
  props: {
    /**
     * @zh ?????????????????????
     * @en Type of the alert
     * @values info, success, warning, error
     */
    type: {
      type: String as PropType<MessageType>,
      default: 'info',
    },
    /**
     * @zh ??????????????????
     * @en Whether to show the icon
     */
    showIcon: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ????????????????????????
     * @en Whether to show the close button
     */
    closable: {
      type: Boolean,
      default: false,
    },
    /**
     * @zh ?????????????????????
     * @en The title of the alert
     */
    title: String,
    /**
     * @zh ?????????????????????????????????????????????????????????
     * @en Whether to use as the top announcement (remove the border and rounded corners)
     */
    banner: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    /**
     * @zh ???????????????????????????
     * @en Triggered when the close button is clicked
     * @param {MouseEvent} ev
     */
    close: (ev: MouseEvent) => true,
    /**
     * @zh ???????????????????????????
     * @en Triggered after the close animation ends
     */
    afterClose: () => true,
  },
  /**
   * @zh ??????
   * @en Title
   * @slot title
   */
  /**
   * @zh ??????
   * @en Icon
   * @slot icon
   */
  /**
   * @zh ?????????
   * @en Actions
   * @slot action
   */
  /**
   * @zh ????????????
   * @en Close element
   * @slot close-element
   * @version 2.36.0
   */
  setup(props, { slots, emit }) {
    const prefixCls = getPrefixCls('alert');
    const visible = ref(true);

    const handleClose = (ev: MouseEvent) => {
      visible.value = false;
      emit('close', ev);
    };

    const handleAfterLeave = () => {
      emit('afterClose');
    };

    const cls = computed(() => [
      prefixCls,
      `${prefixCls}-${props.type}`,
      {
        [`${prefixCls}-with-title`]: Boolean(props.title || slots.title),
        [`${prefixCls}-banner`]: props.banner,
      },
    ]);

    return {
      prefixCls,
      cls,
      visible,
      handleClose,
      handleAfterLeave,
    };
  },
});
</script>
