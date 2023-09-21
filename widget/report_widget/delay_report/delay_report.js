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
    let loadedData = await loadData();
    custom.mainData = preprocessData(loadedData);
  }

  sortData();
  makeBody();
  makeFoot();
  insertData();
  self.ctx.detectChanges();
  self.onResize();
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
  custom.targetDatasource = custom.mainDatasources[0];
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
      key: 'waitStart',
      label: t('thingplus.label.wait-start'),
      order: 'ASC',
      formatter: d => {
        return moment(d).format('YYYY-MM-DD HH:mm:ss');
      },
    },
    {
      index: 1,
      key: 'waitEnd',
      label: t('thingplus.label.wait-end'),
      order: '',
      formatter: d => {
        return moment(d).format('YYYY-MM-DD HH:mm:ss');
      },
    },
    {
      index: 2,
      key: 'waitingTime',
      label: t('thingplus.label.waiting-time'),
      order: '',
      formatter: d => {
        return toTime(_.floor(d / 1000));
      },
    },
    {
      index: 3,
      key: 'powerUsage',
      label: t('thingplus.label.usage-with-unit-2'),
      order: '',
      formatter: d => {
        return _.round(d / 1000, 1);
      },
    },
  ];
}

function loadData() {
  let { custom, $scope } = self.ctx;
  let entityId = custom.targetDatasource.entity.id;
  let key = 'TP_AnalysisState,TP_TotalPowerUsageRaw';
  return new Promise((resolve, reject) => {
    try {
      self.ctx.http
        .get(
          `/api/plugins/telemetry/${entityId.entityType}/${entityId.id}/values/timeseries?limit=50000&agg=NONE&keys=${key}&startTs=${custom.startTs}&endTs=${custom.endTs}&useStrictDataTypes=true&orderBy=ASC`
        )
        .subscribe(datas => {
          resolve(datas);
        });
    } catch (e) {
      reject(e);
    }
  });
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

function preprocessData(loadedData) {
  let { custom, $scope } = self.ctx;
  let result = [];

  if (_.isNil(loadedData.TP_AnalysisState)) return [];
  // TP_AnalysisState 상태값에 따라서 데이터 행 생성
  for (let i = 0; i < loadedData.TP_AnalysisState.length; i++) {
    // 대기 상태인 경우만 조회
    if (loadedData.TP_AnalysisState[i].value == '1') {
      let newObj = {
        waitStart: loadedData.TP_AnalysisState[i].ts,
        waitEnd: '',
        waitingTime: 0,
        powerUsage: 0,
      };
      // 변화한 데이터로 구성되므로 다음 데이터는 항상 대기가 아닌 상태 (곧 대기가 끝난 상태)
      if (!_.isNil(loadedData.TP_AnalysisState[i + 1])) {
        newObj.waitEnd = loadedData.TP_AnalysisState[i + 1].ts;
      } else {
        // 분석이 매 시간 0분에 진행되고 미래시간 1시간을 margin으로 가지므로 조회 마지막 날이 오늘이면 현재시간의 1시간전 0분까지로 설정 (1 ~ 2시간의 데이터가 없으므로)
        newObj.waitEnd = custom.endTs;
        if (moment(custom.endTs).startOf('day').valueOf() == moment().startOf('day').valueOf()) {
          newObj.waitEnd = moment().subtract(1, 'hours').startOf('hour').valueOf();
        }
      }
      newObj.waitingTime = newObj.waitEnd - newObj.waitStart;
      result.push(newObj);
    }
  }

  // TP_TotalPowerUsageRaw 데이터를 통해 전력 사용량 계산
  for (let i in result) {
    for (let j = 0; j < loadedData.TP_TotalPowerUsageRaw.length; j++) {
      if (
        result[i].waitStart <= loadedData.TP_TotalPowerUsageRaw[j].ts &&
        loadedData.TP_TotalPowerUsageRaw[j].ts < result[i].waitEnd
      ) {
        result[i].powerUsage += loadedData.TP_TotalPowerUsageRaw[j].value;
      }
    }
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
      $scope.trList[i].tdList[j].value = $scope.thList[j].formatter(data);
      // 만약 키가 tfootList에 존재한다면 total에 더해줌
      if (total[key] !== undefined) {
        total[key] += data;
      }
    }
  }

  for (let i in total) {
    let targetIndex = $scope.tfootList.findIndex(x => x.key == i);
    if (targetIndex !== -1) {
      if (i == 'waitingTime') {
        $scope.tfootList[targetIndex].value = toStringTime(total[i] / 1000);
      } else {
        $scope.tfootList[targetIndex].value = _.round(total[i] / 1000, 1) + ' kWh';
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
