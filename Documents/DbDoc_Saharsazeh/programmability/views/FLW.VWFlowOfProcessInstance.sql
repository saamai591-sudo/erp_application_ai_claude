
----------------------------------------------------------
CREATE   VIEW [FLW].[VWFlowOfProcessInstance]
AS
SELECT wpi.ProcessName,
       wt.ActivityName,
       wt.CreatedDateTime,
       wt.EndedDateTime,
       wt.AppName,
       wt.AppInstanceID,
       wpi.ID AS ProcessInstanceID,
       [CFG].[ConvertToDayHourMinute](
           DATEDIFF(MINUTE, wt.CreatedDateTime, ISNULL(wt.EndedDateTime, GETDATE())),
           24 * 60
       ) AS ElapsedTime,
       wai.SenderComment,
       dti.[Value] AS AppNameTitle,
       TRY_CONVERT(INT, wt.CreatedByUserID) AS PreviousUserID,
       wt.ActivityInstanceID
FROM
(
    SELECT ROW_NUMBER() OVER (
               PARTITION BY wt1.ProcessInstanceID,
                            wt1.ActivityInstanceID
               ORDER BY wt1.CreatedDateTime DESC
           ) AS rno,
           wt1.*
    FROM FLW.WfTasks AS wt1
) wt
    INNER JOIN FLW.WfProcessInstance AS wpi
        ON wt.ProcessInstanceID = wpi.ID
    INNER JOIN FLW.WfActivityInstance AS wai
        ON wt.ActivityInstanceID = wai.ID
    LEFT JOIN MDT.DmdEntity AS dmde
        ON dmde.Name = CASE wt.AppName
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
                               wt.AppName
                       END
    OUTER APPLY
    (
        -- Prefer current culture title; never filter out rows if culture/title missing.
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
    ) dti
WHERE wt.rno = 1;
