-------------------------------------
CREATE   PROCEDURE [FLW].spWorkFlowManagerReview_Attachment
(@ProcessInstanceID INT)
AS
BEGIN
          DECLARE @userId INT,
                @Culture NVARCHAR(20),
                @DateType VARCHAR(10),
                @DateFormat VARCHAR(10),
                @DbName VARCHAR(512);

        SET @Culture = CFG.GetuserCulture();
        SET @userId = CFG.GetuserID();

        SELECT @DateType = us.SettingValue
        FROM CFG.UserSetting us
        WHERE us.SettingKey = 'Date_Type'
              AND us.UserID = @userId;

        SELECT @DbName = c.ConfigValue
        FROM CFG.Configuration AS c
        WHERE c.ConfigKey = 'AttachmentDB';

        IF @DbName IS NULL or @DbName = ''
            SET @DbName = '';
        ELSE
            SET @DbName = QUOTENAME(@DbName) + '.';


        IF @DateType IS NULL
            SET @DateType = CASE @Culture
                                WHEN 'fa' THEN
                                    0
                                WHEN 'en' THEN
                                    1
                                WHEN 'ar' THEN
                                    2
                                ELSE
                                    0
                            END;
        SELECT @DateFormat = us.SettingValue
        FROM CFG.UserSetting us
        WHERE us.SettingKey = 'Date_Format'
              AND us.UserID = @userId;

        IF @DateFormat IS NULL
            SET @DateFormat = 'YY/MM/DD';

    DROP TABLE if exists #EntityMetaDataKey;
    CREATE TABLE #EntityMetaDataKey (
        EntityKey NVARCHAR(100) PRIMARY KEY,
        MetaDataKey NVARCHAR(100) NOT NULL
    );

    INSERT INTO #EntityMetaDataKey (EntityKey, MetaDataKey)
    VALUES
        (N'QuantityOutgoing', N'Outgoing'),
        (N'QuantityReturnedOutgoing', N'ReturnedOutgoing'),
        (N'ReturnQuantityReceipt', N'ReturnStockReceipt'),
        (N'QuantityReceipt', N'StockReceipt'),
        (N'ContractComplement', N'Contract'),
        (N'QuantityAssetReceipt', N'AssetReceipt'),
        (N'QuantityAsset', N'Asset'),
        (N'QuantityDestruction', N'Destruction'),
        (N'QuantitySale', N'Sale'),
        (N'QuantitySalvage', N'Salvage'),
        (N'QuantityTransfer', N'Transfer');

     DECLARE @Query NVARCHAR(MAX);
     SET @Query
            = N'	
    select 
            AppName, 
            fa.FileAttachmentID,
            fa.MetaDataEntityID,
            fa.[Date],
            CFG.GetCLRSaturnDate(fa.[Date], @DateFormat, 0, @DateType) AS PersianDate,
            fa.[Description],
            fa.Description2,
            fa.[FileName],
            fa.[Status],
            fa.EntityRelatedID,
            fa.FileAttachmentTypeID,
            t.title FileAttachmentType
    from ' + @DbName
              + N'
    CFG.FileAttachment AS fa
    JOIN MDT.DmdEntity  AS me ON  me.Id = fa.MetaDataEntityID
    LEFT JOIN cfg.FileAttachmentType t on t.FileAttachmentTypeID = fa.FileAttachmentTypeID
    left join cfg.vwFileAttachmentTypeAccess AS vfata on vfata.FileAttachmentTypeID = fa.FileAttachmentTypeID
    join (
				    select distinct
						    ISNULL(map.MetaDataKey, wai.AppName) as MetaDataKey,
                            wai.AppName,
						    wai.AppInstanceID
				    from FLW.WfActivityInstance wai
                    left join #EntityMetaDataKey map on wai.AppName = map.EntityKey
				    where 1=1
				    AND wai.ProcessInstanceID = @processInstanceId
				    AND wai.AppInstanceID != '''' 
				    AND wai.AppInstanceID is not null
				    ) k 
                    on fa.EntityRelatedID = k.AppInstanceID 
                    and me.[Name] = k.AppName 
    left join CFG.vwOperationLevelAccess ola on k.AppName = ola.EntityName AND ola.AccessKey = ''ViewAttachmentRelatedToUser'' AND ola.UserID = @UserID 
    left join CFG.vwOperationLevelAccess olo on k.AppName = olo.EntityName AND olo.AccessKey = ''ViewAttachmentRelatedToOthers'' AND olo.UserID = @UserID 
    where 1=1 
    AND (fa.FileAttachmentTypeID IS NULL or vfata.UserID is NOT NULL)
    AND (
        @userId = -1
        OR (ola.UserID IS NOT NULL AND fa.Creator = @userId)
        OR (olo.Users IS NULL OR fa.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(olo.Users) AS rfcst) )
    )
    ORDER BY fa.[Date] DESC'

    print @Query
    EXECUTE sp_executesql @Query,
                              N'@dateFormat varchar(10),
	                            @dateType int,
                                @userId int,
                                @processInstanceId int',
                                @dateType = @dateType,
                                @dateFormat = @dateFormat,
                                @userId = @userId,
                                @processInstanceId = @processInstanceId
      

END;
