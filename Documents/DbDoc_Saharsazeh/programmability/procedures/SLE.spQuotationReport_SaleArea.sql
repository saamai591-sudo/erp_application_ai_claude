
--------------------------------------------------[SLE].[spQuotationReport_SaleArea]-------------------
CREATE      PROC [SLE].[spQuotationReport_SaleArea]
(
    @FromDate DATE,
    @ToDate DATE,
    @SelectedStuffs NVARCHAR(MAX) = NULL,
    @SelectedSaleTypes NVARCHAR(MAX) = NULL,
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
     @SelectedStuffs = @SelectedStuffs,
     @SelectedBranchs = @SelectedSaleBranchs,
     @SelectedSaleTypes = @SelectedSaleTypes,
     @SelectedSaleAreas = Null,
     @SelectedCustomers = @SelectedCustomers,
     @TableName = @TableName,
     @GroupBy = 'SaleAreaID'
	
	
	
SET @Query = 
    N'select
SaleAreaID,
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
               group by SaleAreaID,CurrencyID'
               
EXEC (@Query)               
               

SET @Query = 
    N'select b.SaleAreaID, b.Code,
    
	  case when @CultureNo = 1 then b.Title else b.Title2 end SaleAreaTitle,
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
    + N' a join sle.SaleArea b on a.SaleAreaID = b.SaleAreaID
    join cfg.Currency c on a.CurrencyID = c.CurrencyID
    '
	EXECUTE sp_executesql @query,
     N'@CultureNo			TinyInt',
     @CultureNo = @CultureNo
