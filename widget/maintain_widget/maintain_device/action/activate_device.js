let $injector = widgetContext.$scope.$injector;
let dialogs = $injector.get(widgetContext.servicesMap.get('dialogs'));
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));
let attributeService = $injector.get(widgetContext.servicesMap.get('attributeService'));

const t = widgetContext.custom.t;

openEditEntityDialog();

function openEditEntityDialog() {
  customDialog.customDialog(htmlTemplate, EditEntityDialogController).subscribe();
}

function EditEntityDialogController(instance) {
  let vm = instance;
  vm.entityName = entityName;
  vm.activateEntityFormGroup = vm.fb.group({});
  vm.activate = additionalParams.TP_ActivationState == 'true';

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
    vm.activateEntityFormGroup.markAsPristine();
    saveTelemetry(entityId).subscribe(() => {
      widgetContext.updateAliases();
      vm.dialogRef.close(null);
    });
  };

  function saveTelemetry(device) {
    let telemetryBody = [{ key: 'TP_ActivationState', value: !vm.activate }];
    return attributeService.saveEntityTimeseries(device, 'TELEMETRY', telemetryBody);
  }
}
