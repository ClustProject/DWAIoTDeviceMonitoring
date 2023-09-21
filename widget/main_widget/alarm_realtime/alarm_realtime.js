const ANALYSIS_MAP = ['stopped', 'waiting', 'working'];
const OPERATION_MAP = {
  STOP: 'stopped',
  WAIT: 'waiting',
  WORK: 'working',
};

self.onInit = async function () {
  self.ctx.custom = {};
  let { custom } = self.ctx;
  defineVariables();
  setTitle();
  linkEvent();
  makeHead();

  if (custom.isSample) return;

  processData();
  custom.interval = setInterval(() => {
    processData();
  }, 60000);
  self.onResize();
};

self.onResize = function () {
  self.ctx.custom.resizeThrottle();
};

self.onDestroy = function () {
  let { custom } = self.ctx;
  clearInterval(custom.interval);
};

self.actionSources = function () {
  return {
    widgetHeaderButton: {
      name: 'Custom Header Button',
      multiple: true,
    },
    actionCellButton: {
      name: 'widget-action.action-cell-button',
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
  // Define Tags
  custom.$widget = $('#widget', $container);
  custom.$widgetHeader = $('.widget-header', $container);
  custom.$widgetTitle = $('.widget-title', $container);
  custom.$widgetAction = $('.widget-action', $container);
  custom.$widgetContent = $('.widget-content', $container);
  custom.$table = $('.table', $container);
  custom.$theadTr = $('.table thead tr', $container);
  custom.$tbody = $('.table tbody', $container);
  custom.$widgetFooter = $('.widget-footer', $container);

  // Define Scope Variables
  $scope.thList = [];
  $scope.trList = [];
  $scope.pageList = [];
  $scope.headerActionList = self.ctx.actionsApi.getActionDescriptors('widgetHeaderButton').map(x => {
    return { name: x.name, icon: x.icon, action: e => handleHeaderAction(x) };
  });
  $scope.cellActionList = self.ctx.actionsApi.getActionDescriptors('actionCellButton').map(x => {
    return { name: x.name, icon: x.icon, action: (e, i, tr) => handleCellAction(x, i, tr) };
  });
  $scope.hasCellAction = $scope.cellActionList.length > 0;
  $scope.actionSize = `${$scope.cellActionList.length * 2 + 3.36 + ($scope.cellActionList.length - 1) * 0.5}em`;

  // Define Normal Variables
  custom.resizeThrottle = _.throttle(resize, 200, { trailing: true });
  custom.ownerDatasource = self.ctx.defaultSubscription.configuredDatasources[0];
  custom.isSample = custom.ownerDatasource.type == 'function';
  custom.hiddenDatasources = self.ctx.datasources.filter(x => x.entityAliasId === custom.ownerDatasource.entityAliasId);
  custom.mainDatasources = self.ctx.datasources.filter(x => x.entityAliasId !== custom.ownerDatasource.entityAliasId);
  custom.originDataKeys = self.ctx.defaultSubscription.configuredDatasources[1].dataKeys.filter(
    x => x.settings.hidden !== true
  );
  custom.selectedIndex = 0;
  custom.currentPage = 1;
  custom.countPerPage = 10;
  custom.t = t;
  let now = moment().valueOf();
  custom.startTs = moment(now).subtract(7, 'days').valueOf();
  custom.endTs = now;
}

// Create Widget Title
function setTitle() {
  let { custom } = self.ctx;
  custom.$widgetTitle.html(t(self.ctx.widget.config.title));
  custom.$widgetTitle.css(self.ctx.widget.config.titleStyle);
}

function linkEvent() {
  let { custom, $scope } = self.ctx;
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
      if (th.order != 'DESC') {
        $scope.thList[th.index].order = 'DESC';
      } else {
        $scope.thList[th.index].order = 'ASC';
      }
    } else {
      $scope.thList.forEach(x => (x.order = ''));
      custom.selectedIndex = th.index;
      $scope.thList[th.index].order = 'DESC';
    }
    initPage();
    makeBody();
    sortData();
    insertData();
  };
}

function resize() {
  let { custom } = self.ctx;
  // 위젯 전체 크기 조절
  let originWidth = self.ctx.settings.widget.originWidth;
  if (self.ctx.isMobile) {
    originWidth = 960;
  }
  let widgetFontSize = _.round((self.ctx.width / originWidth) * 10, 2);
  if (widgetFontSize < 6.25) {
    widgetFontSize = 6.25;
  }
  custom.$widget.css('font-size', `${widgetFontSize}px`);

  // Header와 Footer Height를 제외한 영역을 Main의 Height로 설정
  let headerHeight = custom.$widgetHeader.outerHeight(true);
  let footerHeight = custom.$widgetFooter.outerHeight(true);
  custom.$widgetContent.css('height', `calc(100% - ${headerHeight + footerHeight}px)`);
}

// 헤더 부분 생성
function makeHead() {
  let { custom, $scope } = self.ctx;
  $scope.thList = [];
  for (let i in custom.originDataKeys) {
    $scope.thList.push({
      index: i,
      key: custom.originDataKeys[i].name,
      label: t(custom.originDataKeys[i].label),
      order: custom.selectedIndex == i ? 'DESC' : '',
    });
  }
}

async function processData() {
  let { custom } = self.ctx;
  let analysisEndTs = moment(custom.endTs).subtract(1, 'hours').startOf('hours').valueOf();
  custom.loadedDatas = await self.ctx.rxjs
    .forkJoin([
      loadAttributes(custom.mainDatasources[0].entity.id, 'customerL1Name,customerL2Name'),
      loadTimeseries(custom.mainDatasources[0].entity.id, custom.startTs, analysisEndTs, 'TP_AnalysisState'),
      loadTimeseries(custom.mainDatasources[0].entity.id, analysisEndTs, custom.endTs, 'TP_OperationState'),
      loadAlarm(custom.mainDatasources[0].entity.id, custom.startTs, custom.endTs),
    ])
    .toPromise();

  custom.mainData = preprocessData(custom.loadedDatas);
  initPage();
  makeBody();
  sortData();
  insertData();
  // self.onResize();
  self.ctx.detectChanges();
}

function loadAttributes(entityId, keys) {
  return self.ctx.http.get(
    `/api/plugins/telemetry/${entityId.entityType}/${entityId.id}/values/attributes/SERVER_SCOPE?keys=${keys}`
  );
}

function loadTimeseries(entityId, startTs, endTs, keys) {
  return self.ctx.http.get(
    `/api/plugins/telemetry/${entityId.entityType}/${entityId.id}/values/timeseries?keys=${keys}&startTs=${startTs}&endTs=${endTs}&limit=50000&agg=NONE&interval=0&orderBy=ASC&useStrictDataTypes=true`
  );
}

function loadAlarm(entityId, startTime, endTime) {
  return self.ctx.http.get(
    `/api/alarm/${entityId.entityType}/${entityId.id}?searchStatus=ANY&pageSize=50000&page=0&startTime=${startTime}&endTime=${endTime}&fetchOriginator=true`
  );
}

function preprocessData(loadedDatas) {
  let { custom } = self.ctx;
  let result = [];
  let customerL1NameIndex = loadedDatas[0].findIndex(x => x.key == 'customerL1Name');
  let customerL1Name = '';
  if (customerL1NameIndex != -1) {
    customerL1Name = loadedDatas[0][customerL1NameIndex].value;
  }
  let customerL2NameIndex = loadedDatas[0].findIndex(x => x.key == 'customerL2Name');
  let customerL2Name = '';
  if (customerL2NameIndex != -1) {
    customerL2Name = loadedDatas[0][customerL2NameIndex].value;
  }

  if (loadedDatas[1].TP_AnalysisState) {
    loadedDatas[1].TP_AnalysisState = loadedDatas[1].TP_AnalysisState.filter(x => x.value <= 2);
    for (let i in loadedDatas[1].TP_AnalysisState) {
      result.push({
        createdTime: loadedDatas[1].TP_AnalysisState[i].ts,
        customerL1Name: customerL1Name,
        customerL2Name: customerL2Name,
        originatorLabel: custom.mainDatasources[0].entityLabel,
        category: 'state',
        type: ANALYSIS_MAP[loadedDatas[1].TP_AnalysisState[i].value],
        severity: 'INTERMIDIATE',
        ackTs: 0,
        clearTs: 0,
      });
    }
  }
  if (loadedDatas[2].TP_OperationState) {
    for (let i in loadedDatas[2].TP_OperationState) {
      result.push({
        createdTime: loadedDatas[2].TP_OperationState[i].ts,
        customerL1Name: customerL1Name,
        customerL2Name: customerL2Name,
        originatorLabel: custom.mainDatasources[0].entityLabel,
        category: 'state',
        type: OPERATION_MAP[loadedDatas[2].TP_OperationState[i].value],
        severity: 'INTERMIDIATE',
        ackTs: 0,
        clearTs: 0,
      });
    }
  }
  for (let i in loadedDatas[3].data) {
    result.push({
      createdTime: loadedDatas[3].data[i].createdTime,
      customerL1Name: customerL1Name,
      customerL2Name: customerL2Name,
      originatorLabel: custom.mainDatasources[0].entityLabel,
      originator: custom.mainDatasources[0].entity.id,
      category: loadedDatas[3].data[i].details.category,
      type: loadedDatas[3].data[i].type,
      severity: loadedDatas[3].data[i].severity,
      ackTs: loadedDatas[3].data[i].ackTs,
      clearTs: loadedDatas[3].data[i].clearTs,
      id: loadedDatas[3].data[i].id,
    });
  }
  result.sort((a, b) => a - b);
  return result;
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
}

// 테이블 바디 생성
function makeBody() {
  let { custom, $scope } = self.ctx;
  $scope.trList = [];
  // 현재 페이지의 데이터 수 만큼 행 출력
  for (let i = custom.startIndex; i <= custom.endIndex; i++) {
    let tdList = [];
    for (let j in custom.originDataKeys) {
      tdList.push({ index: j, name: custom.originDataKeys[j].name, style: '', value: '' });
    }
    $scope.trList.push({
      index: i,
      tdList: tdList,
      acked: '',
    });
  }
}

// 데이터 재 정렬
function sortData() {
  let { custom, $scope } = self.ctx;
  let selectedKey = $scope.thList[custom.selectedIndex].key;
  let selectedOrder = $scope.thList[custom.selectedIndex].order;

  custom.mainData.sort((a, b) => {
    if (selectedOrder == 'DESC') {
      if (a[selectedKey] > b[selectedKey]) return -1;
      if (a[selectedKey] < b[selectedKey]) return 1;
      return 0;
    } else {
      if (a[selectedKey] > b[selectedKey]) return 1;
      if (a[selectedKey] < b[selectedKey]) return -1;
      return 0;
    }
  });
}

// 데이터 삽입
function insertData() {
  let { custom, $scope } = self.ctx;
  for (let i = custom.startIndex; i <= custom.endIndex; i++) {
    for (let j in custom.originDataKeys) {
      let key = custom.originDataKeys[j].name;
      let data = custom.mainData[i][key];

      if ((key == 'type' && data == 'working') || data == 'waiting' || data == 'stopped') {
        $scope.trList[i - custom.startIndex].acked = 'disabled';
      }
      if (key == 'ackTs' && data != 0) {
        $scope.trList[i - custom.startIndex].acked = 'acked';
      }

      if (custom.originDataKeys[j].settings.useCellStyleFunction) {
        // Apply cell style function
        try {
          let styleFunction = new Function('value', 'ctx', custom.originDataKeys[j].settings.cellStyleFunction);
          let style = styleFunction(data, self.ctx);
          $scope.trList[i - custom.startIndex].tdList[j].style = style;
        } catch (err) {
          console.error(err);
        }
      }
      // Apply cell content function
      if (custom.originDataKeys[j].settings.useCellContentFunction) {
        try {
          let contentFunction = new Function('value', 'ctx', custom.originDataKeys[j].settings.cellContentFunction);
          data = contentFunction(data, self.ctx);
        } catch (err) {
          console.error(err);
        }
      }

      $scope.trList[i - custom.startIndex].tdList[j].value = data;
    }
  }
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

function handleCellAction(descriptor, index, tr) {
  let { custom, $scope } = self.ctx;
  if (descriptor.name == 'Ack' && tr.acked != '') {
    return;
  }
  let realIndex = $scope.trList[index - custom.startIndex].index;
  self.ctx.actionsApi.handleWidgetAction(
    {},
    descriptor,
    custom.mainData[realIndex].id,
    '',
    custom.mainData[realIndex],
    ''
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
