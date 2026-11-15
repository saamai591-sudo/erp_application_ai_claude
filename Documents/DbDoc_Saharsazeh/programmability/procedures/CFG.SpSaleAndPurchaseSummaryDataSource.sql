
CREATE   PROC [CFG].SpSaleAndPurchaseSummaryDataSource
(
    @FromDate DATE = NULL,
    @ToDate DATE,
    @PartyID BIGINT = NULL,
    @CurrencyID INT = NULL,
    @TableName NVARCHAR(MAX),
    @Type VARCHAR(25),
    @DataType INT
)
--WITH ENCRYPTION 
AS
BEGIN
SET NOCOUNT ON

SELECT vpa.*
INTO   #PartyAccess
FROM   cfg.vwPartyAccess AS vpa
join cfg.party p on p.PartyID = vpa.PartyID
where
(
(@Type = 'Customer' and p.IsCustomer = 1)
or
(@Type = 'Vendor' and p.IsVendor = 1)
or
(@Type = 'Party' and (p.IsCustomer = 1 or p.IsVendor = 1) )
)

SELECT * into #vwBranchAccess
FROM cfg.vwBranchAccess AS vba

DECLARE @Query NVARCHAR(MAX)

--SELECT 'abcd'
	
CREATE TABLE #OperationLevelAccessUser
(
	userid INT
);

	--Print 1
	--Print sysdatetime()
	
IF @Type IN ('Customer', 'Party')
   AND @FromDate IS NULL
BEGIN
    SET @Query = N'
		insert into ' + @TableName + 
        N'
		SELECT i.CurrencyID,i.CustomerID,Sum(case when BalanceType = 0 then OpeningBalance else -OpeningBalance end) OpeningBalance,0 Price,0 Discount,0 Vat,
		0 Returned ,0 Received ,0 Payed ,''Customer'','
        + CAST(@DataType AS NVARCHAR(1)) + 
        N'
		FROM sle.CustomerOpeningBalance i
		INNER JOIN #PartyAccess AS vpa on i.CustomerID=vpa.PartyID
		where  (@CurrencyID is null or i.CurrencyID = @CurrencyID)
		and (@PartyID is null or I.CustomerID = @PartyID)
		group by i.CustomerID,i.CurrencyID
		'
    
    --Print @Query
    
    EXECUTE sp_executeSQL 
            @Query,
         N'@CurrencyID int,@PartyID bigint',
         @CurrencyID = @CurrencyID,
         @PartyID = @PartyID
END    

		


----Vendor Openning Balance
		
IF @FromDate IS NULL
   AND @Type IN ('Vendor', 'Party')
BEGIN
    SET @Query = N'
		insert into ' + @TableName +
        '
		SELECT  i.CurrencyID,i.VendorID,Sum(case when BalanceType = 0 then OpeningBalance else -OpeningBalance end),0,0,0,0,0,0,''Vendor'',' + CAST(@DataType AS NVARCHAR(1)) + 
        N'
		 FROM vnd.VendorOpeningBalance  i
		 INNER JOIN #PartyAccess AS vpa on i.VendorID=vpa.PartyID
		where (@CurrencyID is null or i.CurrencyID = @CurrencyID)
		and  (@PartyID is null or I.VendorID = @PartyID)
		Group by i.VendorID,i.CurrencyID'
    
    EXECUTE sp_executeSQL 
            @Query,
         N'@CurrencyID int,@PartyID bigint',
         @CurrencyID = @CurrencyID,
         @PartyID = @PartyID
END


		
IF @Type IN ('Customer', 'Party')
BEGIN
    SET @Query = N'
		insert into ' + @TableName + 
        N'
		SELECT 
i.CurrencyID,
i.CustomerID PartyID,0,
sum(vi.Price),
-sum(vi.Discount) Discount,
sum(vi.Tax+vi.Duty) Vat,
0 as Returned,
0 as Received,
0 as Payed,
''Customer'',' + CAST(@DataType AS NVARCHAR(1)) + 
        N'
		 FROM sle.Invoice i
		 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 JOIN sle.InvoiceItem Vi on Vi.InvoiceID = i.InvoiceID
		 INNER JOIN #PartyAccess AS vpa on i.CustomerID=vpa.PartyID
		where  i.SaleInvoiceStatus <> 5
		and( (select lower(ConfigValue) from CFG.Configuration
		where ConfigKey = ''InvoiceNeedConfirm'') = ''false''
			or
			i.SaleInvoiceStatus=2)
		and (@CurrencyID is null or i.CurrencyID = @CurrencyID)
		and  (@PartyID is null or I.CustomerID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)
		Group by i.CustomerID,i.CurrencyID '
		
    
EXECUTE sp_executeSQL 
        @Query,
     N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date',
     @CurrencyID = @CurrencyID,
     @PartyID = @PartyID,
     @FromDate = @FromDate,
     @ToDate = @ToDate		
		
END
    
IF @Type IN ('Party', 'Customer')
BEGIN
    ---Return Sale Invoice
    
    SET @Query = N'
	insert into ' + @TableName + 
        '
	SELECT i.CurrencyID,
	i.CustomerID PartyID,0,
	0,
	sum(vi.Discount) Discount,
	-sum(vi.Tax+vi.Duty) Vat,
	-sum(vi.Price) as Returned,
	0 as Received,
	0 as Payed,
	''Customer'',' + CAST(@DataType AS NVARCHAR(1)) + 
        N'
		 FROM sle.ReturnedSaleInvoice i
		 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 join sle.ReturnedSaleInvoiceItem Vi on vi.ReturnedSaleInvoiceID = i.ReturnedSaleInvoiceID

		 INNER JOIN #PartyAccess AS vpa on i.CustomerID=vpa.PartyID
		where (@CurrencyID is null or i.CurrencyID = @CurrencyID)
		and  (@PartyID is null or I.CustomerID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)	Group by i.CustomerID,i.CurrencyID	'
EXECUTE sp_executeSQL 
        @Query,
     N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date',
     @CurrencyID = @CurrencyID,
     @PartyID = @PartyID,
     @FromDate = @FromDate,
     @ToDate = @ToDate		
END
    
------ Purchase Invoice
IF @Type IN ('Vendor', 'Party')
BEGIN
    SET @Query = N'
		insert into ' + @TableName + 
        '
		SELECT 
		i.CurrencyID,
		p.PartyID PartyID,0,
		-sum(vi.Price),
		sum(vi.Discount) Discount,
		-sum(vi.Tax+vi.Duty) Vat,
		0 as Returned,
		0 as Received,
		0 as Payed,
		''Vendor'',' + CAST(@DataType AS NVARCHAR(1)) + 
        N'
		 FROM vnd.PurchaseInvoice  i
		 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 join vnd.PurchaseInvoiceItem vi on vi.PurchaseInvoiceID = i.PurchaseInvoiceID
		join cfg.Party P on P.DlID = I.DlID
		 INNER JOIN #PartyAccess AS vpa on p.PartyID=vpa.PartyID
		where (@CurrencyID is null or i.CurrencyID = @CurrencyID)
		and  (@PartyID is null or P.PartyID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)	Group by p.PartyID,i.CurrencyID	'
    
    
    --Print @Query
    EXECUTE sp_executeSQL 
            @Query,
         N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date',
         @CurrencyID = @CurrencyID,
         @PartyID = @PartyID,
         @FromDate = @FromDate,
         @ToDate = @ToDate
END

     
IF @Type IN ('Vendor', 'Party')
BEGIN
    SET @Query = N'
		insert into ' + @TableName + 
        '
		SELECT
		i.CurrencyID,
		p.PartyID PartyID,0,
		sum(ii.Price),
		-sum(ii.Discount) Discount,
		sum(ii.Tax+ii.Duty) Vat,
		0 as Returned,
		0 as Received
		,0 as Payed,
		''Vendor'',' + CAST(@DataType AS NVARCHAR(1)) + 
        N'
		 FROM vnd.ReturnInvoice  i
		 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 join vnd.ReturnInvoiceItem ii on i.ReturnInvoiceID = ii.ReturnInvoiceID
		join cfg.Party P on P.DlID = I.DlID
		INNER JOIN #PartyAccess AS vpa on p.PartyID=vpa.PartyID
		where (@CurrencyID is null or i.CurrencyID = @CurrencyID)
		and  (@PartyID is null or P.PartyID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)		Group by p.PartyID,i.CurrencyID' 
    
    EXECUTE sp_executeSQL 
            @Query,
         N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date',
         @CurrencyID = @CurrencyID,
         @PartyID = @PartyID,
         @FromDate = @FromDate,
         @ToDate = @ToDate

END


    SET @Query = N'
		insert into ' + @TableName + 
        '
		SELECT 
		rs.CurrencyID,
		p.PartyID PartyID,0,
		0,
		0,
		0 Vat,
		0 as Returned,
		-sum(rs.Amount+rs.Discount) as Received,
		0 as Payed,
		case when rt.Type in (1,2,3) then ''Customer'' Else ''Vendor'' End ,' + CAST(@DataType AS NVARCHAR(1)) + 
        N'
		
		 FROM fin.ReceiveReceipt i
		 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 join fin.ReceiveSubject RS on RS.ReceiveReceiptID = i.ReceiveReceiptID
		 join cfg.party p on p.dlid = rs.dlid
		 join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
		INNER JOIN #PartyAccess AS vpa on p.PartyID=vpa.PartyID
		WHERE i.Status<>1 and RT.Type in (1,2,3,4)
		and i.DeliverChequeID is null
		and (@CurrencyID is null or rs.CurrencyID = @CurrencyID)
		and  (@PartyID is null or p.PartyID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)		Group by p.PartyID,rs.CurrencyID,rt.Type'
    
    EXECUTE sp_executeSQL 
            @Query,
         N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date',
         @CurrencyID = @CurrencyID,
         @PartyID = @PartyID,
         @FromDate = @FromDate,
         @ToDate = @ToDate
         



    SET @Query = N'
		insert into ' + @TableName + 
        '
		SELECT 
		rs.CurrencyID,
		p.PartyID PartyID,0,
		0,
		0,
		0 Vat,
		0 as Returned,
		sum(rs.Amount) as Received,
		0 as Payed,
		case when rt.Type in (1,2,3) then ''Customer'' Else ''Vendor'' End ,' + CAST(@DataType AS NVARCHAR(1)) + 
        N'
		 FROM fin.ReceiptCheqeFlow i
		 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 JOIN fin.ReceiptCheqeFlowItem rcfi ON rcfi.ReceiptCheqeFlowID = i.ReceiptCheqeFlowID
		 JOIN fin.ReceivedCheqe rc ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
		 join fin.ReceiveSubject RS on RS.ReceivedCheqeID = rc.ReceivedCheqeID
		 join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
		 join cfg.Party P on P.DlID = RS.DlID
		INNER JOIN #PartyAccess AS vpa on p.PartyID=vpa.PartyID
		 where  i.[Type] in (1,11) and  RT.Type in (1,2,3,4)
		and (@CurrencyID is null or rs.CurrencyID = @CurrencyID)
		and  (@PartyID is null or p.PartyID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)		
		Group by p.PartyID,rs.CurrencyID,rt.Type'
    
    EXECUTE sp_executeSQL 
            @Query,
         N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date',
         @CurrencyID = @CurrencyID,
         @PartyID = @PartyID,
         @FromDate = @FromDate,
         @ToDate = @ToDate



SET @Query = N'
	insert into ' + @TableName + '
	SELECT 

	ps.CurrencyID,
		i.PartyID PartyID,0,
		0,
		0,
		0 Vat,
		0 as Returned,
		0 as Received,
		-sum(ps.Amount) as Payed,
		case when pt.Type = 2 then ''Customer'' Else ''Vendor'' End ,' + CAST(@DataType AS NVARCHAR(1)) + N'
		 FROM fin.ReceiptCheqeFlow i
		 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 JOIN fin.ReceiptCheqeFlowItem rcfi ON rcfi.ReceiptCheqeFlowID = i.ReceiptCheqeFlowID
		 JOIN fin.ReceivedCheqe rc ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
		 join fin.PaymentOtherCheqe POC on POC.ReceivedCheqeID = rc.ReceivedCheqeID
		 join fin.PaymentSubject PS on PS.PaymentOtherCheqeID = POC.PaymentOtherCheqeID
		 join fin.PaymentType PT on PT.PaymentTypeID = PS.PaymentTypeID
		INNER JOIN #PartyAccess AS vpa on i.PartyID=vpa.PartyID
		where  i.[Type] = 4
		and rcfi.PreviousFlow = poc.ReceiptCheqeFlowItemID
		and PT.Type in (1,2,3,10,12)
		and (@CurrencyID is null or ps.CurrencyID = @CurrencyID)
		and  (@PartyID is null or i.PartyID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)		 
		group by PS.CurrencyID,i.PartyID,PT.Type'
    	        
    	 

EXECUTE sp_executeSQL 
        @Query,
     N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date',

     @CurrencyID = @CurrencyID,
     @PartyID = @PartyID,
     @FromDate = @FromDate,
     @ToDate = @ToDate

SET @Query = N'
		insert into ' + @TableName + 
    '
		SELECT 
		rcfi.CurrencyID,
		p.PartyID PartyID,0,
		0,
		0,
		0 Vat,
		0 as Returned,
		0 as Received,
		sum(rcfi.Amount+rcfi.Discount) as Payed,
		case when pt.Type in (2) then ''Customer'' Else ''Vendor'' End ,' + CAST(@DataType AS NVARCHAR(1)) + N'
		 FROM fin.PaymentReceipt i
		 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 JOIN fin.PaymentSubject rcfi ON rcfi.PaymentReceiptID = i.PaymentReceiptID
		 join cfg.party p on p.dlid = rcfi.dlid
		 join fin.PaymentType PT on PT.PaymentTypeID = rcfi.PaymentTypeID
		INNER JOIN #PartyAccess AS vpa on p.PartyID=vpa.PartyID
		where  i.[Status] = 0
		and PT.Type in (1,2,3,10,12)
		and (@CurrencyID is null or rcfi.CurrencyID = @CurrencyID)
		and  (@PartyID is null or p.PartyID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)		Group by rcfi.CurrencyID,p.PartyID,pt.Type'

EXECUTE sp_executeSQL 
        @Query,
     N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date',
     @CurrencyID = @CurrencyID,
     @PartyID = @PartyID,
     @FromDate = @FromDate,
     @ToDate = @ToDate

		
SET @Query = N'
		insert into ' + @TableName + 
    '
		SELECT ps.CurrencyID,
		p.PartyID PartyID,0,
		0,
		0,
		0 Vat,
		0 as Returned,
		0 as Received,
		-sum(ps.Amount) as Payed,
		case when pt.Type in (2) then ''Customer'' Else ''Vendor'' End ,' + CAST(@DataType AS NVARCHAR(1)) + N'
		 FROM fin.PaymentCheqeFlow i
		 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 JOIN fin.PaymentCheqeFlowItem rbd ON rbd.PaymentCheqeFlowID = i.PaymentCheqeFlowID
		 join FIN.PaymentCheqe pc on pc.PaymentCheqeID = rbd.PaymentCheqeID
		 join fin.PaymentSubject PS on PS.PaymentCheqeID = PC.PaymentCheqeID
		 join fin.PaymentType PT on PT.PaymentTypeID = PS.PaymentTypeID
		 join cfg.Party P on P.DlID = PS.DLID and p.PartyID = i.PartyID
		INNER JOIN #PartyAccess AS vpa on p.PartyID=vpa.PartyID
		where  PT.Type in (1,2,3,10,12)
		AND I.Type = 1
		and (@CurrencyID is null or ps.CurrencyID = @CurrencyID)
		and  (@PartyID is null or p.PartyID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)	Group by ps.CurrencyID,p.PartyID,pt.Type	' 
	
EXECUTE sp_executeSQL 
        @Query,
     N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date',
     @CurrencyID = @CurrencyID,
     @PartyID = @PartyID,
     @FromDate = @FromDate,
     @ToDate = @ToDate


SET @Query = N'
		insert into ' + @TableName + 
    '
	SELECT
		i.CurrencyID,
		i.PartyID PartyID,0,
		0,
		0,
		0 Vat,
		0 as Returned,
		-sum(case when i.type= 1 then i.Amount else 0 end)  as Received,
		sum(case when i.type= 0 then i.Amount  else 0 end) as Payed,
		case when  pt.Type = 2  then ''Customer'' 
	when  pt.Type in (1,3,10,12) then ''Vendor''
	when  rt.Type in (1,2,3) then ''Customer'' 
	when rt.Type =  4 then ''Vendor''
	else Null End,' + CAST(@DataType AS NVARCHAR(1)) + 
    N'
	from cfg.DebitCreditNote h
	join #vwBranchAccess vba on h.BranchID = vba.BranchID
	join cfg.DebitCreditNoteItem i on h.DebitCreditNoteID = i.DebitCreditNoteID
	left join fin.ReceiptType rt on rt.ReceiptTypeID = i.ReceiptTypeID
	left join fin.PaymentType pt on pt.PaymentTypeID = i.PaymentTypeID
		INNER JOIN #PartyAccess AS vpa on i.PartyID=vpa.PartyID
	where ( (rt.ReceiptTypeID is not null and rt.Type in (1,2,3,4) )
			or
			(pt.PaymentTypeID is not null and pt.Type in (1,2,3,10,12))
		  )
		and (@CurrencyID is null or i.CurrencyID = @CurrencyID)
		and  (@PartyID is null or i.PartyID = @PartyID)
		and
		((@FromDate is null and h.date < @ToDate)
		or
		(@FromDate is not null and h.date between @FromDate and @ToDate)
		)	Group by i.CurrencyId,i.PartyID,pt.Type,rt.Type	'

EXECUTE sp_executeSQL 
        @Query,
     N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date',
     @CurrencyID = @CurrencyID,
     @PartyID = @PartyID,
     @FromDate = @FromDate,
     @ToDate = @ToDate

	 

SET @Query = N'
		insert into ' + @TableName + 
    '
		SELECT
		  
		pc.CurrencyID,
		rcfi.PartyID PartyID,0,
		0,
		0,
		0 Vat,
		0 as Returned,
		sum(rcfi.Amount) as Received,
		0 as Payed,
		case when pt.Type in (2) then ''Customer'' Else ''Vendor'' End ,' + CAST(@DataType AS NVARCHAR(1)) + 
    N'
		 FROM fin.PettyCashCost i
		 join #vwBranchAccess vba on i.BranchID = vba.BranchID
		 JOIN fin.PettyCashCostItem rcfi ON rcfi.PettyCashCostID = i.PettyCashCostID
		 join fin.PettyCash pc on pc.PettyCashID = i.PettyCashID
		 JOIN cfg.Currency c ON c.CurrencyID = pc.CurrencyID
		 join fin.PaymentType PT on PT.PaymentTypeID = rcfi.PaymentTypeID
		INNER JOIN #PartyAccess AS vpa on rcfi.PartyID=vpa.PartyID
		where  PT.Type in (1,2,3,10,12)
		and (@CurrencyID is null or pc.CurrencyID = @CurrencyID)
		and  (@PartyID is null or rcfi.PartyID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)		group by pc.CurrencyID,rcfi.PartyID,pt.Type' 

EXECUTE sp_executeSQL 
        @Query,
     N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date',
     @CurrencyID = @CurrencyID,
     @PartyID = @PartyID,
     @FromDate = @FromDate,
     @ToDate = @ToDate


IF @Type IN ('Vendor', 'Party')
BEGIN
    SET @Query = N'
		insert into ' + @TableName + 
        '
		SELECT 
		-1,
		i.PartyID PartyID,0,
		0,
		0,
		0 Vat,
		0 as Returned,
		-sum(i.Amount) as Received,
		0 as Payed,
		 ''Vendor'' 		,' + CAST(@DataType AS NVARCHAR(1)) + 
        N'
		 FROM fos.CostOfOrder c
		 join #vwBranchAccess vba on c.BranchID = vba.BranchID
		 join fos.CostOfOrderItem i on c.CostOfOrderid = i.CostOfOrderID
		 join fos.SpecialCost s on s.SpecialCostID = i.SpecialCostID
		INNER JOIN #PartyAccess AS vpa on i.PartyID=vpa.PartyID
		where  i.PartyID is not null
		and i.PurchaseInvoiceItemID is null
		and  (@CurrencyID is null or @CurrencyID = -1)
		and  (@PartyID is null or i.PartyID = @PartyID)
		and
		((@FromDate is null and c.date < @ToDate)
		or
		(@FromDate is not null and c.date between @FromDate and @ToDate)
		)		Group by i.PartyID ' 
    
    EXECUTE sp_executeSQL 
            @Query,
         N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date',
         @CurrencyID = @CurrencyID,
         @PartyID = @PartyID,
         @FromDate = @FromDate,
         @ToDate = @ToDate
END


IF @Type IN ('Customer', 'Party')
BEGIN
    SET @Query = N'
		insert into ' + @TableName + 
        '
		SELECT 
		
		-1,
		i.CustomerID PartyID,0,
		sum(case when IsReturnInvoice = 0  then i.TotalPrice else 0 end),
		sum(Case when IsReturnInvoice = 0   then -i.TotalDiscount-i.RoundPrice when IsReturnInvoice = 1 then i.TotalDiscount+i.RoundPrice  else 0 end),
		sum(i.TotalTax+i.TotalDuty) Vat,
		sum(case when IsReturnInvoice = 1 and i.Status=1 then -i.TotalPrice else 0 end) as Returned,
		0 as Received,
		0 as Payed,
		 ''Customer'' 		,' + CAST(@DataType AS NVARCHAR(1)) + 
        N'
		 FROM pos.PosInvoice i
		join pos.StationShift AS ss on ss.StationShiftID = i.StateShiftID
		join pos.Station AS st on st.StationID = ss.StationID
		join #vwBranchAccess vba on st.BranchID = vba.BranchID
		INNER JOIN #PartyAccess AS vpa on i.CustomerID=vpa.PartyID
		where   (@CurrencyID is null or @CurrencyID = -1)
		and i.Status = 1
		and  (@PartyID is null or i.CustomerID = @PartyID)
		and
		((@FromDate is null and i.date < @ToDate)
		or
		(@FromDate is not null and i.date between @FromDate and @ToDate)
		)		Group by i.CustomerID ' 
    
    EXECUTE sp_executeSQL 
            @Query,
         N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date',
         @CurrencyID = @CurrencyID,
         @PartyID = @PartyID,
         @FromDate = @FromDate,
         @ToDate = @ToDate
END
     
--------------------PosReceipt --------------------     
     
IF @Type IN ('Customer', 'Party')
BEGIN
    SET @Query = N'
		insert into ' + @TableName + '
		SELECT 
		 pri.CurrencyID,
		 pr.CustomerID as PartyID,0,
            0  AS Price,
            0     Discount,
            0  AS Vat,
            0  AS Returned,
            SUM(CASE WHEN pri.IsPayed = 0 THEN -pri.Amount ELSE 0 END) 
            Received,
            SUM(CASE WHEN pri.IsPayed = 1 THEN pri.Amount ELSE 0 END) Payed,
		 ''Customer'' 		,' + CAST(@DataType AS NVARCHAR(1)) + N'
		 FROM pos.posReceipt pr
		 join pos.StationShift AS ss on ss.StationShiftID = pr.StationShiftID
		 join pos.Station AS st on st.StationID = ss.StationID
		 join #vwBranchAccess vba on st.BranchID = vba.BranchID
		 inner join pos.PosReceiptItem pri ON pri.PosReceiptID = pr.PosReceiptID
		INNER JOIN #PartyAccess AS vpa on pr.CustomerID=vpa.PartyID
		where   (@CurrencyID is null or pri.CurrencyID = @CurrencyID )
		and  (@PartyID is null or pr.CustomerID = @PartyID)
		and
		((@FromDate is null and pr.date < @ToDate)
		or
		(@FromDate is not null and pr.date between @FromDate and @ToDate)
		)		
		
		Group by pr.CustomerID,pr.IsPayed,pri.IsPayed,pri.CurrencyID ' 
    
    EXECUTE sp_executeSQL 
            @Query,
         N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date',
         @CurrencyID = @CurrencyID,
         @PartyID = @PartyID,
         @FromDate = @FromDate,
         @ToDate = @ToDate
END

   --PosReceiptHeaderDiscount---
IF @Type IN ('Customer', 'Party')
BEGIN
    SET @Query = N'
		insert into ' + @TableName + '
		SELECT 
		 -1,
		 pr.CustomerID as PartyID,0,
            0  AS Price,
             SUM(CASE WHEN pr.IsPayed = 0 THEN -pr.Discount ELSE pr.Discount END) Discount,
            0  AS Vat,
            0  AS Returned,
            0 Received,
            0 Payed,
		 ''Customer'' 		,' + CAST(@DataType AS NVARCHAR(1)) + N'
		 FROM pos.posReceipt pr
		 join pos.StationShift AS ss on ss.StationShiftID = pr.StationShiftID
		 join pos.Station AS st on st.StationID = ss.StationID
		 join #vwBranchAccess vba on st.BranchID = vba.BranchID
		INNER JOIN #PartyAccess AS vpa on pr.CustomerID=vpa.PartyID
		where   ( @CurrencyID is null or  -1 = @CurrencyID )
		and  (@PartyID is null or pr.CustomerID = @PartyID)
		and
		((@FromDate is null and pr.date < @ToDate)
		or
		(@FromDate is not null and pr.date between @FromDate and @ToDate)
		)		
		Group by pr.CustomerID,pr.IsPayed' 
    
    EXECUTE sp_executeSQL 
            @Query,
         N'@CurrencyID int,@PartyID bigint,@FromDate Date,@ToDate Date',
         @CurrencyID = @CurrencyID,
         @PartyID = @PartyID,
         @FromDate = @FromDate,
         @ToDate = @ToDate
END


--SET @Query = N'select * from '+@TableName
--EXEC (@Query)
END

