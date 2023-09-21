const ENTITY_TYPE = ['TENANT', 'CUSTOMER_L1', 'CUSTOMER_L2'];
const STANDARD_WINDOW_SIZE = 1920 / 100;

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
    custom.mainData = await loadAttributes();
  } else {
    custom.mainData = [];
  }

  initPage();
  makeBody();
  self.onResize();
  sortData();
  insertData();

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

self.onDataUpdated = function () {};

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
  custom.$widgetHeader = $('.widget-header', $container);
  custom.$widgetTitle = $('.widget-title', $container);
  custom.$widgetContent = $('.widget-content', $container);

  custom.yStr = t('thingplus.time-format.y-str');
  $scope.tabList = [];
  $scope.thList = [];
  $scope.trList = [];
  $scope.pageList = [];
  $scope.ownerLevel = 2;
  $scope.cellActionList = self.ctx.actionsApi.getActionDescriptors('actionCellButton').map(x => {
    return { name: x.name, icon: x.icon, action: (e, i) => handleCellAction(x, i) };
  });
  $scope.hasCellAction = $scope.cellActionList.length > 0;
  $scope.actionSize = `${$scope.cellActionList.length * 2 + 3.36 + ($scope.cellActionList.length - 1) * 0.5}em`;
  $scope.headerActionList = self.ctx.actionsApi.getActionDescriptors('widgetHeaderButton').map(x => {
    return { name: x.name, icon: x.icon, action: e => handleHeaderAction(x) };
  });

  // Define Normal Variables
  custom.relations = {};
  custom.resizeThrottle = _.throttle(resize, 200, { trailing: true });
  custom.ownerDatasource = self.ctx.defaultSubscription.configuredDatasources[0];
  custom.rootEntity = custom.ownerDatasource.entity;
  custom.isSample = custom.ownerDatasource.type == 'function';
  custom.hiddenDatasources = self.ctx.datasources.filter(x => x.entityAliasId === custom.ownerDatasource.entityAliasId);
  custom.mainDatasources = self.ctx.datasources.filter(x => x.entityAliasId !== custom.ownerDatasource.entityAliasId);
  custom.originDataKeys = self.ctx.defaultSubscription.configuredDatasources[1].dataKeys;
  custom.t = t;
  let originWidth = self.ctx.settings.widget.originWidth;
  if (self.ctx.isMobile) {
    originWidth = 960;
  }
  custom.widgetFontSize = _.round((self.ctx.width / originWidth) * 10, 2);
  if (custom.widgetFontSize < 6.25) {
    custom.widgetFontSize = 6.25;
  }
  custom.selectedIndex = 0;
  custom.currentPage = 1;
  custom.countPerPage = 10;
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
  custom.$widgetContent.css('height', `calc(100% - ${headerHeight}px)`);

  self.ctx.detectChanges();
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

function loadAttributes() {
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

  self.ctx.detectChanges();
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
  custom.targetDatasources = custom.mainData.slice(custom.startIndex, custom.endIndex + 1);
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
    });
  }
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
  for (let i = custom.startIndex; i <= custom.endIndex; i++) {
    for (let j in custom.originDataKeys) {
      let key = custom.originDataKeys[j].name;
      let data = custom.mainData[i][key];
      // Apply cell style function
      if (custom.originDataKeys[j].settings.useCellStyleFunction) {
        try {
          let styleFunction = new Function('value', 'row', 'ctx', custom.originDataKeys[j].settings.cellStyleFunction);
          let style = styleFunction(data, custom.mainData[i], self.ctx);
          $scope.trList[i - custom.startIndex].tdList[j].style = style;
        } catch (err) {
          console.error(err);
        }
      }
      // Apply cell action function
      if (custom.originDataKeys[j].settings.useCellActionFunction) {
        try {
          let actionFunction = new Function(
            'value',
            'tr',
            'td',
            'row',
            'ctx',
            custom.originDataKeys[j].settings.cellActionFunction
          );
          $scope.trList[i - custom.startIndex].tdList[j].action = function (e) {
            actionFunction(
              data,
              $scope.trList[i - custom.startIndex],
              $scope.trList[i - custom.startIndex].tdList[j],
              custom.mainData[i],
              self.ctx
            );
          };
        } catch (err) {
          console.error(err);
        }
      }
      // Apply cell content function
      if (custom.originDataKeys[j].settings.useCellContentFunction) {
        try {
          let contentFunction = new Function(
            'value',
            'row',
            'ctx',
            custom.originDataKeys[j].settings.cellContentFunction
          );
          data = contentFunction(data, custom.mainData[i], self.ctx);
        } catch (err) {
          console.error(err);
        }
      }

      $scope.trList[i - custom.startIndex].tdList[j].value = data;
    }
  }
}

function handleCellAction(descriptor, index) {
  let { custom, $scope } = self.ctx;
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
