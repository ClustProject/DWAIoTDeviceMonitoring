let $injector = widgetContext.$scope.$injector;
let dialogs = $injector.get(widgetContext.servicesMap.get('dialogs'));
let customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));
let deviceService = $injector.get(widgetContext.servicesMap.get('deviceService'));

const JWT_TOKEN = window.localStorage.getItem('jwt_token');
const t = widgetContext.custom.t;

openDeleteEntityDialog();

function openDeleteEntityDialog() {
  customDialog.customDialog(htmlTemplate, DeleteEntityDialogController).subscribe();
}

function DeleteEntityDialogController(instance) {
  let vm = instance;
  vm.entityName = entityName;
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
    deleteDevice(entityId).subscribe(
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

  // test
  function deleteDeviceTest(entityId) {
    return deviceService.deleteDevice(entityId.id);
  }

  function deleteDevice(entityId) {
    const JWT_TOKEN = window.localStorage.getItem('jwt_token');
    let option = {
      headers: {
        'X-authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    return widgetContext.http.delete(`https://devicereg.thingplus.net/api/regdevice/${entityId.id}`, option);
  }

  function showErrorDialog() {
    let title = t('thingplus.dialog.error-delete-title');
    let content = t('thingplus.dialog.error-delete-content');
    dialogs.alert(title, content, 'CLOSE').subscribe(function (result) {});
  }
}
