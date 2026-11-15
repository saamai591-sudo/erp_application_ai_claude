
----------------------------------------------------------
CREATE   VIEW [FLW].vwWfActivityInstanceTasks
AS
SELECT src.TaskID,
       src.SenderComment,
       src.AppName,
       src.AppInstanceID,
       src.ProcessGUID,
       src.Version,
       src.ProcessInstanceID,
       src.ActivityGUID,
       src.ActivityInstanceID,
       src.ActivityName,
       src.ActivityType,
       src.WorkItemType,
       src.PreviousUserID,
       src.PreviousUserName,
       src.PreviousDateTime,
       src.TaskType,
       src.EntrustedTaskID,
       src.AssignedToUserID,
       src.AssignedToUserName,
       src.Date_CreatedDate,
       src.CreatedDateTime,
       src.TaskStatus,
       src.LastUpdatedDateTime,
       src.EndedDateTime,
       src.EndedByUserID,
       src.EndedByUserName,
       src.TaskState,
       src.ActivityState,
       src.RecordStatusInvalid,
       src.ProcessState,
       src.ComplexType,
       src.MIHostActivityInstanceID,
       src.AppInstanceCode,
       src.ProcessName,
       src.CreatedByUserName,
       src.PCreatedDateTime,
       src.MiHostState,
       src.Date_EndedDate,
       src.ElapsedTime,
       dti.[Value] AS AppNameTitle,
       src.CreatorUserName,
       src.ParentProcessInstanceID
FROM
(
    SELECT wt.ID AS TaskID,
           wai.SenderComment AS SenderComment,
           wai.AppName,
           wai.AppInstanceID,
           wai.ProcessGUID,
           wpi.Version,
           wt.ProcessInstanceID,
           wai.ActivityGUID,
           wt.ActivityInstanceID,
           wai.ActivityName,
           wai.ActivityType,
           wai.WorkItemType,
           wai.CreatedByUserID AS PreviousUserID,
           wai.CreatedByUserName AS PreviousUserName,
           wai.CreatedDateTime AS PreviousDateTime,
           wt.TaskType,
           wt.EntrustedTaskID,
           wt.AssignedToUserID,
           wt.AssignedToUserName,
           CFG.GetCLRSaturnDate(wt.CreatedDateTime, 'YYYY/MM/DD', 0, 0) Date_CreatedDate,
           wt.CreatedDateTime,
           ISNULL(wt.TaskStatus, 0) AS TaskStatus,
           wt.LastUpdatedDateTime,
           wt.EndedDateTime,
           wt.EndedByUserID,
           wt.EndedByUserName,
           wt.TaskState,
           wai.ActivityState,
           wt.RecordStatusInvalid,
           wpi.ProcessState,
           wai.ComplexType,
           wai.MIHostActivityInstanceID,
           wpi.AppInstanceCode,
           wpi.ProcessName,
           u.Name AS CreatedByUserName,
           u.Username AS CreatorUserName,
           wpi.CreatedDateTime AS PCreatedDateTime,
           CASE
               WHEN wai.MIHostActivityInstanceID IS NULL THEN
                   wai.ActivityState
               ELSE
           (
               SELECT a.ActivityState
               FROM [FLW].WfActivityInstance a
               WHERE a.ID = wai.MIHostActivityInstanceID
           )
           END AS MiHostState,
           CFG.GetCLRSaturnDate(wai.EndedDateTime, 'YYYY/MM/DD', 1, 1) Date_EndedDate,
           '' AS ElapsedTime,
           CASE wai.AppName
               WHEN 'QuantityOutgoing' THEN
                   'Outgoing'
               WHEN 'QuantityReturnedOutgoing' THEN
                   'ReturnedOutgoing'
               WHEN 'ReturnQuantityReceipt' THEN
                   'ReturnStockReceipt'
               WHEN 'QuantityReceipt' THEN
                   'StockReceipt'
               WHEN 'ContractComplement' THEN
                   'Contract'
               WHEN 'QuantityAssetReceipt' THEN
                   'AssetReceipt'
               WHEN 'QuantityAsset' THEN
                   'Asset'
               WHEN 'QuantityDestruction' THEN
                   'Destruction'
               WHEN 'QuantitySale' THEN
                   'Sale'
               WHEN 'QuantitySalvage' THEN
                   'Salvage'
               WHEN 'QuantityTransfer' THEN
                   'Transfer'
               ELSE
                   wai.AppName
           END AS EntityName,
           wpi.ParentProcessInstanceID
    FROM [FLW].WfActivityInstance wai
        INNER JOIN FLW.WfTasks AS wt
            ON wai.ID = wt.ActivityInstanceID
        INNER JOIN [FLW].WfProcessInstance wpi
            ON wai.ProcessInstanceID = wpi.ID
        LEFT JOIN CFG.[User] AS u
            ON u.UserID = TRY_CONVERT(INT, wpi.CreatedByUserID)
) AS src
    LEFT JOIN MDT.DmdEntity dmde
        ON dmde.Name = src.EntityName
    OUTER APPLY
    (
        -- Prefer current culture title; never filter out src rows if culture/title missing.
        SELECT TOP (1)
               dtiInner.[Value]
        FROM MDT.DmdRelatedEntityTranslate AS dret
            INNER JOIN MDT.DmdTranslateItem AS dtiInner
                ON dtiInner.ID = dret.DmdTranslateItemID
        WHERE dret.DmdEntityID = dmde.ID
        ORDER BY CASE
                     WHEN dtiInner.Culture = CFG.GetuserCulture() THEN
                         0
                     ELSE
                         1
                 END
    ) dti;
