const ENTITY_TYPE = ['TENANT', 'CUSTOMER_L1', 'CUSTOMER_L2'];
const STATUS = {
  stopped: { priority: 0, content: 'thingplus.state.stopped', color: 'var(--tb-service-state-stopped)' },
  waiting: { priority: 1, content: 'thingplus.state.waiting', color: 'var(--tb-service-state-waiting)' },
  working: { priority: 2, content: 'thingplus.state.working', color: 'var(--tb-service-state-working)' },
  trial: { priority: 3, content: 'thingplus.state.trial', color: 'var(--tb-service-state-trial)' },
  unconnected: {
    priority: 4,
    content: 'thingplus.state.unconnected',
    color: 'var(--tb-service-state-unconnected)',
  },
};
const ANALYSIS_MAP = ['stopped', 'waiting', 'working', 'trial', 'unconnected'];
const OPERATION_MAP = {
  WORK: 'working',
  WAIT: 'waiting',
  STOP: 'stopped',
};
const STANDARD_WINDOW_SIZE = 1920 / 100;
const DAY_MS = 86400000;
self.onInit = async function () {
  self.ctx.custom = {};
  let { custom, $scope } = self.ctx;
  defineVariables();
  setTitle();
  linkEvent();
  makeTab();
  getDashboardParameter();
  makeHead();

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
    updateView();
  }
};

self.onResize = function () {
  self.ctx.custom.resizeThrottle();
};

self.onDataUpdated = function () {};

self.actionSources = function () {
  return {
    actionCellButton: {
      name: 'widget-action.action-cell-button',
      multiple: true,
    },
    customAction: {
      name: 'Custom Action',
      multiple: true,
    },
    addModifiedState: {
      name: 'Add Modified State',
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
  custom.$widgetContent = $('.widget-content', $container);
  custom.$dateRange = $('.date-range', $container);
  custom.$chartSection = $('.chart-section', $container);
  custom.$widgetFooter = $('.widget-footer', $container);

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
  $scope.legendList = [
    { key: 'stopped', color: 'var(--tb-service-state-stopped)', label: t('thingplus.state.stopped') },
    { key: 'waiting', color: 'var(--tb-service-state-waiting)', label: t('thingplus.state.waiting') },
    { key: 'working', color: 'var(--tb-service-state-working)', label: t('thingplus.state.working') },
    { key: 'trial', color: 'var(--tb-service-state-trial)', label: t('thingplus.state.trial') },
    { key: 'unconnected', color: 'var(--tb-service-state-unconnected)', label: t('thingplus.state.unconnected') },
  ];

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
  custom.mainData = [];

  custom.targetDatasources = [self.ctx.defaultSubscription.configuredDatasources[1]];
  custom.originDataKeys = custom.targetDatasources[0].dataKeys;
  custom.t = t;
  custom.ymdhms = t('thingplus.time-format.ymdhms');
  custom.ymdhm = t('thingplus.time-format.ymdhm');
  custom.ymd = t('thingplus.time-format.ymd');
  custom.currentPage = 1;
  custom.countPerPage = 10;
  custom.isUpdated = false;
  custom.selectedIndex = 0;
  let originWidth = self.ctx.settings.widget.originWidth;
  if (self.ctx.isMobile) {
    originWidth = 960;
  }
  custom.widgetFontSize = _.round((self.ctx.width / originWidth) * 10, 2);
  if (custom.widgetFontSize < 6.25) {
    custom.widgetFontSize = 6.25;
  }
  custom.headColomns = self.ctx.defaultSubscription.configuredDatasources[1].dataKeys;

  let now = moment().valueOf();
  custom.endTs = moment(now).valueOf();
  custom.startTs = moment(custom.endTs).subtract(7, 'days').valueOf();
  custom.analysisEndTs = moment(custom.endTs).subtract(1, 'hours').startOf('hours').valueOf();
  custom.realDataNeeded = true;
  $scope.dateRange = `${moment(custom.startTs).format(custom.ymdhms)} ~ ${moment(custom.endTs).format(custom.ymdhms)}`;
  $scope.startDate = moment(custom.startTs).toDate();
  $scope.endDate = moment(custom.endTs).toDate();
  $scope.viewStartDate = moment(custom.startTs).format(custom.ymd);
  $scope.viewEndDate = moment(custom.endTs).format(custom.ymd);
  $scope.nowDate = moment(custom.endTs).toDate();
  custom.dateSelection = [custom.startTs, custom.endTs];
  $scope.actionList = [];
  let descriptors = self.ctx.actionsApi.getActionDescriptors('customAction');
  for (let i in descriptors) {
    $scope.actionList.push({
      icon: descriptors[i].icon,
      label: t(descriptors[i].name),
      action: handleCustomAction,
      descriptor: descriptors[i],
    });
  }
  $scope.cellActionList = self.ctx.actionsApi.getActionDescriptors('actionCellButton').map(x => {
    return { name: x.name, icon: x.icon, action: (e, i) => handleCellAction(x, i) };
  });
  $scope.hasCellAction = $scope.cellActionList.length > 0;
  $scope.actionSize = `${$scope.cellActionList.length * 2 + 3.36 + ($scope.cellActionList.length - 1) * 0.5}em`;
}

// Create Widget Title
function setTitle() {
  let { custom } = self.ctx;
  custom.$widgetTitle.html(t(self.ctx.widget.config.title));
  custom.$widgetTitle.css(self.ctx.widget.config.titleStyle);
}

function linkEvent() {
  let { custom, $scope } = self.ctx;
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
  $scope.setStartDate = function (e) {
    $scope.startDate = e;
    $scope.viewStartDate = moment(e).format(custom.ymd);
  };
  $scope.setEndDate = function (e) {
    $scope.endDate = e;
    $scope.viewEndDate = moment(e).format(custom.ymd);
  };
  $scope.addModifiedState = function (e) {
    let isExistUnconnected = false;
    for (let i = 0; i < custom.labelList[1].length; i++) {
      if (
        custom.labelList[1][i].status == 'unconnected' &&
        ((custom.labelList[1][i].time >= custom.dateSelection[0] &&
          custom.labelList[1][i].time < custom.dateSelection[1]) ||
          (custom.labelList[1][i].time < custom.dateSelection[0] &&
            custom.labelList[1][i].nextTime > custom.dateSelection[0]))
      ) {
        isExistUnconnected = true;
      }
    }
    if (isExistUnconnected) {
      let descriptor = self.ctx.actionsApi.getActionDescriptors('addModifiedState');
      handleCustomAction(descriptor[0]);
    } else {
      window.alert(t('thingplus.help.no-unconnected'));
    }
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
  $scope.legendEnter = function (e, d) {
    $(`.bar-rect`).addClass('bar-rect-active');
    $(`.bar-rect-${d.key}`).removeClass('bar-rect-active');
    $(`.bar-rect-${d.key}`).addClass('bar-rect-target');
  };
  $scope.legendLeave = function (e, d) {
    $(`.bar-rect`).removeClass('bar-rect-active');
    $(`.bar-rect`).removeClass('bar-rect-target');
  };
  $scope.getPrevPage = function () {
    if (custom.currentPage > 1) {
      custom.currentPage--;
      initPage();
      makeBody();
      insertData();
    }
  };
  $scope.getNextPage = function () {
    if (custom.currentPage < custom.totalPage) {
      custom.currentPage++;
      initPage();
      makeBody();
      insertData();
    }
  };
  $scope.getFirstPage = function () {
    if (custom.currentPage > 1) {
      custom.currentPage = 1;
      initPage();
      makeBody();
      insertData();
    }
  };
  $scope.getLastPage = function () {
    if (custom.currentPage < custom.totalPage) {
      custom.currentPage = custom.totalPage;
      initPage();
      makeBody();
      insertData();
    }
  };
  $scope.changePage = function (e, page) {
    if (!page.isActive) {
      custom.currentPage = page.number;
      initPage();
      makeBody();
      insertData();
    }
  };
  $scope.changeSort = function (e, th) {
    if (th.isAction) return;
    if (th.index == custom.selectedIndex) {
      if (th.order != 'ASC') {
        $scope.thList[th.index].order = 'ASC';
      } else {
        $scope.thList[th.index].order = 'DESC';
      }
    } else {
      $scope.thList.forEach(x => (x.order = ''));
      custom.selectedIndex = th.index;
      $scope.thList[th.index].order = 'ASC';
    }
    initPage();
    makeBody();
    sortData();
    insertData();
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
    if (custom.dashboardParams.startTs) {
      custom.startTs = custom.dashboardParams.startTs;
      $scope.startDate = moment(custom.startTs).toDate();
      $scope.viewStartDate = moment(custom.startTs).format(custom.ymd);
    }
    if (custom.dashboardParams.endTs) {
      custom.endTs = moment(custom.dashboardParams.endTs).endOf('day').valueOf();
      if (custom.endTs > moment().valueOf()) {
        custom.endTs = moment().valueOf();
      }
      $scope.endDate = moment(custom.endTs).toDate();
      $scope.viewEndDate = moment(custom.endTs).format(custom.ymd);
      if (custom.endTs > moment().subtract(1, 'hours').startOf('hours').valueOf()) {
        custom.realDataNeeded = true;
        custom.analysisEndTs = moment(custom.endTs).subtract(1, 'hours').startOf('hours').valueOf();
      } else {
        custom.realDataNeeded = false;
        custom.analysisEndTs = custom.endTs;
      }
    }
    $scope.dateRange = `${moment(custom.startTs).format(custom.ymdhms)} ~ ${moment(custom.endTs).format(
      custom.ymdhms
    )}`;
    custom.dateSelection = [custom.startTs, custom.endTs];
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
  let headerHeight = custom.$widgetHeader.outerHeight(true);
  let footerHeight = custom.$widgetFooter.outerHeight(true);
  custom.$widgetContent.css('height', `calc(100% - ${headerHeight + footerHeight}px)`);

  self.ctx.detectChanges();
}

// 헤더 부분 생성
function makeHead() {
  let { custom, $scope } = self.ctx;
  $scope.thList = [];
  for (let i in custom.headColomns) {
    $scope.thList.push({
      index: i,
      key: custom.headColomns[i].name,
      label: t(custom.headColomns[i].label),
      order: custom.selectedIndex == i ? 'ASC' : '',
    });
  }
}

// 페이지에 맞는 데이터 출력 및 페이지 표시
function initPage() {
  let { custom, $scope } = self.ctx;
  custom.totalPage = Math.ceil(custom.mainData.length / custom.countPerPage);
  // 현재 페이지 기준 왼쪽이 5개 오른쪽이 4개가 되도록
  custom.startPage = custom.currentPage - 5;
  // 6번까지는 왼쪽이 5개 이하이므로 시작을 1로 고정
  if (custom.currentPage <= 6) {
    custom.startPage = 1;
  }
  // 마지막에서 5칸 아래페이지 부터는 오른쪽이 4개 이하이므로 시작을 마지막에서 9을 뺀것으로 고정
  if (custom.totalPage >= 10 && custom.currentPage > custom.totalPage - 5) {
    custom.startPage = custom.totalPage - 9;
  }
  custom.endPage = custom.startPage + 9;
  // 끝 페이지가 총 페이지보다 크면 총페이지를 끝 페이지로
  if (custom.endPage > custom.totalPage) {
    custom.endPage = custom.totalPage;
  }

  // 페이지 리스트 구성
  $scope.pageList = [];
  for (let i = custom.startPage; i <= custom.endPage; i++) {
    $scope.pageList.push({
      number: i,
      isBig: i > 99,
      isActive: custom.currentPage == i,
    });
  }

  custom.startIndex = (custom.currentPage - 1) * custom.countPerPage;
  custom.endIndex = custom.currentPage * custom.countPerPage - 1;
  // 끝 페이지가 데이터 소스의 길이보다 많으면 데이터 소스의 길이로 변경
  if (custom.endIndex > custom.mainData.length - 1) {
    custom.endIndex = custom.mainData.length - 1;
  }
  custom.targetData = custom.mainData.slice(custom.startIndex, custom.endIndex + 1);
}

// 데이터 재 정렬
function sortData() {
  let { custom, $scope } = self.ctx;
  // subscribe하는 데이터 키의 레이블 중 정렬기준으로 선택된 레이블의 인덱스 추출
  // 정렬에 사용할 객체를 깊은 복사
  let selectedKey = $scope.thList[custom.selectedIndex].key;
  let selectedOrder = $scope.thList[custom.selectedIndex].order;
  if (selectedOrder == 'ASC') {
    custom.mainData.sort((a, b) => {
      if (a[selectedKey] > b[selectedKey]) return 1;
      if (a[selectedKey] < b[selectedKey]) return -1;
      return 0;
    });
  } else {
    custom.mainData.sort((a, b) => {
      if (a[selectedKey] > b[selectedKey]) return -1;
      if (a[selectedKey] < b[selectedKey]) return 1;
      return 0;
    });
  }
}

// 테이블 바디 생성
function makeBody() {
  let { custom, $scope } = self.ctx;
  $scope.trList = [];
  // 현재 페이지의 데이터 수 만큼 행 출력
  for (let i = custom.startIndex; i <= custom.endIndex; i++) {
    let tdList = [];
    for (let j in custom.headColomns) {
      tdList.push({ index: j, name: custom.headColomns[j].name, style: '', value: '' });
    }
    $scope.trList.push({
      index: i,
      tdList: tdList,
    });
  }
}

// 데이터 삽입
function insertData() {
  let { custom, $scope } = self.ctx;
  for (let i = custom.startIndex; i <= custom.endIndex; i++) {
    for (let j in custom.headColomns) {
      let key = custom.headColomns[j].name;
      let data = custom.mainData[i][key];

      // Apply cell style function
      if (custom.headColomns[j].settings.useCellStyleFunction) {
        try {
          let styleFunction = new Function('value', 'ctx', custom.headColomns[j].settings.cellStyleFunction);
          let style = styleFunction(data, self.ctx);
          $scope.trList[i - custom.startIndex].tdList[j].style = style;
        } catch (err) {
          console.error(err);
        }
      }
      // Apply cell action function
      if (custom.headColomns[j].settings.useCellActionFunction) {
        try {
          let actionFunction = new Function(
            'value',
            'tr',
            'td',
            'ctx',
            custom.headColomns[j].settings.cellActionFunction
          );
          $scope.trList[i - custom.startIndex].tdList[j].action = function (e) {
            actionFunction(
              data,
              $scope.trList[i - custom.startIndex],
              $scope.trList[i - custom.startIndex].tdList[j],
              self.ctx
            );
          };
        } catch (err) {
          console.error(err);
        }
      }
      // Apply cell content function
      if (custom.headColomns[j].settings.useCellContentFunction) {
        try {
          let contentFunction = new Function('value', 'ctx', custom.headColomns[j].settings.cellContentFunction);
          data = contentFunction(data, self.ctx);
        } catch (err) {
          console.error(err);
        }
      }

      $scope.trList[i - custom.startIndex].tdList[j].value = data;
    }
  }
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
    { name: t('thingplus.selector.entire-device'), label: t('thingplus.selector.entire-device'), value: '' },
  ].concat($scope.deviceList);
}

async function updateView() {
  let { custom, $scope } = self.ctx;
  if (custom.targetDatasources[0].entityType == 'DEVICE') {
    custom.keyDatas = {
      TP_AnalysisState: [{ ts: custom.startTs, value: '4' }],
      TP_OperationState: [],
    };

    let datas = await getInitialStatus();
    for (let i in datas) {
      custom.keyDatas[i][0].value = datas[i][0].value;
    }
    let realTimeData = await getInitialRealTimeStatus();
    for (let i in realTimeData) {
      custom.keyDatas[i].push(realTimeData[i][0]);
    }

    let realDatas = [];
    if (custom.realDataNeeded) {
      realDatas = await loadRealTimeData();
      custom.operationData = [];
      custom.connectionData = [];
      if (realDatas.TP_OperationState) {
        custom.operationData = realDatas.TP_OperationState.map(x => {
          return { ts: x.ts, value: OPERATION_MAP[x.value] };
        });
      }
      if (realDatas.TP_ConnectionState) {
        custom.connectionData = _.cloneDeep(realDatas.TP_ConnectionState);
      }
    }

    loadData();
  }
}

async function getInitialStatus() {
  let { custom, $scope } = self.ctx;
  if (!custom.isSample) {
    let keys = ['TP_AnalysisState'];
    let entityId = custom.targetDatasources[0].entityId;

    return await self.ctx.http
      .get(
        `/api/plugins/telemetry/DEVICE/${entityId}/values/timeseries?limit=1&agg=NONE&keys=${keys.join(
          ','
        )}&startTs=0&endTs=${custom.startTs}`
      )
      .toPromise();
  }
}

async function getInitialRealTimeStatus() {
  let { custom, $scope } = self.ctx;
  if (!custom.isSample) {
    let keys = ['TP_OperationState'];
    let entityId = custom.targetDatasources[0].entityId;

    return await self.ctx.http
      .get(
        `/api/plugins/telemetry/DEVICE/${entityId}/values/timeseries?limit=1&agg=NONE&keys=${keys.join(
          ','
        )}&startTs=0&endTs=${custom.analysisEndTs}`
      )
      .toPromise();
  }
}

async function loadRealTimeData() {
  let { custom, $scope } = self.ctx;
  if (!custom.isSample) {
    let keys = ['TP_OperationState', 'TP_ConnectionState'];
    let entityId = custom.targetDatasources[0].entityId;

    return await self.ctx.http
      .get(
        `/api/plugins/telemetry/DEVICE/${entityId}/values/timeseries?limit=50000&agg=NONE&keys=${keys.join(
          ','
        )}&startTs=${custom.analysisEndTs}&endTs=${custom.endTs}`
      )
      .toPromise();
  }
}

function loadData() {
  let { custom, $scope } = self.ctx;
  let keys = ['TP_AnalysisState', 'TP_ModifiedState'];
  let entityId = custom.targetDatasources[0].entityId;

  self.ctx.http
    .get(
      `/api/plugins/telemetry/DEVICE/${entityId}/values/timeseries?limit=50000&agg=NONE&keys=${keys.join(
        ','
      )}&startTs=${custom.startTs}&endTs=${custom.endTs}`
    )
    .subscribe(datas => {
      if (datas.TP_AnalysisState) {
        custom.analysisData = _.cloneDeep(datas.TP_AnalysisState);
      } else {
        custom.analysisData = [];
      }
      custom.analysisData.push(custom.keyDatas.TP_AnalysisState[0]);
      custom.modifiedData = _.cloneDeep(datas.TP_ModifiedState);
      if (!custom.modifiedData) {
        custom.modifiedData = [];
      }
      for (let i in custom.modifiedData) {
        custom.modifiedData[i] = JSON.parse(custom.modifiedData[i].value);
      }
      delete datas.TP_AnalysisState;
      delete datas.TP_ModifiedState;

      // 레이블 리스트의 틀 마련
      custom.labelList = [[]];

      let newDatasource = _.cloneDeep(custom.targetDatasources[0]);
      newDatasource.tag = 'modified';
      custom.targetDatasources.push(newDatasource);

      if (custom.realDataNeeded) {
        let lastState = custom.keyDatas['TP_OperationState'][0].value;

        custom.operationData = custom.operationData.concat(custom.connectionData);
        custom.operationData.sort((a, b) => {
          if (a.ts == b.ts) {
            if (b.value == 'true' || b.value == 'false') {
              return 1;
            } else {
              return -1;
            }
          }
          return a.ts - b.ts;
        });

        for (let i = 0; i < custom.operationData.length; i++) {
          if (custom.operationData[i].value === 'false') {
            custom.operationData[i].value = 'unconnected';
            if (custom.operationData[i - 1]) {
              lastState = custom.operationData[i - 1].value;
            }
          }
          if (custom.operationData[i].value === 'true') {
            custom.operationData[i].value = lastState;
          }
        }
      }

      for (let i = custom.analysisData.length - 1; i >= 0; i--) {
        custom.labelList[0].push({
          device: custom.targetDatasources[0],
          index: i,
          time: custom.analysisData[i].ts,
          nextTime: custom.analysisData[i - 1] ? custom.analysisData[i - 1].ts : custom.endTs,
          status: ANALYSIS_MAP[custom.analysisData[i].value],
        });
      }
      if (custom.realDataNeeded) {
        // 분석 값의 마지막과 실시간 값의 처음이 같으면 분석 값의 마지막 끝 시간을 실시간 값의 처음 값의 끝 시간으로 변경
        if (_.isNil(custom.operationData[0])) {
          custom.labelList[0][custom.labelList[0].length - 1].nextTime = custom.endTs;
        } else if (
          custom.operationData[0].value == ANALYSIS_MAP[custom.analysisData[custom.analysisData.length - 1].value]
        ) {
          if (custom.operationData[1]) {
            custom.labelList[0][custom.labelList[0].length - 1].nextTime = custom.operationData[1].ts;
          } else {
            custom.labelList[0][custom.labelList[0].length - 1].nextTime = custom.endTs;
          }
        } else {
          custom.labelList[0][custom.labelList[0].length - 1].nextTime = custom.operationData[0].ts;
        }

        // 남은 실시간 값이 있다면 레이블 리스트에 추가
        for (let i = 0; i < custom.operationData.length; i++) {
          custom.labelList[0].push({
            device: custom.targetDatasources[0],
            index: i,
            time: custom.operationData[i].ts,
            nextTime: custom.operationData[i + 1] ? custom.operationData[i + 1].ts : custom.endTs,
            status: custom.operationData[i].value,
          });
        }
      }

      for (let i in custom.labelList[0]) {
        custom.labelList[0][i].index = i;
      }

      custom.labelList.push(_.cloneDeep(custom.labelList[0]));

      // TP_ModifiedState를 이용해서 custom.labelList[1]에 레이블값 기입
      custom.mainData = [];
      for (let i = custom.modifiedData.length - 1; i >= 0; i--) {
        let targetData = custom.modifiedData[i];

        custom.mainData.push({
          range:
            moment(targetData.startTs).format('YYYY-MM-DD HH:mm') +
            ' ~ ' +
            moment(targetData.endTs).format('YYYY-MM-DD HH:mm'),
          state: t(`thingplus.state.${ANALYSIS_MAP[targetData.state]}`),
          author: targetData.author,
          phone: targetData.phone,
          modifiedTs: moment(targetData.modifiedTs).format('YYYY-MM-DD HH:mm'),
          targetData: targetData,
        });

        let newState = {
          device: custom.targetDatasources[0],
          index: 0,
          time: targetData.startTs,
          nextTime: targetData.endTs,
          status: ANALYSIS_MAP[targetData.state],
        };

        for (let j = 0; j < custom.labelList[1].length; j++) {
          if (targetData.startTs > custom.labelList[1][j].time && targetData.endTs < custom.labelList[1][j].nextTime) {
            // 추가 싱테기 원본 상태 사이에 껴있는경우
            custom.labelList[1].push({
              device: custom.targetDatasources[0],
              index: 0,
              time: targetData.endTs,
              nextTime: custom.labelList[1][j].nextTime,
              status: custom.labelList[1][j].status,
            });
            custom.labelList[1][j].nextTime = targetData.startTs;
          } else if (
            targetData.startTs == custom.labelList[1][j].time &&
            targetData.endTs < custom.labelList[1][j].nextTime
          ) {
            // 추가 상태와 원본 상태의 시작이 같은 경우 원본 상태의 시작을 추가 상태의 끝으로 변경
            custom.labelList[1][j].time = targetData.endTs;
            // 이전 상태와 추가 상태가 같은 경우 이전 상태는 삭제 하고 추가 상태의 시작 시간을 이전 상태의 시작 시간으로 변경
            if (custom.labelList[1][j - 1] && custom.labelList[1][j - 1].status == targetData.state) {
              newState.time = custom.labelList[1][j - 1].time;
              custom.labelList[1].splice(j - 1, 1);
            }
          } else if (
            targetData.startTs > custom.labelList[1][j].time &&
            targetData.endTs == custom.labelList[1][j].nextTime
          ) {
            // 추가 상태와 원본 상태의 끝이 같은 경우 원본 상태의 시작을 추가 상태의 끝으로 변경
            custom.labelList[1][j].nextTime = targetData.startTs;
            // 다음 상태와 추가 상태가 같은 경우 다음 상태는 삭제 하고 추가 상태의 끝 시간을 다음 상태의 끝 시간으로 변경
            if (custom.labelList[1][j + 1] && custom.labelList[1][j + 1].status == targetData.state) {
              newState.nextTime = custom.labelList[1][j + 1].nextTime;
              custom.labelList[1].splice(j + 1, 1);
            }
          } else if (
            targetData.startTs == custom.labelList[1][j].time &&
            targetData.endTs == custom.labelList[1][j].nextTime
          ) {
            custom.labelList[1].splice(j, 1);
            j--;
          }
        }

        custom.labelList[1].push(newState);
        custom.labelList[1].sort((a, b) => {
          return a.time - b.time;
        });
        for (let j in custom.labelList[1]) {
          if (custom.labelList[1][j - 1] && custom.labelList[1][j].status == custom.labelList[1][j - 1].status) {
            custom.labelList[1][j].time = custom.labelList[1][j - 1].time;
            custom.labelList[1].splice(j - 1, 1);
            j--;
          }
        }
      }

      $scope.isExistUnconnected = false;
      for (let i = 0; i < custom.labelList[1].length; i++) {
        // index 정리
        custom.labelList[1][i].index = i;
        if (custom.labelList[1][i].status == 'unconnected') {
          $scope.isExistUnconnected = true;
        }
      }

      initPage();
      makeBody();
      sortData();
      insertData();
      drawChart();
    });
}

function drawChart() {
  let { custom, $scope } = self.ctx;
  custom.d3Config = {
    viewWidth: 1920,
    barHeight: 10,
    barMargin: 30,
    margin: {
      top: 0,
      right: 20,
      bottom: 40,
      left: 300,
    },
  };
  custom.d3Config.viewHeight =
    custom.d3Config.margin.top +
    custom.d3Config.margin.bottom +
    2 * (2 * custom.d3Config.barMargin + custom.d3Config.barHeight);

  custom.$chartSection.empty();

  // svg 영역 정의
  custom.$d3 = d3
    .select(custom.$chartSection[0])
    .append('svg')
    .attr('viewBox', `0 0 ${custom.d3Config.viewWidth} ${custom.d3Config.viewHeight}`)
    .attr('width', custom.d3Config.viewWidth)
    .attr('height', custom.d3Config.viewHeight);

  drawXAxis();
  drawBar();

  custom.brushExtent = [];
  let brush = d3
    .brushX()
    .extent([
      [custom.d3Config.margin.left, custom.d3Config.margin.top],
      [
        custom.d3Config.viewWidth - custom.d3Config.margin.right,
        custom.d3Config.viewHeight - custom.d3Config.margin.bottom,
      ],
    ])
    .on('start brush', handleBrush);

  custom.$d3.call(brush);
}

function drawXAxis() {
  let { custom, $scope } = self.ctx;
  let { viewWidth, viewHeight, margin } = custom.d3Config;
  const width = viewWidth - margin.left - margin.right;
  const height = margin.bottom;

  // xAxis 그리기
  custom.xAxis = d3
    .scaleTime()
    .domain(d3.extent([custom.startTs, custom.endTs]))
    .range([0, width]);
  custom.$xAxis = custom.$d3
    .append('g')
    .attr('class', 'axis')
    .attr('transform', 'translate(' + margin.left + ', ' + (viewHeight - height) + ')')
    .style('font-size', '12px')
    .style('font-family', 'var(--tb-config-font-family)')
    .style('color', 'var(--tb-service-font-4)')
    .style('stroke-width', '0.1em')
    .call(
      d3
        .axisBottom(custom.xAxis)
        .ticks(10)
        .tickFormat(date => formatDate(date))
    );
}

function drawBar() {
  let { custom, $scope, $container } = self.ctx;
  let { viewWidth, barMargin, barHeight, margin } = custom.d3Config;
  const x = custom.xAxis;

  let dayLineList = [custom.startTs];
  let interval = (_.floor((custom.endTs - custom.startTs) / (7 * DAY_MS)) + 1) * DAY_MS;
  for (let i = custom.startTs; i < moment(custom.endTs).endOf('day').valueOf(); i += interval) {
    if (moment(i).startOf('day').valueOf() > custom.startTs) {
      dayLineList.push(moment(i).startOf('day').valueOf());
    }
  }
  dayLineList.sort();

  // 상태 변화 막대 그리기
  for (let i in custom.targetDatasources) {
    custom.$d3.append('g').attr('class', `bar-group-${i}`);

    custom.$d3
      .select(`.bar-group-${i}`)
      .append('rect')
      .attr('class', 'background')
      .attr('width', viewWidth)
      .attr('height', 2 * barMargin + barHeight)
      .attr('y', margin.top + i * (2 * barMargin + barHeight))
      .attr('fill', 'var(-tb-service-background-2)')
      .attr('stroke', 'var(--tb-service-border-1)');

    custom.$d3
      .select(`.bar-group-${i}`)
      .append('g')
      .attr('class', `day-group-${i}`)
      .selectAll('g')
      .data(dayLineList)
      .enter()
      .append('rect')
      .attr('class', 'day-line')
      .attr('x', d => margin.left + x(d))
      .attr('width', d => {
        let endTs = d + interval;
        if (endTs > custom.endTs) {
          endTs = custom.endTs;
        }
        if (d == custom.startTs) {
          endTs = moment(d)
            .add(_.floor(interval / DAY_MS), 'days')
            .startOf('day')
            .valueOf();
        }
        return x(endTs) - x(d);
      })
      .attr('height', 2 * barMargin + barHeight)
      .attr('y', margin.top + i * (2 * barMargin + barHeight))
      .attr('fill', (d, i) => {
        return i % 2 == 0 ? 'var(--tb-service-background-4)' : 'var(--tb-service-background-2)';
      })
      .attr('opacity', 0.5)
      .attr('stroke', 'var(--tb-service-border-1)');

    custom.$d3.select(`.bar-group-${i}`).append('g').attr('class', `bar-${i}`);
    custom.$d3
      .select(`.bar-${i}`)
      .append('g')
      .selectAll('g')
      .data([custom.targetDatasources[i]])
      .enter()
      .append('text')
      .text(function (d) {
        if (d) {
          return d.entityLabel;
        }
        return '';
      })
      .attr('class', 'bar-name')
      .attr('width', margin.left - 90)
      .attr('x', 20)
      .attr('y', margin.top + i * (2 * barMargin + barHeight) + barMargin + barHeight / 2 + 4)
      .call(dotme);

    custom.$d3
      .select(`.bar-${i}`)
      .append('g')
      .selectAll('g')
      .data([custom.targetDatasources[i]])
      .enter()
      .append('rect')
      .attr('class', `bar-label-box`)
      .attr('x', margin.left - 60)
      .attr('y', margin.top + i * (2 * barMargin + barHeight) + barMargin + barHeight / 2 - 9);

    custom.$d3
      .select(`.bar-${i}`)
      .append('g')
      .selectAll('g')
      .data([custom.targetDatasources[i]])
      .enter()
      .append('text')
      .text(function (d) {
        if (d.tag && d.tag == 'modified') {
          return t('thingplus.page.state-timeline.modified');
        } else {
          return t('thingplus.page.state-timeline.origin');
        }
      })
      .attr('class', d => {
        if (d.tag && d.tag == 'modified') {
          return 'bar-label bar-label-modified';
        } else {
          return 'bar-label bar-label-origin';
        }
      })
      .attr('x', margin.left - 40)
      .attr('y', margin.top + i * (2 * barMargin + barHeight) + barMargin + barHeight / 2 + 4);

    custom.$d3
      .select(`.bar-${i}`)
      .append('g')
      .selectAll('g')
      .data(custom.labelList[i])
      .enter()
      .append('rect')
      .attr('class', d => `bar-rect bar-rect-${d.status} tooltip tooltip-${i}-${d.index}`)
      .attr('fill', d => {
        if (d.status == 'unconnected' || d.status == 'nodata') {
          return STATUS.unconnected.color;
        } else if (d.status == 'stopped') {
          return STATUS.stopped.color;
        } else if (d.status == 'waiting') {
          return STATUS.waiting.color;
        } else {
          return STATUS.working.color;
        }
      })
      .attr('x', d => margin.left + x(d.time))
      .attr('y', margin.top + i * (2 * barMargin + barHeight) + barMargin)
      .attr('width', d => x(d.nextTime) - x(d.time))
      .attr('height', barHeight);

    for (let j in custom.labelList[i]) {
      let $content = $('<div></div>');
      $content.css({
        color: 'var(--tb-service-font-0)',
        backgroundColor: 'rgba(0,0,0,0.8)',
        lineHeight: 1.5,
        borderRadius: `${8 / STANDARD_WINDOW_SIZE}vw`,
        padding: `${12 / STANDARD_WINDOW_SIZE}vw`,
      });

      let startTime = moment(custom.labelList[i][j].time).format(custom.ymdhm);
      let endTime = moment(custom.labelList[i][j].nextTime).format(custom.ymdhm);
      let $date = $(`<div>${startTime} ~ ${endTime}</div>`);
      $date.css({
        textAlign: 'center',
        fontSize: `${12 / STANDARD_WINDOW_SIZE}vw`,
      });

      let $description = $(`<div></div>`);
      if (custom.labelList[i][j].status && custom.labelList[i][j].status !== '') {
        $description.html(`(${t(STATUS[custom.labelList[i][j].status].content)})`);
      }
      $description.css({
        textAlign: 'center',
        fontSize: `${12 / STANDARD_WINDOW_SIZE}vw`,
      });

      $content.append($date);
      $content.append($description);

      $(`.tooltip-${i}-${custom.labelList[i][j].index}`, $container).tooltipster({
        content: $content,
        interactive: true,
        theme: 'tooltipster-transparent',
        trigger: 'hover',
        delay: 200,
      });
    }
  }
}

function formatDate(date) {
  if (d3.timeHour(date) < date) {
    return d3.timeFormat(t('thingplus.time-format.d3-hm'))(date);
  } else if (d3.timeDay(date) < date) {
    return d3.timeFormat(t('thingplus.time-format.d3-dh'))(date);
  } else {
    return d3.timeFormat(t('thingplus.time-format.d3-md'))(date);
  }
}

function dotme(text) {
  text.each(function () {
    let text = d3.select(this);
    let words = Array.from(text.text());

    let ellipsis = text.text('').append('tspan').attr('class', 'elip').text('...');
    let width = parseFloat(text.attr('width')) - ellipsis.node().getComputedTextLength();
    let numWords = words.length;

    let tspan = text.insert('tspan', ':first-child').text(words.join(''));
    while (tspan.node().getComputedTextLength() > width && words.length) {
      words.pop();
      tspan.text(words.join(''));
    }

    if (words.length === numWords) {
      ellipsis.remove();
    }
  });
}

function openChart(e, d, i) {
  let { custom, $scope } = self.ctx;
  let descriptors = self.ctx.actionsApi.getActionDescriptors('viewChart');
  self.ctx.actionsApi.handleWidgetAction({}, descriptors[0], d.entity.id, d.entityName, custom, d.entityLabel);
}

function updateDashboardState() {
  let { custom, $scope } = self.ctx;
  let target,
    param = {};
  if ($scope.selectedDevice != '') {
    target = custom.relations[$scope.selectedDevice];
  } else {
    window.alert(t('thingplus.help.select-equipment-1'));
    return;
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
  param.startTs = moment($scope.startDate).startOf('day').valueOf();
  param.endTs = moment($scope.endDate).endOf('day').valueOf();
  if (param.endTs > moment().valueOf()) {
    param.endTs = moment().valueOf();
  }
  self.ctx.stateController.updateState('change-timeline', param, null);
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

function handleCustomAction(descriptor) {
  let { custom, $scope } = self.ctx;
  self.ctx.actionsApi.handleWidgetAction(
    {},
    descriptor,
    custom.targetDatasources[0].entity.id,
    custom.targetDatasources[0].entityName,
    custom,
    custom.targetDatasources[0].entityLabel
  );
}

function handleCellAction(descriptor, index) {
  let { custom, $scope } = self.ctx;
  let realIndex = $scope.trList[index - custom.startIndex].index;
  self.ctx.actionsApi.handleWidgetAction(
    {},
    descriptor,
    custom.targetDatasources[0].entity.id,
    custom.targetDatasources[0].entityName,
    custom.mainData[realIndex],
    custom.targetDatasources[0].entityLabel
  );
}

function handleBrush(e) {
  let { custom, $scope } = self.ctx;
  custom.brushExtent = e.selection;
  let xRange = [
    custom.brushExtent[0] - custom.d3Config.margin.left,
    custom.brushExtent[1] - custom.d3Config.margin.left,
  ];
  custom.dateSelection = [
    moment(custom.xAxis.invert(xRange[0])).valueOf(),
    moment(custom.xAxis.invert(xRange[1])).valueOf(),
  ];
}
