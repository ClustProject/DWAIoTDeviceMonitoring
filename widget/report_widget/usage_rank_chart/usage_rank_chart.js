const HOUR_MS = 3600000;
const DAY_MS = 86400000;
const COLOR = [
  '--tb-service-cold-line-0',
  '--tb-service-cold-line-1',
  '--tb-service-cold-line-2',
  '--tb-service-cold-line-3',
  '--tb-service-cold-line-4',
];
const PAGE_SIZE = 5;

self.onInit = function () {
  self.ctx.custom = {};
  let { custom } = self.ctx;
  defineVariables();
  setTitle();
  getDashboardParameter();
  self.ctx.timewindowFunctions.onUpdateTimewindow(custom.searchStart, custom.searchEnd);
  createDataset();
  createChart();
  self.onResize();
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
    insertData();
    custom.chart.update();
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
  custom.$chart = $('.chart', $container);

  $scope.legendList = [];

  // Define Normal Variables
  custom.resizeThrottle = _.throttle(resize, 200, { trailing: true });
  custom.ownerDatasource = self.ctx.defaultSubscription.configuredDatasources[0];
  custom.isSample = custom.ownerDatasource.type == 'function';
  custom.hiddenDatasources = self.ctx.datasources.filter(x => x.entityAliasId === custom.ownerDatasource.entityAliasId);
  custom.mainDatasources = self.ctx.datasources.filter(x => x.entityAliasId !== custom.ownerDatasource.entityAliasId);
  custom.originDataKeys = self.ctx.defaultSubscription.configuredDatasources[1].dataKeys.filter(
    x => x.settings.hidden !== true
  );
  custom.isInitialized = false;
  let now = moment().valueOf();
  custom.searchStart = moment(now).startOf('day').valueOf();
  custom.searchEnd = moment(now).valueOf() + 1;
  custom.computedStyle = getComputedStyle($container[0]);
  custom.chartLabels = [];
  custom.chartData = [];
  custom.t = t;
  let originWidth = self.ctx.settings.widget.originWidth;
  if (self.ctx.isMobile) {
    originWidth = 960;
  }
  custom.widgetFontSize = _.round((self.ctx.width / originWidth) * 10, 2);
  if (custom.widgetFontSize < 6.25) {
    custom.widgetFontSize = 6.25;
  }
}

// Create Widget Title
function setTitle() {
  let { custom } = self.ctx;
  custom.$widgetTitle.html(t(self.ctx.widget.config.title));
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

function createDataset() {
  let { custom } = self.ctx;
  custom.dataSet = {
    labels: custom.chartLabels,
    datasets: [
      {
        label: '',
        data: custom.chartData,
        backgroundColor: [
          getStyle(COLOR[0]),
          getStyle(COLOR[1]),
          getStyle(COLOR[2]),
          getStyle(COLOR[3]),
          getStyle(COLOR[4]),
        ],
        hoverBackgroundColor: [
          getStyle(COLOR[0]),
          getStyle(COLOR[1]),
          getStyle(COLOR[2]),
          getStyle(COLOR[3]),
          getStyle(COLOR[4]),
        ],
        fill: true,
        borderWidth: 0,
        categoryPercentage: 0.15,
      },
    ],
  };
}

// 차트생성
function createChart() {
  let { custom, $scope } = self.ctx;
  custom.chart = new Chart(custom.$chart, {
    type: 'horizontalBar',
    data: custom.dataSet,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      tooltips: {
        mode: 'index',
        axis: 'y',
        intersect: false,
        xPadding: custom.widgetFontSize,
        yPadding: custom.widgetFontSize,
        bodySpacing: custom.widgetFontSize * 0.9,
        titleMarginBottom: custom.widgetFontSize,
        callbacks: {
          label: function (tooltipItem, data) {
            let label = data.datasets[tooltipItem.datasetIndex].label || '';
            if (label) {
              label += ': ';
            }
            label += tooltipItem.xLabel + ' %';

            return label;
          },
        },
      },
      hover: {
        mode: 'index',
        axis: 'y',
        intersect: false,
      },
      legend: {
        display: false,
      },
      scales: {
        xAxes: [
          {
            display: true,
            ticks: {
              min: 0,
              max: 100,
              fontColor: getStyle('--tb-service-font-2'),
              fontFamily: getStyle('--tb-config-font-family'),
              fontSize: custom.widgetFontSize * 1.2,
            },
            gridLines: {
              display: true,
              color: getStyle('--tb-service-border-1'),
              zeroLineColor: getStyle('--tb-service-border-1'),
            },
          },
        ],
        yAxes: [
          {
            display: true,
            type: 'category',
            ticks: {
              fontColor: getStyle('--tb-service-font-5'),
              fontFamily: getStyle('--tb-config-font-family'),
              fontSize: custom.widgetFontSize * 1.2,
              sampleSize: 10,
            },
            gridLines: {
              display: false,
            },
          },
        ],
      },
    },
  });
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
  let totalPowerUsage = 0;
  for (let i in result) {
    result[i].totalPowerUsage = 0;
    result[i].workTimeDay = 0;
    result[i].waitTimeDay = 0;
    result[i].workPowerUsage = 0;
    result[i].waitPowerUsage = 0;
    for (let j = custom.searchStart; j < custom.searchEnd; j += DAY_MS) {
      if (result[i].TP_WorkTimeDay) {
        let acc = 0;
        let targetArray = result[i].TP_WorkTimeDay.filter(x => x[0] >= j && x[0] < j + DAY_MS).map(x => x[1]);
        for (let k in targetArray) {
          acc += targetArray[k];
        }
        result[i].workTimeDay += acc;
      }
      if (result[i].TP_WaitTimeDay) {
        let acc = 0;
        let targetArray = result[i].TP_WaitTimeDay.filter(x => x[0] >= j && x[0] < j + DAY_MS).map(x => x[1]);
        for (let k in targetArray) {
          acc += targetArray[k];
        }
        result[i].waitTimeDay += acc;
      }
      if (result[i].TP_TotalPowerUsageDay) {
        let acc = 0;
        let targetArray = result[i].TP_TotalPowerUsageDay.filter(x => x[0] >= j && x[0] < j + DAY_MS).map(x => x[1]);
        for (let k in targetArray) {
          acc = targetArray[k];
        }
        result[i].totalPowerUsage += acc;
      }
      if (result[i].TP_WorkPowerUsageDay) {
        let acc = 0;
        let targetArray = result[i].TP_WorkPowerUsageDay.filter(x => x[0] >= j && x[0] < j + DAY_MS).map(x => x[1]);
        for (let k in targetArray) {
          acc = targetArray[k];
        }
        result[i].workPowerUsage += acc;
      }
      if (result[i].TP_WaitPowerUsageDay) {
        let acc = 0;
        let targetArray = result[i].TP_WaitPowerUsageDay.filter(x => x[0] >= j && x[0] < j + DAY_MS).map(x => x[1]);
        for (let k in targetArray) {
          acc = targetArray[k];
        }
        result[i].waitPowerUsage += acc;
      }
    }
    result[i].totalPowerUsage = _.round(result[i].totalPowerUsage / 1000, 1) || 0;
    result[i].totalPowerUsagePerHour = _.round(
      result[i].totalPowerUsage / ((custom.searchEnd - custom.searchStart) / HOUR_MS),
      1
    );
    result[i].workTimeDay = _.round(result[i].workTimeDay / HOUR_MS, 1);
    result[i].operationPowerUsagePerHour = _.round(result[i].workPowerUsage / 1000 / result[i].workTimeDay, 1) || 0;
    result[i].workPowerUsagePerHour = result[i].operationPowerUsagePerHour || 0;
    result[i].waitTimeDay = _.round(result[i].waitTimeDay / HOUR_MS, 1);
    result[i].waitPowerUsagePerHour = _.round(result[i].waitPowerUsage / 1000 / result[i].waitTimeDay, 1) || 0;

    totalPowerUsage += result[i].totalPowerUsage;
  }
  result.sort((a, b) => {
    if (a.totalPowerUsage > b.totalPowerUsage) return -1;
    if (a.totalPowerUsage < b.totalPowerUsage) return 1;
    return 0;
  });
  for (let i in result) {
    result[i].rank = +i + 1;
    result[i].percentage = _.round((result[i].totalPowerUsage / totalPowerUsage) * 100, 1);
  }
  let max = Math.max(...result.map(x => x.percentage));
  if (isNaN(max)) {
    max = 100;
  }
  custom.chart.options.scales.xAxes[0].ticks.max = max;
  return result;
}

// 데이터 삽입
function insertData() {
  let { custom, $scope } = self.ctx;
  custom.chartLabels.length = 0;
  custom.chartData.length = 0;
  $scope.legendList.length = 0;

  let targetIndex = PAGE_SIZE;
  if (custom.mainData.length < PAGE_SIZE) {
    targetIndex = custom.mainData.length;
  }
  for (let i = 0; i < targetIndex; i++) {
    custom.chartLabels.push(custom.mainData[i].label);
    custom.chartData.push(custom.mainData[i].percentage);
    $scope.legendList.push({
      color: getStyle(COLOR[i]),
      label: custom.mainData[i].label,
      value: custom.mainData[i].percentage + '%',
    });
  }
}

function resize() {
  let { custom } = self.ctx;
  // 위젯 전체 크기 조절
  let originWidth = self.ctx.settings.widget.originWidth;
  if (self.ctx.isMobile) {
    originWidth = 960;
  }
  custom.widgetFontSize = _.round((self.ctx.width / originWidth) * 10, 2);
  if (custom.widgetFontSize < 6.25) {
    custom.widgetFontSize = 6.25;
  }
  custom.$widget.css('font-size', `${custom.widgetFontSize}px`);

  // Header Height를 제외한 영역을 Main의 Height로 설정
  let headerHeight = custom.$widgetHeader.outerHeight(true);
  custom.$widgetContent.css('height', `calc(100% - ${headerHeight}px)`);

  if (custom.chart) {
    custom.chart.options.scales.xAxes[0].ticks.fontSize = custom.widgetFontSize * 1.2;
    custom.chart.options.scales.yAxes[0].ticks.fontSize = custom.widgetFontSize * 1.2;
    custom.chart.options.tooltips.xPadding = custom.widgetFontSize;
    custom.chart.options.tooltips.yPadding = custom.widgetFontSize;
    custom.chart.options.tooltips.bodySpacing = custom.widgetFontSize * 0.9;
    custom.chart.options.tooltips.titleMarginBottom = custom.widgetFontSize;
    custom.chart.resize();
  }
}

function getStyle(target) {
  let { custom } = self.ctx;
  return custom.computedStyle.getPropertyValue(target);
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
