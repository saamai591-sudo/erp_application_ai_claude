
-------------------------------------
CREATE   PROC [STM].[SpRptTemporaryStockReceipt] @ID NVARCHAR(MAX)
--WITH ENCRYPTION
AS
	

DECLARE @Columns                AS NVARCHAR(MAX),
        @Query                  AS NVARCHAR(MAX),
        @CustomeFields          NVARCHAR(MAX),
        @CustomeFieldSelect     NVARCHAR(MAX),
        @UserID                 INT,
        @DateType               TINYINT,
        @DateFormat             VARCHAR(10),
        @Culture                VARCHAR(10),
        @Param                  NVARCHAR(MAX),
        @IsBranchInstalled      BIT; 
	        
		
SET @Culture = CFG.GetuserCulture()

SELECT @DateType = us.SettingValue
FROM   cfg.UserSetting us
WHERE  us.SettingKey = 'Date_Type'
       AND us.UserID = cfg.GetuserID()
	
SELECT @IsBranchInstalled = li.LicenceValue
FROM   cfg.LicenceInfo AS li 
	
	
IF @DateType IS NULL
    SET @DateType = CASE @Culture
                         WHEN 'fa' THEN 0
                         WHEN 'en' THEN 1
                         WHEN 'ar' THEN 2
                    END
	
SELECT @DateFormat = us.SettingValue
FROM   cfg.UserSetting us
WHERE  us.SettingKey = 'Date_Format'
       AND us.UserID = @UserID
	
IF @DateFormat IS NULL
    SET @DATEFORMAT = 'YY/MM/DD'


SELECT @Columns = STUFF(
           (
               SELECT DISTINCT
                      ',' + QUOTENAME(TraceID)
               FROM   STF.Trace
                      FOR XML PATH(''),
                      TYPE
           ).value('.', 'NVARCHAR(MAX)'),
           1,
           1,
           ''
       );

IF (@Columns IS NULL)
    SET @Columns = '[-1]';

SELECT @CustomeFields = STUFF(
           (
               SELECT DISTINCT
                      ',' + QUOTENAME(FieldName)
               FROM   CFG.EntityCustomeField
               WHERE  EntityName = 'TemporaryStockReceipt'
                      FOR XML PATH('') ,
                      TYPE
           ).value('.', 'NVARCHAR(MAX)'),
           1,
           1,
           ''
       );
SELECT @CustomeFieldSelect = STUFF(
           (
               SELECT DISTINCT
                      ',' + QUOTENAME(FieldName) + ' As cf_' + FieldName
               FROM   CFG.EntityCustomeField
               WHERE  EntityName = 'TemporaryStockReceipt'
                      FOR XML PATH('') ,
                      TYPE
           ).value('.', 'NVARCHAR(MAX)'),
           1,
           1,
           ''
       );
IF (@CustomeFields IS NULL)
    SET @CustomeFields = '[NoCustomeField]'; 

IF @CustomeFieldSelect IS NULL
    SET @CustomeFieldSelect = '[NoCustomeField]'


SET @Query = 
    N'
SELECT  sdt.Title ReceiptType ,
		ad.Address DeliverAddress ,
        CAST(u.Code AS BIGINT) DeliverCode ,
        ph.Phone DeliverPhone ,
        u.Title DeliverTitle ,
        a.Number ,
        CFG.GetCLRSaturnDate(a.Date,''' + @DateFormat + ''', 0,' + CAST(@DateType AS NVARCHAR(2)) + 
    ') [Date] ,
        q.TemporaryStockReceiptID ,
        q.TemporaryStockReceiptItemID ,
        p.EconomicCode ,
        p.NationalID ,
        p.IdentificationCode ,
        x.Code StockCode ,
        stf.Code StuffCode ,
        st.Barcode ,
		st.TechnicalCode,
        stf.Title StuffTitle ,
        mu.Title UnitTitle ,
        q.MainQuantity ,
        q.SubQuantity ,
        q.RowIndex ,
        x.Title StockTitle ,
        x.Address StockAddress ,
        x.Supervisor ,
        x.Phone StockPhone ,
        mu2.Title SubUnitTitle ,
        ' + @Columns + ' ,
        Name AS CreatorName ,
        q.Description ,
        ' + @CustomeFieldSelect + ' ,
       case when @IsBranchInstalled = 1 then  br.Title else '''' end BranchName ,
        STF.StuffGroupFullCode(stf.StuffGroupID) StuffGroupCode ,
        STF.StuffGroupFullTitle(stf.StuffGroupID) StuffGroupTitle
FROM    STC.TemporaryStockReceiptItem q
        JOIN STC.TemporaryStockReceipt a ON a.TemporaryStockReceiptID = q.TemporaryStockReceiptID
        JOIN STC.StockDocumentTypeBaseEntity sdtb ON a.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        JOIN STC.StockDocumentType sdt ON sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
        LEFT JOIN ( SELECT  n.TemporaryStockReceiptItemID ,
                            TraceID ,
                            CASE WHEN n.DlID IS NOT NULL
                                 THEN CAST (( SELECT    Title
                                              FROM      ACC.DL u
                                              WHERE     u.DLID = n.DlID
                                            ) AS NVARCHAR(MAX))
                                 ELSE Value
                            END Value
                    FROM    STC.TemporaryStockReceiptItemTrace n
                  ) x PIVOT ( MAX(Value) FOR TraceID IN ( ' + @Columns + 
    ' ) ) piv ON piv.TemporaryStockReceiptItemID = q.TemporaryStockReceiptItemID
        JOIN STF.vwStuff stf ON stf.StuffID = q.StuffID
        JOIN STF.Stock x ON x.StockID = a.StockID
        JOIN CFG.Branch br ON br.BranchID = x.BranchID
        JOIN STF.MeasureUnit mu ON stf.MainMeasureUnitID = mu.MeasureUnitID
        LEFT JOIN STF.StuffDetail st ON st.StuffID = q.StuffID
        LEFT JOIN STF.MeasureUnit mu2 ON mu2.MeasureUnitID = st.MeasureSubUnitID
        LEFT JOIN CFG.Party p ON p.DlID = a.DeliverDlID
        LEFT JOIN ACC.DL u ON u.DLID = a.DeliverDlID
        LEFT JOIN CFG.Address ad ON ad.PartyID = p.PartyID
                                    AND ad.IsMain = 1
        LEFT JOIN CFG.Phone ph ON ph.PartyID = p.PartyID
                                  AND ph.IsMain = 1
        JOIN CFG.[User] us ON us.UserID = a.Creator
        LEFT JOIN ( SELECT  *
                    FROM    ( SELECT    ecf.EntityID ,
                                        ecfd.FieldName ,
                                        CASE WHEN ecfd.FieldType = 2
                                             THEN CFG.GetCLRSaturnDate(ecf.[Value],''' + @DateFormat + ''', 0,' + CAST(@DateType AS NVARCHAR(2))+ ')
                                             ELSE ecf.[Value]
                                        END AS Value
                              FROM      CFG.EntityCustomeField ecfd
                                        LEFT JOIN CFG.EntityCustomeFieldData ecf ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
                              WHERE     ecfd.EntityName = ''TemporaryStockReceipt''
                            ) x PIVOT 
( MAX(Value) FOR FieldName IN (' + @CustomeFields + 
    ') ) piv
                  ) CustomEntities ON CustomEntities.EntityID = a.TemporaryStockReceiptID
	WHERE   q.TemporaryStockReceiptID IN ( 
            SELECT  [value]
            FROM    CFG.R_FnCommaStr2Table(@ID))'

EXECUTE sp_executesql @Query,
     N'@ID nvarchar(max),@IsBranchInstalled Bit',
     @ID = @ID,
     @IsBranchInstalled=@IsBranchInstalled;
