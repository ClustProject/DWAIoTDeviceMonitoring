let startTs = additionalParams.startTs;
let endTs = additionalParams.endTs;
widgetContext.http
  .delete(
    `/api/plugins/telemetry/DEVICE/${entityId.id}/timeseries/delete?keys=TP_ModifiedState&startTs=${startTs}&endTs=${endTs}&rewriteLatestIfDeleted=true`
  )
  .subscribe(() => {
    widgetContext.updateAliases();
  });
