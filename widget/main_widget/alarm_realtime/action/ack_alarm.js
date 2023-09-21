let $injector = widgetContext.$scope.$injector;
let dialogs = $injector.get(widgetContext.servicesMap.get('dialogs'));
let alarmService = $injector.get(widgetContext.servicesMap.get('alarmService'));

let t = widgetContext.custom.t;
const TIME_FORMAT = t('thingplus.time-format.ymdhms');

openAckAlarmDialog();

function openAckAlarmDialog() {
  let alarm = additionalParams;
  let createdTime = alarm.createdTime == 0 ? '-' : moment(alarm.createdTime).format(TIME_FORMAT);
  let type = t('thingplus.alarm-type.' + alarm.type);

  let title = t('thingplus.dialog.ack-event-title');
  let content = t('thingplus.dialog.ack-event-msg', { createdTime: createdTime, type: type });
  dialogs.confirm(title, content, t('thingplus.action.ack'), t('thingplus.action.close')).subscribe(function (result) {
    if (!result) {
      alarmService.ackAlarm(entityId.id).subscribe(() => {
        widgetContext.updateAliases();
      });
    }
  });
}
