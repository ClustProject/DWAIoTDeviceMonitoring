let $injector = widgetContext.$scope.$injector;
let dialogs = $injector.get(widgetContext.servicesMap.get('dialogs'));
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));

const JWT_TOKEN = window.localStorage.getItem('jwt_token');
const t = widgetContext.custom.t;
const STANDARD_WINDOW_SIZE = 1920 / 100;

openCheckEntityDialog();

function openCheckEntityDialog() {
  customDialog.customDialog(htmlTemplate, CheckEntityDialogController).subscribe();
}

function CheckEntityDialogController(instance) {
  let vm = instance;
  vm.entityName = entityName;
  vm.checkEntityFormGroup = vm.fb.group({});

  vm.isLoading$.subscribe(async x => {
    vm.$form = $('#check-device-form');
  });

  vm.checkList = [
    { index: 0, key: 'exist', label: t('thingplus.label.data-exist'), value: false },
    { index: 1, key: 'valid', label: t('thingplus.label.data-valid'), value: false },
    { index: 2, key: 'regular', label: t('thingplus.label.data-regular'), value: false },
  ];

  vm.calcFontSize = function () {
    const originWidth = widgetContext.settings.widget.originWidth;
    let widgetFontSize = _.round((widgetContext.width / originWidth) * 10, 2);
    if (widgetFontSize < 6.25) {
      widgetFontSize = 6.25;
    }
    return widgetFontSize;
  };

  loadData(vm);
  vm.cancel = function () {
    vm.dialogRef.close(null);
  };
}

function loadData(vm) {
  let keys = [
    'unbal',
    'f1_type',
    'f1_volt1',
    'f1_volt2',
    'f1_volt3',
    'f1_amp1',
    'f1_amp2',
    'f1_amp3',
    'f1_watt',
    'f1_var',
    'f1_VA',
    'f1_PF',
    'f1_kwh_imp',
    'frequency',
    'f1_unbal',
    'f1_thd',
  ];
  let now = moment().valueOf();
  let start = now - 30 * 60 * 1000;

  widgetContext.http
    .get(
      `/api/plugins/telemetry/${entityId.entityType}/${
        entityId.id
      }/values/timeseries?limit=50000&agg=NONE&keys=${keys.join(
        ','
      )}&startTs=${start}&endTs=${now}&useStrictDataTypes=true`
    )
    .subscribe(datas => {
      let checkResult = checkData(keys, datas);
      vm.checkList[0].value = checkResult.exist;
      vm.checkList[1].value = checkResult.valid;
      vm.checkList[2].value = checkResult.regular;
      createContent(vm, checkResult);
    });
}
function checkData(keys, datas) {
  let result = {
    exist: true,
    valid: true,
    regular: true,
    existInfo: [],
    validInfo: [],
    regularInfo: [],
  };
  for (let i in keys) {
    if (!datas[keys[i]] || datas[keys[i]].length == 0) {
      result.exist = false;
      result.valid = false;
      result.regular = false;
      result.existInfo.push(keys[i]);
      result.validInfo.push(keys[i]);
      result.regularInfo.push(keys[i]);
    }
  }
  result.existInfo = result.existInfo.join(', ');
  if (!result.exist) {
    result.validInfo = result.validInfo.join(', ');
    result.regularInfo = result.regularInfo.join(', ');
    return result;
  }

  for (let i in datas) {
    let delay = 0;
    for (let j in datas[i]) {
      if (i == 'f1_type') {
        if (![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].includes(datas[i][j].value)) {
          result.valid = false;
          result.validInfo.push(i);
        }
      }
      if (i != 'f1_type') {
        if (datas[i][j] < 0) {
          result.valid = false;
          result.validInfo.push(i);
        }
      }
      if (j != 0) {
        delay += Math.abs(60000 - Math.abs(datas[i][j].ts - datas[i][j - 1].ts));
      }
    }
    if (delay > 60000 * 15) {
      result.regular = false;
      result.regularInfo.push(i);
    }
  }

  result.validInfo = result.validInfo.join(', ');
  result.regularInfo = result.regularInfo.join(', ');
  return result;
}

function createContent(vm, checkResult) {
  let containerStyle = {
    color: 'var(--tb-service-font-0)',
    backgroundColor: 'rgba(0,0,0,0.8)',
    lineHeight: 1.5,
    width: `${250 / STANDARD_WINDOW_SIZE}vw`,
    padding: `${16 / STANDARD_WINDOW_SIZE}vw`,
  };
  let titleStyle = {
    fontSize: `${12 / STANDARD_WINDOW_SIZE}vw`,
    fontWeight: 'bold',
  };
  let descriptionStyle = {
    fontSize: `${12 / STANDARD_WINDOW_SIZE}vw`,
    color: 'var(--tb-service-font-3)',
    marginTop: `${10 / STANDARD_WINDOW_SIZE}vw`,
    marginBottom: `${10 / STANDARD_WINDOW_SIZE}vw`,
  };
  let subTitleStyle = {
    display: 'flex',
    alignItems: 'center',
    paddingTop: `${10 / STANDARD_WINDOW_SIZE}vw`,
    borderTop: '1px solid var(--tb-service-font-3)',
  };
  let subTitleIconStyle = {
    width: `${10 / STANDARD_WINDOW_SIZE}vw`,
    height: `${10 / STANDARD_WINDOW_SIZE}vw`,
    backgroundColor: 'var(--tb-service-compare-low)',
    marginRight: `${10 / STANDARD_WINDOW_SIZE}vw`,
  };
  let subTitleLabelStyle = {
    fontSize: `${12 / STANDARD_WINDOW_SIZE}vw`,
    fontWeight: 'bold',
  };
  let targetStyle = {
    marginTop: `${10 / STANDARD_WINDOW_SIZE}vw`,
    fontSize: `${12 / STANDARD_WINDOW_SIZE}vw`,
    color: 'var(--tb-service-font-3)',
  };
  let target = ['exist', 'valid', 'regular'];
  for (let i in target) {
    let $container = $('<div></div>').css(containerStyle);

    let $title = $(`<div>${t('thingplus.label.data-' + target[i])}</div>`).css(titleStyle);
    $container.append($title);

    let $description = $(`<div></div>`).css(descriptionStyle);
    $description.html(t(`thingplus.help.data-${target[i]}-description`));
    $container.append($description);

    if (!checkResult[target[i]]) {
      let $subTitle = $(`<div></div>`).css(subTitleStyle);
      let $subTitleIcon = $(`<div></div>`).css(subTitleIconStyle);
      let $subTitleLabel = $(`<div>${t('thingplus.state.abnormal')}</div>`).css(subTitleLabelStyle);
      $subTitle.append($subTitleIcon);
      $subTitle.append($subTitleLabel);
      $container.append($subTitle);

      let $target = $(`<div></div>`).css(targetStyle);
      $target.html(t(`thingplus.help.data-${target[i]}-target`, { targetKey: checkResult[target[i] + 'Info'] }));
      $container.append($target);
    }
    $(`.check-box-${i}`, vm.$form).tooltipster({
      content: $container,
      interactive: true,
      theme: 'tooltipster-transparent',
      trigger: 'hover',
      delay: 200,
    });
  }
}
