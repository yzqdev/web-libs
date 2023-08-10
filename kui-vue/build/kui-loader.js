
//https://github.com/webpack/loader-utils
const loaders = require('loader-utils');

const tag = {
    'Switch': 'k-switch',
    'Image': 'k-image',
}

const prefixTag = {
    'k-affix': 'Affix',
    'k-alert': 'Alert',
    'k-back-top': 'BackTop',
    'k-badge': 'Badge',
    'k-breadcrumb': 'Breadcrumb',
    'k-breadcrumb-item': 'BreadcrumbItem',
    'k-button': 'Button',
    'k-button-group': 'ButtonGroup',
    'k-card': 'Card',
    'k-carousel': 'Carousel',
    'k-carousel-item': 'CarouselItem',
    'k-checkbox': 'Checkbox',
    'k-checkbox-group': 'CheckboxGroup',
    'k-collapse': 'Collapse',
    'k-panel': 'Panel',
    'k-color-picker': 'ColorPicker',
    'k-date-picker': 'DatePicker',
    'k-divider': 'Divider',
    'k-drawer': 'Drawer',
    'k-dropdown': 'Dropdown',
    'k-empty': 'Empty',
    'k-form': 'Form',
    'k-form-item': 'FormItem',
    'k-col': 'Col',
    'k-row': 'Row',
    'k-icon': 'Icon',
    // 'k-image': 'Image',
    'k-image-group': 'ImageGroup',
    'k-input': 'Input',
    'k-textarea': 'TextArea',
    'k-layout': 'Layout',
    'k-header': 'Header',
    'k-footer': 'Footer',
    'k-content': 'Content',
    'k-sider': 'Sider',
    'k-loading': 'Loading',
    'k-menu': 'Menu',
    'k-menu-item': 'MenuItem',
    'k-menu-group': 'MenuGrop',
    'k-menu-divider': 'MenuDivider',
    'k-sub-menu': 'SubMenu',
    'k-modal': 'Modal',
    'k-page': 'Page',
    'k-popconfirm': 'Popconfirm',
    'k-poptip': 'Poptip',
    'k-progress': 'Progress',
    'k-radio': 'Radio',
    'k-radio-group': 'RadioGroup',
    'k-radio-button': 'RadioButton',
    'k-select': 'Select',
    'k-option': 'Option',
    'k-spin': 'Spin',
    'k-steps': 'Steps',
    'k-step': 'Step',
    'k-tabel': 'Tabel',
    'k-tabs': 'Tabs',
    'k-tab-pane': 'Tabpane',
    'k-tag': 'Tag',
    'k-time-line': 'TimeLine',
    'k-time-line-item': 'TimeLineItem',
    'k-tooltip': 'Tooltip',
    'k-tree': 'Tree',
    'k-upload': 'Upload',
}

function replaceTag(code, tags) {
    Object.keys(tags).forEach(tag => {
        code = code.replace(new RegExp(`<${tag}(?![a-zA-Z0-9-])`, 'g'), `<${tags[tag]}`)
            .replace(new RegExp(`<\/${tag}>`, 'g'), `<\/${tags[tag]}>`)
    })
    return code
}

module.exports = function (source) {
    const options = loaders.getOptions(this);

    this.cacheable();

    let newSource = source;
    newSource = replaceTag(newSource, tag);

    if ('prefix' in options && options.prefix) {
        newSource = replaceTag(newSource, prefixTag);
    }

    return newSource;
};
