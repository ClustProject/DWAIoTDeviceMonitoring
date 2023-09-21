const HOUR_MS = 3600000;
const DAY_MS = 86400000;

self.onInit = function () {
  self.ctx.custom = {};
  let { custom } = self.ctx;
  defineVariables();
  setTitle();
  getDashboardParameter();
  self.ctx.timewindowFunctions.onUpdateTimewindow(custom.searchStart, custom.searchEnd);
  linkEvent();
  loadAlarm();
  makeHead();
  makeBody();
  self.onResize();
  initPage();

  custom.isInitialized = true;
  self.onDataUpdated();
};

self.onResize = function () {
  self.ctx.custom.resizeThrottle();
};

self.onDataUpdated = function () {
  let { custom } = self.ctx;
  if (custom.isInitialized) {
    custom.mainData = preprocessData();
    sortData();
    insertData();
  }
  self.ctx.detectChanges();
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
  custom.$table = $('.table', $container);
  custom.$theadTr = $('.table thead tr', $container);
  custom.$tbody = $('.table tbody', $container);

  $scope.thList = [];
  $scope.trList = [];
  $scope.pageList = [];

  // Define Normal Variables
  custom.resizeThrottle = _.throttle(resize, 200, { trailing: true });
  custom.ownerDatasource = self.ctx.defaultSubscription.configuredDatasources[0];
  custom.isSample = custom.ownerDatasource.type == 'function';
  custom.hiddenDatasources = self.ctx.datasources.filter(x => x.entityAliasId === custom.ownerDatasource.entityAliasId);
  custom.mainDatasources = self.ctx.datasources.filter(x => x.entityAliasId !== custom.ownerDatasource.entityAliasId);
  custom.originDataKeys = self.ctx.defaultSubscription.configuredDatasources[1].dataKeys.filter(
    x => x.settings.hidden !== true
  );
  custom.targetDatasources = [];
  custom.isInitialized = false;
  let now = moment().valueOf();
  custom.searchStart = moment(now).startOf('day').valueOf();
  custom.searchEnd = moment(now).endOf('day').valueOf() + 1;
  custom.selectedIndex = 0;
  custom.currentPage = 1;
  custom.countPerPage = 5;
  custom.alarms = [];
  custom.t = t;
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
      custom.searchStart = custom.dashboardParams.startTs;
    }
    if (custom.dashboardParams.endTs) {
      custom.searchEnd = custom.dashboardParams.endTs;
    }
  }
}

function linkEvent() {
  let { custom, $scope } = self.ctx;
  $scope.getPrevPage = function () {
    if (custom.currentPage > 1) {
      custom.currentPage--;
      initPage();
      insertData();
    }
  };
  $scope.getNextPage = function () {
    if (custom.currentPage < custom.totalPage) {
      custom.currentPage++;
      initPage();
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
    sortData();
    insertData();
  };
}

function loadAlarm() {
  let { custom, $scope, $container } = self.ctx;
  let observables = [];
  for (let i in custom.mainDatasources) {
    observables.push(
      self.ctx.http.get(
        `/api/alarm/DEVICE/${custom.mainDatasources[i].entityId}?textSearch=delayed&startTime=${custom.searchStart}&endTime=${custom.searchEnd}&page=0&pageSize=50000`
      )
    );
  }
  self.ctx.rxjs.forkJoin(observables).subscribe(alarms => {
    custom.alarms = alarms.map(x => x.totalElements);
    self.onDataUpdated();
  });
}

// 헤더 부분 생성
function makeHead() {
  let { custom, $scope } = self.ctx;
  $scope.thList = [
    {
      index: 0,
      key: 'rank',
      label: t('thingplus.label.rank'),
      order: 'ASC',
    },
    {
      index: 1,
      key: 'label',
      label: t('thingplus.label.device-name'),
      order: '',
    },
    {
      index: 2,
      key: 'alarmCount',
      label: t('thingplus.label.alarm-count'),
      order: '',
    },
    {
      index: 2,
      key: 'waitTime',
      label: t('thingplus.label.waiting-time'),
      order: '',
    },
    {
      index: 3,
      key: 'waitPowerUsage',
      label: t('thingplus.label.usage-with-unit-2'),
      order: '',
    },
  ];
}

// 테이블 바디 생성
function makeBody() {
  let { custom, $scope } = self.ctx;
  $scope.trList = [];
  // 현재 페이지의 데이터 수 만큼 행 출력
  for (let i = 0; i < custom.countPerPage; i++) {
    let tdList = [
      { index: 0, name: $scope.thList[0].key, style: '', value: '-' },
      { index: 1, name: $scope.thList[1].key, style: '', value: '-' },
      { index: 2, name: $scope.thList[2].key, style: '', value: '-' },
      { index: 3, name: $scope.thList[3].key, style: '', value: '-' },
      { index: 4, name: $scope.thList[4].key, style: '', value: '-' },
    ];
    $scope.trList.push({
      tdList: tdList,
    });
  }
}

// 페이지에 맞는 데이터 출력 및 페이지 표시
function initPage() {
  let { custom, $scope } = self.ctx;
  custom.totalPage = Math.ceil(custom.mainDatasources.length / custom.countPerPage);

  custom.startIndex = (custom.currentPage - 1) * custom.countPerPage;
  custom.endIndex = custom.currentPage * custom.countPerPage - 1;
  // 끝 페이지가 데이터 소스의 길이보다 많으면 데이터 소스의 길이로 변경
  if (custom.endIndex > custom.mainDatasources.length - 1) {
    custom.endIndex = custom.mainDatasources.length - 1;
  }
  custom.targetDatasources = custom.mainDatasources.slice(custom.startIndex, custom.endIndex + 1);
  $scope.currentPage = custom.currentPage + ' of ' + custom.totalPage;
}

function preprocessData() {
  let { custom } = self.ctx;
  let result = [];
  for (let i in custom.mainDatasources) {
    result.push({
      id: custom.mainDatasources[i].entity.id,
      name: custom.mainDatasources[i].entityName,
      label: custom.mainDatasources[i].entityLabel,
    });
  }
  for (let i in self.ctx.data) {
    let target = self.ctx.data[i];
    if (!_.isNil(target.data[0])) {
      let entityId = target.datasource.entityId;
      let name = target.dataKey.name;
      let data = target.data;
      let datasourceIndex = result.findIndex(x => x.id.id == entityId);
      if (datasourceIndex !== -1) {
        result[datasourceIndex][name] = data;
      }
    }
  }
  for (let i in result) {
    result[i].alarmCount = custom.alarms[i] || 0;
    result[i].waitTime = 0;
    result[i].waitPowerUsage = 0;

    for (let j = custom.searchStart; j < custom.searchEnd; j += DAY_MS) {
      if (result[i].TP_WaitTimeDay) {
        let acc = 0;
        let targetArray = result[i].TP_WaitTimeDay.filter(x => x[0] >= j && x[0] < j + DAY_MS).map(x => x[1]);
        for (let k in targetArray) {
          acc = targetArray[k];
        }
        result[i].waitTime += acc;
      }
      if (result[i].TP_WaitPowerUsageDay) {
        let acc = 0;
        let targetArray = result[i].TP_WaitPowerUsageDay.filter(x => x[0] >= j && x[0] < j + DAY_MS).map(x => x[1]);
        for (let k in targetArray) {
          acc += targetArray[k];
        }
        result[i].waitPowerUsage += acc;
      }
    }
    result[i].waitPowerUsage = result[i].waitPowerUsage / 1000;
    result[i].waitTime = toTime(result[i].waitTime / 1000);
  }
  result.sort((a, b) => {
    if (a.waitTime > b.waitTime) return -1;
    if (a.waitTime < b.waitTime) return 1;
    return 0;
  });
  result.sort((a, b) => {
    if (a.alarmCount > b.alarmCount) return -1;
    if (a.alarmCount < b.alarmCount) return 1;
    return 0;
  });
  for (let i in result) {
    result[i].rank = +i + 1;
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
  for (let i in $scope.trList) {
    for (let j in $scope.trList[i].tdList) {
      $scope.trList[i].tdList[j].value = '-';
    }
  }
  for (let i = custom.startIndex; i <= custom.endIndex; i++) {
    for (let j in $scope.thList) {
      let key = $scope.thList[j].key;
      let data = custom.mainData[i][key];
      if (key == 'operationTime') {
        let date = toDate(Math.floor(data * HOUR_MS));
        data = t('thingplus.time-format.hm-acc', {
          hour: date[0],
          minute: date[1],
        });
      }
      $scope.trList[i - custom.startIndex].tdList[j].value = data;
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
}

function toDate(value) {
  if (isNaN(Number(value))) return [0, 0];
  let hour = Math.floor(value / 3600000);
  let temp = value % 3600000;
  let min = Math.floor(temp / 60000);
  return [hour, min];
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

function addZero(value, pos) {
  let result = value.toString();
  for (let i = result.length; i < pos; i++) {
    result = '0' + result;
  }
  return result;
}
