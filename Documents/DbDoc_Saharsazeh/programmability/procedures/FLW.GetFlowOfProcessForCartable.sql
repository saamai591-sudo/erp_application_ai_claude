
----------------------------------------------------------
CREATE   PROCEDURE [FLW].GetFlowOfProcessForCartable
(@ProcessInstanceID VARCHAR(100))
AS
BEGIN
    DECLARE @culture NVARCHAR(10) = CFG.GetuserCulture(),
            @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10);

    SET @UserID = CFG.GetuserID();

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
                             WHEN 'fa' THEN
                                 0
                             WHEN 'en' THEN
                                 1
                             ELSE
                                 2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT ROW_NUMBER() OVER (PARTITION BY vwait.ProcessInstanceID ORDER BY vwait.ID) AS Stage,
           vwait.ID AS ActivityInstanceID,
           vwait.ProcessInstanceID,
           CAST((CASE
                     WHEN vwait.AssignedToUserNames = 'AUTO' THEN
                         1
                     ELSE
                         0
                 END
                ) AS BIT) AS IsSubFlow,
           u.Name AS AssignedToUser_Name,
           u.Name AS AssignedToUser_Name2,
           vwait.ActivityName,
           vwait.AppName AS EntityName,
           dti.[Value] AS AppName,
           vwait.AppInstanceID,
           cfg.ConvertToDayHourMinute(
               DATEDIFF(MINUTE, vwait.CreatedDateTime, ISNULL(vwait.EndedDateTime, GETDATE())),
               1440
           ) AS ElapsedTime,
           CFG.GetCLRSaturnDate(vwait.CreatedDateTime, @DateFormat, 1, @DateType) AS Date_CreatedDate,
           CASE
               WHEN vwait.EndedDateTime IS NULL THEN
                   NULL
               ELSE
                   CFG.GetCLRSaturnDate(vwait.EndedDateTime, @DateFormat, 1, @DateType)
           END AS Date_EndedDate,
           vwait.SenderComment
    FROM [FLW].WfActivityInstance AS vwait
        LEFT JOIN CFG.[User] u
            ON u.UserID = TRY_CONVERT(INT, vwait.EndedByUserID)
        LEFT JOIN MDT.DmdEntity AS de
            ON de.Name = CASE vwait.AppName
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
                                 vwait.AppName
                         END
        OUTER APPLY
        (
            -- Prefer current culture title; never drop activity rows if culture/title missing.
            SELECT TOP (1)
                   dtiInner.[Value]
            FROM MDT.DmdRelatedEntityTranslate AS dret
                INNER JOIN MDT.DmdTranslateItem AS dtiInner
                    ON dtiInner.ID = dret.DmdTranslateItemID
            WHERE dret.DmdEntityID = de.ID
            ORDER BY CASE
                         WHEN dtiInner.Culture = @culture THEN
                             0
                         ELSE
                             1
                     END
        ) dti
    WHERE vwait.ProcessInstanceID = TRY_CONVERT(INT, @ProcessInstanceID);
END;

