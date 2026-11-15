
-------------------------------------------------------------
-------------------------------------[SLE].[spQuotationReport_Branch]-------------------------
CREATE     PROC [SLE].[spQuotationReport_Branch]
(
    @FromDate DATE,
    @ToDate DATE,
    @SelectedStuffs NVARCHAR(MAX) = NULL,
    @SelectedSaleTypes NVARCHAR(MAX) = NULL,
    @SelectedSaleAreas NVARCHAR(MAX) = NULL,
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
     @SelectedStuffs = @SelectedStuffs,
     @SelectedBranchs = null,
     @SelectedSaleTypes = @SelectedSaleTypes,
     @SelectedSaleAreas = @SelectedSaleAreas,
     @SelectedCustomers = @SelectedCustomers,
     @TableName = @TableName,
     @GroupBy = 'BranchID'
	
	
	
SET @Query = 
    N'select
BranchID,
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
               group by BranchID,CurrencyID'
               
EXEC (@Query)               
               

SET @Query = 
    N'select b.Code, b.BranchID,
    
	  case when @CultureNo = 1 then b.Title else b.Title2 end BranchTitle,
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
    + N' a join cfg.Branch b on a.BranchID = b.BranchID
    join cfg.Currency c on a.CurrencyID = c.CurrencyID
    '
	EXECUTE sp_executesql @query,
     N'@CultureNo			TinyInt',
     @CultureNo = @CultureNo
