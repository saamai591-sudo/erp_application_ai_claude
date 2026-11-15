
--------Start of #9100
CREATE   PROC sle.spQuotationReportDataSource
(
    @FromDate DATE,
    @ToDate DATE,
    @SelectedStuffs NVARCHAR(MAX),
    @SelectedBranchs NVARCHAR(MAX),
    @SelectedSaleTypes NVARCHAR(MAX),
    @SelectedSaleAreas NVARCHAR(MAX),
    @SelectedCustomers NVARCHAR(MAX),
    @TableName NVARCHAR(MAX),
    @GroupBy NVARCHAR(MAX),
    @SelectedDocuments NVARCHAR(MAX) = null
)
as

DECLARE     @Query NVARCHAR(MAX),@QuotationItemGroupBy NVARCHAR(50) 
--set @SelectedStuffs = N'3,54'


SELECT VALUE StfID
INTO   #SelectedStuff
FROM   CFG.R_FnCommaStr2Table(@SelectedStuffs)
    
SELECT VALUE BID
INTO   #SelectedBranch
FROM   CFG.R_FnCommaStr2Table(@SelectedBranchs)
    
SELECT VALUE STID
INTO   #SelectedSaleType
FROM   CFG.R_FnCommaStr2Table(@SelectedSaleTypes)

SELECT VALUE SAID
INTO   #SelectedSaleArea
FROM   CFG.R_FnCommaStr2Table(@SelectedSaleAreas)

SELECT VALUE CstmrID
INTO   #Customer
FROM   CFG.R_FnCommaStr2Table(@SelectedCustomers)

SELECT VALUE SDID
INTO   #SelectedDocuments
FROM   CFG.R_FnCommaStr2Table(@SelectedDocuments)


SET @Query = N'Create table ' + @TableName + N'(' + @GroupBy + 
    N'  int,CurrencyID int,
QuotationMainQuantity decimal(36,10),
SaleContractMainQuantity decimal(36,10),
RemittanceMainQuantity        decimal(36,10),
InvoiceMainQuantity				decimal(36,10),
OutgoingMainQuantity			decimal(36,10),
QuotationPrice					decimal(36,10),
SaleContractPrice				decimal(36,10),
InvoicePrice					decimal(36,10))'

EXEC (@Query)
if @GroupBy = 'QuotationID'
BEGIN
	set @GroupBy = 'q.QuotationID'
END

if @GroupBy = 'QuotationItemID'
BEGIN
	set @QuotationItemGroupBy = 'qi.QuotationItemID'
END

SET @Query = N'
	Insert into '+@TableName+N'
SELECT ' + @GroupBy +
    N',q.CurrencyID,
       sum(qi.MainQuantity)            QuotationMainQuantity,
       0.0                     AS SaleContractMainQuantity,
       0.0                     as RemittanceMainQuantity,
       0.0 as InvoiceMainQuantity,
       0.0 as OutgoingMainQuantity,
       sum(qi.Price) QuotationPrice,
       0.0 as SaleContractPrice,
       0.0 as InvoicePrice
FROM   sle.Quotation           AS q
       JOIN sle.QuotationItem  AS qi
            ON  qi.QuotationID = q.QuotationID
			left join #SelectedStuff AS ss on qi.StuffID = ss.StfID
			left join #SelectedBranch sb on q.BranchID = sb.BID
			left join #SelectedSaleType sst on q.SaleTypeID = sst.STID
			left join #SelectedSaleArea ssa on q.SaleAreaID = ssa.SAID
			left join #Customer c on c.CstmrID = q.CustomerID
			left join #SelectedDocuments ssd on ssd.SDID =  q.QuotationID
WHERE 
q.Date between @FromDate and @ToDate 
and 
(@SelectedStuffs is NULL or ss.StfID is NOT NULL)
and (@SelectedBranchs is NULL or sb.BID is NOT NULL)
and (@SelectedSaleTypes is NULL or sst.STID is NOT NULL)
and (@SelectedSaleAreas is NULL or ssa.SAID is NOT NULL)
and (@SelectedCustomers is NULL or c.CstmrID is NOT NULL)
and (@SelectedDocuments is NULL or  ssd.SDID is not null)
group by CurrencyID ,' + case when @QuotationItemGroupBy is null then @GroupBy else @QuotationItemGroupBy end



EXECUTE sp_executesql @query,
     N'@FromDate			DATE,
    @ToDate				DATE,
    @SelectedStuffs		NVARCHAR(MAX),
    @SelectedBranchs	NVARCHAR(MAX),
    @SelectedSaleTypes	NVARCHAR(MAX),
    @SelectedSaleAreas	NVARCHAR(MAX),
    @SelectedCustomers	NVARCHAR(MAX),
    @SelectedDocuments NVARCHAR(MAX)',
     @FromDate = @FromDate,
     @ToDate = @ToDate,
     @SelectedStuffs = @SelectedStuffs,
     @SelectedBranchs = @SelectedBranchs,
     @SelectedSaleTypes = @SelectedSaleTypes,
     @SelectedSaleAreas = @SelectedSaleAreas,
     @SelectedCustomers = @SelectedCustomers,
     @SelectedDocuments = @SelectedDocuments
     
     
     SELECT *
     INTO   #Quotation_Non_Invoice
     FROM   sle.Quotation_Non_Invoice qi
            left JOIN #SelectedStuff AS ss
                 ON  qi.StuffID = ss.StfID
            left JOIN #SelectedBranch sb
                 ON  qi.BranchID = sb.BID
            left JOIN #SelectedSaleType sst
                 ON  qi.SaleTypeID = sst.STID
            left JOIN #SelectedSaleArea ssa
                 ON  qi.SaleAreaID = ssa.SAID
            left JOIN #Customer c
                 ON  c.CstmrID = qi.CustomerID
			left join #SelectedDocuments ssd on ssd.SDID =  qi.QuotationID
WHERE 
qi.Date between @FromDate and @ToDate 
and 
(@SelectedStuffs is NULL or ss.StfID is NOT NULL)
and (@SelectedBranchs is NULL or sb.BID is NOT NULL)
and (@SelectedSaleTypes is NULL or sst.STID is NOT NULL)
and (@SelectedSaleAreas is NULL or ssa.SAID is NOT NULL)
and (@SelectedCustomers is NULL or c.CstmrID is NOT NULL)
and (@SelectedDocuments is NULL or  ssd.SDID is not null)   
     

     
     set @Query = N'Insert into '+@TableName + N'
     select '+@GroupBy +N',CurrencyID
     ,
      0.0            QuotationMainQuantity,
       0.0                     AS SaleContractMainQuantity,
       0.0                     as RemittanceMainQuantity,
       sum(DoMainQuantity) as InvoiceMainQuantity,
       0.0 as OutgoingMainQuantity,
       0 QuotationPrice,
       0.0 as SaleContractPrice,
       sum(price-NonPrice) as InvoicePrice
     from #Quotation_Non_Invoice q
 group by CurrencyID, ' + @GroupBy


EXEC (@Query)     

     SELECT *
     INTO   #Quotation_Non_SaleContract
     FROM   sle.Quotation_Non_SaleContract qi
            left JOIN #SelectedStuff AS ss
                 ON  qi.StuffID = ss.StfID
            left JOIN #SelectedBranch sb
                 ON  qi.BranchID = sb.BID
            left JOIN #SelectedSaleType sst
                 ON  qi.SaleTypeID = sst.STID
            left JOIN #SelectedSaleArea ssa
                 ON  qi.SaleAreaID = ssa.SAID
            left JOIN #Customer c
                 ON  c.CstmrID = qi.CustomerID
			left join #SelectedDocuments ssd on ssd.SDID =  qi.QuotationID
WHERE 
qi.Date between @FromDate and @ToDate 
and 
(@SelectedStuffs is NULL or ss.StfID is NOT NULL)
and (@SelectedBranchs is NULL or sb.BID is NOT NULL)
and (@SelectedSaleTypes is NULL or sst.STID is NOT NULL)
and (@SelectedSaleAreas is NULL or ssa.SAID is NOT NULL)
and (@SelectedCustomers is NULL or c.CstmrID is NOT NULL)
and (@SelectedDocuments is NULL or  ssd.SDID is not null)   


  
     
       set @Query = N'Insert into '+@TableName + N'
		select '+@GroupBy +N',CurrencyID
		,
		0.0            QuotationMainQuantity,
		sum(DoMainQuantity)               AS SaleContractMainQuantity,
		0.0                     as RemittanceMainQuantity,
		0 as InvoiceMainQuantity,
		0.0 as OutgoingMainQuantity,
		0 QuotationPrice,
		sum(price-NonPrice) as SaleContractPrice,
		0 as InvoicePrice
		from #Quotation_Non_SaleContract q		
		group by CurrencyID, ' + @GroupBy

EXEC (@Query)


     
     

     SELECT *
     INTO   #Quotation_Non_Outgoing
     FROM   sle.Quotation_Non_Outgoing qi
            left JOIN #SelectedStuff AS ss
                 ON  qi.StuffID = ss.StfID
            left JOIN #SelectedBranch sb
                 ON  qi.BranchID = sb.BID
            left JOIN #SelectedSaleType sst
                 ON  qi.SaleTypeID = sst.STID
            left JOIN #SelectedSaleArea ssa
                 ON  qi.SaleAreaID = ssa.SAID
            left JOIN #Customer c
                 ON  c.CstmrID = qi.CustomerID
			left join #SelectedDocuments ssd on ssd.SDID =  qi.QuotationID
WHERE 
qi.Date between @FromDate and @ToDate 
and 
(@SelectedStuffs is NULL or ss.StfID is NOT NULL)
and (@SelectedBranchs is NULL or sb.BID is NOT NULL)
and (@SelectedSaleTypes is NULL or sst.STID is NOT NULL)
and (@SelectedSaleAreas is NULL or ssa.SAID is NOT NULL)
and (@SelectedCustomers is NULL or c.CstmrID is NOT NULL)
and (@SelectedDocuments is NULL or  ssd.SDID is not null)   

     
         
            set @Query = N'Insert into '+@TableName + N'
		select '+@GroupBy +N',CurrencyID
		,
		0.0            QuotationMainQuantity,
		0               AS SaleContractMainQuantity,
		0           as RemittanceMainQuantity,
		0 as InvoiceMainQuantity,
		sum(DoMainQuantity)  as OutgoingMainQuantity,
		0 QuotationPrice,
		0 as SaleContractPrice,
		0 as InvoicePrice
		from #Quotation_Non_Outgoing q
		
		group by CurrencyID, ' + @GroupBy

EXEC (@Query)
       
------------End of #9100
