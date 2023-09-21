let $injector = widgetContext.$scope.$injector;
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));
let attributeService = $injector.get(widgetContext.servicesMap.get('attributeService'));

const t = widgetContext.custom.t;
const STANDARD_WINDOW_SIZE = 1920 / 100;
const HOUR_MS = 3600000;
const DAY_MS = 24 * HOUR_MS;
const ANALYSIS_MAP = ['stopped', 'waiting', 'working', 'trial', 'unconnected'];
const STATUS = {
  stopped: { priority: 0, content: 'thingplus.state.stopped', color: 'var(--tb-service-state-stopped)' },
  waiting: { priority: 1, content: 'thingplus.state.waiting', color: 'var(--tb-service-state-waiting)' },
  working: { priority: 2, content: 'thingplus.state.working', color: 'var(--tb-service-state-working)' },
  trial: { priority: 3, content: 'thingplus.state.trial', color: 'var(--tb-service-state-trial)' },
  unconnected: { priority: 4, content: 'thingplus.state.unconnected', color: 'var(--tb-service-state-unconnected)' },
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

  vm.isLoading$.subscribe(async x => {
    if (vm.isFirstLoad) {
      vm.isFirstLoad = false;
      vm.$form = $('#active-power-form');
      vm.lineData = await loadData();
      if (vm.lineData['f1_watt']) {
        vm.lineData = vm.lineData['f1_watt'].map(d => {
          if (d.value < 0) d.value = 0;
          return { ts: moment(d.ts).valueOf(), value: d.value };
        });
      } else {
        vm.lineData = [];
      }
      drawChart();
    }
  });

  vm.legendList = [
    { key: 'watt', color: 'var(--tb-alarm-major)', label: t('thingplus.parameter.active-power') },
    { key: 'stopped', color: 'var(--tb-service-state-stopped)', label: t('thingplus.state.stopped') },
    { key: 'waiting', color: 'var(--tb-service-state-waiting)', label: t('thingplus.state.waiting') },
    { key: 'working', color: 'var(--tb-service-state-working)', label: t('thingplus.state.working') },
    { key: 'trial', color: 'var(--tb-service-state-trial)', label: t('thingplus.state.trial') },
    { key: 'unconnected', color: 'var(--tb-service-state-unconnected)', label: t('thingplus.state.unconnected') },
  ];

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
  vm.legendEnter = function (e, d) {
    if (d.key == 'watt') return;
    $(`.bar-rect`, vm.$form).addClass('bar-rect-active');
    $(`.bar-rect-${d.key}`, vm.$form).removeClass('bar-rect-active');
    $(`.bar-rect-${d.key}`, vm.$form).addClass('bar-rect-target');
  };
  vm.legendLeave = function (e, d) {
    if (d.key == 'watt') return;
    $(`.bar-rect`, vm.$form).removeClass('bar-rect-active');
    $(`.bar-rect`, vm.$form).removeClass('bar-rect-target');
  };

  // Add the event listeners that show or hide the tooltip.
  const bisect = d3.bisector(d => d.ts).center;

  function drawChart() {
    vm.d3Config = {
      viewWidth: 960,
      viewHeight: 540,
      barHeight: 10,
      barMargin: 15,
      margin: {
        top: 5,
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
    drawBar();
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
      .domain(d3.extent([custom.startTs, custom.endTs]))
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
          .ticks(7)
          .tickFormat(date => formatDate(date))
      );
  }

  function drawYAxis() {
    let { custom } = widgetContext;
    let { viewWidth, viewHeight, margin, barHeight, barMargin } = vm.d3Config;
    const width = viewWidth - margin.left - margin.right;
    const height = viewHeight - margin.top - margin.bottom;

    // xAxis 그리기
    vm.yAxis = d3.scaleLinear([d3.max(vm.lineData, d => d.value), 0], [0, height - barHeight - 2 * barMargin]);
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
    let { viewWidth, viewHeight, barMargin, barHeight, margin } = vm.d3Config;
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

    let dayLineList = [custom.startTs];
    let interval = (_.floor((custom.endTs - custom.startTs - 1) / (7 * DAY_MS)) + 1) * DAY_MS;
    for (let i = custom.startTs; i < moment(custom.endTs).endOf('day').valueOf(); i += interval) {
      if (moment(i).startOf('day').valueOf() > custom.startTs) {
        dayLineList.push(moment(i).startOf('day').valueOf());
      }
    }
    dayLineList.sort();

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
      .attr('height', viewHeight - margin.bottom)
      .attr('fill', (d, i) => {
        return i % 2 == 0 ? 'var(--tb-service-background-4)' : 'var(--tb-service-background-2)';
      })
      .attr('opacity', 0.5)
      .attr('stroke', 'var(--tb-service-border-1)');
  }

  function drawBar() {
    let { custom } = widgetContext;
    let { viewWidth, viewHeight, barMargin, barHeight, margin } = vm.d3Config;
    const x = vm.xAxis;

    // 상태 변화 막대 그리기
    vm.$d3.select('.main-group').append('g').attr('class', `bar`);

    vm.$d3
      .select(`.bar`)
      .append('g')
      .selectAll('g')
      .data(custom.timeline)
      .enter()
      .append('rect')
      .attr('class', d => `bar-rect bar-rect-${ANALYSIS_MAP[d.value]} tooltip tooltip-${d.index}`)
      .attr('fill', d => {
        return STATUS[ANALYSIS_MAP[d.value]].color;
      })
      .attr('x', d => margin.left + x(d.startTs))
      .attr('y', viewHeight - margin.bottom - barHeight - barMargin)
      .attr('width', d => x(d.endTs) - x(d.startTs))
      .attr('height', barHeight);

    for (let i in custom.timeline) {
      let $content = $('<div></div>');
      $content.css({
        color: 'var(--tb-service-font-0)',
        backgroundColor: 'rgba(0,0,0,0.8)',
        lineHeight: 1.5,
        borderRadius: `${8 / STANDARD_WINDOW_SIZE}vw`,
        padding: `${12 / STANDARD_WINDOW_SIZE}vw`,
      });

      let startTime = moment(custom.timeline[i].startTs).format(custom.ymdhm);
      let endTime = moment(custom.timeline[i].endTs).format(custom.ymdhm);
      let $date = $(`<div>${startTime} ~ ${endTime}</div>`);
      $date.css({
        textAlign: 'center',
        fontSize: `${12 / STANDARD_WINDOW_SIZE}vw`,
      });

      let $description = $(`<div></div>`);
      if (!_.isNil(custom.timeline[i].value) && custom.timeline[i].value !== '') {
        $description.html(`(${t(STATUS[ANALYSIS_MAP[custom.timeline[i].value]].content)})`);
      }
      $description.css({
        textAlign: 'center',
        fontSize: `${12 / STANDARD_WINDOW_SIZE}vw`,
      });

      $content.append($date);
      $content.append($description);

      $(`.tooltip-${custom.timeline[i].index}`, vm.$form).tooltipster({
        content: $content,
        interactive: true,
        theme: 'tooltipster-transparent',
        trigger: 'hover',
        delay: 100,
      });
    }
  }

  function drawLine() {
    let { custom } = widgetContext;
    let { viewWidth, viewHeight, barHeight, barMargin, margin } = vm.d3Config;
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
          { ts: custom.startTs, value: 0 },
          { ts: custom.endTs, value: 0 },
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
    let { viewWidth, viewHeight, barMargin, barHeight, margin } = vm.d3Config;
    const i = bisect(vm.lineData, vm.xAxis.invert(d3.pointer(event)[0] - margin.left));
    vm.$tooltip.style('display', null);
    vm.$vertical.style('display', null);
    vm.$horizontal.style('display', null);
    let standard = (viewHeight - margin.bottom - barHeight - 2 * barMargin) / 2;
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
          .data([formatFullDate(vm.lineData[i].ts), formatValue(vm.lineData[i].value)])
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
      .attr('d', `M0,0V${viewHeight - margin.bottom - barHeight - 2 * barMargin}`);
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
}

function loadData() {
  return new Promise((resolve, reject) => {
    let acc = 'NONE';
    if (widgetContext.custom.endTs - widgetContext.custom.startTs > 31 * DAY_MS) {
      acc = 'MAX';
    }
    attributeService
      .getEntityTimeseries(
        entityId,
        ['f1_watt'],
        widgetContext.custom.startTs,
        widgetContext.custom.endTs,
        50000,
        acc,
        Math.floor((widgetContext.custom.endTs - widgetContext.custom.startTs) / 500),
        'ASC',
        true
      )
      .subscribe(datas => {
        resolve(datas);
      });
  });
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

function formatValue(value) {
  return value.toLocaleString() + 'W';
}
