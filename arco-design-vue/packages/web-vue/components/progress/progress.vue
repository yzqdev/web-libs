<template>
  <div :class="cls">
    <progress-steps
      v-if="steps > 0"
      :stroke-width="strokeWidth"
      :percent="percent"
      :color="color"
      :track-color="trackColor"
      :width="width"
      :steps="steps"
      :size="mergedSize"
      :show-text="showText"
    >
      <template v-if="$slots.text" #text="scope">
        <slot name="text" v-bind="scope"></slot>
      </template>
    </progress-steps>
    <progress-line
      v-else-if="type === 'line' && mergedSize !== 'mini'"
      :stroke-width="strokeWidth"
      :animation="animation"
      :percent="percent"
      :color="color"
      :track-color="trackColor"
      :size="mergedSize"
      :buffer-color="bufferColor"
      :width="width"
      :show-text="showText"
      :status="computedStatus"
    >
      <template v-if="$slots.text" #text="scope">
        <slot name="text" v-bind="scope"></slot>
      </template>
    </progress-line>
    <progress-circle
      v-else
      :type="type"
      :stroke-width="type === 'line' ? strokeWidth || 4 : strokeWidth"
      :path-stroke-width="type === 'line' ? strokeWidth || 4 : strokeWidth"
      :width="width"
      :percent="percent"
      :color="color"
      :track-color="trackColor"
      :size="mergedSize"
      :show-text="showText"
      :status="computedStatus"
    >
      <template v-if="$slots.text" #text="scope">
        <slot name="text" v-bind="scope"></slot>
      </template>
    </progress-circle>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType, toRefs } from 'vue';
import ProgressLine from './line.vue';
import ProgressCircle from './circle.vue';
import ProgressSteps from './steps.vue';
import { Size, Status } from '../_utils/constant';
import { getPrefixCls } from '../_utils/global-config';
import { useSize } from '../_hooks/use-size';

const PROGRESS_TYPES = ['line', 'circle'] as const;
type ProgressType = typeof PROGRESS_TYPES[number];

export default defineComponent({
  name: 'Progress',
  components: {
    ProgressLine,
    ProgressCircle,
    ProgressSteps,
  },
  props: {
    /**
     * @zh ??????????????????
     * @en The type of progress bar
     * @values 'line', 'circle'
     */
    type: {
      type: String as PropType<ProgressType>,
      default: 'line',
    },
    /**
     * @zh ??????????????????
     * @en The size of the progress bar
     * @values 'mini','small','medium','large'
     * @defaultValue 'medium'
     */
    size: {
      type: String as PropType<Size>,
    },
    /**
     * @zh ???????????????????????????
     * @en The current percentage of the progress bar
     */
    percent: {
      type: Number,
      default: 0,
    },
    /**
     * @zh ??????????????????????????????????????????
     * @en Turn on the step bar mode and set the number of steps
     */
    steps: {
      type: Number,
      default: 0,
    },
    /**
     * @zh ????????????????????????
     * @en Whether to turn on the transition animation
     */
    animation: {
      type: Boolean,
      default: false,
    },
    /**
     * @zh ??????????????????
     * @en The line width of the progress bar
     */
    strokeWidth: {
      type: Number,
    },
    /**
     * @zh ??????????????????
     * @en The width of the progress bar
     */
    width: {
      type: [Number, String],
    },
    /**
     * @zh ??????????????????
     * @en The color of the progress bar
     */
    color: {
      type: [String, Object],
    },
    /**
     * @zh ????????????????????????
     * @en The color of the progress track
     */
    trackColor: String,
    bufferColor: {
      type: [String, Object],
    },

    /**
     * @zh ??????????????????
     * @en Whether to display text
     */
    showText: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ???????????????
     * @en Progress bar status
     * @values 'normal', 'success', 'warning', 'danger'
     */
    status: {
      type: String as PropType<Status>,
    },
    /**
     * @zh ??????
     * @en Text
     * @slot text
     */
  },
  setup(props) {
    const prefixCls = getPrefixCls('progress');
    const { size } = toRefs(props);
    const type = computed(() => (props.steps > 0 ? 'steps' : props.type));
    const computedStatus = computed(() => {
      return props.status || (props.percent >= 1 ? 'success' : 'normal');
    });
    const { mergedSize } = useSize(size);

    const cls = computed(() => [
      prefixCls,
      `${prefixCls}-type-${type.value}`,
      `${prefixCls}-size-${mergedSize.value}`,
      `${prefixCls}-status-${computedStatus.value}`,
    ]);

    return {
      cls,
      computedStatus,
      mergedSize,
    };
  },
});
</script>
