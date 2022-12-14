<template>
  <client-only>
    <teleport :to="teleportContainer" :disabled="!renderToBody">
      <div
        v-if="!unmountOnClose || computedVisible || mounted"
        v-show="computedVisible || mounted"
        :class="`${prefixCls}-container`"
        :style="{ zIndex }"
        v-bind="$attrs"
      >
        <transition :name="maskAnimationName" appear>
          <div
            v-if="mask"
            v-show="computedVisible"
            ref="maskRef"
            :class="`${prefixCls}-mask`"
            :style="maskStyle"
          />
        </transition>
        <div
          ref="wrapperRef"
          :class="wrapperCls"
          @click.self="handleMaskClick"
          @mousedown.self="handleMaskMouseDown"
        >
          <transition
            :name="modalAnimationName"
            appear
            @after-enter="handleOpen"
            @after-leave="handleClose"
          >
            <div
              v-show="computedVisible"
              ref="modalRef"
              :class="modalCls"
              :style="mergedModalStyle"
            >
              <div
                v-if="$slots.title || title || closable"
                :class="`${prefixCls}-header`"
                @mousedown="handleMoveDown"
              >
                <div
                  v-if="$slots.title || title"
                  :class="[
                    `${prefixCls}-title`,
                    `${prefixCls}-title-align-${titleAlign}`,
                  ]"
                >
                  <div v-if="messageType" :class="`${prefixCls}-title-icon`">
                    <icon-info-circle-fill v-if="messageType === 'info'" />
                    <icon-check-circle-fill v-if="messageType === 'success'" />
                    <icon-exclamation-circle-fill
                      v-if="messageType === 'warning'"
                    />
                    <icon-close-circle-fill v-if="messageType === 'error'" />
                  </div>
                  <slot name="title">{{ title }}</slot>
                </div>
                <div
                  v-if="!simple && closable"
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
              </div>
              <div :class="[`${prefixCls}-body`, bodyClass]" :style="bodyStyle">
                <slot />
              </div>
              <div v-if="footer" :class="`${prefixCls}-footer`">
                <slot name="footer">
                  <arco-button
                    v-if="!hideCancel"
                    v-bind="cancelButtonProps"
                    @click="handleCancel"
                  >
                    {{ cancelDisplayText }}
                  </arco-button>
                  <arco-button
                    type="primary"
                    v-bind="okButtonProps"
                    :loading="mergedOkLoading"
                    @click="handleOk"
                  >
                    {{ okDisplayText }}
                  </arco-button>
                </slot>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </teleport>
  </client-only>
</template>

<script lang="tsx">
import type { CSSProperties, PropType, StyleValue } from 'vue';
import {
  defineComponent,
  computed,
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
  toRefs,
} from 'vue';
import { getPrefixCls } from '../_utils/global-config';
import { MessageType } from '../_utils/constant';
import ClientOnly from '../_components/client-only';
import IconHover from '../_components/icon-hover.vue';
import ArcoButton from '../button';
import IconClose from '../icon/icon-close';
import IconInfoCircleFill from '../icon/icon-info-circle-fill';
import IconCheckCircleFill from '../icon/icon-check-circle-fill';
import IconExclamationCircleFill from '../icon/icon-exclamation-circle-fill';
import IconCloseCircleFill from '../icon/icon-close-circle-fill';
import { useI18n } from '../locale';
import { useOverflow } from '../_hooks/use-overflow';
import { getElement, off, on, contains } from '../_utils/dom';
import usePopupManager from '../_hooks/use-popup-manager';
import { isBoolean, isFunction, isNumber, isPromise } from '../_utils/is';
import { KEYBOARD_KEY } from '../_utils/keyboard';
import { useDraggable } from './hooks/use-draggable';
import { useTeleportContainer } from '../_hooks/use-teleport-container';

export default defineComponent({
  name: 'Modal',
  components: {
    ClientOnly,
    ArcoButton,
    IconHover,
    IconClose,
    IconInfoCircleFill,
    IconCheckCircleFill,
    IconExclamationCircleFill,
    IconCloseCircleFill,
  },
  inheritAttrs: false,
  props: {
    /**
     * @zh ?????????????????????
     * @en Whether the modal is visible
     * @vModel
     */
    visible: {
      type: Boolean,
      default: undefined,
    },
    /**
     * @zh ????????????????????????????????????????????????
     * @en Whether the modal is visible by default (uncontrolled state)
     */
    defaultVisible: {
      type: Boolean,
      default: false,
    },
    /**
     * @zh ????????????????????????????????????????????????????????????????????????
     * @en The width of the dialog box, if not set, the width value in the style will be used
     * @version 2.12.0
     */
    width: {
      type: [Number, String],
    },
    /**
     * @zh ???????????????????????????????????????????????????????????????????????????
     * @en The height from the top of the dialog box. It does not take effect when the center display is turned on.
     * @version 2.12.0
     */
    top: {
      type: [Number, String],
    },
    /**
     * @zh ?????????????????????
     * @en Whether to show the mask
     */
    mask: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ??????
     * @en Title
     */
    title: {
      type: String,
    },
    /**
     * @zh ???????????????????????????
     * @en horizontal alignment of the title
     * @version 2.17.0
     */
    titleAlign: {
      type: String as PropType<'start' | 'center'>,
      default: 'center',
    },
    /**
     * @zh ???????????????????????????
     * @en Whether the dialog box is displayed in the center
     */
    alignCenter: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ???????????????????????????
     * @en Whether to uninstall the node when close
     */
    unmountOnClose: Boolean,
    /**
     * @zh ??????????????????????????????????????????
     * @en Whether to close the modal when click the mask
     */
    maskClosable: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ????????????????????????
     * @en Whether to hide the cancel button
     */
    hideCancel: {
      type: Boolean,
      default: false,
    },
    /**
     * @zh ????????????????????????
     * @en Whether to enable simple mode
     */
    simple: {
      type: Boolean,
      default: (props: any) => {
        return props.notice;
      },
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
     * @en The content of the confirm button
     */
    okText: String,
    /**
     * @zh ?????????????????????
     * @en The content of the cancel button
     */
    cancelText: String,
    /**
     * @zh ????????????????????????????????????
     * @en Whether the confirm button is in the loading state
     */
    okLoading: {
      type: Boolean,
      default: false,
    },
    /**
     * @zh ???????????????Props
     * @en Props of confirm button
     */
    okButtonProps: {
      type: Object,
    },
    /**
     * @zh ???????????????Props
     * @en Props of cancel button
     */
    cancelButtonProps: {
      type: Object,
    },
    /**
     * @zh ????????????????????????
     * @en Whether to show the footer
     */
    footer: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ???????????????????????? `body` ?????????
     * @en Whether the modal is mounted under the `body` element
     */
    renderToBody: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ????????????????????????
     * @en Mount container for modal
     */
    popupContainer: {
      type: [String, Object] as PropType<string | HTMLElement>,
      default: 'body',
    },
    /**
     * @zh ???????????????
     * @en Mask style
     */
    maskStyle: {
      type: Object as PropType<CSSProperties>,
    },
    /**
     * @zh ??????????????????
     * @en The classname of the modal
     */
    modalClass: {
      type: [String, Array] as PropType<string | any[]>,
    },
    /**
     * @zh ??????????????????
     * @en Modal style
     */
    modalStyle: {
      type: Object as PropType<CSSProperties>,
    },
    /**
     * @zh ?????? ok ??????????????????????????????????????? false ?????????????????????????????????????????? done ?????????????????????
     * @en The callback function before the ok event is triggered. If false is returned, subsequent events will not be triggered, and done can also be used to close asynchronously.
     * @version 2.7.0
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
     * @version 2.7.0
     */
    onBeforeCancel: {
      type: Function as PropType<() => boolean>,
    },
    /**
     * @zh ???????????? ESC ??????????????????
     * @en Whether to support the ESC key to close the dialog
     * @version 2.15.0
     */
    escToClose: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ??????????????????
     * @en Whether to support drag
     * @version 2.19.0
     */
    draggable: {
      type: Boolean,
      default: false,
    },
    /**
     * @zh ??????????????????
     * @en Whether to enable full screen
     * @version 2.19.0
     */
    fullscreen: {
      type: Boolean,
      default: false,
    },
    /**
     * @zh ?????????????????????
     * @en Mask layer animation name
     * @defaultValue -
     * @version 2.24.0
     */
    maskAnimationName: {
      type: String,
      default: (props: Record<string, any>) => {
        if (props.fullscreen) {
          return 'fade-in-standard';
        }
        return 'fade-modal';
      },
    },
    /**
     * @zh ?????????????????????
     * @en Modal animation name
     * @defaultValue -
     * @version 2.24.0
     */
    modalAnimationName: {
      type: String,
      default: (props: Record<string, any>) => {
        if (props.fullscreen) {
          return 'zoom-in';
        }
        return 'zoom-modal';
      },
    },
    /**
     * @zh ??????????????????????????????
     * @en The classname of the modal
     * @version 2.31.0
     */
    bodyClass: {
      type: [String, Array] as PropType<string | any[]>,
    },
    /**
     * @zh ??????????????????????????????
     * @en Modal style
     * @version 2.31.0
     */
    bodyStyle: {
      type: [String, Object, Array] as PropType<StyleValue>,
    },
    // private
    messageType: {
      type: String as PropType<MessageType>,
    },
  },
  emits: [
    'update:visible',
    /**
     * @zh ???????????????????????????
     * @en Triggered when the OK button is clicked
     */
    'ok',
    /**
     * @zh ????????????????????????????????????
     * @en Triggered when the cancel/close button is clicked
     */
    'cancel',
    /**
     * @zh ??????????????????????????????????????????
     * @en Triggered after the modal is opened (the animation ends)
     */
    'open',
    /**
     * @zh ??????????????????????????????????????????
     * @en Triggered after the modal is closed (the animation ends)
     */
    'close',
    /**
     * @zh ????????????????????????
     * @en Triggered before dialog is opened
     * @version 2.16.0
     */
    'beforeOpen',
    /**
     * @zh ????????????????????????
     * @en Triggered before dialog is closed
     * @version 2.16.0
     */
    'beforeClose',
  ],
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
  setup(props, { emit }) {
    const { fullscreen, popupContainer } = toRefs(props);
    const prefixCls = getPrefixCls('modal');
    const { t } = useI18n();
    const wrapperRef = ref<HTMLElement>();
    const modalRef = ref<HTMLElement>();

    const _visible = ref(props.defaultVisible);
    const computedVisible = computed(() => props.visible ?? _visible.value);
    const _okLoading = ref(false);
    const mergedOkLoading = computed(() => props.okLoading || _okLoading.value);
    const mergedDraggable = computed(
      () => props.draggable && !props.fullscreen
    );

    const { teleportContainer, containerRef } = useTeleportContainer({
      popupContainer,
      visible: computedVisible,
    });

    const mounted = ref(computedVisible.value);

    const okDisplayText = computed(() => props.okText || t('modal.okText'));
    const cancelDisplayText = computed(
      () => props.cancelText || t('modal.cancelText')
    );

    const { zIndex, isLastDialog } = usePopupManager('dialog', {
      visible: computedVisible,
    });

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
      globalKeyDownListener = false;
      off(document.documentElement, 'keydown', handleGlobalKeyDown);
    };

    // Used to ignore closed Promises
    let promiseNumber = 0;

    const { position, handleMoveDown } = useDraggable({
      wrapperRef,
      modalRef,
      draggable: mergedDraggable,
    });

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

    const currentIsMask = ref(false);

    const handleMaskMouseDown = (ev: Event) => {
      if (ev.target === wrapperRef.value) {
        currentIsMask.value = true;
      }
    };

    const handleMaskClick = () => {
      if (props.mask && props.maskClosable && currentIsMask.value) {
        handleCancel();
      }
    };

    const handleOpen = () => {
      if (computedVisible.value) {
        if (
          !contains(wrapperRef.value, document.activeElement) &&
          document.activeElement instanceof HTMLElement
        ) {
          document.activeElement.blur();
        }
        emit('open');
      }
    };

    const handleClose = () => {
      if (!computedVisible.value) {
        if (mergedDraggable.value) {
          position.value = undefined;
        }

        mounted.value = false;
        resetOverflow();
        emit('close');
      }
    };

    const { setOverflowHidden, resetOverflow } = useOverflow(containerRef);

    onMounted(() => {
      containerRef.value = getElement(props.popupContainer);
      if (computedVisible.value) {
        setOverflowHidden();
        if (props.escToClose) {
          addGlobalKeyDownListener();
        }
      }
    });

    onBeforeUnmount(() => {
      resetOverflow();
      removeGlobalKeyDownListener();
    });

    watch(computedVisible, (value: boolean) => {
      if (_visible.value !== value) {
        _visible.value = value;
      }
      if (value) {
        emit('beforeOpen');
        mounted.value = true;
        currentIsMask.value = false;
        setOverflowHidden();
        addGlobalKeyDownListener();
      } else {
        emit('beforeClose');
        removeGlobalKeyDownListener();
      }
    });

    watch(fullscreen, () => {
      if (position.value) {
        position.value = undefined;
      }
    });

    const wrapperCls = computed(() => [
      `${prefixCls}-wrapper`,
      {
        [`${prefixCls}-wrapper-align-center`]:
          props.alignCenter && !props.fullscreen,
        [`${prefixCls}-wrapper-moved`]: Boolean(position.value),
      },
    ]);

    const modalCls = computed(() => [
      `${prefixCls}`,
      props.modalClass,
      {
        [`${prefixCls}-simple`]: props.simple,
        [`${prefixCls}-draggable`]: mergedDraggable.value,
        [`${prefixCls}-fullscreen`]: props.fullscreen,
      },
    ]);

    const mergedModalStyle = computed(() => {
      const style: CSSProperties = {
        ...(props.modalStyle ?? {}),
      };
      if (props.width) {
        style.width = isNumber(props.width) ? `${props.width}px` : props.width;
      }
      if (!props.alignCenter && props.top) {
        style.top = isNumber(props.top) ? `${props.top}px` : props.top;
      }
      if (position.value) {
        style.transform = `translate(${position.value[0]}px, ${position.value[1]}px)`;
      }

      return style;
    });

    return {
      prefixCls,
      mounted,
      computedVisible,
      containerRef,
      wrapperRef,
      mergedModalStyle,
      okDisplayText,
      cancelDisplayText,
      zIndex,
      handleOk,
      handleCancel,
      handleMaskClick,
      handleMaskMouseDown,
      handleOpen,
      handleClose,
      mergedOkLoading,
      modalRef,
      wrapperCls,
      modalCls,
      teleportContainer,
      handleMoveDown,
    };
  },
});
</script>
