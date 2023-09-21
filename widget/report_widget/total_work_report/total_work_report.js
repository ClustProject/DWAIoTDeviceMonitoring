const HOUR_MS = 3600000;
const DAY_MS = 86400000;

self.onInit = async function () {
  self.ctx.custom = {};
  let { custom } = self.ctx;
  defineVariables();
  setTitle();
  getDashboardParameter();
  linkEvent();
  makeHead();

  if (!custom.isSample) {
    let loadedAttribute = await loadAttribute();
    let loadedInitialData = await loadInitialData();
    let loadedData = await loadData();
    custom.mainData = preprocessData(loadedAttribute, loadedInitialData, loadedData);
  }
  sortData();
  makeBody();
  makeFoot();
  insertData();
  self.onResize();
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
  custom.$thead = $('.thead', $container);
  custom.$tbody = $('.tbody', $container);
  custom.$tfoot = $('.tfoot', $container);

  $scope.thList = [];
  $scope.trList = [];
  $scope.headerActionList = self.ctx.actionsApi.getActionDescriptors('widgetHeaderButton').map(x => {
    return { name: x.name, icon: x.icon, action: e => handleHeaderAction(x) };
  });

  // Define Normal Variables
  custom.resizeThrottle = _.throttle(resize, 200, { trailing: true });
  custom.ownerDatasource = self.ctx.defaultSubscription.configuredDatasources[0];
  custom.isSample = custom.ownerDatasource.type == 'function';
  custom.hiddenDatasources = self.ctx.datasources.filter(x => x.entityAliasId === custom.ownerDatasource.entityAliasId);
  custom.mainDatasources = self.ctx.datasources.filter(x => x.entityAliasId !== custom.ownerDatasource.entityAliasId);
  custom.originDataKeys = self.ctx.defaultSubscription.configuredDatasources[1].dataKeys.filter(
    x => x.settings.hidden !== true
  );
  let now = moment().valueOf();
  custom.startTs = moment(now).startOf('month').valueOf();
  custom.endTs = now;
  custom.selectedIndex = 0;
  custom.t = t;
  custom.mainData = [];
}

// Create Widget Title
function setTitle() {
  let { custom } = self.ctx;
  custom.$widgetTitle.html(self.ctx.widget.config.title);
  custom.$widgetTitle.css(self.ctx.widget.config.titleStyle);
}

function getDashboardParameter() {
  let { custom } = self.ctx;
  if (custom.isSample) {
    custom.dashboardParams = {};
    return;
  }
  custom.dashboardParams = self.ctx.stateController.getStateParams();
  if (custom.dashboardParams) {
    if (custom.dashboardParams.startTs) {
      custom.startTs = custom.dashboardParams.startTs;
    }
    if (custom.dashboardParams.endTs) {
      custom.endTs = custom.dashboardParams.endTs;
    }
  }
}

function linkEvent() {
  let { custom, $scope } = self.ctx;
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
    sortData();
    insertData();
  };
}

// 헤더 부분 생성
function makeHead() {
  let { custom, $scope } = self.ctx;
  $scope.thList = [
    {
      index: 0,
      key: 'customerL2Name',
      label: t('thingplus.label.customerL2-name'),
      order: 'ASC',
    },
    {
      index: 1,
      key: 'deviceName',
      label: t('thingplus.label.device-name'),
      order: '',
    },
    {
      index: 2,
      key: 'operationTime',
      label: t('thingplus.label.operation-time'),
      order: '',
      formatter: d => {
        return toTime(_.floor(d / 1000));
      },
    },
    {
      index: 3,
      key: 'waitingTime',
      label: t('thingplus.label.waiting-time'),
      order: '',
      formatter: d => {
        return toTime(_.floor(d / 1000));
      },
    },
    {
      index: 4,
      key: 'operationRatio',
      label: t('thingplus.label.operation-rate-with-unit'),
      order: '',
      formatter: d => {
        return _.round(d, 1);
      },
    },
  ];
}

function loadAttribute() {
  let { custom, $scope } = self.ctx;
  let observables = [];
  let key = 'customerL2Name';
  for (let i in custom.mainDatasources) {
    let entityId = custom.mainDatasources[i].entity.id;
    observables.push(
      self.ctx.http.get(`/api/plugins/telemetry/${entityId.entityType}/${entityId.id}/values/attributes?keys=${key}`)
    );
  }

  return new Promise((resolve, reject) => {
    try {
      self.ctx.rxjs.forkJoin(observables).subscribe(datas => {
        resolve(datas);
      });
    } catch (e) {
      reject(e);
    }
  });
}

function loadInitialData() {
  let { custom, $scope } = self.ctx;
  let observables = [];
  let key = 'TP_AnalysisState';
  for (let i in custom.mainDatasources) {
    let entityId = custom.mainDatasources[i].entity.id;
    observables.push(
      self.ctx.http.get(
        `/api/plugins/telemetry/${entityId.entityType}/${entityId.id}/values/timeseries?limit=1&agg=NONE&keys=${key}&startTs=0&endTs=${custom.startTs}&useStrictDataTypes=true&orderBy=ASC`
      )
    );
  }

  return new Promise((resolve, reject) => {
    try {
      self.ctx.rxjs.forkJoin(observables).subscribe(datas => {
        resolve(datas);
      });
    } catch (e) {
      reject(e);
    }
  });
}

function loadData() {
  let { custom, $scope } = self.ctx;
  let observables = [];
  let key = 'TP_AnalysisState,TP_PlannedWorkTimeDay';
  for (let i in custom.mainDatasources) {
    let entityId = custom.mainDatasources[i].entity.id;
    observables.push(
      self.ctx.http.get(
        `/api/plugins/telemetry/${entityId.entityType}/${entityId.id}/values/timeseries?limit=50000&agg=NONE&keys=${key}&startTs=${custom.startTs}&endTs=${custom.endTs}&useStrictDataTypes=true&orderBy=ASC`
      )
    );
  }

  return new Promise((resolve, reject) => {
    try {
      self.ctx.rxjs.forkJoin(observables).subscribe(datas => {
        resolve(datas);
      });
    } catch (e) {
      reject(e);
    }
  });
}

function preprocessData(loadedAttribute, loadedInitialData, loadedData) {
  let { custom, $scope } = self.ctx;
  let result = [];

  // 데이터 정리
  let analysisState = [];
  let plannedWorkTimeDay = [];
  for (let i in custom.mainDatasources) {
    if (_.isNil(analysisState[i])) {
      analysisState[i] = [];
    }
    if (loadedInitialData[i].TP_AnalysisState) {
      loadedInitialData[i].TP_AnalysisState[0].ts = custom.startTs;
      analysisState[i] = analysisState[i].concat(loadedInitialData[i].TP_AnalysisState);
    }
    if (loadedData[i].TP_AnalysisState) {
      analysisState[i] = analysisState[i].concat(loadedData[i].TP_AnalysisState);
    }
    analysisState[i] = _.orderBy(analysisState[i], ['ts'], ['asc']);

    if (_.isNil(plannedWorkTimeDay[i])) {
      plannedWorkTimeDay[i] = 0;
    }
    for (let j in loadedData[i].TP_PlannedWorkTimeDay) {
      plannedWorkTimeDay[i] += loadedData[i].TP_PlannedWorkTimeDay[j].value;
    }
  }

  // TP_AnalysisState 상태값에 따라서 데이터 행 생성
  for (let i in analysisState) {
    let newObj = {
      customerL2Name: loadedAttribute[i][0].value,
      deviceName: custom.mainDatasources[i].entityLabel,
      operationTime: 0,
      waitingTime: 0,
      operationRatio: 0,
    };
    for (let j = 0; j < analysisState[i].length; j++) {
      // 대기, 가동상태인 경우만 조회
      if (analysisState[i][j].value == '1' || analysisState[i][j].value == '2' || analysisState[i][j].value == '3') {
        let start = analysisState[i][j].ts;
        let end = custom.endTs;
        // 변화한 데이터로 구성되므로 다음 데이터는 항상 전과 다른 상태 (기존 상태가 끝난 시점)
        if (!_.isNil(analysisState[i][j + 1])) {
          end = analysisState[i][j + 1].ts;
        } else {
          // 분석이 매 시간 0분에 진행되므로 조회 마지막 날이 오늘이면 현재시간의 0분까지로 설정
          end = custom.endTs;
          if (moment(end).startOf('day').valueOf() == moment().startOf('day').valueOf()) {
            end = moment().startOf('hour').valueOf();
          }
        }
        if (analysisState[i][j].value == '1') {
          newObj.waitingTime += end - start;
        }
        if (analysisState[i][j].value == '2' || analysisState[i][j].value == '3') {
          newObj.operationTime += end - start;
        }
      }
    }
    if (plannedWorkTimeDay[i] != 0) {
      newObj.operationRatio = (newObj.operationTime / plannedWorkTimeDay[i]) * 100;
    }

    result.push(newObj);
  }
  return result;
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
  for (let i in custom.mainData) {
    let tdList = [];
    for (let j in $scope.thList) {
      tdList.push({ index: j, name: $scope.thList[j].key, style: '', value: '-' });
    }
    $scope.trList.push({
      tdList: tdList,
    });
  }
}

function makeFoot() {
  let { custom, $scope } = self.ctx;
  $scope.tfootList = $scope.thList.slice(2).map(x => {
    return {
      key: x.key,
      value: '',
    };
  });
}

// 데이터 삽입
function insertData() {
  let { custom, $scope } = self.ctx;
  let total = {};
  for (let i in $scope.tfootList) {
    total[$scope.tfootList[i].key] = 0;
  }

  for (let i in custom.mainData) {
    for (let j in $scope.thList) {
      let key = $scope.thList[j].key;
      let data = custom.mainData[i][key];
      $scope.trList[i].tdList[j].value = data;
      if ($scope.thList[j].formatter) {
        $scope.trList[i].tdList[j].value = $scope.thList[j].formatter(data);
      }

      // 만약 키가 tfootList에 존재한다면 total에 더해줌
      if (total[key] !== undefined) {
        total[key] += data;
      }
    }
  }

  for (let i in total) {
    let targetIndex = $scope.tfootList.findIndex(x => x.key == i);
    if (targetIndex !== -1) {
      if (i == 'waitingTime' || i == 'operationTime') {
        $scope.tfootList[targetIndex].value = toStringTime(total[i] / 1000);
      } else {
        $scope.tfootList[targetIndex].value = _.round(total[i] / custom.mainDatasources.length, 1);
      }
    }
  }
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

  // Header Height를 제외한 영역을 Main의 Height로 설정
  let headerHeight = custom.$widgetHeader.outerHeight(true);
  custom.$widgetContent.css('height', `calc(100% - ${headerHeight}px)`);

  let theadHeight = custom.$thead.outerHeight(true);
  let tfootHeight = custom.$tfoot.outerHeight(true);
  custom.$tbody.css('max-height', `calc(100% - ${theadHeight + tfootHeight}px)`);
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

function toTime(value) {
  let hour = Math.floor(value / 3600);
  let min = Math.floor((value % 3600) / 60);
  return `${addZero(hour, 2)}:${addZero(min, 2)}`;
}

function toStringTime(value) {
  let hour = Math.floor(value / 3600);
  let minute = Math.floor((value % 3600) / 60);
  return t('thingplus.time-format.hm-acc-em', { hour, minute });
}

function addZero(value, pos) {
  let result = value.toString();
  for (let i = result.length; i < pos; i++) {
    result = '0' + result;
  }
  return result;
}

function handleHeaderAction(descriptor) {
  let { custom } = self.ctx;
  self.ctx.actionsApi.handleWidgetAction(
    {},
    descriptor,
    custom.mainDatasources[0].entity.id,
    custom.mainDatasources[0].entityName,
    {},
    custom.mainDatasources[0].entityLabel
  );
}
