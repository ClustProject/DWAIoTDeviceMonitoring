const ENTITY_TYPE = ['TENANT', 'CUSTOMER_L1', 'CUSTOMER_L2'];
const STANDARD_WINDOW_SIZE = 1920 / 100;
const HOUR_MS = 3600000;
const DAY_MS = 86400000;

self.onInit = async function () {
  self.ctx.custom = {};
  let { custom, $scope, $container } = self.ctx;
  defineVariables();
  setTitle();
  linkEvent();
  makeTab();
  getDashboardParameter();
  resize();
  self.ctx.$scope.isLoading$.subscribe(() => {
    $('.tooltip', $container).tooltipster({
      content: '',
      interactive: true,
      theme: 'tooltipster-transparent',
      trigger: 'click',
      delay: 200,
    });
    $('.block').tooltipster({
      content: '',
      interactive: true,
      theme: 'tooltipster-transparent',
      trigger: 'hover',
      delay: 0,
    });
  });

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

  self.ctx.detectChanges();
};

self.onResize = function () {
  self.ctx.custom.resizeThrottle();
};

self.actionSources = function () {
  return {
    widgetHeaderButton: {
      name: 'Custom Header Button',
      multiple: true,
    },
    customAction: {
      name: 'Custom Action',
      multiple: true,
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

  custom.now = moment().valueOf();

  // Define Tags
  custom.$widget = $('#widget', $container);
  custom.$widgetTab = $('.widget-tab', $container);
  custom.$widgetHeader = $('.widget-header', $container);
  custom.$widgetSubHeader = $('.widget-sub-header', $container);
  custom.$widgetTitle = $('.widget-title', $container);
  custom.$widgetContent = $('.widget-content', $container);
  custom.$calendarBody = $('.calendar-body', $container);
  custom.$calendarBodyRight = $('.calendar-body-right', $container);
  custom.$calendarHeaderRight = $('.calendar-header-right', $container);

  custom.ymStr = t('thingplus.time-format.ym-str');
  custom.mdStr = t('thingplus.time-format.md-str');
  custom.day = t('thingplus.time-format.weekday-long.' + moment(custom.now).format('ddd').toLowerCase());

  $scope.tabList = [];
  $scope.customerL1List = [{ name: t('thingplus.selector.entire-customerL1'), value: '' }];
  $scope.customerL2List = [{ name: t('thingplus.selector.entire-customerL2'), value: '' }];
  $scope.deviceList = [
    { name: t('thingplus.selector.entire-device'), label: t('thingplus.selector.entire-device'), value: '' },
  ];
  $scope.selectedCustomerL1 = '';
  $scope.selectedCustomerL2 = '';
  $scope.selectedDevice = '';
  $scope.ownerLevel = 2;
  $scope.headerActionList = self.ctx.actionsApi.getActionDescriptors('widgetHeaderButton').map(x => {
    return { name: x.name, icon: x.icon, action: e => handleHeaderAction(x) };
  });
  $scope.customActionList = self.ctx.actionsApi.getActionDescriptors('customAction');
  $scope.yearList = [];
  $scope.monthList = [];
  for (let i = 2023; i <= moment(custom.now).year(); i++) {
    $scope.yearList.push({ label: t('thingplus.time-format.year-value', { year: i }), value: i });
  }
  for (let i = 1; i <= 12; i++) {
    $scope.monthList.push({ label: t('thingplus.time-format.month-value', { month: i }), value: i });
  }

  $scope.selectedYear = moment(custom.now).year();
  $scope.selectedMonth = moment(custom.now).month() + 1;
  $scope.targetStart = moment(custom.now).startOf('month').valueOf();
  $scope.targetMonth = moment($scope.targetStart).format(custom.ymStr);
  $scope.todayDate = moment(custom.now).format(custom.mdStr) + ' ' + custom.day;
  $scope.todayEvent = null;
  $scope.isCurrentMonth = true;
  $scope.weekList = [];
  $scope.dayList = [];
  $scope.dateList = [];
  $scope.label = '';
  $scope.isLoading = true;

  // Define Normal Variables
  custom.relations = {};
  custom.resizeThrottle = _.throttle(resize, 200, { trailing: true });
  custom.ownerDatasource = self.ctx.defaultSubscription.configuredDatasources[0];
  custom.rootEntity = custom.ownerDatasource.entity;
  custom.isSample = custom.ownerDatasource.type == 'function';
  custom.hiddenDatasources = self.ctx.datasources.filter(x => x.entityAliasId === custom.ownerDatasource.entityAliasId);
  custom.mainDatasources = self.ctx.datasources.filter(
    x => x.entityAliasId !== custom.ownerDatasource.entityAliasId && x.entityType == 'DEVICE'
  );
  custom.originDataKeys = self.ctx.defaultSubscription.configuredDatasources[1].dataKeys;
  custom.targetDatasources = [];
  custom.t = t;
  custom.dragPos = [0, 0];
  let originWidth = self.ctx.settings.widget.originWidth;
  if (self.ctx.isMobile) {
    originWidth = 960;
  }
  custom.widgetFontSize = _.round((self.ctx.width / originWidth) * 10, 2);
  if (custom.widgetFontSize < 6.25) {
    custom.widgetFontSize = 6.25;
  }
  custom.computedStyle = getComputedStyle($container[0]);
  $scope.deviceCount = custom.mainDatasources.length;
}

// Create Widget Title
function setTitle() {
  let { custom } = self.ctx;
  custom.$widgetTitle.html(t(self.ctx.widget.config.title));
  custom.$widgetTitle.css(self.ctx.widget.config.titleStyle);
}

function linkEvent() {
  let { custom, $scope, $container } = self.ctx;
  custom.$calendarBodyRight.on('mousedown', mouseDownHandler);
  $scope.selectTab = function (e) {
    let state = e || 'default';
    let param = custom.dashboardParams || {};
    self.ctx.stateController.updateState(state, param, null);
  };
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
  $scope.setYear = function (e) {
    $scope.selectedYear = e;
  };
  $scope.setMonth = function (e) {
    $scope.selectedMonth = e;
  };
  $scope.prevMonth = async function () {
    $scope.isLoading = true;
    $scope.targetStart = moment($scope.targetStart).subtract(1, 'months').valueOf();
    $scope.targetMonth = moment($scope.targetStart).format(custom.ymStr);
    if (moment($scope.targetStart).startOf('month').valueOf() == moment(custom.now).startOf('month').valueOf()) {
      $scope.isCurrentMonth = true;
    } else {
      $scope.isCurrentMonth = false;
    }
    custom.prevInfo = await loadData();

    setData();
    setCalendarInfo();
  };
  $scope.nextMonth = async function () {
    $scope.isLoading = true;
    $scope.targetStart = moment($scope.targetStart).add(1, 'months').valueOf();
    $scope.targetMonth = moment($scope.targetStart).format(custom.ymStr);
    if (moment($scope.targetStart).startOf('month').valueOf() == moment(custom.now).startOf('month').valueOf()) {
      $scope.isCurrentMonth = true;
    } else {
      $scope.isCurrentMonth = false;
    }
    custom.prevInfo = await loadData();
    setData();
    setCalendarInfo();
  };
  $scope.foldGroup = function (e, schedule) {
    if (!e.target.classList.contains('device-action')) {
      schedule.isFold = !schedule.isFold;
    }
  };
  $scope.newScheduleHandler = function (e, device, time) {
    customActionHandler('Edit Schedule', 'time', time, device);
  };
  $scope.changeContent = function (e, type, target, details) {
    $(e.target, $container).tooltipster('content', createTooltip(type, target, details));
  };
  $scope.changeBlockContent = function (e, type, target, details) {
    $(e.target.parentNode, $container).tooltipster('content', createBlockTooltip(type, target, details));
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

// 대시보드 상태 탭 생성
function makeTab() {
  let { custom, $scope } = self.ctx;
  if (custom.isSample) return;
  $scope.tabList = [];
  for (let i in self.ctx.stateController.statesValue) {
    $scope.tabList.push({
      label: 'thingplus.menu.' + i,
      id: i,
      isActive: i == self.ctx.stateController.stateValue,
    });
  }
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
    if (custom.dashboardParams.selectedYear) {
      custom.selectedYear = custom.dashboardParams.selectedYear;
    }
    if (custom.dashboardParams.selectedMonth) {
      custom.selectedMonth = custom.dashboardParams.selectedMonth;
    }
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

  custom.widgetFontSize = _.round((self.ctx.width / originWidth) * 10, 2);
  if (custom.widgetFontSize < 6.25) {
    custom.widgetFontSize = 6.25;
  }
  custom.$widget.css('font-size', `${custom.widgetFontSize}px`);

  // Header Height를 제외한 영역을 Main의 Height로 설정
  let tabHeight = custom.$widgetTab.outerHeight(true);
  let headerHeight = custom.$widgetHeader.outerHeight(true);
  let subHeaderHeight = custom.$widgetSubHeader.outerHeight(true);
  custom.$widgetContent.css(
    'height',
    `calc(100% - ${tabHeight + headerHeight + subHeaderHeight + custom.widgetFontSize * 2}px)`
  );

  self.ctx.detectChanges();
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

  self.ctx.rxjs.forkJoin(observables).subscribe(async devices => {
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
    custom.targetDatasources = [];
    custom.targetCustomer = [];
    custom.targetCustomer = custom.customerL2List.filter(customer => {
      if ($scope.selectedDevice != '') {
        return customer.child.findIndex(device => device.id.id == $scope.selectedDevice) != -1;
      } else if ($scope.selectedCustomerL2 != '') {
        return customer.id.id == $scope.selectedCustomerL2;
      } else if ($scope.selectedCustomerL1 != '') {
        return custom.relations[$scope.selectedCustomerL1].child.findIndex(child => child.id.id == customer.id.id);
      }
      return true;
    });
    $scope.scheduleList = custom.targetCustomer.map((customer, idx) => {
      return {
        index: idx,
        name: customer.name,
        label: customer.name,
        id: customer.id,
        type: 'CUSTOMER',
        timeList: [],
        isFold: false,
        child: customer.child
          .filter(device => {
            if ($scope.selectedDevice != '') {
              return device.id.id == $scope.selectedDevice;
            }
            return true;
          })
          .map((device, idx) => {
            custom.targetDatasources.push(device);
            return { index: idx, name: device.name, label: device.label, id: device.id, type: 'DEVICE', timeList: [] };
          }),
      };
    });
    custom.commonInfo = await loadAttributes();
    custom.holidayInfo = await loadHoliday();
    custom.prevInfo = await loadData();
    setData();
    setCalendarInfo();
    self.ctx.detectChanges();
  });
}

function setData() {
  let { custom, $scope } = self.ctx;
  let lastDate = moment($scope.targetStart).endOf('month').date();
  // 초기 셋팅 0으로 설정
  custom.scheduleInfo = {};
  for (let i in custom.targetCustomer) {
    custom.scheduleInfo[custom.targetCustomer[i].id.id] = [];
    for (let j = 1; j <= lastDate; j++) {
      custom.scheduleInfo[custom.targetCustomer[i].id.id].push(0);
    }
  }
  for (let i in custom.targetDatasources) {
    custom.scheduleInfo[custom.targetDatasources[i].id.id] = [];
    for (let j = 1; j <= lastDate; j++) {
      custom.scheduleInfo[custom.targetDatasources[i].id.id].push(0);
    }
  }

  let nowTs = moment(custom.now).startOf('day').valueOf();
  // 과거 값 세팅
  for (let i in custom.targetDatasources) {
    for (let j in custom.prevInfo[i].TP_PlannedWorkTimeDay) {
      let targetTs = moment(custom.prevInfo[i].TP_PlannedWorkTimeDay[j].ts).startOf('day').valueOf();
      if (nowTs > targetTs) {
        let index = _.floor((targetTs - $scope.targetStart) / DAY_MS);
        custom.scheduleInfo[custom.targetDatasources[i].id.id][index] = _.round(
          custom.prevInfo[i].TP_PlannedWorkTimeDay[j].value / HOUR_MS,
          1
        );
      }
    }
  }

  // 미래 값 정리
  custom.futureInfo = {};
  for (let i in custom.targetDatasources) {
    custom.futureInfo[custom.targetDatasources[i].id.id] = {};
    for (let j in custom.commonInfo[i]) {
      if (custom.commonInfo[i][j].value) {
        custom.futureInfo[custom.targetDatasources[i].id.id][custom.commonInfo[i][j].key] =
          custom.commonInfo[i][j].value;
      }
    }
  }

  // 미래 값 세팅
  for (let i in custom.targetDatasources) {
    // 기본 값 세팅
    let plannedOperationTime = custom.futureInfo[custom.targetDatasources[i].id.id].plannedOperationTime;
    for (let j = 1; j <= lastDate; j++) {
      let targetTs = moment($scope.targetStart).startOf('day').date(j).valueOf();
      if (nowTs <= targetTs) {
        if (!plannedOperationTime.isDivideByWeek) {
          custom.scheduleInfo[custom.targetDatasources[i].id.id][j - 1] = _.round(
            plannedOperationTime.everyday / HOUR_MS,
            1
          );
        } else {
          let day = moment($scope.targetStart).date(j).isoWeekday();
          custom.scheduleInfo[custom.targetDatasources[i].id.id][j - 1] = _.round(
            plannedOperationTime.week[day - 1] / HOUR_MS,
            1
          );
        }
      }
    }

    // 커스텀 값 세팅
    let plannedCustom = custom.futureInfo[custom.targetDatasources[i].id.id].plannedCustom;
    for (let j = 1; j <= lastDate; j++) {
      let targetTs = moment($scope.targetStart).startOf('day').date(j).valueOf();
      if (nowTs <= targetTs) {
        for (let k in plannedCustom) {
          if (moment(+k).startOf('day').valueOf() == targetTs) {
            custom.scheduleInfo[custom.targetDatasources[i].id.id][j - 1] = _.round(plannedCustom[k] / HOUR_MS, 1);
          }
        }
      }
    }

    // 휴일 값 세팅
    for (let j = 1; j <= lastDate; j++) {
      let targetTs = moment($scope.targetStart).startOf('day').date(j).valueOf();
      if (nowTs <= targetTs && checkHoliday(targetTs, custom.holidayInfo)) {
        custom.scheduleInfo[custom.targetDatasources[i].id.id][j - 1] = 0;
      }
    }
  }
}

function setCalendarInfo() {
  console.time('1');
  let { custom, $scope, $container } = self.ctx;
  let firstDay = moment($scope.targetStart).startOf('month').isoWeekday();
  let lastDate = moment($scope.targetStart).endOf('month').date();
  let lastDay = moment($scope.targetStart).endOf('month').isoWeekday();
  $scope.weekList = [];
  let count = 0;
  $scope.weekList.push({
    label: firstDay <= 4 ? t('thingplus.time-format.week-value', { week: ++count }) : '',
    length: 8 - firstDay,
  });
  for (let i = 8 - firstDay + 1; i < lastDate - lastDay + 1; i += 7) {
    $scope.weekList.push({
      label: t('thingplus.time-format.week-value', { week: ++count }),
      length: 7,
    });
  }
  $scope.weekList.push({
    label: lastDay >= 4 ? t('thingplus.time-format.week-value', { week: ++count }) : '',
    length: lastDay,
  });

  $scope.dayList = [];
  $scope.dateList = [];
  for (let i in $scope.scheduleList) {
    $scope.scheduleList[i].timeList = [];
    $scope.scheduleList[i].count = $scope.scheduleList[i].child.length;
    for (let j in $scope.scheduleList[i].child) {
      $scope.scheduleList[i].child[j].timeList = [];
    }
  }

  for (let i = 1; i <= lastDate; i++) {
    let nowTs = moment(custom.now).startOf('day').valueOf();
    let targetTs = $scope.targetStart + (i - 1) * DAY_MS;

    let isHoliday = checkHoliday(targetTs, custom.holidayInfo);
    let isWeekend = moment($scope.targetStart).date(i).isoWeekday() > 5;
    $scope.dayList.push({
      label: t('thingplus.time-format.weekday-short.' + moment($scope.targetStart).date(i).format('ddd').toLowerCase()),
      isHoliday: isHoliday,
      isWeekend: isWeekend,
    });
    $scope.dateList.push({
      label: i,
      isHoliday: isHoliday,
      isWeekend: isWeekend,
    });
    for (let j in $scope.scheduleList) {
      let valueAcc = 0;
      for (let k in $scope.scheduleList[j].child) {
        let color = '';
        let value = custom.scheduleInfo[$scope.scheduleList[j].child[k].id.id][i - 1];
        if (value > 8) {
          color =
            nowTs > targetTs ? getStyle('--tb-service-prev-schedule-1') : getStyle('--tb-service-next-schedule-1');
        } else if (value > 4) {
          color =
            nowTs > targetTs ? getStyle('--tb-service-prev-schedule-2') : getStyle('--tb-service-next-schedule-2');
        } else {
          color =
            nowTs > targetTs ? getStyle('--tb-service-prev-schedule-3') : getStyle('--tb-service-next-schedule-3');
        }
        valueAcc += value;
        $scope.scheduleList[j].child[k].timeList.push({
          index: i,
          value: value,
          color: color,
          todayDif: nowTs - targetTs,
          isHoliday: isHoliday,
          isWeekend: isWeekend,
        });
      }
      $scope.scheduleList[j].timeList.push({
        index: i,
        value: valueAcc,
        todayDif: nowTs - targetTs,
        isHoliday: isHoliday,
        isWeekend: isWeekend,
      });
    }
  }

  $scope.isLoading = false;
  self.ctx.detectChanges();
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
    { name: t('thingplus.selector.entire-device'), label: t('thingplus.selector.entire-device'), value: '' },
  ].concat($scope.deviceList);
}

function loadAttributes() {
  let { custom, $scope } = self.ctx;
  return new Promise(resolve => {
    let observables = [];
    for (let i in custom.targetDatasources) {
      let entityId = custom.targetDatasources[i].id;
      observables.push(
        self.ctx.attributeService.getEntityAttributes(entityId, 'SERVER_SCOPE', [
          'plannedOperationTime',
          'plannedCustom',
        ])
      );
    }
    self.ctx.rxjs.forkJoin(observables).subscribe(datas => {
      resolve(datas);
    });
  });
}

function loadHoliday() {
  let { custom, $scope } = self.ctx;
  return new Promise(resolve => {
    let entityId = custom.ownerDatasource.entity.id;
    self.ctx.attributeService.getEntityAttributes(entityId, 'SERVER_SCOPE', ['plannedHoliday']).subscribe(datas => {
      let result = [];
      if (datas && datas[0]) {
        result = datas[0].value;
      }

      resolve(result);
    });
  });
}

function loadData() {
  let { custom, $scope } = self.ctx;
  return new Promise(resolve => {
    let observables = [];
    let start = $scope.targetStart;
    let end = moment($scope.targetStart).endOf('month').valueOf();
    let key = 'TP_PlannedWorkTimeDay';
    for (let i in custom.targetDatasources) {
      let entityId = custom.targetDatasources[i].id;
      observables.push(
        self.ctx.http.get(
          `/api/plugins/telemetry/${entityId.entityType}/${entityId.id}/values/timeseries?limit=50000&agg=NONE&keys=${key}&startTs=${start}&endTs=${end}&useStrictDataTypes=true`
        )
      );
    }
    self.ctx.rxjs.forkJoin(observables).subscribe(datas => {
      resolve(datas);
    });
  });
}

function updateDashboardState() {
  let { custom, $scope } = self.ctx;
  let target,
    param = {};
  if ($scope.selectedDevice != '') {
    target = custom.relations[$scope.selectedDevice];
  } else if ($scope.selectedCustomerL2 != '') {
    target = custom.relations[$scope.selectedCustomerL2];
  } else if ($scope.selectedCustomerL1 != '') {
    target = custom.relations[$scope.selectedCustomerL1];
  }
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
  param.selectedYear = $scope.selectedYear;
  param.selectedMonth = $scope.selectedMonth;

  self.ctx.stateController.updateState('schedule-custom', param, null);
  self.ctx.updateAliases();
}

function handleHeaderAction(descriptor) {
  let { custom } = self.ctx;
  self.ctx.actionsApi.handleWidgetAction(
    {},
    descriptor,
    custom.ownerDatasource.entity.id,
    custom.ownerDatasource.entityName,
    {},
    custom.ownerDatasource.entityLabel
  );
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

function mouseDownHandler(e) {
  let { custom } = self.ctx;
  custom.dragPos = [e.clientX, e.clientY, custom.$calendarBody[0].scrollTop, custom.$calendarBodyRight[0].scrollLeft];
  custom.$calendarBodyRight.css({ cursor: 'grabbing' });

  custom.$calendarBodyRight.on('mousemove', mouseMoveHandler);
  custom.$calendarBodyRight.on('mouseup', mouseUpHandler);
  custom.$calendarBodyRight.on('mouseleave', mouseUpHandler);
}

function mouseUpHandler(e) {
  let { custom } = self.ctx;
  custom.$calendarBodyRight.off('mousemove');
  custom.$calendarBodyRight.off('mouseup');

  custom.$calendarBodyRight.css({ cursor: 'grab' });
}

function mouseMoveHandler(e) {
  let { custom } = self.ctx;
  // How far the mouse has been moved
  let sensitivity = 1;
  const dx = (custom.dragPos[0] - e.clientX) / sensitivity;
  const dy = (custom.dragPos[1] - e.clientY) / sensitivity;

  // Scroll the element
  custom.$calendarBody[0].scrollTop = custom.dragPos[2] + dy;
  custom.$calendarBodyRight[0].scrollLeft = custom.dragPos[3] + dx;
  custom.$calendarHeaderRight[0].scrollLeft = custom.dragPos[3] + dx;
}

function checkHoliday(targetTs, holidayInfo) {
  for (let i in holidayInfo) {
    let month = Number(holidayInfo[i].date.split('-')[0]);
    let date = Number(holidayInfo[i].date.split('-')[1]);
    let targetDate = moment()
      .month(month - 1)
      .date(date)
      .startOf('day')
      .valueOf();
    if (targetDate == targetTs) {
      if (holidayInfo[i].isAlways) {
        return true;
      } else {
        if (holidayInfo[i].startYear <= moment(targetTs).year() && holidayInfo[i].endYear >= moment(targetTs).year()) {
          return true;
        }
      }
    }
  }
  return false;
}

function getStyle(target) {
  let { custom } = self.ctx;
  return custom.computedStyle.getPropertyValue(target);
}

function createTooltip(type, target, details) {
  let { custom } = self.ctx;
  const actionList = {
    customerL2: [
      {
        label: t('thingplus.action.set-schedule'),
        handler: 'Set Default Schedule',
      },
      { label: t('thingplus.action.reset'), handler: 'Reset Default Schedule' },
    ],
    device: [
      { label: t('thingplus.action.set-schedule'), handler: 'Set Default Schedule' },
      { label: t('thingplus.action.reset'), handler: 'Reset Default Schedule' },
    ],
    time: [
      { label: t('thingplus.action.edit'), handler: 'Edit Schedule' },
      { label: t('thingplus.action.reset'), handler: 'Reset Schedule' },
      { label: t('thingplus.action.delete'), handler: 'Delete Schedule', style: { color: 'red' } },
    ],
  };
  let targetActionList = actionList[type];
  let contentStyle = {
    'background-color': getStyle('--tb-service-background-0'),
    border: `1px solid ${getStyle('--tb-service-border-1')}`,
    'box-shadow': `0 0 0.5em ${getStyle('--tb-service-font-4')}`,
    'min-width': `${100 / STANDARD_WINDOW_SIZE}vw`,
  };
  let rowStyle = {
    width: '100%',
    padding: `${10 / STANDARD_WINDOW_SIZE}vw`,
    fontSize: `${12 / STANDARD_WINDOW_SIZE}vw`,
    cursor: 'pointer',
    color: getStyle('--tb-service-font-4'),
    'border-top': `1px solid ${getStyle('--tb-service-border-1')}`,
  };

  let $content = $('<div></div>').css(contentStyle);
  for (let i in targetActionList) {
    let $action = $('<div></div>').css(rowStyle);
    if (i == 0) {
      $action.css('border-top', 'none');
    }
    $action.addClass('action');
    $action.text(targetActionList[i].label);
    $action.on('mouseenter', function () {
      $action.css('background-color', getStyle('--tb-service-background-2'));
    });
    $action.on('mouseleave', function () {
      $action.css('background-color', 'transparent');
    });
    $action.on('click', function (e) {
      $('.tooltip').tooltipster('hide');
      customActionHandler(targetActionList[i].handler, type, target, details);
    });
    if (targetActionList[i].style) {
      $action.css(targetActionList[i].style);
    }
    $content.append($action);
  }
  return $content;
}

function createBlockTooltip(type, target, details) {
  let contentStyle = {
    'background-color': 'rgba(0,0,0,0.8)',
    'min-width': `${100 / STANDARD_WINDOW_SIZE}vw`,
    'border-radius': `${8 / STANDARD_WINDOW_SIZE}vw`,
  };
  let rowStyle = {
    width: '100%',
    padding: `${10 / STANDARD_WINDOW_SIZE}vw`,
    display: 'flex',
    'justify-content': 'space-between',
    'align-items': 'center',
    fontSize: `${12 / STANDARD_WINDOW_SIZE}vw`,
  };
  let labelStyle = {
    color: getStyle('--tb-service-font-1'),
  };
  let valueStyle = {
    color: getStyle('--tb-service-font-0'),
  };
  let $content = $('<div></div>').css(contentStyle);
  let $row = $('<div></div>').css(rowStyle);
  let $label = $('<div></div>').css(labelStyle).text(t('thingplus.energy.planned-time'));
  let $value = $('<div></div>')
    .css(valueStyle)
    .text(t('thingplus.time-format.hours-value', { hour: target.value }));
  $row.append($label);
  $row.append($value);
  $content.append($row);

  return $content;
}

function customActionHandler(action, type, target, details) {
  let { custom, $scope } = self.ctx;
  let targetIndex = $scope.customActionList.findIndex(x => x.name == action);
  if (targetIndex == -1) return;
  let descriptor = $scope.customActionList[targetIndex];
  let entityId = target.id;
  let entityName = target.name;
  let entityLabel = target.label;
  if (descriptor) {
    if (type == 'time') {
      entityId = details.id;
      entityName = details.name;
      entityLabel = details.label;
    }
    self.ctx.actionsApi.handleWidgetAction({}, descriptor, entityId, entityName, target, entityLabel);
  }
}
