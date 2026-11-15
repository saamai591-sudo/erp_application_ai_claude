
CREATE    PROC [POS].RptStoreSale_Flow
(
    @FromDate DATE,
    @EndDate DATE,
    @Branch NVARCHAR(MAX) = NULL,
    @Customer NVARCHAR(MAX) = NULL,
    @SelectedStuff NVARCHAR(MAX) = NULL,
    @SelectedSaleModels NVARCHAR(MAX) = NULL,
    @SelectedSaleGroup NVARCHAR(MAX) = NULL,
    @SelectedIds NVARCHAR(MAX) = NULL,
    @SelectedCustomerGroup NVARCHAR(MAX) = NULL,
    @SelectedShift NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
DECLARE @Columns NVARCHAR(MAX),
        @ColumnsInSelectList NVARCHAR(MAX),
        @query NVARCHAR(MAX),
        @param NVARCHAR(MAX),
        @CodeAndTitleColumn NVARCHAR(MAX),
        @LeftJoin NVARCHAR(MAX),
        @UserID INT,
        @DateType TINYINT,
        @DateFormat VARCHAR(10),
        @Culture VARCHAR(10),
        @CultureNo TINYINT;

SET @Culture = CFG.GetuserCulture();

SET @UserID = CFG.GetuserID();

SELECT @CultureNo = CultureNo
FROM CFG.CultureInfo
WHERE Culture = @Culture;

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

SELECT RIGHT(value, LEN(value) - 1) VALUE
INTO #Invoice
FROM CFG.R_FnCommaStr2Table(@SelectedIds)
WHERE LEFT(VALUE, 1) = 'I';

SELECT RIGHT(value, LEN(value) - 1) VALUE
INTO #ReturnedInvoice
FROM CFG.R_FnCommaStr2Table(@SelectedIds)
WHERE LEFT(VALUE, 1) = 'R';

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
    SET @Columns = N'[-1]';

SELECT @ColumnsInSelectList = STUFF(
(
    SELECT DISTINCT
           ',' + QUOTENAME(TraceID) + ' AS T' + CAST(TraceID AS VARCHAR(10))
    FROM STF.Trace
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
                                   );

IF (@ColumnsInSelectList IS NULL)
    SET @ColumnsInSelectList = N'[-1]';

SELECT @CodeAndTitleColumn
    = STUFF(
(
    SELECT DISTINCT
           ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code AS [T' + CAST(TraceID AS VARCHAR(10)) + 'Code],d'
           + CAST(TraceID AS VARCHAR(10)) + '.Title AS [T' + CAST(TraceID AS VARCHAR(10)) + 'Title]'
    FROM STF.Trace
    WHERE DlTypeID IS NOT NULL
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
           );

IF (@CodeAndTitleColumn IS NULL)
    SET @CodeAndTitleColumn = N'';

SELECT @LeftJoin
    = STUFF(
(
    SELECT DISTINCT
           ' Left Join acc.dl d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10)) + '.DlID = A.'
           + QUOTENAME(TraceID)
    FROM STF.Trace
    WHERE DlTypeID IS NOT NULL
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
           );

IF (@LeftJoin IS NULL)
    SET @LeftJoin = N'';

DECLARE @Invoice NVARCHAR(100),
        @ReturnedSaleInvoice NVARCHAR(100),
        @Internal NVARCHAR(100),
        @Export NVARCHAR(100);

SELECT @ReturnedSaleInvoice = lev.[Value]
FROM CFG.LocalizeEnum le
    JOIN CFG.LocalizeEnumValue lev
        ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'SaleDocumentBases'
      AND le.Item = 'ReturnedSaleInvoice'
      AND lev.Culture = CFG.GetuserCulture();

SELECT @Invoice = lev.[Value]
FROM CFG.LocalizeEnum le
    JOIN CFG.LocalizeEnumValue lev
        ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'OutgoingTypes'
      AND le.Item = 'Sale'
      AND lev.Culture = CFG.GetuserCulture();

DECLARE @TempTable NVARCHAR(MAX);
SET @TempTable = CFG.getTempTableName(1);


SELECT StuffID,
       Title,
       Title2,
       code,
       SalesGroupID
INTO #All_stuffs
FROM STF.VWStuff;


SET @query
    = N'
    SELECT * INTO #vwBranchAccess 
	FROM cfg.vwBranchAccess AS nb
	
	SELECT * INTO #vwStationShiftAccess 
	FROM cfg.vwStationShiftAccess
    
SELECT
	ROW_NUMBER() over (order by SRC.DocName, SRC.DocID) RowID,
	SRC.* 
	into ' + @TempTable
      + N'
FROM (
	SELECT  ii.PosInvoiceItemID ItemID ,
		CASE when i.IsReturnInvoice = 0 THEN  @Invoice ELSE @ReturnedSaleInvoice END DocName,
		CASE when i.IsReturnInvoice = 0 THEN ''posInvoice'' ELSE ''returnPosInvoice'' END as DocType,
        i.PosInvoiceID DocID ,
        i.Number ,
        i.Date ,
        ii.StuffID ,
		' + @Columns
      + N',
        CASE when i.IsReturnInvoice = 0 THEN 1 ELSE -1 END * ii.MainQuantity as MainQuantity,
        CASE when i.IsReturnInvoice = 0 THEN 1 ELSE -1 END * ii.SubQuantity as SubQuantity,
        ii.Fee ,
        CASE when i.IsReturnInvoice = 0 THEN 1 ELSE -1 END * ii.Price as Price,
        CASE when i.IsReturnInvoice = 0 THEN -1 ELSE 1 END * ii.Discount AS DiscountInBaseCurrency ,
        CASE when i.IsReturnInvoice = 0 THEN 1 ELSE -1 END * ii.Tax as Tax,
        CASE when i.IsReturnInvoice = 0 THEN 1 ELSE -1 END * ii.Duty as Duty,
        CASE when i.IsReturnInvoice = 0 THEN 1 ELSE -1 END * ii.NetPrice  as NetPrice,
        ii.SaleModelID ,
        s.BranchID ,
        i.CustomerID,
		ss.StationID,
		ss.StationShiftID
FROM    POS.PosInvoice i
        INNER JOIN POS.PosInvoiceItem ii ON ii.PosInvoiceID = i.PosInvoiceID
		INNER JOIN #All_stuffs stf on stf.StuffID = ii.StuffID
		INNER JOIN CFG.Party p1 ON p1.PartyID = i.CustomerID
        INNER JOIN POS.StationShift ss ON ss.StationShiftID = i.StateShiftID
        INNER JOIN POS.Station s ON s.StationID = ss.StationID  
		INNER JOIN #vwBranchAccess AS nb ON nb.BranchID = s.BranchID
		INNER JOIN #vwStationShiftAccess AS nss ON nss.StationShiftID = i.StateShiftID
        LEFT JOIN ( SELECT  iit.PosInvoiceItemID ,
                            iit.TraceID ,
                            CASE WHEN AccountLevelTypeID = 1 THEN CAST (DlID AS NVARCHAR(MAX)) 
								 WHEN AccountLevelTypeID = 5 THEN CFG.GetCLRSaturnDate(Value, @DateFormat, 0, @DateType)
                                 WHEN AccountLevelTypeID = 6 THEN case when @CultureNo = 2 THEN tri.Item2 ELSE tri.Item2 END 
                                 ELSE Value
                            END value
                    FROM    POS.PosInvoiceItemTrace iit
                            JOIN STF.Trace t ON t.TraceID = iit.TraceID
							LEFT JOIN STF.TraceItem tri on tri.TraceItemID = iit.TraceItemID
                  ) x PIVOT ( MAX(value) FOR TraceID IN ( ' + @Columns
      + N')
		) p ON p.PosInvoiceItemID = ii.PosInvoiceItemID
		WHERE   i.Date BETWEEN @pFromDate AND @pEndDate
				AND Status = 1
				AND 
				 ( @pSelectedSaleGroup IS NULL OR stf.SalesGroupID IN ( 
						SELECT  value
						FROM    CFG.R_FnCommaStr2Table(@pSelectedSaleGroup)  )
				)
				AND ( @pBranch IS NULL
					  OR s.BranchID IN ( SELECT value
										 FROM   CFG.R_FnCommaStr2Table(@pBranch) )
					)
				AND ( @pSelectedStuff IS NULL
					  OR ii.StuffID IN ( SELECT value
										 FROM   CFG.R_FnCommaStr2Table(@pSelectedStuff) )
					)
				AND ( @pSelectedShift IS NULL
					  OR i.StateShiftID IN ( SELECT value
										 FROM   CFG.R_FnCommaStr2Table(@pSelectedShift) )
					)
				AND ( @pSelectedSaleModels IS NULL
					  OR ii.SaleModelID IN (
					  SELECT    value
					  FROM      CFG.R_FnCommaStr2Table(@pSelectedSaleModels) )
					)
				AND ( @pCustomer IS NULL
					  OR i.CustomerID IN ( SELECT   value
										   FROM     CFG.R_FnCommaStr2Table(@pCustomer) )
					)
				AND ( @pSelectedIds IS NULL
					  OR i.PosInvoiceID IN ( SELECT value
											 FROM   #Invoice )
					)
				AND ( @pSelectedCustomerGroup IS NULL OR p1.CustomerGroupID IN (
						SELECT    value
						FROM      CFG.R_FnCommaStr2Table(@pSelectedCustomerGroup) )
					)
			)SRC';

--PRINT @query;

SET @param
    = N'@pFromDate date,@pEndDate date ,@pCustomer nvarchar(max), @pBranch nvarchar(max),
	  @pSelectedStuff nvarchar(max) , @pSelectedSaleModels nvarchar(max),@pSelectedShift nvarchar(max),
	  @pSelectedSaleGroup nvarchar(max), @pSelectedIds nvarchar(max), @pselectedCustomerGroup nvarchar(max),
	  @DateType TINYINT, @DateFormat VARCHAR(10),@Invoice NVARCHAR(100),@ReturnedSaleInvoice NVARCHAR(100),
	  @UserID int,@CultureNo char(1)';

EXECUTE sp_executesql @query,
                      @param,
                      @pFromDate = @FromDate,
                      @pEndDate = @EndDate,
                      @pCustomer = @Customer,
                      @pBranch = @Branch,
                      @pSelectedStuff = @SelectedStuff,
                      @pSelectedSaleModels = @SelectedSaleModels,
                      @pSelectedShift = @SelectedShift,
                      @pSelectedSaleGroup = @SelectedSaleGroup,
                      @pSelectedIds = @SelectedIds,
                      @pSelectedCustomerGroup = @SelectedCustomerGroup,
                      @DateType = @DateType,
                      @DateFormat = @DateFormat,
                      @Invoice = @Invoice,
                      @ReturnedSaleInvoice = @ReturnedSaleInvoice,
                      @UserID = @UserID,
                      @CultureNo = @CultureNo;
					 

SET @query
    = N'
select ROW_NUMBER() over (order by DocName,DocID) RowID,
	   A.ItemID,
	   A.DocName,
	   A.DocType,
	   A.DocID,
	   A.Number,
	   A.Date,
	   CFG.GetClrSaturnDate(A.Date, @DateFormat, 0, @DateType) Date_Date,
	   case when @CultureNo = 1 then stf.Title else stf.Title2 end as StuffTitle,
	   stf.Code StuffCode,' + @ColumnsInSelectList
      + N',
	   A.MainQuantity,
	   A.SubQuantity,
	   A.Fee,
	   A.Price,
	   A.DiscountInBaseCurrency,
	   A.Tax,
	   A.Duty,
	   A.NetPrice,
	   case WHEN A.Price= 0 then 0
		   else 
		   ABS((A.DiscountInBaseCurrency/A.Price)*100) 
		   end as DiscountPercent,
	   sm.Code SaleModelCode,	   
	   case when @CultureNo = 1 then sm.Title else sm.Title2	   end as SaleModelTitle
		' + @CodeAndTitleColumn
      + N',
		b.Code BranchCode,
		case when @CultureNo = 1 then b.Title else b.Title2	    end as BranchTitle,
		p.CustomerCode,
		case when @CultureNo = 1 then 
				ISNULL(p.Title,'''') + '' '' + ISNULL(p.LastName,'''')
	        else	ISNULL(p.Title2,'''') + '' '' + ISNULL(p.LastName2,'''')
	    end as CustomerName,
		case when @CultureNo = 1 then st.Title else st.Title2  end as StationTitle,
		case when @CultureNo = 1 then ss.Title else ss.Title2  end as StationShiftTitle
 from ' + @TempTable
      + N' A
INNER JOIN #All_stuffs stf on stf.StuffID = A.StuffID
INNER JOIN sle.SaleModel sm on sm.SaleModelID = A.SaleModelID
INNER JOIN CFG.Branch b ON b.BranchID = A.BranchID
INNER JOIN CFG.Party p ON p.PartyID = A.CustomerID
INNER JOIN POS.Station st on st.StationID = A.StationID
INNER JOIN POS.StationShift ss ON ss.StationShiftID = A.StationShiftID
' + @LeftJoin;


--PRINT @query;

SET @param
    = N'@pFromDate date,@pEndDate date ,@pCustomer nvarchar(max), @pBranch nvarchar(max),
	  @pSelectedStuff nvarchar(max) , @pSelectedSaleModels nvarchar(max),@pSelectedShift nvarchar(max),
	  @pSelectedSaleGroup nvarchar(max), @pSelectedIds nvarchar(max), @pselectedCustomerGroup nvarchar(max),
	  @DateType TINYINT, @DateFormat VARCHAR(10),@Invoice NVARCHAR(100),@ReturnedSaleInvoice NVARCHAR(100),
	  @UserID int,@CultureNo char(1)';

EXECUTE sp_executesql @query,
                      @param,
                      @pFromDate = @FromDate,
                      @pEndDate = @EndDate,
                      @pCustomer = @Customer,
                      @pBranch = @Branch,
                      @pSelectedStuff = @SelectedStuff,
                      @pSelectedSaleModels = @SelectedSaleModels,
                      @pSelectedShift = @SelectedShift,
                      @pSelectedSaleGroup = @SelectedSaleGroup,
                      @pSelectedIds = @SelectedIds,
                      @pSelectedCustomerGroup = @SelectedCustomerGroup,
                      @DateType = @DateType,
                      @DateFormat = @DateFormat,
                      @Invoice = @Invoice,
                      @ReturnedSaleInvoice = @ReturnedSaleInvoice,
                      @UserID = @UserID,
                      @CultureNo = @CultureNo;

