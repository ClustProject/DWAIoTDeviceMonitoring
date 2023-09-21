let $injector = widgetContext.$scope.$injector;
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));
let attributeService = $injector.get(widgetContext.servicesMap.get('attributeService'));

const t = widgetContext.custom.t;
const DEFAULT_TIME = 8 * 3600000;

openEditEntityDialog();

function openEditEntityDialog() {
  customDialog.customDialog(htmlTemplate, EditEntityDialogController).subscribe();
}

function EditEntityDialogController(instance) {
  let vm = instance;
  vm.ownerId = widgetContext.defaultSubscription.configuredDatasources[0].entity.id;
  vm.ownerLevel = widgetContext.$scope.ownerLevel;
  vm.t = t;
  vm.targetTs = moment(widgetContext.$scope.targetStart).date(additionalParams.index).valueOf();
  vm.targetDate = moment(vm.targetTs).format('YYYY-MM-DD');
  vm.plannedCustom = widgetContext.custom.futureInfo[entityId.id].plannedCustom || {};
  let hour = _.floor(additionalParams.value);
  let min = _.floor((additionalParams.value - hour) * 60);
  vm.editEntityFormGroup = vm.fb.group({
    label: [entityLabel],
    hour: [hour],
    min: [min],
  });

  vm.getWeek = function () {
    return this.editEntityFormGroup.get('plannedOperationTime').controls['week'];
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
    vm.editEntityFormGroup.markAsPristine();
    saveAttribute().subscribe(() => {
      widgetContext.updateAliases();
      vm.dialogRef.close(null);
    });
  };

  function saveAttribute() {
    let hour = vm.editEntityFormGroup.get('hour').value;
    let min = vm.editEntityFormGroup.get('min').value;
    vm.plannedCustom[vm.targetTs] = getTime(hour, min);
    let attributeBody = [{ key: 'plannedCustom', value: vm.plannedCustom }];

    return attributeService.saveEntityAttributes(entityId, 'SERVER_SCOPE', attributeBody);
  }
  function getTime(hour, min) {
    let result = hour * 3600000 + min * 60000;
    if (result > 86400000) {
      result = 86400000;
    }
    return result;
  }
}
