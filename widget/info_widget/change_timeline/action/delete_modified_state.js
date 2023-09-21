let $injector = widgetContext.$scope.$injector;
let dialogs = $injector.get(widgetContext.servicesMap.get('dialogs'));
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));

const t = widgetContext.custom.t;

openDeleteEntityDialog();

function openDeleteEntityDialog() {
  customDialog.customDialog(htmlTemplate, DeleteEntityDialogController).subscribe();
}

function DeleteEntityDialogController(instance) {
  let vm = instance;
  vm.entityName = entityName;
  vm.range = additionalParams.range;
  vm.state = additionalParams.state;
  vm.deleteEntityFormGroup = vm.fb.group({});

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
    vm.deleteEntityFormGroup.markAsPristine();
    deleteEntityObservable().subscribe(
      function success() {
        widgetContext.updateAliases();
        vm.dialogRef.close(null);
      },
      function fail() {
        showErrorDialog();
        vm.dialogRef.close(null);
      }
    );
  };

  function deleteEntityObservable() {
    let targetTs = additionalParams.targetData.startTs;
    return widgetContext.http.delete(
      `/api/plugins/telemetry/DEVICE/${entityId.id}/timeseries/delete?keys=TP_ModifiedState&startTs=${targetTs}&endTs=${
        targetTs + 1
      }&rewriteLatestIfDeleted=true`
    );
  }

  function showErrorDialog() {
    let title = t('thingplus.dialog.error-delete-title');
    let content = t('thingplus.dialog.error-delete-content');
    dialogs.alert(title, content, 'CLOSE').subscribe(function (result) {});
  }
}
