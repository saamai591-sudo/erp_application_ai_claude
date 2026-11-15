
----------------------------------------------[SLE].[spQuotationReport_Party]----------------
CREATE      PROC [SLE].[spQuotationReport_Party]
(
    @FromDate DATE,
    @ToDate DATE,
    @SelectedBranchs NVARCHAR(MAX) = NULL,
    @SelectedStuffs NVARCHAR(MAX) = NULL,
    @SelectedSaleTypes NVARCHAR(MAX) = NULL,
    @SelectedSaleAreas NVARCHAR(MAX) = NULL
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
     @SelectedBranchs = @SelectedBranchs,
     @SelectedSaleTypes = @SelectedSaleTypes,
     @SelectedSaleAreas = @SelectedSaleAreas,
     @SelectedCustomers = null,
     @TableName = @TableName,
     @GroupBy = 'CustomerID'
	
	
	
SET @Query = 
    N'select
CustomerID,
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
               group by CustomerID,CurrencyID'
               
EXEC (@Query)               
               

SET @Query = 
    N'select a.CustomerID, d.Code,
    
	  case when @CultureNo = 1 then d.Title else d.Title2 end CustomerTitle,
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
    + N' a join cfg.Party b on a.CustomerID = b.PartyID
    join acc.Dl d on b.DlID = d.DlID
    join cfg.Currency c on a.CurrencyID = c.CurrencyID
    '
	EXECUTE sp_executesql @query,
     N'@CultureNo			TinyInt',
     @CultureNo = @CultureNo
