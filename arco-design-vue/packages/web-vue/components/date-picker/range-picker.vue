<template>
  <Trigger
    v-if="!hideTrigger"
    trigger="click"
    animation-name="slide-dynamic-origin"
    auto-fit-transform-origin
    :click-to-close="false"
    :popup-offset="4"
    v-bind="triggerProps"
    :unmount-on-close="unmountOnClose"
    :position="position"
    :disabled="triggerDisabled || readonly"
    :popup-visible="panelVisible"
    :popup-container="popupContainer"
    @popupVisibleChange="onPanelVisibleChange"
  >
    <slot>
      <DateRangeInput
        ref="refInput"
        v-bind="$attrs"
        v-model:focusedIndex="focusedIndex"
        :size="size"
        :focused="panelVisible"
        :visible="panelVisible"
        :error="error"
        :disabled="disabled"
        :readonly="readonly"
        :allow-clear="allowClear && !readonly"
        :placeholder="computedPlaceholder"
        :input-value="inputValue"
        :value="panelValue"
        :format="computedFormat"
        @clear="onInputClear"
        @change="onInputChange"
        @pressEnter="onInputPressEnter"
      >
        <template #suffix-icon>
          <slot name="suffix-icon">
            <IconCalendar />
          </slot>
        </template>
        <template #separator>
          <slot name="separator">
            {{ separator || '-' }}
          </slot>
        </template>
      </DateRangeInput>
    </slot>
    <template #content>
      <RangePickerPanel v-bind="rangePanelProps" />
    </template>
  </Trigger>
  <RangePickerPanel v-else v-bind="{ ...$attrs, ...rangePanelProps }" />
</template>
<script lang="ts">
import { Dayjs } from 'dayjs';
import {
  computed,
  defineComponent,
  nextTick,
  onUnmounted,
  PropType,
  reactive,
  ref,
  toRefs,
  watch,
  watchEffect,
} from 'vue';
import { TimePickerProps } from '../time-picker/interface';
import {
  DisabledTimeProps,
  ShortcutType,
  CalendarValue,
  WeekStart,
  Mode,
} from './interface';
import { getPrefixCls } from '../_utils/global-config';
import { isArray, isBoolean } from '../_utils/is';
import pick from '../_utils/pick';
import { getFormattedValue, isValidInputValue } from '../time-picker/utils';
import {
  getSortedDayjsArray,
  isValueChange,
  dayjs,
  getNow,
  getDateValue,
  initializeDateLocale,
} from '../_utils/date';
import useState from '../_hooks/use-state';
import {
  isCompleteRangeValue,
  isValidRangeValue,
  mergeValueWithTime,
} from './utils';
import useFormat from './hooks/use-format';
import useRangePickerState from './hooks/use-range-picker-state';
import useRangeHeaderValue from './hooks/use-range-header-value';
import Trigger from '../trigger';
import DateRangeInput from '../_components/picker/input-range.vue';
import RangePickerPanel from './range-picker-panel.vue';
import useRangeTimePickerValue from './hooks/use-range-time-picker-value';
import useIsDisabledDate from './hooks/use-is-disabled-date';
import { omit } from '../_utils/omit';
import useMergeState from '../_hooks/use-merge-state';
import IconCalendar from '../icon/icon-calendar';
import useProvideDatePickerTransform from './hooks/use-provide-datepicker-transform';
import { EmitType } from '../_utils/types';
import { getReturnRangeValue } from './hooks/use-value-format';
import { Size } from '../_utils/constant';
import { useFormItem } from '../_hooks/use-form-item';
import { useI18n } from '../locale';

export default defineComponent({
  name: 'RangePicker',
  components: {
    RangePickerPanel,
    DateRangeInput,
    Trigger,
    IconCalendar,
  },
  inheritAttrs: false,
  props: {
    /**
     * @zh ????????????????????????
     * @en Type of range selector
     * */
    mode: {
      type: String as PropType<'date' | 'year' | 'quarter' | 'month' | 'week'>,
      default: 'date',
    },
    /**
     * @zh ?????????
     * @en Value
     */
    modelValue: {
      type: Array as PropType<(Date | string | number)[]>,
    },
    /**
     * @zh ?????????
     * @en Default value
     */
    defaultValue: {
      type: Array as PropType<(Date | string | number)[]>,
    },
    /**
     * @zh ???????????????????????????
     * @en The date displayed in the default panel
     * */
    pickerValue: {
      type: Array as PropType<(Date | string | number)[]>,
    },
    /**
     * @zh ?????????????????????
     * @en Date displayed on the panel
     * */
    defaultPickerValue: {
      type: Array as PropType<(Date | string | number)[]>,
    },
    /**
     * @zh ????????????
     * @en Whether to disable
     * */
    disabled: {
      type: [Boolean, Array] as PropType<boolean | boolean[]>,
      default: false,
    },
    /**
     * @zh ????????????????????????????????????0 - ?????????1 - ????????????????????????
     * @en The first day of the week starts on the day of the week, 0-Sunday, 1-Monday, and so on.
     * @type 0 | 1 | 2 | 3 | 4 | 5 | 6
     * @version 2-6 from 2.21.0
     */
    dayStartOfWeek: {
      type: Number as PropType<WeekStart>,
      default: 0,
    },
    /**
     * @zh ??????????????????????????????[?????????????????????](#?????????????????????)
     * @en Display the format of the date, refer to [String Parsing Format](#string-parsing-format)
     * */
    format: {
      type: String,
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
     * @zh ????????????????????????
     * @en Whether to increase time selection
     * */
    showTime: {
      type: Boolean,
    },
    /**
     * @zh ?????????????????????????????? [TimePickerProps](/vue/component/time-picker)
     * @en Time display parameters, refer to [TimePickerProps](/vue/component/time-picker)
     * */
    timePickerProps: {
      type: Object as PropType<Partial<TimePickerProps>>,
    },
    /**
     * @zh ????????????
     * @en Prompt copy
     * */
    placeholder: {
      type: Array as PropType<string[]>,
    },
    /**
     * @zh ??????????????????
     * @en Non-selectable date
     * */
    disabledDate: {
      type: Function as PropType<
        (current: Date, type: 'start' | 'end') => boolean
      >,
    },
    /**
     * @zh ?????????????????????
     * @en Unselectable time
     * */
    disabledTime: {
      type: Function as PropType<
        (current: Date, type: 'start' | 'end') => DisabledTimeProps
      >,
    },
    /**
     * @zh ??????????????????????????????????????????
     * @en The segmentation symbol in the input box of the range selector
     * */
    separator: {
      type: String,
    },
    /**
     * @zh ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
     * @en Whether the time will be exchanged, by default time will affect and participate in the ordering of start and end values, if you want to fix the time order, you can turn it off.
     * @version 2.25.0
     * */
    exchangeTime: {
      type: Boolean,
      default: true,
    },
    popupContainer: {
      type: [String, Object] as PropType<
        string | HTMLElement | null | undefined
      >,
    },
    locale: {
      type: Object as PropType<Record<string, any>>,
    },
    hideTrigger: {
      type: Boolean,
    },
    allowClear: {
      type: Boolean,
      default: true,
    },
    readonly: {
      type: Boolean,
    },
    error: {
      type: Boolean,
    },
    size: {
      type: String as PropType<Size>,
    },
    shortcuts: {
      type: Array as PropType<ShortcutType[]>,
      default: () => [],
    },
    shortcutsPosition: {
      type: String as PropType<'left' | 'bottom' | 'right'>,
      default: 'bottom',
    },
    position: {
      type: String as PropType<'top' | 'tl' | 'tr' | 'bottom' | 'bl' | 'br'>,
      default: 'bl',
    },
    popupVisible: {
      type: Boolean,
      default: undefined,
    },
    defaultPopupVisible: {
      type: Boolean,
    },
    triggerProps: {
      type: Object as PropType<Record<string, unknown>>,
    },
    unmountOnClose: {
      type: Boolean,
    },
    previewShortcut: {
      type: Boolean,
      default: true,
    },
    showConfirmBtn: {
      type: Boolean,
    },
  },
  emits: {
    /**
     * @zh ?????????????????????
     * @en The component value changes
     * @param {(Date | string | number | undefined)[] | undefined} value
     * @param {(Date | undefined)[] | undefined} date
     * @param {(string | undefined)[] | undefined} dateString
     */
    'change': (
      value: (CalendarValue | undefined)[] | undefined,
      date: (Date | undefined)[] | undefined,
      dateString: (string | undefined)[] | undefined
    ) => {
      return true;
    },
    'update:modelValue': (value: (CalendarValue | undefined)[] | undefined) => {
      return true;
    },
    /**
     * @zh ?????????????????????????????????????????????
     * @en The selected date has changed but the component value has not changed
     * @param {(Date | string | number | undefined)[]} value
     * @param {(Date | undefined)[]} date
     * @param {(string | undefined)[]} dateString
     */
    'select': (
      value: (CalendarValue | undefined)[],
      date: (Date | undefined)[],
      dateString: (string | undefined)[]
    ) => {
      return true;
    },
    /**
     * @zh ????????????????????????
     * @en Open or close the pop-up box
     * @param {boolean} visible
     */
    'popup-visible-change': (visible: boolean) => {
      return true;
    },
    'update:popupVisible': (visible: boolean) => {
      return true;
    },
    /**
     * @zh ??????????????????
     * @en Click the confirm button
     * @param {Date | string | number[]} value
     * @param {Date[]} date
     * @param {string[]} dateString
     */
    'ok': (value: CalendarValue[], date: Date[], dateString: string[]) => {
      return true;
    },
    /**
     * @zh ??????????????????
     * @en Click the clear button
     */
    'clear': () => {
      return true;
    },
    /**
     * @zh ??????????????????
     * @en Click on the shortcut option
     * @param {ShortcutType} shortcut
     */
    'select-shortcut': (shortcut: ShortcutType) => {
      return true;
    },
    /**
     * @zh ??????????????????
     * @en Panel date change
     * @param {Date | string | number[]} value
     * @param {Date[]} date
     * @param {string[]} dateString
     */
    'picker-value-change': (
      value: CalendarValue[],
      date: Date[],
      dateString: string[]
    ) => {
      return true;
    },
    'update:pickerValue': (value: CalendarValue[]) => {
      return true;
    },
  },
  setup(props, { emit, slots }) {
    const {
      mode,
      showTime,
      format,
      modelValue,
      defaultValue,
      popupVisible,
      defaultPopupVisible,
      placeholder,
      timePickerProps,
      disabled,
      disabledDate,
      disabledTime,
      locale,
      pickerValue,
      defaultPickerValue,
      valueFormat,
      size,
      error,
      dayStartOfWeek,
      exchangeTime,
      previewShortcut,
      showConfirmBtn,
    } = toRefs(props);

    const { locale: globalLocal } = useI18n();
    watchEffect(() => {
      initializeDateLocale(globalLocal.value, dayStartOfWeek.value);
    });

    const {
      mergedSize,
      mergedDisabled: formDisabled,
      mergedError,
      eventHandlers,
    } = useFormItem({
      size,
      error,
    });

    const datePickerT = useProvideDatePickerTransform(
      reactive({
        locale,
      })
    );

    const prefixCls = getPrefixCls('picker');

    const computedPlaceholder = computed(
      () =>
        placeholder?.value ||
        ({
          date: datePickerT('datePicker.rangePlaceholder.date'),
          month: datePickerT('datePicker.rangePlaceholder.month'),
          year: datePickerT('datePicker.rangePlaceholder.year'),
          week: datePickerT('datePicker.rangePlaceholder.week'),
          quarter: datePickerT('datePicker.rangePlaceholder.quarter'),
        }[mode.value] as unknown as string[]) ||
        (datePickerT('datePicker.rangePlaceholder.date') as unknown as string[])
    );

    const {
      format: computedFormat,
      valueFormat: returnValueFormat,
      parseValueFormat,
    } = useFormat(
      reactive({
        mode,
        format,
        showTime,
        valueFormat,
      })
    );

    const disabledArray = computed(() => {
      const disabled0 =
        disabled.value === true ||
        formDisabled.value ||
        (isArray(disabled.value) && disabled.value[0] === true);
      const disabled1 =
        disabled.value === true ||
        formDisabled.value ||
        (isArray(disabled.value) && disabled.value[1] === true);
      return [disabled0, disabled1];
    });

    const triggerDisabled = computed(
      () => disabledArray.value[0] && disabledArray.value[1]
    );

    function getFocusedIndex(cur = 0) {
      return disabledArray.value[cur] ? cur ^ 1 : cur;
    }

    const refInput = ref();
    const focusedIndex = ref(getFocusedIndex());
    const nextFocusedIndex = computed(() => {
      const cur = focusedIndex.value;
      const next = cur ^ 1;
      return disabledArray.value[next] ? cur : next;
    });
    const isNextDisabled = computed(
      () => disabledArray.value[focusedIndex.value ^ 1]
    );
    // ?????????
    const { value: selectedValue, setValue: setSelectedValue } =
      useRangePickerState(
        reactive({
          modelValue,
          defaultValue,
          format: parseValueFormat,
        })
      );
    // ?????????
    const [processValue, setProcessValue] = useState<
      Array<Dayjs | undefined> | undefined
    >();
    // ?????????
    const [previewValue, setPreviewValue] = useState<
      Array<Dayjs | undefined> | undefined
    >();
    // ?????????????????????
    const forSelectedValue = computed(
      () => processValue.value ?? selectedValue.value
    );
    // ??????????????????
    const panelValue = computed(
      () => previewValue.value ?? processValue.value ?? selectedValue.value
    );

    // input ????????????
    const [inputValue, setInputValue] = useState<
      Array<string | undefined> | undefined
    >();

    const startHeaderMode = ref<'year' | 'month' | undefined>();

    const endHeaderMode = ref<'year' | 'month' | undefined>();

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

    // headerValue is used to generate the content displayed on the panel
    const {
      startHeaderValue,
      endHeaderValue,
      startHeaderOperations,
      endHeaderOperations,
      resetHeaderValue,
      setHeaderValue,
    } = useRangeHeaderValue(
      reactive({
        mode,
        startHeaderMode,
        endHeaderMode,
        value: pickerValue,
        defaultValue: defaultPickerValue,
        selectedValue: panelValue,
        format: parseValueFormat,
        onChange: (newVal: Dayjs[]) => {
          const returnValue = getReturnRangeValue(
            newVal,
            returnValueFormat.value
          );
          const formattedValue = getFormattedValue(
            newVal,
            parseValueFormat.value
          ) as string[];
          const dateValue = getDateValue(newVal);
          emit('picker-value-change', returnValue, dateValue, formattedValue);
          emit('update:pickerValue', returnValue);
        },
      })
    );

    function onStartPanelHeaderLabelClick(type: 'year' | 'month') {
      startHeaderMode.value = type;
    }

    function onEndPanelHeaderLabelClick(type: 'year' | 'month') {
      endHeaderMode.value = type;
    }

    function onStartPanelHeaderSelect(date: Dayjs) {
      let newStartValue = startHeaderValue.value;
      newStartValue = newStartValue.set('year', date.year());
      if (startHeaderMode.value === 'month') {
        newStartValue = newStartValue.set('month', date.month());
      }
      setHeaderValue([newStartValue, endHeaderValue.value]);
      startHeaderMode.value = undefined;
    }

    function onEndPanelHeaderSelect(date: Dayjs) {
      let newEndValue = endHeaderValue.value;
      newEndValue = newEndValue.set('year', date.year());
      if (endHeaderMode.value === 'month') {
        newEndValue = newEndValue.set('month', date.month());
      }
      setHeaderValue([startHeaderValue.value, newEndValue]);
      endHeaderMode.value = undefined;
    }

    const footerValue = ref([
      panelValue.value[0] || getNow(),
      panelValue.value[1] || getNow(),
    ]);
    watch(panelValue, () => {
      const [value0, value1] = panelValue.value;
      footerValue.value[0] = value0 || footerValue.value[0];
      footerValue.value[1] = value1 || footerValue.value[1];
    });

    const [timePickerValue, setTimePickerValue, resetTimePickerValue] =
      useRangeTimePickerValue(
        reactive({
          timePickerProps,
          selectedValue: panelValue,
        })
      );

    const isDateTime = computed(() => mode.value === 'date' && showTime.value);
    const hasTime = computed(() => isDateTime.value || timePickerProps.value);

    const isDisabledDate = useIsDisabledDate(
      reactive({
        mode,
        isRange: true,
        showTime,
        disabledDate,
        disabledTime,
      })
    );

    // needConfirm logic
    const needConfirm = computed(
      () => isDateTime.value || showConfirmBtn.value
    );
    const confirmBtnDisabled = computed(
      () =>
        needConfirm.value &&
        (!isCompleteRangeValue(forSelectedValue.value) ||
          isDisabledDate(forSelectedValue.value[0], 'start') ||
          isDisabledDate(forSelectedValue.value[1], 'end'))
    );

    watch(panelVisible, (newVisible) => {
      if (mode.value === 'year') {
        startHeaderMode.value = 'year';
        endHeaderMode.value = 'year';
      } else {
        startHeaderMode.value = undefined;
        endHeaderMode.value = undefined;
      }

      setProcessValue(undefined);
      setPreviewValue(undefined);
      // open
      if (newVisible) {
        resetHeaderValue();
        resetTimePickerValue();
        focusedIndex.value = getFocusedIndex(focusedIndex.value);
        nextTick(() => focusInput(focusedIndex.value));
      }
      // close
      if (!newVisible) {
        setInputValue(undefined);
      }
    });

    watch(focusedIndex, () => {
      focusInput(focusedIndex.value);
      setInputValue(undefined);
    });

    function emitChange(
      value: Array<Dayjs | undefined> | undefined,
      emitOk?: boolean
    ) {
      const returnValue = value
        ? getReturnRangeValue(value, returnValueFormat.value)
        : undefined;
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
      value: Array<Dayjs | undefined> | undefined,
      showPanel?: boolean,
      emitOk?: boolean
    ) {
      if (
        isDisabledDate(value?.[0], 'start') ||
        isDisabledDate(value?.[1], 'end')
      ) {
        return;
      }

      let newValue = value ? [...value] : undefined;

      if (isCompleteRangeValue(newValue)) {
        let sortedValue = getSortedDayjsArray(newValue);
        if (hasTime.value && !exchangeTime.value) {
          sortedValue = [
            getMergedOpValue(sortedValue[0], newValue[0]),
            getMergedOpValue(sortedValue[1], newValue[1]),
          ];
        }
        newValue = sortedValue;
      }

      emitChange(newValue, emitOk);
      setSelectedValue(newValue || []);
      setProcessValue(undefined);
      setPreviewValue(undefined);
      setInputValue(undefined);
      startHeaderMode.value = undefined;
      endHeaderMode.value = undefined;

      if (isBoolean(showPanel)) {
        setPanelVisible(showPanel);
      }
    }

    function emitSelectEvent(value: Array<Dayjs | undefined>) {
      const returnValue = getReturnRangeValue(value, returnValueFormat.value);
      const formattedValue = getFormattedValue(value, parseValueFormat.value);
      const dateValue = getDateValue(value);
      emit('select', returnValue, dateValue, formattedValue);
    }

    function select(
      value: Array<Dayjs | undefined>,
      options?: {
        emitSelect?: boolean;
        updateHeader?: boolean;
      }
    ) {
      const { emitSelect = false, updateHeader = false } = options || {};

      let newValue = [...value];
      if (isCompleteRangeValue(newValue)) {
        newValue = getSortedDayjsArray(newValue);
      }

      setProcessValue(newValue);
      setPreviewValue(undefined);
      setInputValue(undefined);
      startHeaderMode.value = undefined;
      endHeaderMode.value = undefined;

      if (emitSelect) {
        emitSelectEvent(newValue);
      }

      if (updateHeader) {
        resetHeaderValue();
      }
    }

    function preview(
      value: Array<Dayjs | undefined>,
      options?: {
        emitSelect?: boolean;
        updateHeader?: boolean;
      }
    ) {
      const { updateHeader = false } = options || {};
      setPreviewValue(value);
      setInputValue(undefined);

      if (updateHeader) {
        resetHeaderValue();
      }
    }

    function focusInput(index?: number) {
      refInput.value && refInput.value.focus && refInput.value.focus(index);
    }

    function getMergedOpValue(date: Dayjs, time?: Dayjs) {
      if (!hasTime.value) return date;
      return mergeValueWithTime(getNow(), date, time);
    }

    function onPanelVisibleChange(visible: boolean) {
      setPanelVisible(visible);
    }

    function onPanelCellMouseEnter(date: Dayjs) {
      if (
        processValue.value &&
        panelValue.value[nextFocusedIndex.value] &&
        (!needConfirm.value || !isCompleteRangeValue(processValue.value))
      ) {
        const newValue = [...panelValue.value];
        const mergedOpValue = getMergedOpValue(
          date,
          timePickerValue.value[focusedIndex.value]
        );
        newValue[focusedIndex.value] = mergedOpValue;

        preview(newValue);
      }
    }

    function getValueToModify(isTime = false) {
      if (isNextDisabled.value) return [...selectedValue.value];
      if (processValue.value) {
        return isTime || !isCompleteRangeValue(processValue.value)
          ? [...processValue.value]
          : [];
      }
      return isTime ? [...selectedValue.value] : [];
    }

    function onPanelCellClick(date: Dayjs) {
      const newValue = getValueToModify();
      const mergedOpValue = getMergedOpValue(
        date,
        timePickerValue.value[focusedIndex.value]
      );
      newValue[focusedIndex.value] = mergedOpValue;

      emitSelectEvent(newValue);
      if (!needConfirm.value && isCompleteRangeValue(newValue)) {
        confirm(newValue, false);
      } else {
        select(newValue);
        if (!isCompleteRangeValue(newValue)) {
          focusedIndex.value = nextFocusedIndex.value;
        }
      }
    }

    function onTimePickerSelect(time: Dayjs, type: 'start' | 'end') {
      const updateIndex = type === 'start' ? 0 : 1;
      const mergedOpValue = getMergedOpValue(
        timePickerValue.value[updateIndex],
        time
      );
      const newTimeValue = [...timePickerValue.value];
      newTimeValue[updateIndex] = mergedOpValue;
      setTimePickerValue(newTimeValue);

      const newValue = getValueToModify(true);
      if (newValue[updateIndex]) {
        newValue[updateIndex] = mergedOpValue;
        select(newValue, { emitSelect: true });
      }
    }

    let clearShortcutPreviewTimer: any;
    onUnmounted(() => {
      clearTimeout(clearShortcutPreviewTimer);
    });

    function onPanelShortcutMouseEnter(value: Array<Dayjs | undefined>) {
      clearTimeout(clearShortcutPreviewTimer);
      preview(value, { updateHeader: true });
    }

    function onPanelShortcutMouseLeave() {
      clearTimeout(clearShortcutPreviewTimer);
      clearShortcutPreviewTimer = setTimeout(() => {
        setPreviewValue(undefined);
        setInputValue(undefined);
        resetHeaderValue();
      }, 100);
    }

    function onPanelShortcutClick(
      value: Array<Dayjs | undefined>,
      shortcut: ShortcutType
    ) {
      emit('select-shortcut', shortcut);
      confirm(value, false);
    }

    function onPanelConfirm() {
      confirm(panelValue.value, false, true);
    }

    function onInputClear(e: Event) {
      e.stopPropagation();
      confirm(undefined);
      emit('clear');
    }

    function onInputChange(e: any) {
      setPanelVisible(true);

      const targetValue = e.target.value;

      // TODO: Null value should be restored to the current value, invalid when deleted as a whole
      if (!targetValue) {
        setInputValue(undefined);
        return;
      }

      const formattedPanelValue = getFormattedValue(
        panelValue.value,
        computedFormat.value
      ) as Array<string | undefined>;

      const newInputValue = isArray(inputValue.value)
        ? [...inputValue.value]
        : formattedPanelValue || [];

      newInputValue[focusedIndex.value] = targetValue;

      setInputValue(newInputValue);

      if (!isValidInputValue(targetValue, computedFormat.value)) return;

      const targetValueDayjs = dayjs(targetValue, computedFormat.value);

      if (
        isDisabledDate(
          targetValueDayjs,
          focusedIndex.value === 0 ? 'start' : 'end'
        )
      )
        return;

      const newValue = isArray(panelValue.value) ? [...panelValue.value] : [];
      newValue[focusedIndex.value] = targetValueDayjs;

      select(newValue, { updateHeader: true });
    }

    function onInputPressEnter() {
      if (isValidRangeValue(panelValue.value)) {
        confirm(panelValue.value, false);
      } else {
        focusedIndex.value = nextFocusedIndex.value;
      }
    }

    const computedTimePickerProps = computed(() => ({
      format: computedFormat.value,
      ...omit(timePickerProps?.value || {}, ['defaultValue']),
      visible: panelVisible.value,
    }));

    const headerIcons = computed(() => ({
      prev: slots['icon-prev'],
      prevDouble: slots['icon-prev-double'],
      next: slots['icon-next'],
      nextDouble: slots['icon-next-double'],
    }));

    const startHeaderProps = reactive({
      headerValue: startHeaderValue,
      headerOperations: startHeaderOperations,
      headerIcons,
    });

    const endHeaderProps = reactive({
      headerValue: endHeaderValue,
      headerOperations: endHeaderOperations,
      headerIcons,
    });

    const rangePanelProps = computed(() => ({
      ...pick(props, [
        'mode',
        'showTime',
        'shortcuts',
        'shortcutsPosition',
        'dayStartOfWeek',
        'disabledDate',
        'disabledTime',
        'hideTrigger',
      ]),
      prefixCls,
      format: parseValueFormat.value,
      value: panelValue.value,
      showConfirmBtn: needConfirm.value,
      confirmBtnDisabled: confirmBtnDisabled.value,
      timePickerValue: timePickerValue.value,
      timePickerProps: computedTimePickerProps.value,
      extra: slots.extra,
      dateRender: slots.cell,
      startHeaderProps,
      endHeaderProps,
      footerValue: footerValue.value,
      disabled: disabledArray.value,
      visible: panelVisible.value,
      onCellClick: onPanelCellClick,
      onCellMouseEnter: onPanelCellMouseEnter,
      onShortcutClick: onPanelShortcutClick,
      onShortcutMouseEnter: previewShortcut.value
        ? onPanelShortcutMouseEnter
        : undefined,
      onShortcutMouseLeave: previewShortcut.value
        ? onPanelShortcutMouseLeave
        : undefined,
      onConfirm: onPanelConfirm,
      onTimePickerSelect,
      startHeaderMode: startHeaderMode.value,
      endHeaderMode: endHeaderMode.value,
      onStartHeaderLabelClick: onStartPanelHeaderLabelClick,
      onEndHeaderLabelClick: onEndPanelHeaderLabelClick,
      onStartHeaderSelect: onStartPanelHeaderSelect,
      onEndHeaderSelect: onEndPanelHeaderSelect,
    }));

    return {
      prefixCls,
      refInput,
      computedFormat,
      computedPlaceholder,
      panelVisible,
      panelValue,
      inputValue,
      focusedIndex,
      triggerDisabled,
      mergedSize,
      mergedError,
      onPanelVisibleChange,
      onInputClear,
      onInputChange,
      onInputPressEnter,
      rangePanelProps,
    };
  },
});
</script>
