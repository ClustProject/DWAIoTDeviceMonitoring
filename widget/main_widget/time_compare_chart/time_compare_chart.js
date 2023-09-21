const HOUR_MS = 60 * 60 * 1000;
self.onInit = async function () {
  self.ctx.custom = {};
  let { custom } = self.ctx;
  defineVariables();
  setTitle();
  createDataset();
  createChart();
  self.onResize();

  startUpdate();
  custom.loadInterval = setInterval(() => {
    // 매분 00초에 동작
    if (moment().second() == 0) {
      startUpdate();
    }
  }, 1000);
};

self.onResize = function () {
  self.ctx.custom.resizeThrottle();
};

self.onDestroy = function () {
  let { custom, $scope, $container } = self.ctx;
  try {
    if (custom.loadInterval) {
      clearInterval(custom.loadInterval);
    }
  } catch (e) {
    log(e);
  }
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
  custom.$compareSection = $('.compare-section', $container);
  custom.$chartSection = $('.chart-section', $container);
  custom.$chart = $('.chart', $container);

  $scope.comparePercentage = '';
  $scope.compareDirection = '';
  $scope.headerActionList = self.ctx.actionsApi.getActionDescriptors('widgetHeaderButton').map(x => {
    return { name: x.name, icon: x.icon, action: e => handleHeaderAction(x) };
  });

  // Define Normal Variables
  custom.resizeThrottle = _.throttle(resize, 200, { trailing: true });
  custom.ownerDatasource = self.ctx.defaultSubscription.configuredDatasources[0];
  custom.isSample = custom.ownerDatasource.type == 'function';
  custom.hiddenDatasources = self.ctx.datasources.filter(x => x.entityAliasId === custom.ownerDatasource.entityAliasId);
  custom.mainDatasources = self.ctx.datasources.filter(x => x.entityAliasId !== custom.ownerDatasource.entityAliasId);
  custom.targetKey = self.ctx.defaultSubscription.configuredDatasources[1].dataKeys[0];
  custom.isInitialize = false;
  custom.chartLabels = [
    t('thingplus.time-format.today2'),
    t('thingplus.time-format.last-day'),
    t('thingplus.time-format.last-week'),
    t('thingplus.time-format.last-month'),
  ];
  custom.chartData = [0, 0, 0, 0];
  custom.t = t;
  const originWidth = self.ctx.settings.widget.originWidth;
  custom.widgetFontSize = _.round((self.ctx.width / originWidth) * 10, 2);
  if (custom.widgetFontSize < 6.25) {
    custom.widgetFontSize = 6.25;
  }
  custom.computedStyle = getComputedStyle($container[0]);
  custom.units = custom.targetKey.units ? custom.targetKey.units : '';
  custom.decimals = custom.targetKey.decimals ? custom.targetKey.decimals : '';
  custom.mainData = [];
  custom.isUpdated = false;
}

// Create Widget Title
function setTitle() {
  let { custom } = self.ctx;
  custom.$widgetTitle.html(self.ctx.widget.config.title);
  custom.$widgetTitle.css(self.ctx.widget.config.titleStyle);
}

async function startUpdate() {
  let { custom, $scope } = self.ctx;
  custom.now = moment().valueOf();
  custom.startTs = moment(custom.now).subtract(1, 'month').subtract(2, 'days').valueOf();
  custom.analysisEndTs = moment(custom.now).subtract(1, 'hours').startOf('hours').valueOf();
  custom.endTs = custom.now;

  if (custom.isSample) return;

  custom.timeline = await drawTimeline();
  insertData(custom.timeline);
  custom.chart.update();
  self.ctx.detectChanges();
  self.onResize();
}

async function drawTimeline() {
  let initData = await loadInitData();
  let telemetryData = await loadTelemetryData();
  let timelineData = createTimeline(initData, telemetryData);
  return timelineData;
}

function loadInitData() {
  return new Promise((resolve, reject) => {
    let { custom } = self.ctx;
    let entityId = custom.mainDatasources[0].entity.id;
    let keys = ['TP_AnalysisState', 'TP_ModifiedState'];
    self.ctx.http
      .get(
        `/api/plugins/telemetry/${entityId.entityType}/${
          entityId.id
        }/values/timeseries?limit=1&agg=NONE&keys=${keys.join(',')}&startTs=0&endTs=${
          custom.startTs
        }&useStrictDataTypes=true`
      )
      .subscribe(datas => {
        // 분석 데이터 삭제
        if (custom.now - custom.startTs < HOUR_MS) {
          delete datas.TP_AnalysisState;
        }
        if (datas.TP_ModifiedState) {
          let value = datas.TP_ModifiedState[0].value;
          if (value.endTs < custom.now) {
            delete datas.TP_ModifiedState;
          } else {
            value.startTs = custom.startTs;
          }
        }
        resolve(datas);
      });
  });
}

function loadTelemetryData() {
  return new Promise((resolve, reject) => {
    let { custom } = self.ctx;
    let entityId = custom.mainDatasources[0].entity.id;
    let keys = ['TP_AnalysisState', 'TP_OperationState', 'TP_ConnectionState', 'TP_ModifiedState'];
    self.ctx.http
      .get(
        `/api/plugins/telemetry/${entityId.entityType}/${
          entityId.id
        }/values/timeseries?limit=50000&agg=NONE&keys=${keys.join(',')}&startTs=${custom.startTs}&endTs=${
          custom.endTs
        }&useStrictDataTypes=true`
      )
      .subscribe(datas => {
        resolve(datas);
      });
  });
}

function createTimeline(initData, telemetryData) {
  let { custom } = self.ctx;
  let timeline = [];

  // 상태 데이터 병합
  if (initData.TP_AnalysisState) {
    timeline.push({ ts: custom.startTs, value: initData.TP_AnalysisState[0].value });
  }
  if (telemetryData.TP_AnalysisState) {
    timeline = timeline.concat(telemetryData.TP_AnalysisState);
  }

  // 분석 데이터가 없는 경우 통신이상으로 표시
  if (timeline.length == 0) {
    timeline.push({ ts: custom.startTs, value: 4 });
  }
  for (let i in telemetryData.TP_OperationState) {
    // 분석이 완료되는 시점 이후의 데이터는 기본 데이터로 대체 (현 시간 정각의 1시간전)
    if (telemetryData.TP_OperationState[i].ts > custom.analysisEndTs) {
      telemetryData.TP_OperationState[i].value = OPERATION_MAP[telemetryData.TP_OperationState[i].value];
      timeline.push(telemetryData.TP_OperationState[i]);
    }
  }
  for (let i in telemetryData.TP_ConnectionState) {
    // 분석이 완료되는 시점 이후의 데이터는 기본 데이터로 대체 (현 시간 정각의 1시간전)
    if (telemetryData.TP_ConnectionState[i].ts > custom.analysisEndTs) {
      if (telemetryData.TP_ConnectionState[i].value == 'false') {
        timeline.push({ ts: telemetryData.TP_ConnectionState[i].ts, value: 4 });
      }
    }
  }
  timeline.sort((a, b) => {
    return a.ts - b.ts;
  });

  // 수정된 부분 적용
  let modifiedData = [];
  if (initData.TP_ModifiedState) {
    modifiedData = modifiedData.concat(initData.TP_ModifiedState);
  }
  if (telemetryData.TP_ModifiedState) {
    modifiedData = modifiedData.concat(telemetryData.TP_ModifiedState);
  }
  for (let i in modifiedData) {
    let targetData = modifiedData[i].value;
    for (let j = 0; j < timeline.length; j++) {
      // case 1 : 수정된 데이터가 기존 데이터와 같은 경우
      if (timeline[j].ts == targetData.startTs && timeline[j + 1] && timeline[j + 1].ts == targetData.endTs) {
        timeline[j].value = targetData.state;
        if (
          timeline[j - 1] &&
          timeline[j - 1].value == targetData.state &&
          timeline[j + 1] &&
          timeline[j + 1].value == targetData.state
        ) {
          // case 1-1: 이전 값과 다음 값이 수정된 값과 같은 경우 현재 값과 다음 값 삭제
          timeline.splice(j, 2);
        } else if (timeline[j - 1] && timeline[j - 1].value == targetData.state) {
          // case 1-1: 이전 값이 수정된 값과 같은 경우 현재 값 삭제
          timeline.splice(j, 1);
        } else if (timeline[j + 1] && timeline[j + 1].value == targetData.state) {
          // case 1-1: 다음 값이 수정된 값과 같은 경우 다음 값 삭제
          timeline.splice(j + 1, 1);
        }
        break;
      }
      // case 2 : 수정된 데이터와 기존 데이터의 시작 시간이 같은 경우
      else if (timeline[j].ts == targetData.startTs) {
        timeline[j].ts = targetData.endTs;
        // 이전 값이 수정된 값과 다른 경우 추가
        if (!timeline[j - 1] || timeline[j - 1].value != targetData.state) {
          timeline.splice(j, 0, { ts: targetData.startTs, value: timeline[j].value });
        }
        break;
      }
      // case 3 : 수정된 데이터와 기존 데이터의 종료 시간이 같은 경우
      else if (timeline[j + 1] && timeline[j + 1].ts == targetData.endTs) {
        if (timeline[j + 1].value == targetData.state) {
          timeline[j + 1].ts = targetData.startTs;
        } else {
          timeline.splice(j + 1, 0, { ts: targetData.startTs, value: targetData.state });
        }
        break;
      }
      // case 4 : 수정된 데이터가 기존 데이터의 시작 시간과 종료 시간 사이에 있는 경우
      else if (
        timeline[j].ts < targetData.startTs &&
        ((timeline[j + 1] && timeline[j + 1].ts > targetData.endTs) || !timeline[j + 1])
      ) {
        timeline.splice(j + 1, 0, { ts: targetData.startTs, value: targetData.state });
        if (timeline[j + 1]) {
          timeline.splice(j + 2, 0, { ts: targetData.endTs, value: timeline[j].value });
        } else {
          timeline.splice(j + 2, 0, { ts: custom.endTs, value: timeline[j].value });
        }

        break;
      }
    }
  }
  timeline.sort((a, b) => {
    return a.ts - b.ts;
  });

  let result = [];
  for (let i = 0; i < timeline.length; i++) {
    result.push({
      index: i,
      startTs: timeline[i].ts,
      endTs: _.isNil(timeline[i + 1]) ? custom.endTs : timeline[i + 1].ts,
      value: timeline[i].value,
    });
  }

  return result;
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
  let compareSectionHeight = custom.$compareSection.outerHeight(true);
  custom.$chartSection.css('height', `calc(100% - ${headerHeight + compareSectionHeight}px)`);

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

function createDataset(title, labels) {
  let { custom } = self.ctx;
  custom.dataSet = {
    labels: custom.chartLabels,
    datasets: [
      {
        data: custom.chartData,
        categoryPercentage: 0.25,
        fill: true,
        backgroundColor: [
          getStyle('--tb-service-accent'),
          getStyle('--tb-service-compare-bar'),
          getStyle('--tb-service-compare-bar'),
          getStyle('--tb-service-compare-bar'),
        ],
        hoverBackgroundColor: [
          tinycolor(getStyle('--tb-service-accent')).darken(),
          tinycolor(getStyle('--tb-service-compare-bar')).darken(),
          tinycolor(getStyle('--tb-service-compare-bar')).darken(),
          tinycolor(getStyle('--tb-service-compare-bar')).darken(),
        ],
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
        callbacks: {
          title: function (tooltipItem, data) {
            let date = moment();
            if (tooltipItem[0].index == 0) {
              date = moment();
            }
            if (tooltipItem[0].index == 1) {
              date = moment().subtract(1, 'days');
              if (moment().isoWeekday() == 1) {
                date = moment().subtract(3, 'days');
              }
            }
            if (tooltipItem[0].index == 2) {
              date = moment().subtract(1, 'weeks');
            }
            if (tooltipItem[0].index == 3) {
              date = moment().subtract(1, 'months');
              if (date.isoWeekday() == 6) {
                date = date.subtract(1, 'days');
              }
              if (date.isoWeekday() == 7) {
                date = date.subtract(2, 'days');
              }
            }
            return moment(date).format('YYYY-MM-DD');
          },
          label: function (tooltipItem, data) {
            let label = data.datasets[tooltipItem.datasetIndex].label || '';
            if (label) {
              label += ': ';
            }
            label += _.round(tooltipItem.xLabel, custom.decimals) + ' ' + custom.units;

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
              suggestedMax: 1,
              min: 0,
              maxTicksLimit: 4,
              fontColor: getStyle('--tb-service-font-2'),
              fontFamily: getStyle('--tb-config-font-family'),
              fontSize: custom.widgetFontSize * 1.2,
            },
            gridLines: {
              display: false,
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
              fontColor: getStyle('--tb-service-font-4'),
              fontFamily: getStyle('--tb-config-font-family'),
              fontSize: custom.widgetFontSize * 1.2,
            },
          },
        ],
      },
    },
  });
}

function insertData(timeline) {
  let { custom, $scope } = self.ctx;
  custom.accDatas = [0, 0, 0, 0];
  let prevMonthStart = moment().subtract(1, 'months').startOf('day').valueOf();
  let prevMonthEnd = moment().subtract(1, 'months').valueOf();
  let prevWeekStart = moment().subtract(1, 'weeks').startOf('day').valueOf();
  let prevWeekEnd = moment().subtract(1, 'weeks').valueOf();
  let prevDayStart = moment().subtract(1, 'days').startOf('day').valueOf();
  let prevDayEnd = moment().subtract(1, 'days').valueOf();
  let currDayStart = moment().startOf('day').valueOf();
  let currDayEnd = moment().valueOf();

  if (moment(prevMonthStart).isoWeekday() == 7) {
    prevMonthStart = moment(prevMonthStart).subtract(2, 'days').valueOf();
    prevMonthEnd = moment(prevMonthEnd).subtract(2, 'days').valueOf();
  }
  if (moment(prevMonthStart).isoWeekday() == 6) {
    prevMonthStart = moment(prevMonthStart).subtract(1, 'days').valueOf();
    prevMonthEnd = moment(prevMonthEnd).subtract(1, 'days').valueOf();
  }

  let range = [
    [currDayStart, currDayEnd],
    [prevDayStart, prevDayEnd],
    [prevWeekStart, prevWeekEnd],
    [prevMonthStart, prevMonthEnd],
  ];

  for (let i in range) {
    for (let j in timeline) {
      if (timeline[j].value == 2 || timeline[j].value == 3) {
        // case 1 : 포함되는 경우
        if (timeline[j].startTs >= range[i][0] && timeline[j].endTs <= range[i][1]) {
          custom.accDatas[i] += timeline[j].endTs - timeline[j].startTs;
        }
        // case 2 : 앞쪽이 포함되는 경우
        else if (
          timeline[j].startTs >= range[i][0] &&
          timeline[j].startTs < range[i][1] &&
          timeline[j].endTs > range[i][1]
        ) {
          custom.accDatas[i] += range[i][1] - timeline[j].startTs;
        }
        // case 3 : 뒤쪽이 포함되는 경우
        else if (
          timeline[j].startTs < range[i][0] &&
          timeline[j].endTs > range[i][0] &&
          timeline[j].endTs <= range[i][1]
        ) {
          custom.accDatas[i] += timeline[j].endTs - range[i][0];
        }
        // case 4 : 역으로 포함되는 경우
        else if (timeline[j].startTs < range[i][0] && timeline[j].endTs > range[i][1]) {
          custom.accDatas[i] += range[i][1] - range[i][0];
        }
      }
    }
  }

  if (custom.targetKey.postFuncBody) {
    let dataFunction = new Function('value', custom.targetKey.postFuncBody);
    for (let i in custom.accDatas) {
      custom.accDatas[i] = dataFunction(custom.accDatas[i]);
      let decimals = custom.targetKey.decimals;
      if (decimals && !isNaN(Number(custom.accDatas[i]))) {
        custom.accDatas[i] = _.round(custom.accDatas[i], decimals);
      }
    }
  }

  for (let i in custom.accDatas) {
    custom.chartData[i] = custom.accDatas[i];
  }

  let dayDiff = custom.accDatas[0] - custom.accDatas[1];
  let weekDiff = custom.accDatas[0] - custom.accDatas[2];
  let monthDiff = custom.accDatas[0] - custom.accDatas[3];

  $scope.compareList = [
    {
      label: 'thingplus.energy.compare-last-day',
      value: custom.accDatas[1] > 0 ? _.round(Math.abs(dayDiff / custom.accDatas[1]) * 100) : 0,
      direction: dayDiff > 0 ? 'high' : dayDiff < 0 ? 'low' : '',
      icon: dayDiff > 0 ? 'arrow_upward' : dayDiff < 0 ? 'arrow_downward' : '',
    },
    {
      label: 'thingplus.energy.compare-last-week',
      value: custom.accDatas[2] > 0 ? _.round(Math.abs(weekDiff / custom.accDatas[2]) * 100) : 0,
      direction: weekDiff > 0 ? 'high' : weekDiff < 0 ? 'low' : '',
      icon: weekDiff > 0 ? 'arrow_upward' : weekDiff < 0 ? 'arrow_downward' : '',
    },
    {
      label: 'thingplus.energy.compare-last-month',
      value: custom.accDatas[3] > 0 ? _.round(Math.abs(monthDiff / custom.accDatas[3]) * 100) : 0,
      direction: monthDiff > 0 ? 'high' : monthDiff < 0 ? 'low' : '',
      icon: monthDiff > 0 ? 'arrow_upward' : monthDiff < 0 ? 'arrow_downward' : '',
    },
  ];
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

function log() {
  console.log(t(self.ctx.widget.config.title) + '\r\n', ...arguments);
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
