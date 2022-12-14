<template>
  <Trigger
    v-if="!hideTrigger"
    trigger="click"
    animation-name="slide-dynamic-origin"
    auto-fit-transform-origin
    :click-to-close="false"
    :popup-offset="4"
    v-bind="triggerProps"
    :position="position"
    :disabled="mergedDisabled || readonly"
    :prevent-focus="true"
    :popup-visible="panelVisible"
    :unmount-on-close="unmountOnClose"
    :popup-container="popupContainer"
    @popupVisibleChange="onPanelVisibleChange"
  >
    <slot>
      <DateInput
        v-bind="$attrs"
        ref="refInput"
        :size="size"
        :focused="panelVisible"
        :visible="panelVisible"
        :error="error"
        :disabled="mergedDisabled"
        :readonly="!inputEditable"
        :allow-clear="allowClear && !readonly"
        :placeholder="computedPlaceholder"
        :input-value="inputValue"
        :value="needConfirm ? panelValue : selectedValue"
        :format="inputFormat"
        @clear="onInputClear"
        @change="onInputChange"
        @pressEnter="onInputPressEnter"
      >
        <template #suffix-icon>
          <slot name="suffix-icon">
            <IconCalendar />
          </slot>
        </template>
      </DateInput>
    </slot>
    <template #content>
      <PickerPanel v-bind="panelProps" @click="onPanelClick" />
    </template>
  </Trigger>
  <PickerPanel v-else v-bind="{ ...$attrs, ...panelProps }" />
</template>

<script lang="ts">
import { Dayjs } from 'dayjs';
import {
  computed,
  defineComponent,
  PropType,
  reactive,
  ref,
  toRefs,
  watch,
  watchEffect,
  onUnmounted,
} from 'vue';
import {
  dayjs,
  getNow,
  isValueChange,
  getDateValue,
  initializeDateLocale,
} from '../_utils/date';
import { getPrefixCls } from '../_utils/global-config';
import useState from '../_hooks/use-state';
import {
  DisabledTimeProps,
  ShortcutType,
  FormatFunc,
  CalendarValue,
  WeekStart,
} from './interface';
import usePickerState from './hooks/use-picker-state';
import DateInput from '../_components/picker/input.vue';
import Trigger from '../trigger';
import { getFormattedValue, isValidInputValue } from '../time-picker/utils';
import PickerPanel from './picker-panel.vue';
import pick from '../_utils/pick';
import useFormat from './hooks/use-format';
import { isFunction, isBoolean } from '../_utils/is';
import { TimePickerProps } from '../time-picker/interface';
import IconCalendar from '../icon/icon-calendar';
import useIsDisabledDate from './hooks/use-is-disabled-date';
import useMergeState from '../_hooks/use-merge-state';
import useProvideDatePickerTransform from './hooks/use-provide-datepicker-transform';
import useHeaderValue from './hooks/use-header-value';
import { omit } from '../_utils/omit';
import useTimePickerValue from './hooks/use-time-picker-value';
import { mergeValueWithTime } from './utils';
import { Size } from '../_utils/constant';
import { useReturnValue } from './hooks/use-value-format';
import { useFormItem } from '../_hooks/use-form-item';
import { useI18n } from '../locale';

/**
 * @displayName Common
 * @noBrackets
 */
export default defineComponent({
  name: 'Picker',
  components: {
    DateInput,
    Trigger,
    PickerPanel,
    IconCalendar,
  },
  inheritAttrs: false,
  props: {
    /**
     * @zh ??????????????????????????????locale?????? `datePicker` ??????
     * @en Internationalization configuration, used to cover the locale file in the `datePicker` field
     */
    locale: {
      type: Object as PropType<Record<string, any>>,
    },
    /**
     * @zh ??????????????????????????????????????????
     * @en There is no trigger element, only the selection panel is displayed
     * */
    hideTrigger: {
      type: Boolean,
    },
    /**
     * @zh ??????????????????
     * @en Whether to allow clear
     * */
    allowClear: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ???????????????
     * @en Whether it is read-only
     * */
    readonly: {
      type: Boolean,
    },
    /**
     * @zh ?????????????????????
     * @en Whether it is an error state
     */
    error: {
      type: Boolean,
    },
    /**
     * @zh ????????????????????????
     * @en The size of the date picker
     * @values 'mini','small','medium','large'
     * @defaultValue 'medium'
     * */
    size: {
      type: String as PropType<Size>,
    },
    /**
     * @zh ??????????????????????????????
     * @en Quick selection of preset time range
     */
    shortcuts: {
      type: Array as PropType<ShortcutType[]>,
      default: () => [],
    },
    /**
     * @zh ??????????????????????????????????????????????????????????????????????????????????????????????????????
     * @en The position of the preset range on the panel, which is placed at the bottom by default, and the side is generally used for scenes with a large number of preset times
     * */
    shortcutsPosition: {
      type: String as PropType<'left' | 'bottom' | 'right'>,
      default: 'bottom',
    },
    /**
     * @zh ?????????????????????
     * @en The position of the pop-up box
     */
    position: {
      type: String as PropType<'top' | 'tl' | 'tr' | 'bottom' | 'bl' | 'br'>,
      default: 'bl',
    },
    /**
     * @zh ??????????????????????????????????????????
     * @en Control the open or closed state of the pop-up box
     */
    popupVisible: {
      type: Boolean,
      default: undefined,
    },
    /**
     * @zh ????????????????????????????????????
     * @en The default pop-up box is open or closed
     */
    defaultPopupVisible: {
      type: Boolean,
      default: false,
    },
    /**
     * @zh ???????????? `Trigger` ???????????????
     * @en You can pass in the parameters of the `Trigger` component
     */
    triggerProps: {
      type: Object as PropType<Record<string, unknown>>,
    },
    /**
     * @zh ??????????????????????????????DOM??????
     * @en Whether to destroy the DOM structure when hiding
     */
    unmountOnClose: {
      type: Boolean,
    },
    /**
     * @zh ????????????
     * @en Prompt copy
     */
    placeholder: {
      type: String,
    },
    /**
     * @zh ????????????
     * @en Whether to disable
     */
    disabled: {
      type: Boolean,
    },
    /**
     * @zh ?????????????????????
     * @en Unselectable date
     */
    disabledDate: {
      type: Function as PropType<(current?: Date) => boolean>,
    },
    /**
     * @zh ?????????????????????
     * @en Unselectable time
     */
    disabledTime: {
      type: Function as PropType<(current: Date) => DisabledTimeProps>,
    },
    /**
     * @zh ?????????????????????
     * @en Date displayed on the panel
     * @vModel
     */
    pickerValue: {
      type: [Object, String, Number] as PropType<Date | string | number>,
    },
    /**
     * @zh ???????????????????????????
     * @en The date displayed on the panel by default
     */
    defaultPickerValue: {
      type: [Object, String, Number] as PropType<Date | string | number>,
    },
    /**
     * @zh ????????????????????????
     * @en Mount container for pop-up box
     */
    popupContainer: {
      type: [String, Object] as PropType<
        string | HTMLElement | null | undefined
      >,
    },
    mode: {
      type: String as PropType<'date' | 'year' | 'quarter' | 'month' | 'week'>,
      default: 'date',
    },
    format: {
      type: [String, Function] as PropType<string | FormatFunc>,
    },
    /**
     * @zh ?????????????????? `value` `defaultValue` `pickerValue` `defaultPickerValue` ???????????????????????????????????????????????????????????????Date ?????????????????????[?????????????????????](#?????????????????????)??????????????????????????????????????????????????????????????? `format`???
     * @en The format of the value, valid for `value` `defaultValue` `pickerValue` `defaultPickerValue` and the return value in the event, supports setting as timestamp, Date and string (refer to [String parsing format](#string-parsing-format) ). If not specified, it will be formatted as a string, in the same format as `format`.
     * @version 2.16.0
     */
    valueFormat: {
      type: String as PropType<'timestamp' | 'Date' | string>,
    },
    /**
     * @zh ????????????????????????????????????
     * @en Whether to preview the result of the shortcut
     * @version 2.28.0
     */
    previewShortcut: {
      type: Boolean,
      default: true,
    },
    /**
     * @zh ???????????????????????????`showTime = true` ????????????????????????
     * @en Whether to show the confirm button, always show when `showTime = true`.
     * @version 2.29.0
     */
    showConfirmBtn: {
      type: Boolean,
    },
    showTime: {
      type: Boolean,
    },
    timePickerProps: {
      type: Object as PropType<Partial<TimePickerProps>>,
    },
    showNowBtn: {
      type: Boolean,
      default: true,
    },
    dayStartOfWeek: {
      type: Number as PropType<WeekStart>,
      default: 0,
    },
    modelValue: {
      type: [Object, String, Number] as PropType<Date | string | number>,
    },
    defaultValue: {
      type: [Object, String, Number] as PropType<Date | string | number>,
    },
  },
  emits: {
    /**
     * @zh ?????????????????????
     * @en The component value changes
     * @param {Date | string | number | undefined} value
     * @param {Date | undefined} date
     * @param {string | undefined} dateString
     */
    'change': (
      value: CalendarValue | undefined,
      date: Date | undefined,
      dateString: string | undefined
    ) => true,
    'update:modelValue': (value: CalendarValue | undefined) => true,
    /**
     * @zh ?????????????????????????????????????????????
     * @en The selected date has changed but the component value has not changed
     * @param {Date | string | number} value
     * @param {Date} date
     * @param {string} dateString
     */
    'select': (
      value: CalendarValue | undefined,
      date: Date | undefined,
      dateString: string | undefined
    ) => true,
    /**
     * @zh ????????????????????????
     * @en Open or close the pop-up box
     * @param {boolean} visible
     */
    'popup-visible-change': (visible: boolean) => true,
    'update:popupVisible': (visible: boolean) => true,
    /**
     * @zh ??????????????????
     * @en Click the confirm button
     * @param {Date | string | number} value
     * @param {Date} date
     * @param {string} dateString
     */
    'ok': (
      value: CalendarValue | undefined,
      date: Date | undefined,
      dateString: string | undefined
    ) => true,
    /**
     * @zh ??????????????????
     * @en Click the clear button
     */
    'clear': () => true,
    /**
     * @zh ??????????????????
     * @en Click on the shortcut option
     * @param {ShortcutType} shortcut
     */
    'select-shortcut': (shortcut: ShortcutType) => true,
    /**
     * @zh ??????????????????
     * @en Panel date change
     * @param {Date | string | number} value
     * @param {Date} date
     * @param {string} dateString
     */
    'picker-value-change': (
      value: CalendarValue,
      date: Date,
      dateString: string
    ) => true,
    'update:pickerValue': (value: CalendarValue) => true,
  },
  /**
   * @zh ?????????????????????
   * @en Input box suffix icon
   * @slot suffix-icon
   */
  /**
   * @zh ???????????????
   * @en Extra footer
   * @slot extra
   */
  /**
   * @zh ?????????????????????????????????
   * @en Customize the contents of the date cell
   * @slot cell
   * @binding {Date} date
   */
  /**
   * @zh ???????????????????????????
   * @en Single arrow page forward icon
   * @slot icon-prev
   */
  /**
   * @zh ???????????????????????????
   * @en Single arrow page backward icon
   * @slot icon-next
   */
  /**
   * @zh ???????????????????????????
   * @en Double arrow page forward icon
   * @slot icon-prev-double
   */
  /**
   * @zh ???????????????????????????
   * @en Double arrow page backward icon
   * @slot icon-next-double
   */
  setup(props, { emit, slots }) {
    const {
      mode,
      modelValue,
      defaultValue,
      format,
      valueFormat,
      placeholder,
      popupVisible,
      defaultPopupVisible,
      disabled,
      showTime,
      timePickerProps,
      disabledDate,
      disabledTime,
      readonly,
      locale,
      pickerValue,
      defaultPickerValue,
      dayStartOfWeek,
      previewShortcut,
      showConfirmBtn,
    } = toRefs(props);

    const { locale: globalLocal } = useI18n();
    watchEffect(() => {
      initializeDateLocale(globalLocal.value, dayStartOfWeek.value);
    });

    const { mergedDisabled, eventHandlers } = useFormItem({ disabled });

    const datePickerT = useProvideDatePickerTransform(
      reactive({
        locale,
      })
    );

    const prefixCls = getPrefixCls('picker');

    const refInput = ref();

    const computedPlaceholder = computed(
      () =>
        placeholder?.value ||
        {
          date: datePickerT('datePicker.placeholder.date'),
          month: datePickerT('datePicker.placeholder.month'),
          year: datePickerT('datePicker.placeholder.year'),
          week: datePickerT('datePicker.placeholder.week'),
          quarter: datePickerT('datePicker.placeholder.quarter'),
        }[mode.value] ||
        datePickerT('datePicker.placeholder.date')
    );

    const {
      format: computedFormat,
      valueFormat: returnValueFormat,
      parseValueFormat,
    } = useFormat(reactive({ format, mode, showTime, valueFormat }));

    const inputFormat = computed(() =>
      format && isFunction(format.value)
        ? (value: Dayjs) => (format.value as FormatFunc)?.(getDateValue(value))
        : computedFormat.value
    );

    const getReturnValue = useReturnValue(
      reactive({
        format: returnValueFormat,
      })
    );

    const isDisabledDate = useIsDisabledDate(
      reactive({
        mode,
        disabledDate,
        disabledTime,
        showTime,
      })
    );

    const needConfirm = computed(() => showTime.value || showConfirmBtn.value);
    const confirmBtnDisabled = computed(
      () =>
        needConfirm.value &&
        (!forSelectedValue.value || isDisabledDate(forSelectedValue.value))
    );

    const isDateTime = computed(() => mode.value === 'date' && showTime.value);

    // ??????????????????
    const { value: selectedValue, setValue: setSelectedValue } = usePickerState(
      reactive({
        modelValue,
        defaultValue,
        format: parseValueFormat,
      })
    );
    // ???????????????????????????
    const [processValue, setProcessValue] = useState<Dayjs | undefined>();
    // ???????????????
    const [previewValue, setPreviewValue] = useState<Dayjs | undefined>();
    // ???????????????
    const forSelectedValue = computed(
      () => processValue.value ?? selectedValue.value
    );
    // panel ???????????????
    const panelValue = computed(
      () => previewValue.value ?? processValue.value ?? selectedValue.value
    );

    // input ??????????????????
    const [inputValue, setInputValue] = useState<string | undefined>();

    // ????????????????????????
    const [panelVisible, setLocalPanelVisible] = useMergeState(
      defaultPopupVisible.value,
      reactive({ value: popupVisible })
    );
    const setPanelVisible = (newVisible: boolean) => {
      if (panelVisible.value !== newVisible) {
        setLocalPanelVisible(newVisible);
        emit('popup-visible-change', newVisible);
        emit('update:popupVisible', newVisible);
      }
    };

    // ????????????????????????
    const { headerValue, setHeaderValue, headerOperations, resetHeaderValue } =
      useHeaderValue(
        reactive({
          mode,
          value: pickerValue,
          defaultValue: defaultPickerValue,
          selectedValue: panelValue,
          format: parseValueFormat,
          onChange: (newVal: Dayjs) => {
            const returnValue = getReturnValue(newVal);
            const formattedValue = getFormattedValue(
              newVal,
              parseValueFormat.value
            );
            const dateValue = getDateValue(newVal);
            emit('picker-value-change', returnValue, dateValue, formattedValue);
            emit('update:pickerValue', returnValue);
          },
        })
      );

    const [timePickerValue, , resetTimePickerValue] = useTimePickerValue(
      reactive({
        timePickerProps,
        selectedValue: panelValue,
      })
    );

    const inputEditable = computed(
      () => !readonly.value && !isFunction(inputFormat.value)
    );

    const headerMode = ref<'year' | 'month' | undefined>();

    watch(panelVisible, (newVisible) => {
      setProcessValue(undefined);
      setPreviewValue(undefined);
      headerMode.value = undefined;

      // open
      if (newVisible) {
        resetHeaderValue();
        resetTimePickerValue();
      }

      // close
      if (!newVisible) {
        setInputValue(undefined);
      }
    });

    function emitChange(value: Dayjs | undefined, emitOk?: boolean) {
      const returnValue = value ? getReturnValue(value) : undefined;
      const formattedValue = getFormattedValue(value, parseValueFormat.value);
      const dateValue = getDateValue(value);
      if (isValueChange(value, selectedValue.value)) {
        emit('update:modelValue', returnValue);
        emit('change', returnValue, dateValue, formattedValue);
        eventHandlers.value?.onChange?.();
      }

      if (emitOk) {
        emit('ok', returnValue, dateValue, formattedValue);
      }
    }

    function confirm(
      value: Dayjs | undefined,
      showPanel?: boolean,
      emitOk?: boolean
    ) {
      if (isDisabledDate(value)) {
        return;
      }

      emitChange(value, emitOk);
      setSelectedValue(value);
      setProcessValue(undefined);
      setPreviewValue(undefined);
      setInputValue(undefined);
      headerMode.value = undefined;
      if (isBoolean(showPanel)) {
        setPanelVisible(showPanel);
      }
    }

    function select(value: Dayjs | undefined, emitSelect?: boolean) {
      setProcessValue(value);
      setPreviewValue(undefined);
      setInputValue(undefined);
      headerMode.value = undefined;

      if (emitSelect) {
        const returnValue = value ? getReturnValue(value) : undefined;
        const formattedValue = getFormattedValue(value, parseValueFormat.value);
        const dateValue = getDateValue(value);
        emit('select', returnValue, dateValue, formattedValue);
      }
    }

    function focusInput(index?: number) {
      refInput.value && refInput.value.focus && refInput.value.focus(index);
    }

    function getMergedOpValue(date: Dayjs, time?: Dayjs) {
      if (!isDateTime.value && !timePickerProps.value) return date;
      return mergeValueWithTime(getNow(), date, time);
    }

    function onPanelVisibleChange(visible: boolean) {
      if (mergedDisabled.value) return;
      setPanelVisible(visible);
    }

    function onInputClear(e: Event) {
      e.stopPropagation();
      confirm(undefined);
      emit('clear');
    }

    function onInputChange(e: any) {
      setPanelVisible(true);

      const targetValue = e.target.value;
      setInputValue(targetValue);

      if (!isValidInputValue(targetValue, computedFormat.value)) return;

      const newValue = dayjs(targetValue, computedFormat.value);

      if (isDisabledDate(newValue)) return;

      if (needConfirm.value) {
        select(newValue);
      } else {
        confirm(newValue, true);
      }
    }

    function onInputPressEnter() {
      confirm(panelValue.value, false);
    }

    function onPanelSelect(value: Dayjs) {
      if (needConfirm.value) {
        select(value, true);
      } else {
        confirm(value, false);
      }
    }

    function onPanelCellClick(value: Dayjs) {
      const newValue = getMergedOpValue(value, timePickerValue.value);
      onPanelSelect(newValue);
    }

    function onTimePickerSelect(time: Dayjs) {
      const newValue = getMergedOpValue(panelValue.value || getNow(), time);
      onPanelSelect(newValue);
    }

    function onPanelConfirm() {
      confirm(panelValue.value, false, true);
    }

    function onPanelClick() {
      focusInput();
    }

    let clearPreviewTimer: any;
    onUnmounted(() => {
      clearTimeout(clearPreviewTimer);
    });

    function onPanelShortcutMouseEnter(value: Dayjs) {
      clearTimeout(clearPreviewTimer);
      setPreviewValue(value);
      setInputValue(undefined);
    }

    function onPanelShortcutMouseLeave() {
      clearTimeout(clearPreviewTimer);
      clearPreviewTimer = setTimeout(() => {
        setPreviewValue(undefined);
      }, 100);
    }

    function onPanelShortcutClick(value: Dayjs, shortcut: ShortcutType) {
      emit('select-shortcut', shortcut);
      confirm(value, false);
    }

    function onPanelHeaderLabelClick(type: 'year' | 'month') {
      headerMode.value = type;
    }

    function onMonthHeaderClick() {
      headerMode.value = 'year';
    }

    function onPanelHeaderSelect(date: Dayjs) {
      let newValue = headerValue.value;
      newValue = newValue.set('year', date.year());
      if (headerMode.value === 'month') {
        newValue = newValue.set('month', date.month());
      }
      setHeaderValue(newValue);
      if (mode.value === 'quarter' || mode.value === 'month') {
        // ???????????????????????????????????????????????????headerMode
        headerMode.value = undefined;
        return;
      }
      headerMode.value = headerMode.value === 'year' ? 'month' : undefined; // ????????????????????????
    }

    const computedTimePickerProps = computed(() => ({
      format: computedFormat.value,
      ...omit(timePickerProps?.value || {}, ['defaultValue']),
      visible: panelVisible.value,
    }));

    const panelProps = computed(() => ({
      ...pick(props, [
        'mode',
        'shortcuts',
        'shortcutsPosition',
        'dayStartOfWeek',
        'disabledDate',
        'disabledTime',
        'showTime',
        'hideTrigger',
      ]),
      showNowBtn: props.showNowBtn && mode.value === 'date',
      prefixCls,
      format: parseValueFormat.value,
      value: panelValue.value,
      visible: panelVisible.value,
      showConfirmBtn: needConfirm.value,
      confirmBtnDisabled: confirmBtnDisabled.value,
      timePickerProps: computedTimePickerProps.value,
      extra: slots.extra,
      dateRender: slots.cell,
      headerValue: headerValue.value,
      headerIcons: {
        prev: slots['icon-prev'],
        prevDouble: slots['icon-prev-double'],
        next: slots['icon-next'],
        nextDouble: slots['icon-next-double'],
      },
      headerOperations: headerOperations.value,
      timePickerValue: timePickerValue.value,
      headerMode: headerMode.value,
      onCellClick: onPanelCellClick,
      onTimePickerSelect,
      onConfirm: onPanelConfirm,
      onShortcutClick: onPanelShortcutClick,
      onShortcutMouseEnter: previewShortcut.value
        ? onPanelShortcutMouseEnter
        : undefined,
      onShortcutMouseLeave: previewShortcut.value
        ? onPanelShortcutMouseLeave
        : undefined,
      onTodayBtnClick: onPanelSelect,
      onHeaderLabelClick: onPanelHeaderLabelClick,
      onHeaderSelect: onPanelHeaderSelect,
      onMonthHeaderClick,
    }));

    return {
      prefixCls,
      refInput,
      panelProps,
      panelValue,
      inputValue,
      selectedValue,
      inputFormat,
      computedPlaceholder,
      panelVisible,
      inputEditable,
      needConfirm,
      mergedDisabled,
      onPanelVisibleChange,
      onInputClear,
      onInputChange,
      onInputPressEnter,
      onPanelClick,
    };
  },
});
</script>
