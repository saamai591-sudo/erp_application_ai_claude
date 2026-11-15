-----------------------------------------------------------------------------------------------------------------
CREATE   PROC [STM].[SpRptAmountReceiptItem] @ID NVARCHAR(MAX)
--WITH ENCRYPTION
AS
BEGIN
    CREATE TABLE ##Ids
    (
        id INT
    );

    DECLARE @CustomeFields AS NVARCHAR(MAX),
            @CustomeFieldSelect AS NVARCHAR(MAX),
            @Culture VARCHAR(10),
            @UserID INT,
            @DateType VARCHAR(10),
            @DateFormat VARCHAR(10);
			DECLARE @IsBranchInstalled BIT
SELECT @IsBranchInstalled = li.LicenceValue FROM cfg.LicenceInfo AS li 


    SELECT @CustomeFields = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(FieldName)
        FROM CFG.EntityCustomeField
        WHERE EntityName = 'StockReceipt'
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                                 );

    IF (@CustomeFields IS NULL)
        SET @CustomeFields = '[NoCustomeField]';

    SELECT @CustomeFieldSelect = STUFF(
    (
        SELECT DISTINCT
               ',CustomEntities.' + QUOTENAME(FieldName) + ' As cf_' + FieldName
        FROM CFG.EntityCustomeField
        WHERE EntityName = 'StockReceipt'
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                                      );

    IF (@CustomeFieldSelect IS NULL)
        SET @CustomeFieldSelect = '[NoCustomeField]';



    SET @Culture = CFG.GetuserCulture();

    SET @UserID = CFG.GetuserID();

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';




    INSERT INTO ##Ids
    SELECT [value]
    FROM CFG.R_FnCommaStr2Table(@ID);

    DECLARE @Columns AS NVARCHAR(MAX),
            @Query AS NVARCHAR(MAX);

    SELECT @Columns = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(TraceID)
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                           );

    IF (@Columns IS NULL)
        SET @Columns = '[-1]';

    SET @Query
        = N'
SELECT 
			sdt.Title ReceipType,
			sdt.Code ,
			br.BranchID,
			br.Code BranchCode,
			case when @IsBranchInstalled = 1 then  br.Title else '''' end BranchTitle,
			a.Number,
			CFG.GetCLRSaturnDate(a.[Date], ''' + @DateFormat + '''  , 0, ''' + @DateType + ''') [Date],
			a.StockReceiptID
			,p.EconomicCode,
			p.IdentificationCode
			,x.Code StockCode,sa.*,
			case when DeliverStockID IS NOT NULL THEN 
             h.Address 
            else sa.Address  end DeliverAddress,
            case when DeliverStockID IS NOT NULL THEN 
            h.Code
            else cast(u.Code as bigint)  end  DeliverCode,
            case when DeliverStockID IS NOT NULL THEN 
            h.Phone 
            else ph.Phone  end  DeliverPhone,
           case when DeliverStockID IS NOT NULL THEN 
            h.Title 
            else u.Title  end  DeliverTitle,
			STF.Code StuffCode,
			STF.Title StuffTitle,
			STF.MainMeasureUnit UnitTitle,
			q.MainQuantity,
			q.SubQuantity,
			q.RowIndex,
			q.NetPrice,
			q.Fee InvoiceFee,
			q.Price InvoicePrice,
			q.estimatedFee,
			q.estimatedprice,
			q.ShareOfCosts costprice,
			x.Title StockTitle,
			x.Address StockAddress,
			x.Supervisor,
			x.Phone StockPhone,
			q.Description,
			h.Supervisor DeliverStockSupervisor,
			' + @Columns + ',   
			' + @CustomeFieldSelect+ ',
			STF.SubMeasureUnit MeasureSubUnit,
			STF.StuffGroupCode StuffGroupCode,
			STF.StuffGroupTitle StuffGroupTitle,
			Name as CreatorName

from STC.StockReceiptItem q
LEFT JOIN STC.StockReceipt a on a.StockReceiptID=q.StockReceiptID
JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
ON a.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
LEFT JOIN 
(select StockReceiptItemID,TraceID,Case When n.DLID IS NOT NULL 
THEN cast ((select title from acc.DL u where u.DLID=n.DlID) as nvarchar(max)) 
else Value end Value
  from STC.StockReceiptItemTrace n
  ) x
pivot 
(
	 max(Value)
	for TraceID in ( ' + @Columns
          + ')
)  piv on piv.StockReceiptItemID = q.StockReceiptItemID
JOIN STF.vwStuff STF on STF.StuffID = q.StuffID
JOIN STF.Stock x on x.StockID=a.StockID
join cfg.Branch Br on x.BranchID=Br.BranchID
left join 
(
SELECT ecf.EntityID,ecfd.Fieldname,
case when ecfd.fieldtype = 2 then CFG.GetCLRSaturnDate(ecf.[Value], ''' + @DateFormat + '''  , 0, ''' + @DateType
          + ''') else  ecf.[Value] end as Value
 FROM cfg.EntityCustomeField ecfd
left JOIN cfg.EntityCustomeFieldData ecf ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
WHERE ecfd.EntityName = ''StockReceipt''
)x
pivot 
(
	max(Value)
	for Fieldname IN (' + @CustomeFields
          + ')
) CustomEntities on CustomEntities.EntityID = a.StockReceiptID
LEFT JOIN CFG.Party p on p.DlID = a.DeliverDlID
LEFT JOIN Acc.DL u on u.DLID=a.DeliverDlID
LEFT JOIN STF.Stock h on h.StockID=a.DeliverStockID
join CFG.[User] us on us.UserID=a.Creator
LEFT JOIN [CFG].[FULLAddressForAllParties]() Sa on Sa.PartyID= p.PartyID  And Sa.IsMain=1
LEFT JOIN CFG.Phone ph on ph.PartyID=p.PartyID  And  ph.IsMain=1
where q.StockReceiptID in (select id from ##Ids)';

  DECLARE @Param nVARCHAR(max)
SET @Param = N'@IsBranchInstalled bit'
EXECUTE sp_executeSQL     
            @Query,
            @Param,
            @IsBranchInstalled = @IsBranchInstalled

    IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##Ids')
        DROP TABLE ##Ids;

END;

