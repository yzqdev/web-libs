<template>
  <Trigger
    :class="`${prefixCls}-trigger`"
    auto-fit-popup-min-width
    trigger="click"
    position="bl"
    :popup-offset="4"
    animation-name="slide-dynamic-origin"
    :prevent-focus="true"
    v-bind="triggerProps"
    :disabled="mergedDisabled"
    :popup-visible="panelVisible"
    :popup-container="popupContainer"
    :click-to-close="!allowSearch"
    auto-fit-transform-origin
    @popupVisibleChange="onVisibleChange"
  >
    <slot name="trigger">
      <SelectView
        ref="refSelectView"
        :model-value="selectViewValue"
        :input-value="searchValue"
        :allow-search="Boolean(allowSearch)"
        :allow-clear="allowClear"
        :loading="loading"
        :size="size"
        :max-tag-count="maxTagCount"
        :disabled="mergedDisabled"
        :opened="panelVisible"
        :error="error"
        :border="border"
        :placeholder="placeholder"
        :multiple="isMultiple"
        v-bind="$attrs"
        @inputValueChange="onSearchValueChange"
        @clear="onInnerClear"
        @remove="onItemRemove"
        @blur="onBlur"
      >
        <template v-if="$slots.prefix" #prefix>
          <slot name="prefix" />
        </template>
        <template v-if="$slots.label" #label="selectedData">
          <slot name="label" v-bind="selectedData" />
        </template>
      </SelectView>
    </slot>
    <template #content>
      <div
        :class="[`${prefixCls}-popup`, dropdownClassName]"
        :style="computedDropdownStyle"
      >
        <slot v-if="loading" name="loader">
          <Spin />
        </slot>
        <slot v-else-if="isEmptyTreeData || isEmptyFilterResult" name="empty">
          <Empty />
        </slot>
        <Panel
          v-else
          :selected-keys="selectedKeys"
          :show-checkable="treeCheckable"
          :scrollbar="scrollbar"
          :tree-props="{
            actionOnNodeClick: selectable === 'leaf' ? 'expand' : undefined,
            blockNode: true,
            ...treeProps,
            data,
            checkStrictly: treeCheckStrictly,
            checkedStrategy: treeCheckedStrategy,
            fieldNames,
            multiple,
            loadMore,
            filterTreeNode: computedFilterTreeNode,
            size,
            checkable: isCheckable,
            selectable: isSelectable,
          }"
          :tree-slots="pickSubCompSlots($slots, 'tree')"
          @change="onSelectChange"
        />
      </div>
    </template>
  </Trigger>
</template>
<script lang="ts">
import {
  computed,
  CSSProperties,
  defineComponent,
  nextTick,
  PropType,
  reactive,
  ref,
  toRefs,
  StyleValue,
} from 'vue';
import useMergeState from '../_hooks/use-merge-state';
import { LabelValue } from './interface';
import Trigger from '../trigger';
import SelectView from '../_components/select-view/select-view';
import Panel from './panel';
import { getPrefixCls } from '../_utils/global-config';
import useSelectedState from './hooks/use-selected-state';
import useTreeData from '../tree/hooks/use-tree-data';
import {
  TreeFieldNames,
  TreeNodeData,
  TreeProps,
  TreeNodeKey,
  Node,
} from '../tree/interface';
import { isUndefined, isFunction, isObject } from '../_utils/is';
import Empty from '../empty';
import useFilterTreeNode from './hooks/use-filter-tree-node';
import Spin from '../spin';
import pickSubCompSlots from '../_utils/pick-sub-comp-slots';
import { Size } from '../_utils/constant';
import { useFormItem } from '../_hooks/use-form-item';
import {
  getCheckedStateByCheck,
  isNodeCheckable,
} from '../tree/utils/check-utils';
import { isNodeSelectable } from '../tree/utils';
import { Data } from '../_utils/types';
import { ScrollbarProps } from '../scrollbar';

export default defineComponent({
  name: 'TreeSelect',
  components: {
    Trigger,
    SelectView,
    Panel,
    Empty,
    Spin,
  },
  inheritAttrs: false,
  props: {
    /**
     * @zh ????????????
     * @en Whether to disable
     * */
    disabled: {
      type: Boolean,
    },
    /**
     * @zh ????????????????????????
     * @en Whether it is loading state
     * */
    loading: {
      type: Boolean,
    },
    /**
     * @zh ?????????????????????
     * @en Whether it is an error state
     * */
    error: {
      type: Boolean,
    },
    /**
     * @zh ??????????????????
     * @en The size of the selection box.
     * @values 'mini','small','medium','large'
     * @defaultValue 'medium'
     * */
    size: {
      type: String as PropType<Size>,
    },
    /**
     * @zh ??????????????????
     * @en Whether to show the border
     * */
    border: {
      type: Boolean,
    },
    /**
     * @zh ??????????????????
     * @en Whether to allow searching
     * @defaultValue false (single) \| true (multiple)
     * */
    allowSearch: {
      type: [Boolean, Object] as PropType<
        boolean | { retainInputValue?: boolean }
      >,
      default: (props: Data) => Boolean(props.multiple),
    },
    /**
     * @zh ??????????????????
     * @en Whether to allow clear
     * */
    allowClear: {
      type: Boolean,
    },
    /**
     * @zh ????????????
     * @en Prompt copy
     * */
    placeholder: {
      type: String,
    },
    /**
     * @zh ??????????????????????????????????????????????????????
     * @en The maximum number of labels displayed, only valid in multi-select mode
     * */
    maxTagCount: {
      type: Number,
    },
    /**
     * @zh ??????????????????
     * @en Whether to support multiple selection
     * */
    multiple: {
      type: Boolean,
    },

    /**
     * @zh ?????????
     * @en Default value
     * */
    defaultValue: {
      type: [String, Number, Array, Object] as PropType<
        string | number | Array<string | number> | LabelValue | LabelValue[]
      >,
    },
    /**
     * @zh ?????????
     * @en Value
     * */
    modelValue: {
      type: [String, Number, Array, Object] as PropType<
        string | number | Array<string | number> | LabelValue | LabelValue[]
      >,
    },
    /**
     * @zh ?????????????????????????????????
     * @en Specify the field name in the node data
     * */
    fieldNames: {
      type: Object as PropType<TreeFieldNames>,
    },
    /**
     * @zh ??????
     * @en Data
     * */
    data: {
      type: Array as PropType<TreeNodeData[]>,
      default: () => [],
    },
    /**
     * @zh ??????value??????????????????string????????????true?????????value???????????? { label: string, value: string }
     * @en Set the value format. The default is string, when set to true, the value format is: {label: string, value: string}
     * */
    labelInValue: {
      type: Boolean,
    },
    /**
     * @zh ?????????????????????
     * @en Whether to show checkbox
     * */
    treeCheckable: {
      type: Boolean,
    },
    /**
     * @zh ????????????????????????
     * @en Whether the parent and child nodes are related
     * */
    treeCheckStrictly: {
      type: Boolean,
    },
    /**
     * @zh ??????????????????
     * @en Customized echo method
     * */
    treeCheckedStrategy: {
      type: String as PropType<'all' | 'parent' | 'child'>,
      default: 'all',
    },
    /**
     * @zh ?????????????????? [Tree](/vue/component/tree) ?????????Props
     * @en Can accept Props of all [Tree](/vue/component/tree) components
     * */
    treeProps: {
      type: Object as PropType<Partial<TreeProps>>,
    },
    /**
     * @zh ?????????????????? [Trigger](/vue/component/trigger) ?????????Props
     * @en Can accept Props of all [Trigger](/vue/component/trigger) components
     * */
    triggerProps: {
      type: Object as PropType<Record<string, unknown>>,
    },
    /**
     * @zh ?????????????????????
     * @en Whether the pop-up box is visible
     * @vModel
     */
    popupVisible: {
      type: Boolean,
      default: undefined,
    },
    /**
     * @zh ???????????????????????????
     * @en Whether the default pop-up box is visible
     * */
    defaultPopupVisible: {
      type: Boolean,
    },
    /**
     * @zh ???????????????
     * @en Drop-down box style
     * */
    dropdownStyle: {
      type: Object as PropType<CSSProperties>,
    },
    /**
     * @zh ??????????????? class
     * @en Drop-down box style class
     * */
    dropdownClassName: {
      type: [String, Array] as PropType<string | string[]>,
    },
    /**
     * @zh ???????????????????????????
     * @en Custom node filter function
     * */
    filterTreeNode: {
      type: Function as PropType<
        (searchKey: string, nodeData: TreeNodeData) => boolean
      >,
    },
    /**
     * @zh ??????????????????
     * @en Load data dynamically
     * */
    loadMore: {
      type: Function as PropType<(nodeData: TreeNodeData) => Promise<void>>,
    },
    /**
     * @zh ????????????????????????
     * @en Disable internal filtering logic
     * */
    disableFilter: {
      type: Boolean,
    },
    /**
     * @zh ????????????????????????
     * @en Mount container for pop-up box
     */
    popupContainer: {
      type: [String, Object] as PropType<string | HTMLElement | undefined>,
    },
    /**
     * @zh ??? value ???????????????????????? key ??????????????????
     * @en Customize node data for keys that do not match options
     * @version 2.22.0
     */
    fallbackOption: {
      type: [Boolean, Function] as PropType<
        boolean | ((key: number | string) => TreeNodeData | boolean)
      >,
      default: true,
    },
    /**
     * @zh ?????????????????????????????????????????????
     * @en Set the nodes that can be selected, all can be selected by default
     * @version 2.27.0
     */
    selectable: {
      type: [Boolean, String, Function] as PropType<
        | boolean
        | 'leaf'
        | ((
            node: TreeNodeData,
            info: { isLeaf: boolean; level: number }
          ) => boolean)
      >,
      default: true,
    },
    /**
     * @zh ???????????????????????????
     * @en Whether to enable virtual scroll bar
     * @version 2.39.0
     */
    scrollbar: {
      type: [Boolean, Object] as PropType<boolean | ScrollbarProps>,
      default: true,
    },
  },
  emits: {
    /**
     * @zh ??????????????????
     * @en Trigger when the value changes
     * @param {string | number | LabelValue | Array<string | number> | LabelValue[] | undefined} value
     */
    'change': (
      value:
        | string
        | number
        | LabelValue
        | Array<string | number>
        | LabelValue[]
        | undefined
    ) => true,
    'update:modelValue': (
      value:
        | string
        | number
        | LabelValue
        | Array<string | number>
        | LabelValue[]
        | undefined
    ) => true,
    /**
     * @zh ????????????????????????????????????
     * @en Triggered when the status of the drop-down box changes
     * @param {boolean} visible
     */
    'popup-visible-change': (visible: boolean) => true,
    'update:popupVisible': (visible: boolean) => true,
    /**
     * @zh ????????????????????????
     * @en Triggered when the search value changes
     * @param {string} searchKey
     */
    'search': (searchKey: string) => true,
    /**
     * @zh ?????????????????????
     * @en Triggered when clear is clicked
     * */
    'clear': () => true,
  },
  /**
   * @zh ?????????????????????
   * @en Custom trigger element
   * @slot trigger
   */
  /**
   * @zh ??????
   * @en Prefix
   * @slot prefix
   */
  /**
   * @zh ????????????????????????
   * @en Custom Label
   * @slot label
   * @binding data
   */
  /**
   * @zh ??????????????????????????????
   * @en Customizing the content displayed during loading
   * @slot loader
   */
  /**
   * @zh ?????????????????????
   * @en Custom empty data display
   * @slot empty
   */
  /**
   * @zh ?????? tree ????????? switcher ??????
   * @en Custom switcher icon for the tree component
   * @slot tree-slot-switcher-icon
   */
  /**
   * @zh ?????? tree ?????????????????????
   * @en Custom node icon for the tree component
   * @slot tree-slot-icon
   * @binding {TreeNodeData} node
   * @version 2.18.0
   */

  /**
   * @zh ?????? tree ?????????????????????
   * @en Custom the node title of the tree component
   * @slot tree-slot-title
   */
  /**
   * @zh ?????? tree ?????????????????????????????????
   * @en Render additional node content of the tree component
   * @slot tree-slot-extra
   */
  setup(props, { emit }) {
    const {
      defaultValue,
      modelValue,
      multiple,
      popupVisible,
      defaultPopupVisible,
      treeCheckable,
      treeCheckStrictly,
      data,
      fieldNames,
      disabled,
      labelInValue,
      filterTreeNode,
      disableFilter,
      dropdownStyle,
      treeProps,
      fallbackOption,
      selectable,
    } = toRefs(props);
    const { mergedDisabled, eventHandlers } = useFormItem({
      disabled,
    });
    const prefixCls = getPrefixCls('tree-select');
    const isMultiple = computed(() => multiple.value || treeCheckable.value);
    const isSelectable = (
      node: TreeNodeData,
      info: { level: number; isLeaf: boolean }
    ) => {
      if (selectable.value === 'leaf') return info.isLeaf;
      if (isFunction(selectable.value)) return selectable.value(node, info);
      return selectable.value ?? false;
    };
    const isCheckable = computed(() =>
      treeCheckable.value ? isSelectable : false
    );
    const retainInputValue = computed(
      () =>
        isObject(props.allowSearch) &&
        Boolean(props.allowSearch.retainInputValue)
    );
    const { flattenTreeData, key2TreeNode } = useTreeData(
      reactive({
        treeData: data,
        fieldNames,
        selectable: isSelectable,
        checkable: isCheckable,
      })
    );

    const {
      selectedKeys,
      selectedValue,
      setLocalSelectedKeys,
      localSelectedKeys,
      localSelectedValue,
    } = useSelectedState(
      reactive({
        defaultValue,
        modelValue,
        key2TreeNode,
        multiple,
        treeCheckable,
        treeCheckStrictly,
        fallbackOption,
        fieldNames,
      })
    );

    function isNodeClosable(node: Node) {
      return treeCheckable.value
        ? isNodeCheckable(node)
        : isNodeSelectable(node);
    }

    const selectViewValue = computed(() => {
      if (isUndefined(selectedValue.value)) {
        return [];
      }
      if (isMultiple.value && !mergedDisabled.value) {
        return selectedValue.value.map((i) => {
          const node = key2TreeNode.value.get(i.value);
          return {
            ...i,
            closable: !node || isNodeClosable(node),
          };
        });
      }
      return selectedValue.value;
    });

    const setSelectedKeys = (newVal: TreeNodeKey[]) => {
      setLocalSelectedKeys(newVal);

      nextTick(() => {
        const forEmitValue =
          (labelInValue.value
            ? localSelectedValue.value
            : localSelectedKeys.value) || [];

        const emitValue = isMultiple.value ? forEmitValue : forEmitValue[0];

        emit('update:modelValue', emitValue);
        emit('change', emitValue);
        eventHandlers.value?.onChange?.();
      });
    };

    const searchValue = ref('');

    const [panelVisible, setLocalPanelVisible] = useMergeState(
      defaultPopupVisible.value,
      reactive({
        value: popupVisible,
      })
    );
    const setPanelVisible = (visible: boolean) => {
      if (visible !== panelVisible.value) {
        setLocalPanelVisible(visible);
        emit('popup-visible-change', visible);
        emit('update:popupVisible', visible);
      }

      if (!visible) {
        refSelectView.value &&
          refSelectView.value.blur &&
          refSelectView.value.blur();
      }
    };

    const { isEmptyFilterResult, filterTreeNode: computedFilterTreeNode } =
      useFilterTreeNode(
        reactive({
          searchValue,
          flattenTreeData,
          filterMethod: filterTreeNode,
          disableFilter,
          fieldNames,
        })
      );

    const isEmptyTreeData = computed(() => !flattenTreeData.value.length);

    const refSelectView = ref();

    const computedDropdownStyle = computed<StyleValue[]>(() => [
      dropdownStyle?.value || {},
      treeProps?.value?.virtualListProps ? { 'max-height': 'unset' } : {},
    ]);

    const onBlur = () => {
      if (!retainInputValue.value && searchValue.value) {
        searchValue.value = '';
      }
    };

    return {
      refSelectView,
      prefixCls,
      selectedValue,
      selectedKeys,
      mergedDisabled,
      searchValue,
      panelVisible,
      isEmptyTreeData,
      isEmptyFilterResult,
      computedFilterTreeNode,
      isMultiple,
      selectViewValue,
      computedDropdownStyle,
      onSearchValueChange(newVal: string) {
        if (newVal !== searchValue.value) {
          setPanelVisible(true);
          searchValue.value = newVal;
          emit('search', newVal);
        }
      },
      onSelectChange(newVal: string[]) {
        setSelectedKeys(newVal);
        searchValue.value = '';

        if (!isMultiple.value) {
          setPanelVisible(false);
        }
      },
      onVisibleChange: setPanelVisible,
      onInnerClear() {
        setSelectedKeys([]);
        emit('clear');
      },
      pickSubCompSlots,
      isSelectable,
      isCheckable,
      onBlur,
      onItemRemove(id: string) {
        if (mergedDisabled.value) return;
        const node = key2TreeNode.value.get(id);
        if (treeCheckable.value && node) {
          if (isNodeClosable(node)) {
            const [newVal] = getCheckedStateByCheck({
              node,
              checked: false,
              checkedKeys: selectedKeys.value,
              indeterminateKeys: [],
              checkStrictly: treeCheckStrictly.value,
            });
            setSelectedKeys(newVal);
          }
        } else {
          const newVal = selectedKeys.value.filter((i) => i !== id);
          setSelectedKeys(newVal);
        }
      },
    };
  },
});
</script>
