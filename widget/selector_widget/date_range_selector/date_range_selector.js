const ENTITY_TYPE = ['TENANT', 'CUSTOMER_L1', 'CUSTOMER_L2'];
const SELECTOR_START = '2023-01-01';

self.onInit = async function () {
  self.ctx.custom = {};
  let { custom, $scope } = self.ctx;
  defineVariables();
  setTitle();
  linkEvent();
  getDashboardParameter();

  self.onResize();

  if (!custom.isSample) {
    // 현재 사용자의 Root 엔터티로부터 관계 트리 형성
    custom.relations[custom.rootEntity.id.id] = {
      id: custom.rootEntity.id,
      name: custom.rootEntity.name,
      parent: '',
      child: [],
    };
    $scope.ownerLevel = await getCurrentLevel();
    getCustomer([custom.relations[custom.rootEntity.id.id]]);
  }
  self.onResize();
};

self.onResize = function () {
  self.ctx.custom.resizeThrottle();
};

self.actionSources = function () {
  return {
    filterAction: {
      name: 'Filter Action',
      multiple: false,
    },
  };
};

self.typeParameters = function () {
  return {
    maxDatasources: -1,
    maxDataKeys: -1,
    dataKeysOptional: true,
  };
};

// Define Variables
function defineVariables() {
  let { custom, $scope, $container } = self.ctx;

  // Define Tags
  custom.$widget = $('#widget', $container);
  custom.$widgetHeader = $('.widget-header', $container);
  custom.$widgetTitle = $('.widget-title', $container);

  // Define Scope Variables
  $scope.customerL1List = [{ name: t('thingplus.selector.entire-customerL1'), value: '' }];
  $scope.customerL2List = [{ name: t('thingplus.selector.entire-customerL2'), value: '' }];
  $scope.deviceList = [
    { name: t('thingplus.selector.select-device'), label: t('thingplus.selector.select-device'), value: '' },
  ];
  $scope.selectedCustomerL1 = '';
  $scope.selectedCustomerL2 = '';
  $scope.selectedDevice = '';
  $scope.ownerLevel = 2;

  // Define Normal Variables
  custom.resizeThrottle = _.throttle(resize, 200, { trailing: true });
  custom.ownerDatasource = self.ctx.defaultSubscription.configuredDatasources[0];
  custom.rootEntity = custom.ownerDatasource.entity;
  custom.isSample = custom.ownerDatasource.type == 'function';
  custom.relations = [];
  custom.ymd = t('thingplus.time-format.ymd');

  let now = moment().valueOf();
  custom.startTs = moment(now).startOf('day').valueOf();
  custom.endTs = moment(now).valueOf();
  $scope.dateGroupList = [
    { name: t('thingplus.time-format.daily'), value: 'DAY' },
    { name: t('thingplus.time-format.weekly2'), value: 'WEEK' },
    { name: t('thingplus.time-format.monthly'), value: 'MONTH' },
  ];
  $scope.selectedDateGroup = 'DAY';
  $scope.dateRangeList = getDateRangeList($scope.selectedDateGroup);
}

// Create Widget Title
function setTitle() {
  let { custom } = self.ctx;
  custom.$widgetTitle.html(self.ctx.widget.config.title);
  custom.$widgetTitle.css(self.ctx.widget.config.titleStyle);
}

function linkEvent() {
  let { custom, $scope } = self.ctx;
  $scope.setCustomerL1 = function (e) {
    $scope.selectedCustomerL1 = e;
    $scope.selectedCustomerL2 = '';
    $scope.selectedDevice = '';
    changeCustomerL2List();
    changeDeviceList();
  };
  $scope.setCustomerL2 = function (e) {
    $scope.selectedCustomerL2 = e;
    $scope.selectedDevice = '';
    changeDeviceList();
  };
  $scope.setDevice = function (e) {
    $scope.selectedDevice = e;
  };
  $scope.search = function (e) {
    updateDashboardState();
  };
  $scope.setDateGroup = function (e) {
    $scope.selectedDateGroup = e;
    $scope.dateRangeList = getDateRangeList($scope.selectedDateGroup);
  };
  $scope.setDateRange = function (e) {
    $scope.selectedDateRange = e;
  };
  $scope.openFilter = function (e) {
    let descriptor = self.ctx.actionsApi.getActionDescriptors('filterAction')[0];
    self.ctx.actionsApi.handleWidgetAction(
      {},
      descriptor,
      custom.ownerDatasource.entity.id,
      custom.ownerDatasource.entityName,
      {},
      custom.ownerDatasource.entityLabel
    );
  };
}

function getDashboardParameter() {
  let { custom, $scope } = self.ctx;
  if (custom.isSample) return {};
  custom.dashboardParams = self.ctx.stateController.getStateParams();
  if (custom.dashboardParams) {
    if (custom.dashboardParams.customerL1) {
      $scope.selectedCustomerL1 = custom.dashboardParams.customerL1.entityId.id;
    }
    if (custom.dashboardParams.customerL2) {
      $scope.selectedCustomerL2 = custom.dashboardParams.customerL2.entityId.id;
    }
    if (custom.dashboardParams.entityId && custom.dashboardParams.entityId.entityType == 'DEVICE') {
      $scope.selectedDevice = custom.dashboardParams.entityId.id;
    }
    if (custom.dashboardParams.dateGroup) {
      $scope.selectedDateGroup = custom.dashboardParams.dateGroup;
      $scope.dateRangeList = getDateRangeList($scope.selectedDateGroup);
    }
    if (custom.dashboardParams.dateRange) {
      $scope.selectedDateRange = custom.dashboardParams.dateRange;
    }
    console.log($scope.selectedDateRange);

    self.ctx.detectChanges();
  }
}

function resize() {
  let { custom } = self.ctx;
  // 위젯 전체 크기 조절
  let originWidth = self.ctx.settings.widget.originWidth;
  if (self.ctx.isMobile) {
    originWidth = 960;
    if (self.ctx.width < 600) {
      originWidth = 600;
    }
  }
  let widgetFontSize = _.round((self.ctx.width / originWidth) * 10, 2);
  custom.$widget.css('font-size', `${widgetFontSize}px`);
}

async function getCurrentLevel() {
  let { custom } = self.ctx;
  if (custom.rootEntity.id.entityType == 'TENANT') {
    return 0;
  } else {
    let result = await self.ctx.attributeService
      .getEntityAttributes(custom.rootEntity.id, 'SERVER_SCOPE', ['customerType'])
      .toPromise();
    if (result && result[0]) {
      if (result[0].value == ENTITY_TYPE[1]) {
        return 1;
      } else {
        return 2;
      }
    }
  }
}

function getCustomer(entities) {
  let { custom } = self.ctx;
  let promises = [];
  if (entities.length > 0) {
    for (let i = 0; i < entities.length; i++) {
      promises.push(self.ctx.entityRelationService.findInfoByFrom(entities[i].id));
    }
    self.ctx.rxjs.forkJoin(promises).subscribe(childs => {
      let newChild = [];
      for (let j = 0; j < childs.length; j++) {
        for (let k = 0; k < childs[j].length; k++) {
          custom.relations[childs[j][k].to.id] = {
            id: childs[j][k].to,
            name: childs[j][k].toName,
            parent: entities[j],
            child: [],
            type: 'CUSTOMER',
          };
          custom.relations[entities[j].id.id].child.push(custom.relations[childs[j][k].to.id]);
          if (childs[j][k].to.entityType === 'USER') {
            custom.relations[childs[j][k].to.id].type = 'USER';
          }
          if (childs[j][k].to.entityType === 'DEVICE') {
            custom.relations[childs[j][k].to.id].type = 'DEVICE';
          }
          if (childs[j][k].to.entityType === 'ASSET') {
            custom.relations[childs[j][k].to.id].type = 'ASSET';
          }
          if (childs[j][k].to.entityType === 'CUSTOMER') {
            newChild.push(custom.relations[childs[j][k].to.id]);
          }
        }
      }
      getCustomer(newChild);
    });
  } else {
    distributeLevel();
  }
}

// hierarchy 레벨에 따라 배열에 따로 저장
function distributeLevel() {
  let { custom, $scope } = self.ctx;
  let depth = $scope.ownerLevel;
  let root = custom.relations[custom.rootEntity.id.id];
  root.type = ENTITY_TYPE[depth];
  for (let i in root.child) {
    if (root.child[i].type == 'CUSTOMER') {
      root.child[i].type = ENTITY_TYPE[depth + 1];
    }
    for (let j in root.child[i].child) {
      if (root.child[i].child[j].type == 'CUSTOMER') {
        root.child[i].child[j].type = ENTITY_TYPE[depth + 2];
      }
    }
  }
  custom.customerL1List = [];
  custom.customerL2List = [];
  custom.deviceList = [];

  for (let i in custom.relations) {
    if (custom.relations[i].type == ENTITY_TYPE[1]) {
      custom.customerL1List.push(custom.relations[i]);
    }
    if (custom.relations[i].type == ENTITY_TYPE[2]) {
      custom.customerL2List.push(custom.relations[i]);
    }
    if (custom.relations[i].type == 'DEVICE') {
      custom.deviceList.push(custom.relations[i]);
    }
  }

  getDeviceInfo();
}

function getDeviceInfo() {
  let { custom, $scope } = self.ctx;
  let observables = [];
  custom.deviceList = [];
  for (let i in custom.customerL2List) {
    let customerId = custom.customerL2List[i].id.id;
    observables.push(self.ctx.http.get(`/api/customer/${customerId}/deviceInfos?pageSize=50000&page=0`));
  }

  self.ctx.rxjs.forkJoin(observables).subscribe(devices => {
    for (let i in devices) {
      for (let j in devices[i].data) {
        custom.relations[devices[i].data[j].id.id].label =
          devices[i].data[j].label != '' ? devices[i].data[j].label : devices[i].data[j].name;
        custom.deviceList.push(custom.relations[devices[i].data[j].id.id]);
      }
    }

    $scope.customerL1List = [{ name: t('thingplus.selector.entire-customerL1'), value: '' }];
    $scope.customerL1List = $scope.customerL1List.concat(
      custom.customerL1List.map(x => {
        return { name: x.name, value: x.id.id };
      })
    );

    changeCustomerL2List();
    changeDeviceList();
    self.ctx.detectChanges();
  });
}

// Customer L2 리스트 갱신
function changeCustomerL2List() {
  let { custom, $scope } = self.ctx;
  $scope.customerL2List = [{ name: t('thingplus.selector.entire-customerL2'), value: '' }];

  if ($scope.selectedCustomerL1 === '') {
    $scope.customerL2List = $scope.customerL2List.concat(
      custom.customerL2List.map(x => {
        return { name: x.name, value: x.id.id };
      })
    );
  } else {
    $scope.customerL2List = $scope.customerL2List.concat(
      custom.customerL2List
        .filter(x => x.parent.id.id === $scope.selectedCustomerL1)
        .map(x => {
          return { name: x.name, value: x.id.id };
        })
    );
  }
}

// 디바이스 리스트 갱신
function changeDeviceList() {
  let { custom, $scope } = self.ctx;
  $scope.deviceList = [];

  if ($scope.selectedCustomerL2 === '') {
    if ($scope.selectedCustomerL1 === '') {
      $scope.deviceList = $scope.deviceList.concat(
        custom.deviceList.map(x => {
          return { name: x.name, label: x.label, value: x.id.id };
        })
      );
    } else {
      $scope.deviceList = $scope.deviceList.concat(
        custom.deviceList
          .filter(x => x.parent.parent.id.id === $scope.selectedCustomerL1)
          .map(x => {
            return { name: x.name, label: x.label, value: x.id.id };
          })
      );
    }
  } else {
    $scope.deviceList = $scope.deviceList.concat(
      custom.deviceList
        .filter(x => x.parent.id.id === $scope.selectedCustomerL2)
        .map(x => {
          return { name: x.name, label: x.label, value: x.id.id };
        })
    );
  }
  $scope.deviceList.sort((a, b) => {
    if (a.label > b.label) return 1;
    if (a.label < b.label) return -1;
    return 0;
  });
  $scope.deviceList = [
    { name: t('thingplus.selector.select-device'), label: t('thingplus.selector.select-device'), value: '' },
  ].concat($scope.deviceList);
}

function updateDashboardState() {
  let { custom, $scope } = self.ctx;
  if ($scope.selectedDevice == '') {
    window.alert(t('thingplus.help.error-select-device'));
    return;
  }
  let target = custom.relations[$scope.selectedDevice];
  let param = {
    entityId: target.id,
    entityName: target.name,
    entityLabel: target.label,
  };
  if (target) {
    param = {
      entityId: target.id,
      entityName: target.name,
      entityLabel: target.label,
    };
  }
  if ($scope.selectedCustomerL1 != '') {
    let customerL1 = custom.relations[$scope.selectedCustomerL1];
    param.customerL1 = {
      entityId: customerL1.id,
      entityName: customerL1.name,
      entityLabel: customerL1.label,
    };
  }
  if ($scope.selectedCustomerL2 != '') {
    let customerL2 = custom.relations[$scope.selectedCustomerL2];
    param.customerL2 = {
      entityId: customerL2.id,
      entityName: customerL2.name,
      entityLabel: customerL2.label,
    };
  }
  if ($scope.selectedDevice != '') {
    let device = custom.relations[$scope.selectedDevice];
    param.device = {
      entityId: device.id,
      entityName: device.name,
      entityLabel: device.label,
    };
  }
  param.dateGroup = $scope.selectedDateGroup;
  param.dateRange = $scope.selectedDateRange;
  param.startTs = param.dateRange;
  if (param.dateGroup == 'DAY') {
    param.endTs = moment(param.dateRange).add(1, 'months').valueOf();
  } else if (param.dateGroup == 'WEEK') {
    param.endTs = moment(param.dateRange).add(1, 'quarters').valueOf();
  } else if (param.dateGroup == 'MONTH') {
    param.endTs = moment(param.dateRange).add(1, 'years').valueOf();
  }
  if (param.endTs > moment().valueOf()) {
    param.endTs = moment().valueOf();
  }

  self.ctx.stateController.updateState('default', param, null);
  self.ctx.updateAliases();
}

function t(key, data) {
  let defaultKey = key;
  if (typeof key === 'string') {
    let keyArr = key.split('.');
    defaultKey = keyArr[keyArr.length - 1];
  }
  let result = self.ctx.translate.instant(key, data);
  if (result == key) {
    return defaultKey;
  }
  return result;
}

function getDateRangeList(group) {
  let { custom, $scope } = self.ctx;
  let result = [];
  let nowTs = moment().endOf('month').valueOf();
  let startTs = moment(SELECTOR_START).valueOf();

  while (startTs < nowTs) {
    if (group === 'DAY') {
      result.push({ name: moment(startTs).format(t('thingplus.time-format.ym-str')), value: startTs });
      startTs = moment(startTs).add(1, 'months').valueOf();
    } else if (group === 'WEEK') {
      result.push({ name: moment(startTs).format(t('thingplus.time-format.yq-str')), value: startTs });
      startTs = moment(startTs).add(1, 'quarters').valueOf();
    } else if (group === 'MONTH') {
      result.push({ name: moment(startTs).format(t('thingplus.time-format.y-str')), value: startTs });
      startTs = moment(startTs).add(1, 'years').valueOf();
    }
  }
  result.sort((a, b) => {
    if (a.value < b.value) return 1;
    if (a.value > b.value) return -1;
    return 0;
  });

  $scope.selectedDateRange = result[0].value;

  return result;
}
