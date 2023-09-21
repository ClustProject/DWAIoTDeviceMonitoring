let $injector = widgetContext.$scope.$injector;
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));
let attributeService = $injector.get(widgetContext.servicesMap.get('attributeService'));
let userService = $injector.get(widgetContext.servicesMap.get('userService'));

const t = widgetContext.custom.t;

openAddEntityDialog();

function openAddEntityDialog() {
  customDialog.customDialog(htmlTemplate, AddEntityDialogController).subscribe();
}

function AddEntityDialogController(instance) {
  let vm = instance;
  vm.ownerId = widgetContext.defaultSubscription.configuredDatasources[0].entity.id;
  vm.t = t;
  vm.startDate = moment(additionalParams.startTs).toDate();
  vm.endDate = moment().toDate();

  vm.stateList = [
    { name: t('thingplus.state.stopped'), value: 0 },
    { name: t('thingplus.state.waiting'), value: 1 },
    { name: t('thingplus.state.working'), value: 2 },
    { name: t('thingplus.state.trial'), value: 3 },
  ];
  let startDate = vm.startDate;
  let endDate = vm.endDate;
  if (widgetContext.custom.dateSelection) {
    startDate = widgetContext.custom.dateSelection[0];
    endDate = widgetContext.custom.dateSelection[1];
  }

  vm.addEntityFormGroup = vm.fb.group({
    viewStartDate: [moment(startDate).format('YYYY-MM-DD HH:mm'), [vm.validators.required]],
    viewEndDate: [moment(endDate).format('YYYY-MM-DD HH:mm'), [vm.validators.required]],
    state: [2, []],
  });

  vm.setStartDate = function (e) {
    vm.startDate = e;
    vm.addEntityFormGroup.patchValue(
      {
        viewStartDate: moment(vm.startDate).format('YYYY-MM-DD HH:mm'),
      },
      { emitEvent: true }
    );
  };
  vm.setEndDate = function (e) {
    vm.endDate = e;
    vm.addEntityFormGroup.patchValue(
      {
        viewEndDate: moment(vm.endDate).format('YYYY-MM-DD HH:mm'),
      },
      { emitEvent: true }
    );
  };
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
  vm.save = function () {
    let viewStartDate = vm.addEntityFormGroup.get('viewStartDate').value;
    let viewEndDate = vm.addEntityFormGroup.get('viewEndDate').value;
    let state = vm.addEntityFormGroup.get('state').value;
    getUserInfo(widgetContext.currentUser.userId).subscribe(user => {
      saveModifiedState(viewStartDate, viewEndDate, state, user).subscribe(() => {
        widgetContext.updateAliases();
        vm.dialogRef.close(null);
      });
    });
  };
}

function getUnconnectState(startDate, endDate) {
  let startTs = moment(startDate).valueOf();
  let endTs = moment(endDate).valueOf();
  let target = widgetContext.custom.labelList[1];
  let filterTarget = target.filter(
    x =>
      x.status == 'unconnected' &&
      ((x.nextTime > startTs && x.time < endTs) || (x.time <= startTs && x.nextTime > startTs))
  );

  filterTarget.sort((a, b) => b.time - a.time);
  return filterTarget;
}

function getUserInfo(userId) {
  return userService.getUser(userId);
}

function saveModifiedState(startDate, endDate, state, user) {
  let filterTarget = getUnconnectState(startDate, endDate);

  let telemetryBody = [];
  for (let i in filterTarget) {
    let start = moment(filterTarget[i].time).valueOf();
    if (start < moment(startDate).valueOf()) {
      start = moment(startDate).valueOf();
    }
    let end = moment(filterTarget[i].nextTime).valueOf();
    if (end > moment(endDate).valueOf()) {
      end = moment(endDate).valueOf();
    }
    let modifiedState = {
      modifiedTs: moment().valueOf(),
      startTs: start,
      endTs: end,
      state: state,
      author: user.firstName ? user.firstName : user.email,
      phone: user.additionalInfo && user.additionalInfo.phone ? user.additionalInfo.phone : '',
    };
    telemetryBody.push({ ts: modifiedState.startTs, values: { TP_ModifiedState: modifiedState } });
  }
  return widgetContext.http.post(
    `/api/plugins/telemetry/${entityId.entityType}/${entityId.id}/timeseries/TELEMETRY`,
    telemetryBody
  );
}
