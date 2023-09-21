let $injector = widgetContext.$scope.$injector;
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));
let attributeService = $injector.get(widgetContext.servicesMap.get('attributeService'));

const t = widgetContext.custom.t;
const STANDARD_WINDOW_SIZE = 1920 / 100;
const HOUR_MS = 3600000;
const DAY_MS = 24 * HOUR_MS;
const TREND = {
  'volt-imbalance': { label: t('thingplus.alarm-type.volt-imbalance'), key: 'unbal' },
  'curr-imbalance': { label: t('thingplus.alarm-type.curr-imbalance'), key: 'f1_unbal' },
  thd: { label: t('thingplus.alarm-type.thd'), key: 'f1_thd' },
  'power-factor': { label: t('thingplus.alarm-type.power-factor'), key: 'f1_PF' },
};

openEditEntityDialog();

function openEditEntityDialog() {
  customDialog.customDialog(htmlTemplate, EditEntityDialogController).subscribe();
}

function EditEntityDialogController(instance) {
  let vm = instance;
  vm.ownerId = widgetContext.defaultSubscription.configuredDatasources[0].entity.id;
  vm.t = t;
  vm.isFirstLoad = true;
  vm.entityLabel = entityLabel;

  vm.editEntityFormGroup = vm.fb.group({});
  vm.showTrend = false;
  vm.legendList = [];
  vm.labelList = [
    { label: t('thingplus.label.customerL1-name'), value: additionalParams.customerL1Name },
    { label: t('thingplus.label.customerL2-name'), value: additionalParams.customerL2Name },
    { label: t('thingplus.label.device-name'), value: additionalParams.originatorLabel },
  ];
  vm.labelList2 = [
    { label: t('thingplus.label.alarm-category'), value: t('thingplus.alarm-category.' + additionalParams.category) },
    { label: t('thingplus.label.alarm-type'), value: t('thingplus.alarm-type.' + additionalParams.type) },
    { label: t('thingplus.label.alarm-severity'), value: t('thingplus.alarm-severity.' + additionalParams.severity) },
  ];

  vm.isLoading$.subscribe(async x => {
    if (vm.isFirstLoad) {
      vm.isFirstLoad = false;
      vm.$form = $('#view-details-form');
      if (TREND[additionalParams.type]) {
        vm.showTrend = true;
        vm.key = TREND[additionalParams.type].key;
        vm.startTs = additionalParams.createdTime;
        vm.endTs = moment().valueOf();
        if (additionalParams.clearTs != 0) {
          vm.endTs = additionalParams.clearTs;
        }
        vm.legendList = [
          { key: additionalParams.type, color: 'var(--tb-alarm-major)', label: TREND[additionalParams.type].label },
        ];
        vm.lineData = await loadData(vm.key);
        if (vm.lineData[vm.key]) {
          vm.lineData = vm.lineData[vm.key].map(d => {
            if (d.value < 0) d.value = 0;
            return { ts: moment(d.ts).valueOf(), value: d.value };
          });
        } else {
          vm.lineData = [];
        }
        console.log(vm.lineData);
        drawChart();
      }
    }
  });

  vm.calcFontSize = function () {
    const originWidth = widgetContext.settings.widget.originWidth;
    let widgetFontSize = _.round((widgetContext.width / originWidth) * 10, 2);
    if (widgetFontSize < 6.25) {
      widgetFontSize = 6.25;
    }
    return widgetFontSize;
  };
  vm.cancel = function () {
    vm.dialogRef.close(null);
  };

  // Add the event listeners that show or hide the tooltip.
  const bisect = d3.bisector(d => d.ts).center;

  function drawChart() {
    vm.d3Config = {
      viewWidth: 960,
      viewHeight: 540,
      margin: {
        top: 10,
        right: 0,
        bottom: 40,
        left: 60,
      },
    };

    // svg 영역 정의
    vm.$d3 = d3
      .select($('.chart', vm.$form)[0])
      .append('svg')
      .attr('viewBox', `0 0 ${vm.d3Config.viewWidth} ${vm.d3Config.viewHeight}`)
      .attr('width', vm.d3Config.viewWidth)
      .attr('height', vm.d3Config.viewHeight);

    if (vm.lineData.length > 0) {
      vm.$d3
        .on('pointerenter pointermove', pointermoved)
        .on('pointerleave', pointerleft)
        .on('touchstart', event => event.preventDefault());
    }

    drawXAxis();
    drawYAxis();
    drawMain();
    vm.$vertical = vm.$d3.select('.main-group').append('g');
    vm.$horizontal = vm.$d3.select('.main-group').append('g');
    if (vm.lineData.length > 0) {
      drawLine();
    }

    // Create the tooltip container.
    vm.$tooltip = vm.$d3.select('.main-group').append('g');
  }

  function drawXAxis() {
    let { custom } = widgetContext;
    let { viewWidth, viewHeight, margin } = vm.d3Config;
    const width = viewWidth - margin.left - margin.right;
    const height = margin.bottom;

    // xAxis 그리기
    vm.xAxis = d3
      .scaleTime()
      .domain(d3.extent([vm.startTs, vm.endTs]))
      .range([0, width]);
    vm.$xAxis = vm.$d3
      .append('g')
      .attr('class', 'axis')
      .attr('transform', 'translate(' + margin.left + ', ' + (viewHeight - height) + ')')
      .style('font-size', '12px')
      .style('font-family', 'var(--tb-config-font-family)')
      .style('color', 'var(--tb-service-font-4)')
      .style('stroke-width', '0.1em')
      .call(
        d3
          .axisBottom(vm.xAxis)
          .ticks(4)
          .tickFormat(date => formatDate(date))
      );
  }

  function drawYAxis() {
    let { custom } = widgetContext;
    let { viewWidth, viewHeight, margin } = vm.d3Config;
    const width = viewWidth - margin.left - margin.right;
    const height = viewHeight - margin.top - margin.bottom;

    // xAxis 그리기
    vm.yAxis = d3.scaleLinear([100, 0], [0, height]);
    vm.$yAxis = vm.$d3
      .append('g')
      .attr('class', 'axis')
      .attr('transform', 'translate(' + (viewWidth - width) + ', ' + margin.top + ')')
      .style('font-size', '12px')
      .style('font-family', 'var(--tb-config-font-family)')
      .style('color', 'var(--tb-service-font-4)')
      .style('stroke-width', '0.1em')
      .call(d3.axisLeft(vm.yAxis).ticks(5));
  }

  function drawMain() {
    let { custom } = widgetContext;
    let { viewWidth, viewHeight, margin } = vm.d3Config;
    const x = vm.xAxis;

    vm.$d3
      .append('g')
      .attr('class', 'main-group')
      .append('rect')
      .attr('class', 'background')
      .attr('x', margin.left)
      .attr('width', viewWidth - margin.left - margin.right)
      .attr('height', viewHeight - margin.bottom)
      .attr('fill', 'var(--tb-service-background-1)')
      .attr('stroke', 'var(--tb-service-border-1)');

    let dayLineList = [vm.startTs];
    let interval = (_.floor((vm.endTs - vm.startTs) / (7 * DAY_MS)) + 1) * DAY_MS;
    for (let i = vm.startTs; i < moment(vm.endTs).endOf('day').valueOf(); i += interval) {
      if (moment(i).startOf('day').valueOf() > vm.startTs) {
        dayLineList.push(moment(i).startOf('day').valueOf());
      }
    }
    dayLineList.sort();
    if (vm.endTs - vm.startTs <= DAY_MS) {
      dayLineList = [];
    }

    vm.$d3
      .select(`.main-group`)
      .append('g')
      .attr('class', `day-group`)
      .selectAll('g')
      .data(dayLineList)
      .enter()
      .append('rect')
      .attr('class', 'day-line')
      .attr('x', d => margin.left + x(d))
      .attr('width', d => {
        let endTs = d + interval;
        if (endTs > vm.endTs) {
          endTs = vm.endTs;
        }
        if (d == vm.startTs) {
          endTs = moment(d)
            .add(_.floor(interval / DAY_MS), 'days')
            .startOf('day')
            .valueOf();
        }
        return x(endTs) - x(d);
      })
      .attr('height', viewHeight - margin.bottom)
      .attr('fill', (d, i) => {
        return i % 2 == 0 ? 'var(--tb-service-background-4)' : 'var(--tb-service-background-2)';
      })
      .attr('opacity', 0.5)
      .attr('stroke', 'var(--tb-service-border-1)');
  }

  function drawLine() {
    let { viewWidth, viewHeight, margin } = vm.d3Config;
    const x = vm.xAxis;
    const y = vm.yAxis;

    vm.$d3.select('.main-group').append('g').attr('class', `line`);

    const line = d3
      .line()
      .x(d => x(d.ts))
      .y(d => y(d.value));

    vm.$d3
      .select(`.line`)
      .append('path')
      .style('transform', `translate(${margin.left}px, ${margin.top}px)`)
      .attr('fill', 'none')
      .attr('stroke', 'var(--tb-service-font-3)')
      .attr('stroke-width', 1)
      .attr(
        'd',
        line([
          { ts: vm.startTs, value: 0 },
          { ts: vm.endTs, value: 0 },
        ])
      );

    // 상태 변화 막대 그리기

    vm.$d3
      .select(`.line`)
      .append('path')
      .style('transform', `translate(${margin.left}px, ${margin.top}px)`)
      .attr('fill', 'none')
      .attr('stroke', 'var(--tb-alarm-major)')
      .attr('stroke-width', 1.5)
      .attr('d', line(vm.lineData));
  }

  function pointermoved(event) {
    let { custom } = widgetContext;
    let { viewWidth, viewHeight, margin } = vm.d3Config;
    const i = bisect(vm.lineData, vm.xAxis.invert(d3.pointer(event)[0] - margin.left));
    vm.$tooltip.style('display', null);
    vm.$vertical.style('display', null);
    vm.$horizontal.style('display', null);
    let standard = (viewHeight - margin.bottom) / 2;
    let yTrans = 0;
    let xTrans = 0;
    if (vm.xAxis(vm.lineData[i].ts) < margin.left + 60) {
      xTrans = 60;
    }
    if (vm.xAxis(vm.lineData[i].ts) > viewWidth - margin.left - margin.right - 60) {
      xTrans = -60;
    }
    if (vm.yAxis(vm.lineData[i].value) > standard) {
      yTrans = -60;
    } else {
      yTrans = 0;
    }
    vm.$tooltip.attr(
      'transform',
      `translate(${margin.left + vm.xAxis(vm.lineData[i].ts) + xTrans},${vm.yAxis(vm.lineData[i].value) + yTrans})`
    );
    vm.$vertical.attr('transform', `translate(${margin.left + vm.xAxis(vm.lineData[i].ts)},0)`);
    vm.$horizontal.attr('transform', `translate(0,${vm.yAxis(vm.lineData[i].value) + margin.top})`);

    const path = vm.$tooltip.selectAll('path').data([,]).join('path').attr('fill', 'rgba(25,25,25,0.9)');
    const text = vm.$tooltip
      .selectAll('text')
      .data([,])
      .join('text')
      .call(text =>
        text
          .selectAll('tspan')
          .data([formatFullDate(vm.lineData[i].ts), vm.lineData[i].value])
          .join('tspan')
          .attr('x', 0)
          .attr('y', (_, i) => `${i * 1.1}em`)
          .attr('font-weight', (_, i) => (i ? null : 'bold'))
          .attr('fill', 'var(--tb-service-font-0)')
          .attr('font-size', '12px')
          .text(d => d)
      );

    vm.$vertical
      .selectAll('path')
      .data([,])
      .join('path')
      .attr('stroke', 'var(--tb-service-font-3)')
      .attr('stroke-width', 1)
      .attr('d', `M0,0V${viewHeight - margin.bottom}`);
    vm.$horizontal
      .selectAll('path')
      .data([,])
      .join('path')
      .attr('stroke', 'var(--tb-service-font-3)')
      .attr('stroke-width', 1)
      .attr('d', `M${margin.left},0H${viewWidth - margin.right}`);

    size(text, path);
  }

  function pointerleft() {
    vm.$tooltip.style('display', 'none');
    vm.$vertical.style('display', 'none');
    vm.$horizontal.style('display', 'none');
  }

  function size(text, path) {
    const { x, y, width: w, height: h } = text.node().getBBox();
    text.attr('transform', `translate(${-w / 2},${15 - y})`);
    path.attr('d', `M${-w / 2 - 10},5H-15H${w / 2 + 10}v${h + 20}h-${w + 20}z`);
  }

  function loadData(key) {
    return new Promise((resolve, reject) => {
      let acc = 'NONE';
      if (vm.endTs - vm.startTs > 31 * DAY_MS) {
        acc = 'AVG';
      }
      attributeService
        .getEntityTimeseries(
          additionalParams.originator,
          [key],
          vm.startTs,
          vm.endTs,
          50000,
          acc,
          Math.floor((vm.endTs - vm.startTs) / 500),
          'ASC',
          true
        )
        .subscribe(datas => {
          resolve(datas);
        });
    });
  }
}

function getStyle(target) {
  return widgetContext.custom.computedStyle.getPropertyValue(target);
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

function formatFullDate(date) {
  return moment(date).format('YYYY-MM-DD HH:mm');
}
