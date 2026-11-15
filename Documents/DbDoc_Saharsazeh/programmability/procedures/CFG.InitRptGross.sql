CREATE  
 PROCEDURE [CFG].InitRptGross
(
    @FromDate                  DATE,
    @EndDate                   DATE,
    @Branch                    NVARCHAR(MAX) = NULL,
    @Customer                  NVARCHAR(MAX) = NULL,
    @SelectedStuff             NVARCHAR(MAX) = NULL,
    @SelectedSaleModels        NVARCHAR(MAX) = NULL,
    @SelectedSaleGroup         NVARCHAR(MAX) = NULL,
    @SelectedIds               NVARCHAR(MAX) = NULL,
    @SelectedCustomerGroup     NVARCHAR(MAX) = NULL,
    @SelectedStuffGroup        NVARCHAR(MAX) = NULL,
    @CostOfBuyingType          TINYINT = 1,
    @SelectedSaleArea          NVARCHAR(MAX) = NULL,
    @TableName                 NVARCHAR(MAX)
)
AS
	DECLARE @UserID            INT,
	        @Query             NVARCHAR(MAX),
	        @basePrecision     INT = CFG.GetBaseCurrencyPrecision();
	
	
	SET @UserID = CFG.GetuserID();
	DECLARE @baseCurrencyDecimal     INT,
	        @SaleTypeID              INT
	
	
	SELECT @baseCurrencyDecimal = PrecisionCount
	FROM   cfg.Currency
	WHERE  CurrencyID = -1
	
	SELECT * into #vwPartyAccess  from cfg.vwPartyAccess 
	SELECT * into #vwBranchAccess FROM cfg.vwBranchAccess
	
	
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
	Discount decimal(36,10),
	OutgoingItemId int,
	ReturnOutgoingItemId int,	
	CostOfBuying  decimal(36,10),
	CurrencyID int,
	
	)
	'
	
	EXEC (@Query)
	
	
	IF @Customer IS NOT NULL
	BEGIN
	    SELECT VALUE Customerid
	    INTO   #Customer
	    FROM   CFG.R_FnCommaStr2Table(@Customer)
	END
	
	IF @SelectedSaleArea IS NOT NULL
	BEGIN
	    SELECT LEFT([value],2) TYPE,SUBSTRING([value],3,LEN([value])) SaleAreaID
	    INTO   #SelectedSaleArea
	    FROM   CFG.R_FnCommaStr2Table(@SelectedSaleArea)
	END
	
	IF @SelectedStuffGroup IS NOT NULL
	BEGIN
	    SELECT VALUE StuffGroupID
	    INTO   #SelectedStuffGroup
	    FROM   CFG.R_FnCommaStr2Table(@SelectedStuffGroup)
	END
	
	IF @SelectedSaleModels IS NOT NULL
	BEGIN
	    SELECT VALUE SaleModelsID
	    INTO   #SelectedSaleModels
	    FROM   CFG.R_FnCommaStr2Table(@SelectedSaleModels)
	END
	
	IF @SelectedCustomerGroup IS NOT NULL
	BEGIN
	    SELECT VALUE CustomerGroupID
	    INTO   #SelectedCustomerGroup
	    FROM   CFG.R_FnCommaStr2Table(@SelectedCustomerGroup)
	END
	
	IF @SelectedSaleGroup IS NOT NULL
	BEGIN
	    SELECT VALUE SaleGroupID
	    INTO   #SelectedSaleGroup
	    FROM   CFG.R_FnCommaStr2Table(@SelectedSaleGroup)
	END
	
	IF @SelectedStuff IS NOT NULL
	BEGIN
	    SELECT VALUE StuffID
	    INTO   #SelectedStuff
	    FROM   CFG.R_FnCommaStr2Table(@SelectedStuff)
	END
	
	IF @SelectedIds IS NOT NULL
	BEGIN
	    SELECT VALUE DocumentID
	    INTO   #SelectedIds
	    FROM   CFG.R_FnCommaStr2Table(@SelectedIds)
	END
	
	IF @Branch IS NOT NULL
	BEGIN
	    SELECT VALUE BranchID
	    INTO   #Branch
	    FROM   CFG.R_FnCommaStr2Table(@Branch)
	END
	
	
	
	
	
	
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
	ii.OutgoingItemId,
	null,
	0 ,
	i.CurrencyID
	FROM   SLE.Invoice                 AS i
	Inner join cfg.currency c on i.currencyid=c.currencyid
	       INNER join SLE.InvoiceItem  AS ii
	            ON  ii.InvoiceID = i.InvoiceID
	       join CFG.Party p
	            ON  p.PartyID = i.CustomerID
	       join STF.[vwStuff] s
	            ON  s.StuffID = ii.StuffID
	       INNER join #vwPartyAccess AS vpa ON vpa.PartyID = p.PartyID
	       INNER join #vwBranchAccess AS vba ON vba.BranchID = i.BranchID
	       ' + CASE 
	                WHEN @Customer IS NULL THEN ''
	                ELSE N'join #Customer c on i.customerid=c.customerid'
	           END +
	    CASE 
	         WHEN @SelectedSaleArea IS NULL THEN ''
	         ELSE N'  join 	#SelectedSaleArea	as	selected1	on 	i.SaleAreaID = selected1.SaleAreaID and 	selected1.Type=''sa'' '
	    END +
	    + CASE 
	           WHEN @SelectedStuffGroup IS NULL THEN ''
	           ELSE N'  join 	#SelectedStuffGroup	as	selected2	on 	i.StuffGroupID = selected2.StuffGroupID	 '
	      END +
	    + CASE 
	           WHEN @SelectedSaleModels IS NULL THEN ''
	           ELSE N'  join 	#SelectedSaleModels	as	selected3	on 	i.SaleModelsID = selected3.SaleModelsID	 '
	      END +
	    + CASE 
	           WHEN @SelectedCustomerGroup IS NULL THEN ''
	           ELSE 
	                N'  join 	#SelectedCustomerGroup	as	selected4	on 	i.CustomerGroupID = selected4.CustomerGroupID	 '
	      END +
	    + CASE 
	           WHEN @SelectedSaleGroup IS NULL THEN ''
	           ELSE N'  join 	#SelectedSaleGroup	as	selected5	on 	i.SaleGroupID = selected5.SaleGroupID	 '
	      END +
	    + CASE 
	           WHEN @SelectedStuff IS NULL THEN ''
	           ELSE N'  join 	#SelectedStuff	as	selected6	on 	i.StuffID = selected6.StuffID	 '
	      END +
	    + CASE 
	           WHEN @SelectedIds IS NULL THEN ''
	           ELSE N'  join 	#SelectedIds	as	selected7	on 	i.DocumentID = selected7.DocumentID	 '
	      END +
	    + CASE 
	           WHEN @Branch IS NULL THEN ''
	           ELSE N'  join 	#Branch	as	selected8	on 	i.BranchID = selected8.BranchID	 '
	      END +
	    
	    
	    N'
	WHERE  STATUS <> 2
	       AND [Date] BETWEEN @FromDate AND @EndDate';
	
	
	
	EXECUTE sp_executesql @query,
	     N' @FromDate                  DATE,
						@EndDate                   DATE,
						@Branch                    NVARCHAR(MAX) = NULL,
						@Customer                  NVARCHAR(MAX) = NULL,
						@SelectedStuff             NVARCHAR(MAX) = NULL,
						@SelectedSaleModels        NVARCHAR(MAX) = NULL,
						@SelectedSaleGroup         NVARCHAR(MAX) = NULL,
						@SelectedIds               NVARCHAR(MAX) = NULL,
						@SelectedCustomerGroup     NVARCHAR(MAX) = NULL,
						@SelectedStuffGroup        NVARCHAR(MAX) = NULL,
						@CostOfBuyingType          TINYINT = 1,
						@SelectedSaleArea         NVARCHAR(MAX) = NULL,
						@basePrecision   INT=0',
	     @FromDate = @FromDate,
	     @EndDate = @EndDate,
	     @Branch = @Branch,
	     @Customer = @Customer,
	     @SelectedStuff = @SelectedStuff,
	     @SelectedSaleModels = @SelectedSaleModels,
	     @SelectedSaleGroup = @SelectedSaleGroup,
	     @SelectedIds = @SelectedIds,
	     @SelectedCustomerGroup = @SelectedCustomerGroup,
	     @SelectedStuffGroup = @SelectedStuffGroup,
	     @CostOfBuyingType = @CostOfBuyingType,
	     @SelectedSaleArea = @SelectedSaleArea,
	     @basePrecision = @basePrecision    	
	
	
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
			case when i.IsReturnInvoice=0 then ii.price else -ii.price end ,
			case when i.IsReturnInvoice=0 then  -ii.Discount else ii.Discount end,
			Null,
			Null,
			case when isreturninvoice=0 then  -ii.Cost else ii.cost end ,
			-1
	FROM   POS.PosInvoice                 AS i
	       INNER join POS.PosInvoiceItem   AS ii
	            ON  ii.PosInvoiceID = i.PosInvoiceID
	       join CFG.Party p
	            ON  p.PartyID = i.CustomerID
	       join STF.[vwStuff] s
	            ON  s.StuffID = ii.StuffID
	            
	            join pos.StationShift AS ss ON ss.StationShiftID = i.StateShiftID
	            join pos.Station AS s2 ON s2.StationID = ss.StationID
	       INNER join #vwPartyAccess AS vpa ON vpa.PartyID = p.PartyID
	       INNER join #vwBranchAccess AS vba ON vba.BranchID = s2.BranchID
	         ' + CASE 
	                WHEN @Customer IS NULL THEN ''
	                ELSE N'join #Customer c on i.customerid=c.customerid'
	           END +
	    CASE 
	         WHEN @SelectedSaleArea IS NULL THEN ''
	         ELSE N'  join 	#SelectedSaleArea	as	selected1	on 	s2.StationID = selected1.SaleAreaID and 	selected1.Type=''st'' '
	    END +
	    + CASE 
	           WHEN @SelectedStuffGroup IS NULL THEN ''
	           ELSE N'  join 	#SelectedStuffGroup	as	selected2	on 	i.StuffGroupID = selected2.StuffGroupID	 '
	      END +
	    + CASE 
	           WHEN @SelectedSaleModels IS NULL THEN ''
	           ELSE N'  join 	#SelectedSaleModels	as	selected3	on 	i.SaleModelsID = selected3.SaleModelsID	 '
	      END +
	    + CASE 
	           WHEN @SelectedCustomerGroup IS NULL THEN ''
	           ELSE 
	                N'  join 	#SelectedCustomerGroup	as	selected4	on 	i.CustomerGroupID = selected4.CustomerGroupID	 '
	      END +
	    + CASE 
	           WHEN @SelectedSaleGroup IS NULL THEN ''
	           ELSE N'  join 	#SelectedSaleGroup	as	selected5	on 	i.SaleGroupID = selected5.SaleGroupID	 '
	      END +
	    + CASE 
	           WHEN @SelectedStuff IS NULL THEN ''
	           ELSE N'  join 	#SelectedStuff	as	selected6	on 	i.StuffID = selected6.StuffID	 '
	      END +
	    + CASE 
	           WHEN @SelectedIds IS NULL THEN ''
	           ELSE N'  join 	#SelectedIds	as	selected7	on 	i.DocumentID = selected7.DocumentID	 '
	      END +
	    + CASE 
	           WHEN @Branch IS NULL THEN ''
	           ELSE N'  join 	#Branch	as	selected8	on 	i.BranchID = selected8.BranchID	 '
	      END +
	    
	    
	    N'
	WHERE  STATUS <> 2
	       AND [Date] BETWEEN @FromDate AND @EndDate;'
	
	EXECUTE sp_executesql @query,
	     N' @FromDate                  DATE,
						@EndDate                   DATE,
						@Branch                    NVARCHAR(MAX) = NULL,
						@Customer                  NVARCHAR(MAX) = NULL,
						@SelectedStuff             NVARCHAR(MAX) = NULL,
						@SelectedSaleModels        NVARCHAR(MAX) = NULL,
						@SelectedSaleGroup         NVARCHAR(MAX) = NULL,
						@SelectedIds               NVARCHAR(MAX) = NULL,
						@SelectedCustomerGroup     NVARCHAR(MAX) = NULL,
						@SelectedStuffGroup        NVARCHAR(MAX) = NULL,
						@CostOfBuyingType          TINYINT = 1,
						@SelectedSaleArea         NVARCHAR(MAX) = NULL,
						@basePrecision   INT=0',
	     @FromDate = @FromDate,
	     @EndDate = @EndDate,
	     @Branch = @Branch,
	     @Customer = @Customer,
	     @SelectedStuff = @SelectedStuff,
	     @SelectedSaleModels = @SelectedSaleModels,
	     @SelectedSaleGroup = @SelectedSaleGroup,
	     @SelectedIds = @SelectedIds,
	     @SelectedCustomerGroup = @SelectedCustomerGroup,
	     @SelectedStuffGroup = @SelectedStuffGroup,
	     @CostOfBuyingType = @CostOfBuyingType,
	     @SelectedSaleArea = @SelectedSaleArea,
	     @basePrecision = @basePrecision
	
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
					Null,
	ii.ReturnedOutgoingItemID,
	0,
	i.CurrencyID
	FROM   SLE.ReturnedSaleInvoice AS i
			Inner join cfg.currency c on i.currencyid=c.currencyid
	       INNER join SLE.ReturnedSaleInvoiceItem AS ii
	            ON  ii.ReturnedSaleInvoiceID = i.ReturnedSaleInvoiceID
	       join CFG.Party p
	            ON  p.PartyID = i.CustomerID
	       join STF.[vwStuff] s
	            ON  s.StuffID = ii.StuffID
	            INNER join #vwPartyAccess AS vpa ON vpa.PartyID = p.PartyID
	            INNER join #vwBranchAccess AS vba ON vba.BranchID = i.BranchID
	              ' + CASE 
	                WHEN @Customer IS NULL THEN ''
	                ELSE N'join #Customer c on i.customerid=c.customerid'
	           END +
	    CASE 
	         WHEN @SelectedSaleArea IS NULL THEN ''
	         ELSE N'  join 	#SelectedSaleArea	as	selected1	on 	i.SaleAreaID = selected1.SaleAreaID and 	selected1.Type=''sa'' '
	    END +
	    + CASE 
	           WHEN @SelectedStuffGroup IS NULL THEN ''
	           ELSE N'  join 	#SelectedStuffGroup	as	selected2	on 	i.StuffGroupID = selected2.StuffGroupID	 '
	      END +
	    + CASE 
	           WHEN @SelectedSaleModels IS NULL THEN ''
	           ELSE N'  join 	#SelectedSaleModels	as	selected3	on 	i.SaleModelsID = selected3.SaleModelsID	 '
	      END +
	    + CASE 
	           WHEN @SelectedCustomerGroup IS NULL THEN ''
	           ELSE 
	                N'  join 	#SelectedCustomerGroup	as	selected4	on 	i.CustomerGroupID = selected4.CustomerGroupID	 '
	      END +
	    + CASE 
	           WHEN @SelectedSaleGroup IS NULL THEN ''
	           ELSE N'  join 	#SelectedSaleGroup	as	selected5	on 	i.SaleGroupID = selected5.SaleGroupID	 '
	      END +
	    + CASE 
	           WHEN @SelectedStuff IS NULL THEN ''
	           ELSE N'  join 	#SelectedStuff	as	selected6	on 	i.StuffID = selected6.StuffID	 '
	      END +
	    + CASE 
	           WHEN @SelectedIds IS NULL THEN ''
	           ELSE N'  join 	#SelectedIds	as	selected7	on 	i.DocumentID = selected7.DocumentID	 '
	      END +
	    + CASE 
	           WHEN @Branch IS NULL THEN ''
	           ELSE N'  join 	#Branch	as	selected8	on 	i.BranchID = selected8.BranchID	 '
	      END +
	    
	    
	    N'
	
	WHERE  [Date] BETWEEN @FromDate AND @EndDate;'
	
	EXECUTE sp_executesql @query,
	     N' @FromDate                  DATE,
						@EndDate                   DATE,
						@Branch                    NVARCHAR(MAX) = NULL,
						@Customer                  NVARCHAR(MAX) = NULL,
						@SelectedStuff             NVARCHAR(MAX) = NULL,
						@SelectedSaleModels        NVARCHAR(MAX) = NULL,
						@SelectedSaleGroup         NVARCHAR(MAX) = NULL,
						@SelectedIds               NVARCHAR(MAX) = NULL,
						@SelectedCustomerGroup     NVARCHAR(MAX) = NULL,
						@SelectedStuffGroup        NVARCHAR(MAX) = NULL,
						@CostOfBuyingType          TINYINT = 1,
						@SelectedSaleArea         NVARCHAR(MAX) = NULL,
						@basePrecision   INT=0',
	     @FromDate = @FromDate,
	     @EndDate = @EndDate,
	     @Branch = @Branch,
	     @Customer = @Customer,
	     @SelectedStuff = @SelectedStuff,
	     @SelectedSaleModels = @SelectedSaleModels,
	     @SelectedSaleGroup = @SelectedSaleGroup,
	     @SelectedIds = @SelectedIds,
	     @SelectedCustomerGroup = @SelectedCustomerGroup,
	     @SelectedStuffGroup = @SelectedStuffGroup,
	     @CostOfBuyingType = @CostOfBuyingType,
	     @SelectedSaleArea = @SelectedSaleArea,
	     @basePrecision = @basePrecision
	
	DECLARE @baseCurrencyPrecision INT = [CFG].[GetBaseCurrencyPrecision]();
	
	
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
	                      pii.Fee
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
	           LEFT join (
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
	                      join sle.RemittanceItem AS ri
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
	    
	    ------updating cost of buying that invoice has issued base on outgoing	or                 
	    
	    
	    SET @Query = 
	        N'UPDATE Src
		SET    CostOfBuying             = -(oi.Price/oi.MainQuantity*Src.MainQuantity)
		FROM ' + @TableName + N' Src
		join #FinalOutGoing oi on Src.OutGoingItemID=oi.OutGoingItemID'
	    
	    EXEC (@Query)
	    
	    
	    SELECT roi.ReturnedOutgoingItemID,
	           roi.ReturnedSaleInvoiceItemID,
	           roi.MainQuantity,
	           roi.Price + ISNULL(r.Deference, 0) AS Price
	    INTO   #FinalReturnOutGoing
	    FROM   stc.ReturnedOutgoingItem AS roi
	           LEFT join (
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
		SET    CostOfBuying             = -(oi.Price/oi.MainQuantity*Src.MainQuantity)
		FROM ' + @TableName +
	        N' Src
		join #FinalReturnOutGoing oi on Src.ReturnOutGoingItemID=oi.ReturnedOutgoingItemID'
	    
	    EXEC (@Query)
	END
	
	PRINT 'End of Data Source' 
	;
