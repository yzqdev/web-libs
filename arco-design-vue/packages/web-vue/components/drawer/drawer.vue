<template>
  <client-only>
    <teleport :to="teleportContainer" :disabled="!renderToBody">
      <div
        v-if="!unmountOnClose || computedVisible || mounted"
        v-show="computedVisible || mounted"
        :class="`${prefixCls}-container`"
        :style="
          isFixed ? { zIndex } : { zIndex: 'inherit', position: 'absolute' }
        "
        v-bind="$attrs"
      >
        <transition name="fade-drawer" appear>
          <div
            v-if="mask"
            v-show="computedVisible"
            :class="`${prefixCls}-mask`"
            @click="handleMask"
          />
        </transition>
        <transition
          :name="`slide-${placement}-drawer`"
          appear
          @after-enter="handleOpen"
          @after-leave="handleClose"
        >
          <div v-show="computedVisible" :class="prefixCls" :style="style">
            <div v-if="header" :class="`${prefixCls}-header`">
              <slot name="header">
                <div v-if="$slots.title || title" :class="`${prefixCls}-title`">
                  <slot name="title">{{ title }}</slot>
                </div>
                <div
                  v-if="closable"
                  tabindex="-1"
                  role="button"
                  aria-label="Close"
                  :class="`${prefixCls}-close-btn`"
                  @click="handleCancel"
                >
                  <icon-hover>
                    <icon-close />
                  </icon-hover>
                </div>
              </slot>
            </div>
            <div :class="`${prefixCls}-body`">
              <slot />
            </div>
            <div v-if="footer" :class="`${prefixCls}-footer`">
              <slot name="footer">
                <arco-button
                  v-if="!hideCancel"
                  v-bind="cancelButtonProps"
                  @click="handleCancel"
                >
                  {{ cancelText || t('drawer.cancelText') }}
                </arco-button>
                <arco-button
                  type="primary"
                  :loading="mergedOkLoading"
                  v-bind="okButtonProps"
                  @click="handleOk"
                >
                  {{ okText || t('drawer.okText') }}
                </arco-button>
              </slot>
            </div>
          </div>
        </transition>
      </div>
    </teleport>
  </client-only>
</template>

<script lang="ts">
import type { CSSProperties, PropType } from 'vue';
import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  toRefs,
  watch,
} from 'vue';
import { getPrefixCls } from '../_utils/global-config';
import ClientOnly from '../_components/client-only';
import ArcoButton from '../button';
import IconHover from '../_components/icon-hover.vue';
import IconClose from '../icon/icon-close';
import { useI18n } from '../locale';
import { useOverflow } from '../_hooks/use-overflow';
import { off, on } from '../_utils/dom';
import usePopupManager from '../_hooks/use-popup-manager';
import { isBoolean, isFunction, isNumber, isPromise } from '../_utils/is';
import { KEYBOARD_KEY } from '../_utils/keyboard';
import { useTeleportContainer } from '../_hooks/use-teleport-container';

const DRAWER_PLACEMENTS = ['top', 'right', 'bottom', 'left'] as const;
type DrawerPlacements = typeof DRAWER_PLACEMENTS[number];

export default defineComponent({
  name: 'Drawer',
  components: {
    ClientOnly,
    ArcoButton,
    IconHover,
    IconClose,
  },
  inheritAttrs: false,
  props: {
    /**
     * @zh ??????????????????
     * @en Whether the drawer is visible
     * @vModel
     */
    visible: {
      type: Boolean,
      default: false,
    },
    /**
     * @zh ?????????????????????????????????????????????
     * @en Whether the drawer is visible by default (uncontrolled mode)
     */
    defaultVisible: {
      type: Boolean,
      default: false,
    },
    /**
     * @zh ?????????????????????
     * @en Where the drawer is placed
     * @values 'top','right','bottom','left'
     */
    placement: {
      type: String as PropType<DrawerPlacements>,
      default: 'right',
      validator: (value: any) => DRAWER_PLACEMENTS.includes(value),
    },
    /**
     * @zh ??????
     * @en Title
     */
    title: String,
    /**
     * @zh ?????????????????????
     * @en Whether to show the mask
     */
    mask: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ?????????????????????????????????
     * @en Click on the mask layer to be able to close
     */
    maskClosable: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ????????????????????????
     * @en Whether to show the close button
     */
    closable: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ?????????????????????
     * @en The content of the ok button
     */
    okText: String,
    /**
     * @zh ?????????????????????
     * @en The content of the cancel button
     */
    cancelText: String,
    /**
     * @zh ????????????????????????????????????
     * @en Whether the ok button is in the loading state
     */
    okLoading: {
      type: Boolean,
      default: false,
    },
    /**
     * @zh ???????????????Props
     * @en Props of confirm button
     * @version 2.9.0
     */
    okButtonProps: {
      type: Object,
    },
    /**
     * @zh ???????????????Props
     * @en Props of cancel button
     * @version 2.9.0
     */
    cancelButtonProps: {
      type: Object,
    },
    /**
     * @zh ???????????????????????????
     * @en Whether to uninstall the node when close
     * @version 2.12.0
     */
    unmountOnClose: Boolean,
    /**
     * @zh ????????????????????????placement???right,left????????????
     * @en The width of the drawer (only available when placement is right, left)
     */
    width: {
      type: [Number, String],
      default: 250,
    },
    /**
     * @zh ????????????????????????placement???top,bottom????????????
     * @en The height of the drawer (only available when placement is top, bottom)
     */
    height: {
      type: [Number, String],
      default: 250,
    },
    /**
     * @zh ????????????????????????
     * @en Mount container for popup
     */
    popupContainer: {
      type: [String, Object] as PropType<string | HTMLElement>,
      default: 'body',
    },
    /**
     * @zh ???????????????
     * @en Drawer style
     */
    drawerStyle: {
      type: Object as PropType<CSSProperties>,
    },
    /**
     * @zh ?????? ok ??????????????????????????????????????? false ?????????????????????????????????????????? done ?????????????????????
     * @en The callback function before the ok event is triggered. If false is returned, subsequent events will not be triggered, and done can also be used to close asynchronously.
     */
    onBeforeOk: {
      type: Function as PropType<
        (
          done: (closed: boolean) => void
        ) => void | boolean | Promise<void | boolean>
      >,
    },
    /**
     * @zh ?????? cancel ??????????????????????????????????????? false ??????????????????????????????
     * @en The callback function before the cancel event is triggered. If it returns false, no subsequent events will be triggered.
     */
    onBeforeCancel: {
      type: Function as PropType<() => boolean>,
    },
    /**
     * @zh ???????????? ESC ???????????????
     * @en Whether to support the ESC key to close the dialog
     * @version 2.15.0
     */
    escToClose: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ????????????????????? `body` ?????????
     * @en Whether the drawer is mounted under the `body` element
     */
    renderToBody: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ????????????????????????
     * @en Whether to display high-quality content
     * @version 2.33.0
     */
    header: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ????????????????????????
     * @en Whether to display the bottom content
     * @version 2.11.0
     */
    footer: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ????????????????????????
     * @en Whether to hide the cancel button
     * @version 2.19.0
     */
    hideCancel: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    'update:visible': (visible: boolean) => true,
    /**
     * @zh ???????????????????????????
     * @en Triggered when the OK button is clicked
     */
    'ok': () => true,
    /**
     * @zh ????????????????????????????????????
     * @en Triggered when the cancel or close button is clicked
     */
    'cancel': () => true,
    /**
     * @zh ???????????????????????????????????????
     * @en Triggered after the drawer is opened (the animation ends)
     */
    'open': () => true,
    /**
     * @zh ???????????????????????????????????????
     * @en Triggered when the drawer is closed (the animation ends)
     */
    'close': () => true,
  },
  /**
   * @zh ??????
   * @en Title
   * @slot title
   */
  /**
   * @zh ??????
   * @en Footer
   * @slot footer
   */
  /**
   * @zh ??????
   * @en Header
   * @slot header
   * @version 2.33.0
   */
  setup(props, { emit }) {
    const { popupContainer } = toRefs(props);
    const prefixCls = getPrefixCls('drawer');
    const { t } = useI18n();

    const _visible = ref(props.defaultVisible);
    const computedVisible = computed(() => props.visible ?? _visible.value);
    const _okLoading = ref(false);
    const mergedOkLoading = computed(() => props.okLoading || _okLoading.value);

    const { teleportContainer, containerRef } = useTeleportContainer({
      popupContainer,
      visible: computedVisible,
    });

    const mounted = ref(computedVisible.value);

    let globalKeyDownListener = false;

    const handleGlobalKeyDown = (ev: KeyboardEvent) => {
      if (props.escToClose && ev.key === KEYBOARD_KEY.ESC && isLastDialog()) {
        handleCancel();
      }
    };

    const addGlobalKeyDownListener = () => {
      if (props.escToClose && !globalKeyDownListener) {
        globalKeyDownListener = true;
        on(document.documentElement, 'keydown', handleGlobalKeyDown);
      }
    };

    const removeGlobalKeyDownListener = () => {
      if (globalKeyDownListener) {
        globalKeyDownListener = false;
        off(document.documentElement, 'keydown', handleGlobalKeyDown);
      }
    };

    const { zIndex, isLastDialog } = usePopupManager('dialog', {
      visible: computedVisible,
    });
    const isFixed = computed(() => {
      return containerRef?.value === document.body;
    });

    // Used to ignore closed Promises
    let promiseNumber = 0;

    const close = () => {
      promiseNumber++;
      if (_okLoading.value) {
        _okLoading.value = false;
      }
      _visible.value = false;
      emit('update:visible', false);
    };

    const handleOk = async () => {
      const currentPromiseNumber = promiseNumber;
      const closed = await new Promise<boolean>(
        // eslint-disable-next-line no-async-promise-executor
        async (resolve) => {
          if (isFunction(props.onBeforeOk)) {
            let result = props.onBeforeOk((closed = true) => resolve(closed));
            if (isPromise(result) || !isBoolean(result)) {
              _okLoading.value = true;
            }
            if (isPromise(result)) {
              try {
                // if onBeforeOk is Promise<void> ,set Defaults true
                result = (await result) ?? true;
              } catch (error) {
                result = false;
              }
            }
            if (isBoolean(result)) {
              resolve(result);
            }
          } else {
            resolve(true);
          }
        }
      );

      if (currentPromiseNumber === promiseNumber) {
        if (closed) {
          emit('ok');
          close();
        } else if (_okLoading.value) {
          _okLoading.value = false;
        }
      }
    };

    const handleCancel = () => {
      let result = true;
      if (isFunction(props.onBeforeCancel)) {
        result = props.onBeforeCancel() ?? false;
      }
      if (result) {
        emit('cancel');
        close();
      }
    };

    const handleMask = () => {
      if (props.maskClosable) {
        handleCancel();
      }
    };

    const handleOpen = () => {
      if (computedVisible.value) {
        emit('open');
      }
    };

    const handleClose = () => {
      if (!computedVisible.value) {
        mounted.value = false;
        resetOverflow();
        emit('close');
      }
    };

    const { setOverflowHidden, resetOverflow } = useOverflow(containerRef);

    onMounted(() => {
      if (computedVisible.value) {
        mounted.value = true;
        setOverflowHidden();
        addGlobalKeyDownListener();
      }
    });

    onBeforeUnmount(() => {
      resetOverflow();
      removeGlobalKeyDownListener();
    });

    watch(computedVisible, (visible) => {
      if (_visible.value !== visible) {
        _visible.value = visible;
      }
      if (visible) {
        mounted.value = true;
        setOverflowHidden();
        addGlobalKeyDownListener();
      } else {
        removeGlobalKeyDownListener();
      }
    });

    const style = computed(() => {
      const style: CSSProperties = {
        [props.placement]: 0,
        ...(props.drawerStyle ?? {}),
      };
      if (['right', 'left'].includes(props.placement)) {
        style.width = isNumber(props.width) ? `${props.width}px` : props.width;
      } else {
        style.height = isNumber(props.height)
          ? `${props.height}px`
          : props.height;
      }
      return style;
    });

    return {
      prefixCls,
      style,
      t,
      mounted,
      computedVisible,
      mergedOkLoading,
      zIndex,
      handleOk,
      handleCancel,
      handleOpen,
      handleClose,
      handleMask,
      isFixed,
      teleportContainer,
    };
  },
});
</script>
