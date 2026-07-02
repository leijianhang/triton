export const workspaceLayoutOptions = [
  { value: 'single', label: '1 chart', panes: 1, className: 'layout-single' },
  { value: 'two-column', label: '2 charts', panes: 2, className: 'layout-two-column' },
  { value: 'two-row', label: '2 charts', panes: 2, className: 'layout-two-row' },
  { value: 'three-column', label: '3 charts', panes: 3, className: 'layout-three-column' },
  { value: 'four-grid', label: '4 charts', panes: 4, className: 'layout-four-grid' },
  { value: 'nine-grid', label: '9 charts', panes: 9, className: 'layout-nine-grid' }
];

export const getWorkspaceLayout = value =>
  workspaceLayoutOptions.find(item => item.value === value) || workspaceLayoutOptions[0];

export const getWorkspacePaneCount = value => getWorkspaceLayout(value).panes;
