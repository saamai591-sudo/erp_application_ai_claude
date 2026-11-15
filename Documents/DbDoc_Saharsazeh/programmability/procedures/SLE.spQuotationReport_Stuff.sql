
---------------------------------------------[SLE].[spQuotationReport_Stuff]-----------------
CREATE      PROC [SLE].[spQuotationReport_Stuff]
(
    @FromDate DATE,
    @ToDate DATE,
    @SelectedSaleTypes NVARCHAR(MAX) = NULL,
    @SelectedSaleAreas NVARCHAR(MAX) = NULL,
    @SelectedSaleBranchs NVARCHAR(MAX) = NULL,
    @SelectedCustomers NVARCHAR(MAX) = NULL
)
as
DECLARE @TableName      NVARCHAR(MAX),
        @FinalTable     NVARCHAR(MAX),
        @Query NVARCHAR(MAX),
        @Culture        NVARCHAR(10),
        @CultureNo      TINYINT



SET @Culture = CFG.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM   CFG.CultureInfo
WHERE  Culture = @Culture;

SET @TableName = cfg.getTempTableName(1)
SET @FinalTable = cfg.getTempTableName(1)

EXEC sle.spQuotationReportDataSource
     @FromDate = @FromDate,
     @ToDate = @ToDate,
     @SelectedStuffs = null,
     @SelectedBranchs = @SelectedSaleBranchs,
     @SelectedSaleTypes = @SelectedSaleTypes,
     @SelectedSaleAreas = @SelectedSaleAreas,
     @SelectedCustomers = @SelectedCustomers,
     @TableName = @TableName,
     @GroupBy = 'StuffID'
	
	
	
SET @Query = 
    N'select
StuffID,
CurrencyID,
sum(QuotationMainQuantity     ) QuotationMainQuantity,
sum(SaleContractMainQuantity  ) SaleContractMainQuantity,
sum(RemittanceMainQuantity    ) RemittanceMainQuantity,
sum(InvoiceMainQuantity		  ) InvoiceMainQuantity,
sum(OutgoingMainQuantity	  ) OutgoingMainQuantity,
sum(QuotationPrice			  ) QuotationPrice,
sum(SaleContractPrice		  ) SaleContractPrice,
sum(InvoicePrice			  ) InvoicePrice
		into ' + @FinalTable + N'
               from ' + @TableName + N' 
               group by StuffID,CurrencyID'
               
EXEC (@Query)      

SELECT * into #vwStuff
FROM stf.VWStuff AS v
               

SET @Query = 
    N'select b.StuffID,b.Code,
    
	  case when @CultureNo = 1 then b.Title else b.Title2 end StuffTitle,
	   case when @CultureNo = 1 then b.MainMeasureUnit else b.MainMeasureUnit2 end MainMeasureUnit,
	   case when @CultureNo = 1 then b.StuffAccountGroupTitle else b.StuffAccountGroupTitle2 end StuffAccountGroupTitle,
	   b.StuffGroupCode,
	   b.TechnicalCode,
	   case when @CultureNo = 1 then b.StuffGroupTitle else b.StuffGroupTitle2 end StuffGroupTitle,	   
	   case when @CultureNo = 1 then g.Title else g.Title2 end SaleGroupTitle,
	  case when @CultureNo = 1 then c.Title else c.Title2 end CurrencyTitle,
QuotationMainQuantity,
SaleContractMainQuantity,
RemittanceMainQuantity,
InvoiceMainQuantity,
OutgoingMainQuantity,
QuotationPrice,
SaleContractPrice,
InvoicePrice,
QuotationMainQuantity - isnull(SaleContractMainQuantity,0) NonSaleContractQuantity,
QuotationMainQuantity - isnull(RemittanceMainQuantity,0) NonRemittanceQuantity,
QuotationMainQuantity - isnull(InvoiceMainQuantity,0) NonInvoiceQuantity,
QuotationMainQuantity - isnull(OutgoingMainQuantity,0) NonOutgoingQuantity,
QuotationPrice - isnull(SaleContractPrice,0) NonSaleContractPrice,
QuotationPrice - isnull(InvoicePrice,0) NonInvoicePrice
               from ' + @FinalTable
    + N' a join #vwStuff b on a.StuffID = b.StuffID
    join cfg.Currency c on a.CurrencyID = c.CurrencyID
    left join cfg.[Group] g on b.SalesGroupID = g.GroupID
    '
	EXECUTE sp_executesql @query,
     N'@CultureNo			TinyInt',
     @CultureNo = @CultureNo;
