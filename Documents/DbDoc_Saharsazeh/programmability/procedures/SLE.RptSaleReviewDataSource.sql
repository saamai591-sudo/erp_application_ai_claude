
-------------------------------------
CREATE   PROC [SLE].RptSaleReviewDataSource
(
    @FromDate DATE = NULL,
    @ToDate DATE = NULL,
    @TableName NVARCHAR(MAX),
    @SelectedStuff NVARCHAR(MAX) = NULL,
    @SelectedCustomer NVARCHAR(MAX) = NULL,
    @SelectedSaleModels NVARCHAR(MAX) = NULL,
    @SelectedSaleGroup NVARCHAR(MAX) = NULL,
    @SelectedIds NVARCHAR(MAX) = NULL,
    @SelectedCustomerGroup NVARCHAR(MAX) = NULL,
    @SelectedStuffGroup NVARCHAR(MAX) = NULL,
    @SelectedSaleType NVARCHAR(MAX) = NULL,
    @selectedBranch NVARCHAR(MAX) = NULL,
    @SelectedSaleArea NVARCHAR(MAX) = NULL,
    @CostOfBuyingType TINYINT = 1,
    @Source TINYINT,
    @SelectedStuffAccountGroup NVARCHAR(MAX) = Null
)
AS
DECLARE @UserID            INT,
        @Query             NVARCHAR(MAX),
        @basePrecision     INT = CFG.GetBaseCurrencyPrecision();
	
SET @UserID = CFG.GetuserID();
DECLARE @baseCurrencyDecimal     INT
	
SELECT @baseCurrencyDecimal = PrecisionCount
FROM   cfg.Currency
WHERE  CurrencyID = -1

SELECT * INTO #vwPartyAccess
FROM cfg.vwPartyAccess AS vpa;

SELECT * INTO #vwBranchAccess
FROM cfg.vwBranchAccess;

    



--- SaleArea
 SELECT left([CFG].[GetStringPartBySpliter](VALUE, 1, '|'), 2) AS TYPE,
       SUBSTRING(
           [CFG].[GetStringPartBySpliter](VALUE, 1, '|'),
           3,
           LEN([CFG].[GetStringPartBySpliter](VALUE, 1, '|'))
       ) SaleAreaID,
      ISNULL(NULLIF([CFG].[GetStringPartBySpliter](VALUE, 2, '|'), ''), -1)  CurrencyID
       into #SelectedSaleArea
FROM   [CFG].[Split] (@SelectedSaleArea, ',')


 CREATE TABLE #vwSaleAreaAccess
 (SaleAreaID INT,
 TYPE NVARCHAR(5))

    
INSERT INTO #vwSaleAreaAccess(SaleAreaID, TYPE)
SELECT vsaa.SaleAreaID,
       'sa'                  AS TYPE
FROM   cfg.vwSaleAreaAccess  AS vsaa

SELECT * into #vwStationShiftAccess
FROM cfg.vwStationShiftAccess AS vssa

INSERT INTO #vwSaleAreaAccess(SaleAreaID, TYPE)
SELECT s.StationID,'st' FROM pos.Station  AS s
join pos.StationShift AS ss on ss.StationID = s.StationID
left join #vwStationShiftAccess vssa on vssa.StationShiftID = ss.StationShiftID
GROUP BY s.StationID

SELECT vsaa.*,ssa.CurrencyID CurrencyID into #SaleAreaAccess
FROM #vwSaleAreaAccess AS vsaa
left join #SelectedSaleArea ssa
on vsaa.SaleAreaID = ssa.SaleAreaID and vsaa.Type = ssa.Type
WHERE (@SelectedSaleArea is NULL or ssa.SaleAreaID is NOT NULL)


SET @Query = N'create table ' + @TableName +
    N'
	(IsReturned bit,                   
	Type nvarchar(100),				   
	BranchID int,					   
	SaleAreaID nvarchar(10),		   
	StuffGroupID int,				   
	CustomerID int,					   
	SaleTypeID int,					   
	CustomerGroupID int,			   
	SaleModelID int,				   
	SalesGroupID int,				   
	StuffID int,					   
	HeaderID int,					   
	ItemID int,						   
	Number int,						   
	[Date] date,					   
	MainQuantity decimal(36,10),	   
	SubQuantity decimal(36,10),		   
	Price decimal(36,10),			   
	PriceInBaseCurrency decimal(36,10),
	Discount decimal(36,10),		   
	DiscountInBaseCurrency decimal(36,10),
	Tax decimal(36,10),				   
	TaxInBaseCurrency decimal(36,10),  
	Duty decimal(36,10),			   
	DutyInBaseCurrency decimal(36,10), 
	OutgoingItemId int,				   
	ReturnOutgoingItemId int,		   
	CostOfBuying  decimal(36,10),	   
	CurrencyID int,	
	RnoBaseOnOutGoingItemID int	,
	RnoBaseOnReturnOutGoingItemID int,			   
	
	)
	'
	
EXEC (@Query)
	
IF @SelectedCustomer IS NOT NULL
BEGIN
	
	
select CAST([CFG].[GetStringPartBySpliter](value,1,'|') as BIGINT) as CustomerID ,
	CAST(ISNULL(NULLIF([CFG].[GetStringPartBySpliter](value,2,'|'),''), -1) as INT) CurrencyID 
	into #Customer
from [CFG].[Split] (@SelectedCustomer,',')


END

	
IF @SelectedStuffGroup IS NOT NULL
BEGIN
	select CAST([CFG].[GetStringPartBySpliter](value,1,'|') as BIGINT) as StuffGroupID ,
	CAST(ISNULL(NULLIF([CFG].[GetStringPartBySpliter](value,2,'|'),''), -1) as INT) CurrencyID 
	into #SelectedStuffGroup
from [CFG].[Split] (@SelectedStuffGroup,',')
	
   
END
	
IF @SelectedSaleModels IS NOT NULL
BEGIN

SELECT CAST([CFG].[GetStringPartBySpliter](VALUE, 1, '|') as BIGINT) AS SaleModelsID,
       CAST(
           ISNULL(
               NULLIF([CFG].[GetStringPartBySpliter](VALUE, 2, '|'), ''),
               -1
           ) as INT
       ) CurrencyID
INTO   #SelectedSaleModels
FROM   [CFG].[Split] (@SelectedSaleModels, ',')	
END
	
IF @SelectedCustomerGroup IS NOT NULL
BEGIN
	
SELECT CAST([CFG].[GetStringPartBySpliter](VALUE, 1, '|') as BIGINT) AS CustomerGroupID,
       CAST(
           ISNULL(
               NULLIF([CFG].[GetStringPartBySpliter](VALUE, 2, '|'), ''),
               -1
           ) as INT
       ) CurrencyID
INTO   #SelectedCustomerGroup
FROM   [CFG].[Split] (@SelectedCustomerGroup, ',')		
	

END
	
IF @SelectedSaleGroup IS NOT NULL
BEGIN
    SELECT CAST([CFG].[GetStringPartBySpliter](VALUE, 1, '|') as BIGINT) AS SaleGroupID,
           CAST(ISNULL(NULLIF([CFG].[GetStringPartBySpliter](VALUE, 2, '|'), ''), -1) as INT) CurrencyID
    INTO   #SelectedSaleGroup
    FROM   [CFG].[Split] (@SelectedSaleGroup, ',')
END
	
IF @SelectedStuff IS NOT NULL
BEGIN
    SELECT CAST([CFG].[GetStringPartBySpliter](VALUE, 1, '|') as BIGINT) AS StuffID,
           CAST(ISNULL(NULLIF([CFG].[GetStringPartBySpliter](VALUE, 2, '|'), ''), -1) as INT) CurrencyID
    INTO   #SelectedStuff
    FROM   [CFG].[Split] (@SelectedStuff, ',')
END
	
IF @SelectedIds IS NOT NULL
BEGIN
    SELECT LEFT([value], 1) TYPE, SUBSTRING([value], 2, LEN([value])) DocumentID
    INTO   #SelectedIds
    FROM   CFG.R_FnCommaStr2Table(@SelectedIds)
END
	
IF @selectedBranch IS NOT NULL
BEGIN
    SELECT VALUE BranchID
    INTO   #Branch
    FROM   CFG.R_FnCommaStr2Table(@selectedBranch)
END

IF @SelectedSaleType IS NOT NULL
BEGIN
    SELECT CAST([CFG].[GetStringPartBySpliter](VALUE, 1, '|') as BIGINT) AS SaleTypeID,
           CAST(ISNULL(NULLIF([CFG].[GetStringPartBySpliter](VALUE, 2, '|'), ''), -1) as INT) CurrencyID
    INTO   #SaleType
    FROM   [CFG].[Split] (@SelectedSaleType, ',')
END	

IF @SelectedStuffAccountGroup IS NOT NULL
BEGIN
    SELECT CAST([CFG].[GetStringPartBySpliter](VALUE, 1, '|') as BIGINT) AS StuffAccountGroupID,
           CAST(ISNULL(NULLIF([CFG].[GetStringPartBySpliter](VALUE, 2, '|'), ''), -1) as INT) CurrencyID
    INTO   #StuffAccountGroup
    FROM   [CFG].[Split] (@SelectedStuffAccountGroup, ',')
END	

SELECT * into #vwStuff
FROM Stf.VWStuff AS v
	
SET @Query = N'Insert into ' + @TableName +
    N'	
	SELECT 
	0,
	''Invoice'',
	i.BranchID,
	''sa''+cast(i.SaleAreaID as nvarchar(100)),
	s.StuffGroupID,
	i.CustomerID,
	i.SaleTypeID,
	p.CustomerGroupID,
	ii.SaleModelID,
	s.SalesGroupID,
	ii.StuffID,
	ii.InvoiceID,
	ii.InvoiceItemID,
	i.Number,
	i.[Date],
	ii.MainQuantity,
	ii.SubQuantity,
	ii.Price,
	CASE WHEN c.IsBaseCurrencyBasis = 0 THEN
					ROUND(
					ii.Price
					* i.CurrencyRate
					/ c.ExchangeUnit ,
					@basePrecision)
					ELSE
					ROUND(
					( ii.Price
					* ( 1
					/ i.CurrencyRate ))
					/ c.ExchangeUnit ,
					@basePrecision)
					END,
	ii.Discount,				
		CASE WHEN c.IsBaseCurrencyBasis = 0 THEN
					-ROUND(
					ii.Discount
					* i.CurrencyRate
					/ c.ExchangeUnit ,
					@basePrecision)
					ELSE
					-ROUND(
					( ii.Discount
					* ( 1
					/ i.CurrencyRate ))
					/ c.ExchangeUnit ,
					@basePrecision)
					END,
	ii.Tax,
			CASE WHEN c.IsBaseCurrencyBasis = 0 THEN
					ROUND(
					ii.Tax
					* i.CurrencyRate
					/ c.ExchangeUnit ,
					@basePrecision)
					ELSE
					ROUND(
					( ii.Tax
					* ( 1
					/ i.CurrencyRate ))
					/ c.ExchangeUnit ,
					@basePrecision)
					END,
		ii.Duty,
			CASE WHEN c.IsBaseCurrencyBasis = 0 THEN
					ROUND(
					ii.Duty
					* i.CurrencyRate
					/ c.ExchangeUnit ,
					@basePrecision)
					ELSE
					ROUND(
					( ii.Duty
					* ( 1
					/ i.CurrencyRate ))
					/ c.ExchangeUnit ,
					@basePrecision)
					END,					
	ii.OutgoingItemId,
	null,
	0 ,
	i.CurrencyID,
	ROW_NUMBER() OVER (PARTITION BY OutgoingItemId ORDER BY ii.Price desc),
	Null
	FROM   SLE.Invoice                 AS i
	Inner join #SaleAreaAccess saa on i.SaleAreaID = saa.SaleAreaID and saa.Type = ''sa'' and i.CurrencyID = isnull(saa.CurrencyID,i.CurrencyID)
	Inner join cfg.currency c on i.currencyid=c.currencyid
	       INNER join SLE.InvoiceItem  AS ii
	            ON  ii.InvoiceID = i.InvoiceID
	       join CFG.Party p
	            ON  p.PartyID = i.CustomerID
	       join #vwStuff s
	            ON  s.StuffID = ii.StuffID
	       INNER join #vwPartyAccess AS vpa ON vpa.PartyID = p.PartyID
	       INNER join #vwBranchAccess AS vba ON vba.BranchID = i.BranchID
	       ' + CASE 
                 WHEN @SelectedCustomer IS NULL THEN ''
                 ELSE N'join #Customer cstm on i.customerid=cstm.customerid and i.CurrencyID = cstm.CurrencyID'
            END +
    + CASE 
           WHEN @SelectedStuffGroup IS NULL THEN ''
           ELSE N'  join 	#SelectedStuffGroup	as	selected2	on 	s.StuffGroupID = selected2.StuffGroupID and i.CurrencyID = selected2.CurrencyID	 '
      END +
    + CASE 
           WHEN @SelectedSaleModels IS NULL THEN ''
           ELSE N'  join 	#SelectedSaleModels	as	selected3	on 	ii.SaleModelID = selected3.SaleModelsID	and selected3.CurrencyID = i.CurrencyID '
      END +
    + CASE 
           WHEN @SelectedCustomerGroup IS NULL THEN ''
           ELSE N'  join 	#SelectedCustomerGroup	as	selected4	on 	p.CustomerGroupID = selected4.CustomerGroupID and selected4.CurrencyID = i.CurrencyID	 '
      END +
    + CASE 
           WHEN @SelectedSaleGroup IS NULL THEN ''
           ELSE N'  join 	#SelectedSaleGroup	as	selected5	on 	s.SalesGroupID = selected5.SaleGroupID and selected5.CurrencyID = i.CurrencyID '
      END +
    + CASE 
           WHEN @SelectedStuff IS NULL THEN ''
           ELSE N'  join 	#SelectedStuff	as	selected6	on 	ii.StuffID = selected6.StuffID and selected6.CurrencyID = i.CurrencyID '
      END +
    + CASE 
           WHEN @SelectedIds IS NULL THEN ''
           ELSE N'  join 	#SelectedIds	as	selected7	on 	i.InvoiceID = selected7.DocumentID and selected7.Type=''I'' 	 '
      END +
    + CASE 
           WHEN @selectedBranch IS NULL THEN ''
           ELSE N'  join 	#Branch	as	selected8	on 	i.BranchID = selected8.BranchID	 '
      END +
      CASE 
           WHEN @SelectedSaleType IS NULL THEN ''
           ELSE N'  join 	#SaleType	as	selected9	on 	i.SaleTypeID = selected9.SaleTypeID and selected9.CurrencyID = i.CurrencyID '
      END +
        CASE 
           WHEN @SelectedStuffAccountGroup IS NULL THEN ''
           ELSE N'  join 	#StuffAccountGroup	as	selected10	on 	s.StuffAccountGroupID = selected10.StuffAccountGroupID and selected10.CurrencyID = i.CurrencyID '
      END +
    
    
    N'
	WHERE  SaleInvoiceStatus <> 5
	       AND [Date] BETWEEN @FromDate AND @ToDate';
	
EXECUTE sp_executesql @query,
     N' @FromDate                  DATE,
						@ToDate                   DATE,
						@selectedBranch                    NVARCHAR(MAX) = NULL,
						@SelectedCustomer                  NVARCHAR(MAX) = NULL,
						@SelectedStuff             NVARCHAR(MAX) = NULL,
						@SelectedSaleModels        NVARCHAR(MAX) = NULL,
						@SelectedSaleGroup         NVARCHAR(MAX) = NULL,
						@SelectedIds               NVARCHAR(MAX) = NULL,
						@SelectedCustomerGroup     NVARCHAR(MAX) = NULL,
						@SelectedStuffGroup        NVARCHAR(MAX) = NULL,
						@CostOfBuyingType          TINYINT = 1,
						@basePrecision   INT=0',
     @FromDate = @FromDate,
     @ToDate = @ToDate,
     @selectedBranch = @selectedBranch,
     @SelectedCustomer = @SelectedCustomer,
     @SelectedStuff = @SelectedStuff,
     @SelectedSaleModels = @SelectedSaleModels,
     @SelectedSaleGroup = @SelectedSaleGroup,
     @SelectedIds = @SelectedIds,
     @SelectedCustomerGroup = @SelectedCustomerGroup,
     @SelectedStuffGroup = @SelectedStuffGroup,
     @CostOfBuyingType = @CostOfBuyingType,
     @basePrecision = @basePrecision    	
	
IF @Source = 2
BEGIN
    SET @Query = N'Insert into ' + @TableName +
        N'
	 
	SELECT  i.IsReturnInvoice,
			case when i.IsReturnInvoice=0 Then ''PosInvoice'' else ''PosReturnInvoice'' end,
			s2.BranchID,
			''st''+cast(s2.StationID as nvarchar(100)),
			s.StuffGroupID,
			i.CustomerID,
			Null,
			p.CustomerGroupID,
			ii.SaleModelID,
			s.SalesGroupID,
			ii.StuffID,
			ii.PosInvoiceID,
			ii.PosInvoiceItemID,
			i.Number,
			i.[Date],
			case when isreturninvoice=0 then ii.MainQuantity else -ii.MainQuantity end MainQuantity,
			case when isreturninvoice=0 then ii.SubQuantity else -ii.SubQuantity end SubQuantity,
			
			case when i.IsReturnInvoice=0 then ii.price else -ii.price end Price ,
			case when i.IsReturnInvoice=0 then ii.price else -ii.price end PriceInBaseCurrnecy,
			case when i.IsReturnInvoice=0 then  -ii.Discount else ii.Discount end Discount,
			case when i.IsReturnInvoice=0 then  -ii.Discount else ii.Discount end DiscountInBaseCurrency,
			ii.Tax,
			ii.Tax,
			ii.Duty,
			ii.Duty,
			Null,
			Null,
			case when isreturninvoice=0 then  -ii.Cost else ii.cost end ,
			-1,
			Null,
			Null
	FROM   POS.PosInvoice                 AS i
	       INNER join POS.PosInvoiceItem   AS ii
	            ON  ii.PosInvoiceID = i.PosInvoiceID
	       join CFG.Party p
	            ON  p.PartyID = i.CustomerID
	       join #vwStuff s
	            ON  s.StuffID = ii.StuffID
	            
	            join pos.StationShift AS ss ON ss.StationShiftID = i.StateShiftID
	            join pos.Station AS s2 ON s2.StationID = ss.StationID
	       INNER join #vwPartyAccess AS vpa ON vpa.PartyID = p.PartyID
	       INNER join #vwBranchAccess AS vba ON vba.BranchID = s2.BranchID
	       join #SaleAreaAccess saa on s2.StationID = saa.SaleAreaID and saa.Type = ''st'' and saa.CurrencyID = -1
	         ' + CASE 
                   WHEN @SelectedCustomer IS NULL THEN ''
                   ELSE N'join #Customer cstm on i.customerid=cstm.customerid and cstm.CurrencyID = -1'
              END 
        + CASE 
               WHEN @SelectedStuffGroup IS NULL THEN ''
               ELSE N'  join 	#SelectedStuffGroup	as	selected2	on 	s.StuffGroupID = selected2.StuffGroupID	and selected2.CurrencyID = -1 '
          END +
        + CASE 
               WHEN @SelectedSaleModels IS NULL THEN ''
               ELSE N'  join 	#SelectedSaleModels	as	selected3	on 	ii.SaleModelID = selected3.SaleModelsID		and selected3.CurrencyID = -1 '
          END +
        + CASE 
               WHEN @SelectedCustomerGroup IS NULL THEN ''
               ELSE N'  join 	#SelectedCustomerGroup	as	selected4	on 	p.CustomerGroupID = selected4.CustomerGroupID	 and selected4.CurrencyID = -1 '
          END +
        + CASE 
               WHEN @SelectedSaleGroup IS NULL THEN ''
               ELSE N'  join 	#SelectedSaleGroup	as	selected5	on 	s.SalesGroupID = selected5.SaleGroupID and selected5.CurrencyID = -1 '
          END +
        + CASE 
               WHEN @SelectedStuff IS NULL THEN ''
               ELSE N'  join 	#SelectedStuff	as	selected6	on 	ii.StuffID = selected6.StuffID and selected6.CurrencyID = -1 '
          END +
        + CASE 
               WHEN @SelectedIds IS NULL THEN ''
               ELSE N'  join 	#SelectedIds	as	selected7	on 	i.PosInvoiceID = selected7.DocumentID and selected7.Type=''P'' 	 '
          END +
        + CASE 
               WHEN @selectedBranch IS NULL THEN ''
               ELSE N'  join 	#Branch	as	selected8	on 	s2.BranchID = selected8.BranchID	 '
          END +
        
      CASE 
           WHEN @SelectedSaleType IS NULL THEN ''
           ELSE N'  join 	#SaleType	as	selected9	on 	i.SaleTypeID = selected9.SaleTypeID and selected9.CurrencyID = -1 '
      END +
      CASE 
           WHEN @SelectedStuffAccountGroup IS NULL THEN ''
           ELSE N'  join 	#StuffAccountGroup	as	selected10	on 	s.StuffAccountGroupID = selected10.StuffAccountGroupID and selected10.CurrencyID = -1 '
      END +
        
        N'
	WHERE  STATUS <> 3
	       AND [Date] BETWEEN @FromDate AND @ToDate;'
    
    EXECUTE sp_executesql @query,
         N' @FromDate                  DATE,
						@ToDate                   DATE,
						@selectedBranch                    NVARCHAR(MAX) = NULL,
						@SelectedCustomer                  NVARCHAR(MAX) = NULL,
						@SelectedStuff             NVARCHAR(MAX) = NULL,
						@SelectedSaleModels        NVARCHAR(MAX) = NULL,
						@SelectedSaleGroup         NVARCHAR(MAX) = NULL,
						@SelectedIds               NVARCHAR(MAX) = NULL,
						@SelectedCustomerGroup     NVARCHAR(MAX) = NULL,
						@SelectedStuffGroup        NVARCHAR(MAX) = NULL,
						@CostOfBuyingType          TINYINT = 1,
						@basePrecision   INT=0',
         @FromDate = @FromDate,
         @ToDate = @ToDate,
         @selectedBranch = @selectedBranch,
         @SelectedCustomer = @SelectedCustomer,
         @SelectedStuff = @SelectedStuff,
         @SelectedSaleModels = @SelectedSaleModels,
         @SelectedSaleGroup = @SelectedSaleGroup,
         @SelectedIds = @SelectedIds,
         @SelectedCustomerGroup = @SelectedCustomerGroup,
         @SelectedStuffGroup = @SelectedStuffGroup,
         @CostOfBuyingType = @CostOfBuyingType,
         @basePrecision = @basePrecision
END
	
SET @Query = N'Insert into ' + @TableName +
    N'
	SELECT 
	1,
	''ReturnInvoice'',
	i.BranchID,
	''sa''+cast(i.SaleAreaID as nvarchar(100)),
	s.StuffGroupID,
	i.CustomerID,
	i.SaleTypeID,
	p.CustomerGroupID,
	ii.SaleModelID,
	s.SalesGroupID,
	ii.StuffID,
	ii.ReturnedSaleInvoiceID,
	ii.ReturnedSaleInvoiceItemID,
	i.Number,
	i.[Date],
	
	-ii.MainQuantity,
	-ii.SubQuantity,
	-ii.Price,
	CASE WHEN c.IsBaseCurrencyBasis = 0 THEN
					-ROUND(
					ii.Price
					* i.CurrencyRate
					/ c.ExchangeUnit ,
					@basePrecision)
					ELSE
					-ROUND(
					( ii.Price
					* ( 1
					/ i.CurrencyRate ))
					/ c.ExchangeUnit ,
					@basePrecision)
					END AS Returned,
	-ii.Discount,				
	CASE WHEN c.IsBaseCurrencyBasis = 0 THEN
					ROUND(
					ii.Discount
					* i.CurrencyRate
					/ c.ExchangeUnit ,
					@basePrecision)
					ELSE
					ROUND(
					( ii.Discount
					* ( 1
					/ i.CurrencyRate ))
					/ c.ExchangeUnit ,
					@basePrecision)
					END Discount,
	-ii.Tax,
		-	CASE WHEN c.IsBaseCurrencyBasis = 0 THEN
					ROUND(
					ii.Tax
					* i.CurrencyRate
					/ c.ExchangeUnit ,
					@basePrecision)
					ELSE
					ROUND(
					( ii.Tax
					* ( 1
					/ i.CurrencyRate ))
					/ c.ExchangeUnit ,
					@basePrecision)
					END,
		-ii.Duty,
			-CASE WHEN c.IsBaseCurrencyBasis = 0 THEN
					ROUND(
					ii.Duty
					* i.CurrencyRate
					/ c.ExchangeUnit ,
					@basePrecision)
					ELSE
					ROUND(
					( ii.Duty
					* ( 1
					/ i.CurrencyRate ))
					/ c.ExchangeUnit ,
					@basePrecision)
					END,					
					Null,
	ii.ReturnedOutgoingItemID,
	0,
	i.CurrencyID,
	Null,
	ROW_NUMBER() OVER (PARTITION BY ii.ReturnedOutgoingItemID ORDER BY ii.Price desc)
	FROM   SLE.ReturnedSaleInvoice AS i
	join #SaleAreaAccess saa on i.SaleAreaID = saa.SaleAreaID and saa.Type = ''sa'' and i.CurrencyID = isnull(saa.CurrencyID,i.CurrencyID)
			Inner join cfg.currency c on i.currencyid=c.currencyid
	       INNER join SLE.ReturnedSaleInvoiceItem AS ii
	            ON  ii.ReturnedSaleInvoiceID = i.ReturnedSaleInvoiceID
	       join CFG.Party p
	            ON  p.PartyID = i.CustomerID
	       join #vwStuff s
	            ON  s.StuffID = ii.StuffID
	            INNER join #vwPartyAccess AS vpa ON vpa.PartyID = p.PartyID
	            INNER join #vwBranchAccess AS vba ON vba.BranchID = i.BranchID
	              ' + CASE 
                        WHEN @SelectedCustomer IS NULL THEN ''
                        ELSE N'join #Customer cstm on i.customerid=cstm.customerid and i.CurrencyID = cstm.CurrencyID'
                   END 
    + CASE 
           WHEN @SelectedStuffGroup IS NULL THEN ''
           ELSE N'  join 	#SelectedStuffGroup	as	selected2	on 	s.StuffGroupID = selected2.StuffGroupID and selected2.CurrencyID = i.CurrencyID'
      END +
    + CASE 
           WHEN @SelectedSaleModels IS NULL THEN ''
           ELSE N'  join 	#SelectedSaleModels	as	selected3	on 	ii.SaleModelID = selected3.SaleModelsID		and selected3.CurrencyID = i.CurrencyID '
      END +
    + CASE 
           WHEN @SelectedCustomerGroup IS NULL THEN ''
           ELSE N'  join 	#SelectedCustomerGroup	as	selected4	on 	p.CustomerGroupID = selected4.CustomerGroupID  and selected4.CurrencyID = i.CurrencyID	 '
      END +
    + CASE 
           WHEN @SelectedSaleGroup IS NULL THEN ''
           ELSE N'  join 	#SelectedSaleGroup	as	selected5	on 	s.SalesGroupID = selected5.SaleGroupID and selected5.CurrencyID = i.CurrencyID '
      END +
    + CASE 
           WHEN @SelectedStuff IS NULL THEN ''
           ELSE N'  join 	#SelectedStuff	as	selected6	on 	ii.StuffID = selected6.StuffID and selected6.CurrencyID = i.CurrencyID '
      END +
    + CASE 
           WHEN @SelectedIds IS NULL THEN ''
           ELSE N'  join 	#SelectedIds	as	selected7	on 	i.ReturnedSaleInvoiceID = selected7.DocumentID and selected7.Type=''R'' 	 '
      END +
    + CASE 
           WHEN @selectedBranch IS NULL THEN ''
           ELSE N'  join 	#Branch	as	selected8	on 	i.BranchID = selected8.BranchID	 '
      END +
        
      CASE 
           WHEN @SelectedSaleType IS NULL THEN ''
           ELSE N'  join 	#SaleType	as	selected9	on 	i.SaleTypeID = selected9.SaleTypeID and selected9.CurrencyID = i.CurrencyID '
      END +
      CASE 
           WHEN @SelectedStuffAccountGroup IS NULL THEN ''
           ELSE N'  join 	#StuffAccountGroup	as	selected10	on 	s.StuffAccountGroupID = selected10.StuffAccountGroupID and selected10.CurrencyID = i.CurrencyID '
      END +
    N'
	
	WHERE  [Date] BETWEEN @FromDate AND @ToDate;'
	
EXECUTE sp_executesql @query,
     N' @FromDate                  DATE,
						@ToDate                   DATE,
						@selectedBranch                    NVARCHAR(MAX) = NULL,
						@SelectedCustomer                  NVARCHAR(MAX) = NULL,
						@SelectedStuff             NVARCHAR(MAX) = NULL,
						@SelectedSaleModels        NVARCHAR(MAX) = NULL,
						@SelectedSaleGroup         NVARCHAR(MAX) = NULL,
						@SelectedIds               NVARCHAR(MAX) = NULL,
						@SelectedCustomerGroup     NVARCHAR(MAX) = NULL,
						@SelectedStuffGroup        NVARCHAR(MAX) = NULL,
						@CostOfBuyingType          TINYINT = 1,
						@basePrecision   INT=0',
     @FromDate = @FromDate,
     @ToDate = @ToDate,
     @selectedBranch = @selectedBranch,
     @SelectedCustomer = @SelectedCustomer,
     @SelectedStuff = @SelectedStuff,
     @SelectedSaleModels = @SelectedSaleModels,
     @SelectedSaleGroup = @SelectedSaleGroup,
     @SelectedIds = @SelectedIds,
     @SelectedCustomerGroup = @SelectedCustomerGroup,
     @SelectedStuffGroup = @SelectedStuffGroup,
     @CostOfBuyingType = @CostOfBuyingType,
     @basePrecision = @basePrecision
	
DECLARE @baseCurrencyPrecision INT = [CFG].[GetBaseCurrencyPrecision]();
	
IF @Source = 2
BEGIN
    IF @CostOfBuyingType = 1
    BEGIN
        SET @Query = N'UPDATE ' + @TableName +
            N' 
	    SET    CostOfBuying = -(
					SELECT TOP 1
					--SATURNNEW-5297			
					CASE 
					WHEN pi1.CurrencyID = -1 THEN (pii.Price - pii.Discount) / pii.MainQuantity
					ELSE ROUND(
					(pii.Price - pii.Discount)
					* (
					CASE 
					WHEN c.IsBaseCurrencyBasis = 0 THEN pi1.CurrencyRate
					ELSE 1 / pi1.CurrencyRate
					END
					) / c.ExchangeUnit,' + CAST(@baseCurrencyPrecision AS NVARCHAR(5)) +
            N'
					)
					/ pii.MainQuantity
					END * [' + @TableName +
            N'].MainQuantity
					FROM   VND.PurchaseInvoice AS pi1
					INNER join VND.PurchaseInvoiceItem AS pii
					ON  pii.PurchaseInvoiceID = pi1.PurchaseInvoiceID
					join CFG.Currency c
					ON  c.CurrencyID = pi1.CurrencyID
					WHERE  pi1.[Date] <=[' + @TableName + N'].[Date]
					AND pii.StuffID = [' + @TableName +
            N'].StuffID
					ORDER BY
					pi1.[Date] DESC,
					pi1.CreationDate DESC
	           )';
        
        EXEC (@Query)
    END
    
    IF @CostOfBuyingType = 2
    BEGIN
        SET @Query = N'
	    UPDATE ' + @TableName +
            N'
	    SET    CostOfBuying = -(
	               SELECT TOP 1
	                      pii.Fee + isnull(pii.ShareOfCosts/pii.MainQuantity,0)
	               FROM   STC.StockReceipt AS pi1
	                      INNER join STC.StockReceiptItem AS pii
	                           ON  pii.StockReceiptID = pi1.StockReceiptID
	               WHERE  pi1.[Date] <= [' + @TableName + N'].[Date]
	                      AND pii.StuffID =[' + @TableName +
            N']. StuffID
	                      AND pii.Fee <> 0
	               ORDER BY
	                      pi1.[Date] DESC,
	                      pi1.CreationDate DESC
	           )*[' + @TableName + N'].[MainQuantity]';
        
        EXEC (@Query)
    END
    
    IF @CostOfBuyingType = 3
    BEGIN
        SELECT oi.OutGoingItemID,
               oi.InvoiceItemID,
               oi.MainQuantity,
               oi.RemittanceItemID,
               oi.Price + ISNULL(r.Deference, 0) AS Price
        INTO   #FinalOutGoing
        FROM   stc.OutgoingItem AS oi
               LEFT JOIN (
                        SELECT SUM(rci.Deference) Deference,
                               rci.OutgoingItemID
                        FROM   stc.RevisionCostItem AS rci
                        WHERE  rci.OutgoingItemID IS NOT NULL
                        GROUP BY
                               rci.OutgoingItemID
                    ) R
                    ON  oi.OutgoingItemID = r.OutgoingItemID
        
        
        
        SELECT SUM(Price)            Price,
               SUM(MainQuantity)     MainQuantity,
               InvoiceItemID
        INTO   #OutGoingBaseOnInvoice
        FROM   (
                   SELECT Price,
                          MainQuantity,
                          InvoiceItemID
                   FROM   #FinalOutGoing
                   UNION ALL
                   SELECT a.Price,
                          a.MainQuantity,
                          ri.InvoiceItemID
                   FROM   #FinalOutGoing a
                          JOIN sle.RemittanceItem AS ri
                               ON  ri.RemittanceItemID = a.RemittanceItemID
               )                     a
        GROUP BY
               a.InvoiceItemID
        
        ----Updating Cost of Buying that outgoing has issued base on Invoice or outgoing has issued base on remmitance and remmitance has issued base on invoice
        SET @Query = N'
	    UPDATE Src
	    SET    CostOfBuying             = -ISNULL(oi.Price, 0) 
	    FROM ' + @TableName +
            N' Src
	    join #OutGoingBaseOnInvoice oi on Src.ItemID=oi.InvoiceItemID
	        Where Src.Type=''Invoice'';'
        
        EXEC (@Query)
        
        ------updating cost of buying that invoice has issued base on outgoing	              
        SET @Query = 
            N'UPDATE Src
		SET    CostOfBuying             = -round((oi.Price/oi.MainQuantity*Src.MainQuantity),'+CAST(@basePrecision AS NVARCHAR(20))+N')
		FROM ' + @TableName + N' Src
		join #FinalOutGoing oi on Src.OutGoingItemID=oi.OutGoingItemID
              where src.RnoBaseOnOutGoingItemID<>1
              and src.outgoingitemid is not null
		'
        
        EXEC (@Query)
        
        CREATE TABLE #UpdatedBaseOnOutGoingExeptRow1
        (OutGoingItemID INT,
         CostOfBuying DECIMAL(36,10))
        SET @Query = N'
        insert into  #UpdatedBaseOnOutGoingExeptRow1
        (OutGoingItemID,
         CostOfBuying )
        SELECT OutGoingItemID,sum(CostOfBuying) CostOfBuying  FROM '+@TableName+N'
        GROUP by  OutGoingItemID'
        
		EXEC (@Query)
		
		SET @Query = 
            N'UPDATE Src
		SET    CostOfBuying             = -(oi.Price + ub.CostOfBuying)
		FROM ' + @TableName + N' Src
		join #UpdatedBaseOnOutGoingExeptRow1 ub on src.OutGoingItemID = ub.OutGoingItemID
		join #FinalOutGoing oi on Src.OutGoingItemID=oi.OutGoingItemID
              where src.RnoBaseOnOutGoingItemID = 1
              and src.OutGoingItemID is not null
		'
        
        EXEC (@Query)
   
		------------update ReturnInvoice
        SELECT roi.ReturnedOutgoingItemID,
               roi.ReturnedSaleInvoiceItemID,
               roi.MainQuantity,
               roi.Price + ISNULL(r.Deference, 0) AS Price
        INTO   #FinalReturnOutGoing
        FROM   stc.ReturnedOutgoingItem AS roi
               LEFT JOIN (
                        SELECT SUM(rci.Deference) Deference,
                               rci.ReturnedOutgoingItemID
                        FROM   stc.RevisionCostItem AS rci
                        WHERE  rci.ReturnedOutgoingItemID IS NOT NULL
                        GROUP BY
                               rci.ReturnedOutgoingItemID
                    ) R
                    ON  roi.ReturnedOutgoingItemID = r.ReturnedOutgoingItemID
        
        SELECT SUM(Price)               Price,
               SUM(MainQuantity)        MainQuantity,
               ReturnedSaleInvoiceItemID
        INTO   #ReturnOutGoingBaseOnReturnInvoice
        FROM   #FinalReturnOutGoing     frog
        GROUP BY
               frog.ReturnedSaleInvoiceItemID
        
        ------Updating Cost of Buying that returnoutgoing has issued base on returnInvoice
        SET @Query = N'
	    UPDATE Src
	    SET    CostOfBuying             = ISNULL(oi.Price, 0) 
	    FROM ' + @TableName +
            N' Src
	    join #ReturnOutGoingBaseOnReturnInvoice oi on Src.ItemID=oi.ReturnedSaleInvoiceItemID
	        Where Src.Type=''ReturnInvoice'';'
        
        EXEC (@Query)
        
        ------updating cost of buying that invoice has issued base on outgoing	or                 
        SET @Query = 
            N'UPDATE Src
		SET    CostOfBuying             = -Round((oi.Price/oi.MainQuantity*Src.MainQuantity),'+CAST(@basePrecision AS NVARCHAR(20))+N')
		FROM ' + @TableName +
            N' Src
		join #FinalReturnOutGoing oi on Src.ReturnOutGoingItemID=oi.ReturnedOutgoingItemID
              where RnoBaseOnReturnOutGoingItemID <>1
		'
        
        EXEC (@Query)
        
         CREATE TABLE #UpdatedBaseOnReturnOutGoingExeptRow1
        (ReturnOutGoingItemID INT,
         CostOfBuying DECIMAL(36,10))
        
        SET @Query = N'
        insert into  #UpdatedBaseOnReturnOutGoingExeptRow1
        (ReturnOutGoingItemID,
         CostOfBuying )
        SELECT ReturnOutGoingItemID,sum(CostOfBuying) CostOfBuying  FROM '+@TableName+N'
        GROUP by  ReturnOutGoingItemID'
        
	
		EXEC (@Query)
           SET @Query = 
            N'UPDATE Src
		SET    CostOfBuying             = (oi.Price - ub.CostOfBuying)
		FROM ' + @TableName + N' Src
		join #UpdatedBaseOnReturnOutGoingExeptRow1 ub on src.ReturnOutGoingItemID = ub.ReturnOutGoingItemID
		join #FinalReturnOutGoing oi on Src.ReturnOutGoingItemID=oi.ReturnedOutgoingItemID
              where src.RnoBaseOnReturnOutGoingItemID = 1
              and src.ReturnOutGoingItemID is not null
		'
        
        EXEC (@Query)
        
       DECLARE @Columns NVARCHAR(MAX)
	   DECLARE @TableName1 NVARCHAR(MAX)
	   DECLARE @TableName2 NVARCHAR(MAX)
	   DECLARE @TableName3 NVARCHAR(MAX)
       DECLARE @Join NVARCHAR(MAX)

		SELECT @Columns = STUFF((SELECT DISTINCT ',' + QUOTENAME(al.traceID)
					   FROM   stf.Trace  al where PricingBase = 1	               
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
	                      
		IF(@Columns is null)								   
			SET @Columns = '[-1]'	

		SELECT @Join = STUFF((SELECT DISTINCT ' and isnull(a.' + QUOTENAME(al.traceID)+',0) = isnull(b.'+ QUOTENAME(al.traceID)+',0)'
					   FROM   stf.Trace  al where PricingBase = 1	               
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
	                      
		IF(@Join is null)								   
			SET @Join = ''	

		SET @TableName1 = cfg.getTempTableName(1)
		SET @TableName2 = cfg.getTempTableName(1)
		SET @TableName3 = cfg.getTempTableName(1)

		SET @Query = N'select c.OutgoingID,c.ReturnedOutgoingID,a.*
		into '+@TableName1+'
		from 
		(select a.*,
				Case When piit.DLID IS NOT NULL THEN cast (piit.DLID as nvarchar(max)) 
					 When piit.TraceItemID IS NOT NULL THEN cast (piit.TraceItemID as nvarchar(max))
				else piit.Value end Value,
				piit.TraceID
		from ' + @TableName + ' a
		left join pos.PosInvoiceItemTrace piit on piit.PosInvoiceItemID = a.ItemID
		)x
		pivot
		(
		 max(Value)
		 for TraceID in (' + @Columns + ')
		)a
		join pos.DeliveryPosInvoice b on a.HeaderID = b.posinvoiceID
		join pos.Delivery c on c.DeliveryID = b.DeliveryID
		where [Type] in (''PosInvoice'',''PosReturnInvoice'')
		'
		EXECUTE sp_executeSQL     
				@Query

		SET @Query = N'select a.*
		into '+@TableName2+'
		from 
		(select a.*,
				Case When piit.DLID IS NOT NULL THEN cast (piit.DLID as nvarchar(max)) 
					 When piit.TraceItemID IS NOT NULL THEN cast (piit.TraceItemID as nvarchar(max))
				else piit.Value end Value,
				piit.TraceID
		from Stc.OutgoingItem a
		join Stc.Outgoing h on h.OutgoingID = a.OutgoingID
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
			ON h.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		join stc.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
		left join Stc.OutgoingItemTrace piit on piit.OutgoingItemID = a.OutgoingItemID
		where sdt.DocumentType = 17
		)x
		pivot
		(
		 max(Value)
		 for TraceID in (' + @Columns + ')
		)a
		'
		EXECUTE sp_executeSQL     
				@Query

		SET @Query = N'select a.*
		into '+@TableName3+'
		from 
		(select a.*,
				Case When piit.DLID IS NOT NULL THEN cast (piit.DLID as nvarchar(max)) 
					 When piit.TraceItemID IS NOT NULL THEN cast (piit.TraceItemID as nvarchar(max))
				else piit.Value end Value,
				piit.TraceID
		from Stc.ReturnedOutgoingItem a
		join Stc.ReturnedOutgoing h on h.ReturnedOutgoingID = a.ReturnedOutgoingID
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
			ON h.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		join stc.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
		left join Stc.ReturnedOutgoingItemTrace piit on piit.ReturnedOutgoingItemID = a.ReturnedOutgoingItemID
		where sdt.DocumentType = 17
		)x
		pivot
		(
		 max(Value)
		 for TraceID in (' + @Columns + ')
		)a
		'
		EXECUTE sp_executeSQL     
				@Query
       
		SET @Query = N'
		update c
		set CostOfBuying = - ROUND(c.MainQuantity / b.MainQuantity * b.Price,@basePrecision)
		from '+@TableName1+' a
		join '+@TableName2+' b on a.OutgoingID = b.OutgoingID and a.StuffID = b.StuffID '+@Join+'
		join '+@TableName+' c on c.[Type] = ''PosInvoice'' and c.ItemID = a.ItemID
		'
		EXECUTE sp_executeSQL     
				@Query,
				N'@basePrecision Tinyint',
				@basePrecision = @basePrecision

		SET @Query = N'
		update c
		set CostOfBuying = -ROUND(c.MainQuantity / b.MainQuantity * b.Price,@basePrecision)
		from '+@TableName1+' a
		join '+@TableName3+' b on a.ReturnedOutgoingID = b.ReturnedOutgoingID and a.StuffID = b.StuffID '+@Join+'
		join '+@TableName+' c on c.[Type] = ''PosReturnInvoice'' and c.ItemID = a.ItemID
		'

		EXECUTE sp_executeSQL     
				@Query,
				N'@basePrecision Tinyint',
				@basePrecision = @basePrecision
    END
END;
