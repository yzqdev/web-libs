<template>
  <div :class="wrapperClassNames" :style="wrapperStyles">
    <img
      ref="refImg"
      :class="`${prefixCls}-img`"
      v-bind="imgProps"
      :style="{ ...imgStyle, ...fitStyle }"
      :title="title"
      :alt="alt"
      @load="onImgLoaded"
      @error="onImgLoadError"
      @click="onImgClick"
    />
    <div v-if="!isLoaded" :class="`${prefixCls}-overlay`">
      <slot v-if="isError" name="error">
        <div :class="`${prefixCls}-error`">
          <div :class="`${prefixCls}-error-icon`">
            <slot name="error-icon">
              <IconImageClose />
            </slot>
          </div>
          <div :class="`${prefixCls}-error-alt`">{{ alt || description }}</div>
        </div>
      </slot>
      <slot v-if="isLoading && (showLoader || $slots.loader)" name="loader">
        <div :class="[`${prefixCls}-loader`]">
          <div :class="`${prefixCls}-loader-spin`">
            <IconLoading />
            <div :class="`${prefixCls}-loader-spin-text`">
              {{ t('image.loading') }}
            </div>
          </div>
        </div>
      </slot>
    </div>
    <ImageFooter
      v-if="showFooter"
      :class="footerClass"
      :prefix-cls="prefixCls"
      :title="title"
      :description="description"
    >
      <template v-if="$slots.extra" #extra>
        <slot name="extra" />
      </template>
    </ImageFooter>
    <ImagePreview
      v-if="isLoaded && mergePreview"
      :src="src"
      v-bind="previewProps"
      :visible="mergedPreviewVisible"
      :render-to-body="renderToBody"
      @close="onPreviewClose"
    >
      <template #actions>
        <slot name="preview-actions" />
      </template>
    </ImagePreview>
  </div>
</template>
<script lang="ts">
import {
  defineComponent,
  PropType,
  toRefs,
  computed,
  watchEffect,
  ref,
  reactive,
  inject,
  StyleValue,
  CSSProperties,
} from 'vue';
import type { ImagePreviewProps } from './interface';
import IconImageClose from '../icon/icon-image-close';
import IconLoading from '../icon/icon-loading';
import ImageFooter from './image-footer.vue';
import ImagePreview from './preview.vue';
import { getPrefixCls } from '../_utils/global-config';
import useImageLoadState from './hooks/use-image-load-status';
import { isServerRendering } from '../_utils/dom';
import { normalizeImageSizeProp } from './utils';
import { omit } from '../_utils/omit';
import useMergeState from '../_hooks/use-merge-state';
import { PreviewGroupInjectionKey } from './context';
import { useI18n } from '../locale';
import { isBoolean } from '../_utils/is';

let uuid = 0;

export default defineComponent({
  name: 'Image',
  components: {
    IconImageClose,
    IconLoading,
    ImageFooter,
    ImagePreview,
  },
  inheritAttrs: false,
  props: {
    renderToBody: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ??????????????????
     * @en Image src
     */
    src: {
      type: String,
    },
    /**
     * @zh ??????????????????
     * @en Image width
     */
    width: {
      type: [String, Number] as PropType<string | number>,
    },
    /**
     * @zh ??????????????????
     * @en Image height
     */
    height: {
      type: [String, Number] as PropType<string | number>,
    },
    /**
     * @zh ??????
     * @en Title
     */
    title: {
      type: String,
    },
    /**
     * @zh ???????????????????????????????????? alt ????????????????????????????????? alt
     * @en Description, will be displayed at the bottom. if alt has no value, it will be set to alt
     */
    description: {
      type: String,
    },
    /**
     * @zh ?????????????????????????????????
     * @en indicate how the image should be resized to fit its container
     */
    fit: {
      type: String as PropType<
        'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
      >,
    },
    /**
     * @zh ?????????????????????
     * @en Text description of the image
     */
    alt: {
      type: String,
    },
    /**
     * @zh ???????????? footer???2.36.0 ???????????? 'never' ??????????????????????????????????????????????????????
     * @en Whether to hide footer (Version 2.36.0 supports the 'never' parameter, which supports displaying bottom content when loading errors)
     */
    hideFooter: {
      type: [Boolean, String] as PropType<boolean | 'never'>,
      default: false,
    },
    /**
     * @zh ?????????????????????
     * @en The position shown at the bottom
     */
    footerPosition: {
      type: String as PropType<'inner' | 'outer'>,
      default: 'inner',
    },
    /**
     * @zh ???????????????????????????
     * @en Whether to show the loading effect
     */
    showLoader: {
      type: Boolean,
      default: false,
    },
    /**
     * @zh ??????????????????
     * @en Whether to enable preview
     */
    preview: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ???????????????????????????????????? previewVisibleChange ????????????
     * @en Control the open state of the preview, can be used in conjunction with previewVisibleChange
     * @vModel
     */
    previewVisible: {
      type: Boolean,
      default: undefined,
    },
    /**
     * @zh ???????????????????????????
     * @en The default open state of the preview
     */
    defaultPreviewVisible: {
      type: Boolean,
      default: false,
    },
    /**
     * @zh ??????????????????????????????????????????????????? [ImagePreviewProps](#image-preview%20Props)
     * @en Preview configuration items (all options are optional) [ImagePreviewProps](#image-preview%20Props)
     */
    previewProps: {
      type: Object as PropType<ImagePreviewProps>,
    },
    /**
     * @zh ???????????????????????????
     * @en The class name of the bottom display area
     * @version 2.23.0
     */
    footerClass: {
      type: [String, Array, Object],
    },
  },
  emits: [
    /**
     * @zh ??????????????????????????????
     * @en Preview opening and closing events
     * @param {boolean} visible
     */
    'preview-visible-change',
    'update:previewVisible',
  ],
  /**
   * @zh ??????????????????????????????
   * @en Customize the icon of error content.
   * @slot error-icon
   */
  /**
   * @zh ???????????????????????????
   * @en Customize error content.
   * @slot error
   */
  /**
   * @zh ???????????????????????????
   * @en Customize loading effect.
   * @slot loader
   */
  /**
   * @zh ??????????????????
   * @en Extra content at the bottom
   * @slot extra
   */
  setup(props, { attrs, slots, emit }) {
    const { t } = useI18n();
    const {
      height,
      width,
      hideFooter,
      title,
      description,
      src,
      footerPosition,
      defaultPreviewVisible,
      previewVisible,
      preview,
      previewProps,
    } = toRefs(props);

    const groupContext = inject(PreviewGroupInjectionKey, undefined);

    const prefixCls = getPrefixCls('image');

    const refImg = ref();

    const { isLoaded, isError, isLoading, setLoadStatus } = useImageLoadState();

    const sizeStyle = computed(() => ({
      width: normalizeImageSizeProp(width?.value),
      height: normalizeImageSizeProp(height?.value),
    }));

    const fitStyle = computed<CSSProperties>(() => {
      if (props.fit) {
        return { objectFit: props.fit };
      }
      return {};
    });

    const wrapperClassNames = computed(() => [
      `${prefixCls}`,
      {
        [`${prefixCls}-loading`]: isLoading.value,
        [`${prefixCls}-loading-error`]: isError.value,
        [`${prefixCls}-with-footer-inner`]:
          isLoaded && showFooter && footerPosition.value === 'inner',
        [`${prefixCls}-with-footer-outer`]:
          isLoaded && showFooter && footerPosition.value === 'outer',
      },
      attrs.class,
    ]);

    const wrapperStyles = computed<StyleValue[]>(() => [
      sizeStyle.value,
      attrs.style as StyleValue,
    ]);

    const showFooter = computed(() => {
      if (!(title?.value || description?.value || slots.extra)) {
        return false;
      }
      if (isBoolean(hideFooter.value))
        return !hideFooter.value && isLoaded.value;
      return hideFooter.value === 'never';
    });

    const imgProps = computed(() => omit(attrs, ['class', 'style']));

    const [mergedPreviewVisible, setPreviewVisible] = useMergeState(
      defaultPreviewVisible.value,
      reactive({
        value: previewVisible,
      })
    );

    const mergePreview = computed(
      () => !groupContext?.preview && preview.value
    );

    watchEffect(() => {
      if (isServerRendering || !refImg.value) return;
      refImg.value.src = src?.value;
      setLoadStatus('loading');
    });

    const imageId = uuid++;
    watchEffect((onInvalidate) => {
      const unRegister = groupContext?.registerImageUrl?.(
        imageId,
        (previewProps?.value?.src ?? src?.value) || '',
        preview.value
      );
      onInvalidate(() => {
        unRegister?.();
      });
    });

    function onImgLoaded() {
      setLoadStatus('loaded');
    }

    function onImgLoadError() {
      setLoadStatus('error');
    }

    function onImgClick() {
      if (!preview.value) return;
      if (groupContext?.preview) {
        groupContext.preview(imageId);
      } else {
        emit('preview-visible-change', true);
        setPreviewVisible(true);
      }
    }

    function onPreviewClose() {
      emit('preview-visible-change', false);
      setPreviewVisible(false);
    }

    return {
      t,
      refImg,
      prefixCls,
      wrapperClassNames,
      wrapperStyles,
      showFooter,
      imgProps,
      imgStyle: sizeStyle.value,
      isLoaded,
      isError,
      isLoading,
      mergedPreviewVisible,
      mergePreview,
      onImgLoaded,
      onImgLoadError,
      onImgClick,
      onPreviewClose,
      fitStyle,
    };
  },
});
</script>
